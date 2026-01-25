// backend/src/clients/dictionaryExamples.js
/**
 * 文件說明
 * - 用途：產生「嚴格對應多義 sense」的例句（呼叫 Groq LLM）
 * - 特性：
 *   1) 嚴格遵守 senseIndex（只用指定義項）
 *   2) 依 options 嘗試滿足文法限制（若不自然可部分忽略但不可回空）
 *   3) ✅ Phase 2-1：支援 refs 多重參考點，並回傳 usedRefs / missingRefs / notes（向後相容）
 *   4) ✅ Phase 2-2：後端極簡後驗（只對 kind:"custom" 做字串包含檢查）以避免 LLM 亂報 usedRefs/missingRefs
 *
 * 異動紀錄
 * - 2026-01-05：Phase 2-1：加入 refs/usedRefs/missingRefs/notes schema 與 prompt 強制；補初始化狀態（Production 排查）；所有回傳向後相容且 usedRefs/missingRefs 保證存在
 * - 2026-01-05：Phase 2-2：新增 kind:"custom" 後驗檢查（case-insensitive includes）；以後驗結果覆蓋 custom refs 的 used/missing，非 custom 仍保留 LLM 回報
 * - 2026-01-11：Phase 2-UX：強化「德文名詞大小寫」硬規則，避免 LLM 產生 hund 這類錯誤用法；新增後驗檢查 + 單次 retry（不改動 used/missing 邏輯）
 * - 2026-01-14：Usage：將 Groq response.usage 以 _llmUsage 形式回傳（供 route 記錄真實 tokens）
 * - 2026-01-14：Usage：在本檔案中直接記錄例句生成 tokens（logLLMUsage；只算最後一次回傳給使用者的那次）
 */

const client = require("./groqClient");
const { mapExplainLang } = require("./dictionaryUtils");
const { logLLMUsage } = require("../utils/usageLogger");

// =============================
// 功能初始化狀態（Production 排障用）
// =============================

/**
 * 中文功能說明：建立此模組的初始化狀態快照（不包含敏感資訊）
 */
function buildInitState() {
  return {
    module: "backend/src/clients/dictionaryExamples.js",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    env: {
      hasGroqApiKey: Boolean(process.env.GROQ_API_KEY),
      debugLLMDict: process.env.DEBUG_LLM_DICT || "",
      debugDictionary: process.env.DEBUG_DICTIONARY || "",
      debugExamplesRefs: process.env.DEBUG_EXAMPLES_REFS || "",
    },
    runtime: {
      hasGroqClient:
        Boolean(client) &&
        Boolean(client.chat) &&
        Boolean(client.chat.completions) &&
        typeof client.chat.completions.create === "function",
    },
    timestamp: new Date().toISOString(),
  };
}

const __initState = buildInitState();

/**
 * 中文功能說明：讓外部可以讀取初始化狀態（排障用）
 * - 不回傳任何 API key 內容
 */
function getInitStatus() {
  return { ...__initState, timestamp: new Date().toISOString() };
}

// 若你想在 production 立即看到狀態，可用環境變數開啟（避免平常噪音）
if (process.env.DEBUG_INIT_STATUS === "1") {
  console.log("[dictionaryExamples] initStatus =", getInitStatus());
}

// =============================
// Usage（回傳 _llmUsage 供 route 記帳）
// =============================

/**
 * 中文功能說明：從 LLM response 抽取 usage（避免 SDK 差異造成 undefined）
 * - 期望格式：{ prompt_tokens, completion_tokens, total_tokens }
 * - 若不存在，回傳 null
 */
function pickLLMUsage(resp) {
  try {
    const u = resp && typeof resp === "object" ? resp.usage : null;
    if (!u || typeof u !== "object") return null;

    const total = Number(u.total_tokens);
    const prompt = Number(u.prompt_tokens);
    const completion = Number(u.completion_tokens);

    // total_tokens 是最重要的判斷（usageLogger.logLLMUsage 也會看這個）
    if (!Number.isFinite(total) || total <= 0) return null;

    return {
      prompt_tokens: Number.isFinite(prompt) ? prompt : 0,
      completion_tokens: Number.isFinite(completion) ? completion : 0,
      total_tokens: total,
    };
  } catch {
    return null;
  }
}

/**
 * 中文功能說明：把 _llmUsage 掛到回傳結果上（不影響前端 UI；route 可用來記帳）
 */
