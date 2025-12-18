// backend/src/routes/libraryRoute.js
/**
 * 文件說明：
 * Library Route（收藏 / 單字庫）
 *
 * 異動日期：
 * - 2025-12-17
 * - 2025-12-18
 *
 * 異動說明：
 * 1) 保留：GET /api/library（分頁，DB 唯一真相）
 * 2) 保留：POST /api/library（upsert 新增收藏）
 * 3) 保留：DELETE /api/library（取消收藏）
 * 4) 保留：/__init 初始化狀態（Production 問題排查）
 * 5) 新增（2025-12-17）：
 *    - 修正 decodeCursor 在「無 cursor」時誤判為 truthy，
 *      導致第一頁資料被錯誤篩除的問題（僅新增防禦層，不改既有邏輯）
 * 6) 新增（2025-12-18）：
 *    - 拒收資料異常 canonicalPos = "unknown"（不分大小寫），避免污染 DB
 * 7) 新增（2025-12-18）【本次】：
 *    - 支援多義字收藏：user_words 新增/使用 sense_index（0-based），並更新 onConflict/刪除條件
 *    - 支援收藏快照：寫入 headword_gloss / headword_gloss_lang
 *    - 收藏時順便 upsert 字典屬性（global）：
 *      - dict_entries（unique headword+canonical_pos）→ 取得 entry_id
 *      - dict_entry_props（entry_id PK）→ upsert noun/verb/prep 屬性
 *    - GET /api/library 回傳 items 時補上 sense_index / headword_gloss / headword_gloss_lang
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

    // ✅ 新增：字典層 upsert（Production 排查用）
    upsertDictEntry: { enabled: true, lastError: null, lastHitAt: null },
    upsertDictProps: { enabled: true, lastError: null, lastHitAt: null },
  },

  // ✅ 新增：資料驗證/拒收紀錄（Production 排查用）
  validation: {
    lastRejectAt: null,
    lastRejectReason: null,
    lastRejectPayload: null,
  },

  // ✅ 新增：最近一次寫入字典層的紀錄（Production 排查用）
  dictWrite: {
    lastUpsertAt: null,
    lastEntryId: null,
    lastHeadword: null,
    lastCanonicalPos: null,
    lastPropsPayload: null,
    lastError: null,
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

/** 功能：標記資料拒收（Production 排查用） */
function markValidationReject(reason, payload) {
  INIT_STATUS.validation.lastRejectAt = new Date().toISOString();
  INIT_STATUS.validation.lastRejectReason = String(reason || "unknown");
  INIT_STATUS.validation.lastRejectPayload = payload || null;
}

