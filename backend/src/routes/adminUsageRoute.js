// backend/src/routes/adminUsageRoute.js
// - GET /admin/usage      → 回傳統計 JSON（給程式 / 你自己看）
// - GET /admin/dashboard  → 極簡網頁版儀表板（方便肉眼看）

const express = require("express");
const router = express.Router();

const { getUsageSummary, getMonthlyUsage } = require("../utils/usageLogger");

// ✅ 用來取得目前 rotate 到哪一把（index/total）
const groqClient = require("../clients/groqClient");

let __lastDecodedJwtDebug = null;

// --- Optional: JWT verify for gating debug visibility ---
let jwt = null;
try {
  jwt = require("jsonwebtoken");
} catch {
  // 沒裝 jsonwebtoken 就不做驗證（仍可 fallback decode payload）
  jwt = null;
}

function parseCommaList(s) {
  return String(s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// ✅ JWT payload decode（base64url）
// ⚠️ 只用於「顯示 debug 欄位 / allowlist 判斷」；不是授權用途
function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;

    // JWT payload is base64url (not base64)
    let payload = parts[1];
    payload = payload.replace(/-/g, "+").replace(/_/g, "/");

    // add padding if missing
    const pad = payload.length % 4;
    if (pad) payload += "=".repeat(4 - pad);

    const json = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// 依照 groqClient 的編號 key 邏輯：掃 GROQ_API_KEY_001~，排序後得到變數名陣列
function listGroqKeyVarNamesFromEnv() {
  return Object.keys(process.env)
    .filter((k) => /^GROQ_API_KEY_\d+$/.test(k))
    .sort((a, b) => {
      const na = parseInt(a.split("_").pop(), 10);
      const nb = parseInt(b.split("_").pop(), 10);
      return na - nb;
    });
}

// 取得 request 的登入身份（盡量不破壞你現有架構）
// - 若上游已經有 auth middleware 丟 req.user，就直接用
// - 否則嘗試從 Authorization: Bearer <jwt> 解析
function getRequesterIdentity(req) {
  if (req?.user) return req.user;

  const auth = req.headers?.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    __lastDecodedJwtDebug = { hasAuthHeader: false };
    return null;
  }

  const token = m[1];

  // 先把「這筆 request」的 token 基本樣貌記起來（不會被後面覆蓋掉）
  __lastDecodedJwtDebug = {
    hasAuthHeader: true,
    tokenLength: token.length,
    tokenParts: token.split(".").length,
  };

  // 如果不是 JWT（三段），就直接不解析
  if (__lastDecodedJwtDebug.tokenParts !== 3) {
    __lastDecodedJwtDebug = {
      ...__lastDecodedJwtDebug,
      decodeFailed: true,
      reason: "tokenParts!=3",
    };
    return null;
  }

  // 若沒有 secret 或沒有 jwt lib：fallback 只 decode payload（不驗簽）
  const secret =
    process.env.SUPABASE_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_KEY ||
    "";

  if (!jwt || !secret) {
    const decoded = decodeJwtPayload(token);
    if (decoded) {
      __lastDecodedJwtDebug = {
        ...__lastDecodedJwtDebug,
        decodeMode: "payload-only",
        keys: Object.keys(decoded || {}),
        hasEmail: !!decoded.email,
        hasSub: !!decoded.sub,
      };
    } else {
      __lastDecodedJwtDebug = {
        ...__lastDecodedJwtDebug,
        decodeMode: "payload-only",
        decodeFailed: true,
        keys: null,
        hasEmail: false,
        hasSub: false,
      };
    }
    return decoded || null;
  }

  // 有 secret 且有 jsonwebtoken：正常 verify
  try {
    const decoded = jwt.verify(token, secret);
    if (decoded) {
      __lastDecodedJwtDebug = {
        ...__lastDecodedJwtDebug,
        decodeMode: "verify",
        keys: Object.keys(decoded || {}),
        hasEmail: !!decoded.email,
        hasSub: !!decoded.sub,
      };
    }
    return decoded || null;
  } catch {
    const decoded = decodeJwtPayload(token);
    if (decoded) {
      __lastDecodedJwtDebug = {
        ...__lastDecodedJwtDebug,
        decodeMode: "payload-only-after-verify-fail",
        keys: Object.keys(decoded || {}),
        hasEmail: !!decoded.email,
        hasSub: !!decoded.sub,
      };
      return decoded;
    }

    __lastDecodedJwtDebug = {
      ...__lastDecodedJwtDebug,
      decodeMode: "payload-only-after-verify-fail",
      decodeFailed: true,
      reason: "verify_failed_and_payload_decode_failed",
    };
    return null;
  }
}

// 後端決定「誰可以看到 groq key 變數名」
// 你可以在 backend/.env 設：DEBUG_GROQ_KEY_VIEWERS=aaa@bbb.com,ccc@ddd.com
function canViewerSeeGroqKey(req) {
  const allowList = parseCommaList(process.env.DEBUG_GROQ_KEY_VIEWERS);

  // 沒設定 allowList：預設全都不能看（安全）
  // if (allowList.length === 0) return false;

  const ident = getRequesterIdentity(req);
  if (!ident) return false;

  const email = String(ident.email || ident.user_metadata?.email || "").trim();
  const sub = String(ident.sub || ident.user_id || ident.id || "").trim();

  // allowList 允許填 email 或 user id（sub）
  return (email && allowList.includes(email)) || (sub && allowList.includes(sub));
}

// =============================
// API: /admin/usage
// =============================

router.get("/usage", (req, res) => {
  const days = parseInt(req.query.days, 10) || 7;

  const rows = getUsageSummary(days);

  // 兼容：舊資料只有 estTokens，新資料可能會有 realTokens / totalTokens
  const totalCalls = rows.reduce((sum, row) => sum + (row.callCount || 0), 0);

  const totalEstimatedTokens = rows.reduce(
    (sum, row) => sum + (row.estTokens || 0),
    0
  );

  const totalRealTokens = rows.reduce((sum, row) => {
    const rt =
      (typeof row.realTokens === "number" && row.realTokens) ||
      (typeof row.totalTokens === "number" && row.totalTokens) ||
      0;
    return sum + rt;
  }, 0);

  const monthStats = getMonthlyUsage();

  // 兼容：舊版 monthStats 只有 totalEstimatedTokens / byKind
  const monthName = monthStats.month;
  const byKind = monthStats.byKind || {};

  const monthEstimatedTotal = monthStats.totalEstimatedTokens || 0;
  const monthEstimatedLLM = byKind.llm || 0;
  const monthEstimatedTTS = byKind.tts || 0;

  // 若你下一輪把 usageLogger 升級成真實 tokens，這裡會自動顯示
  const byKindReal = monthStats.byKindReal || {};
  const monthRealTotal =
    typeof monthStats.totalTokensReal === "number"
      ? monthStats.totalTokensReal
      : 0;
  const monthRealLLM = byKindReal.llm || 0;
  const monthRealTTS = byKindReal.tts || 0;

  // 各別上限：LLM / TTS（依「你設定的 token limit」）
  const quotaLLMEnv = process.env.LLM_MONTHLY_TOKEN_LIMIT;
  const quotaTTSEnv = process.env.TTS_MONTHLY_TOKEN_LIMIT;

  const monthlyQuotaTokensLLM = quotaLLMEnv ? parseInt(quotaLLMEnv, 10) : null;
  const monthlyQuotaTokensTTS = quotaTTSEnv ? parseInt(quotaTTSEnv, 10) : null;

  // 估算各別還能撐幾天（先用「真實 token」若有，否則用估算 token）
  let estimatedDaysToHitQuotaLLM = null;
  let estimatedDaysToHitQuotaTTS = null;

  const today = new Date();
  const dayOfMonth = today.getDate(); // 1..31

  // LLM：先用真實，沒有就用估算
  const monthLLMForQuota = monthRealLLM > 0 ? monthRealLLM : monthEstimatedLLM;
  const monthTTSForQuota = monthRealTTS > 0 ? monthRealTTS : monthEstimatedTTS;

  if (
    monthlyQuotaTokensLLM &&
    Number.isFinite(monthlyQuotaTokensLLM) &&
    monthlyQuotaTokensLLM > 0 &&
    monthLLMForQuota > 0 &&
    dayOfMonth > 0
  ) {
    const avgDaily = monthLLMForQuota / dayOfMonth;
    const remaining = monthlyQuotaTokensLLM - monthLLMForQuota;
    if (remaining <= 0) {
      estimatedDaysToHitQuotaLLM = 0;
    } else if (avgDaily > 0) {
      estimatedDaysToHitQuotaLLM = remaining / avgDaily;
    }
  }

  if (
    monthlyQuotaTokensTTS &&
    Number.isFinite(monthlyQuotaTokensTTS) &&
    monthlyQuotaTokensTTS > 0 &&
    monthTTSForQuota > 0 &&
    dayOfMonth > 0
  ) {
    const avgDaily = monthTTSForQuota / dayOfMonth;
    const remaining = monthlyQuotaTokensTTS - monthTTSForQuota;
    if (remaining <= 0) {
      estimatedDaysToHitQuotaTTS = 0;
    } else if (avgDaily > 0) {
      estimatedDaysToHitQuotaTTS = remaining / avgDaily;
    }
  }

  // ---- ✅ Debug block (always returned, backend decides visibility) ----
  const canView = canViewerSeeGroqKey(req);

  let groqIndex = null;
  let groqTotal = null;
  let groqKeyVar = null;

  try {
    const info = groqClient?.getCurrentKeyInfo?.();
    if (info && Number.isFinite(info.index) && Number.isFinite(info.total)) {
      groqIndex = info.index;
      groqTotal = info.total;

      // 只用「變數名」：GROQ_API_KEY_003...
      const varNames = listGroqKeyVarNamesFromEnv();
      if (canView && varNames.length > 0 && varNames[groqIndex]) {
        groqKeyVar = varNames[groqIndex];
      }
    }
  } catch {
    // ignore
  }

  // ---- UI-friendly usage summary (to match the old /api/usage/me shape) ----
  // We compute "today.byKind" from the rows we already have.
  const todayISO = new Date().toISOString().slice(0, 10);

  function endpointToKind(endpoint) {
    if (!endpoint || typeof endpoint !== "string") return null;
    if (endpoint.startsWith("/api/tts")) return "tts";
    if (endpoint.startsWith("/api/")) return "llm";
    return null;
  }

  function rowTokensForUi(row) {
    // Prefer real tokens if present; otherwise fall back to estimated tokens.
    const rt =
      (typeof row.realTokens === "number" && row.realTokens) ||
      (typeof row.totalTokens === "number" && row.totalTokens) ||
      0;
    if (rt > 0) return rt;
    return typeof row.estTokens === "number" ? row.estTokens : 0;
  }

  const todayByKind = { llm: 0, tts: 0 };
  for (const row of rows) {
    if (!row || row.date !== todayISO) continue;
    const kind = endpointToKind(row.endpoint);
    if (!kind) continue;
    todayByKind[kind] += rowTokensForUi(row);
  }

  // For month summary in the UI: prefer real tokens if available, otherwise use estimated.
  const monthByKind = {
    llm: monthRealLLM > 0 ? monthRealLLM : monthEstimatedLLM,
    tts: monthRealTTS > 0 ? monthRealTTS : monthEstimatedTTS,
  };

  const result = {
    days,
    totalCalls,

    // 最近 N 天
    totalEstimatedTokens,
    totalRealTokens,

    // UI-compatible summary
    today: { byKind: todayByKind },
    month: { byKind: monthByKind },

    rows,

    // 本月：月份字串（⚠️ 不要用 month 這個 key，避免覆蓋 month.byKind）
    monthLabel: monthName,
    monthEstimatedTokens: monthEstimatedTotal,
    monthEstimatedTokensLLM: monthEstimatedLLM,
    monthEstimatedTokensTTS: monthEstimatedTTS,

    monthRealTokens: monthRealTotal,
    monthRealTokensLLM: monthRealLLM,
    monthRealTokensTTS: monthRealTTS,

    // Quota
    monthlyQuotaTokens: null,
    monthlyQuotaTokensLLM: monthlyQuotaTokensLLM || null,
    monthlyQuotaTokensTTS: monthlyQuotaTokensTTS || null,
    estimatedDaysToHitQuotaLLM,
    estimatedDaysToHitQuotaTTS,

    // ✅ always present; frontend decides whether to show
    __debug: {
      groq: {
        canView,
        currentKeyVar: groqKeyVar, // null if not allowed
        index: groqIndex,
        total: groqTotal,
      },
      jwt: __lastDecodedJwtDebug,
    },
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(result, null, 2));
});

// =============================
// Dashboard: /admin/dashboard
// =============================

router.get("/dashboard", (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <title>LanguageApp – Usage Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg: #0f172a;
      --bg-elevated: #111827;
      --card-bg: #020617;
      --border-subtle: #1f2933;
      --accent: #38bdf8;
      --accent-soft: rgba(56, 189, 248, 0.1);
      --text-main: #e5e7eb;
      --text-muted: #9ca3af;
      --danger: #f97373;
      --warn: #facc15;
      --llm: #38bdf8;
      --tts: #f97373;
      --real: #a78bfa;
      --real-soft: rgba(167, 139, 250, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at top, #1e293b 0, #020617 55%);
      color: var(--text-main);
    }
    .page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 20px 16px 40px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h1 span.badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .controls {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
    .controls label {
      font-size: 12px;
      color: var(--text-muted);
    }
    select, button {
      background: rgba(15, 23, 42, 0.9);
      border-radius: 999px;
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      padding: 6px 12px;
      font-size: 12px;
      outline: none;
    }
    button {
      cursor: pointer;
      background: linear-gradient(135deg, #38bdf8, #0ea5e9);
      border: none;
      color: #0b1120;
      font-weight: 600;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.8), 0 8px 20px rgba(15, 23, 42, 0.9);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    button span.icon { font-size: 14px; }
    button:active {
      transform: translateY(1px);
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.9);
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .card {
      background: radial-gradient(circle at top left, #1e293b 0, #020617 55%);
      border-radius: 16px;
      border: 1px solid var(--border-subtle);
      padding: 10px 12px;
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 0;
      opacity: 0.14;
      background: radial-gradient(circle at top right, #38bdf8 0, transparent 45%);
      pointer-events: none;
    }
    .card-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pill {
      font-size: 10px;
      padding: 1px 7px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.5);
      background: rgba(15, 23, 42, 0.9);
      color: var(--text-muted);
    }
    .pill-llm {
      border-color: rgba(56, 189, 248, 0.7);
      background: rgba(56, 189, 248, 0.1);
      color: #e0f2fe;
    }
    .pill-tts {
      border-color: rgba(249, 115, 129, 0.7);
      background: rgba(249, 115, 129, 0.1);
      color: #fee2e2;
    }
    .pill-real {
      border-color: rgba(167, 139, 250, 0.75);
      background: var(--real-soft);
      color: #ede9fe;
    }
    .card-main {
      font-size: 20px;
      font-weight: 600;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .card-main span.unit {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 400;
    }
    .card-extra {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
      line-height: 1.4;
    }
    .card-extra strong {
      color: var(--accent);
      font-weight: 500;
    }
    .card-danger .card-main { color: var(--danger); }
    .card-warn .card-main { color: var(--warn); }

    .card-small-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
      gap: 10px;
    }

    .table-card {
      background: var(--bg-elevated);
      border-radius: 16px;
      border: 1px solid var(--border-subtle);
      padding: 10px 12px 14px;
    }
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      gap: 10px;
    }
    .table-header-title {
      font-size: 13px;
      font-weight: 500;
    }
    .table-header-sub {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .table-wrapper {
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid rgba(15, 23, 42, 0.8);
      background: radial-gradient(circle at top left, rgba(148, 163, 184, 0.08), #020617);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      min-width: 650px;
    }
    thead { background: rgba(15, 23, 42, 0.95); }
    th, td {
      padding: 6px 10px;
      text-align: left;
      border-bottom: 1px solid rgba(15, 23, 42, 0.9);
      white-space: nowrap;
    }
    th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
    }
    tbody tr:nth-child(odd) { background: rgba(15, 23, 42, 0.7); }
    tbody tr:nth-child(even) { background: rgba(15, 23, 42, 0.55); }
    .endpoint-tag {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.4);
      background: rgba(15, 23, 42, 0.8);
      color: #e5e7eb;
    }
    .endpoint-tag.api-analyze {
      border-color: rgba(56, 189, 248, 0.7);
      background: rgba(56, 189, 248, 0.1);
      color: #e0f2fe;
    }
    .endpoint-tag.api-tts {
      border-color: rgba(249, 115, 129, 0.7);
      background: rgba(249, 115, 129, 0.1);
      color: #fee2e2;
    }
    .endpoint-tag.api-dict {
      border-color: rgba(52, 211, 153, 0.7);
      background: rgba(52, 211, 153, 0.1);
      color: #dcfce7;
    }
    .footnote {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 6px;
      line-height: 1.4;
    }
    .status {
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #22c55e;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.8);
    }
    .status-dot.offline {
      background: #ef4444;
      box-shadow: 0 0 10px rgba(248, 113, 113, 0.8);
    }
    .error {
      margin-top: 10px;
      font-size: 11px;
      color: #fecaca;
    }
    @media (max-width: 600px) {
      h1 { font-size: 18px; }
      .page { padding-inline: 12px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <h1>
      Token Usage
      <span class="badge">LanguageApp · Internal</span>
    </h1>
    <div class="subtitle">
      本頁同時顯示：<span class="pill pill-real">真實 tokens</span>（若後端有寫入供應商 usage）與 <span class="pill">估算 tokens</span>（字元 / 4，fallback）。<br/>
      你目前的紀錄大多只有估算 tokens，所以真實 tokens 可能顯示為「–」。等你下一輪把 Groq 回傳 usage 寫入 log 後，這裡會自動開始顯示真實值。
    </div>

    <div class="controls">
      <label>
        最近天數：
        <select id="daysSelect">
          <option value="7">7 天</option>
          <option value="14">14 天</option>
          <option value="30" selected>30 天</option>
        </select>
      </label>
      <button id="refreshBtn">
        <span class="icon">⟳</span>
        重新整理
      </button>
      <div class="status" id="statusBox">
        <span class="status-dot"></span>
        <span id="statusText">載入中…</span>
      </div>
    </div>

    <div class="summary-grid">
      <div class="card">
        <div class="card-title">最近呼叫次數</div>
        <div class="card-main">
          <span id="totalCalls">–</span>
          <span class="unit">calls</span>
        </div>
        <div class="card-extra">
          覆蓋區間：<span id="summaryRange">–</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          最近 TOKENS
          <span class="pill pill-real">真實</span>
        </div>
        <div class="card-main">
          <span id="totalTokensReal">–</span>
          <span class="unit">tokens</span>
        </div>
        <div class="card-extra" id="realHintRecent">
          若顯示「–」，表示後端目前尚未把供應商 usage 寫入 log。
        </div>
      </div>

      <div class="card">
        <div class="card-title">最近 TOKENS <span class="pill">估算</span></div>
        <div class="card-main">
          <span id="totalTokensEstimated">–</span>
          <span class="unit">tokens</span>
        </div>
        <div class="card-extra">
          估算方法：字元 / 4（僅供趨勢參考）。
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          本月 TOKENS
          <span class="pill pill-real">真實</span>
          <span class="pill pill-llm">LLM</span>
        </div>
        <div class="card-main">
          <span id="monthTokensLLMReal">–</span>
          <span class="unit">tokens</span>
        </div>
        <div class="card-extra">
          本月：<strong id="monthName">–</strong>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          本月 TOKENS
          <span class="pill pill-real">真實</span>
          <span class="pill pill-tts">TTS</span>
        </div>
        <div class="card-main">
          <span id="monthTokensTTSReal">–</span>
          <span class="unit">tokens</span>
        </div>
        <div class="card-extra">
          若真實值為「–」，會先以估算值作趨勢。
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          本月 TOKENS <span class="pill">估算</span> <span class="pill pill-llm">LLM</span>
        </div>
        <div class="card-main">
          <span id="monthTokensLLMEstimated">–</span>
          <span class="unit">tokens</span>
        </div>
        <div class="card-extra">
          本月：<strong id="monthName2">–</strong>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          本月 TOKENS <span class="pill">估算</span> <span class="pill pill-tts">TTS</span>
        </div>
        <div class="card-main">
          <span id="monthTokensTTSEstimated">–</span>
          <span class="unit">tokens</span>
        </div>
        <div class="card-extra">
          若 TTS_MONTHLY_TOKEN_LIMIT 有設，下面會顯示剩餘天數。
        </div>
      </div>

      <div class="card">
        <div class="card-title">平均每日用量（以真實優先）</div>
        <div class="card-main">
          <span id="avgDailyTotal">–</span>
          <span class="unit">tokens / day</span>
        </div>
        <div class="card-small-row">
          <span>LLM：<span id="avgDailyLLM">–</span></span>
          <span>TTS：<span id="avgDailyTTS">–</span></span>
        </div>
        <div class="card-extra">
          若真實 token 為 0（尚未寫入），會改用估算 token 計算。
        </div>
      </div>

      <div class="card card-warn" id="quotaCard">
        <div class="card-title">距離月度上限（LLM / TTS）</div>
        <div class="card-main">
          <span id="daysToQuota">–</span>
          <span class="unit">days (LLM)</span>
        </div>
        <div class="card-extra" id="quotaDesc">
          若在 backend/.env 設定 LLM_MONTHLY_TOKEN_LIMIT、TTS_MONTHLY_TOKEN_LIMIT，這裡會顯示各別粗估剩餘天數與使用百分比。
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-header">
        <div>
          <div class="table-header-title">依日期 / Endpoint 用量</div>
          <div class="table-header-sub" id="tableSubtitle">
            尚無紀錄，先在前端查一個字或播放一次 TTS 看看。
          </div>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>Endpoint</th>
              <th>呼叫次數</th>
              <th>真實 Tokens</th>
              <th>估算 Tokens</th>
            </tr>
          </thead>
          <tbody id="usageTableBody"></tbody>
        </table>
      </div>
      <div class="footnote">
        註 1：真實 tokens 需要後端把供應商回傳的 usage 寫入 log（例如 Groq 的 prompt/completion/total）。<br/>
        註 2：估算 tokens（字元/4）仍保留作為 fallback（例如 TTS 或拿不到 usage 的情況）。<br/>
        註 3：此處只統計你自己的 LanguageApp 後端呼叫次數，不包含你在 Groq 後台手動測試的用量。
      </div>
      <div class="error" id="errorBox" style="display:none;"></div>
    </div>
  </div>

  <script>
    const statusDot = document.querySelector(".status-dot");
    const statusText = document.getElementById("statusText");
    const daysSelect = document.getElementById("daysSelect");
    const refreshBtn = document.getElementById("refreshBtn");
    const tableBody = document.getElementById("usageTableBody");
    const tableSubtitle = document.getElementById("tableSubtitle");
    const errorBox = document.getElementById("errorBox");

    const totalCallsEl = document.getElementById("totalCalls");

    const totalTokensRealEl = document.getElementById("totalTokensReal");
    const totalTokensEstimatedEl = document.getElementById("totalTokensEstimated");

    const monthTokensLLMRealEl = document.getElementById("monthTokensLLMReal");
    const monthTokensTTSRealEl = document.getElementById("monthTokensTTSReal");
    const monthTokensLLMEstimatedEl = document.getElementById("monthTokensLLMEstimated");
    const monthTokensTTSEstimatedEl = document.getElementById("monthTokensTTSEstimated");

    const monthNameEl = document.getElementById("monthName");
    const monthNameEl2 = document.getElementById("monthName2");

    const avgDailyTotalEl = document.getElementById("avgDailyTotal");
    const avgDailyLLMEl = document.getElementById("avgDailyLLM");
    const avgDailyTTSEEl = document.getElementById("avgDailyTTS");

    const summaryRangeEl = document.getElementById("summaryRange");

    const quotaCard = document.getElementById("quotaCard");
    const daysToQuotaEl = document.getElementById("daysToQuota");
    const quotaDescEl = document.getElementById("quotaDesc");

    function setStatus(online, text) {
      if (online) {
        statusDot.classList.remove("offline");
      } else {
        statusDot.classList.add("offline");
      }
      statusText.textContent = text;
    }

    function formatNumber(n) {
      if (n == null || isNaN(n)) return "–";
      if (n >= 1000000) return (n / 1000000).toFixed(2).replace(/\\.00$/, "") + "M";
      if (n >= 1000) return (n / 1000).toFixed(1).replace(/\\.0$/, "") + "k";
      return String(Math.round(n));
    }

    function formatFullNumber(n) {
      if (n == null || isNaN(n)) return "–";
      return n.toLocaleString("en-US");
    }

    function classifyEndpointTag(endpoint) {
      if (endpoint.startsWith("/api/analyze")) return "api-analyze";
      if (endpoint.startsWith("/api/tts")) return "api-tts";
      if (endpoint.startsWith("/api/dictionary")) return "api-dict";
      if (endpoint.startsWith("/api/conversation")) return "api-dict";
      return "";
    }

    async function loadUsage() {
      const days = Number(daysSelect.value) || 30;
      setStatus(true, "載入中…");
      errorBox.style.display = "none";
      errorBox.textContent = "";

      try {
        const res = await fetch("/admin/usage?days=" + days);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();

        totalCallsEl.textContent = formatNumber(data.totalCalls);
        const recentReal = data.totalRealTokens ?? 0;
        const recentEst = data.totalEstimatedTokens ?? 0;

        totalTokensRealEl.textContent = recentReal > 0 ? formatNumber(recentReal) : "–";
        totalTokensEstimatedEl.textContent = formatNumber(recentEst);

        const monthLLMReal = data.monthRealTokensLLM ?? 0;
        const monthTTSReal = data.monthRealTokensTTS ?? 0;

        const monthLLMEst = data.monthEstimatedTokensLLM ?? data.monthEstimatedTokens ?? 0;
        const monthTTSEst = data.monthEstimatedTokensTTS ?? 0;

        monthTokensLLMRealEl.textContent = monthLLMReal > 0 ? formatNumber(monthLLMReal) : "–";
        monthTokensTTSRealEl.textContent = monthTTSReal > 0 ? formatNumber(monthTTSReal) : "–";

        monthTokensLLMEstimatedEl.textContent = formatNumber(monthLLMEst);
        monthTokensTTSEstimatedEl.textContent = formatNumber(monthTTSEst);

        // ✅ 這裡改成 monthLabel（避免和 month.byKind 衝突）
        monthNameEl.textContent = data.monthLabel || "–";
        monthNameEl2.textContent = data.monthLabel || "–";

        const today = new Date();
        const endDate = today.toISOString().slice(0, 10);
        const startDate = new Date(today.getTime() - (days - 1) * 86400000)
          .toISOString()
          .slice(0, 10);
        summaryRangeEl.textContent = startDate + " ~ " + endDate;

        // 平均每日用量（真實優先，沒有就用估算）
        const dayOfMonth = today.getDate();
        const monthTotalReal = (data.monthRealTokensLLM ?? 0) + (data.monthRealTokensTTS ?? 0);
        const monthTotalEst = (data.monthEstimatedTokensLLM ?? 0) + (data.monthEstimatedTokensTTS ?? 0);

        const monthTotalForAvg = monthTotalReal > 0 ? monthTotalReal : monthTotalEst;
        const monthLLMForAvg = (data.monthRealTokensLLM ?? 0) > 0 ? (data.monthRealTokensLLM ?? 0) : (data.monthEstimatedTokensLLM ?? 0);
        const monthTTSForAvg = (data.monthRealTokensTTS ?? 0) > 0 ? (data.monthRealTokensTTS ?? 0) : (data.monthEstimatedTokensTTS ?? 0);

        let avgDailyTotal = null;
        let avgDailyLLM = null;
        let avgDailyTTS = null;

        if (dayOfMonth > 0) {
          avgDailyTotal = monthTotalForAvg / dayOfMonth;
          avgDailyLLM = monthLLMForAvg / dayOfMonth;
          avgDailyTTS = monthTTSForAvg / dayOfMonth;
        }

        avgDailyTotalEl.textContent = avgDailyTotal == null ? "–" : formatNumber(avgDailyTotal);
        avgDailyLLMEl.textContent = avgDailyLLM == null ? "–" : formatFullNumber(Math.round(avgDailyLLM));
        avgDailyTTSEEl.textContent = avgDailyTTS == null ? "–" : formatFullNumber(Math.round(avgDailyTTS));

        // Quota（原樣保留）
        const quotaLLM = data.monthlyQuotaTokensLLM || null;
        const quotaTTS = data.monthlyQuotaTokensTTS || null;
        const daysLLM = data.estimatedDaysToHitQuotaLLM;
        const daysTTS = data.estimatedDaysToHitQuotaTTS;

        let quotaTextLines = [];
        let worstPct = 0;

        if (quotaLLM && quotaLLM > 0) {
          const used = monthLLMForAvg * dayOfMonth;
          const remain = Math.max(quotaLLM - used, 0);
          const usedPct = quotaLLM > 0 ? (used / quotaLLM) * 100 : 0;
          worstPct = Math.max(worstPct, usedPct);
          const daysText = daysLLM == null ? "天數不足以估算" : daysLLM.toFixed(1) + " 天";

          quotaTextLines.push(
            "LLM：已用約 " +
              usedPct.toFixed(1) +
              "%，剩餘 " +
              formatFullNumber(remain) +
              " tokens（粗估），約 " +
              daysText +
              "。"
          );

          daysToQuotaEl.textContent = daysLLM == null ? "–" : daysLLM.toFixed(1);
        }

        if (quotaTTS && quotaTTS > 0) {
          const used = monthTTSForAvg * dayOfMonth;
          const remain = Math.max(quotaTTS - used, 0);
          const usedPct = quotaTTS > 0 ? (used / quotaTTS) * 100 : 0;
          worstPct = Math.max(worstPct, usedPct);
          const daysText = daysTTS == null ? "天數不足以估算" : daysTTS.toFixed(1) + " 天";

          quotaTextLines.push(
            "TTS：已用約 " +
              usedPct.toFixed(1) +
              "%，剩餘 " +
              formatFullNumber(remain) +
              " tokens（粗估），約 " +
              daysText +
              "。"
          );

          if (!quotaLLM) {
            daysToQuotaEl.textContent = daysTTS == null ? "–" : daysTTS.toFixed(1);
          }
        }

        if (!quotaLLM && !quotaTTS) {
          daysToQuotaEl.textContent = "–";
          quotaCard.classList.remove("card-warn", "card-danger");
          quotaDescEl.textContent =
            "若在 backend/.env 設定 LLM_MONTHLY_TOKEN_LIMIT、TTS_MONTHLY_TOKEN_LIMIT，這裡會顯示各別粗估剩餘天數與使用百分比。";
        } else {
          if (worstPct >= 90) {
            quotaCard.classList.add("card-danger");
            quotaCard.classList.remove("card-warn");
          } else if (worstPct >= 70) {
            quotaCard.classList.add("card-warn");
            quotaCard.classList.remove("card-danger");
          } else {
            quotaCard.classList.remove("card-warn", "card-danger");
          }
          quotaDescEl.innerHTML = quotaTextLines
            .map(function (line) { return '<div>' + line + '</div>'; })
            .join("");
        }

        // Table
        tableBody.innerHTML = "";
        const rows = Array.isArray(data.rows) ? data.rows : [];

        if (rows.length === 0) {
          tableSubtitle.textContent =
            "尚無紀錄。先在前端查一個字、產生例句或播放一次 TTS 看看。";
        } else {
          tableSubtitle.textContent =
            "依日期、Endpoint 彙總的呼叫次數，以及真實/估算 tokens。";
        }

        rows.forEach(function (row) {
          const tr = document.createElement("tr");

          const tdDate = document.createElement("td");
          tdDate.textContent = row.date || "-";

          const tdEndpoint = document.createElement("td");
          const span = document.createElement("span");
          span.className = "endpoint-tag " + classifyEndpointTag(row.endpoint || "");
          span.textContent = row.endpoint || "-";
          tdEndpoint.appendChild(span);

          const tdCalls = document.createElement("td");
          tdCalls.textContent = row.callCount != null ? row.callCount : "-";

          const tdReal = document.createElement("td");
          const rt = (row.realTokens ?? row.totalTokens ?? 0);
          tdReal.textContent = rt > 0 ? formatFullNumber(rt) : "–";

          const tdEst = document.createElement("td");
          tdEst.textContent = row.estTokens != null ? formatFullNumber(row.estTokens) : "-";

          tr.appendChild(tdDate);
          tr.appendChild(tdEndpoint);
          tr.appendChild(tdCalls);
          tr.appendChild(tdReal);
          tr.appendChild(tdEst);

          tableBody.appendChild(tr);
        });

        setStatus(true, "最後更新：" + new Date().toLocaleTimeString());
      } catch (err) {
        console.error("[dashboard] loadUsage error:", err);
        setStatus(false, "載入失敗");
        errorBox.style.display = "block";
        errorBox.textContent =
          "載入 /admin/usage 失敗：" + (err.message || String(err));
      }
    }

    refreshBtn.addEventListener("click", loadUsage);
    daysSelect.addEventListener("change", loadUsage);
    loadUsage();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

module.exports = router;
