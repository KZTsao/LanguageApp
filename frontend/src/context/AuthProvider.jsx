// frontend/src/context/AuthProvider.jsx
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

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const applyAuthState = (currentUser) => {
    // ✅ Production 排查：觀測 user 是否在 OAuth 回跳後成功落地
    __PROD_DIAG__.lastAuthUserId = currentUser?.id || null;
    prodLog("applyAuthState", { userId: currentUser?.id || null });

    setUser(currentUser);
    // ✅ 只要 user 變成 null，profile 一定要清掉（user 是唯一真相）
    if (!currentUser) {
      setProfile(null);
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
          plan: "free",
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

        // ✅ 有 user 才允許補 profile
        if (currentUser) {
          await upsertProfile(currentUser, myEpoch);
        }
      } catch (e) {
        __PROD_DIAG__.lastError = { where: "getSession", message: e?.message || String(e) };
        prodWarn("getSession exception", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
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

      if (currentUser) {
        await upsertProfile(currentUser, myEpoch);
      }

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
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
// frontend/src/context/AuthProvider.jsx
