// PATH: backend/src/services/analyzeSentence.js
// ===== FILE: backend/src/services/analyzeSentence.js =====
// backend/src/services/analyzeSentence.js
const { tokenizeSentence } = require("../core/tokenizer");
const { analyzeGrammar } = require("./analyzeGrammar");

// =========================
// [normal] trace helper (dev)
// =========================
function __nlog(event, payload) {
  try {
    if (typeof process !== "undefined" && process?.env?.DEBUG_NORMALIZE_TRACE === "1") {
      console.info("[normal]", "analyzeSentence", event, payload || {});
    }
  } catch (e) {}
}

/**
 * Task4 scope:
 * - Assume upstream already decided mode === "sentence"
 * - Decide output format by grammar.isCorrect
 * - Never throw to crash route; always return kind/mode:"sentence"
 *
 * Return contract:
 * A) grammar.isCorrect === true  -> sentence.meaning 중심
 * B) grammar.isCorrect === false -> grammar.errors + fallback.normalizedQuery
 * C) analyzeGrammar fail/timeout  -> grammar.isCorrect:false + analysis_failed + fallback
 */
async function analyzeSentence(text, options = {}) {
  console.info("[統計] analyzeSentence enter");
  
  __nlog("start", { text: (process?.env?.DEBUG_NORMALIZE_TRACE_TEXT==="1" ? (text||"").toString() : undefined) });
const explainLang = options.explainLang || "zh-TW";
  const rawInput = typeof options.rawInput === "string" ? options.rawInput : text;

  const input = (text ?? "").toString().trim();

  // debug flags (default off)
  const debugEnabled =
    !!options.debug ||
    process.env.ANALYZE_SENTENCE_DEBUG === "1" ||
    process.env.ANALYZE_SENTENCE_DEBUG === "true";

  const debugTokensEnabled =
    debugEnabled ||
    process.env.ANALYZE_SENTENCE_DEBUG_TOKENS === "1" ||
    process.env.ANALYZE_SENTENCE_DEBUG_TOKENS === "true";

  const debugTokens = debugTokensEnabled ? safeTokenize(input) : undefined;

  // -------- helpers --------
  const buildBase = () => ({
    kind: "sentence",
    mode: "sentence", // keep compatibility with existing frontend expectation
    input,
    rawInput,
  });

  const normalizeFallbackQuery = (q) => {
    const s = (q ?? "").toString().trim();
    // keep "directly usable for analyzeWord": no bracket display, no extra markup
    // (we only do minimal sanitation, not whitelist)
    return s.replace(/[()（）［］\[\]<>]/g, "").trim();
  };

  const extractFallbackFromGrammar = (g) => {
    if (!g || typeof g !== "object") return "";

    // 1) common direct fields
    const direct =
      g.fallbackNormalizedQuery ||
      g.fallback_query ||
      g.suggestedQuery ||
      g.suggested_query ||
      g.recommendedQuery ||
      g.recommended_query ||
      g.normalizedQuery ||
      g.normalized_query ||
      g.query;

    if (typeof direct === "string" && direct.trim()) return direct;

    // 2) nested fallback (if analyzeGrammar already provides)
    if (g.fallback && typeof g.fallback === "object") {
      const nested =
        g.fallback.normalizedQuery ||
        g.fallback.query ||
        g.fallback.suggestedQuery;
      if (typeof nested === "string" && nested.trim()) return nested;
    }

    // 3) look into errors array for any suggested phrase/query
    const errs = Array.isArray(g.errors) ? g.errors : [];
    for (const e of errs) {
      if (!e || typeof e !== "object") continue;
      const cand =
        e.suggestedQuery ||
        e.suggested_query ||
        e.recommendedQuery ||
        e.recommended_query ||
        e.normalizedQuery ||
        e.normalized_query ||
        e.query ||
        e.phrase ||
        (e.suggestion && (e.suggestion.phrase || e.suggestion.query));
      if (typeof cand === "string" && cand.trim()) return cand;
    }

    return "";
  };

  const buildHeuristicFallback = () => {
    // No whitelist: conservative fallback that is still "callable" by analyzeWord.
    // Strategy: remove trailing punctuation, and shorten to a manageable chunk if very long.
    const cleaned = input
      .replace(/[。．.?!！？]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) return "";

    // If too long, return first ~6 tokens chunk (still usable as phrase query)
    const toks = safeTokenize(cleaned);
    if (toks.length > 6) return toks.slice(0, 6).join(" ");
    return cleaned;
  };

  // -------- grammar analysis (must not throw) --------
  let grammar;
  let grammarFailed = false;

  try {
    // Keep original call signature, but allow analyzeGrammar to optionally accept options
    grammar = await analyzeGrammar(input, explainLang, {
      // optional hint; safe if analyzeGrammar ignores it
      intent: "sentence_decision",
      wantFallback: true,
    });
  } catch (e) {
    grammarFailed = true;
    grammar = {
      isCorrect: false,
      errors: [{ type: "analysis_failed", message: "analyzeGrammar_failed" }],
    };
    if (debugEnabled) {
      grammar.debugError = {
        name: e?.name,
        message: e?.message,
      };
    }
  }

  const isCorrect = !!grammar && grammar.isCorrect === true;

  // -------- A) grammar correct -> sentence meaning 중심 --------
  if (isCorrect) {
    const sentence = {};

    // Prefer fields if analyzeGrammar already returns them
    // (We do not assume schema; we just map common possibilities)
    const meaning =
      (typeof grammar.meaning === "string" && grammar.meaning.trim()) ||
      (typeof grammar.translation === "string" && grammar.translation.trim()) ||
      (typeof grammar.explanation === "string" && grammar.explanation.trim()) ||
      (typeof grammar.summary === "string" && grammar.summary.trim()) ||
      "";

    if (meaning) sentence.meaning = meaning;

    // Optional short breakdown/notes (only if present; no token-by-token words[])
    if (Array.isArray(grammar.breakdown) && grammar.breakdown.length) {
      sentence.breakdown = grammar.breakdown;
    } else if (Array.isArray(grammar.structure) && grammar.structure.length) {
      sentence.breakdown = grammar.structure;
    }

    if (Array.isArray(grammar.points) && grammar.points.length) {
      sentence.notes = grammar.points;
    } else if (Array.isArray(grammar.notes) && grammar.notes.length) {
      sentence.notes = grammar.notes;
    } else if (Array.isArray(grammar.highlights) && grammar.highlights.length) {
      sentence.notes = grammar.highlights;
    }

    // Ensure meaning exists (required by spec). If not provided, degrade gracefully.
    if (!sentence.meaning) {
      sentence.meaning =
        explainLang && explainLang.toLowerCase().startsWith("zh")
          ? "（整句釋義產出失敗）"
          : "(Sentence meaning unavailable)";
      if (debugEnabled) {
        sentence._debug = {
          reason: "meaning_missing_from_grammar_output",
        };
      }
    }

    const res = {
      ...buildBase(),
      normalizedQuery: input, // for sentence, normalizedQuery is the trimmed sentence itself
      grammar: {
        ...grammar,
        isCorrect: true,
      },
      sentence,
    };

    if (debugTokensEnabled) res.debugTokens = debugTokens;

    // Hard rule: do NOT return words[] / token analyses that could trigger multi-WordCard render
    delete res.words;
    return res;
  }

  // -------- B/C) grammar incorrect or analysis failed -> errors + fallback --------
  const errors = Array.isArray(grammar?.errors) ? grammar.errors : [];

  const llmSuggested = extractFallbackFromGrammar(grammar);
  const fallbackQuery = normalizeFallbackQuery(llmSuggested || buildHeuristicFallback() || input);

  const res = {
    ...buildBase(),
    normalizedQuery: fallbackQuery, // IMPORTANT: for invalid grammar, normalizedQuery should be fallback phrase
    grammar: {
      ...(grammar && typeof grammar === "object" ? grammar : {}),
      isCorrect: false,
      errors: errors.length
        ? errors
        : [{ type: grammarFailed ? "analysis_failed" : "grammar_invalid" }],
    },
    fallback: {
      mode: "phrase",
      normalizedQuery: fallbackQuery,
      reason: grammarFailed ? "analysis_failed" : "grammar_invalid",
    },
  };

  if (debugTokensEnabled) res.debugTokens = debugTokens;

  // Hard rule: do NOT return words[] / token analyses that could trigger multi-WordCard render
  delete res.words;
  return res;
}

function safeTokenize(input) {
  try {
    return tokenizeSentence(input);
  } catch {
    // keep failure non-fatal
    return typeof input === "string" && input.trim() ? input.trim().split(/\s+/g) : [];
  }
}

module.exports = { analyzeSentence };
// backend/src/services/analyzeSentence.js
// ===== END FILE: backend/src/services/analyzeSentence.js =====
// END PATH: backend/src/services/analyzeSentence.js
