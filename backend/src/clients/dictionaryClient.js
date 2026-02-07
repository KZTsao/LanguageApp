// backend/src/clients/dictionaryClient.js

/**
 * 文件說明
 * - 用途：封裝字典/例句/對話相關的 client 功能，供 routes/services 呼叫
 * - 對外輸出：
 *   1) lookupWord()：單字查詢（由 ./dictionaryLookup 提供）
 *   2) generateExamples()：產生例句（由 ./dictionaryExamples 提供）
 *   3) generateConversation()：連續對話產生器（本檔案實作）
 *   4) getInitStatus()：回傳此模組的初始化狀態（Production 排障用）
 *
 * - 注意：
 *   - 本模組不會輸出任何敏感金鑰內容（只回報「是否存在」與必要的設定值）
 *   - 產生對話流程：
 *     STEP 1：請 Groq 產生 4–6 句德文對話（每行一句，不要求 JSON）
 *     STEP 2：再請 Groq 逐行產生對應母語翻譯（每行一句）
 */

const { lookupWord: lookupWordLegacy } = require("./dictionaryLookup");
const { generateExamples } = require("./dictionaryExamples");
const groqClient = require("./groqClient");
const { logLLMUsage } = require("../utils/usageLogger");


// =============================
// ✅ 主線任務：導入權威辭典（Authority Dictionary）— Wiktionary (de)
// - 原則：不刪既有 lookup 邏輯；僅「旁掛補欄位」
// - 行為：
//   1) 先走既有 lookupWordLegacy（DB/原本流程）
//   2) 若缺少核心欄位（IPA / definitions / synonyms / antonyms），再查 Wiktionary 補上
//   3) 只補「缺的欄位」，不覆蓋既有內容
//
// 可用環境變數：
// - DICT_AUTHORITY_ENABLED=0  → 關閉（預設開啟）
// - DICT_AUTHORITY_PROVIDER=wiktionary → 目前只支援 wiktionary（預設）
// - DICT_AUTHORITY_TTL_MS=21600000     → cache TTL（預設 6h）
// =============================

const https = require("https");

const __DICT_AUTHORITY_ENABLED =
  String(process.env.DICT_AUTHORITY_ENABLED || "1").trim() !== "0";
const __DICT_AUTHORITY_PROVIDER = String(
  process.env.DICT_AUTHORITY_PROVIDER || "wiktionary"
).trim();
const __DICT_AUTHORITY_TTL_MS = Math.max(
  30 * 1000,
  Number(process.env.DICT_AUTHORITY_TTL_MS || 6 * 60 * 60 * 1000)
);

const __authorityCache = new Map(); // key -> { at, value }

function __cacheGet(key) {
  const hit = __authorityCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > __DICT_AUTHORITY_TTL_MS) {
    __authorityCache.delete(key);
    return null;
  }
  return hit.value;
}

function __cacheSet(key, value) {
  __authorityCache.set(key, { at: Date.now(), value });
  return value;
}

