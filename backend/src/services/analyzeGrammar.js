// analyzeGrammar.js (FULL FILE REPLACE)
const groqClient = require("../clients/groqClient");

function mapExplainLang(explainLang) {
  switch (explainLang) {
    case "en":
      return "English";
    case "zh-CN":
      return "Simplified Chinese";
    case "ar":
      return "Arabic";
    case "zh-TW":
    default:
      return "Traditional Chinese";
  }
}

function fallbackGrammar() {
  return {
    isCorrect: true,
    overallComment: "",
    errors: [],
  };
}

async function analyzeGrammar(text, explainLang = "zh-TW") {
  const t = String(text || "").trim();
  if (!t) return fallbackGrammar();

  const targetLangLabel = mapExplainLang(explainLang);

  const prompt = `
你是一位專業的德文老師，請檢查以下句子的德文語法是否正確：
"${t}"

請用 ${targetLangLabel} 語言輸出「解說文字」，但輸出格式必須是 JSON，結構如下（不要多餘文字）：

{
  "isCorrect": true 或 false,
  "overallComment": "",
  "errors": [
    {
      "original": "",
      "suggestion": "",
      "explanation": ""
    }
  ]
}

說明：
- isCorrect: 若句子完全正確，請填 true，errors 可為空陣列。
- errors: 若有錯誤，每個錯誤包含：
  - original: 原本錯誤片段（例如 "ein Hund"）
  - suggestion: 建議改法（例如 "einen Hund"）
  - explanation: 用 ${targetLangLabel} 解釋錯在哪裡（例如「Akkusativ 陽性要用 'einen'」）
`;

  try {
    const response = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallbackGrammar();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return fallbackGrammar();
    }

    return {
      isCorrect: Boolean(parsed.isCorrect),
      overallComment: parsed.overallComment || "",
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    };
  } catch (err) {
    console.error("[grammar] Groq error:", err.message);
    return fallbackGrammar();
  }
}

module.exports = { analyzeGrammar };
