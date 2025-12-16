// backend/src/core/dictionaryNormalizer.js

/**
 * 當 Groq 發生錯誤或無法解析時使用的安全預設值
 */
function fallback(word) {
  const w = String(word || "").trim();
  return {
    word: w,
    language: "de",
    partOfSpeech: "unknown",
    type: "unknown", // ⭐ 新增：預設 unknown
    gender: "",
    plural: "",
    baseForm: w,
    definition_de: "",
    definition_de_translation: "",
    definition: "AI 暫時沒有提供定義（fallback）。",
    example: "",
    tenses: {
      present: "",
      preterite: "",
      perfect: "",
    },
    comparison: {
      positive: "",
      comparative: "",
      superlative: "",
    },
    notes: "",
  };
}

/**
 * 將各種 partOfSpeech 字串正規化成標準德文詞性標籤
 */
function normalizePartOfSpeech(posRaw) {
  if (!posRaw) return "unknown";
  const s = String(posRaw).trim().toLowerCase();

  if (["noun", "substantiv", "nomen", "名詞", "名词"].includes(s)) {
    return "Nomen";
  }
  if (["verb", "verben", "動詞", "动词"].includes(s)) {
    return "Verb";
  }
  if (["adjective", "adjektiv", "形容詞", "形容词"].includes(s)) {
    return "Adjektiv";
  }
  if (["adverb", "副詞", "副词"].includes(s)) {
    return "Adverb";
  }
  if (["pronoun", "pronomen", "代名詞", "代词"].includes(s)) {
    return "Pronomen";
  }
  if (["preposition", "präposition", "介詞", "介词"].includes(s)) {
    return "Präposition";
  }
  if (["conjunction", "konjunktion", "連接詞", "连词"].includes(s)) {
    return "Konjunktion";
  }
  if (["article", "artikel", "冠詞", "冠词"].includes(s)) {
    return "Artikel";
  }

  return "unknown";
}

/**
 * 依字面與詞性做簡單 heuristics，補上 type
 */
function detectTypeAuto(word, partOfSpeech) {
  const w = String(word || "").trim();
  if (!w) return "common_noun";
  if (partOfSpeech !== "Nomen") return "common_noun";

  // 一些常見品牌
  if (/^(IKEA|BMW|Siemens|Adidas|Nivea|Volkswagen)$/i.test(w)) return "brand";

  // 地名
  if (
    /^(Berlin|München|Munchen|Köln|Cologne|Hamburg|Stuttgart|Deutschland|Germany|Europa|Europe)$/i.test(
      w
    )
  ) {
    return "proper_place";
  }

  // 組織
  if (/^(EU|UN|UNO|WHO|NATO)$/i.test(w)) return "organization";

  // 產品
  if (/^(iPhone|Coca[- ]?Cola|PlayStation|Nutella)$/i.test(w))
    return "product_name";

  // 看起來像人名（開頭大寫，其餘小寫）
  if (/^[A-ZÄÖÜ][a-zäöüß]+$/.test(w)) return "proper_person";

  return "common_noun";
}

/**
 * ✅ 從 definition_de 推回可能的原型（避免寫死 kann→können）
 * - 只在「Verb」且 parsed.baseForm 缺失/不可信時使用
 * - 優先抓出最像德文不定詞的 token（können / müssen / dürfen / sein / haben / werden...）
 */
