// frontend/src/utils/nounCaseTables.js
// 德語名詞格變化：定冠詞 / 不定冠詞 / 所有格代名詞（可選人稱）
// 目前只處理「窄表」：四格 × 一個性別（m/f/n/pl）

// 格位順序（給 UI 用）
export const CASE_KEYS = ["Nom", "Akk", "Dat", "Gen"];

// 1. 定冠詞（bestimmter Artikel）
export const DEFINITE_ARTICLES = {
  m: {
    Nom: "der",
    Akk: "den",
    Dat: "dem",
    Gen: "des",
  },
  f: {
    Nom: "die",
    Akk: "die",
    Dat: "der",
    Gen: "der",
  },
  n: {
    Nom: "das",
    Akk: "das",
    Dat: "dem",
    Gen: "des",
  },
  pl: {
    Nom: "die",
    Akk: "die",
    Dat: "den",
    Gen: "der",
  },
};

// 2. 不定冠詞（unbestimmter Artikel）
// Plural 沒有不定冠詞，用 "—" 佔位，方便 UI 顯示。
export const INDEFINITE_ARTICLES = {
  m: {
    Nom: "ein",
    Akk: "einen",
    Dat: "einem",
    Gen: "eines",
  },
  f: {
    Nom: "eine",
    Akk: "eine",
    Dat: "einer",
    Gen: "einer",
  },
  n: {
    Nom: "ein",
    Akk: "ein",
    Dat: "einem",
    Gen: "eines",
  },
  pl: {
    Nom: "—",
    Akk: "—",
    Dat: "—",
    Gen: "—",
  },
};

// 3. 所有格代名詞「詞幹」：ich / du / er ... 對應 mein-/dein-/sein- 等
// label 先用中文 + 原始詞幹，之後可以接 uiText 做多國語。
export const POSSESSIVE_STEMS = {
  ich: { key: "ich", label: "我 (mein-)", base: "mein" },
  du: { key: "du", label: "你 (dein-)", base: "dein" },
  er: { key: "er", label: "他 (sein-)", base: "sein" },
  sie: { key: "sie", label: "她 (ihr-)", base: "ihr" },
  es: { key: "es", label: "它 (sein-)", base: "sein" },
  wir: { key: "wir", label: "我們 (unser-)", base: "unser" },
  ihr: { key: "ihr", label: "你們 (euer-)", base: "euer" },
  sie_pl: { key: "sie_pl", label: "他們 (ihr-)", base: "ihr" },
  Sie: { key: "Sie", label: "您 (Ihr-)", base: "Ihr" },
};

// 4. 所有格代名詞的「結尾」：跟 ein-/kein- 同一套規則
export const POSSESSIVE_ENDINGS = {
  m: { Nom: "", Akk: "en", Dat: "em", Gen: "es" },
  f: { Nom: "e", Akk: "e", Dat: "er", Gen: "er" },
  n: { Nom: "", Akk: "", Dat: "em", Gen: "es" },
  pl: { Nom: "e", Akk: "e", Dat: "en", Gen: "er" },
};

// 5. euer 特例處理：有結尾時會縮成 eur- + 結尾
export function buildPossessiveForm(base, ending) {
  if (!ending) return base;
  if (base === "euer") return "eur" + ending;
  return base + ending;
}

// 6. 取得某「詞幹 + 性別」的完整四格所有格變化表
export function getPossessiveTable(base, gender) {
  const endings = POSSESSIVE_ENDINGS[gender];
  if (!endings) return { Nom: "", Akk: "", Dat: "", Gen: "" };

  return {
    Nom: buildPossessiveForm(base, endings.Nom),
    Akk: buildPossessiveForm(base, endings.Akk),
    Dat: buildPossessiveForm(base, endings.Dat),
    Gen: buildPossessiveForm(base, endings.Gen),
  };
}

// 7. 方便用的一層封裝：給「性別 + 人稱 key」直接拿窄表三欄資料
export function getMiniCaseTableForGender(gender, personKey) {
  const person = POSSESSIVE_STEMS[personKey] || POSSESSIVE_STEMS.ich;
  const possTable = getPossessiveTable(person.base, gender);

  const definite = DEFINITE_ARTICLES[gender] || {};
  const indefinite = INDEFINITE_ARTICLES[gender] || {};

  return CASE_KEYS.map((caseKey) => ({
    caseKey,
    definite: definite[caseKey] || "",
    indefinite: indefinite[caseKey] || "",
    possessive: possTable[caseKey] || "",
  }));
}
