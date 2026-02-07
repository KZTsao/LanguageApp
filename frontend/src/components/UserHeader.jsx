// START PATH: frontend/src/components/UserHeader.jsx
// frontend/src/components/UserHeader.jsx
import { useAuth } from "../context/AuthProvider";
import { isSupportAdminEmail } from "../utils/adminAccess";

export default function UserHeader() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const email = String(user?.email || "").trim();
  const isAdmin = isSupportAdminEmail(email);

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 12, opacity: 0.85 }}>{email}</span>

      {isAdmin ? (
        <a
          href="/admin/units/new"
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid var(--border-subtle)",
            background: "var(--card-bg)",
            color: "var(--text-main)",
            fontSize: 12,
            textDecoration: "none",
            cursor: "pointer",
          }}
          title="內容上傳（Admin）"
        >
          📚 內容上傳
        </a>
      ) : null}

      <button
        onClick={signOut}
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          border: "1px solid var(--border-subtle)",
          background: "var(--card-bg)",
          color: "var(--text-main)",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        登出
      </button>
    </div>
  );
}

// END PATH: frontend/src/components/UserHeader.jsx
