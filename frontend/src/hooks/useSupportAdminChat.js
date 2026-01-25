// frontend/src/hooks/useSupportAdminChat.js
import { useEffect, useState, useCallback } from "react";

export default function useSupportAdminChat() {
  const [unread, setUnread] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchUnread = useCallback(async () => {
    const res = await fetch("/api/support/admin/unread");
    const json = await res.json();
    setUnread(json.messages || []);
  }, []);

  const openSession = useCallback(async (sessionId) => {
    setActiveSession(sessionId);
    setLoading(true);
    const res = await fetch(`/api/support/admin/sessions/${sessionId}/messages`);
    const json = await res.json();
    setMessages(json.messages || []);
    setLoading(false);
  }, []);

  const sendReply = useCallback(async (content) => {
    if (!activeSession) return;
    await fetch(`/api/support/admin/sessions/${activeSession}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    await openSession(activeSession);
    await fetchUnread();
  }, [activeSession, openSession, fetchUnread]);

  const markRead = useCallback(async (sessionId) => {
    await fetch(`/api/support/admin/sessions/${sessionId}/read`, { method: "POST" });
    await fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  return {
    unread,
    messages,
    activeSession,
    loading,
    openSession,
    sendReply,
    markRead,
  };
}

// frontend/src/hooks/useSupportAdminChat.js
