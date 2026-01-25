// backend/src/core/dictionaryNormalizer.js

/**
 * 文件說明：
 * - 功能：清洗與補強模型輸出的字典 JSON，確保前端拿到穩定結構
 * - 支援：單一釋義（單一物件）與多釋義（senses[] / array / 平行陣列）
 * - 目標：為「收藏寫入多筆 senseIndex」提供上游資料形狀（dictionary.senses[]）
 *
 * 異動紀錄：
 * - 2025-12-27：新增 multi-sense 正規化（dictionary.senses[]），並加入初始化狀態與 runtime log
 * - 2025-12-27：補上「平行陣列」→ senses[] 正規化（例如 definition_de_translation 為 array 時）
 * - 2025-12-27：補上 gloss/glossLang（收藏寫入 headword_gloss 用），不改動既有欄位結構
 * - 2025-12-27：支援 analyze envelope 結構（{..., dictionary:{...}}），先正規化 envelope.dictionary（新增 runtime log）
 * - 2026-01-25：plural / gender 下沉到 sense 級（多義字可保留各 sense 變化；base 欄位避免混淆）
 */

/**
 * 功能初始化狀態（Production 排查）
 * - 注意：這是 runtime 觀測用的狀態，不影響功能邏輯
 */
console.log('[dictionaryNormalizer] module loaded');
const INIT_STATUS = {
  module: "dictionaryNormalizer",
  createdAt: new Date().toISOString(),
  ready: true,
  lastError: null,
  features: {
    multiSenseNormalize: true,
    supportsParsedArray: true,
    supportsParsedSensesField: true,
    supportsParallelArrays: true, // ✅ 2025-12-27：支援平行陣列→senses[]
    supportsGlossFields: true, // ✅ 2025-12-27：補 gloss/glossLang
    supportsEnvelopeDictionary: true, // ✅ 2025-12-27：支援 analyze envelope.dictionary
  },
  runtime: {
    lastCalledAt: null,
    lastDurationMs: null,
    lastSenseCount: null,
    lastWord: null,
    lastParallelSenseCount: null, // ✅ 2025-12-27：平行陣列推導出的 sense 數
    lastParallelKeys: null, // ✅ 2025-12-27：哪些欄位被判定為平行陣列
    lastGlossPreview: null, // ✅ 2025-12-27：最近一次推導的 gloss 預覽
    lastGlossLang: null, // ✅ 2025-12-27：最近一次推導的 glossLang
    lastEnvelopeDetectedAt: null, // ✅ 2025-12-27：最近一次偵測到 envelope 的時間
    lastEnvelopeKeys: null, // ✅ 2025-12-27：envelope 的 key 快照（debug）
  },
};

/**
 * 當 Groq 發生錯誤或無法解析時使用的安全預設值
 */
function fallback(word) {
  const w = String(word || "").trim();
  return {
    word: w,
    // NOTE: language is UI explainLang (mother language), do NOT hardcode headword language
    language: "",
    partOfSpeech: "unknown",
    type: "unknown", // ⭐ 新增：預設 unknown
    gender: "",
    plural: "",
    baseForm: w,
    definition_de: "",
    definition_de_translation: "",
    // NOTE: definition is a short gloss in explainLang; leave empty on fallback
    definition: "",
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
    // ✅ 2025-12-27：收藏用欄位（保持空）
    gloss: "",
    glossLang: "",
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
 * ✅ 2025-12-27：由既有欄位推導收藏用 gloss/glossLang
 * - gloss 優先順序：
 *   1) definition（通常是短字詞：城堡 / 鎖）
 *   2) definition_de_translation（通常是完整句翻譯）
 *   3) definition_de（最後才用德文定義）
 * - glossLang 優先順序：
 *   1) parsed.explainLang / parsed.explain_lang
 *   2) parsed.glossLang / parsed.gloss_lang
 *   3) ""（保持空）
 */