function inferVerbBaseFormFromDefinitionDe(definitionDeField) {
  // 把 definition_de 統一成單一字串
  let raw = "";
  if (Array.isArray(definitionDeField)) raw = definitionDeField.join(" ; ");
  else if (typeof definitionDeField === "string") raw = definitionDeField;
  raw = String(raw || "").trim();
  if (!raw) return "";

  // 以常見分隔符切開：逗號、分號、斜線、頓號等
  const parts = raw
    .split(/[，,；;/、]+/)
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  // 抽出第一個「看起來像德文不定詞」的候選
  // 規則：全小寫字母(含變音符) + (en|n) 結尾，或是常見不定詞例外（sein/tun）
  for (const p of parts) {
    // 可能是片語：例如 "fähig sein" -> 抓最後一個字 "sein"
    const words = p
      .split(/\s+/)
      .map((w) => w.replace(/[()«»„“”"'`.,!?]/g, "").trim())
      .filter(Boolean);

    if (words.length === 0) continue;

    // 先試最後一個（處理 "fähig sein"）
    const tail = words[words.length - 1] || "";
    const head = words[0] || "";

    const candidates = [tail, head]; // tail 優先，head 當 fallback

    for (const c of candidates) {
      const w = String(c || "").trim();
      if (!w) continue;

      // 必須含德文字母
      if (!/[a-zäöüß]/.test(w)) continue;

      const lower = w.toLowerCase();

      const looksLikeInfinitive =
        /[a-zäöüß]+(en|n)$/.test(lower) || ["sein", "tun"].includes(lower);

      if (looksLikeInfinitive) return lower;
    }
  }

  return "";
}

/**
 * ✅ 判斷目前 baseForm 是否「不可信」
 * - 常見情況：模型沒給 baseForm -> 用 safeWord 回填，導致 baseForm = "kann"
 * - 我們只在 Verb 的情境下做輕量判斷
 */
function isUnreliableVerbBaseForm(baseForm, safeWord) {
  const b = String(baseForm || "").trim();
  const s = String(safeWord || "").trim();
  if (!b || !s) return true;

  // baseForm 直接等於輸入詞，通常就是回填造成（尤其在 Verb 變位）
  if (b.toLowerCase() === s.toLowerCase()) return true;

  return false;
}

/**
 * 清洗與補強模型輸出的 JSON，確保前端拿到穩定結構
 * - definition / definition_de / definition_de_translation 都可能是「字串或陣列」
 * - 這裡只做基本 trim ＋安全檢查＋ type 處理
 */
function normalizeDictionaryResult(parsed, word) {
  const safeWord = String(word || "").trim();

  // 允許 definition 可能是字串或陣列
  let definitionField = parsed.definition;
  if (Array.isArray(definitionField)) {
    // 保留陣列，交由前端決定要不要條列顯示
  } else if (typeof definitionField === "string") {
    definitionField = definitionField.trim();
  } else if (definitionField == null) {
    definitionField = "";
  }

  // definition_de / definition_de_translation 同樣允許字串或陣列，這裡只做基本 trim
  const defDe = parsed.definition_de;
  let definitionDeField = defDe;
  if (Array.isArray(defDe)) {
    definitionDeField = defDe.map((v) =>
      typeof v === "string" ? v.trim() : ""
    );
  } else if (typeof defDe === "string") {
    definitionDeField = defDe.trim();
  } else {
    definitionDeField = "";
  }

  const defDeTrans = parsed.definition_de_translation;
  let definitionDeTransField = defDeTrans;
  if (Array.isArray(defDeTrans)) {
    definitionDeTransField = defDeTrans.map((v) =>
      typeof v === "string" ? v.trim() : ""
    );
  } else if (typeof defDeTrans === "string") {
    definitionDeTransField = defDeTrans.trim();
  } else {
    definitionDeTransField = "";
  }

  const partOfSpeech = normalizePartOfSpeech(parsed.partOfSpeech);

  // 處理 type：優先採用模型給的，其次用 heuristic
  let rawType = parsed.type;
  let type = "common_noun";
  if (rawType) {
    const t = String(rawType).trim().toLowerCase();
    if (t === "common_noun") type = "common_noun";
    else if (t === "brand") type = "brand";
    else if (t === "product_name" || t === "product") type = "product_name";
    else if (t === "proper_person" || t === "person") type = "proper_person";
    else if (t === "proper_place" || t === "place" || t === "location")
      type = "proper_place";
    else if (t === "organization" || t === "organisation")
      type = "organization";
    else type = detectTypeAuto(parsed.word || safeWord, partOfSpeech);
  } else {
    type = detectTypeAuto(parsed.word || safeWord, partOfSpeech);
  }

  // ✅ baseForm 補強：只在 Verb 且缺失/不可信時，從 definition_de 推回
  let baseForm = parsed.baseForm || safeWord;
  if (partOfSpeech === "Verb" && isUnreliableVerbBaseForm(baseForm, safeWord)) {
    const inferred = inferVerbBaseFormFromDefinitionDe(definitionDeField);
    if (inferred) baseForm = inferred;
  }

  const result = {
    word: parsed.word || safeWord,
    language: parsed.language || "de",
    partOfSpeech,
    type, // ⭐ 已新增 type
    gender: parsed.gender || "",
    plural: parsed.plural || "",
    baseForm,
    definition_de: definitionDeField || "",
    definition_de_translation: definitionDeTransField || "",
    definition: definitionField || "",
    example: parsed.example || "",
    tenses:
      parsed.tenses || {
        present: "",
        preterite: "",
        perfect: "",
      },
    comparison:
      parsed.comparison || {
        positive: "",
        comparative: "",
        superlative: "",
      },
    notes: parsed.notes || "",
  };

  // 若是品牌 / 地名 / 人名 / 組織 / 產品名 → 一律不保留 gender / plural
  if (
    ["brand", "proper_place", "proper_person", "organization", "product_name"].includes(
      result.type
    )
  ) {
    result.gender = "";
    result.plural = "";
  } else {
    // 限制 gender 為 der/die/das
    const g = String(result.gender || "").trim();
    if (!["der", "die", "das"].includes(g)) {
      result.gender = "";
    } else {
      result.gender = g;
    }
  }

  // 清洗 notes，移除不確定語氣與與性別矛盾的說明
  if (result.notes && typeof result.notes === "string") {
    let notes = result.notes;
    const unsurePattern =
      /(可能|大概|也許|也许|probabl|maybe|vielleicht|ربما)/i;
    if (unsurePattern.test(notes)) notes = "";

    if (notes && result.gender) {
      const containsNeuter = /(中性|neutrum|neuter)/i.test(notes);
      const containsFeminine = /(陰性|阴性|feminin)/i.test(notes);
      const containsMasculine = /(陽性|阳性|maskulin)/i.test(notes);

      if (result.gender === "die" && (containsNeuter || containsMasculine))
        notes = "";
      if (result.gender === "der" && (containsNeuter || containsFeminine))
        notes = "";
      if (result.gender === "das" && (containsFeminine || containsMasculine))
        notes = "";
    }

    result.notes = notes || "";
  }

  return result;
}

module.exports = {
  fallback,
  normalizePartOfSpeech,
  normalizeDictionaryResult,
};

// backend/src/core/dictionaryNormalizer.js
