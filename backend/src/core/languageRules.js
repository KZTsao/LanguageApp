// ===== FILE: backend/src/core/languageRules.js =====
// ===== FILE: backend/src/core/languageRules.js =====
// backend/src/core/languageRules.js
const { tokenizeSentence } = require("./tokenizer");

// =========================
// [normal] trace helper (dev)
// =========================
function __nlog(event, payload) {
  try {
    if (typeof process !== "undefined" && process?.env?.DEBUG_NORMALIZE_TRACE === "1") {
      console.info("[normal]", "languageRules", event, payload || {});
    }
  } catch (e) {}
}

// 粗略的時態判斷（保留，與本 Task 無關）
function detectTense(text) {
  const t = String(text || "").toLowerCase();

  if (/\bwill\b/.test(t)) {
    return "future-like";
  }
  if (/\bhave\b.*\b(v|V)3\b/.test(t)) {
    return "perfect-like";
  }
  if (/\bwas\b|\bwere\b|\bed\b\b/.test(t)) {
    return "past-like";
  }
  return "present-or-unknown";
}

/**
 * Task 1｜detectMode：純結構分流
 *
 * 回傳：
 * - "word"
 * - "phrase"
 * - "uncertain"（phrase / sentence 灰區，交給 Task2）
 *
 * 原則：
 * - ❌ 不用任何白名單 / 詞表
 * - ❌ 不判斷 sentence
 * - ✅ 只用結構（token 數量、標點、字形）
 */
function detectMode(text) {
  
  __nlog("detectMode:start", { len: (text||"").toString().length, text: (process?.env?.DEBUG_NORMALIZE_TRACE_TEXT==="1" ? (text||"").toString() : undefined) });
const raw = String(text ?? "").trim();
  if (!raw)   {
    __nlog("detectMode:return", { mode: "uncertain" });
    return "uncertain";
  }

  const tokens = tokenizeSentence(raw);
  if (!Array.isArray(tokens) || tokens.length === 0){
    __nlog("detectMode:return", { mode: "uncertain" });
    return "uncertain";
  }
  
  // word-like token：只看是否含 unicode 字母或數字
  const isWordLike = (tok) => /[\p{L}\p{N}]/u.test(String(tok));
  const wordTokens = tokens.filter(isWordLike);

  // 標點檢測（純符號，不涉及語意）
  const hasMidPunct = tokens.some((t) => /[,;:]/.test(String(t)));
  const hasTerminalPunct =
    /[.!?]\s*$/.test(raw) || tokens.some((t) => /[.!?]/.test(String(t)));

  // 首個 word token 是否大寫開頭（僅字形）
  const firstWord = wordTokens[0] || "";
  const startsWithUpper = /^\p{Lu}/u.test(String(firstWord));

  // 沒有任何 word-like token（例如 "...", "!!!"）
  if (wordTokens.length === 0){
    __nlog("detectMode:return", { mode: "uncertain" });
    return "uncertain";
  }

  // 單一 word token，且沒有標點 → word
  if (wordTokens.length === 1) {
    if (hasMidPunct || hasTerminalPunct) return "uncertain";
    return "word";
  }

  // 有明顯標點 → 直接丟 uncertain
  if (hasMidPunct || hasTerminalPunct) return "uncertain";

  // 結構上「像句子」的風險條件（但不下 sentence 結論）
  if (wordTokens.length >= 5) return "uncertain";
  if (startsWithUpper && wordTokens.length >= 3) return "uncertain";

  // 剩下的安全落在 phrase
  return "phrase";
}

// ⚠️ 與本 Task 無關，維持原狀（未動）
function guessLanguage(text) {
  const t = String(text || "").toLowerCase();

  if (/[äöüß]/.test(t)) {
    return "de";
  }
  return "en";
}

module.exports = {
  detectTense,
  detectMode,
  guessLanguage,
};
// backend/src/core/languageRules.js
// ===== END FILE: backend/src/core/languageRules.js =====
// ===== END FILE =====
