// PATH: frontend/src/utils/apiClient.js
// frontend/src/utils/apiClient.js
/**
 * 文件說明：
 * - 本檔提供前端統一的 API 呼叫入口 apiFetch()
 * - 負責：
 *   1) 統一 API_BASE 組合
 *   2) 自動附加 Authorization: Bearer <access_token>（若存在）
 *   3) 自動補齊 Content-Type: application/json（避免後端 req.body = undefined）
 *   4) 提供 Production 排查用的初始化狀態（initStatus）
 *
 * 異動紀錄（必須保留舊紀錄；本次僅追加）：
 * - 2025-12-17
 *   - 修正：當 request 有 body 且未指定 Content-Type 時，自動補上 application/json
 *     目的：避免後端 Express 無法 parse JSON，導致 req.body 為 undefined（analyzeRoute destructure 直接噴錯）
 *   - 新增：initStatus（Production 排查用），記錄 lastRequest / lastError / ready
 *
 * - 2026-01-07
 *   - 修正：Supabase auth-token localStorage key 不可寫死（Vercel / 不同環境可能不同）
 *     改為掃描 localStorage key（包含 "auth-token"），以提升 Production 穩定性
 *   - 新增：initStatus.lastAuthTokenKey（Production 排查）
 *
 * - 2026-01-30
 *   - 長期修正：移除 apiFetch 對 localStorage 掃描 sb-...-auth-token 的 fallback 讀取
 *     改為只使用 authTokenStore（由 AuthProvider 單一出口更新）
 *     目的：避免 refresh restore 窗口碰 localStorage 造成 Supabase auth 卡住 / 權限飄移
 *
 * - 2026-02-05
 *   - 修正：本機開發不再預設強制打 http://localhost:4000
 *     改為：優先 VITE_API_BASE_URL；若為 localhost/127.0.0.1 且未設定 env，則使用同源（API_BASE = ""）
 */

import { getAuthAccessToken } from "./authTokenStore";

// ======================================
// ✅ Anonymous identity (visit id)
// - Used for server-side anonymous daily quota (10/day)
// - Stored in localStorage and forwarded via header: x-visit-id
// ======================================
const VISIT_ID_STORAGE_KEY = "solang_visit_id";

