// PATH: backend/src/services/analyzeSentence.js
// ===== FILE: backend/src/services/analyzeSentence.js =====
// backend/src/services/analyzeSentence.js
const { tokenizeSentence } = require("../core/tokenizer");
const { analyzeGrammar } = require("./analyzeGrammar");

// =========================
// usage-note sanitizer (avoid "correct/incorrect" judgement tone)
// =========================
function _isPunctuationOnly(s) {
  return /^[\s\p{P}\p{S}]+$/u.test((s || "").toString());
}
function _isTokenLike(s) {
  const t = (s || "").toString().trim();
  if (!t) return true;
  // single token (no spaces) and short => likely token/label, not explanation
  if (!/\s/.test(t) && t.length <= 4) return true;
  // "X: Y" token mapping style
  if (/^\S+\s*:\s*\S+/.test(t)) return true;
  return false;
}
function _simplifyBullet(s) {
  let t = (s || "").toString().trim();
  if (!t) return "";
  // strip leading framing like "This sentence ..."
  t = t.replace(/^\s*(This\s+sentence|The\s+sentence|In\s+this\s+sentence)\s*(is|uses|shows|has)?\s*/i, "");
  t = t.replace(/^\s*(這個句子|此句|本句)\s*(是|使用|表示|包含)?\s*/u, "");
  t = t.replace(/^[:\-–—]+\s*/, "");
  return t.trim();
}
function _isJudgementLine(s) {
  const t = (s || "").toString().trim();
  if (!t) return false;
  // English judgement / grading tone
  if (/^\s*(Correct|Incorrect|Grammatically\s+correct|The\s+sentence\s+is\s+)/i.test(t)) return true;
  if (/\b(word\s+order\s+is\s+correct|in\s+the\s+correct\s+form|grammatically\s+correct)\b/i.test(t)) return true;
  // Chinese judgement tone
  if (/^\s*(句子完全正確|句子語法正確|此句.*正確|語法正確|不正確)/u.test(t)) return true;
  return false;
}
function _sanitizeUsageList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const it of list) {
    const raw =
      typeof it === "string"
        ? it
        : typeof it?.text === "string"
          ? it.text
          : typeof it?.hint === "string"
            ? it.hint
            : typeof it?.message === "string"
              ? it.message
              : "";
    let s = _simplifyBullet(raw);
    if (!s) continue;
    if (s === ":") continue;
    if (_isPunctuationOnly(s)) continue;
    if (_isJudgementLine(s)) continue;
    // keep explanations; drop token-like fragments
    if (_isTokenLike(s)) continue;
    if (out.includes(s)) continue;
    out.push(s);
  }
  return out;
}
function _sanitizeUsageText(s) {
  const t = _simplifyBullet(s);
  if (!t) return "";
  if (_isJudgementLine(t)) return "";
  if (_isPunctuationOnly(t)) return "";
  return t;
}

