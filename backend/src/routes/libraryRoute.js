// backend/src/routes/libraryRoute.js
/**
 * 文件說明：
 * Library Route（生字本 / 收藏）
 *
 * 職責：
 * - GET /api/library：讀取使用者收藏（分頁）
 * - POST /api/library：新增收藏（upsert）
 * - DELETE /api/library：取消收藏
 * - GET /api/library/__init：回報初始化狀態（Production 排查用）
 *
 * 異動日期：
 * - 2025-12-26
 * - 2025-12-30
 * - 2026-01-03
 *
 * 異動說明：
 * 1) 保留：GET /api/library（分頁，DB 唯一真相）
 * 2) 保留：POST /api/library（新增收藏）
 * 3) 保留：DELETE /api/library（取消收藏）
 * 4) 保留：requireUserId（guest 不允許收藏）
 * 5) 保留：cursor 分頁（created_at + id）
 * 6) 新增（2025-12-26）：
 *    - 支援多義字收藏：user_words 新增/使用 sense_index（0-based），並更新 onConflict/刪除條件
 *    - 支援收藏快照欄位：headword_gloss / headword_gloss_lang
 *    - 收藏時順便 upsert 字典屬性（global）：
 *      - dict_entries（unique headword+canonical_pos）→ 取得 entry_id
 *      - dict_entry_props（entry_id PK）→ upsert noun/verb/prep 屬性
 *    - GET /api/library 回傳 items 時補上 sense_index / headword_gloss / headword_gloss_lang
 * 8) 新增（2025-12-26）：
 *    - 收藏快照欄位：支援多種前端 key alias（避免只寫入 lang、gloss 變 null）
 * 9) 新增（2025-12-26）：
 *    - 可開關 console 觀測（LIBRARY_DEBUG_PAYLOAD=1），用於定位 headword_gloss 為 null 的來源
 * 10) 新增（2025-12-30）【本次】：
 *    - 取消收藏（DELETE /api/library）改為「同 headword + canonical_pos 全刪」
 *      → 不再只刪單一 sense_index，符合「收藏必須同時加入、同時刪除」的規格
 *      → 舊的 deleteUserWord（單刪）保留並標註 deprecated，避免影響既有結構/回溯
 *
 * 11) 新增（2025-12-30）【本次】：
 *    - （可選）GET /api/library 可切換為「以 dict_senses 為權威釋義」回傳（LIBRARY_USE_DICT_SENSES=1）
 *      → items 仍保留 headword_gloss/headword_gloss_lang 欄位，但會優先使用 dict_senses 的值覆蓋
 *      → 若 dict_senses 查不到（或資料不完整），才回退到 user_words 的收藏快照（headword_gloss）
 *    - （可選）支援義項顆粒度狀態欄位（familiarity / is_hidden / entry_id）寫入與回傳（向後相容）：
 *      → 2025-12-30 本階段：先不新增/不依賴 user_words.entry_id，只處理 familiarity / is_hidden（義項顆粒度）
 *      → 若 DB 尚未加欄位，會自動回退到舊行為，不會阻塞現有 API
 *
 * 13) 修正（2026-01-03）【本次】：
 *    - 修正義項狀態更新（familiarity / is_hidden）寫入 DB 的開關判斷
 *      → 原本誤用 LIBRARY_WRITE_STATUS_ON_FAVORITE 造成 status update 被跳過，DB 看不到變更
 *      → 現在改為只受 LIBRARY_WRITE_SENSE_STATUS 控制（語意正確）
 *
 * 12) 修正（2025-12-30）【本次】：
 *    - 你已建立 dict_senses，且 dict_entries.id / dict_senses.entry_id 為 UUID
 *      → 修正程式中把 entry_id 當 number 的地方，改為以 string(UUID) 處理
 *      → 否則 enrichLibraryItemsByDictSenses 會永遠查不到 sense（型別不相容）
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

    // ✅ 新增（2025-12-30）：取消收藏全刪（Production 排查用）
    deleteAllSenses: { enabled: true, lastError: null, lastHitAt: null },

    // ✅ 新增（2025-12-30）：enrich dict_senses（Production 排查用）
    enrichDictSenses: { enabled: true, lastError: null, lastHitAt: null },

    // ✅ 新增（2026-01-07）：Learning sets（下拉選單來源）
    getLearningSets: { enabled: true, lastError: null, lastHitAt: null },
  },

  // ✅ Supabase admin 初始化狀態
  supabaseAdmin: getSupabaseAdminInitStatus ? getSupabaseAdminInitStatus() : null,
};

/** 功能：記錄 endpoint hit（Production 排查用） */
function markEndpointHit(name) {
  try {
    if (INIT_STATUS.endpoints?.[name]) INIT_STATUS.endpoints[name].lastHitAt = new Date().toISOString();
  } catch (e) {}
}

/** 功能：記錄 endpoint error（Production 排查用） */
function markEndpointError(name, err) {
  try {
    const msg = String(err?.message || err);
    if (INIT_STATUS.endpoints?.[name]) INIT_STATUS.endpoints[name].lastError = msg;
    INIT_STATUS.lastError = msg;
  } catch (e) {}
}

/* =========================================================
 * Debug / 觀測開關
 * ========================================================= */

