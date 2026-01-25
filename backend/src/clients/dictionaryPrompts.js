// backend/src/clients/dictionaryPrompts.js
/**
 * 系統提示：規範查字典時 Groq 的輸出格式與行為
 * - 只允許回傳單一 JSON 物件
 * - definition / definition_de / definition_de_translation 可以是字串或字串陣列
 * - 需同時支援多義（多個義項）
 * - ⭐ 新增名詞類型欄位 "type"（與多國語系無關，純語法分類）
 *
 * 異動紀錄（保留舊紀錄，僅新增）
 * - 2026-01-06：Phase 2：新增「refs 使用規則」段落（SHOULD 自然使用；不可硬塞；未使用需回報 missingRefs 並在 notes 說明）
 *   - 目的：避免例句為了塞 refs 變得不自然，同時讓 missingRefs 具備可觀測性
 *   - 注意：此規則不影響 Phase 1 的「只按 Refresh 才查詢」硬規則（該規則在 examples API route 端控管）
 *
 * - 2026-01-16：✅ Sense 切分強制規則（CRITICAL SENSE-SPLITTING RULES）
 *   - 目的：避免單一義項混合「具體/抽象」或用「或/以及」合併不同語意軸（例如 eng = schmal vs begrenzt）
 *   - 設計：只改 prompt 規格，不改 schema、不改程式流程，讓 LLM 沒有混義的空間
 *
 * 功能初始化狀態（Production 排查）
 * - PROMPT_REFS_RULES.enabled = true（此檔僅提供 prompt 文本，不做 runtime 判斷；此處為規格註記）
 */
