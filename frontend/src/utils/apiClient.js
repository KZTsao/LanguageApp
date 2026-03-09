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

// UUID v4 generator (fallback when crypto.randomUUID is not available)
// - Must be "uuid-like" because backend enforces anon quota only when visit-id looks like UUID.
function __uuidV4Fallback() {
  try {
    const rnd = (n) => {
      // return a number in [0, n)
      try {
        if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
          const buf = new Uint8Array(1);
          crypto.getRandomValues(buf);
          return buf[0] % n;
        }
      } catch {
        // ignore
      }
      return Math.floor(Math.random() * n);
    };

    const hex = (len) => {
      let out = "";
      for (let i = 0; i < len; i++) out += "0123456789abcdef"[rnd(16)];
      return out;
    };

    // UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (y: 8..b)
    const a = hex(8);
    const b = hex(4);
    const c = `4${hex(3)}`;
    const y = "89ab"[rnd(4)];
    const d = `${y}${hex(3)}`;
    const e = hex(12);
    return `${a}-${b}-${c}-${d}-${e}`;
  } catch {
    // Worst-case fallback: still return a uuid-like string
    return "00000000-0000-4000-8000-000000000000";
  }
}

function getOrCreateVisitId() {
  try {
    const existing = localStorage.getItem(VISIT_ID_STORAGE_KEY);
    if (existing && typeof existing === "string" && existing.trim()) return existing.trim();
    const id =
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : __uuidV4Fallback())
        .toString()
        .trim();
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
// ✅ Backward-compat fallback: read Supabase token from localStorage ONCE
// - Reason: authTokenStore may not be hydrated yet (page refresh timing)
// - Safety: read-only; single scan per page load; cache result
// - This re-introduces the old capability in a strictly-limited way.
// ======================================
const __legacyTokenCache = {
  checked: false,
  key: null,
  token: null,
};

function __looksLikeJwt(token) {
  try {
    const s = String(token || "").trim();
    if (!s) return false;
    const parts = s.split(".");
    return parts.length === 3 && parts.every((p) => p && p.length > 8);
  } catch {
    return false;
  }
}

function getLegacyAccessTokenFromLocalStorageOnce() {
  try {
    if (__legacyTokenCache.checked) return __legacyTokenCache.token;
    __legacyTokenCache.checked = true;

    // Only read; never write; never mutate Supabase state.
    const keys = Object.keys(localStorage || {});
    const candidates = keys
      .filter((k) => String(k).includes("auth-token"))
      // Prefer supabase-like keys first (sb-...-auth-token)
      .sort((a, b) => (String(b).startsWith("sb-") ? 1 : 0) - (String(a).startsWith("sb-") ? 1 : 0));

    for (const k of candidates) {
      let raw = null;
      try {
        raw = localStorage.getItem(k);
      } catch {
        raw = null;
      }
      if (!raw) continue;

      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }

      const t =
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token ||
        null;
      if (t && __looksLikeJwt(t)) {
        __legacyTokenCache.key = k;
        __legacyTokenCache.token = t;
        initStatus.lastAuthTokenKey = k;
        return t;
      }
    }

    return null;
  } catch {
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

  const body = options.body;

  // IMPORTANT: do NOT force JSON for FormData / binary bodies
  // - FormData: browser will set multipart/form-data boundary automatically
  // - Blob/ArrayBuffer/TypedArray: typically used for binary uploads (e.g. ASR audio)
  try {
    if (typeof FormData !== "undefined" && body instanceof FormData) return next;
  } catch (_) {}
  try {
    if (typeof Blob !== "undefined" && body instanceof Blob) return next;
  } catch (_) {}
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) return next;
  if (typeof Uint8Array !== "undefined" && body instanceof Uint8Array) return next;

  // 你目前 App.jsx 會用 JSON.stringify(...) 傳 body
  // 若沒有 Content-Type，後端 express.json() 可能不會 parse，導致 req.body undefined
  next["Content-Type"] = "application/json";

  return next;
}


