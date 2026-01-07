// backend/src/services/analyzeWord.js

/**
 * 文件說明：
 * - 功能：處理 /api/analyze 的核心邏輯：tokenize → lookupWord → 補強 recommendations / baseGender → 回傳給前端
 * - 本次目標：在上游未提供 senses[] 的情況下，從既有欄位（尤其 definition_de_translation）推導多釋義結構，產出 dictionary.senses[]
 *
 * 異動紀錄：
 * - 2025-12-27：新增「多釋義推導器」：由 definition_de_translation / definition 解析出 senses[]，並加入 runtime console（Production 排查）
 * - 2025-12-28：支援「array 型多釋義」：definition / definition_de / definition_de_translation 為陣列時，依 index 對齊封裝 senses[]，並保留既有 string 分割邏輯
 * - 2026-01-05：✅ Step 1（POS 可切換 scaffold）：回傳 dictionary.primaryPos / dictionary.posKey / dictionary.posOptions（先打通資料流，不改 UI 行為）
 * - 2026-01-05：✅ Step 2-2（POS 目標詞性可 re-query）：支援 options.targetPosKey，並透傳給 lookupWord（只打通 re-query 資料流，不改預設行為）
 * - 2026-01-05：✅ Step 3（Nomen 大寫保底）：避免輸入為小寫時（例如 buch）導致 dictionary.word/baseForm/plural 以小寫回傳（Production 排查）
 * - 2026-01-05：✅ Step 4（Usage 歸戶透傳）：將 options.userId/email/ip/endpoint/requestId 透傳到 lookupWord 第三參數（供 dictionaryLookup/usageLogger 記帳）
 */

const { tokenizeWord } = require('../core/tokenizer');
const { lookupWord } = require('../clients/dictionaryClient');

/**
 * 功能初始化狀態（Production 排查）
 * - 注意：此狀態只用於觀測，不改變既有邏輯
 */
const INIT_STATUS = {
  module: "analyzeWord",
  createdAt: new Date().toISOString(),
  ready: true,
  lastError: null,
  runtime: {
    lastCalledAt: null,
    lastDurationMs: null,
    lastText: null,
    lastExplainLang: null,
    lastDerivedSenses: null,
    // ✅ 2026-01-05：POS scaffold runtime（Production 排查）
    lastPrimaryPos: null,
    lastPosKey: null,
    lastPosOptions: null,

    // ✅ 2026-01-05：Step 2-2：POS re-query runtime（Production 排查）
    lastRequestedPosKey: null,
    lastLookupOptions: null,
    lastEffectivePosKey: null,

    // ✅ 2026-01-05：Step 3：Nomen capitalization runtime（Production 排查）
    lastNounCapitalizationApplied: null,
    lastNounCapitalizationBefore: null,
    lastNounCapitalizationAfter: null,

    // ✅ 2026-01-05：Step 4：Usage 歸戶透傳 runtime（Production 排查）
    lastUsageUserId: null,
    lastUsageEmail: null,
    lastUsageRequestId: null,
    lastUsageEndpoint: null,
  },
  features: {
    deriveSensesFromFlatFields: true,
    deriveSensesFromArrayFields: true, // ✅ 2025-12-28
    // ✅ 2026-01-05：POS 可切換 scaffold（僅回傳結構，不啟用切換）
    posSwitchScaffold: true,

    // ✅ 2026-01-05：Step 2-2：POS re-query（僅透傳，不改預設行為）
    posSwitchRequery: true,

    // ✅ 2026-01-05：Step 3：Nomen 大寫保底（避免 LLM/輸入小寫造成名詞欄位小寫）
    nounCapitalizationGuard: true,

    // ✅ 2026-01-05：Step 4：Usage 歸戶透傳（lookup 記帳）
    usageAttributionPassThrough: true,
  },
};

/**
 * 中文功能說明：
 * - ✅ Step 2-2：正規化 POS key（避免 undefined/空字串干擾）
 * - 注意：只做資料清理，不推測詞性
 */
function normalizePosKey(posKey) {
  const k = String(posKey || "").trim();
  return k ? k : null;
}

/**
 * 中文功能說明：
 * - ✅ Step 2-2 / Step 4：建立 lookupWord 的 options（保守擴充）
 * - 設計原則：
 *   - 不改既有 lookupWord(text, explainLang) 行為
 *   - 若 lookupWord 支援第三參數，則可用於：
 *     - 指定 targetPosKey（Step 2-2）
 *     - 透傳 userId/email/ip/endpoint/requestId（Step 4：供 usageLogger 記帳）
 *   - 若 lookupWord 不支援第三參數，多餘參數在 JS 也不會造成錯誤
 */