function deriveGlossFields({
  definitionField,
  definitionDeTransField,
  definitionDeField,
  parsed,
}) {
  const pickFirstNonEmptyFromArray = (arr) => {
    if (!Array.isArray(arr)) return "";
    for (const v of arr) {
      const s = typeof v === "string" ? v.trim() : "";
      if (s) return s;
    }
    return "";
  };

  let gloss = "";
  if (Array.isArray(definitionField)) gloss = pickFirstNonEmptyFromArray(definitionField);
  else if (typeof definitionField === "string") gloss = definitionField.trim();

  if (!gloss) {
    if (Array.isArray(definitionDeTransField)) gloss = pickFirstNonEmptyFromArray(definitionDeTransField);
    else if (typeof definitionDeTransField === "string") gloss = definitionDeTransField.trim();
  }

  if (!gloss) {
    if (Array.isArray(definitionDeField)) gloss = pickFirstNonEmptyFromArray(definitionDeField);
    else if (typeof definitionDeField === "string") gloss = definitionDeField.trim();
  }

  const glossLang =
    (parsed && (parsed.explainLang || parsed.explain_lang)) ||
    (parsed && (parsed.glossLang || parsed.gloss_lang)) ||
    "";

  // runtime 觀測
  INIT_STATUS.runtime.lastGlossPreview = gloss ? String(gloss).slice(0, 40) : "";
  INIT_STATUS.runtime.lastGlossLang = glossLang || "";

  return { gloss: gloss || "", glossLang: glossLang || "" };
}

/**
 * ✅ 平行陣列→senses[] 推導
 * - 常見情境：模型把「多個釋義」塞進同一個物件，但某些欄位是 array
 *   例如：
 *     definition_de_translation: ["城堡", "鎖"]
 *     definition_de: ["ein großes Gebäude...", "ein Mechanismus..."] 或字串
 * - 這裡會依 array 的最大長度，拆成多個 sense 物件
 *
 * 回傳：
 * - { sensesParsed: Array<object>, baseParsed: object } 或 null
 */
function buildParallelSensesIfAny(parsed) {
  if (!parsed || typeof parsed !== "object") return null;

  // ✅ 只列入「可能代表釋義維度」的欄位
  const parallelKeys = [
    "definition_de_translation",
    "definition_de",
    "definition",
    "exampleTranslation",
    "example",
    "notes",
    // ✅ 2026-01-25：允許 LLM 在 sense 維度回傳不同 gender / plural（例如 Bank）
    "gender",
    "plural",
  ];

  const arrays = [];
  for (const k of parallelKeys) {
    if (Array.isArray(parsed[k]) && parsed[k].length > 0) {
      arrays.push({ key: k, len: parsed[k].length });
    }
  }

  // 沒有任何陣列欄位 → 不是這條路徑
  if (arrays.length === 0) return null;

  // 只有 1 個元素的陣列，不視為多釋義（避免把單筆當多筆）
  const maxLen = arrays.reduce((m, a) => Math.max(m, a.len), 0);
  if (maxLen <= 1) return null;

  const usedKeys = arrays.map((a) => a.key);

  // base：以原始 parsed 為 base（相容既有前端顯示）
  const baseParsed = parsed;

  // senses：每個 idx 拆出一份 payload（只覆蓋平行欄位）
  const sensesParsed = Array.from({ length: maxLen }).map((_, idx) => {
    const one = { ...parsed };

    for (const k of usedKeys) {
      const v = parsed[k];
      if (Array.isArray(v)) {
        one[k] = typeof v[idx] === "string" ? String(v[idx]).trim() : v[idx];
      }
    }

    // ✅ 補一個 senseIndex（後面 normalize 也會再保險一次）
    one.senseIndex = idx;

    return one;
  });

  // runtime 觀測
  INIT_STATUS.runtime.lastParallelSenseCount = maxLen;
  INIT_STATUS.runtime.lastParallelKeys = usedKeys;

  console.log("[dictionaryNormalizer][parallel-arrays]", {
    maxLen,
    usedKeys,
    sample: {
      idx0: usedKeys.reduce((acc, k) => {
        acc[k] = Array.isArray(parsed[k]) ? parsed[k][0] : undefined;
        return acc;
      }, {}),
      idx1: usedKeys.reduce((acc, k) => {
        acc[k] = Array.isArray(parsed[k]) ? parsed[k][1] : undefined;
        return acc;
      }, {}),
    },
  });

  return { sensesParsed, baseParsed };
}

