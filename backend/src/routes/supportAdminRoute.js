// START PATH: backend/src/routes/supportAdminRoute.js
// PATH: backend/src/routes/supportAdminRoute.js
const express = require("express");

// =========================
// [support] trace helper (dev-only, no logic change)
// =========================
function __supportTrace(event, payload) {
  try { console.info("[support]", event, payload || {}); } catch (e) {}
}

const router = express.Router();
// [support] route enter trace (dev-only)
router.use((req, res, next) => {
  __supportTrace("supportAdminRoute:enter", {
    method: req.method,
    path: req.originalUrl || req.url,
    userId: req.user?.id || req.authUser?.id || null,
  });
  next();
});

const { createClient } = require("@supabase/supabase-js");
const authMiddleware = require("../middleware/authMiddleware");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getAdminAllowlist() {
  const raw = process.env.SUPPORT_ADMIN_EMAILS || "";
  return raw
    .split(/[,;\n\r\t\s]+/g)
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(req, res, next) {
  try {
    // ✅ 優先使用 authMiddleware 已驗證的使用者（避免重複打 supabase.auth.getUser）
    const emailFromAuthUser = String(req?.authUser?.email || "")
      .trim()
      .toLowerCase();

    let email = emailFromAuthUser;

    // fallback：若未掛 authMiddleware，維持原本行為（避免破壞既有路由掛載）
    if (!email) {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
      if (!token) return res.status(401).json({ error: "missing token" });

      const { data, error } = await supabase.auth.getUser(token);
      email = String(data?.user?.email || "").trim().toLowerCase();
      if (error || !email) {
        return res.status(401).json({ error: "invalid token" });
      }

      req.adminUser = data.user;
    } else {
      req.adminUser = req.authUser;
    }

    const allow = getAdminAllowlist();
    if (!allow.includes(email)) {
      return res.status(403).json({ error: "forbidden" });
    }

    next();
  } catch (e) {
    next(e);
  }
}

//
// ✅ GET /support/admin/me
// - 用於前端判斷是否為管理者（單一真相：後端 SUPPORT_ADMIN_EMAILS）
// - 需要 Authorization: Bearer <token>
//
router.get("/support/admin/me", authMiddleware, async (req, res) => {
  __supportTrace("admin:get:/support/admin/me", { query: req.query, user: req.user?.id || req.authUser?.id });
  try {
    const email = String(req?.authUser?.email || "").trim().toLowerCase();
    const allow = getAdminAllowlist();
    const isAdmin = !!email && allow.includes(email);
    return res.json({ is_admin: isAdmin, email: email || null });
  } catch (e) {
    return res.status(500).json({ error: "server_error" });
  }
});

/**
 * GET /support/admin/unread
 * 規則：user -> admin 未讀
 */
router.get("/support/admin/unread", authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(365, Number(req.query?.days || 30) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("support_messages")
      .select("id, session_id, sender_role, content, meta, created_at")
      .eq("sender_role", "user")
      .eq("is_read_by_admin", false)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ messages: data || [] });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /support/admin/conversations?days=30
 * - 左側欄：近 N 天內有訊息的對話列表（以 user/email 歸戶）
 * - 回傳：user_id + user_email + last_session_id + last_message + last_message_at + unread_count
 */
router.get(
  "/support/admin/conversations",
  authMiddleware,
  requireAdmin,
  async (req, res, next) => {
    try {
      const days = Math.max(1, Math.min(365, Number(req.query?.days || 30) || 30));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // 1) 先抓近 N 天的 messages（用 JS 做聚合：last message + unread_count）
      //    - limit：避免一次拉爆；如需更大，再做 RPC / view。
      const { data: msgRows, error: msgErr } = await supabase
        .from("support_messages")
        .select("session_id, sender_role, content, created_at, is_read_by_admin")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (msgErr) throw msgErr;

      // 2) 補 user_id（從 support_sessions）
      const sessionIds = Array.from(
        new Set((msgRows || []).map((m) => String(m?.session_id || "")).filter(Boolean))
      );
      if (sessionIds.length === 0) return res.json({ conversations: [] });

      const { data: sessions, error: sessErr } = await supabase
        .from("support_sessions")
        .select("id, user_id")
        .in("id", sessionIds);
      if (sessErr) throw sessErr;

      const sessionToUser = new Map();
      for (const s of sessions || []) {
        sessionToUser.set(String(s?.id || ""), String(s?.user_id || ""));
      }

      // 3) 以 user_id 做聚合（email 歸戶）
      const byUser = new Map();
      for (const m of msgRows || []) {
        const sid = String(m?.session_id || "");
        if (!sid) continue;
        const uid = sessionToUser.get(sid) || "";
        if (!uid) continue;

        const cur = byUser.get(uid) || {
          user_id: uid,
          last_session_id: "",
          last_message_at: null,
          last_message: "",
          unread_count: 0,
        };

        // last message（因為 msgRows 已 DESC，第一次看到就是最新）
        if (!cur.last_message_at && m?.created_at) {
          cur.last_message_at = m.created_at;
          cur.last_message = String(m?.content || "");
          cur.last_session_id = sid;
        }

        // unread_count：user -> admin 未讀
        if (m?.sender_role === "user" && m?.is_read_by_admin === false) {
          cur.unread_count += 1;
        }

        byUser.set(uid, cur);
      }

      const userIds = Array.from(byUser.keys());
      if (userIds.length === 0) return res.json({ conversations: [] });

      // 4) 補 email（從 profiles）
      let userIdToEmail = new Map();
      {
        const { data: profiles, error: profErr } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        if (profErr) throw profErr;
        userIdToEmail = new Map(
          (profiles || []).map((p) => [String(p?.id || ""), String(p?.email || "")])
        );
      }

      const conversations = userIds
        .map((uid) => {
          const base = byUser.get(uid);
          return {
            user_id: uid,
            user_email: userIdToEmail.get(uid) || "",
            last_session_id: String(base?.last_session_id || ""),
            last_message_at: base?.last_message_at || null,
            last_message: base?.last_message || "",
            unread_count: base?.unread_count || 0,
          };
        })
        .sort((a, b) => {
          const ta = a?.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const tb = b?.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return tb - ta;
        });

      return res.json({ conversations });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /support/admin/users/:userId/messages?days=30
 * - 以 user 歸戶：回傳該 user 近 N 天所有 session 的 messages（合併）
 */
router.get(
  "/support/admin/users/:userId/messages",
  authMiddleware,
  requireAdmin,
  async (req, res, next) => {
    try {
      const userId = String(req.params.userId || "").trim();
      if (!userId) return res.status(400).json({ error: "missing userId" });

      const days = Math.max(1, Math.min(365, Number(req.query?.days || 30) || 30));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data: sessions, error: sessErr } = await supabase
        .from("support_sessions")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (sessErr) throw sessErr;

      const sessionIds = (sessions || []).map((s) => String(s?.id || "")).filter(Boolean);
      if (sessionIds.length === 0) return res.json({ messages: [] });

      const { data, error } = await supabase
        .from("support_messages")
        .select(
          "id, session_id, sender_role, content, meta, is_read, is_read_by_admin, is_read_by_user, created_at, client_message_id"
        )
        .in("session_id", sessionIds)
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return res.json({ messages: data || [] });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * POST /support/admin/users/:userId/reply
 * - 以 user 歸戶：寫入該 user「最新 session（30 天內）」
 */
router.post(
  "/support/admin/users/:userId/reply",
  authMiddleware,
  requireAdmin,
  async (req, res, next) => {
    try {
      const userId = String(req.params.userId || "").trim();
      if (!userId) return res.status(400).json({ error: "missing userId" });

      const { content, clientMessageId } = req.body || {};
      const text = String(content || "").trim();
      if (!text) return res.status(400).json({ error: "missing content" });

      const days = 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // 找最新 session（30 天內）；沒有就建一個
      let sessionId = "";
      {
        const { data: sess, error: sessErr } = await supabase
          .from("support_sessions")
          .select("id")
          .eq("user_id", userId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sessErr) throw sessErr;
        sessionId = String(sess?.id || "");
      }

      if (!sessionId) {
        const { data: created, error: createErr } = await supabase
          .from("support_sessions")
          .insert({ user_id: userId })
          .select("id")
          .single();
        if (createErr) throw createErr;
        sessionId = String(created?.id || "");
      }

      const cmid = clientMessageId ? String(clientMessageId) : "";
      if (cmid) {
        const { data: existed, error: existedErr } = await supabase
          .from("support_messages")
          .select("id, created_at")
          .eq("session_id", sessionId)
          .eq("client_message_id", cmid)
          .maybeSingle();
        if (existedErr) throw existedErr;
        if (existed) return res.json({ messageId: existed.id, createdAt: existed.created_at });
      }

      const { data, error } = await supabase
        .from("support_messages")
        .insert({
          session_id: sessionId,
          sender_role: "admin",
          content: text,
          is_read: false,
          is_read_by_admin: true,
          is_read_by_user: false,
          meta: { admin: true },
          client_message_id: cmid || null,
        })
        .select("id, created_at")
        .single();

      if (error) {
        const code = String(error?.code || "");
        const msg = String(error?.message || "");
        const isDup = code === "23505" || msg.toLowerCase().includes("duplicate");
        if (isDup && cmid) {
          const { data: existed2, error: existed2Err } = await supabase
            .from("support_messages")
            .select("id, created_at")
            .eq("session_id", sessionId)
            .eq("client_message_id", cmid)
            .maybeSingle();
          if (existed2Err) throw existed2Err;
          if (existed2) return res.json({ messageId: existed2.id, createdAt: existed2.created_at });
        }
        throw error;
      }

      return res.json({ messageId: data.id, createdAt: data.created_at, sessionId });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * POST /support/admin/users/:userId/read
 * - 以 user 歸戶：將近 N 天內該 user 所有 session 的 user->admin 未讀標已讀
 */
router.post(
  "/support/admin/users/:userId/read",
  authMiddleware,
  requireAdmin,
  async (req, res, next) => {
    try {
      const userId = String(req.params.userId || "").trim();
      if (!userId) return res.status(400).json({ error: "missing userId" });

      const days = 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data: sessions, error: sessErr } = await supabase
        .from("support_sessions")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", since)
        .limit(50);
      if (sessErr) throw sessErr;

      const sessionIds = (sessions || []).map((s) => String(s?.id || "")).filter(Boolean);
      if (sessionIds.length === 0) return res.json({ ok: true });

      const { error } = await supabase
        .from("support_messages")
        .update({ is_read_by_admin: true })
        .in("session_id", sessionIds)
        .eq("sender_role", "user");

      if (error) throw error;
      return res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /support/admin/sessions/:id/messages
 */
router.get("/support/admin/sessions/:id/messages", authMiddleware, requireAdmin,
  async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const days = Math.max(1, Math.min(365, Number(req.query?.days || 30) || 30));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("support_messages")
        .select(
          "id, session_id, sender_role, content, meta, is_read, is_read_by_admin, is_read_by_user, created_at, client_message_id"
        )
        .eq("session_id", sessionId)
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      if (error) throw error;
      res.json({ messages: data || [] });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * POST /support/admin/sessions/:id/reply
 */
router.post("/support/admin/sessions/:id/reply", authMiddleware, requireAdmin,
  async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const { content, clientMessageId } = req.body || {};
      const text = String(content || "").trim();
      if (!text) return res.status(400).json({ error: "missing content" });

      const cmid = clientMessageId ? String(clientMessageId) : "";

      if (cmid) {
        const { data: existed, error: existedErr } = await supabase
          .from("support_messages")
          .select("id, created_at")
          .eq("session_id", sessionId)
          .eq("client_message_id", cmid)
          .maybeSingle();

        if (existedErr) throw existedErr;
        if (existed)
          return res.json({ messageId: existed.id, createdAt: existed.created_at });
      }

      const { data, error } = await supabase
        .from("support_messages")
        .insert({
          session_id: sessionId,
          sender_role: "admin",
          content: text,
          is_read: false,
          is_read_by_admin: true,
          is_read_by_user: false,
          meta: { admin: true },
          client_message_id: cmid || null,
        })
        .select("id, created_at")
        .single();

      if (error) {
        const code = String(error?.code || "");
        const msg = String(error?.message || "");
        const isDup =
          code === "23505" || msg.toLowerCase().includes("duplicate");
        if (isDup && cmid) {
          const { data: existed2, error: existed2Err } = await supabase
            .from("support_messages")
            .select("id, created_at")
            .eq("session_id", sessionId)
            .eq("client_message_id", cmid)
            .maybeSingle();
          if (existed2Err) throw existed2Err;
          if (existed2)
            return res.json({
              messageId: existed2.id,
              createdAt: existed2.created_at,
            });
        }
        throw error;
      }

      res.json({ messageId: data.id, createdAt: data.created_at });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * POST /support/admin/sessions/:id/read
 */
router.post("/support/admin/sessions/:id/read", authMiddleware, requireAdmin,
  async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const { error } = await supabase
        .from("support_messages")
        .update({ is_read_by_admin: true })
        .eq("session_id", sessionId)
        .eq("sender_role", "user");

      if (error) throw error;
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;

// END PATH: backend/src/routes/supportAdminRoute.js
