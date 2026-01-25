// backend/src/routes/supportRoute.js
const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Support API
 * - 注意：server.js 以 app.use("/api", supportRoute) 掛載
 * - 因此本檔案內的 path 以 /support/... 為主
 *
 * 異動紀錄（只追加，不刪除）：
 * - 2026-01-24：初版 routes
 * - 2026-01-24：加入 bot auto-reply、未讀 unread/read 規則（只算非 user）
 */

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------
function normalizeLimit(v, fallback = 50) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(200, Math.floor(n)));
}

function getAutoReplyText(uiLang) {
  // ✅ 最小可用：固定文案（之後可改成 i18n / template）
  if (String(uiLang || "").toLowerCase().startsWith("en")) {
    return "Thanks! We received your message and will get back to you as soon as possible.";
  }
  if (String(uiLang || "").toLowerCase().startsWith("de")) {
    return "Vielen Dank! Wir haben deine Nachricht erhalten und kümmern uns so schnell wie möglich darum.";
  }
  return "已收到，我們會盡快處理。";
}

/**
 * POST /api/support/session
 */
router.post("/support/session", async (req, res, next) => {
  try {
    const { anonId, uiLang, pagePath, meta } = req.body || {};

    // ✅ 仍維持「每次開啟就建立 session」的行為（不改既有邏輯）
    const { data, error } = await supabase
      .from("support_sessions")
      .insert({
        anon_id: anonId,
        ui_lang: uiLang,
        page_path: pagePath,
        meta: meta || {},
      })
      .select("id")
      .single();

    if (error) throw error;
    res.json({ sessionId: data.id, unreadCount: 0 });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/support/messages
 */
router.get("/support/messages", async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    const limit = normalizeLimit(req.query?.limit, 50);

    const { data, error } = await supabase
      .from("support_messages")
      .select("id, session_id, sender_role, content, meta, is_read, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    res.json({ messages: data });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/support/messages
 * - 插入 user 訊息後，自動插入一則 bot/support 回覆
 */
router.post("/support/messages", async (req, res, next) => {
  try {
    const { sessionId, content, meta } = req.body || {};
    const text = String(content || "").trim();

    if (!sessionId) {
      return res.status(400).json({ error: "missing sessionId" });
    }
    if (!text) {
      return res.status(400).json({ error: "missing content" });
    }

    // 1) 插入 user 訊息（不改既有欄位結構）
    const { data: userMsg, error: userErr } = await supabase
      .from("support_messages")
      .insert({
        session_id: sessionId,
        sender_role: "user",
        content: text,
        meta: meta || {},
        // user 的訊息不需要 unread 追蹤，直接視為已讀
        is_read: true,
      })
      .select("id, created_at")
      .single();

    if (userErr) throw userErr;

    // 2) 自動插入 bot/support 回覆（讓 unread 有意義）
    //    - bot/support 的訊息設為 is_read=false
    //    - 文案使用 session 的 ui_lang（如果有）
    let uiLang = meta?.uiLang;
    if (!uiLang) {
      const { data: sess } = await supabase
        .from("support_sessions")
        .select("ui_lang")
        .eq("id", sessionId)
        .maybeSingle();
      uiLang = sess?.ui_lang;
    }

    const replyText = getAutoReplyText(uiLang);

    const { data: botMsg, error: botErr } = await supabase
      .from("support_messages")
      .insert({
        session_id: sessionId,
        sender_role: "support",
        content: replyText,
        meta: { auto: true, reason: "auto-reply" },
        is_read: false,
      })
      .select("id, created_at")
      .single();

    if (botErr) throw botErr;

    // 回傳 user message id（前端 optimistic 用）
    res.json({
      messageId: userMsg.id,
      createdAt: userMsg.created_at,
      autoReply: {
        messageId: botMsg.id,
        createdAt: botMsg.created_at,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/support/unread_count
 * - ✅ 只算「非 user」訊息的未讀（support/bot）
 */
router.get("/support/unread_count", async (req, res, next) => {
  try {
    const { sessionId } = req.query;

    const { count, error } = await supabase
      .from("support_messages")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .neq("sender_role", "user")
      .eq("is_read", false);

    if (error) throw error;
    res.json({ unreadCount: count || 0 });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/support/read
 * - ✅ 只把「非 user」訊息標記為已讀（support/bot）
 */
router.post("/support/read", async (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: "missing sessionId" });

    const { error } = await supabase
      .from("support_messages")
      .update({ is_read: true })
      .eq("session_id", sessionId)
      .neq("sender_role", "user")
      .eq("is_read", false);

    if (error) throw error;

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

// backend/src/routes/supportRoute.js