/** ✅ 可開關：觀察 payload（階段性驗證用） */
function shouldDebugPayload() {
  return String(process.env.LIBRARY_DEBUG_PAYLOAD || "").trim() === "1";
}

/** ✅ 可開關：觀察取消收藏全刪（階段性驗證用） */
function shouldDebugUnfavoriteAll() {
  return String(process.env.LIBRARY_DEBUG_UNFAVORITE_ALL || "").trim() === "1";
}

/** ✅ 新增（2025-12-30）：可開關的 dict_senses 權威釋義回傳（階段性驗證用） */
function shouldUseDictSenses() {
  return String(process.env.LIBRARY_USE_DICT_SENSES || "").trim() === "1";
}

/** ✅ 新增（2025-12-30）：可開關的 user_words 義項狀態欄位寫入（階段性驗證用） */
function shouldWriteSenseStatus() {
  return String(process.env.LIBRARY_WRITE_SENSE_STATUS || "").trim() === "1";
}

/**
 * ✅ 新增（2025-12-30）：收藏當下是否「順便寫入狀態欄位」
 * 說明：
 * - 你希望「收藏」只負責新增資料，不強迫帶 familiarity / is_hidden
 * - 避免收藏時用預設值覆蓋掉既有狀態
 * - 因此預設關閉；只有你明確打開環境變數才會啟用
 */
function shouldWriteStatusOnFavorite() {
  return String(process.env.LIBRARY_WRITE_STATUS_ON_FAVORITE || "").trim() === "1";
}

/** ✅ 新增（2025-12-30）：可開關的 user_words 義項狀態欄位 select（階段性驗證用） */
function shouldSelectSenseStatus() {
  return String(process.env.LIBRARY_SELECT_SENSE_STATUS || "").trim() === "1";
}

/** ✅ 新增（2025-12-30）：可開關的隱藏義項過濾（階段性驗證用） */
function shouldFilterHiddenSenses() {
  return String(process.env.LIBRARY_FILTER_HIDDEN || "").trim() === "1";
}

/** ✅ 新增（2026-01-03）：僅針對「單字庫列表（GET /api/library）」的隱藏義項過濾開關
 * 說明：
 * - 你目前的規則是：is_hidden=true 代表「不再出現在測試/複習」，但仍應在單字庫可見
 * - 因此：單字庫列表預設【不過濾】 is_hidden
 * - 若未來你真的想在單字庫也隱藏，請改用 LIBRARY_FILTER_HIDDEN_IN_LIBRARY=1 明確打開
 * - 舊的 LIBRARY_FILTER_HIDDEN 仍保留（deprecated），避免影響其他流程/回溯
 */
function shouldFilterHiddenSensesInLibrary() {
  return String(process.env.LIBRARY_FILTER_HIDDEN_IN_LIBRARY || "").trim() === "1";
}

/** 功能：安全輸出（避免 log 爆長） */
function safePreview(v) {
  const s = String(v ?? "");
  if (s.length <= 120) return s;
  return s.slice(0, 120) + "...";
}

/* =========================================================
 * Auth
 * ========================================================= */

/** 功能：取得 user id（無 token 一律視為 guest，不允許收藏） */
async function requireUserId(req, supabaseAdmin) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data?.user?.id || null;
}

/* =========================================================
 * Cursor 分頁
 * ========================================================= */

function encodeCursor(createdAt, id) {
  return Buffer.from(JSON.stringify({ createdAt, id }), "utf-8").toString("base64");
}

function decodeCursor(cursor) {
  try {
    if (!cursor) return null;
    const raw = Buffer.from(String(cursor), "base64").toString("utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function isValidCursor(c) {
  return !!(
    c &&
    typeof c === "object" &&
    typeof c.createdAt === "string" &&
    (typeof c.id === "number" || typeof c.id === "string")
  );
}

function parseLimit(v) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return 20;
  if (n < 1) return 1;
  if (n > 100) return 100;
  return n;
}

/* =========================================================
 * Payload validation / normalize
 * ========================================================= */

/** 功能：解析 senseIndex（0-based） */
function parseSenseIndex(v) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 999) return 999;
  return n;
}

/** ✅ 新增（2025-12-30）：安全解析 familiarity（預設 0，避免 NaN 污染） */
function parseFamiliarity(v) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return 0;
  // 最小防禦：允許 -1/0/1/9（你後續可再擴充），其他值仍回傳原值但限制在 -10~10
  if (n === -1 || n === 0 || n === 1 || n === 9) return n;
  if (n < -10) return -10;
  if (n > 10) return 10;
  return n;
}

/** ✅ 新增（2025-12-30）：安全解析 is_hidden（預設 false） */
function parseIsHidden(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return false;
}

/**
 * ✅ 新增（2025-12-30）：nullable 版本（避免「未提供值」被默認成 0/false）
 * 功能：
 * - 收藏（star）當下通常不帶 familiarity / isHidden
 * - 若直接用 parseFamiliarity/parseIsHidden 的預設值，會把既有狀態覆蓋掉
 * - 因此提供 nullable 版本：未提供 → 回傳 null，讓呼叫端決定是否要寫入 DB
 */
function parseFamiliarityNullable(v) {
  if (v == null) return null;
  return parseFamiliarity(v);
}