function attachLLMUsage(resultObj, usage) {
  const r = resultObj && typeof resultObj === "object" ? resultObj : {};
  const u = usage && typeof usage === "object" ? usage : null;
  // 僅在有 total_tokens 的時候掛上，避免污染資料
  if (
    !u ||
    !Number.isFinite(Number(u.total_tokens)) ||
    Number(u.total_tokens) <= 0
  ) {
    return r;
  }
  return { ...r, _llmUsage: u };
}

// =============================
// 小工具（Phase 2 refs 支援）
// =============================

/**
 * 中文功能說明：把 refs 正規化成 [{ key: string, kind?: string, ... }]
 * - 向後相容：refs 不存在或格式不正確時，回傳空陣列
 */
function normalizeRefs(inputRefs) {
  if (!Array.isArray(inputRefs)) return [];
  return inputRefs
    .map((r) => {
      if (typeof r === "string") return { key: r };
      if (r && typeof r === "object" && typeof r.key === "string")
        return { ...r, key: String(r.key) };
      return null;
    })
    .filter(Boolean)
    .map((r) => ({ ...r, key: String(r.key || "").trim() }))
    .filter((r) => r.key.length > 0);
}

/**
 * 中文功能說明：保證 usedRefs / missingRefs / notes 一定存在（避免前端 undefined）
 */
function ensureRefsFields(obj) {
  const safe = obj && typeof obj === "object" ? obj : {};
  const usedRefs = Array.isArray(safe.usedRefs) ? safe.usedRefs : [];
  const missingRefs = Array.isArray(safe.missingRefs) ? safe.missingRefs : [];
  const notes = typeof safe.notes === "string" ? safe.notes : "";
  return { ...safe, usedRefs, missingRefs, notes };
}

/**
 * 中文功能說明：把 refs key 列表轉成 prompt 的條列文字
 */
function buildRefsBulletText(refKeys) {
  if (!Array.isArray(refKeys) || refKeys.length === 0) return "(keine)";
  return refKeys.map((k) => `- ${k}`).join("\n");
}

/**
 * 中文功能說明：用於 debug refs runtime（避免常態噪音，需 DEBUG_EXAMPLES_REFS=1）
 */
function debugRefsRuntime(tag, payload) {
  if (process.env.DEBUG_EXAMPLES_REFS !== "1") return;
  console.log(`[dictionaryExamples][refs][${tag}]`, payload);
}

/**
 * 中文功能說明（Phase 2-2）：大小寫不敏感包含
 */
function includesCI(haystack, needle) {
  try {
    return String(haystack || "")
      .toLowerCase()
      .includes(String(needle || "").toLowerCase());
  } catch {
    return false;
  }
}

/**
 * ✅ 2026/01/11：大小寫嚴格檢查小工具（避免 Hund → hund）
 *
 * 注意：
 * - 這裡不是用於 used/missing 的命中邏輯（那段維持 Phase 2-2 不動）
 * - 這裡只用來做「品質底線」：名詞大小寫不該錯
 */

/**
 * 中文功能說明：escape 正規表達式特殊字元
 */
function escapeRegExp(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 中文功能說明：判斷是否是「單字」ref（不含空白）
 */
function isSingleTokenRefKey(refKey) {
  return (
    typeof refKey === "string" && refKey.trim() && !/\s/.test(refKey.trim())
  );
}

/**
 * 中文功能說明：判斷 refKey 是否「像名詞」：
 * - 最保守 heuristic：單字 + 首字母是大寫（含德文 ÄÖÜ）
 * - 不依賴 POS（因為此檔案目前拿不到 refs 的 POS）
 */
function isNounLikeRefKey(refKey) {
  const k = String(refKey || "").trim();
  if (!isSingleTokenRefKey(k)) return false;
  // 德文名詞首字母大寫（A-ZÄÖÜ）
  return /^[A-ZÄÖÜ]/.test(k);
}

/**
 * 中文功能說明：case-sensitive word boundary match（避免 substring 誤判）
 */
function hasWordExactCase(sentence, word) {
  try {
    const s = String(sentence || "");
    const w = String(word || "").trim();
    if (!s || !w) return false;
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "u");
    return re.test(s);
  } catch {
    return false;
  }
}

/**
 * 中文功能說明：是否出現「小寫版本」但未出現正確大小寫
 * - 例：word=Hund, lower=hund
 * - 若 sentence 包含 \bhund\b 且不包含 \bHund\b → true
 */
function hasLowercaseInsteadOfProper(sentence, properWord) {
  try {
    const s = String(sentence || "");
    const w = String(properWord || "").trim();
    if (!s || !w) return false;

    const lower = w.toLowerCase();

    // 若 proper 本身已是全小寫，沒意義
    if (w === lower) return false;

    const hasLower = hasWordExactCase(s, lower);
    const hasProper = hasWordExactCase(s, w);

    return hasLower && !hasProper;
  } catch {
    return false;
  }
}

