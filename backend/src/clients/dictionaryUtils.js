/**
 * Groq 出錯或無法解析時的安全預設值
 */
function fallback(word) {
  const w = String(word || '').trim();
  return {
    word: w,
    language: 'de',
    partOfSpeech: 'unknown',
    gender: '',
    plural: '',
    baseForm: w,

    // 動詞相關欄位（預設為空）
    verbSubtype: '',
    separable: false,
    reflexive: false,
    auxiliary: '',
    conjugation: {
      praesens: {
        ich: '',
        du: '',
        er_sie_es: '',
        wir: '',
        ihr: '',
        sie_Sie: '',
      },
      praeteritum: {
        ich: '',
        du: '',
        er_sie_es: '',
        wir: '',
        ihr: '',
        sie_Sie: '',
      },
      perfekt: {
        ich: '',
        du: '',
        er_sie_es: '',
        wir: '',
        ihr: '',
        sie_Sie: '',
      },
    },
    valenz: [],

    definition_de: '',
    definition_de_translation: '',
    definition: 'AI 暫時沒有提供定義（fallback）。',
    example: '',
    tenses: {
      present: '',
      preterite: '',
      perfect: '',
    },
    comparison: {
      positive: '',
      comparative: '',
      superlative: '',
    },
    notes: '',
  };
}

/**
 * 將 explainLang 映射成給模型看的目標語言名稱
 */
function mapExplainLang(explainLang) {
  switch (explainLang) {
    case 'en':
      return 'English';
    case 'zh-CN':
      return 'Simplified Chinese';
    case 'ar':
      return 'Arabic';
    case 'ja':
      return 'Japanese';
    case 'ko':
      return 'Korean';
    case 'zh-TW':
    default:
      return 'Traditional Chinese';
  }
}

/**
 * 詞性正規化：收斂成幾個主要大類
 */
function normalizePartOfSpeech(posRaw) {
  if (!posRaw) return 'unknown';
  const s = String(posRaw).trim().toLowerCase();

  if (['noun', 'substantiv', 'nomen', '名詞', '名词'].includes(s)) {
    return 'Nomen';
  }
  if (['verb', 'verben', '動詞', '动词'].includes(s)) {
    return 'Verb';
  }
  if (['adjective', 'adjektiv', '形容詞', '形容词'].includes(s)) {
    return 'Adjektiv';
  }
  if (['adverb', '副詞', '副词'].includes(s)) {
    return 'Adverb';
  }
  if (['pronoun', 'pronomen', '代名詞', '代词'].includes(s)) {
    return 'Pronomen';
  }
  if (['preposition', 'präposition', '介詞', '介词'].includes(s)) {
    return 'Präposition';
  }

  return 'unknown';
}

/**
 * 性別正規化，只保留 der / die / das
 */
function normalizeGender(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';

  if (['der', 'die', 'das'].includes(s)) return s;

  if (['m', 'masculine', 'maskulin', 'männlich', 'm.'].includes(s)) return 'der';
  if (['f', 'feminin', 'weiblich', 'f.'].includes(s)) return 'die';
  if (['n', 'neutrum', 'sächlich', 'neuter', 'n.'].includes(s)) return 'das';

  if (s.startsWith('der ')) return 'der';
  if (s.startsWith('die ')) return 'die';
  if (s.startsWith('das ')) return 'das';

  return '';
}

/**
 * 🔧 根據 baseForm 推斷是否為可分動詞（模型保險用）
 */
function inferSeparableFromBaseForm(baseForm) {
  if (!baseForm || typeof baseForm !== 'string') return false;

  const prefixes = [
    'ab', 'an', 'auf', 'aus', 'bei', 'ein',
    'fest', 'fort', 'her', 'hin', 'los',
    'mit', 'nach', 'vor', 'weg', 'weiter',
    'zurück', 'zusammen'
  ];

  return prefixes.some((p) => baseForm.startsWith(p));
}

/**
 * 清洗／正規化 Groq 回傳的字典資料
 */