function buildLookupWordOptions(options = {}) {
  const payload = {};

  // ✅ Step 2-2：POS re-query
  const targetPosKey = normalizePosKey(options && options.targetPosKey);
  if (targetPosKey) {
    payload.targetPosKey = targetPosKey;
  }

  // ✅ Step 4：Usage 歸戶透傳（不推測、不加工，原樣帶下去）
  const userId = String((options && options.userId) || "").trim();
  const email = String((options && options.email) || "").trim();
  const ip = String((options && options.ip) || "").trim();
  const endpoint = String((options && options.endpoint) || "").trim();
  const requestId = String((options && options.requestId) || "").trim();

  if (userId) payload.userId = userId;
  if (email) payload.email = email;
  if (ip) payload.ip = ip;
  if (endpoint) payload.endpoint = endpoint;
  if (requestId) payload.requestId = requestId;

  // 若完全沒有任何擴充欄位 → 回傳 null（保留原本行為）
  const keys = Object.keys(payload);
  if (!keys || keys.length === 0) return null;

  return {
    ...payload,
    // 保留擴充欄位：未來可加 source / reason / traceId 等
    _source: "analyzeWord",
  };
}

// 允許：單字 infinitiv 或 "sich + infinitiv"
function isVerbLemmaLike(s) {
  const w = String(s || '').trim();
  if (!w) return false;

  // allow: "sich + infinitiv"
  if (/^sich\s+/i.test(w)) {
    const rest = w.replace(/^sich\s+/i, "").trim();
    return /^[A-Za-zÄÖÜäöüß]+(en|n)$/.test(rest);
  }

  // allow: single-token infinitiv
  if (!/^[A-Za-zÄÖÜäöüß]+$/.test(w)) return false;
  return /[A-Za-zÄÖÜäöüß]+(en|n)$/.test(w);
}