/** 功能：標記字典層寫入狀態（Production 排查用） */
function markDictWrite({ headword, canonicalPos, entryId, propsPayload, err }) {
  INIT_STATUS.dictWrite.lastUpsertAt = new Date().toISOString();
  INIT_STATUS.dictWrite.lastHeadword = headword || null;
  INIT_STATUS.dictWrite.lastCanonicalPos = canonicalPos || null;
  INIT_STATUS.dictWrite.lastEntryId = entryId || null;
  INIT_STATUS.dictWrite.lastPropsPayload = propsPayload || null;
  INIT_STATUS.dictWrite.lastError = err ? String(err?.message || err) : null;
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

/** ✅ 新增：安全解析 senseIndex（0-based，預設 0，避免 NaN 污染） */
function parseSenseIndex(v) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** ✅ 新增：安全裁切 gloss（避免超長造成 DB/日誌壓力） */
function normalizeGloss(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  // 只做最小防禦：上限 200 字，避免污染/濫用
  return s.length > 200 ? s.slice(0, 200) : s;
}

/** ✅ 新增：安全整理 glossLang（例如 zh-TW / en / de / ar） */
function normalizeGlossLang(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  // 最小防禦：上限 20 字元（避免被塞入奇怪 payload）
  return s.length > 20 ? s.slice(0, 20) : s;
}

/** 功能：驗證收藏 payload（POST / DELETE 共用） */
function validateWordPayload(body) {
  const headword = String(body?.headword ?? "").trim();
  const canonicalPos = String(body?.canonicalPos ?? "").trim();

  if (!headword) return { ok: false, error: "headword is required" };
  if (!canonicalPos) return { ok: false, error: "canonicalPos is required" };

  // ✅ 新增：拒收資料異常 canonicalPos = "unknown"（不分大小寫）
  // - 避免寫入 DB 後造成單字庫污染（如 canonical_pos: unknown）
  // - 這裡只做最小防禦，不改其他既有行為
  if (String(canonicalPos).toLowerCase() === "unknown") {
    markValidationReject("canonicalPos is invalid: unknown", {
      headword,
      canonicalPos,
    });
    return { ok: false, error: "canonicalPos is invalid" };
  }

  // ✅ 新增：支援多義字 + gloss（向後相容：沒帶就用預設）
  const senseIndex = parseSenseIndex(body?.senseIndex);
  const headwordGloss = normalizeGloss(body?.headwordGloss);
  const headwordGlossLang = normalizeGlossLang(body?.headwordGlossLang);

  // ✅ 新增：字典層 props（可選；沒帶就不寫，避免強耦合）
  // - 只做最小整理，不做嚴格語言學驗證（由後續資料治理/校正處理）
  const entryProps = body?.entryProps && typeof body.entryProps === "object" ? body.entryProps : null;

  return {
    ok: true,
    headword,
    canonicalPos,
    senseIndex,
    headwordGloss,
    headwordGlossLang,
    entryProps,
  };
}

/* =========================
 * DB 操作封裝
 * ========================= */

/** 功能：建立分頁查詢（既有邏輯，未修改；僅補 select 欄位） */
function buildPagedQuery({ supabaseAdmin, userId, limit, cursor }) {
  let q = supabaseAdmin
    .from("user_words")
    // ✅ 新增：sense_index / gloss 欄位回傳（不影響既有欄位）
    .select("id, headword, canonical_pos, sense_index, headword_gloss, headword_gloss_lang, created_at")
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

      // ✅ 新增：多義字 & 收藏快照（向後相容：未寫入時可能為 null/undefined）
      sense_index: typeof r.sense_index === "number" ? r.sense_index : 0,
      headword_gloss: r.headword_gloss || null,
      headword_gloss_lang: r.headword_gloss_lang || null,
    })),
    nextCursor,
    limit,
  };
}

/**
 * ✅ 新增：upsert dict_entries 並取得 entry_id
 * - dict_entries: unique(headword, canonical_pos)
 * - 使用 supabaseAdmin（service role）寫入，作為 global 字典資產層
 */
async function upsertDictEntryAndGetId({ supabaseAdmin, headword, canonicalPos }) {
  const EP = "upsertDictEntry";
  try {
    markEndpointHit(EP);

    // 1) upsert
    const { error: upsertError } = await supabaseAdmin
      .from("dict_entries")
      .upsert(
        { headword, canonical_pos: canonicalPos },
        { onConflict: "headword,canonical_pos" }
      );

    if (upsertError) throw upsertError;

    // 2) select id（拿唯一真相）
    const { data, error: selectError } = await supabaseAdmin
      .from("dict_entries")
      .select("id")
      .eq("headword", headword)
      .eq("canonical_pos", canonicalPos)
      .limit(1)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!data?.id) throw new Error("dict_entries upsert ok but id not found");

    return data.id;
  } catch (err) {
    markEndpointError(EP, err);
    throw err;
  }
}

/**
 * ✅ 新增：upsert dict_entry_props（global）
 * - entry_id PK
 * - props 可選：若 entryProps 為 null → 不寫
 */
