// PATH: frontend/src/hooks/useSupportAdminChat.js
/**
 * useSupportAdminChat（前端 MVP / 串後端 admin API）
 * - 目的：支援 SupportAdminPage 的「未讀列表 / 會話切換 / 回覆」
 *
 * ✅ 新需求（2026-02-03）
 * 2) admin 對話視窗要能夠保留同一個 user 對話歷史紀錄
 *    - 以 session_id 為 key，localStorage cache + 先渲染 cache 再背景刷新
 */

import {useMemo, useRef, useState, useEffect} from "react";
import { apiFetch } from "../utils/apiClient";

// =========================
// [support] trace helpers (usa, dev-only)
// =========================
function __supportTraceOn_usa() {
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
function __supportTrace_usa(event, payload) {
  if (!__supportTraceOn_usa()) return;
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



// ===== end logger =====

function makeClientMessageId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {}
  return `cm_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function ensureOk(res, json, fallback) {
  if (res.ok) return;
  const msg = json?.error || json?.message || fallback || `request failed (${res.status})`;
  throw new Error(String(msg));
}

export default function useSupportAdminChat() {
  __supportTrace_usa("init", {});

  __supportTrace("useSupportAdminChat:init", {});

  
  // ✅ recent conversations (email grouped)
  const [conversations, setConversations] = useState([]);

  const fetchRecentConversations = async (days = 30) => {
    const __days = Number(days || 30) || 30;
    try {
      const res = await __supportTrace("apiFetch", { url: String(`/api/support/admin/conversations?days=${__days}`) });
    apiFetch(`/api/support/admin/conversations?days=${__days}`, { method: "GET" });
      const json = await readJsonSafe(res);
      ensureOk(res, json, "conversations fetch failed");

      // allow both {items:[...]} or [...]
      const items = Array.isArray(json) ? json : (json?.items || json?.conversations || json?.rows || []);
      setConversations(Array.isArray(items) ? items : []);
      return Array.isArray(items) ? items : [];
    } catch (e) {
      setConversations([]);
      return [];
    }
  };

  useEffect(() => {
    fetchRecentConversations(30);
  }, []);

const ADMIN_CACHE_KEY = "support_admin_cache__v1";

  const loadCacheSafe = () => {
    try {
      const raw = localStorage.getItem(ADMIN_CACHE_KEY);
      if (!raw) return {
    fetchRecentConversations,
conversations,
lastActiveSession: "", sessions: {} };
      const parsed = JSON.parse(raw);
      return {
        lastActiveSession: String(parsed?.lastActiveSession || ""),
        sessions: parsed?.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
      };
    } catch {
      return { lastActiveSession: "", sessions: {} };
    }
  };

  const saveCacheSafe = (next) => {
    try {
      localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const bootCacheRef = useRef(loadCacheSafe());
  const sessionsCacheRef = useRef(bootCacheRef.current.sessions || {});

  const [activeSession, setActiveSession] = useState(() => bootCacheRef.current.lastActiveSession || "");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState(() => {
    const sid = String(bootCacheRef.current.lastActiveSession || "");
    const cached = sid ? sessionsCacheRef.current?.[sid] : null;
    return Array.isArray(cached) ? cached : [];
  });

  const [unreadVersion, setUnreadVersion] = useState(0);

  const unreadCacheRef = useRef([]);
  const inFlightRef = useRef(new Set());

  const unread = useMemo(() => {
    const arr = unreadCacheRef.current;
    return Array.isArray(arr) ? arr : [];
  }, [unreadVersion]);

  const refreshUnread = async () => {
    const res = await __supportTrace("apiFetch", { url: String("/api/support/admin/unread") });
    apiFetch("/api/support/admin/unread", { method: "GET" });
    const json = await readJsonSafe(res);
    ensureOk(res, json, "unread fetch failed");

    unreadCacheRef.current = Array.isArray(json?.messages) ? json.messages : [];
    setUnreadVersion((v) => v + 1);
    return unreadCacheRef.current;
  };

  const openSession = async (sessionId) => {
    const sid = String(sessionId || "");
    if (!sid) return;

    // ✅ 先用 cache 立即渲染（保留歷史），再背景刷新
    try {
      const cached = sessionsCacheRef.current?.[sid];
      if (Array.isArray(cached) && cached.length > 0) {
        setMessages(cached);
      }
    } catch {}

    setLoading(true);
    try {
      setActiveSession(sid);

      // ✅ persist activeSession
      try {
        saveCacheSafe({ lastActiveSession: sid, sessions: sessionsCacheRef.current });
      } catch {}

      const res = await __supportTrace("apiFetch", { url: String(`/api/support/admin/sessions/${sid}/messages`) });
    apiFetch(`/api/support/admin/sessions/${sid}/messages`, { method: "GET" });
      const json = await readJsonSafe(res);
      ensureOk(res, json, "openSession failed");

      const arr = Array.isArray(json?.messages) ? json.messages : [];
      setMessages(arr);

      // ✅ cache per session
      try {
        sessionsCacheRef.current = { ...(sessionsCacheRef.current || {}), [sid]: arr };
        saveCacheSafe({ lastActiveSession: sid, sessions: sessionsCacheRef.current });
      } catch {}

      return arr;
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (sessionId) => {
    const sid = String(sessionId || "");
    if (!sid) return;

    const res = await __supportTrace("apiFetch", { url: String(`/api/support/admin/sessions/${sid}/read`) });
    apiFetch(`/api/support/admin/sessions/${sid}/read`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const json = await readJsonSafe(res);
    ensureOk(res, json, "markRead failed");

    await refreshUnread();
    return true;
  };

  const sendReply = async (text) => {
    const sid = String(activeSession || "");
    if (!sid) return;

    const content = String(text || "").trim();
    if (!content) return;

    const clientMessageId = makeClientMessageId();
    if (inFlightRef.current.has(clientMessageId)) return;
    inFlightRef.current.add(clientMessageId);

    try {
      const res = await __supportTrace("apiFetch", { url: String(`/api/support/admin/sessions/${sid}/reply`) });
    apiFetch(`/api/support/admin/sessions/${sid}/reply`, {
        method: "POST",
        body: JSON.stringify({ content, clientMessageId }),
      });
      const json = await readJsonSafe(res);
      ensureOk(res, json, "sendReply failed");

      await openSession(sid);
      await refreshUnread();

      return json;
    } finally {
      inFlightRef.current.delete(clientMessageId);
    }
  };

  return {
    unread,
    messages,
    activeSession,
    loading,
    openSession,
    // aliases (email/user based UI)
    openConversation: openSession,
    openUser: openSession,
    sendReply,
    markRead,
    refreshUnread,
  };
}
// END PATH: frontend/src/hooks/useSupportAdminChat.js
