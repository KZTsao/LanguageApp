// backend/src/routes/libraryRoute.js
/**
 * 文件說明：
 * Library Route（收藏 / 單字庫）
 *
 * 異動日期：
 * - 2025-12-17
 *
 * 異動說明：
 * 1) 保留：GET /api/library（分頁，DB 唯一真相）
 * 2) 保留：POST /api/library（upsert 新增收藏）
 * 3) 保留：DELETE /api/library（取消收藏）
 * 4) 保留：/__init 初始化狀態（Production 問題排查）
 * 5) 新增（2025-12-17）：
 *    - 修正 decodeCursor 在「無 cursor」時誤判為 truthy，
 *      導致第一頁資料被錯誤篩除的問題（僅新增防禦層，不改既有邏輯）
 *
 * 設計原則：
 * - DB 為唯一真相（source of truth）
 * - guest 不允許收藏（無 token 一律 401）
 * - API 行為明確（GET / POST / DELETE 分離）
 * - 不使用 localStorage
 */

const express = require("express");
const { getSupabaseAdmin, getSupabaseAdminInitStatus } = require("../db/supabaseAdmin");

const router = express.Router();

/* =========================================================
 * 初始化狀態（Production 排查用）
 * ========================================================= */
const INIT_STATUS = {
  module: "libraryRoute",
  createdAt: new Date().toISOString(),
  ready: false,
  lastError: null,
  endpoints: {
    getPaged: { enabled: true, lastError: null, lastHitAt: null },
    postUpsert: { enabled: true, lastError: null, lastHitAt: null },
    deleteOne: { enabled: true, lastError: null, lastHitAt: null },
    initStatus: { enabled: true, lastError: null, lastHitAt: null },
  },
};

/* =========================
 * 共用工具函式
 * ========================= */

/** 功能：標記 endpoint hit（Production 排查用） */
function markEndpointHit(key) {
  if (!INIT_STATUS.endpoints[key]) return;
  INIT_STATUS.endpoints[key].lastHitAt = new Date().toISOString();
  INIT_STATUS.endpoints[key].lastError = null;
}

/** 功能：標記 endpoint error（Production 排查用） */
function markEndpointError(key, err) {
  if (!INIT_STATUS.endpoints[key]) return;
  INIT_STATUS.endpoints[key].lastHitAt = new Date().toISOString();
  INIT_STATUS.endpoints[key].lastError = String(err?.message || err);
}

/** 功能：解析 limit（避免過大造成 DB 壓力） */
function parseLimit(v) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(n, 200);
}

/** 功能：解析 cursor（base64 json） */
function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(String(cursor), "base64").toString("utf8");
    const obj = JSON.parse(json);
    if (!obj || typeof obj.createdAt !== "string" || typeof obj.id !== "number") return null;
    return { createdAt: obj.createdAt, id: obj.id };
  } catch {
    return null;
  }
}

/** 功能：產生 nextCursor */
function encodeCursor(createdAt, id) {
  return Buffer.from(JSON.stringify({ createdAt, id }), "utf8").toString("base64");
}

/**
 * 【新增】功能：嚴格判斷 cursor 是否為「有效分頁游標」
 * - 避免 {} / { createdAt: undefined } 被誤判為 truthy
 * - 僅作防禦，不改既有 decodeCursor 與 buildPagedQuery
 */
function isValidCursor(cursor) {
  if (!cursor) return false;
  if (typeof cursor.createdAt !== "string") return false;
  if (typeof cursor.id !== "number") return false;
  return true;
}

/**
 * 功能：從 Authorization Bearer token 取得 userId
 * - guest 不允許
 */
async function requireUserId(req, supabaseAdmin) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(m[1]);
  if (error || !data?.user?.id) return null;

  return data.user.id;
}

/** 功能：驗證收藏 payload（POST / DELETE 共用） */
function validateWordPayload(body) {
  const headword = String(body?.headword ?? "").trim();
  const canonicalPos = String(body?.canonicalPos ?? "").trim();

  if (!headword) return { ok: false, error: "headword is required" };
  if (!canonicalPos) return { ok: false, error: "canonicalPos is required" };

  return { ok: true, headword, canonicalPos };
}

