// backend/src/routes/supportAdminRoute.js
const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getAdminAllowlist() {
  const raw = process.env.SUPPORT_ADMIN_EMAILS || "";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

async function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "missing token" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.email) {
      return res.status(401).json({ error: "invalid token" });
    }

    const allow = getAdminAllowlist();
    if (!allow.includes(data.user.email)) {
      return res.status(403).json({ error: "forbidden" });
    }

    req.adminUser = data.user;
    next();
  } catch (e) {
    next(e);
  }
}

// GET unread
router.get("/support/admin/unread", requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("support_messages")
      .select("id, session_id, sender_role, content, meta, created_at")
      .neq("sender_role", "user")
      .eq("is_read", false)
      .not("meta->>auto", "eq", "true")
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ messages: data || [] });
  } catch (e) {
    next(e);
  }
});

// GET session messages
router.get("/support/admin/sessions/:id/messages", requireAdmin, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const { data, error } = await supabase
      .from("support_messages")
      .select("id, session_id, sender_role, content, meta, is_read, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ messages: data || [] });
  } catch (e) {
    next(e);
  }
});

// POST reply
router.post("/support/admin/sessions/:id/reply", requireAdmin, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const { content } = req.body || {};
    const text = String(content || "").trim();
    if (!text) return res.status(400).json({ error: "missing content" });

    const { data, error } = await supabase
      .from("support_messages")
      .insert({
        session_id: sessionId,
        sender_role: "support",
        content: text,
        is_read: false,
        meta: { admin: true },
      })
      .select("id, created_at")
      .single();

    if (error) throw error;
    res.json({ messageId: data.id, createdAt: data.created_at });
  } catch (e) {
    next(e);
  }
});

// POST mark read
router.post("/support/admin/sessions/:id/read", requireAdmin, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const { error } = await supabase
      .from("support_messages")
      .update({ is_read: true })
      .eq("session_id", sessionId)
      .neq("sender_role", "user");

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

// backend/src/routes/supportAdminRoute.js
