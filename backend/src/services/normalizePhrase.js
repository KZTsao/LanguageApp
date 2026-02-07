// ===== FILE: backend/src/services/normalizePhrase.js =====
// PATH: backend/src/services/normalizePhrase.js
/**
 * 功能：片語正規化（phrase canonicalization）
 * - 僅在 analyzeRoute 判定 mode === "phrase" 時使用
 * - 不做查字典、不做解釋；只回 canonical（可用於 normalizedQuery）
 *
 * 回傳格式：
 * { canonical: string|null, confidence: number, reason?: string }
 */
const llmGateway = require("../clients/llmGateway");

// [normal] trace helper (dev)
function __nlog(event, payload) {
  try {
    if (typeof process !== "undefined" && process?.env?.DEBUG_NORMALIZE_TRACE === "1") {
      console.info("[normal]", "normalizePhrase", event, payload || {});
    }
  } catch (e) {}
}

function safeJsonParse(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function extractJsonObject(text) {
  const t = String(text || "").trim();
  if (!t) return null;

  const direct = safeJsonParse(t);
  if (direct && typeof direct === "object") return direct;

  const m =
    t.match(/```json\s*([\s\S]*?)\s*```/i) ||
    t.match(/```\s*([\s\S]*?)\s*```/i);
  if (m && m[1]) {
    const obj = safeJsonParse(m[1].trim());
    if (obj && typeof obj === "object") return obj;
  }

  const b = t.match(/\{[\s\S]*\}/);
  if (b && b[0]) {
    const obj = safeJsonParse(b[0]);
    if (obj && typeof obj === "object") return obj;
  }
  return null;
}

async function normalizePhrase(text, opts = {}) {
  const input = (text || "").toString().trim();
  if (!input) return { canonical: null, confidence: 0 };

  __nlog("start", { len: input.length, requestId: opts.requestId || "" });

  const system = [
    "You are a German phrase normalizer.",
    "Task: Given a user input intended as a German phrase (not a full sentence), return a canonical dictionary-style phrase when possible.",
    "Rules:",
    "- Output STRICT JSON only (no extra text).",
    "- Keys: canonical (string|null), confidence (number 0..1), reason (string, optional).",
    "- If the input is not German or you are unsure, set canonical=null and confidence<=0.4.",
    "- Preserve meaning. Prefer infinitive + reflexive pronoun ordering when applicable (e.g., 'kümmern sich' -> 'sich kümmern').",
    "- For patterns like 'um das Kind kümmern', you may canonicalize to 'sich um etwas kümmern' if confident.",
  ].join("\n");

  const user = ["INPUT:", input, "", "Return JSON now."].join("\n");

  const resp = await llmGateway.chat({
    purpose: "normalize-phrase",
    provider: "auto",
    models: {
      openai: process.env.OPENAI_NORMALIZE_PHRASE_MODEL || undefined,
      groq: process.env.GROQ_NORMALIZE_PHRASE_MODEL || undefined,
    },

    temperature: 0,
    maxTokens: 180,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  if (!resp || resp.ok !== true) {
    const err = resp && resp.error ? resp.error : {};
    __nlog("llm_failed", { code: err.code || "LLM_FAILED", status: err.status || null });
    return { canonical: null, confidence: 0, reason: "llm_failed" };
  }

  const obj = extractJsonObject(resp && typeof resp.text === "string" ? resp.text : "");
  if (!obj || typeof obj !== "object") {
    __nlog("parse_failed", { hasContent: Boolean(resp && resp.content) });
    return { canonical: null, confidence: 0, reason: "parse_failed" };
  }

  const canonical = obj.canonical != null ? String(obj.canonical).trim() : "";
  const confidence = typeof obj.confidence === "number" ? obj.confidence : 0;

  const out = {
    canonical: canonical ? canonical : null,
    confidence: Math.max(0, Math.min(1, confidence)),
    ...(obj.reason ? { reason: String(obj.reason) } : {}),
  };

  __nlog("done", { ok: Boolean(out.canonical), confidence: out.confidence });
  return out;
}

module.exports = { normalizePhrase };

// END PATH: backend/src/services/normalizePhrase.js
// ===== END FILE =====