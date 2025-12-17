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

const { lookupWord } = require("./dictionaryLookup");
const { generateExamples } = require("./dictionaryExamples");
const groqClient = require("./groqClient");
const { logLLMUsage } = require("../utils/usageLogger");

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
}) {
  return groqClient.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
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
  let lines = splitLines(raw).map(stripLeadingNumber);

  // 過濾掉超奇怪的行（只剩一兩個字母之類）
  lines = lines.filter((line) => line.split(/\s+/).length >= 3);

  // 最多只保留 6 句，避免太肥
  if (lines.length > 6) lines = lines.slice(0, 6);

  // 兜底：模型回傳太爛或空的情況
  if (lines.length === 0) {
    lines = [
      baseSentence,
      "Echt? Erzähl mir ein bisschen mehr dazu.",
      "Klingt interessant, so etwas habe ich noch nicht erlebt.",
      "Lass uns später noch weiter darüber sprechen.",
    ];
  }

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

  // ✅ 相容擴充：若 route 有傳就能做 user 切分；沒傳也不影響
  userId = "",
  email = "",
  requestId = "",
} = {}) {
  console.log("\n[conversation] generateConversation START", {
    sentence,
    explainLang,
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

module.exports = {
  lookupWord,
  generateExamples,
  generateConversation,
  getInitStatus,
};

// backend/src/clients/dictionaryClient.js