function uniqLower(arr) {
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

function normalizeWordList(list, { denySet } = {}) {
  const arr = uniqLower(Array.isArray(list) ? list : []);
  if (!denySet || denySet.size === 0) return arr;
  return arr.filter((w) => !denySet.has(String(w || "").trim().toLowerCase()));
}

function removeOverlapKeepAntonyms(synonyms, antonyms) {
  const antSet = new Set((antonyms || []).map((w) => String(w || "").trim().toLowerCase()));
  const synClean = (synonyms || []).filter((w) => !antSet.has(String(w || "").trim().toLowerCase()));
  return { synonyms: synClean, antonyms: antonyms || [] };
}

// ✅ roots 語意（B 路線）：只允許「前綴派生詞族」
// 規則：w 必須以 baseLast 作為詞尾，且 w != baseLast
function filterPrefixDerivations(roots, baseLast) {
  const base = String(baseLast || "").trim().toLowerCase();
  if (!base) return [];

  const baseLen = base.length;

  return uniqLower(roots)
    .filter(isVerbLemmaLike)
    .filter((w) => {
      const t = String(w || "").trim().toLowerCase();
      if (!t) return false;
      if (t === base) return false; // 不允許 baseForm/lemma 自己
      if (!t.endsWith(base)) return false; // 必須是 * + base 的派生形式
      if (t.length <= baseLen + 1) return false; // 至少要有一點前綴（避免太短誤判）
      // 前綴部分需為字母（避免奇怪符號），例如 "übersehen" 的 "über"
      const prefix = t.slice(0, t.length - baseLen);
      if (!/^[a-zäöüß]+$/i.test(prefix)) return false;
      return true;
    });
}

// ✅ 新增：Nomen + baseForm != word 時，額外 lookup baseForm 的 gender → baseGender
async function resolveBaseGenderIfNeeded(dictEntry, explainLang) {
  if (!dictEntry) return null;

  if (dictEntry.partOfSpeech !== "Nomen") return null;

  const word = String(dictEntry.word || "").trim();
  const baseForm = String(dictEntry.baseForm || "").trim();
  if (!word || !baseForm) return null;

  if (word.toLowerCase() === baseForm.toLowerCase()) return null;

  try {
    const baseEntry = await lookupWord(baseForm, explainLang);
    if (
      baseEntry &&
      baseEntry.partOfSpeech === "Nomen" &&
      typeof baseEntry.gender === "string" &&
      baseEntry.gender.trim()
    ) {
      return baseEntry.gender.trim(); // der/die/das
    }
  } catch (e) {
    // 不猜，失敗就不提供 baseGender
  }

  return null;
}

/**
 * 中文功能說明：
 * - ✅ 2026-01-05：Step 3：Nomen 大寫保底（Production 排查）
 * - 背景：
 *   - 使用者輸入為小寫（例如 "buch"）時，上游/LLM 可能回傳 baseForm/plural/word 皆小寫
 *   - 德文規則：名詞（Nomen）字母大小寫屬於拼寫的一部分，不能交給輸入或 LLM 運氣
 * - 目標：
 *   - 若 partOfSpeech === "Nomen"：確保 word/baseForm/plural 的名詞本體首字母大寫
 * - 注意（保守）：
 *   - 不做詞形推測，不更動 gender，不更動例句
 *   - 若字串含冠詞（der/die/das + space），僅把冠詞後第一個字母大寫（例如 "das buch" → "das Buch"）
 *   - 若字串非字母開頭（例如數字/符號），不動
 */
function capitalizeGermanNounLike(input) {
  const raw = String(input || "").trim();
  if (!raw) return raw;

  // 支援「帶冠詞」字串：der/die/das + 空白 + noun...
  const m = raw.match(/^(der|die|das)\s+(.+)$/i);
  if (m && m[1] && m[2]) {
    const art = String(m[1] || "").trim();
    const rest = String(m[2] || "").trim();
    if (!rest) return raw;

    // 找到 rest 的第一個字母，將其大寫
    const first = rest.charAt(0);
    if (!first) return raw;

    // 僅在第一個字元是字母時才處理（避免符號/數字）
    if (!/^[A-Za-zÄÖÜäöüß]$/.test(first)) return raw;

    const cappedRest = first.toUpperCase() + rest.slice(1);
    // 冠詞在字典顯示通常保持小寫（das Buch），所以這裡輸出 art 用原字面（保守）
    return `${art.toLowerCase()} ${cappedRest}`;
  }

  // 一般名詞：直接把第一個字母大寫
  const first = raw.charAt(0);
  if (!first) return raw;
  if (!/^[A-Za-zÄÖÜäöüß]$/.test(first)) return raw;

  return first.toUpperCase() + raw.slice(1);
}

/**
 * 中文功能說明：
 * - ✅ 2026-01-05：Step 3：只在 Nomen 時套用 capitalization guard
 * - 只處理：word / baseForm / plural
 * - 會回傳 { patched, before, after, applied }
 */
function applyNounCapitalizationGuardIfNeeded(dictEntry) {
  if (!dictEntry || typeof dictEntry !== "object") {
    return { patched: dictEntry, applied: false, before: null, after: null };
  }

  const pos = String(dictEntry.partOfSpeech || "").trim();
  if (pos !== "Nomen") {
    return { patched: dictEntry, applied: false, before: null, after: null };
  }

  const before = {
    word: typeof dictEntry.word === "string" ? dictEntry.word : null,
    baseForm: typeof dictEntry.baseForm === "string" ? dictEntry.baseForm : null,
    plural: typeof dictEntry.plural === "string" ? dictEntry.plural : null,
  };

  const nextWord = (typeof dictEntry.word === "string") ? capitalizeGermanNounLike(dictEntry.word) : dictEntry.word;
  const nextBaseForm = (typeof dictEntry.baseForm === "string") ? capitalizeGermanNounLike(dictEntry.baseForm) : dictEntry.baseForm;
  const nextPlural = (typeof dictEntry.plural === "string") ? capitalizeGermanNounLike(dictEntry.plural) : dictEntry.plural;

  const changed =
    (typeof before.word === "string" && typeof nextWord === "string" && before.word !== nextWord) ||
    (typeof before.baseForm === "string" && typeof nextBaseForm === "string" && before.baseForm !== nextBaseForm) ||
    (typeof before.plural === "string" && typeof nextPlural === "string" && before.plural !== nextPlural);

  if (!changed) {
    return { patched: dictEntry, applied: false, before, after: before };
  }

  const patched = {
    ...dictEntry,
    word: nextWord,
    baseForm: nextBaseForm,
    plural: nextPlural,
  };

  const after = {
    word: typeof patched.word === "string" ? patched.word : null,
    baseForm: typeof patched.baseForm === "string" ? patched.baseForm : null,
    plural: typeof patched.plural === "string" ? patched.plural : null,
  };

  return { patched, applied: true, before, after };
}

/**
 * 中文功能說明：
 * - ✅ 2026-01-05：POS 可切換 scaffold（Step 1）
 * - 目的：
 *   - 後端先回傳「可切換」的資料結構（primaryPos / posKey / posOptions）
 *   - 先讓前端能看得到資料流（console/Network），但不做 UI 切換行為
 * - 規則（保守）：
 *   - canonicalPos 優先使用 dictEntry.canonicalPos，其次 dictEntry.partOfSpeech
 *   - posOptions：若 dictEntry.posOptions 已存在且為陣列 → 以它為準；否則退化為 [canonicalPos]
 *   - posKey：同 canonicalPos
 * - 注意：
 *   - 這一步不嘗試「推測」其他詞性（避免誤判），等 Step 2/後續再由 LLM 明確提供
 */
function derivePosSwitchScaffold(dictEntry) {
  const canonicalPos = String(
    (dictEntry && (dictEntry.canonicalPos || dictEntry.partOfSpeech)) || ""
  ).trim();

  const rawOptions = (dictEntry && Array.isArray(dictEntry.posOptions)) ? dictEntry.posOptions : null;

  const options = uniqLower(
    Array.isArray(rawOptions) && rawOptions.length > 0
      ? rawOptions
      : (canonicalPos ? [canonicalPos] : [])
  );

  const primaryPos = canonicalPos;
  const posKey = canonicalPos;

  return {
    primaryPos,
    posKey,
    posOptions: options,
    // ✅ 讓前端可直接用 posKey 當 history key（但 Step 1 先不改前端）
    // posKeyHint: canonicalPos,
  };
}

/**
 * 中文功能說明：
 * - 嘗試把「扁平欄位」解析成多釋義 items
 * - 支援常見格式：
 *   - ①...②...③...
 *   - 1. ... 2. ...
 *   - 1) ... 2) ...
 *   - 用分號分隔：A；B；C（僅在分割後 >1 時採用）
 */
function splitIntoSenseItems(rawText) {
  const s = String(rawText || "").trim();
  if (!s) return [];

  // ①②③ 形式
  if (/[①②③④⑤⑥⑦⑧⑨⑩]/.test(s)) {
    const marks = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"];
    const idxs = [];
    for (const m of marks) {
      const i = s.indexOf(m);
      if (i >= 0) idxs.push({ i, m });
    }
    idxs.sort((a, b) => a.i - b.i);

    const out = [];
    for (let k = 0; k < idxs.length; k++) {
      const start = idxs[k].i;
      const end = k + 1 < idxs.length ? idxs[k + 1].i : s.length;
      let seg = s.slice(start, end).trim();
      seg = seg.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "").trim();
      seg = seg.replace(/^[:：\-–—]\s*/, "").trim();
      if (seg) out.push(seg);
    }
    return out;
  }

  // 1. / 2. / 3. 形式
  if (/(^|\s)\d{1,2}\./.test(s)) {
    const re = /(^|\s)(\d{1,2})\.\s*/g;
    const matches = [];
    let m;
    while ((m = re.exec(s)) !== null) {
      matches.push({ idx: m.index + (m[1] ? m[1].length : 0), num: m[2] });
    }
    if (matches.length >= 2) {
      const out = [];
      for (let k = 0; k < matches.length; k++) {
        const start = matches[k].idx;
        const end = k + 1 < matches.length ? matches[k + 1].idx : s.length;
        let seg = s.slice(start, end).trim();
        seg = seg.replace(/^\d{1,2}\.\s*/, "").trim();
        seg = seg.replace(/^[:：\-–—]\s*/, "").trim();
        if (seg) out.push(seg);
      }
      return out;
    }
  }

  // 1) / 2) 形式
  if (/(^|\s)\d{1,2}\)/.test(s)) {
    const re = /(^|\s)(\d{1,2})\)\s*/g;
    const matches = [];
    let m;
    while ((m = re.exec(s)) !== null) {
      matches.push({ idx: m.index + (m[1] ? m[1].length : 0), num: m[2] });
    }
    if (matches.length >= 2) {
      const out = [];
      for (let k = 0; k < matches.length; k++) {
        const start = matches[k].idx;
        const end = k + 1 < matches.length ? matches[k + 1].idx : s.length;
        let seg = s.slice(start, end).trim();
        seg = seg.replace(/^\d{1,2}\)\s*/, "").trim();
        seg = seg.replace(/^[:：\-–—]\s*/, "").trim();
        if (seg) out.push(seg);
      }
      return out;
    }
  }

  // 分號切分（僅在 >1 時採用，避免把單一句子拆壞）
  const semi = s.split(/[；;]+/).map((x) => String(x || "").trim()).filter(Boolean);
  if (semi.length >= 2) return semi;

  return [];
}