function parseIsHiddenNullable(v) {
  if (v == null) return null;
  return parseIsHidden(v);
}

/** ✅ 新增：安全裁切 gloss（避免超長） */
function normalizeGloss(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > 400 ? s.slice(0, 400) : s;
}

/** ✅ 新增：安全裁切 gloss lang */
function normalizeGlossLang(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > 32 ? s.slice(0, 32) : s;
}

/** 功能：記錄驗證拒絕（避免 silent fail） */
function markValidationReject(reason, payload) {
  try {
    if (shouldDebugPayload()) {
      console.log("[libraryRoute][reject]", reason, JSON.stringify(payload || {}));
    }
  } catch (e) {}
}

/** 功能：印出 payload 摘要（只印 keys + 常見欄位） */
function debugPayloadSummary(body) {
  try {
    const b = body || {};
    const keys = Object.keys(b);

    const summary = {
      keys,
      headword: safePreview(b.headword),
      canonicalPos: safePreview(b.canonicalPos),
      senseIndex: b.senseIndex,

      headwordGloss: safePreview(b.headwordGloss),
      headword_gloss: safePreview(b.headword_gloss),
      gloss: safePreview(b.gloss),
      meaning: safePreview(b.meaning),
      definition: safePreview(b.definition),

      headwordGlossLang: safePreview(b.headwordGlossLang),
      headword_gloss_lang: safePreview(b.headword_gloss_lang),
      glossLang: safePreview(b.glossLang),
      gloss_lang: safePreview(b.gloss_lang),

      hasSensesArray: Array.isArray(b.senses),
      senses0_keys:
        Array.isArray(b.senses) && b.senses[0] && typeof b.senses[0] === "object"
          ? Object.keys(b.senses[0])
          : null,
      senses0_gloss: Array.isArray(b.senses)
        ? safePreview(
            b.senses?.[0]?.headwordGloss ??
              b.senses?.[0]?.headword_gloss ??
              b.senses?.[0]?.gloss ??
              b.senses?.[0]?.meaning ??
              b.senses?.[0]?.definition
          )
        : "",
    };

    console.log("[libraryRoute][payload]", JSON.stringify(summary));
  } catch (e) {
    console.log("[libraryRoute][payload] debug failed:", String(e?.message || e));
  }
}

/**
 * ✅ 新增（2025-12-30）：義項狀態欄位 alias 讀取
 * 功能：
 * - 同時支援 familiarity / isHidden / is_hidden
 * - 若 body.senses 存在，允許從 senses[senseIndex] 取值（只讀，不推測）
 */
function pickFamiliarityFromPayload(body, senseIndex) {
  const b = body || {};
  const direct = b.familiarity ?? null;
  if (direct != null) return direct;

  if (Array.isArray(b.senses)) {
    const idx = typeof senseIndex === "number" ? senseIndex : 0;
    const s = b.senses[idx] || null;
    if (s && typeof s === "object") {
      return s.familiarity ?? null;
    }
  }
  return null;
}

function pickIsHiddenFromPayload(body, senseIndex) {
  const b = body || {};
  const direct = b.isHidden ?? b.is_hidden ?? null;
  if (direct != null) return direct;

  if (Array.isArray(b.senses)) {
    const idx = typeof senseIndex === "number" ? senseIndex : 0;
    const s = b.senses[idx] || null;
    if (s && typeof s === "object") {
      return s.isHidden ?? s.is_hidden ?? null;
    }
  }
  return null;
}

/**
 * ✅ 新增：收藏快照欄位 alias 讀取
 * 功能：
 * - 同時支援 headwordGloss / headword_gloss / gloss / meaning / definition
 * - 同時支援 headwordGlossLang / headword_gloss_lang / glossLang / gloss_lang
 * - 若 body.senses 存在，允許從 senses[senseIndex] 取 gloss（只讀，不推測）
 */
function pickGlossFromPayload(body, senseIndex) {
  const b = body || {};

  const direct = b.headwordGloss ?? b.headword_gloss ?? b.gloss ?? b.meaning ?? b.definition ?? null;

  if (direct != null) return direct;

  if (Array.isArray(b.senses)) {
    const idx = typeof senseIndex === "number" ? senseIndex : 0;
    const s = b.senses[idx] || null;
    if (s && typeof s === "object") {
      return s.headwordGloss ?? s.headword_gloss ?? s.gloss ?? s.meaning ?? s.definition ?? null;
    }
  }

  return null;
}

function pickGlossLangFromPayload(body) {
  const b = body || {};
  return (
    b.headwordGlossLang ??
    b.headword_gloss_lang ??
    b.glossLang ??
    b.gloss_lang ??
    b.meaningLang ??
    b.definitionLang ??
    null
  );
}