/* =========================
 * DB 操作封裝
 * ========================= */

/** 功能：建立分頁查詢（既有邏輯，未修改） */
function buildPagedQuery({ supabaseAdmin, userId, limit, cursor }) {
  let q = supabaseAdmin
    .from("user_words")
    .select("id, headword, canonical_pos, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  // === 既有邏輯（保留）===
  if (cursor) {
    q = q.or(
      [
        `created_at.lt.${cursor.createdAt}`,
        `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      ].join(",")
    );
  }

  return q;
}

/** 功能：轉換分頁 response */
function toResponsePayload({ rows, limit }) {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor =
    hasMore && slice.length
      ? encodeCursor(slice[slice.length - 1].created_at, slice[slice.length - 1].id)
      : null;

  return {
    items: slice.map((r) => ({
      headword: r.headword,
      canonical_pos: r.canonical_pos,
      created_at: r.created_at,
    })),
    nextCursor,
    limit,
  };
}

/** 功能：新增收藏（upsert） */
async function upsertUserWord({ supabaseAdmin, userId, headword, canonicalPos }) {
  const { error } = await supabaseAdmin
    .from("user_words")
    .upsert(
      { user_id: userId, headword, canonical_pos: canonicalPos },
      { onConflict: "user_id,headword,canonical_pos" }
    );

  if (error) throw error;
}

/** 功能：刪除單一收藏 */
async function deleteUserWord({ supabaseAdmin, userId, headword, canonicalPos }) {
  const { error } = await supabaseAdmin
    .from("user_words")
    .delete()
    .eq("user_id", userId)
    .eq("headword", headword)
    .eq("canonical_pos", canonicalPos);

  if (error) throw error;
}

/* =========================
 * Routes
 * ========================= */

/** GET /api/library（分頁） */
router.get("/", async (req, res, next) => {
  const EP = "getPaged";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const limit = parseLimit(req.query.limit);

    // === 原始 decode（保留）===
    const rawCursor = decodeCursor(req.query.cursor);

    // === 新增防禦層：僅在 cursor 完整時才視為有效 ===
    const cursor = isValidCursor(rawCursor) ? rawCursor : null;

    const { data, error } = await buildPagedQuery({
      supabaseAdmin,
      userId,
      limit,
      cursor,
    });

    if (error) throw error;

    return res.json(toResponsePayload({ rows: data || [], limit }));
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/** POST /api/library（新增收藏） */
router.post("/", async (req, res, next) => {
  const EP = "postUpsert";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const v = validateWordPayload(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });

    await upsertUserWord({ supabaseAdmin, userId, ...v });
    res.json({ ok: true });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/** DELETE /api/library（取消收藏） */
router.delete("/", async (req, res, next) => {
  const EP = "deleteOne";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const v = validateWordPayload(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });

    await deleteUserWord({ supabaseAdmin, userId, ...v });
    res.json({ ok: true });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/** GET /api/library/__init（初始化狀態） */
router.get("/__init", (req, res) => {
  const EP = "initStatus";
  markEndpointHit(EP);

  try {
    getSupabaseAdmin();
    INIT_STATUS.ready = true;
    INIT_STATUS.lastError = null;
  } catch (e) {
    INIT_STATUS.ready = false;
    INIT_STATUS.lastError = String(e?.message || e);
  }

  res.json({
    route: { ...INIT_STATUS },
    supabaseAdmin: getSupabaseAdminInitStatus(),
  });
});

/* 模組載入時初始化狀態 */
(() => {
  try {
    getSupabaseAdmin();
    INIT_STATUS.ready = true;
  } catch (e) {
    INIT_STATUS.ready = false;
    INIT_STATUS.lastError = String(e?.message || e);
  }
})();

module.exports = router;

// backend/src/routes/libraryRoute.js
