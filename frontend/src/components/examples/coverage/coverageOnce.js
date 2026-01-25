// frontend/src/components/examples/coverage/coverageOnce.js (file start)
// Phase B-1: build token colors (hit_high / hit_low / miss) from ASR result

import { tokenizeRef } from "./coverageTokenizer";
import { alignRefTokensWithAsrWords } from "./coverageAlign";

export const DEFAULT_HIGH_CONF_THRESHOLD = 0.85;

// ============================================================
// ✅ 2026-01-24: Resync alignment (prevent "one miss -> all miss")
// - Keep legacy alignRefTokensWithAsrWords(...) as the primary baseline
// - If legacy alignment looks like it "fell off" (long tail misses), fallback to DP resync alignment
// - This is additive: no legacy logic removed
// ============================================================
//
// ✅ 2026-01-24 (Proto decision): NO ALIGNMENT by default
// - User feedback: "I don't need alignment; array-contains is enough."
// - We keep ALL alignment logic for future Phase 2+ scoring,
//   but the default mode now uses set/contains matching.
// - This avoids "alignment key mismatch" issues and is easier to explain/debug.
//
// How it works in contains mode:
// 1) Normalize ASR words into a Map(wordNorm -> bestConfidence)
// 2) For each refToken, normalize its text and check if it exists in the map
// 3) If exists -> hit_high/hit_low by confidence; else -> miss
// ============================================================

function __norm(s) {
  try {
    return (s || "")
      .toString()
      .trim()
      .toLowerCase()
      // keep German chars, remove obvious punctuation
      .replace(/[.,!?;:()\[\]{}"“”'’]/g, "")
      .replace(/\s+/g, " ");
  } catch (e) {
    return "";
  }
}

function __getTokenText(t) {
  if (!t) return "";
  // tokenizeRef(...) structure can vary; keep broad compatibility
  if (typeof t.text === "string") return t.text;
  if (typeof t.token === "string") return t.token;
  if (typeof t.word === "string") return t.word;
  if (typeof t.value === "string") return t.value;
  if (typeof t.norm === "string") return t.norm;
  return "";
}

function __getAsrWordText(w) {
  if (!w) return "";
  if (typeof w.word === "string") return w.word;
  if (typeof w.text === "string") return w.text;
  if (typeof w.token === "string") return w.token;
  if (typeof w.w === "string") return w.w;
  return "";
}

function __getAsrWordConfidence(w) {
  const c = w && (w.confidence ?? w.conf ?? w.score);
  return typeof c === "number" ? c : null;
}

// ============================================================
// Legacy DP alignment with resync (edit-distance style)
// Returns Map(refIdx -> confidence) for matched ref tokens
// ============================================================
function __alignResyncDP(refTokens, asrWords) {
  const ref = (refTokens || []).map((t) => ({
    idx: t && typeof t.idx === "number" ? t.idx : null,
    raw: __getTokenText(t),
    norm: __norm(__getTokenText(t)),
  }));
  const asr = (asrWords || []).map((w, j) => ({
    j,
    raw: __getAsrWordText(w),
    norm: __norm(__getAsrWordText(w)),
    conf: __getAsrWordConfidence(w),
  }));

  const n = ref.length;
  const m = asr.length;

  // Edge cases
  if (!n || !m) return new Map();

  // dp[i][j] minimal cost aligning first i ref tokens to first j asr tokens
  // back[i][j] = 0(match/sub), 1(del ref), 2(ins asr)
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const back = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    dp[i][0] = i;
    back[i][0] = 1; // del
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = j;
    back[0][j] = 2; // ins
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const a = ref[i - 1].norm;
      const b = asr[j - 1].norm;

      // match if exact normalized match; otherwise treat as substitution
      const subCost = a && b && a === b ? 0 : 1;

      const costSub = dp[i - 1][j - 1] + subCost;
      const costDel = dp[i - 1][j] + 1;
      const costIns = dp[i][j - 1] + 1;

      let best = costSub;
      let op = 0;
      if (costDel < best) {
        best = costDel;
        op = 1;
      }
      if (costIns < best) {
        best = costIns;
        op = 2;
      }
      dp[i][j] = best;
      back[i][j] = op;
    }
  }

  // Backtrack to produce matches
  const map = new Map();
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const op = back[i][j];
    if (op === 0) {
      // match/sub
      const rt = ref[i - 1];
      const aw = asr[j - 1];
      if (rt && rt.idx != null && rt.norm && aw && aw.norm && rt.norm === aw.norm) {
        map.set(rt.idx, aw.conf);
      }
      i -= 1;
      j -= 1;
    } else if (op === 1) {
      // delete ref token
      i -= 1;
    } else {
      // insert asr word
      j -= 1;
    }
  }

  return map;
}

