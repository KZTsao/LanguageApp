const { tokenizeWord } = require('../core/tokenizer');
const { lookupWord } = require('../clients/dictionaryClient');

async function analyzeWord(rawText, options = {}) {
  const { explainLang = 'zh-TW' } = options;

  const word = tokenizeWord(rawText);
  const length = word.length;

  const dictEntry = await lookupWord(word, explainLang);

  return {
    mode: 'word',
    text: word,
    length,
    isLong: length > 7,
    dictionary: dictEntry,
  };
}

module.exports = { analyzeWord };