/**
 * 中文功能說明：找出「名詞型 refs」清單（僅單字、首字母大寫）
 */
function pickNounLikeSingleTokenRefs(refKeys) {
  const list = Array.isArray(refKeys) ? refKeys : [];
  return list
    .map((k) => String(k || "").trim())
    .filter(Boolean)
    .filter((k) => isNounLikeRefKey(k));
}

/**
 * 中文功能說明：檢查例句是否違反名詞大小寫底線
 * - 目前規則：若 noun-like ref（例如 Hund）在句子中出現小寫版本（hund）但沒有正確版本 → 視為 violation
 * - 若句子完全沒有出現該 ref（正確大小寫），這裡不把它當成大小寫錯（它會在 refs used/missing 另行處理）
 */
function validateNounCapitalizationForRefs({ sentence, refKeys }) {
  const s = String(sentence || "");
  const nounRefs = pickNounLikeSingleTokenRefs(refKeys);

  const violations = [];

  for (const proper of nounRefs) {
    // only check "lowercase instead of proper" scenario
    if (hasLowercaseInsteadOfProper(s, proper)) {
      violations.push({
        ref: proper,
        found: proper.toLowerCase(),
        expected: proper,
      });
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    nounRefs,
  };
}

/**
 * 中文功能說明：建構「名詞大小寫硬規則」提示片段
 * - 這段會插入 prompt，讓 LLM 有明確約束
 */
function buildNounCapitalizationRuleText(refKeys) {
  const nounRefs = pickNounLikeSingleTokenRefs(refKeys);

  // 不想太冗長：只列出最多 10 個 noun refs
  const display = nounRefs.slice(0, 10);
  const bullet =
    display.length > 0 ? display.map((k) => `- ${k}`).join("\n") : "(keine)";

  const extra =
    nounRefs.length > 10
      ? `\n(weitere ${
          nounRefs.length - 10
        } Nomen-Refs sind ebenfalls zu beachten)`
      : "";

  return (
    "GERMAN ORTHOGRAPHY HARD RULES (MUST FOLLOW):\n" +
    "- In German, ALL NOUNS MUST be capitalized.\n" +
    "- If a ref is a noun-like single word (e.g., starts with a capital letter), you MUST use EXACTLY the same casing in the example.\n" +
    "- NEVER output a lowercase noun form such as \"hund\" when the correct form is \"Hund\".\n" +
    "- If unsure, rephrase the sentence but keep noun capitalization correct.\n" +
    "\nNoun-like single-word refs (exact casing required):\n" +
    bullet +
    extra
  );
}

/**
 * 中文功能說明（Phase 2-2）：只針對 kind:"custom" 做極簡後驗
 * - 規則：ref.key 若在任何 example 中大小寫不敏感包含 → used
 * - 否則 → missing
 * - 回傳：{ used: string[], missing: string[] }
 */
function postCheckCustomRefs({ normalizedRefs, examples }) {
  const exList = Array.isArray(examples) ? examples : [];
  const joined = exList.join(" ");
  const customRefs = Array.isArray(normalizedRefs)
    ? normalizedRefs.filter((r) => String(r.kind || "") === "custom")
    : [];

  const used = [];
  const missing = [];

  for (const r of customRefs) {
    const k = String(r.key || "").trim();
    if (!k) continue;

    if (includesCI(joined, k)) used.push(k);
    else missing.push(k);
  }

  return { used, missing };
}

/**
 * 中文功能說明（Phase 2-2）：把後驗結果套回 usedRefs/missingRefs
 * - 原則：custom refs 以後驗結果為準（覆蓋 LLM 報告）
 * - 非 custom refs：保留 LLM usedRefs/missingRefs（避免誤判）
 */
function applyPostCheckToRefs({
  normalizedRefs,
  examples,
  llmUsedRefs,
  llmMissingRefs,
}) {
  const llmUsed = Array.isArray(llmUsedRefs) ? llmUsedRefs : [];
  const llmMissing = Array.isArray(llmMissingRefs) ? llmMissingRefs : [];

  const customKeys = Array.isArray(normalizedRefs)
    ? normalizedRefs
        .filter((r) => String(r.kind || "") === "custom")
        .map((r) => String(r.key || "").trim())
        .filter(Boolean)
    : [];

  const customKeySet = new Set(customKeys.map((k) => k.toLowerCase()));

  const { used: customUsed, missing: customMissing } = postCheckCustomRefs({
    normalizedRefs,
    examples,
  });

  // 先把 LLM 的 used/missing 裡「custom keys」移除（避免 LLM 亂報污染）
  const keptUsed = llmUsed.filter(
    (k) => !customKeySet.has(String(k).toLowerCase())
  );
  const keptMissing = llmMissing.filter(
    (k) => !customKeySet.has(String(k).toLowerCase())
  );

  // 再合併後驗結果
  const mergedUsed = [...keptUsed, ...customUsed];
  // missing 也要避免把已 used 的 custom 又列進 missing
  const customUsedSet = new Set(customUsed.map((k) => k.toLowerCase()));
  const mergedMissing = [
    ...keptMissing,
    ...customMissing.filter(
      (k) => !customUsedSet.has(String(k).toLowerCase())
    ),
  ];

  // 去重（保序）
  const seenU = new Set();
  const finalUsed = [];
  for (const k of mergedUsed) {
    const key = String(k || "").trim();
    if (!key) continue;
    const low = key.toLowerCase();
    if (seenU.has(low)) continue;
    seenU.add(low);
    finalUsed.push(key);
  }

  const seenM = new Set();
  const finalMissing = [];
  for (const k of mergedMissing) {
    const key = String(k || "").trim();
    if (!key) continue;
    const low = key.toLowerCase();
    if (seenM.has(low)) continue;
    seenM.add(low);
    finalMissing.push(key);
  }

  return { usedRefs: finalUsed, missingRefs: finalMissing };
}

/**
 * 產生「嚴格對應多義 sense」的例句
 *
 * params:
 * - word: 當前顯示的字（表面型）
 * - baseForm: 基本型（名詞單數、動詞不定式…）
 * - partOfSpeech: 詞性（Nomen / Verb ...）
 * - gender: der / die / das / ""
 * - senseIndex: 要用第幾個詞義（0-based）
 * - explainLang: 使用者介面語言（zh-TW / en ...），只影響提示文字 & 翻譯語言
 * - options: 文法選項（格、冠詞、人稱、時態…）
 * - definitionDeList: 所有義項的德文定義（陣列）
 * - definitionLangList: 所有義項的母語短義 / 翻譯（陣列，可選）
 *
 * Phase 2（向後相容擴充）：
 * - refs?: Array<{ key: string, kind?: "custom"|"entry"|"grammar", ... }> | string[]
 *
 * Usage（可選）：
 * - userId?: string
 * - email?: string
 * - endpoint?: string
 * - requestId?: string
 */
async function generateExamples(params = {}) {
  const {
    word,

    // ✅ Usage：由上游傳入（可選）
    userId = "",
    email = "",
    endpoint = "/api/dictionary/examples",
    requestId = "",

    baseForm,
    partOfSpeech,
    gender,
    senseIndex = 0,
    explainLang = "zh-TW",
    options = {},
    definitionDeList,
    definitionLangList,

    // ✅ Phase 2：refs（可選）
    refs,
  } = params;

  // ✅ Phase 2：正規化 refs
  const normalizedRefs = normalizeRefs(refs);
  const refKeys = normalizedRefs.map((r) => r.key);

  debugRefsRuntime("input", {
    hasRefs: Array.isArray(refs),
    refsCount: Array.isArray(refs) ? refs.length : 0,
    normalizedCount: normalizedRefs.length,
    refKeys,
    kinds: normalizedRefs.slice(0, 10).map((r) => r.kind || ""),
  });

  // =============================
  // Usage 記帳：只計算「最後一次回傳給使用者」的那次 tokens
  // - 無 retry：記 usage1
  // - 有 retry：只記 usage2（避免重複計算）
  // =============================
  function logFinalLLMUsage(usage) {
    try {
      if (!userId) return;

      const u = usage && typeof usage === "object" ? usage : null;
      const total = Number(u && u.total_tokens);
      if (!Number.isFinite(total) || total <= 0) return;

      logLLMUsage({
        endpoint: endpoint || "/api/dictionary/examples",
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        usage: {
          prompt_tokens: Number(u.prompt_tokens) || 0,
          completion_tokens: Number(u.completion_tokens) || 0,
          total_tokens: total,
        },
        userId,
        email,
        ip: "",
        requestId: requestId || "",
      });
    } catch (e) {
      // best-effort：不要影響主要流程
      console.warn(
        "[dictionaryExamples] logFinalLLMUsage failed:",
        e && e.message ? e.message : String(e)
      );
    }
  }

  const safeWord = (String(word || "").trim() || String(baseForm || "").trim());
  // ✅ 2026/01/14：避免 headword 與 baseForm 同時影響 LLM
  // - 預設只用 word（headword/表面型）
  // - 僅在 word 為空時才 fallback 用 baseForm（供未來「清除 headword」機制使用）
  if (!safeWord) {
    return {
      word: "",
      baseForm: "",
      partOfSpeech: "",
      gender: "",
      senseIndex: 0,
      options: {},
      examples: [],
      exampleTranslation: "",
      usedRefs: [],
      missingRefs: [],
      notes: "",
    };
  }

  const targetLangLabel = mapExplainLang(explainLang);

  // 正規化多義定義：確保兩個都是陣列
  let deList = [];
  if (Array.isArray(definitionDeList)) {
    deList = definitionDeList
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((s) => s.length > 0);
  } else if (typeof definitionDeList === "string" && definitionDeList.trim()) {
    deList = [definitionDeList.trim()];
  }

  let langList = [];
  if (Array.isArray(definitionLangList)) {
    langList = definitionLangList
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((s) => s.length > 0);
  } else if (
    typeof definitionLangList === "string" &&
    definitionLangList.trim()
  ) {
    langList = [definitionLangList.trim()];
  }

  // sense 數量，以德文定義為主
  const senseCount = deList.length || langList.length || 1;

  // 正規化 senseIndex，避免超出範圍
  const normSenseIndex =
    Number.isFinite(senseIndex) && senseIndex >= 0
      ? Math.min(senseIndex, senseCount - 1)
      : 0;

  // 把所有義項組成一段 summary，幫助模型選對義
  const senseSummaryLines = [];
  for (let i = 0; i < senseCount; i++) {
    const de = deList[i] || "";
    const lang = langList[i] || "";
    const idxLabel = `Sense ${i} (index ${i})`;
    let line = `- ${idxLabel}: `;
    if (de) line += `DE="${de}"`;
    if (lang) line += ` | L1="${lang}"`;
    senseSummaryLines.push(line);
  }

  const senseSummaryText =
    senseSummaryLines.length > 0
      ? senseSummaryLines.join("\n")
      : "- Sense 0: (keine zusätzlichen Informationen verfügbar)";

  const optionsSummary = JSON.stringify(options || {}, null, 2);

  // ✅ 2026/01/11：名詞大小寫硬規則片段（插入 prompt）
  const nounCapitalizationRuleText = buildNounCapitalizationRuleText(refKeys);

  const systemPromptForExamples = `
You are a German example sentence generator for a language learning app.

Your task:
- Generate ONE natural German example sentence for a given word.
- The word can have multiple senses. You will receive a list of all senses (in German, plus optionally in the learner's language).
- You MUST use ONLY the sense indicated by "senseIndex".
- Respect the requested grammatical constraints (case, article, person, tense, etc.) when they are provided.
- If constraints are impossible or unnatural, IGNORE some of the constraints, but STILL return a natural example sentence. NEVER leave the examples empty.
- Even if the caller provides the same word and senseIndex multiple times, you must imagine a DIFFERENT realistic situation each time and avoid repeating the same stock phrases (for example, do not always start with "Ich gehe ..." or "Ich besuche ...").
- The target learner's explanation language is ${targetLangLabel}.

${nounCapitalizationRuleText}

PHASE 2 REF RULES (IMPORTANT):
- You will receive a list of reference points ("refs").
- You MUST include ALL refs in the example sentence (in natural German; inflection/variation is allowed).
- Finally, you MUST reply in JSON and include:
  - examples
  - exampleTranslation
  - usedRefs
  - missingRefs
  - notes (optional)

Output format (MUST be valid JSON, no comments, no trailing commas):

{
  "word": "original word form you received",
  "baseForm": "repeat the word",
  "partOfSpeech": "a short POS label, e.g. Nomen / Verb / Adjektiv, or empty string",
  "gender": "der / die / das / '' for nouns, otherwise empty string",
  "senseIndex": 0,
  "usedSenseDescription": "the exact sense description in German you used",
  "options": { ...echo of the options you used... },

  "examples": [
    "Exactly ONE German example sentence that follows the requested grammatical options as closely as possible."
  ],

  "exampleTranslation": "The translation of that single sentence into ${targetLangLabel}.",

  "usedRefs": ["ref.key", "..."],
  "missingRefs": ["ref.key", "..."],
  "notes": "optional"
}
`;

  const userPromptForExamples = `
Bitte erzeuge GENAU 1 deutschen Beispielsatz für das Wort:

- Wort: "${safeWord}"
- Wortart (partOfSpeech): "${partOfSpeech || ""}"
- Genus (gender): "${gender || ""}"

Die möglichen Wortbedeutungen (Senses) sind:

${senseSummaryText}

Verwende AUSSCHLIESSLICH die Bedeutung mit:
- senseIndex (0-basiert): ${normSenseIndex}
- also nur "Sense ${normSenseIndex}"

Grammatische Optionen (JSON):
${optionsSummary}

Referenzpunkte (refs), die im Satz vorkommen MÜSSEN:
${buildRefsBulletText(refKeys)}

Anforderungen:
- Halte dich so gut wie möglich an die oben genannten grammatischen Optionen.
- Wenn "case" angegeben ist und das Wort ein Nomen ist, setze das Nomen in diesen Kasus.
- Wenn "articleType" und/oder "gender" angegeben sind, wähle passende Artikel (z.B. der/die/das, ein/eine).
- Wenn "possessive" angegeben ist, verwende das entsprechende Possessivpronomen.
- Wenn "tense" und "person"/"personNumber" angegeben sind und das Wort ein Verb ist, konjugiere das Verb entsprechend.
- Wenn "polarity" = "negative", formuliere einen natürlichen negativen Satz.
- Nutze ausschließlich die angegebene Wortbedeutung für senseIndex ${normSenseIndex} und ignoriere alle anderen.
- Gib nur EINEN Satz zurück.
- Du MUSST alle refs im Satz unterbringen (natürliches Deutsch; Flexion erlaubt).
- Orthographie-Hard-Rule: Alle deutschen Nomen werden großgeschrieben. Wenn ein Ref ein Nomen ist (z.B. "Hund"), benutze exakt diese Groß-/Kleinschreibung. Schreibe NICHT "hund".
- Am Ende: Gib NUR das JSON im beschriebenen Format zurück (inkl. usedRefs/missingRefs).
`;

  /**
   * ✅ 2026/01/11：retry prompt（只用一次，避免無限 loop）
   * - 目的：若模型產生 "hund" 但應為 "Hund"，要求修正並重新產生
   */
  function buildRetryUserPrompt({ basePrompt, violations, nounRefs }) {
    const vList = Array.isArray(violations) ? violations : [];
    const nounList = Array.isArray(nounRefs) ? nounRefs : [];

    const vText =
      vList.length > 0
        ? vList
            .slice(0, 8)
            .map((v) => `- Found "${v.found}" but expected "${v.expected}"`)
            .join("\n")
        : "- (unknown)";

    const nText =
      nounList.length > 0
        ? nounList.slice(0, 12).map((k) => `- ${k}`).join("\n")
        : "(keine)";

    return (
      basePrompt +
      "\n\n" +
      "WICHTIG (RETRY): In der vorherigen Antwort war die Groß-/Kleinschreibung von Nomen falsch.\n" +
      "Bitte erzeuge den Satz NEU und korrigiere die Orthographie.\n" +
      "Regeln:\n" +
      "- Alle deutschen Nomen werden großgeschrieben.\n" +
      "- Für noun-like single-word refs muss die exakte Schreibweise verwendet werden (z.B. \"Hund\" nicht \"hund\").\n" +
      "- Falls nötig, formuliere den Satz um, aber bleibe natürlich.\n" +
      "\nNoun-like refs (exakte Schreibweise):\n" +
      nText +
      "\n\nVerstöße, die zu korrigieren sind:\n" +
      vText +
      "\n\nGib wieder NUR das JSON zurück."
    );
  }

  /**
   * ✅ 2026/01/11：統一呼叫 LLM（方便 retry）
   * - 保留原 model/format 設定；retry 僅調低 temperature 以提高遵循度
   */
  async function callLLMForExamples({ systemPrompt, userPrompt, temperature }) {
    return client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature:
        typeof temperature === "number" && Number.isFinite(temperature)
          ? temperature
          : 0.7, // default same as original
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
  }

  // 簡單 fallback：萬一 LLM 回傳空例句時使用
  function buildFallbackExample() {
    // 這句會很中性，但至少不會是空的
    return `Dies ist ein Beispielsatz mit dem Wort "${safeWord}".`;
  }

  function buildFallbackTranslation() {
    if (explainLang === "zh-TW") {
      return `這是一個包含「${safeWord}」的示範句子。`;
    }
    if (explainLang === "zh-CN") {
      return `這是一個包含「${safeWord}」的示範句子。`;
    }
    if (explainLang === "en") {
      return `This is a sample sentence using the word "${safeWord}".`;
    }
    return `Sample sentence using the word "${safeWord}".`;
  }

  // ✅ 統一 fallback 結果（保證 usedRefs/missingRefs）
  function buildFallbackResult(noteText) {
    const fb = buildFallbackExample();
    const fbTrans = buildFallbackTranslation();
    return {
      word: safeWord,
      baseForm: baseForm || safeWord,
      partOfSpeech: partOfSpeech || "",
      gender: gender || "",
      senseIndex: normSenseIndex,
      options,
      examples: [fb],
      exampleTranslation: fbTrans,
      usedRefs: [],
      missingRefs: Array.isArray(refKeys) ? refKeys : [],
      notes: typeof noteText === "string" ? noteText : "fallback",
    };
  }

  /**
   * ✅ 2026/01/11：把 LLM content parse + normalize 成統一結構
   * - 目的：retry 時也能重用
   * - 2026/01/14：支援傳入 usage，並把 usage 掛在 _llmUsage
   */
  function parseAndNormalizeLLMContent({ content, noteOnParseFail, usage }) {
    if (!content) {
      return { ok: false, error: "no_content", result: null };
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("[dictionary] JSON parse error in examples:", e);
      return {
        ok: false,
        error: "json_parse_error",
        result: attachLLMUsage(
          buildFallbackResult(noteOnParseFail || "json_parse_error"),
          usage
        ),
      };
    }

    const parsedWithRefs = ensureRefsFields(parsed);

    let examples = [];
    if (Array.isArray(parsedWithRefs.examples)) {
      examples = parsedWithRefs.examples.filter(
        (s) => typeof s === "string" && s.trim().length > 0
      );
    } else if (
      typeof parsedWithRefs.examples === "string" &&
      parsedWithRefs.examples.trim().length > 0
    ) {
      examples = [parsedWithRefs.examples.trim()];
    }

    // 保證只回傳 1 句（多的也砍掉）
    if (examples.length > 1) {
      examples = [examples[0]];
    }

    // 如果 LLM 還是沒給任何句子，用 fallback 補上
    if (examples.length === 0) {
      console.warn(
        "[dictionary] examples empty from LLM, using fallback example"
      );
      examples = [buildFallbackExample()];
    }

    let exampleTranslation =
      typeof parsedWithRefs.exampleTranslation === "string"
        ? parsedWithRefs.exampleTranslation.trim()
        : "";

    if (!exampleTranslation) {
      exampleTranslation = buildFallbackTranslation();
    }

    // ✅ Phase 2-2：後驗檢查（只覆蓋 custom refs 的 used/missing）
    const postChecked = applyPostCheckToRefs({
      normalizedRefs,
      examples,
      llmUsedRefs: parsedWithRefs.usedRefs,
      llmMissingRefs: parsedWithRefs.missingRefs,
    });

    debugRefsRuntime("llm_report", {
      usedRefs: parsedWithRefs.usedRefs,
      missingRefs: parsedWithRefs.missingRefs,
      notes: parsedWithRefs.notes,
    });

    debugRefsRuntime("post_check", {
      usedRefs: postChecked.usedRefs,
      missingRefs: postChecked.missingRefs,
      customKeys: normalizedRefs
        .filter((r) => String(r.kind || "") === "custom")
        .map((r) => r.key),
      example: examples[0] || "",
    });

    const result = {
      word: parsedWithRefs.word || safeWord,
      baseForm: parsedWithRefs.baseForm || baseForm || safeWord,
      partOfSpeech: parsedWithRefs.partOfSpeech || partOfSpeech || "",
      gender: parsedWithRefs.gender || gender || "",
      senseIndex:
        typeof parsedWithRefs.senseIndex === "number"
          ? parsedWithRefs.senseIndex
          : normSenseIndex,
      options: parsedWithRefs.options || options || {},
      examples,
      exampleTranslation,

      // ✅ Phase 2：回傳（custom refs 以後驗為準）
      usedRefs: postChecked.usedRefs,
      missingRefs: postChecked.missingRefs,
      notes: parsedWithRefs.notes,
    };

    return { ok: true, error: "", result: attachLLMUsage(result, usage) };
  }

  /**
   * ✅ 2026/01/11：名詞大小寫後驗檢查 + 單次 retry
   * - 只處理「noun-like single-token refs」的錯誤（例如 Hund → hund）
   * - 不更動 used/missing 的規則（那段維持 Phase 2-2）
   */
  function shouldRetryForNounCapitalization({ sentence, refKeys }) {
    const check = validateNounCapitalizationForRefs({ sentence, refKeys });
    return check;
  }

  try {
    // =========================
    // 1) First attempt
    // =========================
    const response = await callLLMForExamples({
      systemPrompt: systemPromptForExamples,
      userPrompt: userPromptForExamples,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    const usage1 = pickLLMUsage(response);

    if (process.env.DEBUG_LLM_DICT === "1") {
      console.log("[dictionary] Raw LLM Result =", content);
      if (usage1) console.log("[dictionary] LLM usage =", usage1);
    }

    // parse & normalize
    const firstParsed = parseAndNormalizeLLMContent({
      content,
      noteOnParseFail: "json_parse_error",
      usage: usage1,
    });

    if (!firstParsed.ok && firstParsed.result) {
      // json parse fail or fallback already built
      logFinalLLMUsage(usage1);
      return firstParsed.result;
    }

    if (!firstParsed.ok) {
      logFinalLLMUsage(usage1);
      return attachLLMUsage(
        buildFallbackResult(firstParsed.error || "no_content"),
        usage1
      );
    }

    const firstResult = firstParsed.result;

    // =========================
    // 2) Post quality check: noun capitalization for noun-like refs
    // =========================
    const firstSentence =
      Array.isArray(firstResult?.examples) && firstResult.examples.length > 0
        ? String(firstResult.examples[0] || "")
        : "";

    const retryDecision = shouldRetryForNounCapitalization({
      sentence: firstSentence,
      refKeys,
    });

    debugRefsRuntime("noun_caps_check", {
      ok: retryDecision.ok,
      nounRefs: retryDecision.nounRefs,
      violations: retryDecision.violations,
      sentence: firstSentence,
    });

    // 若沒有 violations，直接回傳
    if (retryDecision.ok) {
      logFinalLLMUsage(usage1);
      return firstResult;
    }

    // =========================
    // 3) Retry once with stricter instruction (lower temperature)
    // =========================
    const retryUserPrompt = buildRetryUserPrompt({
      basePrompt: userPromptForExamples,
      violations: retryDecision.violations,
      nounRefs: retryDecision.nounRefs,
    });

    const retryResp = await callLLMForExamples({
      systemPrompt: systemPromptForExamples,
      userPrompt: retryUserPrompt,
      temperature: 0.2, // tighter adherence
    });

    const retryContent = retryResp.choices[0]?.message?.content;
    const usage2 = pickLLMUsage(retryResp);

    if (process.env.DEBUG_LLM_DICT === "1") {
      console.log("[dictionary] Raw LLM Retry Result =", retryContent);
      if (usage2) console.log("[dictionary] LLM retry usage =", usage2);
    }

    const retryParsed = parseAndNormalizeLLMContent({
      content: retryContent,
      noteOnParseFail: "retry_json_parse_error",
      usage: usage2,
    });

    if (!retryParsed.ok && retryParsed.result) {
      // retry parse fail -> fallback already built
      logFinalLLMUsage(usage2);
      return retryParsed.result;
    }

    if (!retryParsed.ok) {
      // retry got no content -> fallback
      logFinalLLMUsage(usage2);
      return attachLLMUsage(buildFallbackResult("retry_no_content"), usage2);
    }

    const retryResult = retryParsed.result;

    // 最後再檢查一次；若還不 ok，仍回傳 retryResult（不再重試，避免 loop）
    const retrySentence =
      Array.isArray(retryResult?.examples) && retryResult.examples.length > 0
        ? String(retryResult.examples[0] || "")
        : "";

    const retryDecision2 = shouldRetryForNounCapitalization({
      sentence: retrySentence,
      refKeys,
    });

    debugRefsRuntime("noun_caps_check_retry", {
      ok: retryDecision2.ok,
      nounRefs: retryDecision2.nounRefs,
      violations: retryDecision2.violations,
      sentence: retrySentence,
    });

    // 在 notes 留一點線索（不影響 UI 顯示邏輯；前端可選擇忽略 notes）
    if (!retryDecision2.ok) {
      // 不覆蓋原 notes，只在後面追加（避免破壞既有含義）
      const prevNotes =
        typeof retryResult.notes === "string" ? retryResult.notes : "";
      const add =
        "noun_caps_retry_failed: model still violates noun capitalization for some refs";
      retryResult.notes = prevNotes ? `${prevNotes} | ${add}` : add;
    } else {
      const prevNotes =
        typeof retryResult.notes === "string" ? retryResult.notes : "";
      const add = "noun_caps_retry_ok";
      retryResult.notes = prevNotes ? `${prevNotes} | ${add}` : add;
    }

    logFinalLLMUsage(usage2);
    return retryResult;
  } catch (err) {
    console.error("[dictionary] Groq example error:", err.message);
    return buildFallbackResult("groq_error");
  }
}

module.exports = { generateExamples, getInitStatus };

// backend/src/clients/dictionaryExamples.js