/** 功能：驗證收藏 payload（POST / DELETE 共用） */
function validateWordPayload(body) {
  const headword = String(body?.headword ?? "").trim();
  const canonicalPos = String(body?.canonicalPos ?? "").trim();

  if (!headword) return { ok: false, error: "headword is required" };
  if (!canonicalPos) return { ok: false, error: "canonicalPos is required" };

  // ✅ 新增：拒收資料異常 canonicalPos = "unknown"（不分大小寫）
  if (String(canonicalPos).toLowerCase() === "unknown") {
    markValidationReject("canonicalPos is invalid: unknown", {
      headword,
      canonicalPos,
    });
    return { ok: false, error: "canonicalPos is invalid" };
  }

  // ✅ 支援多義字 + gloss（向後相容：沒帶就用預設）
  const senseIndex = parseSenseIndex(body?.senseIndex);

  // ✅ 本次：改成 alias 讀取（避免只寫入 lang、gloss 變 null）
  const rawGloss = pickGlossFromPayload(body, senseIndex);
  const rawGlossLang = pickGlossLangFromPayload(body);

  const headwordGloss = normalizeGloss(rawGloss);
  const headwordGlossLang = normalizeGlossLang(rawGlossLang ?? body?.headwordGlossLang);

  // ✅ 新增（2025-12-30）：義項顆粒度狀態（可選）
  // 注意：收藏（star）當下不一定會帶 familiarity / isHidden
  // - 若未提供，不應寫入預設值覆蓋掉 DB 既有狀態
  const rawFamiliarity = pickFamiliarityFromPayload(body, senseIndex);
  const rawIsHidden = pickIsHiddenFromPayload(body, senseIndex);

  // ✅ 是否為「義項狀態更新」請求（只更新 familiarity / is_hidden，不碰 gloss 快照）
  const hasSenseStatusUpdate = rawFamiliarity != null || rawIsHidden != null;

  // ✅ nullable：未提供 → null（讓呼叫端決定是否要寫入 DB）
  const familiarity = parseFamiliarityNullable(rawFamiliarity);
  const isHidden = parseIsHiddenNullable(rawIsHidden);

  // ✅ 新增：validate 結果觀測（階段性驗證用）
  if (shouldDebugPayload()) {
    console.log(
      "[libraryRoute][validate]",
      JSON.stringify({
        senseIndex,
        rawGloss: safePreview(rawGloss),
        headwordGlossLen: headwordGloss ? headwordGloss.length : 0,
        headwordGlossLang: headwordGlossLang || "",
      })
    );
  }

  // ✅ 字典層 props（可選）
  const entryProps = body?.entryProps && typeof body.entryProps === "object" ? body.entryProps : null;

  return {
    ok: true,
    headword,
    canonicalPos,
    senseIndex,
    headwordGloss,
    headwordGlossLang,
    entryProps,
    hasSenseStatusUpdate,
    familiarity,
    isHidden,
  };
}

/* =========================
 * DB 操作封裝
 * ========================= */

/** 功能：建立分頁查詢（既有邏輯，未修改；僅補 select 欄位） */
function buildPagedQuery({ supabaseAdmin, userId, limit, cursor }) {
  let q = supabaseAdmin
    .from("user_words")
    .select("id, headword, canonical_pos, sense_index, headword_gloss, headword_gloss_lang, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    q = q.or(
      [`created_at.lt.${cursor.createdAt}`, `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`].join(",")
    );
  }

  return q;
}

/**
 * ✅ 新增（2025-12-30）：建立分頁查詢（可選擴充欄位）
 * 功能：
 * - 允許選擇性讀取 familiarity / is_hidden
 * - 本階段：不依賴 entry_id（避免 DB 未加欄位時不必要 fallback）
 * - 若 DB 尚未 migration，會回退到舊 select，避免阻塞
 */
function buildPagedQueryV2({ supabaseAdmin, userId, limit, cursor, includeStatusCols }) {
  const baseSelect = "id, headword, canonical_pos, sense_index, headword_gloss, headword_gloss_lang, created_at";
  const statusSelect = includeStatusCols ? baseSelect + ", familiarity, is_hidden" : baseSelect; // 2025-12-30：本階段先不依賴 entry_id

  let q = supabaseAdmin
    .from("user_words")
    .select(statusSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    q = q.or(
      [`created_at.lt.${cursor.createdAt}`, `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`].join(",")
    );
  }

  return q;
}

/** 功能：轉換分頁 response */
function toResponsePayload({ rows, limit }) {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor =
    hasMore && slice.length ? encodeCursor(slice[slice.length - 1].created_at, slice[slice.length - 1].id) : null;

  // ✅ 新增（2025-12-30）：可選過濾隱藏義項（不影響 DB，僅回傳層）
  // ✅ 調整（2026-01-03）：單字庫列表預設不過濾 is_hidden（DB 唯一真相，單字庫仍可見）
  // - is_hidden=true 的用途：優先拿去控制「測試/複習」是否出題
  // - 若未來你想在單字庫也隱藏，請打開 LIBRARY_FILTER_HIDDEN_IN_LIBRARY=1
  // DEPRECATED(2026-01-03): 舊開關 LIBRARY_FILTER_HIDDEN（避免誤把單字庫 item 直接藏掉）
  // const visibleSlice = shouldFilterHiddenSenses() ? slice.filter((r) => r?.is_hidden !== true) : slice;
  const visibleSlice = shouldFilterHiddenSensesInLibrary() ? slice.filter((r) => r?.is_hidden !== true) : slice;

  return {
    items: visibleSlice.map((r) => ({
      headword: r.headword,
      canonical_pos: r.canonical_pos,
      created_at: r.created_at,
      sense_index: typeof r.sense_index === "number" ? r.sense_index : 0,
      headword_gloss: r.headword_gloss || null,
      headword_gloss_lang: r.headword_gloss_lang || null,
      // ✅ 新增（2025-12-30）：可選回傳（若 DB 有欄位）
      // 修正（2025-12-30）：entry_id 在你的 DB 是 uuid（string），不能當 number
      // DEPRECATED(2025-12-30): 本階段先不依賴 user_words.entry_id；保留欄位僅為向後相容
      entry_id: typeof r.entry_id === "string" ? r.entry_id : null,
      familiarity: typeof r.familiarity === "number" ? r.familiarity : 0,
      is_hidden: typeof r.is_hidden === "boolean" ? r.is_hidden : false,
    })),
    nextCursor,
    limit,
  };
}

