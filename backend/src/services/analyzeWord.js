// backend/src/services/analyzeWord.js
const { tokenizeWord } = require('../core/tokenizer');
const { lookupWord } = require('../clients/dictionaryClient');

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

async function analyzeWord(rawText, options = {}) {
  const {
    explainLang = 'zh-TW',
    queryMode = 'word',
  } = options;

  const input = (rawText || '').trim();
  const text = queryMode === 'word' ? tokenizeWord(input) : input;
  const length = text.length;

  const dictEntry = await lookupWord(text, explainLang);

  let finalMode = queryMode;
  if (
    dictEntry &&
    dictEntry.partOfSpeech === 'Verb' &&
    dictEntry.reflexive === true
  ) {
    finalMode = 'word';
  }

  let patchedDict = dictEntry;

  // ✅ Step A：只對名詞補 baseGender（不猜、用 lookup）
  try {
    if (dictEntry && dictEntry.partOfSpeech === "Nomen") {
      const baseGender = await resolveBaseGenderIfNeeded(dictEntry, explainLang);
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

  try {
    if (dictEntry && dictEntry.partOfSpeech === "Verb") {
      const baseForm =
        (dictEntry.baseForm || dictEntry.word || dictEntry.lemma || text || "").trim();

      const rec = dictEntry.recommendations || {};

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

  return {
    mode: finalMode,
    text,
    length,
    isLong: length > 7,
    dictionary: patchedDict,
    meta: {
      queryMode: finalMode,
      tokenized: finalMode === 'word',
    },
  };
}

module.exports = { analyzeWord };
// backend/src/services/analyzeWord.js
