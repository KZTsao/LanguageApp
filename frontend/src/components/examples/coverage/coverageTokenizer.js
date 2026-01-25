// frontend/src/components/examples/coverage/coverageTokenizer.js
// Phase B-1 (coverage-once): tokenize + normalization utilities (German-friendly)

export function normalizeText(input = "") {
  return String(input || "")
    .toLowerCase()
    // remove common punctuation, keep umlauts/ß
    .replace(/[.,!?;:"'()\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeRef(refText = "") {
  const norm = normalizeText(refText);
  if (!norm) return [];
  const parts = norm.split(" ");
  return parts.map((w, idx) => ({ idx, raw: w, norm: w }));
}

export function tokenizeHyp(hypText = "") {
  const norm = normalizeText(hypText);
  if (!norm) return [];
  return norm.split(" ");
}

// frontend/src/components/examples/coverage/coverageTokenizer.js
