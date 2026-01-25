// frontend/src/components/examples/coverage/coverageAlign.js
// Phase B-1 (coverage-once): align reference tokens with ASR words (顺序扫描，工程量最低)

export function normalizeAsrWords(words) {
  if (!Array.isArray(words)) return [];
  return words
    .map((x) => {
      const w = (x && x.w ? String(x.w) : "").trim();
      if (!w) return null;
      const confidence =
        x && typeof x.confidence === "number" ? x.confidence : null;
      return { w: w.toLowerCase(), confidence };
    })
    .filter(Boolean);
}

// 返回 Map(refIdx -> confidence|null)
export function alignRefTokensWithAsrWords(refTokens, asrWords) {
  const out = new Map();
  if (!Array.isArray(refTokens) || refTokens.length === 0) return out;

  const hyp = normalizeAsrWords(asrWords);
  if (hyp.length === 0) return out;

  let h = 0;
  for (let r = 0; r < refTokens.length; r++) {
    const ref = (refTokens[r] && refTokens[r].norm) || "";
    if (!ref) continue;

    while (h < hyp.length) {
      if (hyp[h].w === ref) {
        out.set(r, hyp[h].confidence);
        h++;
        break;
      }
      h++;
    }
  }
  return out;
}

// frontend/src/components/examples/coverage/coverageAlign.js
