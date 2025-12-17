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
 */

// ======================================
// 統一 API_BASE（沿用你現在的邏輯）
// ======================================
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:4000"
    : "https://languageapp-8j45.onrender.com");

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
};

// ======================================
// 功能：從 Supabase localStorage 取 access_token
// ======================================
function getAccessToken() {
  try {
    const raw = localStorage.getItem("sb-yeemivptkzwqcnuzexdl-auth-token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || null;
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
  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    return await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (e) {
    initStatus.lastError = String(e?.message || e);
    throw e;
  }
}

export { API_BASE, initStatus };

// frontend/src/utils/apiClient.js
