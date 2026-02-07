// PATH: frontend/src/components/support/SupportWidget.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import useSupportChat from "../../hooks/useSupportChat";

/**
 * SupportWidget
 *
 * ✅ 需求對應（2026-02-03）
 * 1) user 對話視窗保留歷史（localStorage）
 * 3) 自己白色底、對方淡橘色底
 * 4) user 未讀訊息 badge（面板關閉時也能更新）
 *
 * ⚠️ 修正（針對你截圖的 404）
 * - 不再呼叫 /api/support/unread（後端不存在）
 * - 面板關閉時：若 hook 有 refreshUnread() 才輪詢；沒有就不打任何不存在的 API
 */

function formatTime(iso) {
  try {
    if (!iso) return "";
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch (e) {
    return "";
  }
}

function safeRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "user") return "user";
  if (r === "support" || r === "bot" || r === "admin") return "support";
  return r || "support";
}

export default function SupportWidget({ authUserId, uiLang }) {
  const composingRef = React.useRef(false);
  const lastCompositionEndAtRef = React.useRef(0);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState(null);

  const buttonSize = 52;
  const inset = 32;
  const lift = 26;

  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const endRef = useRef(null);

  // ✅ per-user cache key（保留歷史）
  const cacheKey = useMemo(() => {
    const uid = String(authUserId || "").trim();
    return uid ? `support_chat_history__${uid}` : "support_chat_history__anon";
  }, [authUserId]);

  // ✅ local cached messages (history)
  const [cachedMessages, setCachedMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // ✅ hook 常駐（為了面板關閉時也能 refreshUnread / badge）
  const support = useSupportChat({ authUserId, uiLang, enabled: true });
  const unreadCount = support?.unreadCount || 0;

  // ✅ messages source: hook -> cache fallback
  const messages = useMemo(() => {
    const arr = Array.isArray(support?.messages)
      ? support.messages
      : Array.isArray(cachedMessages)
      ? cachedMessages
      : [];
    return arr.map((m) => ({
      id: m.id,
      senderRole: safeRole(m.senderRole || m.sender_role),
      content: m.content || "",
      createdAt: m.createdAt || m.created_at,
      optimistic: !!m.optimistic,
      isRead: typeof m.is_read === "boolean" ? m.is_read : undefined,
      meta: m.meta,
    }));
  }, [support?.messages, cachedMessages]);

  // ✅ any new messages -> persist (keep history)
  useEffect(() => {
    try {
      if (!Array.isArray(support?.messages)) return;
      const arr = support.messages;
      setCachedMessages(arr);
      localStorage.setItem(cacheKey, JSON.stringify(arr));
    } catch {
      // ignore
    }
  }, [support?.messages, cacheKey]);

  // ✅ unread badge 不包含「自動回覆」
  // - 優先用 messages 自算（避免 hook unreadCount 不準）
  // - 同時保留 unreadCount 作為 fallback
  const unreadCountEffective = useMemo(() => {
    try {
      const arr = Array.isArray(messages) ? messages : [];
      let c = 0;
      for (const m of arr) {
        const role = safeRole(m.senderRole);
        if (role === "user") continue;
        const isRead = typeof m.isRead === "boolean" ? m.isRead : false;
        if (isRead) continue;
        const autoFlag = m?.meta?.auto || m?.meta?.isAuto || m?.meta?.autoReply;
        if (autoFlag === true) continue;
        c += 1;
      }
      const hookUnread = Number.isFinite(unreadCount) ? unreadCount : 0;
      return Math.max(c, hookUnread);
    } catch (e) {
      const hookUnread = Number.isFinite(unreadCount) ? unreadCount : 0;
      return hookUnread;
    }
  }, [messages, unreadCount]);

  // ✅ 面板關閉：輪詢 hook.refreshUnread()（若存在）
  // 重要：不再打 /api/support/unread，所以不會再噴 404
  useEffect(() => {
    let timer = null;

    async function tick() {
      try {
        if (typeof support?.refreshUnread === "function") {
          await support.refreshUnread();
        }
      } catch {
        // ignore（不要讓 console 被刷）
      }
    }

    if (!open) {
      tick();
      timer = setInterval(tick, 30000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [open, support]);

  // click outside close
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // ESC close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (window.__SPEAK_PANEL_OPEN || window.__CONV_NAV_ACTIVE) return;
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // ✅ open: init session + fetch + markRead
  useEffect(() => {
    if (!open) return;

    if (support?.initSession) support.initSession();
    if (support?.fetchMessages) support.fetchMessages({ limit: 50 });
    if (support?.markRead) support.markRead();

    setLocalError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // scroll to bottom on new message (open only)
  useEffect(() => {
    if (!open) return;
    try {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch (e) {}
  }, [open, messages.length]);

  const onSend = async () => {
    const text = String(draft || "").trim();
    if (!text) return;
    if (!support?.sendMessage) return;

    try {
      setLocalError(null);

      if (!support?.sessionId && support?.initSession) {
        await support.initSession();
      }

      await support.sendMessage({
        content: text,
        meta: { uiLang, page: window.location?.pathname || "" },
      });

      setDraft("");

      if (support?.fetchMessages) support.fetchMessages({ limit: 50 });
      if (support?.refreshUnread) support.refreshUnread();
    } catch (e) {
      setLocalError(e?.message || "send failed");
    }
  };

  const onKeyDown = (e) => {
    const ne = e && e.nativeEvent ? e.nativeEvent : null;
    const isComposingNow = !!(composingRef.current || (ne && ne.isComposing) || e.keyCode === 229);

    if (e.key === "Enter") {
      if (e.shiftKey) return;

      const now = Date.now();
      const justEndedComposition = now - (lastCompositionEndAtRef.current || 0) < 80;
      if (isComposingNow || justEndedComposition) return;

      e.preventDefault();
      onSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <div
        style={{
          position: "fixed",
          right: inset,
          bottom: inset + lift,
          zIndex: 9999,
        }}
      >
        <button
          ref={buttonRef}
          type="button"
          aria-label="Support"
          onClick={() => setOpen((v) => !v)}
          style={{
            width: buttonSize,
            height: buttonSize,
            borderRadius: "50%",
            border: "1px solid var(--accent, var(--accent-orange))",
            background: "var(--card-bg)",
            cursor: "pointer",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="客服"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--icon-soft, rgba(44, 44, 44, 0.55))"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 4h14a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H11l-6 4v-4H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />
          </svg>

          {unreadCountEffective > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                padding: "0 4px",
                borderRadius: 9,
                background: "red",
                color: "#fff",
                fontSize: 12,
                lineHeight: "18px",
                textAlign: "center",
              }}
            >
              {unreadCountEffective}
            </span>
          )}
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            right: inset,
            bottom: inset + lift + buttonSize + 14,
            width: 340,
            height: 460,
            borderRadius: 12,
            background: "var(--support-panel-bg, rgb(253, 236, 214))",
            zIndex: 9999,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "2px 2px 4px 2px",
            }}
          >
            <div style={{ fontWeight: 800 }}>Support</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                border: "1px solid var(--border-subtle)",
                background: "var(--card-bg)",
                borderRadius: 8,
                padding: "4px 8px",
                cursor: "pointer",
              }}
              title="Close"
            >
              ×
            </button>
          </div>

          {/* Error */}
          {(localError || support?.error) && (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {String(localError || support?.error?.message || support?.error)}
            </div>
          )}

          {/* Messages */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: "auto",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: "var(--card-bg)",
            }}
          >
            {messages.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.5 }}>
                你好！如果你遇到問題或想回報 bug，可以在這裡留言，我們會盡快處理。
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
                  （歷史訊息會保留在本機；打開面板才會同步）
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.senderRole === "user";
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isUser ? "flex-end" : "flex-start",
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "85%",
                        border: "1px solid var(--border-subtle)",
                        // ✅ 自己白色底、對方淡橘色底
                        background: isUser
                          ? "var(--card-bg, #fff)"
                          : "var(--support-bubble-peer, rgb(253, 236, 214))",
                        borderRadius: 12,
                        padding: "8px 10px",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.45,
                        fontSize: 13,
                      }}
                    >
                      {m.content}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.55 }}>
                      {formatTime(m.createdAt)}
                      {m.optimistic ? " · ..." : ""}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="輸入訊息…（Enter 送出，Shift+Enter 換行）"
              style={{
                flex: 1,
                resize: "none",
                height: 44,
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
                background: "var(--card-bg)",
                padding: "8px 10px",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={support?.sending || !String(draft || "").trim()}
              style={{
                width: 72,
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
                background: "var(--card-bg)",
                cursor: support?.sending ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
              title="Send"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// END PATH: frontend/src/components/support/SupportWidget.jsx
