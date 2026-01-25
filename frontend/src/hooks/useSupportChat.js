// frontend/src/hooks/useSupportChat.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * useSupportChat
 * - SupportWidget 專用 hook（主線任務：先把資料層鋪好）
 * - 不介入 analyze / learning / snapshot
 *
 * 目前階段（MVP）
 * - 建立/取得 session
 * - 拉取 messages
 * - 送出 message（含 optimistic）
 * - unreadCount（先用 API fallback，Realtime 後續再接）
 *
 * 注意
 * - 這支 hook 不強制你一定要登入；未登入時使用 anonId（localStorage）
 *
 * 異動紀錄（只追加，不刪除）：
 * - 2026-01-24：初版建立（session/messages/unread 基礎）
 */

function getOrCreateAnonId() {
  try {
    const key = "support_anon_id";
    let v = window.localStorage.getItem(key);
    if (!v) {
      v = `anon_${Math.random().toString(16).slice(2)}_${Date.now()}`;
      window.localStorage.setItem(key, v);
    }
    return v;
  } catch (e) {
    return `anon_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

async function apiJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Support API error ${res.status}: ${text || url}`);
  }
  return res.json();
}

export default function useSupportChat({
  authUserId, // 可為 null/undefined
  uiLang,
  enabled = true, // 支援日後做 feature flag
} = {}) {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const anonIdRef = useRef(null);
  const lastFetchAtRef = useRef(0);

  const identity = useMemo(() => {
    // 未登入就用 anonId
    if (!anonIdRef.current) anonIdRef.current = getOrCreateAnonId();
    return {
      authUserId: authUserId || null,
      anonId: anonIdRef.current,
      uiLang: uiLang || "zh-TW",
    };
  }, [authUserId, uiLang]);

  const initSession = useCallback(async () => {
    if (!enabled) return null;
    try {
      setError(null);
      const data = await apiJson("/api/support/session", {
        method: "POST",
        body: JSON.stringify({
          anonId: identity.anonId,
          uiLang: identity.uiLang,
          pagePath: window.location?.pathname || "",
          meta: {
            ua: navigator.userAgent,
          },
        }),
      });

      if (data?.sessionId) {
        setSessionId(data.sessionId);
        if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
      }
      return data?.sessionId || null;
    } catch (e) {
      setError(e);
      return null;
    }
  }, [enabled, identity.anonId, identity.uiLang]);

  const fetchMessages = useCallback(
    async ({ limit = 50 } = {}) => {
      if (!enabled) return;
      if (!sessionId) return;

      // 簡單節流，避免 UI 連點
      const now = Date.now();
      if (now - lastFetchAtRef.current < 300) return;
      lastFetchAtRef.current = now;

      try {
        setLoading(true);
        setError(null);
        const data = await apiJson(`/api/support/messages?sessionId=${encodeURIComponent(sessionId)}&limit=${limit}`);
        const next = Array.isArray(data?.messages) ? data.messages : [];
        setMessages(next);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [enabled, sessionId]
  );

  const refreshUnread = useCallback(async () => {
    if (!enabled) return;
    if (!sessionId) return;
    try {
      const data = await apiJson(`/api/support/unread_count?sessionId=${encodeURIComponent(sessionId)}`);
      if (typeof data?.unreadCount === "number") setUnreadCount(data.unreadCount);
    } catch (e) {
      // unread 失敗不應該打斷 UI
      setError(e);
    }
  }, [enabled, sessionId]);

  const markRead = useCallback(async () => {
    if (!enabled) return;
    if (!sessionId) return;
    try {
      await apiJson("/api/support/read", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      setUnreadCount(0);
    } catch (e) {
      setError(e);
    }
  }, [enabled, sessionId]);

  const sendMessage = useCallback(
    async ({ content, meta } = {}) => {
      if (!enabled) return;
      if (!sessionId) return;
      const text = (content || "").trim();
      if (!text) return;

      // optimistic message
      const optimisticId = `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const optimistic = {
        id: optimisticId,
        senderRole: "user",
        content: text,
        createdAt: new Date().toISOString(),
        optimistic: true,
      };

      setMessages((prev) => [...prev, optimistic]);

      try {
        setSending(true);
        setError(null);

        const data = await apiJson("/api/support/messages", {
          method: "POST",
          body: JSON.stringify({
            sessionId,
            content: text,
            meta: {
              ...(meta || {}),
              pagePath: window.location?.pathname || "",
              uiLang: identity.uiLang,
            },
          }),
        });

        // 用 server 回來的資訊替換 optimistic（找不到就保留）
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? {
                  ...m,
                  id: data?.messageId || m.id,
                  createdAt: data?.createdAt || m.createdAt,
                  optimistic: false,
                }
              : m
          )
        );

        // 送出後：通常視為 user 已讀自己的 session
        // （是否要 markRead 可由上層控制，這裡不強制）
      } catch (e) {
        setError(e);
        // 標記失敗（保留訊息但標註 error）
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, optimistic: false, error: true } : m))
        );
      } finally {
        setSending(false);
      }
    },
    [enabled, sessionId, identity.uiLang]
  );

  // init: enabled 時建立 session
  useEffect(() => {
    if (!enabled) return;
    if (sessionId) return;
    initSession();
  }, [enabled, sessionId, initSession]);

  // session ready 後：先拉一次 messages + unread
  useEffect(() => {
    if (!enabled) return;
    if (!sessionId) return;
    fetchMessages({ limit: 50 });
    refreshUnread();
  }, [enabled, sessionId, fetchMessages, refreshUnread]);

  return {
    // identity
    authUserId: identity.authUserId,
    anonId: identity.anonId,
    uiLang: identity.uiLang,

    // state
    sessionId,
    messages,
    unreadCount,
    loading,
    sending,
    error,

    // actions
    initSession,
    fetchMessages,
    sendMessage,
    refreshUnread,
    markRead,
  };
}
//
// frontend/src/hooks/useSupportChat.js
