// PATH: frontend/src/utils/authTokenStore.js
// frontend/src/utils/authTokenStore.js
/**
 * 功能：
 * - 提供「同步」讀取的 access_token store（避免 apiFetch 每次 await supabase.auth.getSession()）
 * - AuthProvider 會在 getSession / onAuthStateChange 時更新 token
 * - apiClient 只同步讀取；若拿不到再 fallback localStorage scan（legacy）
 */

const GLOBAL_KEY = "__LANGAPP_AUTH_TOKEN_STORE__";


// ✅ Proof trace（不影響正式執行）：.env -> VITE_AUTH_PROOF=1
const AUTH_PROOF = import.meta.env.VITE_AUTH_PROOF === "1";
const trace = (...args) => {
  if (AUTH_PROOF) console.log("[***A]", ...args);
};
const proof = (...args) => trace(...args);

// Keep a tiny in-memory store; also mirror to globalThis for easy debugging (no secrets logged).
const state =
  (globalThis[GLOBAL_KEY] = globalThis[GLOBAL_KEY] || {
    updatedAt: null,
    hasToken: false,
    token: "",
    userId: null,
  });

// Debug logger (DEV or when globalThis.__LANGAPP_AUTH_DEBUG__ = true).
function __authDbgLog(action, meta = {}) {
  try {
    const enabled = !!globalThis.__LANGAPP_AUTH_DEBUG__ || import.meta?.env?.DEV;
    if (!enabled) return;
    const safe = { ...meta };
    // Never log the raw token; only length + userId.
    if (safe.token) delete safe.token;
    proof('[authTokenStore]', action, safe);
    const stack = new Error().stack;
    if (stack) proof('[authTokenStore][stack]', String(stack).split('\n').slice(2, 6).join('\n'));
  } catch (_) {}
}


export function setAuthAccessToken(token, userId = null) {
  const t = String(token || "");
  state.token = t;
  state.hasToken = !!t;
  state.userId = userId || null;
  state.updatedAt = new Date().toISOString();
  __authDbgLog('set', { hasToken: state.hasToken, tokenLen: t.length, userId: state.userId, updatedAt: state.updatedAt });
}

export function clearAuthAccessToken() {
  state.token = "";
  state.hasToken = false;
  state.userId = null;
  state.updatedAt = new Date().toISOString();
  __authDbgLog('clear', { hasToken: state.hasToken, userId: state.userId, updatedAt: state.updatedAt });
}

export function getAuthAccessToken() {
  return state && state.hasToken ? state.token : "";
}

export function getAuthTokenDiag() {
  return {
    updatedAt: state.updatedAt,
    hasToken: state.hasToken,
    userId: state.userId,
  };
}

// END PATH: frontend/src/utils/authTokenStore.js