/** ✅ 新增（2025-12-30）：Supabase filter value escape（避免 headword 含特殊字元導致 .or 失敗） */
function escapeFilterValue(v) {
  // Supabase filter 的字串要用雙引號包住，並 escape 雙引號
  const s = String(v ?? "");
  const escaped = s.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * ✅ 新增（2025-12-30）：將 user_words items 以 dict_senses 釋義覆蓋（DB 權威）
 * 設計：
 * - 不修改原本 toResponsePayload（避免影響既有行為）
 * - 若 dict_entries / dict_senses 查不到資料，回退到 user_words 的快照欄位
 * - 只在 shouldUseDictSenses() === true 時啟用
 *
 * 修正（2025-12-30）：
 * - dict_entries.id / dict_senses.entry_id 為 UUID（string）
 * - 所以 entryIdMap / entryIds / senseMap key 全部改為用 string 走
 */
async function enrichLibraryItemsByDictSenses({ supabaseAdmin, items }) {
  const EP = "enrichDictSenses";
  try {
    markEndpointHit(EP);

    if (!Array.isArray(items) || items.length === 0) return items;

    // 1) 蒐集 unique (headword, canonical_pos)
    const pairs = [];
    const seen = new Set();
    for (const it of items) {
      const h = String(it?.headword ?? "");
      const p = String(it?.canonical_pos ?? "");
      const k = `${h}|||${p}`;
      if (!h || !p || seen.has(k)) continue;
      seen.add(k);
      pairs.push({ headword: h, canonical_pos: p });
    }

    if (pairs.length === 0) return items;

    // 2) 查 dict_entries.id（UUID string）
    const orParts = pairs.map(
      (x) =>
        `and(headword.eq.${escapeFilterValue(x.headword)},canonical_pos.eq.${escapeFilterValue(x.canonical_pos)})`
    );

    const { data: entryRows, error: entryErr } = await supabaseAdmin
      .from("dict_entries")
      .select("id, headword, canonical_pos")
      .or(orParts.join(","));

    if (entryErr) throw entryErr;

    const entryIdMap = new Map();
    for (const r of entryRows || []) {
      const k = `${r.headword}|||${r.canonical_pos}`;
      // ✅ 修正：UUID string
      if (!entryIdMap.has(k) && typeof r.id === "string") {
        entryIdMap.set(k, r.id);
      }
    }

    // 3) 蒐集 entry_id（UUID string）
    const entryIds = Array.from(new Set(Array.from(entryIdMap.values()))).filter((n) => typeof n === "string" && n);
    if (entryIds.length === 0) return items;

    // 4) 查 dict_senses（entry_id UUID string）
    const { data: senseRows, error: senseErr } = await supabaseAdmin
      .from("dict_senses")
      .select("entry_id, sense_index, gloss, gloss_lang")
      .in("entry_id", entryIds);

    if (senseErr) throw senseErr;

    const senseMap = new Map();
    for (const s of senseRows || []) {
      const eid = typeof s.entry_id === "string" ? s.entry_id : "";
      const idx = typeof s.sense_index === "number" ? s.sense_index : 0;
      const k = `${eid}:::${idx}`;
      senseMap.set(k, {
        gloss: typeof s.gloss === "string" ? s.gloss : null,
        gloss_lang: typeof s.gloss_lang === "string" ? s.gloss_lang : null,
      });
    }

    // 5) 覆蓋 items
    const out = items.map((it) => {
      const pairKey = `${it.headword}|||${it.canonical_pos}`;
      const entryId = entryIdMap.get(pairKey) ?? null;

      const senseKey =
        entryId != null ? `${entryId}:::${typeof it.sense_index === "number" ? it.sense_index : 0}` : null;
      const s = senseKey ? senseMap.get(senseKey) : null;

      const patched = { ...it };

      // ✅ 附上 entry_id（UUID string）
      if (typeof entryId === "string") patched.entry_id = entryId;

      // ✅ dict_senses 為權威：若有值就覆蓋；否則保留快照
      if (s && s.gloss) {
        patched.headword_gloss = s.gloss;
        patched.headword_gloss_lang = s.gloss_lang || patched.headword_gloss_lang || null;
      }

      return patched;
    });

    return out;
  } catch (e) {
    markEndpointError(EP, e);

    if (shouldDebugPayload()) {
      console.log("[libraryRoute][enrichLibraryItemsByDictSenses] failed:", String(e?.message || e));
    }
    // ✅ 保守：失敗就回退原 items
    return items;
  }
}

/**
 * ✅ 新增：upsert dict_entries 並取得 entry_id
 */
async function upsertDictEntryAndGetId({ supabaseAdmin, headword, canonicalPos }) {
  const EP = "upsertDictEntry";
  try {
    markEndpointHit(EP);

    const { error: upsertError } = await supabaseAdmin
      .from("dict_entries")
      .upsert({ headword, canonical_pos: canonicalPos }, { onConflict: "headword,canonical_pos" });

    if (upsertError) throw upsertError;

    const { data, error: selectError } = await supabaseAdmin
      .from("dict_entries")
      .select("id")
      .eq("headword", headword)
      .eq("canonical_pos", canonicalPos)
      .limit(1)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!data?.id) throw new Error("dict_entries upsert ok but id not found");

    // ✅ 你的 DB 是 UUID，因此回傳會是 string
    return data.id;
  } catch (err) {
    markEndpointError(EP, err);
    throw err;
  }
}