const systemPrompt = `
You are a precise German dictionary generator for a language learning app.

Your job:
- Analyze ONE German word (standard Hochdeutsch).
- Return a STRICT JSON object that follows the schema below.
- Do NOT output markdown, comments, or any text outside the JSON.
- If you are unsure about a field, use the empty string "" or an empty array [] where appropriate.
- For very common words, you MUST still provide at least one meaningful sense; do not leave all definitions empty.

Additional rules:
- The field "language" MUST equal the learner's language label (targetLangLabel) from the user prompt (e.g. zh-TW).
- Do NOT set language="de"; the app is learning German so German is implied.
- Prefer the most common everyday senses. Do NOT invent rare/unrelated senses.
- Common polysemy guidance (when confident):
  - "Bank" (Nomen): include Geldinstitut and Sitzmöbel/Bank (bench). Avoid English-like "Ufer" unless you are very sure it is intended.
  - "Schloss" (Nomen): include (1) lock and (2) castle/palace.


JSON schema:

{
  "word": "string, lemma or headword in German",
  "language": "string, learner\'s language label (targetLangLabel), e.g. zh-TW",
  "partOfSpeech": "Nomen | Verb | Adjektiv | Adverb | Pronomen | Präposition | Konjunktion | Interjektion | unknown",

  "type": "common_noun | brand | product_name | proper_person | proper_place | organization | ''",

  "gender": "der | die | das | ''",
  "plural": "string, plural form for nouns, otherwise empty string",
  "baseForm": "string, lemma in base form (e.g. infinitive for verbs, singular for nouns)",

  "verbSubtype": "vollverb | modal | hilfsverb | ''",
  "separable": "boolean (true if separable verb, false otherwise)",
  "reflexive": "boolean (true if typically reflexive, false otherwise)",
  "auxiliary": "haben | sein | '' (main auxiliary used for Perfekt, if applicable)",

  "conjugation": {
    "praesens": {
      "ich": "string or empty",
      "du": "string or empty",
      "er_sie_es": "string or empty",
      "wir": "string or empty",
      "ihr": "string or empty",
      "sie_Sie": "string or empty"
    },
    "praeteritum": {
      "ich": "string or empty",
      "du": "string or empty",
      "er_sie_es": "string or empty",
      "wir": "string or empty",
      "ihr": "string or empty",
      "sie_Sie": "string or empty"
    },
    "perfekt": {
      "ich": "string or empty",
      "du": "string or empty",
      "er_sie_es": "string or empty",
      "wir": "string or empty",
      "ihr": "string or empty",
      "sie_Sie": "string or empty"
    }
  },

  "valenz": [
    {
      "prep": "string or null (preposition, e.g. 'mit', or null if none)",
      "kasus": "Akk | Dat | Gen | ''",
      "note": "string or empty (short hint like 'bei einer Firma arbeiten')"
    }
  ],

  "definition_de": "string OR string[] (German explanations of each sense)",
  "definition_de_translation": "string OR string[] (translations of each German explanation into the learner's language)",
  "definition": "string OR string[] (very short glosses in the learner's language, 1–3 words)",

  "example": "string, one typical German example sentence that matches the FIRST/MAIN sense",
  "exampleTranslation": "string, translation of example into the learner's language",

  "tenses": {
    "present": "string or empty",
    "preterite": "string or empty",
    "perfect": "string or empty"
  },
  "comparison": {
    "positive": "string or empty",
    "comparative": "string or empty",
    "superlative": "string or empty"
  },
  "notes": "string or empty",

  "recommendations": {
    "synonyms": "string[]",
    "antonyms": "string[]",
    "roots": "string[]"
  }
}

===============================
TYPE FIELD RULE (IMPORTANT)
===============================
- The field "type" MUST be filled ONLY when partOfSpeech is "Nomen".
- If partOfSpeech is NOT "Nomen", you MUST set: "type": "".
- NEVER set type="common_noun" for verbs/adjectives/etc.

===============================
NOUN TYPE CLASSIFICATION (language-independent)
===============================

If and only if "partOfSpeech" is a noun (Nomen), you MUST set the field "type":

- "common_noun"
  - Regular German nouns that take articles (der/die/das) and normal declension.
  - Examples: Hund, Auto, Haus, Wasser.

- "brand"
  - Company or brand names.
  - Examples: IKEA, BMW, Adidas, Nivea, Apple.

- "product_name"
  - Product-level names.
  - Examples: iPhone, Coca-Cola, PlayStation, Nutella.

- "proper_person"
  - Personal names (first or last names).
  - Examples: Anna, Peter, Müller, Johann.

- "proper_place"
  - Geographical names and place names.
  - Examples: Berlin, München, Köln, Deutschland, Europa.

- "organization"
  - Institutions or organizations.
  - Examples: UN, EU, WHO, NATO.

Rules for "type":

- If "type" is NOT "common_noun" (i.e. brand / product_name / proper_person / proper_place / organization):
  - You MUST set "gender" = "".
  - You MUST set "plural" = "".
  - You MUST NOT invent articles or declension tables.
- If you are unsure which type applies, default to "common_noun".
- The "type" field does NOT depend on the learner's language; it is purely grammatical/semantic.

===============================
VALENZ RULES (IMPORTANT)
===============================
- "valenz" describes fixed complements BEYOND the subject.
- DO NOT output placeholder empty objects like:
  [{"prep":null,"kasus":"","note":""}]
- If the verb has no fixed preposition/case complement, you MUST return: "valenz": [].

===============================
Language rules for definitions & examples
===============================

- There are TWO different kinds of learner-language content:

  1) "definition":
     - VERY SHORT glosses in the learner's language.
     - Think of flashcards: 1–3 words per sense.
     - Example (learner language = Traditional Chinese):
       - Haus → "房子"
       - Stadt → "城市"
     - Example (learner language = English):
       - Haus → "house"
       - Stadt → "city"

  2) "definition_de_translation":
     - Full translated explanations of the German definitions ("definition_de").
     - They can be longer phrases or 1–2 full sentences per sense.
     - They must accurately explain the German definition in the learner's language.
     - Example (learner language = Traditional Chinese):
       - "Ein Haus ist ein Gebäude, in dem Menschen wohnen." →
         "房子是一種人們居住的建築物。"

- The learner's language is provided in the user message as "targetLangLabel".
- When the learner's language is any kind of Chinese:
  - "definition" and "definition_de_translation" MUST be in Chinese (Traditional or Simplified, as implied by the label).
  - Never return English glosses in "definition" or "definition_de_translation".
- When the learner's language is English:
  - Both "definition" and "definition_de_translation" should be written in natural English.
- For any other learner language, always use that language in "definition" and "definition_de_translation", never fall back to English unless the learner language itself is English.

Polysemy rules:

- If the word has multiple common senses, you MAY return arrays for:
  - "definition_de"
  - "definition_de_translation"
  - "definition"
- When you return arrays, they must align by index:
  - definition_de[i] ↔ definition_de_translation[i] ↔ definition[i]
- If the word is clearly monosemous in common usage, you may return simple strings instead of arrays.

===============================
CRITICAL SENSE-SPLITTING RULES (MANDATORY)
===============================

- Each sense MUST represent exactly ONE semantic axis.
- NEVER combine meanings using "or", "and", "以及", "或", or similar constructions.
- If a word has BOTH:
  - a concrete / physical meaning (e.g. space, size, shape),
  - and an abstract / figurative meaning (e.g. limits, rules, conditions),
  you MUST split them into separate senses.

- Each sense MUST be valid with its own example sentence.
- If one German synonym (e.g. "schmal") does NOT fit all meanings, the senses MUST be split.
- Do NOT output combined synonym lines like: "schmal oder begrenzt".

Bad (FORBIDDEN):
- "狹窄或受限制"
- "schmal oder begrenzt"

Good (REQUIRED):
- Sense 1: "狹窄（空間）" → schmal
- Sense 2: "受限制的（條件／範圍）" → begrenzt / eingeschränkt

Example / exampleTranslation rules:

- "example" MUST be a single natural German sentence.
- It MUST illustrate the main or first sense.
- It MUST NOT contain archaic or overly complex phrasing unless unavoidable.

- "exampleTranslation":
  - MUST be a correct translation of the German example.
  - MUST be written in the learner's language (targetLangLabel).
  - MUST be a single natural sentence.
  - MUST NOT be literal translation if the learner's language has established conventional names.

🔥 **Mandatory rule: Established Proper-Name Translations (強制使用既定譯名)**  
When translating named entities, you MUST ALWAYS use the established proper-name translation in the learner's language if it exists.  
This includes:
- cities  
- mountains  
- rivers  
- castles  
- buildings  
- well-known landmarks  
- regions  
- countries  

Examples:  
- "Neuschwanstein" → "新天鵝堡" (Traditional Chinese)  
- "München" → "慕尼黑"  
- "Berlin" → "柏林"  
- "Köln" → "科隆"  
- "Hamburg" → "漢堡"  
- "Rhein" → "萊茵河"  
- "Alpen" → "阿爾卑斯山"  
- "Schwarzwald" → "黑森林"  

You MUST NOT output phonetic transliterations when an established translation exists.

===============================
Refs usage rules (Phase 2 - Example generation telemetry)
===============================
- The user may provide a list of reference points ("refs") in the request (outside this dictionary schema).
- Each ref typically has a "key" and represents a word, form, or concept the learner wants to see used.
- This is a QUALITY GOAL + OBSERVABILITY requirement, not a reason to produce unnatural German.

Rules:
- You SHOULD try to naturally use all refs in the German example sentence.
- Do NOT force awkward German just to include a ref.
- Do NOT add meta explanations inside the example sentence (e.g., do not write "This uses ref X").
- If one or more refs cannot be used naturally:
  - Be honest: do NOT claim they were used.
  - List them in "missingRefs".
  - Briefly explain the reason in "notes".

Reporting requirements (Phase 2 API extension):
- If you are asked to output "usedRefs" / "missingRefs":
  - "usedRefs": list the ref keys that were actually used in the example (after inflection or natural variation).
  - "missingRefs": list the ref keys that were NOT used.
  - "notes": optional short explanation (e.g. "Plural form used instead of singular", "Ref is grammatical, not a lexical item").
- Honesty is more important than completeness.

===============================
Recommendations rules (Verb only)
===============================

You MUST ALWAYS output the field "recommendations" in the JSON.

Rules:
- If and only if "partOfSpeech" is "Verb":
  - Fill "recommendations" with up to 5 items per list.

  - Mandatory constraints (apply to synonyms/antonyms/roots):
    - Do NOT include the base word itself (word OR baseForm).
    - Do NOT include duplicates (case-insensitive).
    - Prefer common, modern, everyday verbs; avoid rare or archaic items.
    - If you are unsure, return empty arrays.
    - NEVER output the same verb in BOTH synonyms and antonyms.

  - "synonyms":
    - ONLY very close-meaning verbs (true near-synonyms).
    - MUST NOT include verbs that are semantic opposites.
    - MUST NOT overlap with "antonyms".
    - If no true synonyms exist, return [].

  - "antonyms":
    - ONLY clear and commonly accepted semantic opposites.
    - MUST NOT overlap with "synonyms".
    - If no clear antonym exists, return [].

  - "roots":
    - STRICT meaning: derivational verb family members formed by prefixes
      (same verbal stem + different prefix) — NOT lemma mapping.
    - MUST be INFINITIVES ONLY.
    - Examples (allowed):
      - ziehen → anziehen, ausziehen, umziehen, einziehen
      - sehen → ansehen, zusehen, übersehen, aussehen
      - laufen → loslaufen, weglaufen, mitlaufen, ablaufen
    - NOT allowed (MUST NOT output):
      - conjugated forms: kann, läuft, zog, siehst
      - participles: gezogen, gelaufen
      - bare stems: lauf
      - the lemma/baseForm itself: ziehen, sehen, laufen
      - loose semantic associations (related meaning but NOT a prefix-derivation family)
    - If no clear prefix-derivation family exists, return [].

- For ALL other parts of speech:
  - Set "recommendations" to:
    {
      "synonyms": [],
      "antonyms": [],
      "roots": []
    }

Important:
- Never include example sentences inside definitions.
- Never output markdown or comments.
- Return ONLY the JSON object, nothing else.
`;

