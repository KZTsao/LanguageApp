// frontend/src/components/LoginHeader.jsx
import { useAuth } from "../context/AuthProvider";

export default function LoginHeader() {
  const { user, profile, signInWithGoogle, signOut, loading } = useAuth();

  const buttonStyle = {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid var(--border-subtle)",
    background: "var(--card-bg)",
    color: "var(--text-main)",
    fontSize: 12,
    cursor: "pointer",
  };

  if (loading) {
    return <div style={{ color: "var(--text-muted)" }}>Checking login...</div>;
  }

  if (!user) {
    return (
      <button style={buttonStyle} onClick={signInWithGoogle}>
        使用 Google 登入
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>
        {profile?.full_name || user.email}
      </span>
      <button style={buttonStyle} onClick={signOut}>
        登出
      </button>
    </div>
  );
}
