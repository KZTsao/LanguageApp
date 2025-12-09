// backend/src/core/dictionaryNormalizer.js

/**
 * 當 Groq 發生錯誤或無法解析時使用的安全預設值
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
 * 將各種 partOfSpeech 字串正規化成標準德文詞性標籤
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
  if (['conjunction', 'konjunktion', '連接詞', '连词'].includes(s)) {
    return 'Konjunktion';
  }
  if (['article', 'artikel', '冠詞', '冠词'].includes(s)) {
    return 'Artikel';
  }

  return 'unknown';
}

/**
 * 清洗與補強模型輸出的 JSON，確保前端拿到穩定結構
 * - definition / definition_de / definition_de_translation 都可能是「字串或陣列」
 * - 這裡只做基本 trim ＋ fallback ＋幾個安全檢查
 */
function normalizeDictionaryResult(parsed, word) {
  const safeWord = String(word || '').trim();

  // 允許 definition 可能是字串或陣列
  let definitionField = parsed.definition;
  if (Array.isArray(definitionField)) {
    // 保留陣列，交由前端決定要不要條列顯示
  } else if (typeof definitionField === 'string') {
    definitionField = definitionField.trim();
  } else if (definitionField == null) {
    definitionField = '';
  }

  // definition_de / definition_de_translation 同樣允許字串或陣列，這裡只做基本 trim
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
  const g = String(result.gender || '').trim();
  if (!['der', 'die', 'das'].includes(g)) {
    result.gender = '';
  } else {
    result.gender = g;
  }

  // 清洗 notes，移除「可能、大概、也許」等不確定語氣
  if (result.notes && typeof result.notes === 'string') {
    let notes = result.notes;
    const unsurePattern =
      /(可能|大概|也許|也许|probabl|maybe|vielleicht|ربما)/i;
    if (unsurePattern.test(notes)) notes = '';

    if (notes && result.gender) {
      const containsNeuter = /(中性|neutrum|neuter)/i.test(notes);
      const containsFeminine = /(陰性|阴性|feminin)/i.test(notes);
      const containsMasculine = /(陽性|阳性|maskulin)/i.test(notes);

      if (result.gender === 'die' && (containsNeuter || containsMasculine))
        notes = '';
      if (result.gender === 'der' && (containsNeuter || containsFeminine))
        notes = '';
      if (result.gender === 'das' && (containsFeminine || containsMasculine))
        notes = '';
    }

    result.notes = notes || '';
  }

  return result;
}

module.exports = {
  fallback,
  normalizePartOfSpeech,
  normalizeDictionaryResult,
};
