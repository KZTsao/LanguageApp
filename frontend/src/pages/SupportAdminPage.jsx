// PATH: frontend/src/hooks/useSupportAdminChat.js
/**
 * useSupportAdminChat (前端 MVP / mock)
 * - 目的：支援 SupportAdminPage 的「未讀列表 / 會話切換 / 回覆」最小可用功能
 * - 本版不接後端、不打 API：以記憶體 mock data 模擬
 * - 後續要接後端時：把 openSession/sendReply/markRead 內的 mock 操作換成 fetch 即可
 */

import { useMemo, useRef, useState } from "react";

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function makeId(prefix = "m") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function buildMockStore() {
  const sessionA = "sess_demo_001";
  const sessionB = "sess_demo_002";

  const store = {
    sessions: [sessionA, sessionB],
    messagesBySession: {
      [sessionA]: [
        {
          id: makeId("u"),
          session_id: sessionA,
          sender_role: "user",
          content: "我付款成功了但還是顯示 free plan，怎麼辦？",
          created_at: nowIso(),
        },
        {
          id: makeId("a"),
          session_id: sessionA,
          sender_role: "admin",
          content: "我先幫你看一下帳號狀態，你方便提供 email 嗎？",
          created_at: nowIso(),
        },
        {
          id: makeId("u"),
          session_id: sessionA,
          sender_role: "user",
          content: "email 是 test@example.com",
          created_at: nowIso(),
        },
      ],
      [sessionB]: [
        {
          id: makeId("u"),
          session_id: sessionB,
          sender_role: "user",
          content: "我在 ExampleSentence 按錄音會直接關掉面板",
          created_at: nowIso(),
        },
      ],
    },
    unreadBySession: {
      [sessionA]: true,
      [sessionB]: true,
    },
  };

  return store;
}

export default function useSupportAdminChat() {
  // mock store lives in a ref so it persists across renders
  const storeRef = useRef(null);
  if (!storeRef.current) storeRef.current = buildMockStore();

  const [activeSession, setActiveSession] = useState("");
  const [loading, setLoading] = useState(false);

  // state that UI reads
  const [messages, setMessages] = useState([]);
  const [unreadVersion, setUnreadVersion] = useState(0);

  const unread = useMemo(() => {
    const store = storeRef.current;
    const out = [];
    (store.sessions || []).forEach((sid) => {
      if (!store.unreadBySession?.[sid]) return;
      const msgs = store.messagesBySession?.[sid] || [];
      const last = msgs[msgs.length - 1];
      if (!last) return;
      out.push({
        id: `unread_${sid}`,
        session_id: sid,
        content: last.content || "",
        created_at: last.created_at || "",
      });
    });
    // newest first (best-effort)
    out.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return out;
  }, [unreadVersion]);

  const openSession = async (sessionId) => {
    const sid = String(sessionId || "");
    if (!sid) return;

    setLoading(true);
    try {
      setActiveSession(sid);

      const store = storeRef.current;
      const msgs = store.messagesBySession?.[sid] || [];
      // simulate async
      await new Promise((r) => setTimeout(r, 120));
      setMessages(msgs.slice());
    } finally {
      setLoading(false);
    }
  };

  const markRead = (sessionId) => {
    const sid = String(sessionId || "");
    if (!sid) return;

    const store = storeRef.current;
    if (store.unreadBySession && store.unreadBySession[sid]) {
      store.unreadBySession[sid] = false;
      setUnreadVersion((v) => v + 1);
    }
  };

  const sendReply = (text) => {
    const content = String(text || "").trim();
    if (!content) return;
    if (!activeSession) return;

    const sid = activeSession;
    const store = storeRef.current;

    const msg = {
      id: makeId("a"),
      session_id: sid,
      sender_role: "admin",
      content,
      created_at: nowIso(),
    };

    if (!store.messagesBySession[sid]) store.messagesBySession[sid] = [];
    store.messagesBySession[sid].push(msg);

    // UI update
    setMessages((prev) => prev.concat([msg]));
  };

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

// END PATH: frontend/src/hooks/useSupportAdminChat.js
