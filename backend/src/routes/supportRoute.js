// PATH: backend/src/routes/supportRoute.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { getSupabaseAdmin } = require("../db/supabaseAdmin");

/**
 * Support API
 * - server.js 以 app.use("/api", supportRoute) 掛載
 * - 因此本檔案內的 path 以 /support/... 為主
 *
 * 現況（你確認的事實）：
 * - 目前只有 support_sessions / support_messages 有被使用（前端依賴 is_read）
 * - support_chat_sessions / support_chat_messages 存在但未使用
 *
 * 本次改動目標（最小且不破壞）：
 * 1) 保留既有行為：仍以 support_sessions/support_messages 為主（不改 response shape）
 * 2) 新增「雙寫」到 support_chat_*（避免未來切換 schema 時資料斷層）
 * 3) 改用既有 supabaseAdmin（統一後端 DB client）
 *
 * 雙寫開關：
 * - env SUPPORT_DUAL_WRITE_CHAT=0 可關閉（預設開啟）
 *
 * 異動紀錄（只追加，不刪除）：
 * - 2026-01-24：初版 routes
 * - 2026-01-24：加入 bot auto-reply、未讀 unread/read 規則（只算非 user）
 * - 2026-01-27：改用 supabaseAdmin + 增加 support_chat_* 雙寫（預設開）
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

function shouldDualWriteChat() {
  const v = String(process.env.SUPPORT_DUAL_WRITE_CHAT || "1").trim();
  return v !== "0" && v.toLowerCase() !== "false";
}

function safeJson(v) {
  if (v && typeof v === "object") return v;
  return {};
}

/**
 * 嘗試同步建立 support_chat_sessions（不影響既有流程）
 * - 這裡採「同一個 UUID」作為兩套 session 的 id，方便未來切換 schema
 */
async function dualCreateChatSession({ supabase, id, anonId, meta }) {
  if (!shouldDualWriteChat()) return;
  try {
    const payloadMeta = safeJson(meta);
    await supabase.from("support_chat_sessions").insert({
      id,
      anon_id: anonId || null,
      status: "open",
      subject: null,
      meta: payloadMeta,
      // last_message_at / read_at 由後續 message/write 更新
    });
  } catch (e) {
    // 不阻斷主流程
    console.warn("[supportRoute][dualWrite] create chat session failed:", e?.message || e);
  }
}

/**
 * 嘗試同步寫入 support_chat_messages（不影響既有流程）
 */
async function dualInsertChatMessage({ supabase, sessionId, senderRole, content, meta }) {
  if (!shouldDualWriteChat()) return;
  try {
    await supabase.from("support_chat_messages").insert({
      session_id: sessionId,
      sender_role: senderRole,
      content,
      meta: safeJson(meta),
    });

    // 同步更新 chat session 摘要欄位（存在時才有意義）
    await supabase
      .from("support_chat_sessions")
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  } catch (e) {
    console.warn("[supportRoute][dualWrite] insert chat message failed:", e?.message || e);
  }
}

/**
 * 嘗試同步更新 agent_last_read_at（不影響既有流程）
 */
async function dualMarkAgentRead({ supabase, sessionId }) {
  if (!shouldDualWriteChat()) return;
  try {
    await supabase
      .from("support_chat_sessions")
      .update({
        agent_last_read_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  } catch (e) {
    console.warn("[supportRoute][dualWrite] mark agent read failed:", e?.message || e);
  }
}

/**
 * POST /api/support/session
 * - 仍維持「每次開啟就建立 session」的行為（不改既有邏輯）
 * - 但新增：同 UUID 雙寫到 support_chat_sessions（可關閉）
 */
router.post("/support/session", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    const { anonId, uiLang, pagePath, meta } = req.body || {};
    const sessionId = crypto.randomUUID();

    // 1) legacy: support_sessions
    const { data, error } = await supabase
      .from("support_sessions")
      .insert({
        id: sessionId,
        anon_id: anonId || null,
        ui_lang: uiLang || null,
        page_path: pagePath || null,
        meta: safeJson(meta),
      })
      .select("id")
      .single();

    if (error) throw error;

    // 2) dual-write: support_chat_sessions（不影響主流程）
    await dualCreateChatSession({
      supabase,
      id: data.id,
      anonId: anonId || null,
      meta: {
        ...safeJson(meta),
        ui_lang: uiLang || null,
        page_path: pagePath || null,
        source: "support_sessions",
      },
    });

    res.json({ sessionId: data.id, unreadCount: 0 });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/support/messages
 * - 仍讀 legacy support_messages（因為前端依賴 is_read）
 */
router.get("/support/messages", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

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
 * - 新增：雙寫到 support_chat_messages + 更新 support_chat_sessions.last_message_at
 */
router.post("/support/messages", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    const { sessionId, content, meta } = req.body || {};
    const text = String(content || "").trim();

    if (!sessionId) {
      return res.status(400).json({ error: "missing sessionId" });
    }
    if (!text) {
      return res.status(400).json({ error: "missing content" });
    }

    // 1) 插入 user 訊息（legacy）
    const { data: userMsg, error: userErr } = await supabase
      .from("support_messages")
      .insert({
        session_id: sessionId,
        sender_role: "user",
        content: text,
        meta: safeJson(meta),
        // user 的訊息不需要 unread 追蹤，直接視為已讀
        is_read: true,
      })
      .select("id, created_at")
      .single();

    if (userErr) throw userErr;

    // 1b) dual-write: chat messages（不影響主流程）
    await dualInsertChatMessage({
      supabase,
      sessionId,
      senderRole: "user",
      content: text,
      meta: safeJson(meta),
    });

    // 2) 自動插入 bot/support 回覆（legacy）
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

    // 2b) dual-write: chat messages（不影響主流程）
    await dualInsertChatMessage({
      supabase,
      sessionId,
      senderRole: "support",
      content: replyText,
      meta: { auto: true, reason: "auto-reply" },
    });

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
 * - 仍用 legacy unread：只算「非 user」訊息的未讀（support/bot）
 */
router.get("/support/unread_count", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

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
 * - legacy：只把「非 user」訊息標記為已讀（support/bot）
 * - 新增：同步寫入 chat session agent_last_read_at（不影響主流程）
 */
router.post("/support/read", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: "missing sessionId" });

    const { error } = await supabase
      .from("support_messages")
      .update({ is_read: true })
      .eq("session_id", sessionId)
      .neq("sender_role", "user")
      .eq("is_read", false);

    if (error) throw error;

    // dual-write: agent last read
    await dualMarkAgentRead({ supabase, sessionId });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

// END PATH: backend/src/routes/supportRoute.js
