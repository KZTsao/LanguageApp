const { tokenizeWord } = require('../core/tokenizer');
const { lookupWord } = require('../clients/dictionaryClient');

async function analyzeWord(rawText, options = {}) {
  const {
    explainLang = 'zh-TW',
    queryMode = 'word', // 'word' | 'phrase'
  } = options;

  const input = (rawText || '').trim();

  // 單字才 tokenize；片語 / 慣用語保留原樣
  const text =
    queryMode === 'word'
      ? tokenizeWord(input)
      : input;

  const length = text.length;

  const dictEntry = await lookupWord(text, explainLang);

  // ⭐ 新增：反身動詞不是片語
  let finalMode = queryMode;
  if (
    dictEntry &&
    dictEntry.partOfSpeech === 'Verb' &&
    dictEntry.reflexive === true
  ) {
    finalMode = 'word';
  }

  return {
    mode: finalMode,
    text,
    length,
    isLong: length > 7,
    dictionary: dictEntry,

    meta: {
      queryMode: finalMode,
      tokenized: finalMode === 'word',
    },
  };
}

module.exports = { analyzeWord };
