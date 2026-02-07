// PATH: frontend/src/pages/SupportAdminPage.jsx
import { useEffect, useMemo, useState } from "react";
import useSupportAdminChat from "../hooks/useSupportAdminChat";

// =========================
// [support] trace helpers (sap, dev-only)
// =========================
function __supportTraceOn_sap() {
  try {
    if (typeof import.meta !== "undefined" && import.meta?.env?.VITE_DEBUG_SUPPORT === "1") return true;
  } catch (e) {}
  try {
    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("debugSupport") === "1") return true;
      if (window.localStorage?.getItem("VITE_DEBUG_SUPPORT") === "1") return true;
    }
  } catch (e) {}
  return false;
}
function __supportTrace_sap(event, payload) {
  if (!__supportTraceOn_sap()) return;
  try { console.info("[support]", event, payload || {}); } catch (e) {}
}


// =========================
// [support] trace helpers (dev-only, no logic change)
// Enable without restart via:
// - localStorage.setItem("VITE_DEBUG_SUPPORT","1")
// - or add ?debugSupport=1 to URL
// - or VITE_DEBUG_SUPPORT=1 env (requires dev server restart)
// =========================
function __supportTraceOn() {
  try {
    if (typeof import.meta !== "undefined" && import.meta?.env?.VITE_DEBUG_SUPPORT === "1") return true;
  } catch (e) {}
  try {
    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("debugSupport") === "1") return true;
      if (window.localStorage?.getItem("VITE_DEBUG_SUPPORT") === "1") return true;
    }
  } catch (e) {}
  return false;
}
function __supportTrace(event, payload) {
  if (!__supportTraceOn()) return;
  try { console.info("[support]", event, payload || {}); } catch (e) {}
}



// ✅ hide legacy topbar (per requirement)
const __SUPPORT_ADMIN_HIDE_TOPBAR = true;

/**
 * SupportAdminPage（前端 MVP）
 * - 左：未讀列表
 * - 右：對話內容 + 回覆
 *
 * ✅ 新需求（2026-02-03）
 * 2) admin 保留同一 user（同 session）對話歷史（reload 回來也保留）
 * 3) 自己白底、對方淡橘底（bubble color）
 */
