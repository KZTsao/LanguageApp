// PATH: frontend/src/pages/SupportAdminPage.jsx
import { useMemo, useState } from "react";
import useSupportAdminChat from "../hooks/useSupportAdminChat";

/**
 * SupportAdminPage（前端 MVP）
 * - 左：未讀列表
 * - 右：對話內容 + 回覆
 * - 目前使用 useSupportAdminChat 的 mock store（不打 API）
 */
export default function SupportAdminPage() {
  const { unread, messages, activeSession, loading, openSession, sendReply, markRead } =
    useSupportAdminChat();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const unreadCount = (unread || []).length;

  const sessionTitle = useMemo(() => {
    if (!activeSession) return "";
    return `Session: ${activeSession}`;
  }, [activeSession]);

  const __onOpenSession = (sid) => {
    openSession(sid);
    markRead(sid);
  };

const __onSend = async () => {
  if (sending) return;
  if (!activeSession) return;

  const v = String(text || "").trim();
  if (!v) return;

  setSending(true);
  try {
    const ret = sendReply(v);
    await Promise.resolve(ret);
    setText("");
  } finally {
    setSending(false);
  }
};

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          borderBottom: "1px solid var(--border-subtle, #ddd)",
          background: "var(--card-bg, #fff)",
          color: "var(--text-main, #111)",
          flex: "0 0 auto",
        }}
      >
        <a
          href="/"
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "inherit",
            textDecoration: "none",
            opacity: 0.85,
          }}
          title="回到查詢"
          aria-label="回到查詢"
        >
          ← 回到查詢
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>客服管理</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid var(--border-subtle, #ddd)",
              opacity: 0.9,
            }}
            title="未讀數"
            aria-label="未讀數"
          >
            {unreadCount}
          </div>
        </div>

        <div style={{ width: 64 }} />
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left: unread list */}
        <div
          style={{
            width: 340,
            borderRight: "1px solid var(--border-subtle, #ddd)",
            padding: 12,
            background: "var(--panel-bg, #fff)",
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 10 }}>
            未讀訊息
          </div>

          {(unread || []).length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.7 }}>目前沒有未讀</div>
          )}

          {(unread || []).map((m) => (
            <div
              key={m.id}
              style={{
                padding: 10,
                cursor: "pointer",
                borderRadius: 10,
                border: "1px solid var(--border-subtle, #ddd)",
                marginBottom: 10,
                background: "var(--card-bg, #fff)",
              }}
              onClick={() => __onOpenSession(m.session_id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") __onOpenSession(m.session_id);
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>
                {m.session_id}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.35 }}>{m.content}</div>
            </div>
          ))}
        </div>

        {/* Right: messages */}
        <div style={{ flex: 1, padding: 16, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {!activeSession && (
            <div style={{ fontSize: 13, opacity: 0.75 }}>請先從左側選擇一個對話</div>
          )}

          {activeSession && (
            <>
              <div style={{ marginBottom: 10, fontWeight: 900, fontSize: 13 }}>
                {sessionTitle}
              </div>

              <div
                style={{
                  border: "1px solid var(--border-subtle, #ddd)",
                  borderRadius: 12,
                  padding: 12,
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  background: "var(--card-bg, #fff)",
                }}
              >
                {loading && <div style={{ fontSize: 12, opacity: 0.75 }}>載入中...</div>}

                {(messages || []).map((m) => (
                  <div key={m.id} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>
                      {m.sender_role}:
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>{m.content}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={(e) => e.preventDefault()}>
              <div style={{ marginTop: 10 }}>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    border: "1px solid var(--border-subtle, #ddd)",
                    padding: 10,
                    fontSize: 13,
                    background: "var(--card-bg, #fff)",
                    color: "var(--text-main, #111)",
                    resize: "vertical",
                  }}
                  placeholder="輸入回覆內容..."
                />

                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={__onSend}
                    disabled={sending || !activeSession || !String(text || "").trim()}
                    style={{
                      height: 32,
                      padding: "0 12px",
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle, #ddd)",
                      background: "var(--accent, #f59e0b)",
                      color: "#111",
                      fontWeight: 900,
                      opacity: sending ? 0.65 : 1,
                      cursor: sending ? "not-allowed" : "pointer",
                    }}
                  >
                    {sending ? "送出中…" : "回覆"}
                  </button>
                </div>
              </div>
            </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// END PATH: frontend/src/pages/SupportAdminPage.jsx
