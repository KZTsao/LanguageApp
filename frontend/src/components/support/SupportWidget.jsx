// frontend/src/components/support/SupportWidget.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import useSupportChat from "../../hooks/useSupportChat";

/**
 * SupportWidget
 * - 右下角固定客服入口（UI shell + 最小資料層接線）
 * - ✅ Network 觸發時機：面板 open 時才啟動（避免一進站就打 API）
 *
 * MVP 能力（此版）
 * - 顯示訊息列表（user / support）
 * - 送出訊息（optimistic）
 * - 開啟面板自動 markRead（清除未讀 badge）
 * - 點擊視窗外自動關閉
 *
 * 異動紀錄（只追加，不刪除）：
 * - 2026-01-24：初版
 * - 2026-01-24：尺寸/位置/配色調整
 * - 2026-01-24：圖案改為對話雲
 * - 2026-01-24：點擊視窗外自動關閉
 * - 2026-01-24：純線條對話雲
 * - 2026-01-24：位置上移、尺寸放大
 * - 2026-01-24：接上 useSupportChat（open 才打 /api/support/*）
 * - 2026-01-24：補齊聊天 UI（列表/輸入/送出/scroll）
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
  if (r === "support" || r === "bot") return "support";
  return r || "support";
}

export default function SupportWidget({ authUserId, uiLang }) {
  const [open, setOpen] = useState(false);

  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState(null);

  const buttonSize = 52; // 放大一點
  const inset = 32; // 往內縮一些
  const lift = 26; // 往上抬高

  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const endRef = useRef(null);

  // ✅ 只在 open 時啟用 hook，確保「按下客服按鈕才會有 Network」
  const support = useSupportChat({ authUserId, uiLang, enabled: open });
  const unreadCount = support?.unreadCount || 0;

  // ✅ unread badge 不包含「自動回覆」
  // - 規則：只算 support/bot 且 is_read=false 且 meta.auto !== true
  const unreadCountEffective = useMemo(() => {
    try {
      const arr = Array.isArray(support?.messages) ? support.messages : [];
      let c = 0;
      for (const m of arr) {
        const role = safeRole(m.senderRole || m.sender_role);
        if (role === "user") continue;
        const isRead = typeof m.is_read === "boolean" ? m.is_read : !!m.isRead;
        if (isRead) continue;
        const autoFlag = m?.meta?.auto || m?.meta?.isAuto || m?.meta?.autoReply;
        if (autoFlag === true) continue;
        c += 1;
      }
      return c;
    } catch (e) {
      return support?.unreadCount || 0;
    }
  }, [support?.messages, support?.unreadCount]);

  const messages = useMemo(() => {
    const arr = Array.isArray(support?.messages) ? support.messages : [];
    return arr.map((m) => ({
      id: m.id,
      senderRole: safeRole(m.senderRole || m.sender_role),
      content: m.content || "",
      createdAt: m.createdAt || m.created_at,
      optimistic: !!m.optimistic,
      isRead: typeof m.is_read === "boolean" ? m.is_read : undefined,
    }));
  }, [support?.messages]);

  // 點擊視窗外自動關閉
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

  // ESC 鍵關閉面板
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);


  // ✅ open 後主動觸發一次：建立 session / 拉 messages / 標記已讀
  useEffect(() => {
    if (!open) return;

    // 這三支 API 呼叫都在 hook 內，這裡只是確保 open 後立刻啟動
    if (support?.initSession) support.initSession();
    if (support?.fetchMessages) support.fetchMessages({ limit: 50 });
    if (support?.markRead) support.markRead();

    // UI：開啟時把錯誤清掉
    setLocalError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // UI：新訊息時捲到最底
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
      await support.sendMessage({ content: text, meta: { uiLang, page: window.location?.pathname || "" } });
      setDraft("");

      // 送出後：拉一次 messages（拿到 bot 回覆），並刷新 unread（不影響你原本的邏輯）
      if (support?.fetchMessages) support.fetchMessages({ limit: 50 });
      if (support?.refreshUnread) support.refreshUnread();
    } catch (e) {
      setLocalError(e?.message || "send failed");
    }
  };

  const onKeyDown = (e) => {
    // Enter 送出，Shift+Enter 換行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <>
      {/* 浮動按鈕 */}
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
          {/* 線條對話雲（柔和線條色：使用 --icon-soft，若未定義則 fallback） */}
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

      {/* 面板 */}
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

          {/* Status line removed (user-facing) */}
          {/* Error line */}
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
                  （此面板在打開時才會連線，不會影響主頁查字流程）
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
                        background: "var(--card-bg)",
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

          {/* Debug footer (保留但不影響 UI) */}
          <div style={{ fontSize: 11, opacity: 0.45 }}>
          {/* debug footer removed for user-facing UI */}
          </div>
        </div>
      )}
    </>
  );
}
//
// frontend/src/components/support/SupportWidget.jsx