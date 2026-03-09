// frontend/src/utils/declension/tables/articles.js
// Feature-driven declension tables for articles.

// features:
// - caseKey: N/A/D/G
// - numberKey: S/P
// - genderKey: m/f/n/p (p used for plural column)

export const DEF_ARTICLE_BY_FEATURES = {
  N: { m: "der", f: "die", n: "das", p: "die" },
  A: { m: "den", f: "die", n: "das", p: "die" },
  D: { m: "dem", f: "der", n: "dem", p: "den" },
  G: { m: "des", f: "der", n: "des", p: "der" },
};

// Indefinite article: no plural.
export const INDEF_ARTICLE_BY_FEATURES = {
  N: { m: "ein", f: "eine", n: "ein" },
  A: { m: "einen", f: "eine", n: "ein" },
  D: { m: "einem", f: "einer", n: "einem" },
  G: { m: "eines", f: "einer", n: "eines" },
};

function push(map, form, feat) {
  if (!form) return;
  const f = (form || "").toLowerCase();
  if (!map[f]) map[f] = [];
  map[f].push(feat);
}

export function buildReverseIndex(table, { hasPlural }) {
  const idx = {};
  for (const caseKey of Object.keys(table)) {
    const row = table[caseKey];
    for (const genderKey of Object.keys(row)) {
      const form = row[genderKey];
      if (!form) continue;
      if (genderKey === "p" && !hasPlural) continue;
      const numberKey = genderKey === "p" ? "P" : "S";
      push(idx, form, { caseKey, genderKey, numberKey });
    }
  }
  return idx;
}

export const DEF_ARTICLE_REVERSE = buildReverseIndex(DEF_ARTICLE_BY_FEATURES, { hasPlural: true });
export const INDEF_ARTICLE_REVERSE = buildReverseIndex(INDEF_ARTICLE_BY_FEATURES, { hasPlural: false });