/**
 * ✅ 新增：upsert dict_entry_props（global）
 */
async function upsertDictEntryProps({ supabaseAdmin, entryId, entryProps }) {
  const EP = "upsertDictProps";
  try {
    markEndpointHit(EP);

    if (!entryProps) return { skipped: true };

    const payload = {
      entry_id: entryId,

      noun_gender: typeof entryProps.noun_gender === "string" ? entryProps.noun_gender : null,
      noun_plural: typeof entryProps.noun_plural === "string" ? entryProps.noun_plural : null,

      verb_separable: typeof entryProps.verb_separable === "boolean" ? entryProps.verb_separable : null,
      verb_irregular: typeof entryProps.verb_irregular === "boolean" ? entryProps.verb_irregular : null,
      verb_reflexive: typeof entryProps.verb_reflexive === "boolean" ? entryProps.verb_reflexive : null,

      prep_case: typeof entryProps.prep_case === "string" ? entryProps.prep_case : null,

      extra_props: entryProps.extra_props && typeof entryProps.extra_props === "object" ? entryProps.extra_props : null,
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

  // ✅ 新增（2025-12-30）：義項顆粒度狀態（可選）
  // - entryId：對應 dict_entries.id（若可取得）
  // - familiarity / isHidden：針對 sense_index 的狀態
  entryId,
  familiarity,
  isHidden,

  // ✅ 新增（2025-12-30）：本次請求是否為「義項狀態更新」模式
  // - true：只更新 familiarity / is_hidden，不碰 gloss 快照
  // - false：收藏（star）新增資料，寫入 gloss 快照
  isStatusUpdateMode,
}) {
  // ✅ 既有 payload（向後相容）
  const basePayload = {
    user_id: userId,
    headword,
    canonical_pos: canonicalPos,
    sense_index: typeof senseIndex === "number" ? senseIndex : 0,
    headword_gloss: headwordGloss || null,
    headword_gloss_lang: headwordGlossLang || null,
  };

  /**
   * ✅ 新增（2025-12-30）：狀態更新 payload（只寫 status，不碰 gloss）
   * 功能：
   * - 用於「單字庫畫面」後續操作（熟悉度 / 隱藏義項）
   * - 避免收藏（star）時必須帶 familiarity / is_hidden
   */
  const statusOnlyPayload = {
    user_id: userId,
    headword,
    canonical_pos: canonicalPos,
    sense_index: typeof senseIndex === "number" ? senseIndex : 0,
    // 只在有提供時才寫入，避免覆蓋 DB 既有值
    ...(typeof familiarity === "number" ? { familiarity } : {}),
    ...(typeof isHidden === "boolean" ? { is_hidden: isHidden } : {}),
  };

  // ✅ 新增（2025-12-30）：狀態更新模式 → 只寫 status，不碰 gloss 快照
  if (isStatusUpdateMode === true) {
    // 若 DB 還沒加欄位，則此段會失敗；我們保持保守：不回退去寫 basePayload（避免改到 gloss）

    // DEPRECATED(2026-01-03): 原本誤用 shouldWriteStatusOnFavorite() 造成「狀態更新」不會寫入 DB
    // - status update（familiarity / is_hidden）應該只受 shouldWriteSenseStatus() 控制
    // - shouldWriteStatusOnFavorite() 是「收藏當下是否順便寫入狀態」的開關，語意不同
    // if (shouldWriteSenseStatus() && shouldWriteStatusOnFavorite()) {
    //   ...
    // }
    const __shouldTryStatusOnlyUpsert = shouldWriteSenseStatus();
    if (__shouldTryStatusOnlyUpsert) {
      try {
        const { error: eStatus } = await supabaseAdmin
          .from("user_words")
          .upsert(statusOnlyPayload, { onConflict: "user_id,headword,canonical_pos,sense_index" });

        if (eStatus) throw eStatus;
      } catch (e) {
        if (shouldDebugPayload()) {
          console.log(
            "[libraryRoute][upsertUserWord] statusOnly upsert failed (maybe missing columns); skip fallback to protect gloss",
            JSON.stringify({
              headword: safePreview(headword),
              canonicalPos: safePreview(canonicalPos),
              senseIndex: typeof senseIndex === "number" ? senseIndex : 0,
              err: String(e?.message || e),
            })
          );
        }
      }
    } else {
      // ✅ 觀測：若沒開啟寫入開關，status update 會被跳過（避免誤以為 DB 會更新）
      if (shouldDebugPayload()) {
        console.log(
          "[libraryRoute][upsertUserWord] statusOnly upsert skipped: LIBRARY_WRITE_SENSE_STATUS!=1",
          JSON.stringify({ headword: safePreview(headword), canonicalPos: safePreview(canonicalPos), senseIndex })
        );
      }
    }
    return;
  }

  // ✅ 新增 payload（可選欄位；若 DB 尚未 migration，會自動回退）
  const statusPayload = {
    ...basePayload,
    // entry_id: typeof entryId === "string" ? entryId : null, // DEPRECATED(2025-12-30): 本階段先不新增/依賴 user_words.entry_id
    familiarity: typeof familiarity === "number" ? familiarity : 0,
    is_hidden: typeof isHidden === "boolean" ? isHidden : false,
  };

  // ✅ 分兩段寫入：先嘗試帶新欄位，失敗（例如欄位不存在）就回退舊行為
  if (shouldWriteSenseStatus()) {
    try {
      const { error } = await supabaseAdmin
        .from("user_words")
        .upsert(statusPayload, { onConflict: "user_id,headword,canonical_pos,sense_index" });

      if (error) throw error;

      return;
    } catch (e) {
      // ✅ 回退前記錄（僅在 debug 模式開啟時印出）
      if (shouldDebugPayload()) {
        console.log(
          "[libraryRoute][upsertUserWord] fallback to legacy payload (maybe missing columns)",
          JSON.stringify({
            headword: safePreview(headword),
            canonicalPos: safePreview(canonicalPos),
            senseIndex: typeof senseIndex === "number" ? senseIndex : 0,
            err: String(e?.message || e),
          })
        );
      }
      // fallthrough
    }
  }

  // ✅ 舊行為（永遠保留）
  const { error } = await supabaseAdmin
    .from("user_words")
    .upsert(basePayload, { onConflict: "user_id,headword,canonical_pos,sense_index" });

  if (error) throw error;
}

/**
 * 功能：刪除單一收藏
 * @deprecated 2025-12-30
 * - 規格更新：收藏為 headword+canonical_pos 級（星號只有一個）
 * - 取消收藏必須「同時刪除所有釋義」→ 請改用 deleteUserWordAllSenses
 * - 保留此函式避免既有結構/回溯時找不到（不可刪）
 */
async function deleteUserWord({ supabaseAdmin, userId, headword, canonicalPos, senseIndex }) {
  const { error } = await supabaseAdmin
    .from("user_words")
    .delete()
    .eq("user_id", userId)
    .eq("headword", headword)
    .eq("canonical_pos", canonicalPos)
    .eq("sense_index", typeof senseIndex === "number" ? senseIndex : 0);

  if (error) throw error;
}

/**
 * ✅ 新增（2025-12-30）：刪除同一個 headword + canonical_pos 的所有釋義收藏（全刪）
 * 功能：
 * - 符合「收藏必須同時加入、同時刪除」規格
 * - 不帶 sense_index，避免只刪單筆造成殘留
 * - 回傳 deletedCount（若 Supabase 回傳 data，則可計算筆數；否則回 null）
 */
async function deleteUserWordAllSenses({ supabaseAdmin, userId, headword, canonicalPos }) {
  const EP = "deleteAllSenses";
  try {
    markEndpointHit(EP);

    // Supabase delete 預設不一定回傳 data；此處保持保守，不依賴 deletedCount
    const { data, error } = await supabaseAdmin
      .from("user_words")
      .delete()
      .eq("user_id", userId)
      .eq("headword", headword)
      .eq("canonical_pos", canonicalPos);

    if (error) throw error;

    const deletedCount = Array.isArray(data) ? data.length : null;

    // ✅ 可開關觀測（階段性驗證）
    if (shouldDebugUnfavoriteAll()) {
      console.log(
        "[libraryRoute][unfavoriteAll]",
        JSON.stringify({
          headword: safePreview(headword),
          canonicalPos: safePreview(canonicalPos),
          deletedCount,
        })
      );
    }

    markUnfavoriteAll({ headword, canonicalPos, deletedCount, err: null });

    return { ok: true, deletedCount };
  } catch (err) {
    markEndpointError(EP, err);
    markUnfavoriteAll({ headword, canonicalPos, deletedCount: null, err });
    throw err;
  }
}

/** 功能：記錄取消收藏全刪（Production 排查用） */
function markUnfavoriteAll({ headword, canonicalPos, deletedCount, err }) {
  try {
    if (shouldDebugUnfavoriteAll()) {
      console.log(
        "[libraryRoute][markUnfavoriteAll]",
        JSON.stringify({
          headword: safePreview(headword),
          canonicalPos: safePreview(canonicalPos),
          deletedCount,
          err: err ? String(err?.message || err) : null,
        })
      );
    }
  } catch (e) {}
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

    const rawCursor = decodeCursor(req.query.cursor);
    const cursor = isValidCursor(rawCursor) ? rawCursor : null;

    // ✅ 既有行為：只讀 user_words（快照欄位）
    // ✅ 新增（2025-12-30）：可選讀取狀態欄位（若 DB 尚未 migration，會自動回退）
    let data = null;

    if (shouldSelectSenseStatus()) {
      try {
        const { data: d1, error: e1 } = await buildPagedQueryV2({
          supabaseAdmin,
          userId,
          limit,
          cursor,
          includeStatusCols: true,
        });

        if (e1) throw e1;
        data = d1 || null;
      } catch (e) {
        // ✅ 回退到舊 query（避免欄位不存在造成整個 API 掛掉）
        if (shouldDebugPayload()) {
          console.log(
            "[libraryRoute][getPaged] fallback to legacy select (maybe missing columns)",
            JSON.stringify({
              err: String(e?.message || e),
            })
          );
        }

        const { data: d0, error: e0 } = await buildPagedQuery({
          supabaseAdmin,
          userId,
          limit,
          cursor,
        });

        if (e0) throw e0;
        data = d0 || null;
      }
    } else {
      const { data: d0, error: e0 } = await buildPagedQuery({
        supabaseAdmin,
        userId,
        limit,
        cursor,
      });

      if (e0) throw e0;
      data = d0 || null;
    }

    let payload = toResponsePayload({ rows: data || [], limit });

    // ✅ 新增（2025-12-30）：以 dict_senses 覆蓋釋義（DB 權威）
    if (shouldUseDictSenses()) {
      const patchedItems = await enrichLibraryItemsByDictSenses({
        supabaseAdmin,
        items: payload.items,
      });

      payload = { ...payload, items: patchedItems };
    }

    return res.json(payload);
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

    // ✅ 新增：可開關 payload 觀測（階段性驗證用）
    if (shouldDebugPayload()) debugPayloadSummary(req.body);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const v = validateWordPayload(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });

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

      // ✅ 新增（2025-12-30）：可選狀態欄位（義項顆粒度）
      // - 收藏（star）當下：通常不帶 familiarity / isHidden → 不寫入預設值
      // - 單字庫畫面後續操作：帶 hasSenseStatusUpdate → 只更新 status，不碰 gloss 快照
      entryId,
      familiarity: typeof v.familiarity === "number" ? v.familiarity : null,
      isHidden: typeof v.isHidden === "boolean" ? v.isHidden : null,
      isStatusUpdateMode: v.hasSenseStatusUpdate === true,
    });

    res.json({ ok: true, entry_id: entryId });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/** 功能：記錄 dict write（Production 排查用） */