// =========================
// [normal] trace helper (dev)
// =========================
function __isObserveEnabledRaw(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

const __ANALYZE_SENTENCE_OBSERVE__ =
  __isObserveEnabledRaw(process.env.ANALYZE_OBSERVE) ||
  __isObserveEnabledRaw(process.env.DEBUG_ANALYZE_OBSERVE) ||
  __isObserveEnabledRaw(process.env.OBSERVE_ANALYZE);

function __observeSentence(event, payload) {
  try {
    if (!__ANALYZE_SENTENCE_OBSERVE__) return;
    console.log('[observe][analyzeSentence]', event, payload || {});
  } catch (e) {}
}

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
  try { console.info("[classify][be][analyzeSentence] start", { input, rawInput, explainLang, requestId: options?.requestId || "" }); } catch {}

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
    const detail = options && typeof options === "object" && typeof options.detail === "string" ? options.detail : "basic";
    grammar = await analyzeGrammar(input, explainLang, {
      // optional hint; safe if analyzeGrammar ignores it
      intent: "sentence_decision",
      wantFallback: true,
      detail,
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

  try { console.info("[classify][be][analyzeSentence] analyzeGrammar:done", { isCorrect: !!grammar && grammar.isCorrect === true, errorsCount: Array.isArray(grammar?.errors) ? grammar.errors.length : 0, fallbackCandidate: grammar?.fallbackNormalizedQuery || grammar?.suggestedQuery || grammar?.recommendedQuery || "" }); } catch {}
  __observeSentence("grammar.done", {
    requestId: options?.requestId || "",
    isCorrect: !!grammar && grammar.isCorrect === true,
    grammarKeys: grammar && typeof grammar === "object" ? Object.keys(grammar) : [],
    hasRaw: !!(grammar && grammar.raw),
    hasUsage: !!(grammar && grammar.usage),
    provider: grammar?.provider || grammar?.raw?.provider || "",
    model: grammar?.model || grammar?.raw?.model || "",
    fallbackCandidate: grammar?.fallbackNormalizedQuery || grammar?.suggestedQuery || grammar?.recommendedQuery || "",
  });
  const isCorrect = !!grammar && grammar.isCorrect === true;

  // -------- A) grammar correct -> sentence meaning 중심 --------
  if (isCorrect) {
    try { console.info("[classify][be][analyzeSentence] branch", { branch: "grammar_correct" }); } catch {}
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

    // ✅ role-only structure + highlights (preferred by SentenceCard)
    if (Array.isArray(grammar.structureLabels) && grammar.structureLabels.length) {
      sentence.structureLabels = grammar.structureLabels;
    }
    if (Array.isArray(grammar.structureRoles) && grammar.structureRoles.length) {
      sentence.structureRoles = grammar.structureRoles;
    }
    if (Array.isArray(grammar.highlights) && grammar.highlights.length) {
      sentence.highlights = grammar.highlights;
    }

    if (Array.isArray(grammar.keyPoints) && grammar.keyPoints.length) {
      sentence.notes = grammar.keyPoints;
    } else if (Array.isArray(grammar.points) && grammar.points.length) {
      sentence.notes = grammar.points;
    } else if (Array.isArray(grammar.notes) && grammar.notes.length) {
      sentence.notes = grammar.notes;
    } else if (Array.isArray(grammar.highlights) && grammar.highlights.length) {
      sentence.notes = grammar.highlights;
    }

    // ✅ two-stage expand payload (only when requested)
    const __detail = options && typeof options === "object" && typeof options.detail === "string" ? options.detail : "basic";
    if (__detail === "expand") {
      sentence.expand = {
        template: typeof grammar.template === "string" ? grammar.template : "",
        variants: Array.isArray(grammar.variants) ? grammar.variants : [],
        commonMistakes: Array.isArray(grammar.commonMistakes) ? grammar.commonMistakes : [],
        extraNotes: Array.isArray(grammar.extraNotes) ? grammar.extraNotes : [],
      };
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

    // ✅ Two-stage (on-demand) expand payload
    // - Only attach when caller requests detail=expand
    try {
      const __detail = options && typeof options === "object" && typeof options.detail === "string" ? options.detail : "basic";
      if (__detail === "expand") {
        sentence.expand = {
          template: typeof grammar.template === "string" ? grammar.template : "",
          variants: Array.isArray(grammar.variants) ? grammar.variants : [],
          commonMistakes: Array.isArray(grammar.commonMistakes) ? grammar.commonMistakes : [],
          extraNotes: Array.isArray(grammar.extraNotes) ? grammar.extraNotes : [],
        };
      }
    } catch {}

    // ✅ sanitize notes for "usage introduction" tone (avoid grading/judgement lines)
    sentence.notes = _sanitizeUsageList(sentence.notes);

    // ✅ B-mode: map learning payload (if present)
    if (grammar.learningFocus && typeof grammar.learningFocus === "object") {
      const title = (typeof grammar.learningFocus.title === "string" ? grammar.learningFocus.title : "").trim();
      const whyImportant = (typeof grammar.learningFocus.whyImportant === "string" ? grammar.learningFocus.whyImportant : "").trim();
      if (title || whyImportant) {
        sentence.learningFocus = { title, whyImportant };
      }
    }
    if (grammar.extendExample && typeof grammar.extendExample === "object") {
      const de = (typeof grammar.extendExample.de === "string" ? grammar.extendExample.de : "").trim();
      const zh = (typeof grammar.extendExample.translation === "string" ? grammar.extendExample.translation : "").trim();
      if (de || zh) {
        sentence.extendExamples = [{ de, zh, focus: sentence.learningFocus?.title || "" }];
      }
    }

    if (sentence.expand && typeof sentence.expand === "object") {
      sentence.expand.template = _sanitizeUsageText(sentence.expand.template || "");
      sentence.expand.variants = _sanitizeUsageList(sentence.expand.variants);
      sentence.expand.commonMistakes = _sanitizeUsageList(sentence.expand.commonMistakes);
      sentence.expand.extraNotes = _sanitizeUsageList(sentence.expand.extraNotes);
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
    __observeSentence("return.correct", {
      requestId: options?.requestId || "",
      keys: Object.keys(res || {}),
      grammarKeys: res.grammar && typeof res.grammar === "object" ? Object.keys(res.grammar) : [],
      hasSentence: !!res.sentence,
      hasRaw: !!res.raw,
      hasUsage: !!res.usage,
    });
    return res;
  }

  // -------- B/C) grammar incorrect or analysis failed -> errors + fallback --------
  try { console.info("[classify][be][analyzeSentence] branch", { branch: "grammar_incorrect_or_failed" }); } catch {}
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
  __observeSentence("return.fallback", {
    requestId: options?.requestId || "",
    keys: Object.keys(res || {}),
    grammarKeys: res.grammar && typeof res.grammar === "object" ? Object.keys(res.grammar) : [],
    fallbackMode: res.fallback?.mode || "",
    hasRaw: !!res.raw,
    hasUsage: !!res.usage,
  });
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
