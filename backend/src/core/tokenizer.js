// 很簡單的 tokenizer，之後你可以慢慢變強

function normalize(text) {
  return text.trim();
}

function tokenizeWord(text) {
  return normalize(text);
}

function tokenizeSentence(text) {
  return normalize(text)
    .split(/\s+/)            // 先用空白切
    .map(t => t.replace(/[.,!?;:()"“”]/g, '')) // 去除常見標點
    .filter(Boolean);
}

module.exports = {
  normalize,
  tokenizeWord,
  tokenizeSentence,
};