// Heuristic: if legacy alignment produces a long tail of misses, it likely fell out of sync
function __shouldFallbackToResync(refTokens, legacyAlign) {
  try {
    if (!refTokens || !refTokens.length || !legacyAlign) return false;

    const n = refTokens.length;
    // count trailing misses
    let trailingMiss = 0;
    for (let k = n - 1; k >= 0; k--) {
      const idx = refTokens[k] && refTokens[k].idx;
      if (legacyAlign.has(idx)) break;
      trailingMiss += 1;
    }

    // if more than ~35% of tail is miss, fallback
    if (trailingMiss >= Math.max(3, Math.floor(n * 0.35))) return true;

    // also fallback if there is a very long consecutive miss streak anywhere (>= 6)
    let streak = 0;
    for (let k = 0; k < n; k++) {
      const idx = refTokens[k] && refTokens[k].idx;
      if (legacyAlign.has(idx)) streak = 0;
      else streak += 1;
      if (streak >= 6) return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

// ============================================================
// ✅ NEW: contains / set-based matching (Prototype default)
// Returns Map(refIdx -> confidence) for matched ref tokens
// - We don't care about order
// - We only care "did ASR contain this word?"
// ============================================================
function __alignContains(refTokens, asrWords) {
  const map = new Map();

  // Build wordNorm -> bestConfidence
  const dict = new Map();
  (asrWords || []).forEach((w) => {
    const key = __norm(__getAsrWordText(w));
    if (!key) return;
    const conf = __getAsrWordConfidence(w);
    const prev = dict.get(key);
    if (prev == null) {
      dict.set(key, conf);
      return;
    }
    // keep the better confidence if both are numbers; otherwise keep any existing
    if (typeof conf === "number" && typeof prev === "number") {
      if (conf > prev) dict.set(key, conf);
    } else if (typeof conf === "number" && prev == null) {
      dict.set(key, conf);
    }
  });

  // For each ref token, check if ASR dict contains it
  (refTokens || []).forEach((t, i) => {
    const idx = t && typeof t.idx === "number" ? t.idx : i; // fallback: use array index
    const key = __norm(__getTokenText(t));
    if (!key) return;
    if (!dict.has(key)) return;
    map.set(idx, dict.get(key));
  });

  return map;
}

export function buildCoverageColoredTokens({
  refText,
  asrWords,
  highConfThreshold = DEFAULT_HIGH_CONF_THRESHOLD,

  // ✅ Prototype default: contains
  // - "contains": set-based matching (order-free)
  // - "align": legacy align + optional DP resync fallback
  matchMode = "contains",

  // keep legacy option (only used in matchMode="align")
  resyncFallback = true,
}) {
  const refTokens = tokenizeRef(refText || "");

  // --------------------------------------------
  // ✅ Mode A (Prototype): contains matching
  // --------------------------------------------
  if (matchMode === "contains") {
    const align = __alignContains(refTokens, asrWords || []);
    const tokens = refTokens.map((t, i) => {
      const idx = t && typeof t.idx === "number" ? t.idx : i;
      const conf = align.has(idx) ? align.get(idx) : null;

      if (!align.has(idx)) return { ...t, state: "miss" };

      if (typeof conf === "number" && conf < highConfThreshold) {
        return { ...t, state: "hit_low", confidence: conf };
      }
      return { ...t, state: "hit_high", confidence: conf };
    });

    return { refTokens: tokens };
  }

  // --------------------------------------------
  // ✅ Mode B (Future): alignment matching
  // - Keep legacy behavior intact
  // --------------------------------------------
  const legacyAlign = alignRefTokensWithAsrWords(refTokens, asrWords || []);
  const align =
    resyncFallback && __shouldFallbackToResync(refTokens, legacyAlign)
      ? __alignResyncDP(refTokens, asrWords || [])
      : legacyAlign;

  const tokens = refTokens.map((t) => {
    const conf = align.has(t.idx) ? align.get(t.idx) : null;
    if (!align.has(t.idx)) return { ...t, state: "miss" };

    if (typeof conf === "number" && conf < highConfThreshold) {
      return { ...t, state: "hit_low", confidence: conf };
    }
    return { ...t, state: "hit_high", confidence: conf };
  });

  return { refTokens: tokens };
}

// frontend/src/components/examples/coverage/coverageOnce.js (file end)
