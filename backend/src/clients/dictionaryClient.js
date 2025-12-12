// backend/src/clients/dictionaryClient.js

const { lookupWord } = require("./dictionaryLookup");
const { generateExamples } = require("./dictionaryExamples");
const groqClient = require("./groqClient");

/**
 * 連續對話產生器
 * - STEP 1：請 Groq 產生 4–6 句德文對話（每行一句，不要求 JSON）
 * - STEP 2：再請 Groq 產生對應母語翻譯（每行一句）
 * - 前端使用格式：Array<{ de: string, translation: string }>
 */
async function generateConversation({ sentence, explainLang }) {
  console.log("\n[conversation] generateConversation START", {
    sentence,
    explainLang,
  });

  const baseSentence =
    typeof sentence === "string" && sentence.trim()
      ? sentence.trim()
      : "Lass uns ein kurzes Beispielgespräch führen.";

  const uiLang = explainLang || "zh-TW";

  const model =
    process.env.GROQ_CONVERSATION_MODEL ||
    process.env.GROQ_DEFAULT_MODEL ||
    "llama-3.1-8b-instant";

  // ========= 小工具：拆行、清除編號 =========
  const splitLines = (text) =>
    String(text)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  const stripLeadingNumber = (line) =>
    line
      // 去掉前面像「1. 」「1) 」「- 」「• 」這種東西
      .replace(/^[-•*]?\s*\d+[\.\):]\s*/, "")
      .replace(/^[-•*]\s+/, "")
      .trim();

  // ========= STEP 1：產生德文對話 =========
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
      "3. Keine Übersetzungen, keine Erklärungen, KEIN JSON – nur die deutschen Sätze.",
  };

  const dialogSystem = dialogSystemByLang[uiLang] || dialogSystemByLang.en;

  let germanTurns = [];

  try {
    const completion = await groqClient.chat.completions.create({
      model,
      temperature: 0.6,
      max_tokens: 400,
      messages: [
        { role: "system", content: dialogSystem },
        {
          role: "user",
          content:
            "Ausgangssatz:\n" +
            baseSentence +
            "\n\nBitte gib NUR die 4–6 deutschen Sätze aus.",
        },
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content || "";
    console.log("[conversation] RAW german response =", raw);

    let lines = splitLines(raw).map(stripLeadingNumber);

    // 過濾掉超奇怪的行（只剩一兩個字母之類）
    lines = lines.filter((line) => line.split(/\s+/).length >= 3);

    // 最多只保留 6 句，避免太肥
    if (lines.length > 6) lines = lines.slice(0, 6);

    if (lines.length === 0) {
      lines = [
        baseSentence,
        "Echt? Erzähl mir ein bisschen mehr dazu.",
        "Klingt interessant, so etwas habe ich noch nicht erlebt.",
        "Lass uns später noch weiter darüber sprechen.",
      ];
    }

    germanTurns = lines;
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

  let finalTurns = germanTurns.map((de) => ({
    de,
    translation: "",
  }));

  // ========= STEP 2：產生對應翻譯 =========
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
      "3. Keine zusätzlichen Erklärungen – nur diese Zeilen.",
  };

  const translationSystem =
    translationSystemByLang[uiLang] || translationSystemByLang.en;

  let translations = [];

  try {
    const transCompletion = await groqClient.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 400,
      messages: [
        { role: "system", content: translationSystem },
        {
          role: "user",
          content:
            "Bitte übersetze jede der folgenden Zeilen einzeln und gib NUR die Übersetzungen Zeile für Zeile aus:\n\n" +
            germanTurns.join("\n"),
        },
      ],
    });

    const rawTrans = transCompletion?.choices?.[0]?.message?.content || "";
    console.log("[conversation] RAW translation response =", rawTrans);

    let lines = splitLines(rawTrans).map(stripLeadingNumber);

    // 如果行數比德文多，就裁掉；太少就以空字串補齊
    if (lines.length > germanTurns.length) {
      lines = lines.slice(0, germanTurns.length);
    }
    while (lines.length < germanTurns.length) {
      lines.push("");
    }

    translations = lines;
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
};
