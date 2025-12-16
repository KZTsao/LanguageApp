// frontend/src/components/LoginButton.jsx
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

export default function LoginButton({ uiLang = "zh-TW" }) {
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth();
  const label = getLabel(uiLang);

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

    // ✅ 唯一允許的登出行為：交給 AuthProvider
    if (typeof signOut === "function") {
      await signOut();
    }
  };

  if (loading) {
    return (
      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
        {label.checking}
      </span>
    );
  }

  // 未登入 → 顯示登入按鈕
  if (!user) {
    return (
      <button style={buttonStyle} onClick={signInWithGoogle}>
        {label.login}
      </button>
    );
  }

  // 已登入 → 顯示使用者資訊 + 登出
  const displayName = profile?.full_name || user.email || "User";

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
