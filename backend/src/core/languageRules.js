const { tokenizeSentence } = require('./tokenizer');

// 粗略的時態判斷（先保留）
function detectTense(text) {
  const t = text.toLowerCase();

  if (/\bwill\b/.test(t)) {
    return 'future-like';
  }
  if (/\bhave\b.*\b(v|V)3\b/.test(t)) {
    return 'perfect-like';
  }
  if (/\bwas\b|\bwere\b|\bed\b\b/.test(t)) {
    return 'past-like';
  }
  return 'present-or-unknown';
}

// 冠詞列表（用來判斷單字/句子）
const ARTICLES = [
  // 英文
  'a', 'an', 'the',
  // 德文常見
  'der', 'die', 'das',
  'ein', 'eine', 'einen', 'einem', 'einer',
  'den', 'dem', 'des'
];

// 自動判斷是單字還是句子
function detectMode(text) {
  const tokens = tokenizeSentence(text.toLowerCase());
  const remaining = tokens.filter(t => !ARTICLES.includes(t));

  if (remaining.length <= 1) {
    return 'word';
  }
  return 'sentence';
}

// ➕ 新功能：猜測語言（非常簡單的版本）
function guessLanguage(text) {
  const t = text.toLowerCase();

  // 有德文變音就優先判成德文
  if (/[äöüß]/.test(t)) {
    return 'de';
  }

  // 看看是否有德文的常見單字
  const germanHints = ['der ', 'die ', 'das ', 'und ', 'nicht ', 'ich ', 'du '];
  if (germanHints.some(h => t.includes(h))) {
    return 'de';
  }

  // 否則先當英文（之後要再細分再改）
  return 'en';
}

module.exports = {
  detectTense,
  detectMode,
  guessLanguage,
};