/**
 * 中文功能說明：
 * - 2025-12-28：從 array 型欄位推導 senses[]
 * - 對齊策略：
 *   - 使用三個陣列中最大的長度 maxLen
 *   - gloss 優先：definition[idx] → definition_de_translation[idx] → ""
 *   - 保留 definition_de（若有）
 */
function deriveSensesFromArrayFields(dictEntry, explainLang) {
  if (!dictEntry || typeof dictEntry !== "object") return null;

  const zhArr = Array.isArray(dictEntry.definition) ? dictEntry.definition : null;
  const zhDeArr = Array.isArray(dictEntry.definition_de_translation) ? dictEntry.definition_de_translation : null;
  const deArr = Array.isArray(dictEntry.definition_de) ? dictEntry.definition_de : null;

  const maxLen = Math.max(zhArr?.length || 0, zhDeArr?.length || 0, deArr?.length || 0);

  if (!maxLen || maxLen <= 1) return null;

  const senses = [];
  for (let i = 0; i < maxLen; i++) {
    const zh = String(zhArr?.[i] ?? "").trim();
    const zhDe = String(zhDeArr?.[i] ?? "").trim();
    const de = String(deArr?.[i] ?? "").trim();

    senses.push({
      senseIndex: i,
      gloss: zh || zhDe || "",
      glossLang: String(explainLang || "").trim() || "zh-TW",
      definition_de: de,
      definition_de_translation: zhDe,
      _source: "arrays",
    });
  }

  console.log("[analyzeWord][deriveSenses][arrays]", {
    word: String(dictEntry.word || "").trim(),
    pos: String(dictEntry.partOfSpeech || "").trim(),
    sensesLen: senses.length,
    sample0: senses[0] ? String(senses[0].gloss || "").slice(0, 30) : "",
  });

  return senses;
}