/**
 * 清洗與補強模型輸出的 JSON，確保前端拿到穩定結構
 * - definition / definition_de / definition_de_translation 都可能是「字串或陣列」
 * - 這裡只做基本 trim ＋安全檢查＋ type 處理
 *
 * ✅ 注意：此函式為「單一釋義」版本；多釋義容器由 normalizeDictionaryResult() 包裝
 */
function normalizeDictionaryResultSingle(parsed, word) {
  const safeWord = String(word || "").trim();

  // ✅ 防呆：避免 parsed 為 null/undefined 時直接存取屬性造成 crash
  parsed = parsed || {};

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
    language: (parsed.explainLang || parsed.explain_lang || parsed.language || ""),
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

  // ✅ 2025-12-27：補 gloss / glossLang（收藏用）
  // - 不改既有欄位，只新增
  const derived = deriveGlossFields({
    definitionField,
    definitionDeTransField,
    definitionDeField,
    parsed,
  });
  result.gloss = derived.gloss;
  result.glossLang = derived.glossLang;

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

    // ✅ plural 必須是「單一字串」；若模型回傳陣列/逗號拼接 → 視為不可信（留空）
    // - 多義名詞（Bank/Schloss）應由 multi-sense 或平行陣列拆出 sense 後，各 sense 各自帶 plural
    if (Array.isArray(result.plural)) {
      result.plural = "";
    } else {
      const p = String(result.plural || "").trim();
      // 常見 NG： "Bänke, Banken" / "城堡,鎖"（逗號拼接）→ 不在 single-sense 放
      if (/[，,、]/.test(p)) result.plural = "";
      else result.plural = p;
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

/**
 * 多釋義容器正規化：
 * - 支援三種輸入：
 *   1) parsed.senses 為 array（推薦）
 *   2) parsed 本身就是 array（相容）
 *   3) parsed 是單一物件，但存在「平行陣列」欄位（例如 definition_de_translation 是 array）
 * - 回傳格式：
 *   - 保留原本單一物件欄位（相容既有前端）
 *   - 新增 senses[]（每個元素是一份完整 normalized 結果）
 */
function normalizeDictionaryResult(parsed, word) {
  const startedAt = Date.now();
  INIT_STATUS.runtime.lastCalledAt = new Date().toISOString();
  INIT_STATUS.runtime.lastWord = String(word || "").trim() || "";
  INIT_STATUS.lastError = null;

  try {
    // ✅ 2025-12-27：支援 analyze envelope：{ mode,text,..., dictionary:{...} }
    // - 若直接把 envelope 丟進來，原本的平行陣列拆解不會被觸發
    // - 這裡先把 envelope.dictionary 正規化，再把 dictionary 放回去（其餘欄位不動）
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.dictionary &&
      typeof parsed.dictionary === "object" &&
      !Array.isArray(parsed) &&
      !Array.isArray(parsed.senses) &&
      !parsed.word // 避免把「已是 dictionary object」誤判成 envelope
    ) {
      const envelope = parsed;
      const baseWord =
        String(word || "").trim() ||
        String(envelope.text || "").trim() ||
        String((envelope.dictionary && envelope.dictionary.word) || "").trim();

      INIT_STATUS.runtime.lastEnvelopeDetectedAt = new Date().toISOString();
      INIT_STATUS.runtime.lastEnvelopeKeys = Object.keys(envelope || {}).slice(0, 40);

      console.log("[dictionaryNormalizer][envelope]", {
        baseWord,
        envelopeKeys: INIT_STATUS.runtime.lastEnvelopeKeys,
        dictKeys: Object.keys(envelope.dictionary || {}).slice(0, 40),
      });

      envelope.dictionary = normalizeDictionaryResult(envelope.dictionary, baseWord);
      return envelope;
    }

    // 1) 擷取 senses array（若有）
    let sensesParsed = null;
    let baseParsed = parsed || null;

    if (Array.isArray(parsed)) {
      sensesParsed = parsed;
      baseParsed = parsed[0] || {};
    } else if (parsed && Array.isArray(parsed.senses)) {
      sensesParsed = parsed.senses;
      baseParsed = parsed;
    }

    // ✅ 2) 平行陣列→senses（例如 definition_de_translation 為 array）
    // - 只有在 (1) 沒有 senses 的情況下才會走這條路徑
    if (!Array.isArray(sensesParsed) || sensesParsed.length === 0) {
      const parallel = buildParallelSensesIfAny(parsed || null);
      if (parallel && Array.isArray(parallel.sensesParsed)) {
        sensesParsed = parallel.sensesParsed;
        baseParsed = parallel.baseParsed;
      }
    }

    // 3) 若是多釋義：先 normalize 每個 sense，再組回 base + senses
    if (Array.isArray(sensesParsed) && sensesParsed.length > 0) {
      const senses = sensesParsed.map((s, idx) => {
        const normalized = normalizeDictionaryResultSingle(s || {}, word);

        // ✅ 只新增，不覆蓋既有欄位：讓前端可用 senseIndex 對齊
        if (normalized && typeof normalized === "object") {
          normalized.senseIndex = Number.isFinite(Number(normalized.senseIndex))
            ? Number(normalized.senseIndex)
            : idx;
        }

        return normalized;
      });

      // base：以 baseParsed 為主（相容既有 dictionary 欄位）
      const base = normalizeDictionaryResultSingle(
        baseParsed || sensesParsed[0] || {},
        word
      );

      // ✅ 新增 senses（不破壞既有結構）
      base.senses = senses;

      // ✅ 2026-01-25：plural / gender 下沉到 sense 級（避免多義字在 base 欄位混在一起）
      // - 若所有 senses 的 plural/gender 都相同 → base 可保留該值（相容既有 UI）
      // - 若出現不同值（例如 Bank: Bänke vs Banken）→ base 清空，避免誤導
      const uniqPlural = new Set(
        (senses || [])
          .map((x) => (x && typeof x.plural === "string" ? x.plural.trim() : ""))
          .filter(Boolean)
      );
      const uniqGender = new Set(
        (senses || [])
          .map((x) => (x && typeof x.gender === "string" ? x.gender.trim() : ""))
          .filter(Boolean)
      );

      if (uniqPlural.size === 1) base.plural = Array.from(uniqPlural)[0] || "";
      else base.plural = "";

      if (uniqGender.size === 1) base.gender = Array.from(uniqGender)[0] || "";
      // gender 不同很少見，但仍以不誤導為主
      else if (uniqGender.size > 1) base.gender = "";

      INIT_STATUS.runtime.lastSenseCount = senses.length;

      // ✅ runtime log（便於 Production 排查）
      // - 注意：保持可讀、資訊量剛好
      console.log("[dictionaryNormalizer][multi-sense]", {
        word: base.word || String(word || "").trim(),
        sensesLen: senses.length,
        keys: Object.keys(base || {}).slice(0, 25),
        glossPreview: base.gloss ? String(base.gloss).slice(0, 40) : "",
        glossLang: base.glossLang || "",
      });

      return base;
    }

    // 4) 單一釋義：維持原本行為
    INIT_STATUS.runtime.lastSenseCount = 0;
    return normalizeDictionaryResultSingle(parsed || {}, word);
  } catch (e) {
    INIT_STATUS.lastError = String(
      e && (e.stack || e.message) ? e.stack || e.message : e
    );
    INIT_STATUS.ready = true; // 不中斷服務
    console.log("[dictionaryNormalizer][error]", {
      word: String(word || "").trim(),
      error: INIT_STATUS.lastError,
    });
    return fallback(word);
  } finally {
    INIT_STATUS.runtime.lastDurationMs = Date.now() - startedAt;
  }
}

module.exports = {
  fallback,
  normalizePartOfSpeech,
  normalizeDictionaryResult,
};

// backend/src/core/dictionaryNormalizer.js