function getOrCreateVisitId() {
  try {
    const existing = localStorage.getItem(VISIT_ID_STORAGE_KEY);
    if (existing && typeof existing === "string" && existing.trim()) return existing.trim();
    const id =
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}-${Math.random()}`)
        .toString()
        .trim();
    // If fallback was used, it won't be uuid; server will ignore for quota.
    localStorage.setItem(VISIT_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return "";
  }
}
// ===== [20260202 support] console logger =====
const __SUPPORT_TRACE_ON =
  typeof import.meta !== "undefined" &&
  import.meta?.env?.VITE_DEBUG_SUPPORT_ADMIN === "1";
function __supportTrace(...args) {
  if (!__SUPPORT_TRACE_ON) return;
  try { console.log("[20260202 support]", ...args); } catch (_) {}
}
// ===== end logger =====

// ✅ Proof trace（不影響正式執行）：.env -> VITE_AUTH_PROOF=1
const AUTH_PROOF = import.meta.env.VITE_AUTH_PROOF === "1";
const proof = (...args) => {
  if (AUTH_PROOF) console.log("[***A]", ...args);
};


// ======================================
// 統一 API_BASE（2026-02-05 修正：避免本機寫死 4000）
// 優先順序：
//  1) VITE_API_BASE_URL（由開發者明確指定）
//  2) 本機（localhost/127.0.0.1）：同源（API_BASE = ""）
//  3) 其他：沿用既有 Production 預設
// ======================================
const __ENV_API_BASE = import.meta.env.VITE_API_BASE_URL;
const __IS_LOCALHOST =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const API_BASE =
  __ENV_API_BASE ||
  (__IS_LOCALHOST ? "" : "https://languageapp-8j45.onrender.com");
try { console.info("[apiFetch] module loaded"); } catch (_) {}

// ======================================
// Production 排查：初始化狀態
// ======================================
const initStatus = {
  module: "frontend/src/utils/apiClient.js",
  createdAt: new Date().toISOString(),
  apiBase: API_BASE,
  ready: true,
  lastRequest: null,
  lastError: null,
  lastAuthTokenKey: "not available", // 2026-01-07: Production 排查
};

// ======================================
// 功能：找出 Supabase auth-token 的 localStorage key（避免寫死）
// - 2026-01-07 新增：Vercel / 不同環境 key 可能不同
// ======================================
function findSupabaseAuthTokenKey() {
  // ❌ Deprecated: do NOT scan localStorage for sb-...-auth-token.
  // 唯一 token 出口：authTokenStore.getAuthAccessToken()
  return null;
}

// ======================================
// 功能：從 Supabase localStorage 取 access_token
// - 2026-01-07 修正：不可寫死 key
// ======================================
function getAccessToken() {
  try {
    // legacy（deprecated 2026-01-07）：寫死 key 容易在 Vercel / 不同環境失效
    // const raw = localStorage.getItem("sb-yeemivptkzwqcnuzexdl-auth-token");

    const key = null; // disabled localStorage scan
    initStatus.lastAuthTokenKey = key || "not available";

    if (!key) return null;

    const raw = null;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.currentSession?.access_token || null;
  } catch {
    initStatus.lastAuthTokenKey = "not available";
    return null;
  }
}


// ======================================
// 功能：檢查 headers 是否已經有 Content-Type
// - 注意：Header key 可能是 Content-Type 或 content-type（大小寫不同）
// ======================================
function hasContentTypeHeader(headers) {
  if (!headers || typeof headers !== "object") return false;
  const keys = Object.keys(headers);
  return keys.some((k) => String(k).toLowerCase() === "content-type");
}

// ======================================
// 功能：確保 JSON 請求具備 Content-Type
// - 僅在「有 body」且「未手動指定 Content-Type」時補上
// - 不覆蓋使用者本來就想送的 Content-Type（例如 multipart/form-data）
// ======================================
function ensureJsonContentTypeIfNeeded(headers, options) {
  const next = { ...(headers || {}) };

  const hasBody =
    options &&
    Object.prototype.hasOwnProperty.call(options, "body") &&
    options.body !== undefined &&
    options.body !== null;

  if (!hasBody) return next;

  if (hasContentTypeHeader(next)) return next;

  // 你目前 App.jsx 會用 JSON.stringify(...) 傳 body
  // 若沒有 Content-Type，後端 express.json() 可能不會 parse，導致 req.body undefined
  next["Content-Type"] = "application/json";

  return next;
}

/**
 * 功能：apiFetch(path, options)
 * - path：只接受「路徑」，例如 "/api/analyze"、"/api/library?limit=3"
 * - options：fetch options
 * - 行為：
 *   1) 自動加 Authorization header（若有 token）
 *   2) 若有 body 且未指定 Content-Type，自動補 application/json
 *   3) 記錄 initStatus 方便 Production 排查
 */
export async function apiFetch(path, options = {}) {
  __supportTrace("apiClient:apiFetch", { path });

  __supportTrace('apiClient:apiFetch:enter', { path, hasOptions: !!options });
  initStatus.lastRequest = {
    at: new Date().toISOString(),
    path,
    method: options?.method || "GET",
  };
  initStatus.lastError = null;

  // 保留呼叫端既有 headers
  let headers = {
    ...(options.headers || {}),
  };

  // ✅ 自動補 JSON Content-Type（本輪修正點）
  headers = ensureJsonContentTypeIfNeeded(headers, options);

  // ✅ 自動補 Authorization（只使用 authTokenStore：由 AuthProvider 單一出口更新）
  const token = getAuthAccessToken();
  __supportTrace('apiClient:token', { hasToken: !!token, tokenLen: token ? String(token).length : 0 });
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    // ✅ Anonymous quota key (server-side enforcement)
    const visitId = getOrCreateVisitId();
    if (visitId) headers["x-visit-id"] = visitId;
  }

  try {
    try {
      try { console.info("[apiFetch] request", { path, url: `${API_BASE}${path}` }); } catch (_) {}
      const __resp = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
          });
      try { console.info("[apiFetch] response", { path, status: __resp.status }); } catch (_) {}
      if (!__resp.ok) {
        const __clone = __resp.clone();
        let __txt = "";
        try { __txt = await __clone.text(); } catch (_) { __txt = ""; }
        let __json = null;
        try { __json = __txt ? JSON.parse(__txt) : null; } catch (_) { __json = null; }
        try {
          console.error("[apiFetch] HTTP error", {
            path,
            url: `${API_BASE}${path}`,
            status: __resp.status,
            statusText: __resp.statusText,
            body: __json || (__txt ? __txt.slice(0, 800) : ""),
          });
        } catch (_) {}
      }

      // ✅ Anonymous daily limit hint (UI)
      // - Server returns: 429 { error: "ANON_DAILY_LIMIT_REACHED" }
      // - We do NOT consume body (use clone)
      try {
        if (__resp.status === 429) {
          const __clone429 = __resp.clone();
          let __p = null;
          try { __p = await __clone429.json(); } catch (_) { __p = null; }
          if (__p && __p.error === "ANON_DAILY_LIMIT_REACHED") {
            // Event hook (preferred)
            try {
              window.dispatchEvent(
                new CustomEvent("anon-daily-limit", { detail: { ...__p, path } })
              );
            } catch (_) {}

            // Minimal fallback: alert once per page load
            if (true) {
              try { window.alert("如果要查詢更多，請註冊會員"); } catch (_) {}
            }
          }
        }
      } catch (_) {}
      return __resp;
    } catch (e) {
      try { console.error("[apiFetch] fetch threw", { path, message: (e && (e.message || e.toString())) ? (e.message || e.toString()) : "UNKNOWN" }); } catch (_) {}
      throw e;
    }
  } catch (e) {
    initStatus.lastError = String(e?.message || e);
    throw e;
  }
}

export { API_BASE, initStatus };

// frontend/src/utils/apiClient.js
// END PATH: frontend/src/utils/apiClient.js









// PATCH: ensure uiLang is forwarded when calling pronunciation-tips