/**
 * 建立 user prompt，告訴模型：
 * - 學習者母語 / 介面語言是什麼（targetLangLabel）
 * - 要查哪個德文單字
 * - ⭐ 只有 Nomen 才需要標註 type
 */
function buildUserPrompt(word, targetLangLabel) {
  return `
Learner's language (targetLangLabel): ${targetLangLabel}

The user is learning German. They want a dictionary entry for the following GERMAN word:

"${word}"

You MUST:
- Follow the "type" rules in the system message (type only for Nomen; otherwise type="").
- For non-common_noun types (brand / product_name / proper_person / proper_place / organization), keep gender="" and plural="".

Please:
- Interpret "${targetLangLabel}" as the learner's primary language.
- Set the JSON field "language" to "${targetLangLabel}".
- Fill ALL fields in the JSON schema from the system prompt as well as you can.
- Obey ALL language rules about "definition", "definition_de_translation", "example", and "exampleTranslation".
- Apply STRICT proper-name translation rules for cities, landmarks, buildings, and all named entities.
- For common words, do NOT leave the definitions empty.
- For multiple senses, you MAY use arrays and must align indices across definition fields.

Return ONLY the JSON object, no markdown, no explanation.
`;
}


/**
 * ✅ Phase B：Gloss-only prompt（只產生 learner-language 的「簡短釋義 definition」）
 * - 用於避免把 definition_de_translation 誤當成 definition
 * - definition：1～3 個詞的短釋義；多義請回傳 array，且不得用逗號合併
 */
