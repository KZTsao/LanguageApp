// backend/src/clients/dictionaryUtils.js

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
 * 清洗／正規化 Groq 回傳的字典資料
 * - definition / definition_de / definition_de_translation 支援字串或陣列
 * - 修正詞性、性別
 * - 清 notes 裡面不確定的語氣
 */
function normalizeDictionaryResult(parsed, word) {
  const safeWord = String(word || '').trim();

  // definition: 允許字串或陣列
  let definitionField = parsed.definition;
  if (Array.isArray(definitionField)) {
    // 保留陣列，交給前端決定是否條列顯示
    definitionField = definitionField.map((v) =>
      typeof v === 'string' ? v.trim() : ''
    );
  } else if (typeof definitionField === 'string') {
    definitionField = definitionField.trim();
  } else if (definitionField == null) {
    definitionField = '';
  }

  // definition_de
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

  // definition_de_translation
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

  const result = {
    word: parsed.word || safeWord,
    language: parsed.language || 'de',
    partOfSpeech: normalizePartOfSpeech(parsed.partOfSpeech),
    gender: parsed.gender || '',
    plural: parsed.plural || '',
    baseForm: parsed.baseForm || safeWord,
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

  // 限制 gender 為 der/die/das
  const g = normalizeGender(result.gender);
  result.gender = g;

  // 清洗 notes：移除「可能、大概、也許」等等不確定語氣，
  // 並且避免和 gender 互相矛盾的描述
  if (result.notes && typeof result.notes === 'string') {
    let notes = result.notes;
    const unsurePattern =
      /(可能|大概|也許|也许|probabl|maybe|vielleicht|ربما)/i;
    if (unsurePattern.test(notes)) {
      notes = '';
    }

    if (notes && result.gender) {
      const containsNeuter = /(中性|neutrum|neuter)/i.test(notes);
      const containsFeminine = /(陰性|阴性|feminin)/i.test(notes);
      const containsMasculine = /(陽性|阳性|maskulin)/i.test(notes);

      if (result.gender === 'die' && (containsNeuter || containsMasculine)) {
        notes = '';
      }
      if (result.gender === 'der' && (containsNeuter || containsFeminine)) {
        notes = '';
      }
      if (result.gender === 'das' && (containsFeminine || containsMasculine)) {
        notes = '';
      }
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
