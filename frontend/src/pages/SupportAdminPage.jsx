// frontend/src/pages/SupportAdminPage.jsx
import { useState } from "react";
import useSupportAdminChat from "../hooks/useSupportAdminChat";

export default function SupportAdminPage() {
  const {
    unread,
    messages,
    activeSession,
    loading,
    openSession,
    sendReply,
    markRead,
  } = useSupportAdminChat();

  const [text, setText] = useState("");

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ width: 320, borderRight: "1px solid #ddd", padding: 12 }}>
        <h3>未讀訊息</h3>
        {unread.map((m) => (
          <div
            key={m.id}
            style={{ padding: 8, cursor: "pointer" }}
            onClick={() => {
              openSession(m.session_id);
              markRead(m.session_id);
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.6 }}>{m.session_id}</div>
            <div>{m.content}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: 16 }}>
        {!activeSession && <div>請選擇一個對話</div>}
        {activeSession && (
          <>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Session: {activeSession}
            </div>

            <div style={{ border: "1px solid #ddd", padding: 12, height: "60vh", overflowY: "auto" }}>
              {loading && <div>載入中...</div>}
              {messages.map((m) => (
                <div key={m.id} style={{ marginBottom: 8 }}>
                  <b>{m.sender_role}:</b> {m.content}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 8 }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                style={{ width: "100%" }}
              />
              <button
                onClick={() => {
                  sendReply(text);
                  setText("");
                }}
              >
                回覆
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// frontend/src/pages/SupportAdminPage.jsx