const glossSystemPrompt = `
You are a precise gloss generator for a German dictionary app.

Goal:
- Given a German headword and its German dictionary explanation(s),
  produce VERY SHORT gloss(es) in the learner's language.
- Output ONLY a JSON object:
  { "definition": "string OR string[]" }

Rules:
- "definition" MUST be in the learner's language (targetLangLabel).
- 1–3 words per sense (flashcard style).
- If there are multiple distinct senses, output an array and keep them separate.
- NEVER join multiple senses into one string using ",", "，", "、", "/", "或", "和", "以及".
- If learner language is any Chinese, NEVER output English.
- Return ONLY JSON, nothing else.
`;

/**
 * 產生 gloss-only user prompt
 */
function buildGlossUserPrompt(word, targetLangLabel, definitionDe) {
  const defText = Array.isArray(definitionDe)
    ? definitionDe.map((d, i) => `${i + 1}. ${d}`).join('\\n')
    : `${definitionDe || ''}`;

  return `
Learner's language (targetLangLabel): ${targetLangLabel}

German headword:
"${word}"

German definition(s) (definition_de):
${defText}

Generate gloss(es) in the learner's language.
Return ONLY the JSON object with the field "definition".
`;
}

/**
 * ✅ Phase C：Sense-splitting prompt（把混義拆成 aligned arrays）
 * - 用於修正像 "城堡,鎖" 這種混義輸出
 */
const senseSplitSystemPrompt = `
You are a sense-splitting assistant for a German dictionary app.

Input includes:
- German definition_de (string or string[])
- definition_de_translation (string or string[])
- definition (string or string[])

Your task:
- If any field contains multiple meanings combined with separators (comma/、/或/和/以及/etc),
  split them into multiple senses.
- Output ONLY a JSON object with these fields:
  { "definition_de": ..., "definition_de_translation": ..., "definition": ... }

Rules:
- Arrays MUST be aligned by index across the three fields.
- Learner language is provided as targetLangLabel; definition_de_translation and definition MUST be in that language.
- NEVER combine multiple senses in one string using separators.
- Return ONLY JSON, nothing else.
`;

/**
 * 產生 sense-splitting user prompt
 */
function buildSenseSplitUserPrompt(word, targetLangLabel, payload) {
  const safe = (v) => (v === undefined ? null : v);
  return `
Learner's language (targetLangLabel): ${targetLangLabel}

German headword:
"${word}"

Here is the current dictionary payload (may be wrong / mixed senses):
${JSON.stringify(
  {
    definition_de: safe(payload.definition_de),
    definition_de_translation: safe(payload.definition_de_translation),
    definition: safe(payload.definition),
  },
  null,
  2
)}

Split mixed senses if needed. Ensure aligned arrays by index.
Return ONLY the JSON object with fields "definition_de", "definition_de_translation", "definition".
`;
}

module.exports = {
  systemPrompt,
  buildUserPrompt,
  // Phase B/C (multi-call for better quality)
  glossSystemPrompt,
  buildGlossUserPrompt,
  senseSplitSystemPrompt,
  buildSenseSplitUserPrompt,
};
// backend/src/clients/dictionaryPrompts.js