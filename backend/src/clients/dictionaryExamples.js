// backend/src/clients/dictionaryExamples.js

const client = require("./groqClient");
const { mapExplainLang } = require("./dictionaryUtils");

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
  } = params;

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

  "exampleTranslation": "The translation of that single sentence into ${targetLangLabel}."
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

Anforderungen:
- Halte dich so gut wie möglich an die oben genannten grammatischen Optionen.
- Wenn "case" angegeben ist und das Wort ein Nomen ist, setze das Nomen in diesen Kasus.
- Wenn "articleType" und/oder "gender" angegeben sind, wähle passende Artikel (z.B. der/die/das, ein/eine).
- Wenn "possessive" angegeben ist, verwende das entsprechende Possessivpronomen.
- Wenn "tense" und "person"/"personNumber" angegeben sind und das Wort ein Verb ist, konjugiere das Verb entsprechend.
- Wenn "polarity" = "negative", formuliere einen natürlichen negativen Satz.
- Nutze ausschließlich die angegebene Wortbedeutung für senseIndex ${normSenseIndex} und ignoriere alle anderen.
- Gib nur EINEN Satz zurück.
- Gib NUR das JSON im beschriebenen Format zurück.
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
      // 沒有內容也不要回空，直接給 fallback
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
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("[dictionary] JSON parse error in examples:", e);
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
      };
    }

    let examples = [];
    if (Array.isArray(parsed.examples)) {
      examples = parsed.examples.filter(
        (s) => typeof s === "string" && s.trim().length > 0
      );
    } else if (
      typeof parsed.examples === "string" &&
      parsed.examples.trim().length > 0
    ) {
      examples = [parsed.examples.trim()];
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
      typeof parsed.exampleTranslation === "string"
        ? parsed.exampleTranslation.trim()
        : "";

    if (!exampleTranslation) {
      // 沒有翻譯也給 fallback 翻譯（避免前端不知道要顯示什麼）
      exampleTranslation = buildFallbackTranslation();
    }

    return {
      word: parsed.word || safeWord,
      baseForm: parsed.baseForm || baseForm || safeWord,
      partOfSpeech: parsed.partOfSpeech || partOfSpeech || "",
      gender: parsed.gender || gender || "",
      senseIndex:
        typeof parsed.senseIndex === "number"
          ? parsed.senseIndex
          : normSenseIndex,
      options: parsed.options || options || {},
      examples,
      exampleTranslation,
    };
  } catch (err) {
    console.error("[dictionary] Groq example error:", err.message);
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
    };
  }
}

module.exports = { generateExamples };
