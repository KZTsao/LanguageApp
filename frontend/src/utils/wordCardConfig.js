// frontend/src/utils/wordCardConfig.js
// 統一管理 WordCard 相關的「設定型資料」與詞性處理工具

// 冠詞顏色（對應 CSS 變數）
export const genderColors = {
  der: "var(--article-der)",
  die: "var(--article-die)",
  das: "var(--article-das)",
};

// 複數的「die」顏色
export const pluralArticleColor = "var(--article-plural)";

// 詞性 → 本地語言名稱（預設為繁體中文）
// 之後如果要支援其他 UI 語言，可以在 uiText 裡覆蓋這個 map
export const defaultPosLocalNameMap = {
  Nomen: "名詞",
  Verb: "動詞",
  Adjektiv: "形容詞",
  Adverb: "副詞",
  Artikel: "冠詞",
  Pronomen: "代名詞",
  Präposition: "介系詞",
  Konjunktion: "連接詞",
  Numerale: "數詞",
  Interjektion: "感歎詞",
  Partikel: "語氣詞／功能小詞",
  Hilfsverb: "助動詞",
  Modalverb: "情態動詞",
  Reflexivpronomen: "反身代名詞",
  Possessivpronomen: "所有格代名詞",
};

// 後端 / 模型可能回傳的「各種寫法」→ 正規化成 canonical 詞性
// 注意：這裡只處理「key」，實際顯示時再由 posLocalNameMap 補上本地語言
export const posKeyMap = {
  noun: "Nomen",
  substantiv: "Nomen",
  nomen: "Nomen",

  verb: "Verb",
  verben: "Verb",

  adjective: "Adjektiv",
  adjektiv: "Adjektiv",

  adverb: "Adverb",

  artikel: "Artikel",

  pronomen: "Pronomen",
  pronoun: "Pronomen",

  präposition: "Präposition",
  preposition: "Präposition",

  konjunktion: "Konjunktion",

  numerale: "Numerale",
  zahlwort: "Numerale",

  interjektion: "Interjektion",

  partikel: "Partikel",

  hilfsverb: "Hilfsverb",

  modalverb: "Modalverb",
};

/**
 * 將輸入的 partOfSpeech 轉成 canonical 德文詞性標籤
 * - 例如 "noun" / "Nomen" / "名詞" → "Nomen"
 * - 找不到就原樣回傳（給你保留原始資訊），沒有就回空字串
 */
export function normalizePos(rawPos) {
  if (!rawPos) return "";

  const raw = String(rawPos).trim();
  if (!raw) return "";

  const key = raw.toLowerCase();

  if (posKeyMap[key]) {
    return posKeyMap[key];
  }

  // 如果剛好本身就是 "Nomen" / "Verb" 等 canonical 形式，就直接用
  return raw;
}

// ① ② ③…（圈號）
// 之後如果你不喜歡圈號，只要在其他地方改成用 1. / 2. / 3. 就好
export const circledNumbers = [
  "①",
  "②",
  "③",
  "④",
  "⑤",
  "⑥",
  "⑦",
  "⑧",
  "⑨",
  "⑩",
];

/**
 * 多義編號顯示：
 * - 0 → ①
 * - 1 → ②
 * - 超過 10 個就改用「數字 + .」，例如 11 → "11."
 */
export function getDefinitionIndexLabel(index) {
  if (index < circledNumbers.length) {
    return circledNumbers[index];
  }
  const n = Number(index) + 1;
  return Number.isNaN(n) ? "" : `${n}.`;
}