async function upsertDictEntryProps({ supabaseAdmin, entryId, entryProps }) {
  const EP = "upsertDictProps";
  try {
    markEndpointHit(EP);

    if (!entryProps) return { skipped: true };

    // 最小 mapping（避免前端送任何欄位都直接灌 DB）
    // - 只寫我們現在已定義的欄位，其餘放 extra_props
    const payload = {
      entry_id: entryId,

      noun_gender: typeof entryProps.noun_gender === "string" ? entryProps.noun_gender : null,
      noun_plural: typeof entryProps.noun_plural === "string" ? entryProps.noun_plural : null,

      verb_separable: typeof entryProps.verb_separable === "boolean" ? entryProps.verb_separable : null,
      verb_irregular: typeof entryProps.verb_irregular === "boolean" ? entryProps.verb_irregular : null,
      verb_reflexive: typeof entryProps.verb_reflexive === "boolean" ? entryProps.verb_reflexive : null,

      prep_case: typeof entryProps.prep_case === "string" ? entryProps.prep_case : null,

      // 其餘未知欄位丟 extra_props（保留彈性）
      extra_props: entryProps.extra_props && typeof entryProps.extra_props === "object" ? entryProps.extra_props : null,

      // updated_at 由 DB default now()；若你想每次 upsert 都更新，可改成 now()（此處不強制）
    };

    const { error } = await supabaseAdmin.from("dict_entry_props").upsert(payload, {
      onConflict: "entry_id",
    });

    if (error) throw error;

    return { ok: true };
  } catch (err) {
    markEndpointError(EP, err);
    throw err;
  }
}

/** 功能：新增收藏（upsert） */
async function upsertUserWord({
  supabaseAdmin,
  userId,
  headword,
  canonicalPos,
  senseIndex,
  headwordGloss,
  headwordGlossLang,
}) {
  const { error } = await supabaseAdmin
    .from("user_words")
    .upsert(
      {
        user_id: userId,
        headword,
        canonical_pos: canonicalPos,

        // ✅ 新增：多義 + 快照欄位
        sense_index: typeof senseIndex === "number" ? senseIndex : 0,
        headword_gloss: headwordGloss || null,
        headword_gloss_lang: headwordGlossLang || null,
      },
      // ✅ 新增：onConflict 改為包含 sense_index（對齊新 UNIQUE）
      { onConflict: "user_id,headword,canonical_pos,sense_index" }
    );

  if (error) throw error;
}

/** 功能：刪除單一收藏 */
async function deleteUserWord({ supabaseAdmin, userId, headword, canonicalPos, senseIndex }) {
  const { error } = await supabaseAdmin
    .from("user_words")
    .delete()
    .eq("user_id", userId)
    .eq("headword", headword)
    .eq("canonical_pos", canonicalPos)
    // ✅ 新增：刪除要精準到義項（向後相容：未帶 senseIndex → 0）
    .eq("sense_index", typeof senseIndex === "number" ? senseIndex : 0);

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

    // ✅ 新增：收藏時順便 upsert dict_entries / dict_entry_props
    // - 若 entryProps 不存在：只 upsert dict_entries（保留最小 global 骨架），不寫 props
    // - 若 dict_* 表尚未建立會報錯；此處不吞錯，避免 silently failed
    let entryId = null;
    try {
      entryId = await upsertDictEntryAndGetId({
        supabaseAdmin,
        headword: v.headword,
        canonicalPos: v.canonicalPos,
      });

      await upsertDictEntryProps({
        supabaseAdmin,
        entryId,
        entryProps: v.entryProps,
      });

      markDictWrite({
        headword: v.headword,
        canonicalPos: v.canonicalPos,
        entryId,
        propsPayload: v.entryProps || null,
        err: null,
      });
    } catch (e) {
      // 不改既有收藏流程的核心行為：字典層寫入失敗 → 直接回 500（避免資料半套）
      markDictWrite({
        headword: v.headword,
        canonicalPos: v.canonicalPos,
        entryId: entryId || null,
        propsPayload: v.entryProps || null,
        err: e,
      });
      throw e;
    }

    await upsertUserWord({
      supabaseAdmin,
      userId,
      headword: v.headword,
      canonicalPos: v.canonicalPos,
      senseIndex: v.senseIndex,
      headwordGloss: v.headwordGloss,
      headwordGlossLang: v.headwordGlossLang,
    });

    res.json({ ok: true, entry_id: entryId });
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

    await deleteUserWord({
      supabaseAdmin,
      userId,
      headword: v.headword,
      canonicalPos: v.canonicalPos,
      senseIndex: v.senseIndex,
    });

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
