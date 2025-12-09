const { tokenizeSentence } = require('../core/tokenizer');
const { detectTense } = require('../core/languageRules');
const { analyzeWord } = require('./analyzeWord');
const { analyzeGrammar } = require('./analyzeGrammar');

async function analyzeSentence(text, options = {}) {
  const { explainLang = 'zh-TW' } = options;

  const tokens = tokenizeSentence(text);
  const wordCount = tokens.length;
  const tense = detectTense(text);

  const wordsAnalysis = [];
  for (const token of tokens) {
    const wa = await analyzeWord(token, { explainLang });
    wordsAnalysis.push(wa);
  }

  const grammar = await analyzeGrammar(text, explainLang);

  return {
    mode: 'sentence',
    text,
    wordCount,
    tense,
    words: wordsAnalysis,
    grammar,
  };
}

module.exports = { analyzeSentence };
