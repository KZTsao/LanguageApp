// START PATH: frontend/src/pages/admin/AdminUnitEditorPage.jsx
// frontend/src/pages/admin/AdminUnitEditorPage.jsx
import React, { useMemo } from "react";
import { useAuth } from "../../context/AuthProvider";
import { getSupportAdminEmailList, isSupportAdminEmail } from "../../utils/adminAccess";

function safeReplace(url) {
  try {
    window.location.replace(url);
  } catch {
    window.location.href = url;
  }
}

export default function AdminUnitEditorPage() {
  const { user, loading } = useAuth();

  const adminEmails = useMemo(() => getSupportAdminEmailList(), []);
  const authEmail = useMemo(() => {
    const e = user && user.email ? String(user.email) : "";
    return e.trim().toLowerCase();
  }, [user]);

  const isAdmin = useMemo(() => isSupportAdminEmail(authEmail), [authEmail]);

  if (loading) {
    return <div style={{ padding: 16, opacity: 0.75 }}>Loading…</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: 18, maxWidth: 720 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>需要登入</div>
        <div style={{ opacity: 0.8, lineHeight: 1.6, marginBottom: 12 }}>
          這是管理者上傳入口，請先登入後再繼續。
        </div>
        <button
          onClick={() => safeReplace("/login")}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-soft)",
            color: "var(--text-main)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          前往登入
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 18, maxWidth: 720 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>無權限</div>
        <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
          你的帳號（{authEmail || "unknown"}）不在管理者清單內。
        </div>
        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13, lineHeight: 1.6 }}>
          設定來源：.env.local / VITE_SUPPORT_ADMIN_EMAILS（逗號分隔）
          <br />
          目前清單筆數：{adminEmails.length}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18, maxWidth: 860 }}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>單元上傳（Admin）</div>
      <div style={{ opacity: 0.8, lineHeight: 1.6, marginBottom: 14 }}>
        目前先上線「權限 gate + 空白骨架」。下一步才接：排版編輯器、圖檔/音檔上傳、上架/預告時間。
      </div>

      <div
        style={{
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          padding: 14,
          background: "var(--card-bg)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>登入資訊</div>
        <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
          Email：{authEmail}
          <br />
          Admin list：{adminEmails.join(", ") || "(empty)"}
        </div>
      </div>
    </div>
  );
}

// END PATH: frontend/src/pages/admin/AdminUnitEditorPage.jsx