/**
 * 中文功能說明：
 * - 若 dictionary 已經有 senses[]：不處理
 * - 若沒有 senses[]：
 *   - ① 先處理「array 型多釋義」（definition / definition_de / definition_de_translation）
 *   - ② 再處理「string 扁平格式」（①②③、1.2.、分號等）
 * - 每個 sense 會帶上 senseIndex，並提供 gloss / glossLang（給收藏寫入用）
 */
function deriveSensesIfMissing(dictEntry, explainLang) {
  if (!dictEntry || typeof dictEntry !== "object") return dictEntry;
  if (Array.isArray(dictEntry.senses) && dictEntry.senses.length > 0) return dictEntry;

  // ✅ 2025-12-28：array 型（你目前的 Schloss 就是這種）
  const sensesFromArrays = deriveSensesFromArrayFields(dictEntry, explainLang);
  if (Array.isArray(sensesFromArrays) && sensesFromArrays.length > 0) {
    return {
      ...dictEntry,
      senses: sensesFromArrays,
    };
  }

  const prefer =
    dictEntry.definition_de_translation ||
    dictEntry.definition ||
    "";

  const items = splitIntoSenseItems(prefer);

  if (!Array.isArray(items) || items.length === 0) {
    return dictEntry;
  }

  const senses = items.map((gloss, idx) => {
    const g = String(gloss || "").trim();
    return {
      senseIndex: idx,
      gloss: g,
      glossLang: String(explainLang || "").trim() || "zh-TW",
      definition_de_translation: g,
      _source: "flatText",
    };
  });

  // runtime console（只輸出必要資訊）
  console.log("[analyzeWord][deriveSenses][flatText]", {
    word: String(dictEntry.word || "").trim(),
    pos: String(dictEntry.partOfSpeech || "").trim(),
    fromKey: dictEntry.definition_de_translation ? "definition_de_translation" : (dictEntry.definition ? "definition" : "none"),
    sensesLen: senses.length,
    sample0: senses[0] ? String(senses[0].gloss || "").slice(0, 30) : "",
  });

  return {
    ...dictEntry,
    senses,
  };
}