function markDictWrite({ headword, canonicalPos, entryId, propsPayload, err }) {
  try {
    if (shouldDebugPayload()) {
      console.log(
        "[libraryRoute][dictWrite]",
        JSON.stringify({
          headword: safePreview(headword),
          canonicalPos: safePreview(canonicalPos),
          entryId,
          propsKeys: propsPayload && typeof propsPayload === "object" ? Object.keys(propsPayload) : null,
          err: err ? String(err?.message || err) : null,
        })
      );
    }
  } catch (e) {}
}

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

    // ✅ 2025-12-30：取消收藏改為「同 headword + canonical_pos 全刪」
    // - 規格：收藏只有一個星號（headword 級）
    // - 多義字取消收藏時必須同時刪除所有 sense_index
    await deleteUserWordAllSenses({
      supabaseAdmin,
      userId,
      headword: v.headword,
      canonicalPos: v.canonicalPos,
    });

    // ⚠️ 舊行為保留（deprecated）：單刪一個 sense_index（不可刪，僅保留供回溯）
    // await deleteUserWord({
    //   supabaseAdmin,
    //   userId,
    //   headword: v.headword,
    //   canonicalPos: v.canonicalPos,
    //   senseIndex: v.senseIndex,
    // });

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

  INIT_STATUS.supabaseAdmin = getSupabaseAdminInitStatus ? getSupabaseAdminInitStatus() : null;

  res.json(INIT_STATUS);
});

