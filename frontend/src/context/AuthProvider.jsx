// frontend/src/context/AuthProvider.jsx
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
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const myEpoch = ++authEpochRef.current;
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        const currentUser = session?.user ?? null;
        applyAuthState(currentUser);

        // ✅ 有 user 才允許補 profile
        if (currentUser) {
          await upsertProfile(currentUser, myEpoch);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const myEpoch = ++authEpochRef.current;
      const currentUser = session?.user ?? null;

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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setLoading(false);
  };

  // ✅ 這一輪只改這裡：登出就算卡住，也要強制把 sb-...-auth-token 清乾淨
  const signOut = async () => {
    console.log("[AuthProvider] signOut called");

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
