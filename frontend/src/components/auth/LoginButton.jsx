// frontend/src/components/LoginButton.jsx
/**
 * 文件說明：
 * - LoginButton：顯示登入/登出按鈕與登入狀態（使用 AuthProvider）
 * - 本次異動重點：加入 Production 排查初始化狀態與可控 log（不改動既有登入/登出流程），協助定位 Vercel 包版後 Google 登入點擊/跳轉/回站狀態
 *
 * 異動紀錄：
 * - 2025/12/17：新增 Production 排查初始化狀態（globalThis.__LANGAPP_LOGINBTN_DIAG__）與可控 debug log（localStorage "__LANGAPP_AUTH_DEBUG__"）
 * - （保留舊的異動紀錄：原本無）
 */

import { useAuth } from "../../context/AuthProvider";

const LABELS = {
  "zh-TW": {
    login: "使用 Google 登入",
    logout: "登出",
    loggedInAs: "已登入：",
    checking: "登入狀態確認中…",
  },
  en: {
    login: "Sign in with Google",
    logout: "Sign out",
    loggedInAs: "Logged in as:",
    checking: "Checking login status…",
  },
  de: {
    login: "Mit Google anmelden",
    logout: "Abmelden",
    loggedInAs: "Angemeldet als:",
    checking: "Login-Status wird geprüft…",
  },
};

function getLabel(uiLang) {
  return LABELS[uiLang] || LABELS["zh-TW"];
}

/**
 * 功能說明（Production 排查）：debug 開關
 * - 預設關閉，避免 production 洗版
 * - 需要排查時：在瀏覽器 Console 執行
 *   localStorage.setItem("__LANGAPP_AUTH_DEBUG__", "1"); location.reload();
 */
function shouldAuthLog() {
  try {
    return localStorage.getItem("__LANGAPP_AUTH_DEBUG__") === "1";
  } catch {
    return false;
  }
}

/**
 * 功能說明（Production 排查）：單次 log（避免每次 render 都刷 log）
 * - 依 key 控制只印一次
 */
function logOnce(key, payload) {
  try {
    if (!shouldAuthLog()) return;
    if (!globalThis.__LANGAPP_LOGINBTN_LOG_ONCE__) {
      globalThis.__LANGAPP_LOGINBTN_LOG_ONCE__ = {};
    }
    if (globalThis.__LANGAPP_LOGINBTN_LOG_ONCE__[key]) return;
    globalThis.__LANGAPP_LOGINBTN_LOG_ONCE__[key] = true;
    console.log(`[LoginButton][DebugOnce] ${key}`, payload);
  } catch {
    // ignore
  }
}

/**
 * 功能說明（Production 排查）：初始化狀態
 * - 掛在 globalThis 方便 production 直接查看：
 *   globalThis.__LANGAPP_LOGINBTN_DIAG__
 */
function ensureDiag() {
  try {
    if (!globalThis.__LANGAPP_LOGINBTN_DIAG__) {
      globalThis.__LANGAPP_LOGINBTN_DIAG__ = {
        tag: "LANGAPP_LOGINBTN_DIAG",
        createdAt: new Date().toISOString(),
        lastAction: null,
        lastSnapshot: null,
      };
    }
  } catch {
    // ignore
  }
}

/**
 * 功能說明（Production 排查）：更新初始化狀態（不影響任何既有流程）
 */
function setDiag(patch) {
  try {
    ensureDiag();
    globalThis.__LANGAPP_LOGINBTN_DIAG__ = {
      ...globalThis.__LANGAPP_LOGINBTN_DIAG__,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    // ignore
  }
}

export default function LoginButton({ uiLang = "zh-TW" }) {
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth();
  const label = getLabel(uiLang);

  // ✅ Production 排查：初始化狀態（每次 render 更新最新快照，但不印 log）
  setDiag({
    lastSnapshot: {
      loading,
      hasUser: !!user,
      hasProfile: !!profile,
      userEmail: user?.email || null,
      href: typeof window !== "undefined" ? window.location.href : "",
      origin: typeof window !== "undefined" ? window.location.origin : "",
      uiLang,
    },
  });

  // ✅ Production 排查：第一次 render 印一次快照
  logOnce("render:snapshot", {
    loading,
    hasUser: !!user,
    hasProfile: !!profile,
    uiLang,
    href: typeof window !== "undefined" ? window.location.href : "",
    origin: typeof window !== "undefined" ? window.location.origin : "",
  });

  const buttonStyle = {
    border: "1px solid var(--border-soft)",
    background: "var(--bg-soft)",
    color: "var(--text-main)",
    padding: "6px 10px",
    borderRadius: 10,
    fontSize: 12,
    cursor: "pointer",
  };

  const handleLogout = async () => {
    console.log("[LoginButton] logout clicked");

    // ✅ Production 排查：記錄最後操作
    setDiag({
      lastAction: {
        type: "logout-click",
        at: new Date().toISOString(),
        hasUser: !!user,
        userEmail: user?.email || null,
      },
    });

    if (shouldAuthLog()) {
      console.log("[LoginButton][Debug] logout click snapshot", {
        loading,
        hasUser: !!user,
        userEmail: user?.email || null,
      });
    }

    // ✅ 唯一允許的登出行為：交給 AuthProvider
    if (typeof signOut === "function") {
      await signOut();
    } else {
      console.warn("[LoginButton] signOut is not a function");
    }
  };

  if (loading) {
    logOnce("state:loading", { uiLang, text: label.checking });
    return (
      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
        {label.checking}
      </span>
    );
  }

  // 未登入 → 顯示登入按鈕
  if (!user) {
    logOnce("state:loggedOut", {
      uiLang,
      href: typeof window !== "undefined" ? window.location.href : "",
    });

    // ✅ 只做插入：包一層 click handler（不改 signInWithGoogle 內部邏輯）
    const handleLogin = async () => {
      setDiag({
        lastAction: {
          type: "login-click",
          at: new Date().toISOString(),
          origin: typeof window !== "undefined" ? window.location.origin : "",
          href: typeof window !== "undefined" ? window.location.href : "",
        },
      });

      if (shouldAuthLog()) {
        console.log("[LoginButton][Debug] login clicked snapshot", {
          origin: window.location.origin,
          href: window.location.href,
          hasAuthProviderFn: typeof signInWithGoogle === "function",
          hasAuthProviderGlobalDiag: !!globalThis.__LANGAPP_AUTH_DIAG__,
        });
      }

      if (typeof signInWithGoogle === "function") {
        await signInWithGoogle();
      } else {
        console.warn("[LoginButton] signInWithGoogle is not a function");
      }
    };

    return (
      <button style={buttonStyle} onClick={handleLogin}>
        {label.login}
      </button>
    );
  }

  // 已登入 → 顯示使用者資訊 + 登出
  const displayName = profile?.full_name || user.email || "User";

  logOnce("state:loggedIn", {
    uiLang,
    displayName,
    userEmail: user?.email || null,
    userId: user?.id || null,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
        {label.loggedInAs} {displayName}
      </span>
      <button style={buttonStyle} onClick={handleLogout}>
        {label.logout}
      </button>
    </div>
  );
}
// frontend/src/components/LoginButton.jsx
