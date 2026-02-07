// backend/src/clients/llmGateway.js
/**
 * llmGateway.js
 * ------------------------------------------------------------
 * 目標：
 * - 統一處理 provider 選擇（groq/openai）
 * - 統一錯誤格式（route/service 不需要理解 upstream error）
 * - Groq 一律走 groqClient.groqChatCompletion（保留 key-rotate/retry）
 *
 * 介面：
 *   const llm = await llmGateway.chat({ purpose, provider, models, messages, temperature, maxTokens })
 *   - success: { ok:true, provider, model, text, raw }
 *   - fail:    { ok:false, error:{ code, status, message, detail, raw, provider, need? } }
 *
 * 注意：
 * - OpenAI 目前僅支援單一 OPENAI_API_KEY（不做 pool/rotate）
 * - provider=auto：有 OPENAI_API_KEY 優先走 openai；否則走 groq
 * ------------------------------------------------------------
 */

const groqClient = require("./groqClient");

function hasGroqKey() {
  try {
    if (String(process.env.GROQ_API_KEY || "").trim()) return true;
    const keys = Object.keys(process.env || {});
    return keys.some((k) => /^GROQ_API_KEY_\d+$/.test(k) && String(process.env[k] || "").trim());
  } catch (e) {
    return false;
  }
}

function pickProvider(requested) {
  const p = String(requested || "auto").toLowerCase();
  if (p === "openai" || p === "groq") return p;
  const hasOpenAI = Boolean(String(process.env.OPENAI_API_KEY || "").trim());
  if (hasOpenAI) return "openai";
  if (hasGroqKey()) return "groq";
  return "";
}

function normalizeUpstreamError(err, provider) {
  const e = err || {};
  const status =
    (typeof e.status === "number" ? e.status : null) ||
    (typeof e?.response?.status === "number" ? e.response.status : null) ||
    null;

  // Try to extract JSON from message (common in wrapped errors: "401 {...}")
  const msg = String(e.message || e.toString ? e.toString() : "" || "");
  let parsed = null;
  try {
    const m = msg.match(/\{[\s\S]*\}/);
    if (m && m[0]) parsed = JSON.parse(m[0]);
  } catch (_) {}

  const detail =
    e.detail ||
    e.error ||
    e.data ||
    (parsed && (parsed.error || parsed)) ||
    null;

  const code =
    e.code ||
    (detail && detail.code) ||
    (detail && detail.error && detail.error.code) ||
    (detail && detail.type) ||
    null;

  const message =
    (detail && detail.message) ||
    (detail && detail.error && detail.error.message) ||
    e.message ||
    msg ||
    "Upstream request failed";

  return {
    code: (code ? String(code) : null) || (provider === "openai" ? "OPENAI_FAILED" : "GROQ_FAILED"),
    status: status,
    message: String(message || ""),
    detail: detail || null,
    raw: e.raw || null,
    provider: provider || null,
  };
}

async function callOpenAI({ model, messages, temperature, maxTokens }) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, error: { code: "LLM_API_KEY_MISSING", need: ["OPENAI_API_KEY"], provider: "openai" } };
  }

  const m = String(model || process.env.OPENAI_MODEL || "gpt-4o-mini");
  const t = typeof temperature === "number" ? temperature : 0.2;
  const maxOut = typeof maxTokens === "number" ? maxTokens : 220;

  // Map messages -> Responses API input format
  const input = (Array.isArray(messages) ? messages : []).map((mm) => ({
    role: mm && mm.role ? mm.role : "user",
    content: [{ type: "text", text: String(mm && mm.content ? mm.content : "") }],
  }));

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: m,
      input,
      temperature: t,
      max_output_tokens: maxOut,
    }),
  });

  const rawText = await resp.clone().text().catch(() => "");
  const data = await resp.json().catch(() => null);

  if (!resp.ok || !data) {
    return {
      ok: false,
      error: {
        code: "OPENAI_FAILED",
        status: resp.status,
        message: "OpenAI request failed",
        detail: data && (data.error || data),
        raw: rawText ? rawText.slice(0, 1200) : null,
        provider: "openai",
      },
    };
  }

  // Extract output_text from Responses API
  let outText = "";
  try {
    const output = Array.isArray(data.output) ? data.output : [];
    for (const item of output) {
      const content = Array.isArray(item.content) ? item.content : [];
      for (const c of content) {
        if (c && c.type === "output_text" && typeof c.text === "string") outText += c.text;
      }
    }
  } catch (_) {}

  return { ok: true, provider: "openai", model: m, text: String(outText || ""), raw: data };
}

async function callGroq({ model, messages, temperature, maxTokens }) {
  if (!hasGroqKey()) {
    return { ok: false, error: { code: "LLM_API_KEY_MISSING", need: ["GROQ_API_KEY", "GROQ_API_KEY_###"], provider: "groq" } };
  }

  const m = String(model || process.env.GROQ_MODEL || "llama-3.1-8b-instant");

  try {
    const resp = await groqClient.groqChatCompletion({
      model: m,
      messages: Array.isArray(messages) ? messages : [],
      ...(typeof temperature === "number" ? { temperature } : {}),
      ...(typeof maxTokens === "number" ? { max_tokens: maxTokens } : {}),
    });

    return { ok: true, provider: "groq", model: m, text: String(resp && resp.content ? resp.content : ""), raw: resp && resp.raw ? resp.raw : null };
  } catch (err) {
    const norm = normalizeUpstreamError(err, "groq");
    return { ok: false, error: norm };
  }
}

async function chat(opts = {}) {
  const provider = pickProvider(opts.provider);
  if (!provider) {
    return { ok: false, error: { code: "LLM_API_KEY_MISSING", need: ["OPENAI_API_KEY", "GROQ_API_KEY"], provider: null } };
  }

  const models = (opts && opts.models && typeof opts.models === "object") ? opts.models : {};
  const model = provider === "openai" ? models.openai : models.groq;

  if (provider === "openai") {
    try {
      return await callOpenAI({
        model,
        messages: opts.messages,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });
    } catch (err) {
      return { ok: false, error: normalizeUpstreamError(err, "openai") };
    }
  }

  return await callGroq({
    model,
    messages: opts.messages,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
  });
}

module.exports = { chat };
// END PATH: backend/src/clients/llmGateway.js