async function analyzeWord(rawText, options = {}) {
  const startedAt = Date.now();
  INIT_STATUS.runtime.lastCalledAt = new Date().toISOString();

  const {
    explainLang = 'zh-TW',
    queryMode = 'word',

    // ✅ 2026-01-05：Step 2-2：前端可指定「目標詞性」來 re-query（預設為 null，不影響既有行為）
    targetPosKey = null,
  } = options;

  INIT_STATUS.runtime.lastExplainLang = explainLang;

  const input = (rawText || '').trim();
  const text = queryMode === 'word' ? tokenizeWord(input) : input;
  const length = text.length;

  INIT_STATUS.runtime.lastText = text;

  // ✅ 2026-01-05：Step 2-2 / Step 4：建立 lookupOptions（POS re-query + usage attribution）
  // - 以前只帶 targetPosKey，導致 userId 沒往下傳 → usageLogger 無法歸戶
  const lookupOptions = buildLookupWordOptions({
    ...options,
    targetPosKey,
  });
  INIT_STATUS.runtime.lastRequestedPosKey = lookupOptions ? (lookupOptions.targetPosKey || null) : null;
  INIT_STATUS.runtime.lastLookupOptions = lookupOptions || null;

  // ✅ 2026-01-05：Step 4：記錄 usage attribution runtime（Production 排查）
  try {
    INIT_STATUS.runtime.lastUsageUserId = lookupOptions && lookupOptions.userId ? lookupOptions.userId : null;
    INIT_STATUS.runtime.lastUsageEmail = lookupOptions && lookupOptions.email ? lookupOptions.email : null;
    INIT_STATUS.runtime.lastUsageRequestId = lookupOptions && lookupOptions.requestId ? lookupOptions.requestId : null;
    INIT_STATUS.runtime.lastUsageEndpoint = lookupOptions && lookupOptions.endpoint ? lookupOptions.endpoint : null;

    // 只印布林，不印敏感資訊
    console.log("[analyzeWord][usageAttribution]", {
      hasUserId: Boolean(lookupOptions && lookupOptions.userId),
      hasEmail: Boolean(lookupOptions && lookupOptions.email),
      hasRequestId: Boolean(lookupOptions && lookupOptions.requestId),
      hasEndpoint: Boolean(lookupOptions && lookupOptions.endpoint),
    });
  } catch (e) {
    // 不影響主流程
  }

  // ⚠️ 不影響既有邏輯：lookupWord 若不支援第三參數，JS 仍可安全呼叫
  const dictEntry = await lookupWord(text, explainLang, lookupOptions);

  // ✅ runtime console（Production 排查）
  if (lookupOptions && lookupOptions.targetPosKey) {
    console.log("[analyzeWord][posRequery][requested]", {
      text,
      explainLang,
      targetPosKey: lookupOptions.targetPosKey,
    });
  }

  // ✅ Step 0：多釋義推導（若上游沒有 senses[]）
  // - 目的：讓前端可使用 dictionary.senses[] 形成多筆 senseIndex，並供收藏寫入 gloss
  let dictEntryWithSenses = dictEntry;
  try {
    dictEntryWithSenses = deriveSensesIfMissing(dictEntry, explainLang);
    INIT_STATUS.runtime.lastDerivedSenses = Array.isArray(dictEntryWithSenses && dictEntryWithSenses.senses)
      ? dictEntryWithSenses.senses.length
      : 0;
  } catch (e) {
    // 不影響主流程
    INIT_STATUS.lastError = String(e && (e.stack || e.message) ? (e.stack || e.message) : e);
  }

  let finalMode = queryMode;
  if (
    dictEntryWithSenses &&
    dictEntryWithSenses.partOfSpeech === 'Verb' &&
    dictEntryWithSenses.reflexive === true
  ) {
    finalMode = 'word';
  }

  let patchedDict = dictEntryWithSenses;

  // ✅ Step A：只對名詞補 baseGender（不猜、用 lookup）
  try {
    if (dictEntryWithSenses && dictEntryWithSenses.partOfSpeech === "Nomen") {
      const baseGender = await resolveBaseGenderIfNeeded(dictEntryWithSenses, explainLang);
      if (baseGender) {
        patchedDict = {
          ...patchedDict,
          baseGender,
        };
      }
    }
  } catch (e) {
    // 不影響主流程
  }

  // ✅ Step A-2：Nomen 大寫保底（避免 buch → plural/baseForm/word 小寫回傳）
  // - 這一步只補「拼寫規則」，不推測詞形，不改 gender，不動例句
  try {
    const cap = applyNounCapitalizationGuardIfNeeded(patchedDict);
    if (cap && cap.applied) {
      INIT_STATUS.runtime.lastNounCapitalizationApplied = true;
      INIT_STATUS.runtime.lastNounCapitalizationBefore = cap.before;
      INIT_STATUS.runtime.lastNounCapitalizationAfter = cap.after;

      console.log("[analyzeWord][nounCapitalization][applied]", {
        text,
        explainLang,
        before: cap.before,
        after: cap.after,
      });

      patchedDict = cap.patched;
    } else {
      INIT_STATUS.runtime.lastNounCapitalizationApplied = false;
      INIT_STATUS.runtime.lastNounCapitalizationBefore = cap ? cap.before : null;
      INIT_STATUS.runtime.lastNounCapitalizationAfter = cap ? cap.after : null;
    }
  } catch (e) {
    // 不影響主流程
    INIT_STATUS.runtime.lastNounCapitalizationApplied = null;
  }

  try {
    if (dictEntryWithSenses && dictEntryWithSenses.partOfSpeech === "Verb") {
      const baseForm =
        (dictEntryWithSenses.baseForm || dictEntryWithSenses.word || dictEntryWithSenses.lemma || text || "").trim();

      const rec = dictEntryWithSenses.recommendations || {};

      // =========================
      // ✅ Step B：清理 synonyms / antonyms（避免同一組詞同時出現在兩邊、也避免出現自己）
      // =========================
      const lastToken = baseForm.split(/\s+/).slice(-1)[0] || baseForm;
      const denySet = new Set([
        String(lastToken || "").trim().toLowerCase(),
        String(baseForm || "").trim().toLowerCase(),
      ]);

      const rawSyn = Array.isArray(rec.synonyms) ? rec.synonyms : [];
      const rawAnt = Array.isArray(rec.antonyms) ? rec.antonyms : [];

      const cleanedSyn = normalizeWordList(rawSyn, { denySet });
      const cleanedAnt = normalizeWordList(rawAnt, { denySet });

      const noOverlap = removeOverlapKeepAntonyms(cleanedSyn, cleanedAnt);

      // =========================
      // ✅ roots（同字根）只依賴 LLM：前綴派生詞族（不使用 seeds）
      // =========================
      const rawRoots = Array.isArray(rec.roots) ? rec.roots : [];
      const cleanedRoots = uniqLower(rawRoots.filter(isVerbLemmaLike));

      const derivedRoots = filterPrefixDerivations(cleanedRoots, lastToken).slice(0, 6);

      patchedDict = {
        ...patchedDict,
        recommendations: {
          ...rec,
          synonyms: noOverlap.synonyms,
          antonyms: noOverlap.antonyms,
          roots: derivedRoots,
        },
      };
    }
  } catch (e) {
    // ⚠️ 這裡不能直接 patchedDict = dictEntry，否則會把 Step A 的 baseGender 覆蓋掉
    // 所以保留 patchedDict
  }

  // ✅ 2026-01-05：Step 1（POS 可切換 scaffold）— 插入，但不改既有主流程
  // - 只把 primaryPos / posKey / posOptions 掛到 dictionary 上
  // - 不做任何推測（避免誤判），預設就是 [canonicalPos]
  try {
    const scaffold = derivePosSwitchScaffold(patchedDict);
    if (scaffold && typeof scaffold === "object") {
      patchedDict = {
        ...patchedDict,
        // 若上游已經有 canonicalPos / posOptions，仍保留既有欄位；這裡只補缺
        primaryPos: typeof patchedDict.primaryPos === "string" && patchedDict.primaryPos.trim()
          ? patchedDict.primaryPos
          : scaffold.primaryPos,
        posKey: typeof patchedDict.posKey === "string" && patchedDict.posKey.trim()
          ? patchedDict.posKey
          : scaffold.posKey,
        posOptions: Array.isArray(patchedDict.posOptions) && patchedDict.posOptions.length > 0
          ? patchedDict.posOptions
          : scaffold.posOptions,
        canonicalPos: typeof patchedDict.canonicalPos === "string" && patchedDict.canonicalPos.trim()
          ? patchedDict.canonicalPos
          : scaffold.primaryPos,
      };

      INIT_STATUS.runtime.lastPrimaryPos = String(patchedDict.primaryPos || "").trim() || null;
      INIT_STATUS.runtime.lastPosKey = String(patchedDict.posKey || "").trim() || null;
      INIT_STATUS.runtime.lastPosOptions = Array.isArray(patchedDict.posOptions) ? patchedDict.posOptions : null;

      // ✅ Step 2-2：記錄最終生效的 posKey（Production 排查）
      INIT_STATUS.runtime.lastEffectivePosKey = String(patchedDict.posKey || "").trim() || null;

      console.log("[analyzeWord][posScaffold]", {
        word: String(patchedDict && (patchedDict.word || patchedDict.baseForm) || "").trim(),
        primaryPos: INIT_STATUS.runtime.lastPrimaryPos,
        posKey: INIT_STATUS.runtime.lastPosKey,
        posOptions: INIT_STATUS.runtime.lastPosOptions,
      });

      // ✅ Step 2-2：如果「請求 pos」與「實際回傳 pos」不同，印出提示（不影響主流程）
      if (lookupOptions && lookupOptions.targetPosKey && INIT_STATUS.runtime.lastEffectivePosKey && lookupOptions.targetPosKey !== INIT_STATUS.runtime.lastEffectivePosKey) {
        console.log("[analyzeWord][posRequery][mismatch]", {
          text,
          requested: lookupOptions.targetPosKey,
          effective: INIT_STATUS.runtime.lastEffectivePosKey,
        });
      }
    }
  } catch (e) {
    // 不影響主流程
  }

  const out = {
    mode: finalMode,
    text,
    length,
    isLong: length > 7,
    dictionary: patchedDict,
    meta: {
      queryMode: finalMode,
      tokenized: finalMode === 'word',
      // ✅ 2026-01-05：把 scaffold 核心也放到 meta（方便你在 Network 一眼看）
      primaryPos: patchedDict ? (patchedDict.primaryPos || patchedDict.canonicalPos || patchedDict.partOfSpeech || null) : null,
      posKey: patchedDict ? (patchedDict.posKey || patchedDict.canonicalPos || patchedDict.partOfSpeech || null) : null,
      posOptions: patchedDict ? (patchedDict.posOptions || null) : null,

      // ✅ 2026-01-05：Step 2-2：回傳本次 request 的 targetPosKey（方便你 debug）
      requestedPosKey: (lookupOptions && lookupOptions.targetPosKey) ? lookupOptions.targetPosKey : null,
      effectivePosKey: patchedDict ? (patchedDict.posKey || null) : null,
    },
  };

  INIT_STATUS.runtime.lastDurationMs = Date.now() - startedAt;
  console.log("[analyzeWord][runtime]", {
    text,
    explainLang,
    pos: patchedDict ? patchedDict.partOfSpeech : null,
    hasSenses: Boolean(patchedDict && Array.isArray(patchedDict.senses) && patchedDict.senses.length > 0),
    sensesLen: patchedDict && Array.isArray(patchedDict.senses) ? patchedDict.senses.length : 0,
    // ✅ 2026-01-05：POS scaffold runtime
    primaryPos: patchedDict ? (patchedDict.primaryPos || null) : null,
    posKey: patchedDict ? (patchedDict.posKey || null) : null,
    posOptionsLen: patchedDict && Array.isArray(patchedDict.posOptions) ? patchedDict.posOptions.length : 0,

    // ✅ 2026-01-05：Step 2-2：POS re-query runtime
    requestedPosKey: INIT_STATUS.runtime.lastRequestedPosKey,
    effectivePosKey: INIT_STATUS.runtime.lastEffectivePosKey,

    // ✅ 2026-01-05：Step 3：Nomen capitalization runtime
    nounCapitalizationApplied: INIT_STATUS.runtime.lastNounCapitalizationApplied,

    // ✅ 2026-01-05：Step 4：usage attribution runtime（只印布林）
    hasUserId: Boolean(lookupOptions && lookupOptions.userId),
    hasRequestId: Boolean(lookupOptions && lookupOptions.requestId),

    durationMs: INIT_STATUS.runtime.lastDurationMs,
  });

  return out;
}

module.exports = { analyzeWord };

// backend/src/services/analyzeWord.js