export default function SupportAdminPage() {
  __supportTrace_sap("render", {});

  
  __supportTrace("SupportAdminPage:render", {});
__supportTrace("SupportAdminPage:render", {});

  const {
    unread,
    messages,
    activeSession,
    loading,
    openSession: openSessionRaw,
    openConversation,
    openUser,
    sendReply,
    markRead,
    refreshUnread,
    conversations,
    fetchRecentConversations,
  } = useSupportAdminChat();

  const openSession =
    typeof openSessionRaw === "function"
      ? openSessionRaw
      : typeof openConversation === "function"
        ? openConversation
        : typeof openUser === "function"
          ? openUser
          : null;

const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // ✅ 進頁先拉一次未讀（避免空白）
  useEffect(() => {
    if (typeof refreshUnread === "function") refreshUnread();
    if (typeof fetchRecentConversations === "function") fetchRecentConversations(30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
// ✅ 重新整理/回到頁面：保留最後一個 session 並自動載入
  useEffect(() => {
    if (!activeSession) return;
    if (typeof openSession === "function") openSession(activeSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  
  // ✅ Sidebar「近期對話」（30 天內，依最後訊息 desc；以 email 歸戶）
  const recentConversations = useMemo(() => {
    const arr = Array.isArray(conversations) ? conversations : [];
    // normalize + sort desc by last_at/last_message_at/created_at
    const norm = arr.map((x) => {
      const lastAt =
        x?.last_at || x?.last_message_at || x?.lastMessageAt || x?.created_at || x?.updated_at || null;
      const ts = lastAt ? new Date(lastAt).getTime() : 0;
      return {
        session_id: String(x?.session_id || x?.sessionId || ""),
        user_id: x?.user_id || x?.userId || null,
        email: String(x?.email || x?.user_email || x?.userEmail || "").trim(),
        nickname: String(x?.nickname || x?.name || "").trim(),
        lastAtTs: ts,
        lastAtRaw: lastAt,
        preview: String(x?.last_preview || x?.preview || x?.content || "").trim(),
        unread_count: Number(x?.unread_count ?? x?.unreadCount ?? 0) || 0,
      };
    }).filter((x) => x.session_id);

    norm.sort((a, b) => (b.lastAtTs || 0) - (a.lastAtTs || 0));
    return norm;
  }, [conversations]);
// ✅ Sidebar「未讀」以 session 歸戶
  const groupedUnread = useMemo(() => {
    const arr = Array.isArray(unread) ? unread : [];
    const map = new Map();

    for (const m of arr) {
      const sid = String(m?.session_id || "");
      if (!sid) continue;

      const prev = map.get(sid);
      const createdAt = m?.created_at ? new Date(m.created_at).getTime() : 0;
      if (!prev) {
        map.set(sid, {
          session_id: sid,
          count: 1,
          lastMessage: m,
          lastAt: createdAt,
        });
        continue;
      }

      prev.count += 1;
      if (createdAt >= (prev.lastAt || 0)) {
        prev.lastAt = createdAt;
        prev.lastMessage = m;
      }
    }

    return Array.from(map.values())
      .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
      .map((x) => ({
        session_id: x.session_id,
        count: x.count,
        content: x?.lastMessage?.content || "",
        created_at: x?.lastMessage?.created_at || null,
        lastMessageId: x?.lastMessage?.id,
      }));
  }, [unread]);

  const unreadSessionCount = groupedUnread.length;
  const unreadMessageCount = (Array.isArray(unread) ? unread : []).length;

  const activeUserLabel = useMemo(() => {
    const sid = String(activeSession || "");
    if (!sid) return "";
    const hit = (Array.isArray(recentConversations) ? recentConversations : []).find((x) => x.session_id === sid);
    if (!hit) return "";
    const email = String(hit.email || "").trim();
    const nick = String(hit.nickname || "").trim();
    return nick ? `${nick} (${email || "unknown"})` : (email || "");
  }, [activeSession, recentConversations]);

  const sessionTitle = useMemo(() => {
    if (!activeSession) return "";
    return `Session: ${activeSession}`;
  }, [activeSession]);

  const __onOpenSession = (sid) => {
    if (typeof openSession === "function") openSession(sid);
    if (typeof markRead === "function") (__supportTrace("SupportAdminPage:markRead", { sessionId: sid }), markRead(sid));
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
      {/* Top bar removed (回到查詢 / 客服管理 / 未讀) */}
      {false && (
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
            title={`未讀會話：${unreadSessionCount}；未讀訊息：${unreadMessageCount}`}
            aria-label={`未讀會話 ${unreadSessionCount}；未讀訊息 ${unreadMessageCount}`}
          >
            {unreadSessionCount}
          </div>
        </div>

        <div style={{ width: 64 }} />
      </div>
      )}

      {/* Body */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left: unread list */}
        <div
          style={{
            flex: "0 0 30%",
            width: "30%",
            minWidth: 180,
            maxWidth: 360,
            borderRight: "1px solid var(--border-subtle, #ddd)",
            padding: 12,
            background: "var(--panel-bg, #fff)",
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 10 }}>近期對話（30天）</div>

          {recentConversations.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.7 }}>目前沒有近期對話</div>
          )}

          {recentConversations.map((m) => (
            <div
              key={m.nickname ? `${m.nickname} (${m.email || ""})` : (m.email || m.session_id)}
              style={{
                padding: 10,
                cursor: "pointer",
                borderRadius: 10,
                border: "1px solid var(--border-subtle, #ddd)",
                marginBottom: 10,
                background: "var(--card-bg, #fff)",
              }}
              onClick={() => {
                if (typeof openSession === "function") openSession(m.session_id);
                if (m.unread_count > 0 && typeof markRead === "function") (__supportTrace("SupportAdminPage:markRead", { sessionId: m.session_id }), markRead(m.session_id));
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  if (typeof openSession === "function") openSession(m.session_id);
                  if (m.unread_count > 0 && typeof markRead === "function") (__supportTrace("SupportAdminPage:markRead", { sessionId: m.session_id }), markRead(m.session_id));
                }
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.65, flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "inline-block",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.nickname ? `${m.nickname} (${m.email || ""})` : (m.email || m.session_id)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "1px 7px",
                    borderRadius: 999,
                    border: "1px solid var(--border-subtle, #ddd)",
                    opacity: 0.95,
                    flex: "0 0 auto",
                  }}
                  title={`未讀 ${m.unread_count} 則`}
                  aria-label={`未讀 ${m.unread_count} 則`}
                >
                  {m.unread_count}
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.35 }}>{m.content}</div>
            </div>
          ))}
        </div>

        {/* Right: messages */}
        <div
          style={{
            flex: "1 1 70%",
            width: "70%",
            padding: 16,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!activeSession && (
            <div style={{ fontSize: 13, opacity: 0.75 }}>請先從左側選擇一個對話</div>
          )}

          {activeSession && (
            <>
              <div style={{ marginBottom: 10, fontWeight: 900, fontSize: 13 }}>
                {activeUserLabel || sessionTitle}
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
                  <div
                    key={m.id}
                    style={{
                      marginBottom: 10,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: m.sender_role === "admin" ? "flex-end" : "flex-start",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "80%",
                        border: "1px solid var(--border-subtle, #ddd)",
                        // ✅ 自己白色底、對方淡橘色底
                        background:
                          m.sender_role === "admin"
                            ? "var(--card-bg, #fff)"
                            : "var(--support-bubble-peer, rgb(253, 236, 214))",
                        borderRadius: 14,
                        padding: "10px 12px",
                        fontSize: 13,
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {m.content}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>
                      {m.sender_role}
                      {m?.created_at ? ` · ${new Date(m.created_at).toLocaleString()}` : ""}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={(e) => e.preventDefault()}>
                <div style={{ marginTop: 10 }}>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      // ✅ Enter 送出（Shift+Enter 換行）
                      if (e.key !== "Enter") return;
                      if (e.shiftKey) return;
                      if (e.nativeEvent?.isComposing) return;

                      e.preventDefault();
                      __onSend();
                    }}
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