// PATH: backend/src/routes/supportRoute.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { getSupabaseAdmin } = require("../db/supabaseAdmin");
const authMiddleware = require("../middleware/authMiddleware");

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
 * 1) 🔒 強制登入：未登入不可建立/讀取/送出客服訊息（API 401）
 * 2) ✅ 雙向未讀（以接收者為主體）：
 *    - user send → admin 未讀（is_read_by_admin=false）
 *    - admin send → user 未讀（is_read_by_user=false）
 * 3) 保留既有行為：response shape 不改（仍回傳 legacy is_read）
 * 4) 保留雙寫到 support_chat_*（可用 env 關閉）
 *
 * 雙寫開關：
 * - env SUPPORT_DUAL_WRITE_CHAT=0 可關閉（預設開啟）
 */

// ------------------------------------------------------------
// 🔒 強制登入（所有 /support/* 都需要 Bearer token）
// ------------------------------------------------------------
router.use(authMiddleware);

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
 * - 新增：同 UUID 雙寫到 support_chat_sessions（可關閉）
 */
router.post("/support/session", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    // ✅ 30 天內同一個 user 共用同一個 session（以 user 歸戶）
    const userId = String(req?.authUser?.id || "");
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    const { anonId, uiLang, pagePath, meta } = req.body || {};

    const DAYS = 30;
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

    // 0) 先找 30 天內是否已有 session
    const { data: existed, error: existedErr } = await supabase
      .from("support_sessions")
      .select("id, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existedErr) throw existedErr;
    if (existed?.id) {
      return res.json({ sessionId: existed.id, unreadCount: 0 });
    }

    const sessionId = crypto.randomUUID();

    // 1) legacy: support_sessions
    const { data, error } = await supabase
      .from("support_sessions")
      .insert({
        id: sessionId,
        user_id: userId,
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

    if (!sessionId) return res.status(400).json({ error: "missing sessionId" });

    // ✅ 只回 30 天內
    const DAYS = 30;
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("support_messages")
      .select("id, session_id, sender_role, content, meta, is_read, created_at")
      .eq("session_id", sessionId)
      .gte("created_at", since)
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
 * - 新增：雙向未讀欄位（is_read_by_admin / is_read_by_user）
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

    // 1) 插入 user 訊息（legacy + 雙向未讀）
    const { data: userMsg, error: userErr } = await supabase
      .from("support_messages")
      .insert({
        session_id: sessionId,
        sender_role: "user",
        content: text,
        meta: safeJson(meta),

        // legacy：user 自己的訊息直接視為已讀（避免前端把自己訊息當未讀）
        is_read: true,

        // ✅ 雙向未讀：user 自己已讀；admin 未讀
        is_read_by_user: true,
        is_read_by_admin: false,
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

    // 2) ✅ Task A：停用 Auto-reply
    // - user send 後：只新增 1 筆 user message（寫入 DB）
    // - 不再自動新增 sender_role=support 且 meta.auto=true 的罐頭訊息
    // 回傳 user message id（前端 optimistic 用）
    res.json({
      messageId: userMsg.id,
      createdAt: userMsg.created_at,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/support/unread_count
 * - legacy：前端仍依賴 unreadCount（support/bot 未讀）
 * - ✅ 改為雙向未讀：只算「非 user」訊息的 user 未讀（is_read_by_user=false）
 */
router.get("/support/unread_count", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    const { sessionId } = req.query;

    if (!sessionId) return res.status(400).json({ error: "missing sessionId" });

    const DAYS = 30;
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from("support_messages")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .gte("created_at", since)
      .neq("sender_role", "user")
      .eq("is_read_by_user", false);

    if (error) throw error;
    res.json({ unreadCount: count || 0 });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/support/read
 * - legacy：只把「非 user」訊息標記為已讀（support/bot）
 * - ✅ 改為雙向未讀：更新 is_read_by_user=true
 * - 新增：同步寫入 chat session agent_last_read_at（不影響主流程）
 */
router.post("/support/read", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: "missing sessionId" });

    const DAYS = 30;
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

    // legacy + dual
    const { error } = await supabase
      .from("support_messages")
      .update({
        is_read: true,
        is_read_by_user: true,
      })
      .eq("session_id", sessionId)
      .gte("created_at", since)
      .neq("sender_role", "user");

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
