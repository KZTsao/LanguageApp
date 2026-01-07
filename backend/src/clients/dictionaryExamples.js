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
 */

const client = require("./groqClient");
const { mapExplainLang } = require("./dictionaryUtils");

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
  const keptUsed = llmUsed.filter((k) => !customKeySet.has(String(k).toLowerCase()));
  const keptMissing = llmMissing.filter(
    (k) => !customKeySet.has(String(k).toLowerCase())
  );

  // 再合併後驗結果
  const mergedUsed = [...keptUsed, ...customUsed];
  // missing 也要避免把已 used 的 custom 又列進 missing
  const customUsedSet = new Set(customUsed.map((k) => k.toLowerCase()));
  const mergedMissing = [
    ...keptMissing,
    ...customMissing.filter((k) => !customUsedSet.has(String(k).toLowerCase())),
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
 */
async function generateExamples(params = {}) {
  const {
    word,
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

  const safeWord = String(word || baseForm || "").trim();
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
  "baseForm": "base form if provided or inferred, otherwise repeat the word",
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
- Grundform (baseForm): "${baseForm || ""}"
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
- Am Ende: Gib NUR das JSON im beschriebenen Format zurück (inkl. usedRefs/missingRefs).
`;

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

  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.7, // 提高一點隨機性，讓每次句子差異更明顯
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPromptForExamples },
        { role: "user", content: userPromptForExamples },
      ],
    });

    const content = response.choices[0]?.message?.content;

    if (process.env.DEBUG_LLM_DICT === "1") {
      console.log("[dictionary] Raw LLM Result =", content);
    }

    if (!content) {
      return buildFallbackResult("no_content");
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("[dictionary] JSON parse error in examples:", e);
      return buildFallbackResult("json_parse_error");
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

    return {
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
  } catch (err) {
    console.error("[dictionary] Groq example error:", err.message);
    return buildFallbackResult("groq_error");
  }
}

module.exports = { generateExamples, getInitStatus };

// backend/src/clients/dictionaryExamples.js
