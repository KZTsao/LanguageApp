// START PATH: frontend/src/context/AuthProvider.jsx
// PATH: frontend/src/context/AuthProvider.jsx
// frontend/src/context/AuthProvider.jsx
/**
 * ===========================================
 * UPLOAD_ID: frontend/src/context/AuthProvider.jsx
 * CONTENT_SHA1_12: df7f05a2d1db
 * STAMP_UTC: 2026-01-31T12:18:49Z
 * Note: This banner is for upload disambiguation (do not remove).
 * ===========================================
 */

/**
 * 文件說明：
 * - AuthProvider：統一管理 Supabase Auth 的 user / profile / loading 狀態（user 為唯一真相）
 * - 本檔新增 Production 排查用初始化狀態與 log（不改動既有登入/登出流程），用於定位 Vercel 包版後 Google OAuth 回跳 / session 落地問題
 *
 * 異動紀錄：
 * - 2025-12-17：新增 Production 排查初始化狀態（globalThis.__LANGAPP_AUTH_DIAG__）與關鍵節點 log（getSession / onAuthStateChange / signInWithOAuth）
 * - （保留舊的異動紀錄：原本無）
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { clearAuthAccessToken, setAuthAccessToken } from "../utils/authTokenStore";
import { apiFetch } from "../utils/apiClient";
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
const __classifySbTokenValue = (raw) => {
  const s = String(raw || "");
  if (!s) return { kind: "empty", okJson: false };
  try {
    const obj = JSON.parse(s);
    const keys = obj && typeof obj === "object" ? Object.keys(obj) : [];
    if (keys.includes("provider_token") && !keys.includes("access_token")) {
      return { kind: "provider_only", okJson: true, keys };
    }
    if (keys.includes("access_token") || keys.includes("refresh_token")) {
      return { kind: "supabase_session_like", okJson: true, keys };
    }
    return { kind: "json_other", okJson: true, keys };
  } catch (_) {
    // Non-JSON (should not happen for sb auth token)
    return { kind: s.startsWith("ya29.") ? "provider_token_string" : "non_json", okJson: false };
  }
};


const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  authReady: false,
  isSupportAdmin: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});


// ✅ 同步讀取 Supabase localStorage token（避免 getSession 在某些環境 hang / timeout）
// - 只做 fallback：先把 token 填進 authTokenStore，讓需要 Authorization 的 API 不必等待
// - 後續仍以 supabase.getSession / onAuthStateChange 的 session 為準來更新
const __readSupabaseAccessTokenFromStorage = () => {
  try {
    return null; // 永久停用：完全停用掃 localStorage sb-*-auth-token
    const keys = Object.keys(localStorage || {});
    // Supabase v2: sb-<project-ref>-auth-token
    const k = keys.find((x) => x && x.startsWith("sb-") && x.endsWith("-auth-token"));
    if (!k) return null;
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    // 常見格式：{ access_token, refresh_token, ... } 或 { currentSession: { access_token } }
    const t =
      obj?.access_token ||
      obj?.currentSession?.access_token ||
      obj?.session?.access_token ||
      null;
    return typeof t === "string" && t.length > 10 ? t : null;
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const authReadyRef = useRef(false); // ✅ stable gate for callbacks (avoid stale closure)
  const [isSupportAdmin, setIsSupportAdmin] = useState(false);

  // ✅ 功能初始化狀態（Production 排查）
  // - 僅用於觀測，不影響任何既有邏輯
  // - 以 globalThis 保存，方便在瀏覽器 Console 直接查：globalThis.__LANGAPP_AUTH_DIAG__
  const __PROD_DIAG__ = (globalThis.__LANGAPP_AUTH_DIAG__ =
    globalThis.__LANGAPP_AUTH_DIAG__ || {
      initedAt: new Date().toISOString(),
      hasLoggedInit: false,
      lastInit: null,
      lastGetSession: null,
      lastAuthEvent: null,
      lastAuthUserId: null,
      lastError: null,
    });

  // ✅ Production 排查用 log（統一前綴，方便 Vercel Logs 搜尋）
  // - 只在 PROD 印（避免 dev 洗版）
  const prodLog = (...args) => {
    if (import.meta?.env?.PROD) console.log("[Auth][Prod]", ...args);
  };
  const prodWarn = (...args) => {
    if (import.meta?.env?.PROD) console.warn("[Auth][Prod]", ...args);
  };

  // ✅ user 是唯一真相：用這個 token 防止 async profile 回寫「復活」
  const authEpochRef = useRef(0);
  const authSubRef = useRef(null);

  const hardClearSupabaseAuthStorage = (tag = "") => {
    try {
      return; // 永久停用：完全停用 hard clear sb-*-auth-token
      const isTarget = (k) =>
        k.startsWith("sb-") && (k.includes("auth-token") || k.includes("-auth-token"));

      const lsKeys = Object.keys(localStorage).filter(isTarget);
      const ssKeys = Object.keys(sessionStorage).filter(isTarget);

      lsKeys.forEach((k) => localStorage.removeItem(k));
      ssKeys.forEach((k) => sessionStorage.removeItem(k));

      console.log(`[AuthProvider] hardClear(${tag}) removed:`, {
        localStorage: lsKeys,
        sessionStorage: ssKeys,
      });
    } catch (e) {
      console.warn("[AuthProvider] hardClear failed:", e);
    }
  };

  // ✅ Support Admin 判斷：由後端提供單一真相（避免前端 env/import.meta 不穩）
  // - 只回傳 boolean；由呼叫端統一 setIsSupportAdmin（避免多點寫入）
  const calcIsSupportAdmin = async (hasToken) => {
    try {
      if (!hasToken) return false;
      const res = await apiFetch("/api/support/admin/me", { method: "GET" });
      if (!res || !res.ok) return false;
      const json = await res.json().catch((e) => null);
      return !!json?.is_admin;
    } catch (e) {
      return false;
    }
  };


  const applyAuthState = (currentUser) => {
console.log("[Auth][applyAuthState]", {
  hasUser: !!currentUser,
  userId: currentUser?.id
});

    // ✅ Production 排查：觀測 user 是否在 OAuth 回跳後成功落地
    __PROD_DIAG__.lastAuthUserId = currentUser?.id || null;
    prodLog("applyAuthState", { userId: currentUser?.id || null });

    setUser(currentUser);
    // ✅ 只要 user 變成 null，profile 一定要清掉（user 是唯一真相）
    if (!currentUser) {
      setProfile(null);
      console.log("[Auth][applyAuthState] CLEAR admin because user is null");
      proof('applyAuthState:clearAdmin', { reason: 'user_null' });
      if (authReadyRef.current) setIsSupportAdmin(false);
      // ⛔ authReady=false 期間：不下結論（避免 UI 先渲染為非 admin）
    } else {
      // 有 user 時，profile 先清空也沒關係（避免顯示舊的）
      setProfile(null);
    }
  };

  const upsertProfile = async (currentUser, epochAtCall) => {
    if (!currentUser) return;

    const fullName =
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      currentUser.email ||
      "";

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: currentUser.id,
          email: currentUser.email,
          full_name: fullName,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    // ✅ 防止 race：如果這次 async 回來時 epoch 已經改變（代表 user 已變動/登出），就不要回寫 profile
    if (authEpochRef.current !== epochAtCall) return;

    if (!error) setProfile(data);

    // ✅ Production 排查：profile upsert 錯誤也要留痕
    if (error) {
      __PROD_DIAG__.lastError = {
        where: "upsertProfile",
        message: error?.message || String(error),
        code: error?.code,
        details: error?.details,
      };
      prodWarn("upsertProfile error", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
      });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      console.log("[Auth][init] start");
       proof('init:start');
      // ✅ 先用 localStorage token 立即填入 store（若存在）
      const __lsToken = __readSupabaseAccessTokenFromStorage();
      if (__lsToken) __supportTrace("AuthProvider:setToken:before");
      setAuthAccessToken(__lsToken, null);

      const myEpoch = ++authEpochRef.current;

      // ✅ Production 排查：只印一次 init，記錄當下 URL（可快速判斷是否在 callback query/hash）
      if (import.meta?.env?.PROD && !__PROD_DIAG__.hasLoggedInit) {
        __PROD_DIAG__.hasLoggedInit = true;
        __PROD_DIAG__.lastInit = {
          at: new Date().toISOString(),
          origin: typeof window !== "undefined" ? window.location.origin : null,
          href: typeof window !== "undefined" ? window.location.href : null,
        };
        prodLog("init", __PROD_DIAG__.lastInit);
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

console.log("[Auth][init] getSession", {
  hasSession: !!session,
  hasToken: !!session?.access_token,
  userId: session?.user?.id
});

       try {
         const keys = Object.keys(localStorage || {});
         const sbKey = keys.find((x) => x && x.startsWith('sb-') && x.endsWith('-auth-token'));
         const raw = sbKey ? localStorage.getItem(sbKey) : null;
         const diag = __classifySbTokenValue(raw);
         proof('init:sbTokenDiag', { sbKey, ...diag, rawLen: raw ? String(raw).length : 0 });
       } catch (e) {
         proof('init:sbTokenDiag:error', { message: e?.message || String(e) });
       }


        // ✅ Production 排查：getSession 結果（最關鍵）
        __PROD_DIAG__.lastGetSession = {
          at: new Date().toISOString(),
          hasSession: !!session,
          userId: session?.user?.id || null,
        };
        prodLog("getSession result", __PROD_DIAG__.lastGetSession);

        if (cancelled) return;

        const currentUser = session?.user ?? null;
        applyAuthState(currentUser);

      // ✅ 同步更新 access_token store（讓 apiClient 不必 await getSession）
      if (session?.access_token) {
        __supportTrace("AuthProvider:setToken:before");
      setAuthAccessToken(session.access_token, currentUser?.id || null);
      } else {
        __supportTrace("AuthProvider:clearToken");
      clearAuthAccessToken();
      }

      // ✅ token ready 後抓 admin flag（避免 401 Missing Authorization）
      setIsSupportAdmin(await calcIsSupportAdmin(!!session?.access_token));

      if (currentUser) {
          await upsertProfile(currentUser, myEpoch);
        }
      } catch (e) {
        __PROD_DIAG__.lastError = { where: "getSession", message: e?.message || String(e) };
        prodWarn("getSession exception", e);
      } finally {
        if (!cancelled) { authReadyRef.current = true; setAuthReady(true); }
        if (!cancelled) setLoading(false);
      }
    };

    init();

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
console.log("[Auth][onAuthStateChange]", {
  event: _event,
  hasSession: !!session,
  hasToken: !!session?.access_token,
  userId: session?.user?.id
});

      const myEpoch = ++authEpochRef.current;
      const currentUser = session?.user ?? null;

      // ✅ Production 排查：auth 事件流（第二關鍵）
      __PROD_DIAG__.lastAuthEvent = {
        at: new Date().toISOString(),
        event: _event,
        hasSession: !!session,
        userId: session?.user?.id || null,
      };
      prodLog("onAuthStateChange", __PROD_DIAG__.lastAuthEvent);

      applyAuthState(currentUser);

      // ✅ 同步更新 access_token store（讓 apiClient 不必 await getSession）
      if (session?.access_token) {
        __supportTrace("AuthProvider:setToken:before");
      setAuthAccessToken(session.access_token, currentUser?.id || null);
      } else {
        __supportTrace("AuthProvider:clearToken");
      clearAuthAccessToken();

      // ✅ token ready 後再抓 admin flag（避免 401 Missing Authorization）
      if (session?.access_token) {
        setIsSupportAdmin(await calcIsSupportAdmin(!!session?.access_token));
      } else {
        if (authReadyRef.current) setIsSupportAdmin(false);
      }

      }

      if (currentUser) {
        await upsertProfile(currentUser, myEpoch);
      }

      authReadyRef.current = true; setAuthReady(true);
      setAuthReady(true);
      setLoading(false);
    });

    authSubRef.current = data?.subscription || null;

    return () => {
      cancelled = true;
      authSubRef.current?.unsubscribe?.();
      authSubRef.current = null;
    };
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);

    // ✅ Production 排查：點擊登入瞬間記錄 origin / redirectTo
    try {
      prodLog("signInWithGoogle called", {
        at: new Date().toISOString(),
        origin: window.location.origin,
        redirectTo: window.location.origin,
      });
    } catch (e) {
      prodWarn("signInWithGoogle pre-log failed", e);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    // ✅ Production 排查：signInWithOAuth 錯誤留痕
    if (error) {
      __PROD_DIAG__.lastError = {
        where: "signInWithOAuth",
        message: error?.message || String(error),
        status: error?.status,
        name: error?.name,
      };
      prodWarn("signInWithOAuth error", {
        message: error?.message,
        status: error?.status,
        name: error?.name,
      });
      setLoading(false);
    }
  };

  // ✅ 這一輪只改這裡：登出就算卡住，也要強制把 sb-...-auth-token 清乾淨
  const signOut = async () => {
    console.log("[AuthProvider] signOut called");

    // ✅ Production 排查：登出觸發點
    prodLog("signOut called", { at: new Date().toISOString() });

    // ✅ 先把 UI 狀態清掉，確保「頭像/登入狀態」立刻消失（避免殘影）
    authEpochRef.current++;
    setUser(null);
    setProfile(null);
    setLoading(true);

    // ✅ 無論 supabase.auth.signOut() 有沒有卡住，最後都要確保本機 token 被清掉
    const timeout = (ms) =>
      new Promise((_, rej) => setTimeout(() => rej(new Error("signOut timeout")), ms));

    try {
      // ❗不要 unsubscribe onAuthStateChange；你登出後可能馬上要再登入
      // ❗不要在 signOut 前先清 storage；可能干擾 supabase 的登出流程
      await Promise.race([supabase.auth.signOut({ scope: "local" }), timeout(2000)]);
    } catch (e) {
      console.warn("[AuthProvider] signOut error:", e);
      __PROD_DIAG__.lastError = { where: "signOut", message: e?.message || String(e) };
      prodWarn("signOut error", e);
    } finally {
      // ✅ 強制清掉本機 auth-token（你剛剛驗證：按登出前後 key 沒變，代表必須硬清）
      hardClearSupabaseAuthStorage("final");
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, authReady, isSupportAdmin, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
// frontend/src/context/AuthProvider.jsx
// END PATH: frontend/src/context/AuthProvider.jsx