/* =========================================================
 * Learning Sets (Step 1)
 * - GET /api/library/sets：回傳下拉選單來源（learning_sets）
 *
 * 設計：
 * - guest（無 token）也可呼叫，但只回傳 system sets（不含 favorites）
 * - logged-in 才回傳全部（含 favorites）
 * - 不影響既有 /api/library 行為
 * ========================================================= */

/** GET /api/library/sets（下拉選單集合） */
router.get("/sets", async (req, res, next) => {
  const EP = "getLearningSets";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();

    // ✅ 保守：此 endpoint 允許 guest（但只回 system）
    const userId = await requireUserId(req, supabaseAdmin);

    let q = supabaseAdmin.from("learning_sets").select("set_code, title, type, order_index").order("order_index", {
      ascending: true,
    });

    // ✅ guest：只回 system（不含 favorites）
    if (!userId) {
      q = q.eq("type", "system");
    }

    const { data, error } = await q;
    if (error) throw error;

    return res.json({ ok: true, sets: data || [] });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/* =========================================================
 * Module init
 * ========================================================= */
(() => {
  try {
    getSupabaseAdmin();
    INIT_STATUS.ready = true;
    INIT_STATUS.lastError = null;
  } catch (e) {
    INIT_STATUS.ready = false;
    INIT_STATUS.lastError = String(e?.message || e);
  }
})();

module.exports = router;

// backend/src/routes/libraryRoute.js