function __httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function __stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function __uniqLower(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const w = String(x || "").trim();
    if (!w) continue;
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

function __sliceGermanSection(html) {
  const s = String(html || "");
  const idx = s.search(/mw-headline"\s+id="Deutsch"/);
  if (idx < 0) return null;
  const tail = s.slice(idx);

  const reNext = /mw-headline"\s+id="([^"]+)"/g;
  let first = true;
  let nextPos = -1;
  let mm;
  while ((mm = reNext.exec(tail)) !== null) {
    const id = mm[1];
    if (first) {
      first = false;
      continue;
    }
    if (id && id !== "Deutsch") {
      nextPos = mm.index;
      break;
    }
  }
  if (nextPos > 0) return tail.slice(0, nextPos);
  return tail;
}

function __detectPos(germanHtml) {
  const s = String(germanHtml || "");
  const posList = [
    "Nomen",
    "Substantiv",
    "Verb",
    "Adjektiv",
    "Adverb",
    "Pronomen",
    "Präposition",
    "Konjunktion",
    "Interjektion",
    "Artikel",
    "Numerale",
    "Partikel",
  ];
  for (const p of posList) {
    const re = new RegExp(
      `mw-headline"\\s+id="${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`
    );
    if (re.test(s)) {
      if (p === "Substantiv") return "Nomen";
      return p;
    }
  }
  return null;
}

function __extractIpa(germanHtml) {
  const s = String(germanHtml || "");
  const re = /class="IPA"[^>]*>([^<]+)</g;
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const raw = __stripTags(m[1]);
    if (!raw) continue;
    out.push(raw);
  }
  const uniq = __uniqLower(out);
  return uniq.length > 0 ? `/${uniq[0].replace(/^\/+|\/+$/g, "")}/` : null;
}

function __extractDefinitions(germanHtml, max = 8) {
  const s = String(germanHtml || "");
  const m = s.match(/<ol[^>]*>[\s\S]*?<\/ol>/i);
  if (!m) return [];
  const ol = m[0];
  const reLi = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const defs = [];
  let mm;
  while ((mm = reLi.exec(ol)) !== null) {
    const txt = __stripTags(mm[1]);
    if (!txt) continue;
    const clean = txt.replace(/\[\d+\]/g, "").trim();
    if (!clean) continue;
    defs.push(clean);
    if (defs.length >= max) break;
  }
  return defs;
}

function __extractWordListBySection(germanHtml, sectionIdCandidates, max = 12) {
  const s = String(germanHtml || "");
  for (const id of sectionIdCandidates || []) {
    const idx = s.search(
      new RegExp(`mw-headline"\\s+id="${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`)
    );
    if (idx < 0) continue;
    const tail = s.slice(idx);
    const mUl = tail.match(/<ul[^>]*>[\s\S]*?<\/ul>/i);
    if (!mUl) continue;
    const ul = mUl[0];
    const reLi = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    const out = [];
    let mm;
    while ((mm = reLi.exec(ul)) !== null) {
      const txt = __stripTags(mm[1]);
      if (!txt) continue;
      const first = txt.split(/[,;，；]/)[0].trim();
      if (!first) continue;
      if (first.length > 40) continue;
      out.push(first);
      if (out.length >= max) break;
    }
    return __uniqLower(out);
  }
  return [];
}

async function __lookupWiktionaryAuthority(lemma) {
  const title = String(lemma || "").trim();
  if (!title) return null;

  const cacheKey = `wiktionary:de:${title.toLowerCase()}`;
  const cached = __cacheGet(cacheKey);
  if (cached) return cached;

  const api = new URL("https://de.wiktionary.org/w/api.php");
  api.searchParams.set("action", "parse");
  api.searchParams.set("page", title);
  api.searchParams.set("prop", "text");
  api.searchParams.set("format", "json");
  api.searchParams.set("formatversion", "2");
  api.searchParams.set("redirects", "1");

  let json;
  try {
    json = await __httpGetJson(api.toString());
  } catch (e) {
    return __cacheSet(cacheKey, null);
  }

  const html = json && json.parse && json.parse.text;
  const pageTitle =
    json && json.parse && json.parse.title ? String(json.parse.title) : title;

  if (!html) return __cacheSet(cacheKey, null);

  const germanSection = __sliceGermanSection(html);
  if (!germanSection) return __cacheSet(cacheKey, null);

  const partOfSpeech = __detectPos(germanSection) || null;
  const ipa = __extractIpa(germanSection);
  const defs = __extractDefinitions(germanSection, 8);
  const synonyms = __extractWordListBySection(
    germanSection,
    ["Synonyme", "Sinnverwandte_Wörter", "Sinnverwandte_Wörter_und_Synonyme"],
    12
  );
  const antonyms = __extractWordListBySection(
    germanSection,
    ["Gegenwörter", "Antonyme"],
    12
  );

  const out = {
    _authoritySource: "wiktionary",
    word: pageTitle,
    baseForm: pageTitle,
    lemma: pageTitle,
    partOfSpeech,
    canonicalPos: partOfSpeech,
    ipa: ipa || null,
    definition_de: defs.length ? defs : null,
    // 先暫存德文：讓 deriveSensesIfMissing 可以先跑起來（之後再由 LLM 翻成 zh）
    definition_de_translation: defs.length ? defs : null,
    recommendations: {
      synonyms,
      antonyms,
    },
  };

  return __cacheSet(cacheKey, out);
}

function __mergeAuthorityIntoBase(baseEntry, authEntry) {
  if (!baseEntry && !authEntry) return null;
  if (!baseEntry) return authEntry;
  if (!authEntry) return baseEntry;

  const merged = { ...baseEntry };

  // 只補缺的欄位（不覆蓋）
  if (!merged.ipa && authEntry.ipa) merged.ipa = authEntry.ipa;

  if (!merged.definition_de && authEntry.definition_de) {
    merged.definition_de = authEntry.definition_de;
  }
  if (!merged.definition_de_translation && authEntry.definition_de_translation) {
    merged.definition_de_translation = authEntry.definition_de_translation;
  }

  // pos / canonicalPos 只在缺時補
  if (!merged.partOfSpeech && authEntry.partOfSpeech) merged.partOfSpeech = authEntry.partOfSpeech;
  if (!merged.canonicalPos && authEntry.canonicalPos) merged.canonicalPos = authEntry.canonicalPos;

  // recommendations：只補缺項
  const baseRec = merged.recommendations && typeof merged.recommendations === "object"
    ? merged.recommendations
    : {};
  const authRec = authEntry.recommendations && typeof authEntry.recommendations === "object"
    ? authEntry.recommendations
    : {};

  const nextRec = { ...baseRec };
  if ((!Array.isArray(nextRec.synonyms) || nextRec.synonyms.length === 0) && Array.isArray(authRec.synonyms) && authRec.synonyms.length) {
    nextRec.synonyms = authRec.synonyms;
  }
  if ((!Array.isArray(nextRec.antonyms) || nextRec.antonyms.length === 0) && Array.isArray(authRec.antonyms) && authRec.antonyms.length) {
    nextRec.antonyms = authRec.antonyms;
  }
  merged.recommendations = nextRec;

  // 標記來源（可用於 debug）
  if (!merged._authoritySource && authEntry._authoritySource) {
    merged._authoritySource = authEntry._authoritySource;
  }

  return merged;
}

/**
 * ✅ 對外 lookupWord（主線：導入權威辭典）
 * - 不刪既有邏輯：先跑 legacy，再用 authority「補欄位」
 * - signature 完全相容原本 lookupWord(text, explainLang, options)
 */
async function lookupWord(text, explainLang, options) {
  // 先走原本流程（避免破壞既有 DB/LLM 行為）
  const base = await lookupWordLegacy(text, explainLang, options);

  // 再旁掛權威辭典（只補缺欄位）
  if (!__DICT_AUTHORITY_ENABLED) return base;
  if (__DICT_AUTHORITY_PROVIDER !== "wiktionary") return base;

  const needAuthority =
    !base ||
    (!base.ipa &&
      !base.definition_de &&
      !base.definition_de_translation &&
      !(base.recommendations && Array.isArray(base.recommendations.synonyms) && base.recommendations.synonyms.length) &&
      !(base.recommendations && Array.isArray(base.recommendations.antonyms) && base.recommendations.antonyms.length));

  // 若 base 已足夠，就不查 authority
  if (!needAuthority) return base;

  const auth = await __lookupWiktionaryAuthority(text);
  return __mergeAuthorityIntoBase(base, auth);
}


// =============================
// 功能初始化狀態（Production 排障用）
// =============================

/**
 * 中文功能說明：取得 Groq 對話模型設定（有 fallback）
 */
function resolveConversationModel() {
  return (
    process.env.GROQ_CONVERSATION_MODEL ||
    process.env.GROQ_DEFAULT_MODEL ||
    "llama-3.1-8b-instant"
  );
}

/**
 * 中文功能說明：建立此模組的初始化狀態快照（不包含敏感資訊）
 */
function buildInitState() {
  const model = resolveConversationModel();

  return {
    module: "backend/src/clients/dictionaryClient.js",
    provider: "groq",
    model,
    env: {
      hasGroqApiKey: Boolean(process.env.GROQ_API_KEY),
      hasGroqDefaultModel: Boolean(process.env.GROQ_DEFAULT_MODEL),
      hasGroqConversationModel: Boolean(process.env.GROQ_CONVERSATION_MODEL),
    },
    runtime: {
      nodeEnv: process.env.NODE_ENV || "",
      hasGroqClient:
        Boolean(groqClient) &&
        Boolean(groqClient.chat) &&
        Boolean(groqClient.chat.completions) &&
        typeof groqClient.chat.completions.create === "function",
      hasUsageLogger: typeof logLLMUsage === "function",
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
  // 每次呼叫回傳「最新時間戳」，其餘以初始化快照為主
  return { ...__initState, timestamp: new Date().toISOString() };
}

// 若你想在 production 立即看到狀態，可用環境變數開啟（避免平常噪音）
if (process.env.DEBUG_INIT_STATUS === "1") {
  console.log("[dictionaryClient] initStatus =", getInitStatus());
}

// =============================
// 小工具（模組化）
// =============================

/**
 * 中文功能說明：安全 trim 字串，並提供 fallback
 */
function normalizeText(input, fallback) {
  return typeof input === "string" && input.trim() ? input.trim() : fallback;
}

/**
 * 中文功能說明：把文字拆成多行（去除空行）
 */
function splitLines(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 中文功能說明：清掉模型可能回傳的行首編號/符號（例如 1. / 1) / - / •）
 */
function stripLeadingNumber(line) {
  return String(line)
    .replace(/^[-•*]?\s*\d+[\.\):]\s*/, "")
    .replace(/^[-•*]\s+/, "")
    .trim();
}

/**
 * 中文功能說明：依 UI 語言取得 STEP 1（德文對話）的 system prompt
 */
function getDialogSystem(uiLang) {
  const dialogSystemByLang = {
    "zh-TW":
      "你是一位幫助德文學習者的助手。使用 A2 程度、自然口語的德文，根據給定句子，產生 4 到 6 句『連續對話』。請注意：\n" +
      "1. 每一句對話請獨立一行。\n" +
      "2. 可以有說話者切換，但不要標 Speaker 名字。\n" +
      "3. 不要翻譯，不要加任何說明文字，不要加 JSON，只輸出這幾行德文對話。",
    "zh-CN":
      "你是一位帮助德语学习者的助手。使用 A2 程度、自然口语的德语，根据给定句子，产生 4 到 6 句连续对话。要求：\n" +
      "1. 每句话单独一行。\n" +
      "2. 不要添加说话者名字。\n" +
      "3. 不要翻译、不要任何解释、不要 JSON，只输出这些德语句子。",
    en:
      "You help learners practice German. Using around A2-level natural German, create a short conversation of 4–6 turns based on the given sentence.\n" +
      "Rules:\n" +
      "1. Each turn must be on its own line.\n" +
      "2. No speaker names.\n" +
      "3. No translations, no explanations, NO JSON – only the German lines.",
    de:
      "Du hilfst Deutschlernenden (Niveau A2). Erzeuge eine kurze Unterhaltung mit 4–6 Beiträgen auf Grundlage des gegebenen Satzes.\n" +
      "Regeln:\n" +
      "1. Jeder Beitrag steht in einer eigenen Zeile.\n" +
      "2. Keine Sprechernamen.\n" +
      "3. Keine Übersetzungen, keine Erklärungen, KEIN JSON – nur die deutschen Sätze。",
  };

  return dialogSystemByLang[uiLang] || dialogSystemByLang.en;
}

/**
 * 中文功能說明：依 UI 語言取得 STEP 2（翻譯）的 system prompt
 */
function getTranslationSystem(uiLang) {
  const translationSystemByLang = {
    "zh-TW":
      "你會收到多行德文對話。請逐行翻譯成『繁體中文』，輸出格式規則：\n" +
      "1. 每行只放對應的一句翻譯。\n" +
      "2. 不要編號，不要引號。\n" +
      "3. 不要任何說明文字，只輸出翻譯的那些行。",
    "zh-CN":
      "你会收到多行德语对话。请逐行翻译成『简体中文』，输出规则：\n" +
      "1. 每行只放对应一句翻译。\n" +
      "2. 不要编号，不要引号。\n" +
      "3. 不要任何解释，只输出翻译的行。",
    en:
      "You will receive several lines of German dialogue. Translate line by line into English.\n" +
      "Output rules:\n" +
      "1. Each line contains only the translation of the corresponding German line.\n" +
      "2. No numbers, no quotes.\n" +
      "3. No explanations – only the translated lines.",
    de:
      "Du erhältst mehrere Zeilen eines deutschen Dialogs. Gib für jede Zeile eine einfache deutsche Umschreibung oder Erklärung.\n" +
      "Ausgaberichtlinien:\n" +
      "1. Eine Umschreibung pro Zeile, in derselben Reihenfolge.\n" +
      "2. Keine Nummerierung, keine Anführungszeichen.\n" +
      "3. Keine zusätzlichen Erklärungen – nur diese Zeilen。",
  };

  return translationSystemByLang[uiLang] || translationSystemByLang.en;
}

/**
 * 中文功能說明：呼叫 Groq chat completion（集中管理參數，方便排障）
 */
async function callGroqChat({
  model,
  temperature,
  maxTokens,
  systemPrompt,
  userPrompt,
  // optional: [{ role: 'user'|'assistant', content: string }, ...]
  historyMessages,
}) {
  const safeHistory = Array.isArray(historyMessages)
    ? historyMessages
        .filter(Boolean)
        .map((m) => {
          const role = String(m?.role || "").trim();
          const content = String(m?.content || "").trim();
          if (!content) return null;
          if (role !== "user" && role !== "assistant") return null;
          return { role, content };
        })
        .filter(Boolean)
        .slice(-3)
    : [];

  return groqClient.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user", content: userPrompt },
    ],
  });
}

/**
 * 中文功能說明：安全寫入 tokens 使用量（若 completion.usage 存在）
 */
function safeLogUsage({
  completion,
  endpoint,
  model,
  userId,
  email,
  requestId,
}) {
  if (!completion || !completion.usage) return;

  logLLMUsage({
    endpoint,
    model,
    provider: "groq",
    usage: completion.usage,
    kind: "llm",
    userId,
    email,
    requestId,
  });
}

/**
 * 中文功能說明：把模型回傳整理成「最多 6 句」且看起來像句子的德文對話行
 */
function normalizeGermanTurns(raw, baseSentence) {
  const seed = normalizeText(baseSentence, "");
  let lines = splitLines(raw).map(stripLeadingNumber);

  // 過濾掉超奇怪的行（只剩一兩個字母之類）
  lines = lines.filter((line) => line.split(/\s+/).length >= 3);

  // 去掉空行與重複（保留原順序）
  const seen = new Set();
  lines = lines
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .filter((s) => {
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });

  // ✅ B：保證第一句 = 例句（生成當下就固定，不靠前端補救）
  if (seed) {
    lines = lines.filter((s) => s !== seed);
    lines.unshift(seed);
  }

  // 兜底：模型回傳太爛或空的情況
  const fallbackTail = [
    "Echt? Erzähl mir ein bisschen mehr dazu.",
    "Klingt interessant, so etwas habe ich noch nicht erlebt.",
    "Ja, das kenne ich gut.",
    "Lass uns später noch weiter darüber sprechen.",
  ];

  if (lines.length === 0) {
    lines = seed ? [seed, ...fallbackTail] : [...fallbackTail];
  }

  // ✅ 保證 4–6 句（第一句已固定為例句）
  while (lines.length < 4) {
    const next = fallbackTail[(lines.length - 1) % fallbackTail.length];
    // 避免再次重複
    if (!lines.includes(next)) lines.push(next);
    else lines.push("Okay, verstanden.");
  }

  if (lines.length > 6) lines = lines.slice(0, 6);

  return lines;
}

/**
 * 中文功能說明：把翻譯行數對齊德文行數（多就裁、少就補空字串）
 */
function alignTranslations(translations, targetLen) {
  let lines = Array.isArray(translations) ? translations : [];
  if (lines.length > targetLen) lines = lines.slice(0, targetLen);
  while (lines.length < targetLen) lines.push("");
  return lines;
}

// =============================
// 主要功能：連續對話產生器
// =============================

/**
 * 中文功能說明：產生 4–6 句德文對話 + 對應翻譯
 * - 輸入：
 *   - sentence：string（基礎句）
 *   - explainLang：UI 語言（zh-TW / zh-CN / en / de）
 *   - userId/email/requestId：可選，用於 tokens log 的切分（不影響既有呼叫）
 * - 輸出：Array<{ de: string, translation: string }>
 */
async function generateConversation({
  sentence,
  explainLang,
  // optional: [{ role: 'user'|'assistant', content: string }, ...]
  history,

  // ✅ 相容擴充：若 route 有傳就能做 user 切分；沒傳也不影響
  userId = "",
  email = "",
  requestId = "",
} = {}) {
  console.log("\n[conversation] generateConversation START", {
    sentence,
    explainLang,
    historyLen: Array.isArray(history) ? history.length : 0,
  });

  const baseSentence = normalizeText(
    sentence,
    "Lass uns ein kurzes Beispielgespräch führen."
  );

  const uiLang = explainLang || "zh-TW";
  const model = resolveConversationModel();

  // ========= STEP 1：產生德文對話 =========
  const dialogSystem = getDialogSystem(uiLang);
  let germanTurns = [];

  try {
    const completion = await callGroqChat({
      model,
      temperature: 0.6,
      maxTokens: 400,
      systemPrompt: dialogSystem,
      historyMessages: history,
      userPrompt:
        "Ausgangssatz:\n" +
        baseSentence +
        "\n\nBitte gib NUR die 4–6 deutschen Sätze aus.",
    });

    // ✅ 真實 tokens：STEP 1（德文對話）
    safeLogUsage({
      completion,
      endpoint: "/api/conversation/generate",
      model,
      userId,
      email,
      requestId,
    });

    const raw = completion?.choices?.[0]?.message?.content || "";
    console.log("[conversation] RAW german response =", raw);

    germanTurns = normalizeGermanTurns(raw, baseSentence);
  } catch (err) {
    console.error("[conversation] Groq error on german dialog:", err);
    germanTurns = [
      baseSentence,
      "Echt? Erzähl mir mehr.",
      "Ja, das kenne ich gut.",
      "Lass uns später noch darüber sprechen.",
    ];
  }

  console.log("[conversation] germanTurns =", germanTurns);

  // 先建立預設輸出（避免翻譯失敗時沒有結構）
  let finalTurns = germanTurns.map((de) => ({ de, translation: "" }));

  // ========= STEP 2：產生對應翻譯 =========
  const translationSystem = getTranslationSystem(uiLang);
  let translations = [];

  try {
    const transCompletion = await callGroqChat({
      model,
      temperature: 0.3,
      maxTokens: 400,
      systemPrompt: translationSystem,
      userPrompt:
        "Bitte übersetze jede der folgenden Zeilen einzeln und gib NUR die Übersetzungen Zeile für Zeile aus:\n\n" +
        germanTurns.join("\n"),
    });

    // ✅ 真實 tokens：STEP 2（翻譯）
    safeLogUsage({
      completion: transCompletion,
      endpoint: "/api/conversation/translate",
      model,
      userId,
      email,
      requestId,
    });

    const rawTrans = transCompletion?.choices?.[0]?.message?.content || "";
    console.log("[conversation] RAW translation response =", rawTrans);

    translations = alignTranslations(
      splitLines(rawTrans).map(stripLeadingNumber),
      germanTurns.length
    );
  } catch (err) {
    console.error("[conversation] Groq error on translation:", err);
    translations = [];
  }

  console.log("[conversation] translations =", translations);

  if (translations.length === germanTurns.length) {
    finalTurns = germanTurns.map((de, idx) => ({
      de,
      translation: translations[idx] || "",
    }));
  } else {
    console.log(
      "[conversation] translation length mismatch, keep translation empty"
    );
  }

  console.log("[conversation] finalTurns =", finalTurns);
  return finalTurns;
}


/**
 * ✅ Task 4 — 匯入到學習本：LLM 產生候選項目（≤5）
 * - 不做 analyze、不回傳完整字典結構
 * - 只需要：type + importKey + display.de(+hint 可選)
 */
async function generateImportCandidates({
  level = "A2",
  type = "word",
  scenario = "",
  uiLang = "en",
  excludeKeys = [],
  userId = "",
  email = "",
  requestId = "",
} = {}) {
  const safeLevel = String(level || "A2").trim();
  const safeType = String(type || "word").trim();
  const safeScenario = String(scenario || "").trim();
  const safeUiLang = String(uiLang || "en").trim();
  const ex0 = Array.isArray(excludeKeys) ? excludeKeys.filter(Boolean).slice(0, 300) : [];

  // ============================================================
  // Task4 (UX 強化)：推薦字更像「推薦」
  // 1) 強制只產生 safeType（word/phrase/grammar 擇一）
  // 2) 一律只輸出德文：display 只提供 de（不回傳 hint，避免混入英文/中文）
  // 3) 若 LLM 混入其他 type：丟棄並補滿（最多重試一次）
  // 注意：本任務仍只回傳候選，不做 analyze / 不寫 dict
  // ============================================================

  const normalizeKey = (s) => String(s || "").trim();
  const normalizeType = (t) => {
    const v = String(t || "").trim().toLowerCase();
    if (v === "vocab") return "word";
    if (v === "words") return "word";
    if (v === "phrases") return "phrase";
    if (v === "grammars") return "grammar";
    return v;
  };


  const buildPrompts = ({ excludeKeysForPrompt, needCount }) => {
    const exForPrompt = Array.isArray(excludeKeysForPrompt)
      ? excludeKeysForPrompt.filter(Boolean).slice(0, 500)
      : [];

    const system = [
      "You are a helpful assistant that generates German learning candidates.",
      "Return STRICT JSON only. No markdown, no explanation.",
      "The JSON must be an array of objects.",
      "Each object: { candidateId: string, type: 'word'|'phrase'|'grammar', importKey: string, display: { de: string } }",
      "HARD RULES:",
      `- Output ONLY type = '${safeType}' (do not output other types).`,
      "- German only: importKey and display.de MUST be German text (no English translations, no Chinese).",
      "- Do NOT include any translation text in any language; only German terms/phrases/grammar labels.",
      `- Output exactly ${needCount} items (or as many as possible up to ${needCount} if constrained).`,
      "- candidateId must be unique within the array.",
      "- importKey must be unique within the array.",
      "- For type=word: importKey should be ONE German word (no spaces).",
      "- For type=phrase: importKey should be a short everyday German phrase.",
      "- For type=grammar: importKey should be a short grammar label (e.g., 'Präsens').",
      "- Do not output any candidate whose importKey is in excludeKeys (case-insensitive).",
    ].join("\n");

    const user = [
      `level: ${safeLevel}`,
      `type: ${safeType}`,
      `scenario: ${safeScenario}`,
      `uiLang: ${safeUiLang}`,
      `excludeKeys: ${JSON.stringify(exForPrompt)}`,
      "",
      "Generate candidates that fit the scenario and level.",
    ].join("\n");

    return { system, user, exForPrompt };
  };

  const parseJsonArray = (raw) => {
    if (!raw || typeof raw !== "string") return [];
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      const m = raw.match(/\[[\s\S]*\]/);
      if (m && m[0]) {
        try {
          const p2 = JSON.parse(m[0]);
          return Array.isArray(p2) ? p2 : [];
        } catch {}
      }
      return [];
    }
  };

  const normalizeCandidates = ({ arr, exSet, needCount }) => {
    const out = [];
    const seenKey = new Set();
    const wantType = normalizeType(safeType);

    const __containsCJK = (s) => /[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(String(s || ""));
    const __isGermanOnly = (s) => {
      const v = String(s || "").trim();
      if (!v) return false;
      if (__containsCJK(v)) return false;
      // allow Latin letters + German umlauts/ß + common punctuation/spaces
      return /^[A-Za-zÄÖÜäöüß0-9\s\-’'!.?,;:()\/]+$/.test(v);
    };

    for (const it of arr || []) {
      if (!it) continue;
      const k = normalizeKey(it.importKey || it.key || it.display?.de || "");
      if (!k) continue;
      const kLower = k.toLowerCase();
      if (exSet.has(kLower)) continue;
      if (seenKey.has(kLower)) continue;

      const tRaw = it.type || wantType;
      const t = normalizeType(tRaw);
      if (t !== wantType) continue;

      // type=word 額外保護：避免出現空白（多詞片語）
      if (wantType === "word" && /\s/.test(k)) continue;

      const cid = normalizeKey(it.candidateId || it.id || `cand_${Date.now()}_${Math.random()}`);
      const de = normalizeKey(it.display?.de || k);

      // German-only guard: drop candidates that contain CJK or disallowed characters
      if (!__isGermanOnly(k) || !__isGermanOnly(de)) continue;

      out.push({
        candidateId: cid,
        type: wantType,
        importKey: k,
        display: { de },
      });
      seenKey.add(kLower);
      if (out.length >= needCount) break;
    }
    return out;
  };

  const callOnce = async ({ excludeKeysForPrompt, needCount }) => {
    const { system, user, exForPrompt } = buildPrompts({ excludeKeysForPrompt, needCount });

    const model = resolveConversationModel();
    const completion = await callGroqChat({
      model,
      temperature: 0.7,
      maxTokens: 800,
      systemPrompt: system,
      userPrompt: user,
    });

    safeLogUsage({
      completion,
      endpoint: "importGenerate",
      model,
      userId,
      email,
      requestId,
    });

    const raw = completion?.choices?.[0]?.message?.content || "";
    const arr = parseJsonArray(raw);

    const exSet = new Set(exForPrompt.map((x) => String(x || "").toLowerCase()));
    const out = normalizeCandidates({ arr, exSet, needCount });
    return { out, raw };
  };

  // 第一次生成：用前端/後端組好的 excludeKeys
  const ex1 = ex0;
  const first = await callOnce({ excludeKeysForPrompt: ex1, needCount: 5 });
  let out = Array.isArray(first.out) ? first.out : [];

  // 補滿：若 LLM 混入其他 type 或重複，嘗試再要一次「剩餘數量」
  if (out.length < 5) {
    const usedKeys = out.map((x) => x.importKey).filter(Boolean);
    const ex2 = [...ex1, ...usedKeys];
    const need = Math.max(0, 5 - out.length);
    if (need > 0) {
      const second = await callOnce({ excludeKeysForPrompt: ex2, needCount: need });
      const more = Array.isArray(second.out) ? second.out : [];
      const existing = new Set(out.map((x) => String(x.importKey || "").toLowerCase()));
      for (const it of more) {
        const k = String(it.importKey || "").toLowerCase();
        if (!k) continue;
        if (existing.has(k)) continue;
        out.push(it);
        existing.add(k);
        if (out.length >= 5) break;
      }
    }
  }

  // 最終保護：最多 5 筆
  if (out.length > 5) out = out.slice(0, 5);

  // ------------------------------------------------------------
  // Legacy implementation (kept for trace; DO NOT DELETE)
  // - 這段是舊版 prompt/parse，曾因 callGroqChat 參數不合導致不回 JSON
  // - 保留註解避免未來追查困難
  // ------------------------------------------------------------
  /*
  const systemLegacy = [
    "You are a helpful assistant that generates German learning candidates.",
    "Return STRICT JSON only. No markdown, no explanation.",
  ].join("\n");
  */

  return out;
}

module.exports = {
  lookupWord,
  generateExamples,
  generateConversation,
  getInitStatus,
  generateImportCandidates,
};

// backend/src/clients/dictionaryClient.js