// ======================================
// 功能：判斷該 API 是否允許「匿名」呼叫
// - 用於處理：前端殘留/過期 token 導致 401 時，對匿名可用的 API 做一次無 token 重試
// - 只允許少量白名單，避免影響需要登入的 API
// ======================================
function isAnonAllowedPath(path) {
  if (typeof path !== "string") return false;
  return (
    path === "/api/analyze" ||
    path.startsWith("/api/dictionary/lookup") ||
    path.startsWith("/api/dictionary/examples") ||
    path.startsWith("/api/dictionary/conversation") ||
    path.startsWith("/api/query/normalize")
  );
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

  // ✅ 自動補 Authorization
  // 1) primary: authTokenStore（由 AuthProvider 單一出口更新）
  // 2) fallback: localStorage scan ONCE（僅用於 refresh 初期 store 尚未 hydrated 的窗口）
  
  // ✅ Always attach visit id for both anonymous and logged-in users
  // - Do NOT overwrite caller-provided header
  // - Helps server-side usage tracking for anonymous flows and debugging
  if (!headers["x-visit-id"]) {
    const visitId = getOrCreateVisitId();
    if (visitId) headers["x-visit-id"] = visitId;
  }

const token = getAuthAccessToken() || getLegacyAccessTokenFromLocalStorageOnce();
  __supportTrace('apiClient:token', { hasToken: !!token, tokenLen: token ? String(token).length : 0 });
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    try {
      try { console.info("[apiFetch] request", { path, url: `${API_BASE}${path}` }); } catch (_) {}
      const __doFetch = async (__headers) =>
            fetch(`${API_BASE}${path}`, {
              ...options,
              headers: __headers,
            });

      let __resp = await __doFetch(headers);

      // ✅ 如果有殘留/過期 token 造成 401，且該 API 允許匿名，則無 token 重試一次
      // - 目的：匿名模式不要被「舊 token」卡死（例如 /api/dictionary/examples）
      if (__resp.status === 401 && token && isAnonAllowedPath(path)) {
        const __retryHeaders = { ...(headers || {}) };
        delete __retryHeaders["Authorization"];
        const __visitId2 = __retryHeaders["x-visit-id"] || getOrCreateVisitId();
        if (__visitId2) __retryHeaders["x-visit-id"] = __visitId2;
        __resp = await __doFetch(__retryHeaders);
      }
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

      // ✅ Usage limit hint (UI)
// - Server returns: 429 { error: "*_LIMIT_REACHED", tier, metric, timeWindow, resetAt?, ... }
// - We do NOT consume body (use clone)
// - Do NOT show hardcoded strings here; UI layer will decide via uiText.
      try {
        if (__resp.status === 429) {
          const __clone429 = __resp.clone();
          let __p = null;
          try { __p = await __clone429.json(); } catch (_) { __p = null; }
          const __code = String(__p?.error || "").trim();
          const __isAnonDailyLimit =
            __code === "ANON_DAILY_LIMIT_REACHED" ||
            /^ANON_DAILY_.*_LIMIT_REACHED$/.test(__code);

          // ✅ New: generic quota/usage limit event (covers anon/free/paid/premium)
          // - UI layer decides how to render message (i18n)
          if (__code) {
            try {
              window.dispatchEvent(
                new CustomEvent("langapp:quotaLimit", {
                  detail: {
                    ...(__p || {}),
                    code: __code,
                    path,
                    status: 429,
                  },
                })
              );
            } catch (_) {}
          }

          if (__isAnonDailyLimit) {
            try {
              window.dispatchEvent(
                new CustomEvent("langapp:anonDailyLimit", { detail: { ...(__p || {}), code: __code, path } })
              );
            } catch (_) {}
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
export function getVisitId() {
  return getOrCreateVisitId();
}