function normalizeDictionaryResult(parsed, word) {
  const safeWord = String(word || '').trim();

  let definitionField = parsed.definition;
  if (Array.isArray(definitionField)) {
    definitionField = definitionField.map((v) =>
      typeof v === 'string' ? v.trim() : ''
    );
  } else if (typeof definitionField === 'string') {
    definitionField = definitionField.trim();
  } else if (definitionField == null) {
    definitionField = '';
  }

  const defDe = parsed.definition_de;
  let definitionDeField = defDe;
  if (Array.isArray(defDe)) {
    definitionDeField = defDe.map((v) =>
      typeof v === 'string' ? v.trim() : ''
    );
  } else if (typeof defDe === 'string') {
    definitionDeField = defDe.trim();
  } else {
    definitionDeField = '';
  }

  const defDeTrans = parsed.definition_de_translation;
  let definitionDeTransField = defDeTrans;
  if (Array.isArray(defDeTrans)) {
    definitionDeTransField = defDeTrans.map((v) =>
      typeof v === 'string' ? v.trim() : ''
    );
  } else if (typeof defDeTrans === 'string') {
    definitionDeTransField = defDeTrans.trim();
  } else {
    definitionDeTransField = '';
  }

  const verbSubtype = parsed.verbSubtype || '';

  let separable =
    typeof parsed.separable === 'boolean' ? parsed.separable : false;

  if (!separable && inferSeparableFromBaseForm(parsed.baseForm || safeWord)) {
    separable = true;
  }

  const reflexive =
    typeof parsed.reflexive === 'boolean' ? parsed.reflexive : false;

  const auxiliary = parsed.auxiliary || '';

  const defaultConjugation = {
    praesens: {
      ich: '',
      du: '',
      er_sie_es: '',
      wir: '',
      ihr: '',
      sie_Sie: '',
    },
    praeteritum: {
      ich: '',
      du: '',
      er_sie_es: '',
      wir: '',
      ihr: '',
      sie_Sie: '',
    },
    perfekt: {
      ich: '',
      du: '',
      er_sie_es: '',
      wir: '',
      ihr: '',
      sie_Sie: '',
    },
  };

  const conjugation =
    parsed.conjugation && typeof parsed.conjugation === 'object'
      ? parsed.conjugation
      : defaultConjugation;

  // ✅ 關鍵修正：清掉空 valenz placeholder
  let valenz = [];
  if (Array.isArray(parsed.valenz)) {
    valenz = parsed.valenz.filter((v) => {
      if (!v || typeof v !== 'object') return false;
      const hasPrep = v.prep != null && String(v.prep).trim() !== '';
      const hasKasus = v.kasus && String(v.kasus).trim() !== '';
      const hasNote = v.note && String(v.note).trim() !== '';
      return hasPrep || hasKasus || hasNote;
    });
  }

  const result = {
    word: parsed.word || safeWord,
    language: parsed.language || 'de',
    partOfSpeech: normalizePartOfSpeech(parsed.partOfSpeech),
    gender: parsed.gender || '',
    plural: parsed.plural || '',
    baseForm: parsed.baseForm || safeWord,

    verbSubtype,
    separable,
    reflexive,
    auxiliary,
    conjugation,
    valenz,

    definition_de: definitionDeField || '',
    definition_de_translation: definitionDeTransField || '',
    definition: definitionField || '',
    example: parsed.example || '',
    tenses: parsed.tenses || {
      present: '',
      preterite: '',
      perfect: '',
    },
    comparison: parsed.comparison || {
      positive: '',
      comparative: '',
      superlative: '',
    },
    notes: parsed.notes || '',
  };

  const g = normalizeGender(result.gender);
  result.gender = g;

  if (result.notes && typeof result.notes === 'string') {
    let notes = result.notes;
    const unsurePattern =
      /(可能|大概|也許|也许|probabl|maybe|vielleicht|ربما)/i;
    if (unsurePattern.test(notes)) {
      notes = '';
    }
    result.notes = notes || '';
  }

  return result;
}

module.exports = {
  fallback,
  mapExplainLang,
  normalizePartOfSpeech,
  normalizeGender,
  normalizeDictionaryResult,
};
