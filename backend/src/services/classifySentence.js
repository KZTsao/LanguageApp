// ===== FILE: backend/src/services/classifySentence.js =====
// ===== FILE: backend/src/services/classifySentence.js =====
/**
 * classifySentence.js
 *
 * 輕量 LLM 分類器：
 * - 僅判斷「是否為完整句子」
 * - 不做文法正確性判斷
 * - 不回解釋、不回 token
 *
 * 回傳：
 *   { mode: "sentence" | "phrase" }
 */

const { groqChatCompletion } = require("../clients/groqClient");
const { tokenizeSentence } = require("../core/tokenizer");
// =========================
// [normal] trace helper (dev)
// =========================
function __nlog(event, payload) {
  try {
    if (typeof process !== "undefined" && process?.env?.DEBUG_NORMALIZE_TRACE === "1") {
      console.info("[normal]", "classifySentence", event, payload || {});
    }
  } catch (e) {}
}

async function classifySentence(text, { requestId } = {}) {
  const input = (text || "").trim();
  if (!input) {
      __nlog("return", { value: (typeof { mode: "phrase" } === "string" ? { mode: "phrase" } : undefined), obj: (typeof { mode: "phrase" } === "object" ? { mode: "phrase" } : undefined) });
  return { mode: "phrase" };
  }

  // =========================
  // ✅ Deterministic fast-path (no LLM)
  // Goal: avoid misrouting obvious full sentences into word lookup
  // - If clearly a sentence, return { mode: "sentence" }
  // - Otherwise fall back to LLM classifier
  // =========================
  try {
    const raw = input;
    const tokens = tokenizeSentence(raw);
    const isWordLike = (tok) => /[\p{L}\p{N}]/u.test(String(tok || ""));
    const wordTokens = Array.isArray(tokens) ? tokens.filter(isWordLike) : [];

    if (wordTokens.length >= 2) {
      const lower = wordTokens.map((t) => String(t).toLowerCase());
      const first = lower[0] || "";

      // Personal pronouns / polite "Sie" (kept small on purpose)
      const pronouns = new Set([
        "ich",
        "du",
        "er",
        "sie",
        "es",
        "wir",
        "ihr",
        "mich",
        "dich",
        "ihn",
        "ihr",
        "uns",
        "euch",
        "ihnen",
        "sie",
      ]);

      // Common finite verb forms (small but covers most everyday inputs)
      const finiteVerbs = new Set([
        "bin",
        "bist",
        "ist",
        "sind",
        "seid",
        "war",
        "waren",
        "habe",
        "hast",
        "hat",
        "haben",
        "hatte",
        "hatten",
        "werde",
        "wirst",
        "wird",
        "werden",
        "kann",
        "kannst",
        "können",
        "muss",
        "musst",
        "müssen",
        "will",
        "willst",
        "wollen",
        "darf",
        "darfst",
        "dürfen",
        "soll",
        "sollst",
        "sollen",
        "komme",
        "kommst",
        "kommt",
        "kommen",
        "gehe",
        "gehst",
        "geht",
        "gehen",
      ]);

      const hasPronoun = pronouns.has(first);
      const hasFiniteVerb = lower.some((t) => finiteVerbs.has(t));

      // If input starts with pronoun and contains a common finite verb -> treat as sentence
      // Example: "ich habe einen Hund"
      if (hasPronoun && hasFiniteVerb) {
        __nlog("fastpath", { mode: "sentence", reason: "pronoun+finiteVerb", requestId });
        return { mode: "sentence" };
      }

      // If it ends with terminal punctuation and has 2+ words, treat as sentence
      if (/[.!?]\s*$/.test(raw)) {
        __nlog("fastpath", { mode: "sentence", reason: "terminalPunct", requestId });
        return { mode: "sentence" };
      }
    }
  } catch (e) {
    // Do not break main flow
    __nlog("fastpath:error", { message: e?.message || String(e), requestId });
  }

  const prompt = `
判斷以下德文輸入是否為「完整句子」。

規則：
- 若是完整句子（有主詞與謂語，或為正確疑問句/命令句），回傳 "sentence"
- 若只是片語、不完整結構、動詞片段，回傳 "phrase"

只回傳 JSON，不要任何解釋。

輸入：
"""${input}"""

回傳格式：
{ "mode": "sentence" | "phrase" }
`.trim();

  try {
        const res = await groqChatCompletion({
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 20,
    });

    const content = res?.content || res?.text || "";
    
    __nlog("groq:res", {
      hasRes: Boolean(res),
      hasContent: Boolean(content),
      contentLen: (content || "").toString().length,
      contentPreview:
        process?.env?.DEBUG_NORMALIZE_TRACE_TEXT === "1"
          ? (content || "").toString().slice(0, 200)
          : undefined,
    });
const jsonMatch = content.match(/\{[\s\S]*?\}/);

    
    __nlog("jsonMatch", {
      found: Boolean(jsonMatch),
      snippet:
        process?.env?.DEBUG_NORMALIZE_TRACE_TEXT === "1" && jsonMatch?.[0]
          ? jsonMatch[0].slice(0, 200)
          : undefined,
    });
if (!jsonMatch) {
        __nlog("return", { value: (typeof { mode: "phrase" } === "string" ? { mode: "phrase" } : undefined), obj: (typeof { mode: "phrase" } === "object" ? { mode: "phrase" } : undefined) });
  return { mode: "phrase" };
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
      __nlog("json:parse", { ok: true, mode: parsed?.mode });
    } catch (e) {
      __nlog("json:parse", { ok: false, message: e?.message });
      return { mode: "phrase" };
    }

if (parsed && (parsed.mode === "sentence" || parsed.mode === "phrase")) {
      return parsed;
    }
    __nlog("json:invalid", { mode: parsed?.mode });
    return { mode: "phrase" };
} catch (err) {
    
    __nlog("error", { name: err?.name, message: err?.message });
// 任何錯誤都保守當成 phrase，避免誤進 sentence
    return { mode: "phrase" };
  }
}

module.exports = {
  classifySentence,
};
// ===== END FILE: backend/src/services/classifySentence.js =====
// ===== END FILE =====
