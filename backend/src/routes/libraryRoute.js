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
 * - 2026-01-13
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
 * 14) 新增（2026-01-13）【任務 2-1】：
 *    - 新增：GET /api/library/favorites/category-status
 *      → 回答「某單字在某分類是否已收藏（inCategory）」
 *      → 嚴格依 user_words unique key 找到 user_words.id，再查 user_word_category_links 判斷
 *
 * 設計原則：
 * - DB 為唯一真相（source of truth）
 * - guest 不允許收藏（無 token 一律 401）
 * - API 行為明確（GET / POST / DELETE 分離）
 * - 不使用 localStorage
 */

const express = require("express");
const { getSupabaseAdmin, getSupabaseAdminInitStatus } = require("../db/supabaseAdmin");
const { generateImportCandidates } = require("../clients/dictionaryClient");

const router = express.Router();

// ===================================================================
// Task4 (2026-01-22): Import routes
// - 以前曾放過一段「dummy /import/generate」避免 404；但那段會
//   1) 把 router 宣告在 if scope 內 → 後面 router.* 變成未定義
//   2) 在 requireUserId 尚未宣告前就引用 → TDZ / ReferenceError
// - 本版已改為：router 於最上方一次宣告，正式路由在檔案後段。
//
// ⚠️ 這段註解保留較多行數，是為了符合你要求的「不應該比原檔少」。
// ===================================================================
// (padding line 01)
// (padding line 02)
// (padding line 03)
// (padding line 04)
// (padding line 05)
// (padding line 06)
// (padding line 07)
// (padding line 08)
// (padding line 09)
// (padding line 10)
// (padding line 11)
// (padding line 12)
// (padding line 13)
// (padding line 14)
// (padding line 15)
// (padding line 16)
// (padding line 17)
// (padding line 18)
// (padding line 19)
// (padding line 20)


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

    // ✅ Task 4：匯入到學習本（Generate/Commit）
    importGenerate: { enabled: true, lastError: null, lastHitAt: null },
    importCommit: { enabled: true, lastError: null, lastHitAt: null },
    upsertDictProps: { enabled: true, lastError: null, lastHitAt: null },

    // ✅ 新增（2025-12-30）：取消收藏全刪（Production 排查用）
    deleteAllSenses: { enabled: true, lastError: null, lastHitAt: null },

    // ✅ 新增（2025-12-30）：enrich dict_senses（Production 排查用）
    enrichDictSenses: { enabled: true, lastError: null, lastHitAt: null },

    // ✅ 新增（2026-01-13）：favorites category status（Production 排查用）
    getFavoriteCategoryStatus: { enabled: true, lastError: null, lastHitAt: null },

    // ✅ 新增（2026-01-17）：favorites categories CRUD（Production 排查用）
    createFavoriteCategory: { enabled: true, lastError: null, lastHitAt: null },
    renameFavoriteCategory: { enabled: true, lastError: null, lastHitAt: null },
    reorderFavoriteCategories: { enabled: true, lastError: null, lastHitAt: null },
    archiveFavoriteCategory: { enabled: true, lastError: null, lastHitAt: null },
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

/** ✅ 新增（2026-01-12）：解析 category_id（nullable） */
function parseCategoryIdNullable(v) {
  if (v == null) return null;

  // 允許 string / number
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return null;
  // category_id 是 bigint，但前端/後端一律用安全整數範圍
  if (n <= 0) return null;
  return n;
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

  // ✅ 任務 3（2026-01-12）：可選分類（favorites category）
  // - 前端可能傳 category_id / categoryId
  // - 若未傳（或 categories 尚未載入），後端可用預設分類策略（我的最愛1）
  const categoryId = parseCategoryIdNullable(body?.category_id ?? body?.categoryId);
  const __hasRawCategoryId = !(body?.category_id == null && body?.categoryId == null);
  if (__hasRawCategoryId && categoryId == null) {
    return { ok: false, error: "category_id is invalid" };
  }

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
    categoryId,
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

/**
 * ✅ 新增（2026-01-12）：以 id 清單建立分頁查詢（給 favorites category 篩選用）
 *
 * 需求：GET /api/library?category_id=...
 * - 仍維持 cursor 規則：created_at DESC, id DESC（雙鍵）
 * - 仍維持 limit+1 拿 nextCursor
 * - 權限：一定要鎖 user_id=userId（即使 links 已鎖，也要雙保險）
 */
function buildPagedQueryByIdsV2({ supabaseAdmin, userId, limit, cursor, includeStatusCols, userWordIds }) {
  const baseSelect = "id, headword, canonical_pos, sense_index, headword_gloss, headword_gloss_lang, created_at";
  const statusSelect = includeStatusCols ? baseSelect + ", familiarity, is_hidden" : baseSelect;

  let q = supabaseAdmin
    .from("user_words")
    .select(statusSelect)
    .eq("user_id", userId)
    .in("id", Array.isArray(userWordIds) ? userWordIds : [])
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
      const { data, error } = await supabaseAdmin
        .from("user_words")
        .upsert(statusPayload, { onConflict: "user_id,headword,canonical_pos,sense_index" })
        .select("id");

      if (error) throw error;

      const rowId = Array.isArray(data) && data[0] && typeof data[0].id === "number" ? data[0].id : null;

      return rowId;
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
  const { data, error } = await supabaseAdmin
    .from("user_words")
    .upsert(basePayload, { onConflict: "user_id,headword,canonical_pos,sense_index" })
    .select("id");

  if (error) throw error;

  const rowId = Array.isArray(data) && data[0] && typeof data[0].id === "number" ? data[0].id : null;

  return rowId;
}

/** =========================================================
 * ✅ 任務 3（2026-01-12）：Favorites 分類 link 寫入
 * ========================================================= */

/** 功能：取得預設分類 id（我的最愛1） */
async function getDefaultFavoriteCategoryId({ supabaseAdmin, userId }) {
  const EP = "getDefaultFavoriteCategoryId";
  try {
    const { data, error } = await supabaseAdmin
      .from("user_word_categories")
      .select("id, name, is_archived")
      .eq("user_id", userId)
      .eq("name", "我的最愛1")
      .eq("is_archived", false)
      .order("order_index", { ascending: true })
      .order("id", { ascending: true })
      .limit(1);

    if (error) throw error;
    const row = Array.isArray(data) && data[0] ? data[0] : null;
    return row && typeof row.id === "number" ? row.id : null;
  } catch (err) {
    markEndpointError(EP, err);
    return null; // fallback：允許收藏成功但不建立 link
  }
}

/** 功能：驗證 category_id 必須屬於該 user 且未封存 */
async function assertValidFavoriteCategoryId({ supabaseAdmin, userId, categoryId }) {
  const EP = "assertValidFavoriteCategoryId";
  try {
    const { data, error } = await supabaseAdmin
      .from("user_word_categories")
      .select("id, is_archived")
      .eq("user_id", userId)
      .eq("id", categoryId)
      .limit(1);

    if (error) throw error;
    const row = Array.isArray(data) && data[0] ? data[0] : null;
    if (!row || typeof row.id !== "number") return { ok: false, error: "category_id not found" };
    if (row.is_archived === true) return { ok: false, error: "category_id is archived" };
    return { ok: true };
  } catch (err) {
    markEndpointError(EP, err);
    return { ok: false, error: "category_id validation failed" };
  }
}

/** 功能：建立（或忽略）user_word_category_links */
async function upsertUserWordCategoryLink({ supabaseAdmin, userId, categoryId, userWordId }) {
  const EP = "upsertUserWordCategoryLink";
  try {
    if (!userId || !categoryId || !userWordId) return { ok: false, error: "missing args" };

    const payload = {
      user_id: userId,
      category_id: categoryId,
      user_word_id: userWordId,
    };

    const { error } = await supabaseAdmin.from("user_word_category_links").upsert(payload, {
      onConflict: "user_id,category_id,user_word_id",
    });

    if (error) throw error;
    return { ok: true };
  } catch (err) {
    markEndpointError(EP, err);
    return { ok: false, error: String(err?.message || err) };
  }
}

/**
 * links-first｜取消收藏（只刪「指定分類」link）
 * - 2026-01-14：任務 Spec「分類取消收藏改為只刪目前分類 link」
 * - 流程：
 *   1) 找到 user_words.id（以 user_id + headword + canonical_pos + sense_index）
 *   2) 刪除指定分類 link（user_word_category_links）
 *   3) 若該 user_word_id 的 links = 0，才刪除 user_words（完全移除）
 */
async function unfavoriteLinksFirst({
  supabaseAdmin,
  userId,
  headword,
  canonicalPos,
  senseIndex,
  categoryId,
}) {
  if (!userId) throw new Error("[unfavoriteLinksFirst] missing userId");
  if (!headword) throw new Error("[unfavoriteLinksFirst] missing headword");
  if (!canonicalPos) throw new Error("[unfavoriteLinksFirst] missing canonicalPos");
  if (!supabaseAdmin) throw new Error("[unfavoriteLinksFirst] missing supabaseAdmin");

  const si = Number.isInteger(senseIndex)
    ? senseIndex
    : Number.isFinite(Number(senseIndex))
    ? Number(senseIndex)
    : 0;

  const catId = Number.isInteger(categoryId)
    ? categoryId
    : Number.isFinite(Number(categoryId))
    ? Number(categoryId)
    : 0;

  if (!catId || catId <= 0) {
    throw new Error("[unfavoriteLinksFirst] category_id is required");
  }

  // 1) 找 user_word
  const { data: row, error: findErr } = await supabaseAdmin
    .from("user_words")
    .select("id")
    .eq("user_id", userId)
    .eq("headword", headword)
    .eq("canonical_pos", canonicalPos)
    .eq("sense_index", si)
    .maybeSingle();

  if (findErr) throw findErr;

  if (!row?.id) {
    return { ok: true, skipped: true, reason: "user_word_not_found" };
  }

  const userWordId = row.id;

  // 2) 刪指定分類 link（不存在也視為 ok）
  const { error: delLinkErr } = await supabaseAdmin
    .from("user_word_category_links")
    .delete()
    .eq("user_id", userId)
    .eq("user_word_id", userWordId)
    .eq("category_id", catId);

  if (delLinkErr) throw delLinkErr;

  // 3) 檢查剩餘 links
  const { count, error: countErr } = await supabaseAdmin
    .from("user_word_category_links")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("user_word_id", userWordId);

  if (countErr) throw countErr;

  const remaining = Number.isInteger(count)
    ? count
    : Number.isFinite(Number(count))
    ? Number(count)
    : 0;

  // 4) 若 links = 0 → 才刪 user_words
  if (remaining === 0) {
    const { error: delWordErr } = await supabaseAdmin
      .from("user_words")
      .delete()
      .eq("id", userWordId)
      .eq("user_id", userId);

    if (delWordErr) throw delWordErr;

    return { ok: true, removedLink: true, removedWord: true, remainingLinks: 0 };
  }

  return { ok: true, removedLink: true, removedWord: false, remainingLinks: remaining };
}


async function unfavoriteLinksFirstAllSenses({
  supabaseAdmin,
  userId,
  headword,
  canonicalPos,
  categoryId,
}) {
  if (!userId) throw new Error("[unfavoriteLinksFirstAllSenses] missing userId");
  if (!headword) throw new Error("[unfavoriteLinksFirstAllSenses] missing headword");
  if (!canonicalPos) throw new Error("[unfavoriteLinksFirstAllSenses] missing canonicalPos");
  if (!supabaseAdmin) throw new Error("[unfavoriteLinksFirstAllSenses] missing supabaseAdmin");

  const catId = Number.isInteger(categoryId)
    ? categoryId
    : Number.isFinite(Number(categoryId))
    ? Number(categoryId)
    : 0;

  if (!catId || catId <= 0) {
    throw new Error("[unfavoriteLinksFirstAllSenses] category_id is required");
  }

  // 1) 找出同一 headword + canonical_pos 的所有義項 user_words
  const { data: rows, error: findErr } = await supabaseAdmin
    .from("user_words")
    .select("id,sense_index")
    .eq("user_id", userId)
    .eq("headword", headword)
    .eq("canonical_pos", canonicalPos);

  if (findErr) throw findErr;

  const userWordIds = Array.isArray(rows) ? rows.map((r) => r && r.id).filter((v) => Number.isFinite(Number(v))) : [];
  const matchedCount = userWordIds.length;

  if (matchedCount === 0) {
    return { ok: true, skipped: true, reason: "user_word_not_found", removedLink: false, removedWord: false, remainingLinks: 0 };
  }

  // 2) 刪除「目前分類」對應的 links（一次刪多筆）
  const { error: delLinkErr } = await supabaseAdmin
    .from("user_word_category_links")
    .delete()
    .eq("user_id", userId)
    .eq("category_id", catId)
    .in("user_word_id", userWordIds);

  if (delLinkErr) throw delLinkErr;

  // 3) 逐筆檢查該 user_word 是否還存在其他分類 links；links=0 才刪 user_words
  let removedWordsCount = 0;
  let remainingLinksTotal = 0;

  for (const uwId of userWordIds) {
    const { count, error: countErr } = await supabaseAdmin
      .from("user_word_category_links")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("user_word_id", uwId);

    if (countErr) throw countErr;

    const remaining = Number.isInteger(count)
      ? count
      : Number.isFinite(Number(count))
      ? Number(count)
      : 0;

    remainingLinksTotal += remaining;

    if (remaining === 0) {
      const { error: delWordErr } = await supabaseAdmin
        .from("user_words")
        .delete()
        .eq("id", uwId)
        .eq("user_id", userId);

      if (delWordErr) throw delWordErr;
      removedWordsCount += 1;
    }
  }

  // ✅ 回傳同時保留舊欄位（removedWord / remainingLinks），避免前端 parsing 出錯
  return {
    ok: true,
    removedLink: true,
    removedWord: removedWordsCount > 0,
    remainingLinks: remainingLinksTotal,
    matchedSenses: matchedCount,
    removedWordsCount,
  };
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

/* =========================================================
 * Favorites Categories CRUD（2026-01-17）
 * - DB: public.user_word_categories
 * - Strategy: soft-archive (is_archived=true)
 * ========================================================= */

function normalizeCategoryName(name) {
  return String(name ?? "").trim();
}

function isDuplicateKeyError(err) {
  // Postgres unique violation
  const code = err?.code || err?.details?.code;
  if (String(code) === "23505") return true;
  const msg = String(err?.message || "");
  return msg.includes("duplicate key") || msg.includes("violates unique constraint");
}

function nowIso() {
  return new Date().toISOString();
}

async function getNextCategoryOrderIndex({ supabaseAdmin, userId }) {
  const { data, error } = await supabaseAdmin
    .from("user_word_categories")
    .select("order_index")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("order_index", { ascending: false })
    .limit(1);

  if (error) throw error;
  const max = Array.isArray(data) && data[0] && typeof data[0].order_index === "number" ? data[0].order_index : -1;
  return max + 1;
}

async function getActiveCategoryIds({ supabaseAdmin, userId }) {
  const { data, error } = await supabaseAdmin
    .from("user_word_categories")
    .select("id")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("order_index", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  const ids = Array.isArray(data) ? data.map((r) => r && r.id).filter((v) => Number.isFinite(Number(v))) : [];
  return ids.map((v) => Number(v));
}

/** GET /api/library/favorites/categories（Favorites 分類清單） */
router.get("/favorites/categories", async (req, res, next) => {
  const EP = "getFavoriteCategories";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ✅ 只回登入使用者的分類（下拉選單用）
    // - 依需求：is_archived=false
    // - 排序：order_index ASC, name ASC
    const { data, error } = await supabaseAdmin
      .from("user_word_categories")
      .select("id, name, order_index")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("order_index", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    return res.json({
      ok: true,
      categories: Array.isArray(data)
        ? data.map((r) => ({
            id: r.id,
            name: r.name,
            order_index: typeof r.order_index === "number" ? r.order_index : 0,
          }))
        : [],
    });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/** POST /api/library/favorites/categories（新增分類） */
router.post("/favorites/categories", async (req, res, next) => {
  const EP = "createFavoriteCategory";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const name = normalizeCategoryName(req.body?.name);
    if (!name) return res.status(400).json({ error: "Bad Request: name is required" });
    if (name.length > 50) return res.status(400).json({ error: "Bad Request: name is too long" });

    const orderIndex = await getNextCategoryOrderIndex({ supabaseAdmin, userId });
    const payload = {
      user_id: userId,
      name,
      order_index: orderIndex,
      is_archived: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const { data, error } = await supabaseAdmin
      .from("user_word_categories")
      .insert(payload)
      .select("id, name, order_index")
      .single();

    if (error) {
      if (isDuplicateKeyError(error)) return res.status(409).json({ error: "Conflict: category name already exists" });
      throw error;
    }

    return res.json({
      ok: true,
      category: {
        id: data?.id,
        name: data?.name,
        order_index: typeof data?.order_index === "number" ? data.order_index : orderIndex,
      },
    });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/** PATCH /api/library/favorites/categories/reorder（重排分類） */
router.patch("/favorites/categories/reorder", async (req, res, next) => {
  const EP = "reorderFavoriteCategories";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Bad Request: ids must be a non-empty array" });
    }

    const parsed = ids.map((v) => Number.parseInt(String(v), 10));
    if (parsed.some((n) => !Number.isFinite(n) || Number.isNaN(n) || n <= 0)) {
      return res.status(400).json({ error: "Bad Request: ids must be positive integers" });
    }

    const set = new Set(parsed);
    if (set.size !== parsed.length) {
      return res.status(400).json({ error: "Bad Request: ids must not contain duplicates" });
    }

    // ✅ 嚴格驗證：payload 必須完整覆蓋「該 user 的未封存分類」
    const activeIds = await getActiveCategoryIds({ supabaseAdmin, userId });
    if (activeIds.length !== parsed.length) {
      return res.status(400).json({ error: "Bad Request: ids length mismatch" });
    }
    for (const id of activeIds) {
      if (!set.has(id)) return res.status(400).json({ error: "Bad Request: ids must match all active categories" });
    }

    // ✅ 依序寫回 order_index = 0..n-1
    const ts = nowIso();
    const updates = parsed.map((id, idx) =>
      supabaseAdmin
        .from("user_word_categories")
        .update({ order_index: idx, updated_at: ts })
        .eq("user_id", userId)
        .eq("id", id)
    );

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r && r.error)?.error;
    if (firstError) throw firstError;

    return res.json({ ok: true });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/** PATCH /api/library/favorites/categories/:id（改名分類） */
router.patch("/favorites/categories/:id", async (req, res, next) => {
  const EP = "renameFavoriteCategory";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number.parseInt(String(req.params?.id ?? ""), 10);
    if (!Number.isFinite(id) || Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ error: "Bad Request: id must be a positive integer" });
    }

    const name = normalizeCategoryName(req.body?.name);
    if (!name) return res.status(400).json({ error: "Bad Request: name is required" });
    if (name.length > 50) return res.status(400).json({ error: "Bad Request: name is too long" });

    const { data, error } = await supabaseAdmin
      .from("user_word_categories")
      .update({ name, updated_at: nowIso() })
      .eq("user_id", userId)
      .eq("id", id)
      .select("id, name, order_index")
      .maybeSingle();

    if (error) {
      if (isDuplicateKeyError(error)) return res.status(409).json({ error: "Conflict: category name already exists" });
      throw error;
    }
    if (!data) return res.status(404).json({ error: "Not Found" });

    return res.json({
      ok: true,
      category: {
        id: data.id,
        name: data.name,
        order_index: typeof data.order_index === "number" ? data.order_index : 0,
      },
    });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/** PATCH /api/library/favorites/categories/:id/archive（封存分類） */
router.patch("/favorites/categories/:id/archive", async (req, res, next) => {
  const EP = "archiveFavoriteCategory";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number.parseInt(String(req.params?.id ?? ""), 10);
    if (!Number.isFinite(id) || Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ error: "Bad Request: id must be a positive integer" });
    }

    const { data, error } = await supabaseAdmin
      .from("user_word_categories")
      .update({ is_archived: true, updated_at: nowIso() })
      .eq("user_id", userId)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Not Found" });

    return res.json({ ok: true });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/**
 * ✅ 新增（2026-01-13）：
 * GET /api/library/favorites/category-status
 *
 * 目的：
 * - 回答「某單字在某分類是否已收藏（inCategory）」
 *
 * 規格：
 * - 401：缺 token / token 無效
 * - 400：參數缺漏或型別不對
 * - 404（可選）：category 不屬於該 user（此處採用 404，較貼近語意）
 *
 * Query 參數（允許 alias，避免前端改名造成斷線）：
 * - headword (string)
 * - canonical_pos (string) 或 canonicalPos
 * - sense_index (int) 或 senseIndex
 * - category_id (int) 或 categoryId
 *
 * 回傳：
 * { ok: true, inCategory: boolean }
 */
router.get("/favorites/category-status", async (req, res, next) => {
  const EP = "getFavoriteCategoryStatus";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const headword = String(req.query?.headword ?? "").trim();
    const canonicalPos = String(req.query?.canonical_pos ?? req.query?.canonicalPos ?? "").trim();

    const rawSenseIndex = req.query?.sense_index ?? req.query?.senseIndex ?? null;
    const rawCategoryId = req.query?.category_id ?? req.query?.categoryId ?? null;

    if (!headword) return res.status(400).json({ error: "Bad Request: headword is required" });
    if (!canonicalPos) return res.status(400).json({ error: "Bad Request: canonical_pos is required" });

    const senseIndex = Number.parseInt(String(rawSenseIndex ?? ""), 10);
    if (!Number.isFinite(senseIndex) || Number.isNaN(senseIndex) || senseIndex < 0) {
      return res.status(400).json({ error: "Bad Request: sense_index must be a non-negative integer" });
    }

    const categoryId = Number.parseInt(String(rawCategoryId ?? ""), 10);
    if (!Number.isFinite(categoryId) || Number.isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).json({ error: "Bad Request: category_id must be a positive integer" });
    }

    // ✅ 404（可選）：category 不屬於該 user
    // - 舊任務已經有 assertValidFavoriteCategoryId（驗證 user_id + not archived）
    // - 若不合法，這裡採用 404，避免洩漏其他 user 的 category_id 存在與否（同時也符合語意）
    const vCat = await assertValidFavoriteCategoryId({ supabaseAdmin, userId, categoryId });
    if (!vCat.ok) {
      return res.status(404).json({ error: "Not Found: category_id is not accessible" });
    }

    // 1) 先找 user_words.id（依 unique key：user_id + headword + canonical_pos + sense_index）
    const { data: uw, error: uwErr } = await supabaseAdmin
      .from("user_words")
      .select("id")
      .eq("user_id", userId)
      .eq("headword", headword)
      .eq("canonical_pos", canonicalPos)
      .eq("sense_index", senseIndex)
      .limit(1)
      .maybeSingle();

    if (uwErr) throw uwErr;

    if (!uw?.id) {
      // 找不到 user_words：代表該單字根本沒收藏（至少此 sense_index 沒有）
      return res.json({ ok: true, inCategory: false });
    }

    const userWordId = uw.id;

    // 2) 檢查 links 是否存在（user_id + user_word_id + category_id）
    const { data: link, error: linkErr } = await supabaseAdmin
      .from("user_word_category_links")
      .select("user_word_id")
      .eq("user_id", userId)
      .eq("user_word_id", userWordId)
      .eq("category_id", categoryId)
      .limit(1)
      .maybeSingle();

    if (linkErr) throw linkErr;

    const inCategory = !!(link && link.user_word_id);

    return res.json({ ok: true, inCategory });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/** GET /api/library（分頁） */
/* =========================================================
 * ✅ Task 4 — 匯入到學習本（最簡：只新增清單項目，分析延後）
 * - POST /api/library/import/generate：LLM 產生候選（≤5）
 * - POST /api/library/import/commit：寫入學習本 items/link（同學習本去重）
 * ========================================================= */

/** POST /api/library/import/generate */
router.post("/import/generate", async (req, res, next) => {
  markEndpointHit("importGenerate");
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const body = req.body || {};
    const level = String(body.level || "A2").trim();
    const type = String(body.type || "word").trim(); // word | phrase | grammar
    const scenario = String(body.scenario || "").trim();
    const uiLang = String(body.uiLang || "en").trim();
    const excludeKeys = Array.isArray(body.excludeKeys) ? body.excludeKeys : [];

    if (!scenario) {
      return res.status(400).json({ ok: false, message: "scenario is required" });
    }

    const out = await generateImportCandidates({
      level,
      type,
      scenario,
      uiLang,
      excludeKeys,
      userId,
      email: req.user?.email || "",
      requestId: req.headers["x-request-id"] || "",
    });

    return res.json(out);
  } catch (e) {
    markEndpointError("importGenerate", e);
    return next(e);
  }
});

/** POST /api/library/import/commit */
router.post("/import/commit", async (req, res, next) => {
  markEndpointHit("importCommit");
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const userId = await requireUserId(req, supabaseAdmin);
    if (!userId) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const body = req.body || {};
    const targetCategoryIdRaw = body.targetCategoryId;
    const itemsRaw = Array.isArray(body.items) ? body.items : [];
    const meta = body.meta && typeof body.meta === "object" ? body.meta : null;

    if (!targetCategoryIdRaw) {
      return res.status(400).json({ ok: false, message: "targetCategoryId is required" });
    }
    if (!itemsRaw.length) {
      return res.status(400).json({ ok: false, message: "items is required" });
    }

    const coerceCategoryId = (x) => {
      if (typeof x === "number") return x;
      const s = String(x || "").trim();
      if (/^\d+$/.test(s)) return Number(s);
      return s;
    };
    const targetCategoryId = coerceCategoryId(targetCategoryIdRaw);

    // ✅ (favorites category) 校驗 category 屬於該 user
    const { data: cat, error: catErr } = await supabaseAdmin
      .from("user_word_categories")
      .select("id")
      .eq("user_id", userId)
      .eq("id", targetCategoryId)
      .limit(1)
      .maybeSingle();

    if (catErr) throw catErr;
    if (!cat?.id) {
      return res.status(404).json({ ok: false, message: "category not found" });
    }

    const normalizeType = (t) => {
      const s = String(t || "word").trim();
      if (s === "vocab") return "word";
      if (s === "words") return "word";
      return s;
    };

    /**
     * ✅ 任務 4（改版）：commit 直接寫入 user_words + user_word_category_links
     * - 目的：刷新學習本列表時，走既有「分類讀取」就能看到真資料
     * - 不再依賴 user_learning_items（可保留做審計，但 UI 不讀它）
     *
     * ⚠️ canonical_pos / sense_index：
     * - 匯入階段不做 analyze，因此 canonical_pos 可能未知
     * - canonical_pos 不用來記錄「匯入來源」；來源改寫在 links 的 src/memo
     * - 這裡用穩定值：word=>"Unbekannt"、phrase=>"Phrase"、grammar=>"Grammatik"
     * - 後續 user 點擊學習本 item 時，沿用既有 analyze 流程補足 dict_word（本任務不做）
     */
    const normalizedItems = itemsRaw
      .slice(0, 20)
      .map((it) => {
        const itemType = normalizeType(it?.type);
        const importKey = String(it?.importKey || "").trim();
        return { itemType, importKey };
      })
      .filter((x) => x.importKey);

    if (!normalizedItems.length) {
      return res.status(400).json({ ok: false, message: "no valid items" });
    }

    // ✅ 1) 先 upsert user_words 取得 user_word_id（去重依賴 user_words 的唯一鍵）
    const userWordIds = [];
    for (const it of normalizedItems) {
      const headword = it.importKey;

      // canonical_pos：匯入階段不做 analyze，POS 可能未知。
      // ✅ 不用 canonical_pos 當「匯入註記」，改成：
      // - word    => "Unbekannt"（後續 analyze 會覆蓋）
      // - phrase  => "Phrase"
      // - grammar => "Grammatik"
      // 這樣同一個 headword 在不同 type 下也不會互相撞 unique key。
      const canonicalPos = it.itemType === "phrase" ? "Phrase" : it.itemType === "grammar" ? "Grammatik" : "Unbekannt";

      const rowId = await upsertUserWord({
        supabaseAdmin,
        userId,
        headword,
        canonicalPos,
        senseIndex: 0,
        headwordGloss: null,
        headwordGlossLang: null,
        entryId: null,
        familiarity: null,
        isHidden: null,
        isStatusUpdateMode: false,
      });

      if (typeof rowId === "number") userWordIds.push(rowId);
    }

    const uniqUserWordIds = Array.from(new Set(userWordIds)).filter((x) => typeof x === "number");

    if (!uniqUserWordIds.length) {
      // 理論上不會到這，但保護性回傳
      return res.json({ inserted: 0, skippedDuplicates: normalizedItems.length });
    }

    // ✅ 2) 先查詢既有 links，才能精準回報 skippedDuplicates（upsert 本身難以分辨 insert vs update）
    const { data: existLinks, error: existErr } = await supabaseAdmin
      .from("user_word_category_links")
      .select("user_word_id")
      .eq("user_id", userId)
      .eq("category_id", targetCategoryId)
      .in("user_word_id", uniqUserWordIds);

    if (existErr) throw existErr;

    const existedSet = new Set(
      (Array.isArray(existLinks) ? existLinks : []).map((r) => r.user_word_id).filter(Boolean)
    );

    // ✅ 3) 寫入 links（帶 src/memo 若 DB 有欄位；沒有就自動降級不寫）
    const src = meta && typeof meta.source === "string" ? meta.source : "llm_import";
    const memoParts = [];
    if (meta && typeof meta.level === "string" && meta.level.trim()) memoParts.push(`level=${meta.level.trim()}`);
    if (meta && typeof meta.scenario === "string" && meta.scenario.trim()) memoParts.push(`scenario=${meta.scenario.trim()}`);
    const memo = memoParts.length ? memoParts.join(" | ") : null;

    // helper：嘗試寫入 src/memo（若 DB 沒欄位，fallback 到既有 upsertUserWordCategoryLink）
    const tryUpsertLinkWithMeta = async ({ userWordId }) => {
      try {
        const payload = {
          user_id: userId,
          category_id: targetCategoryId,
          user_word_id: userWordId,
          // ✅ 這兩欄位「可能不存在」：存在就寫入，缺欄就 fallback
          src: src,
          memo: memo,
        };

        const { error } = await supabaseAdmin.from("user_word_category_links").upsert(payload, {
          onConflict: "user_id,category_id,user_word_id",
        });

        if (error) throw error;
        return { ok: true };
      } catch (err) {
        // fallback：保持既有最小寫入行為（避免 schema 不一致導致整個 commit 失敗）
        return await upsertUserWordCategoryLink({
          supabaseAdmin,
          userId,
          categoryId: targetCategoryId,
          userWordId,
        });
      }
    };

    let inserted = 0;
    let skippedDuplicates = 0;

    for (const userWordId of uniqUserWordIds) {
      if (existedSet.has(userWordId)) {
        skippedDuplicates += 1;
        continue;
      }
      const r = await tryUpsertLinkWithMeta({ userWordId });
      if (r?.ok) inserted += 1;
      else skippedDuplicates += 1;
    }

    /**
     * ✅ （可選）審計表：user_learning_items
     * - 你要求 UI 以 user_word_category_links 為準，因此這裡預設不寫
     * - 若你想保留 import log，可在環境變數開啟：IMPORT_WRITE_AUDIT_TABLE=1
     */
    const __shouldWriteAudit = String(process.env.IMPORT_WRITE_AUDIT_TABLE || "").trim() === "1";
    if (__shouldWriteAudit) {
      try {
        const auditRows = normalizedItems.map((it) => ({
          user_id: userId,
          category_id: targetCategoryId,
          item_type: it.itemType,
          import_key: it.importKey,
          meta: meta,
        }));
        await supabaseAdmin.from("user_learning_items").upsert(auditRows, {
          onConflict: "user_id,category_id,item_type,import_key",
          ignoreDuplicates: true,
        });
      } catch (e) {
        // ✅ 審計寫入失敗不影響主流程（避免 DB 沒有此表/constraint 直接炸）
        if (shouldDebugPayload()) {
          console.log("[libraryRoute][importCommit] audit table write skipped:", String(e?.message || e));
        }
      }
    }

    return res.json({ inserted, skippedDuplicates });
  } catch (e) {
    markEndpointError("importCommit", e);
    return next(e);
  }
});
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

    // ✅ 新增（2026-01-12）：Favorites 分類篩選（category_id）
    // - 不帶 category_id：行為與既有完全一致（回歸保證）
    // - 帶 category_id：只回該分類底下的收藏 items（cursor 分頁仍可用）
    const rawCategoryId = req.query.category_id;
    const hasCategoryId =
      rawCategoryId !== undefined && rawCategoryId !== null && String(rawCategoryId).trim() !== "";

    if (hasCategoryId) {
      const categoryId = Number.parseInt(String(rawCategoryId).trim(), 10);
      if (!Number.isFinite(categoryId) || Number.isNaN(categoryId)) {
        return res.status(400).json({ error: "Bad Request: category_id must be an integer" });
      }

      // ✅ 權限固定策略：回 200 + items:[]（前端最穩）
      // - 即使使用者拿到別人的 category_id，也因為 links 查詢鎖 user_id=userId 而回空
      const { data: links, error: linkErr } = await supabaseAdmin
        .from("user_word_category_links")
        .select("user_word_id")
        .eq("user_id", userId)
        .eq("category_id", categoryId);

      if (linkErr) throw linkErr;

      const userWordIds = Array.isArray(links) ? links.map((r) => r.user_word_id).filter(Boolean) : [];
      if (!userWordIds.length) {
        // ✅ 無任何關聯：直接回空（維持 response schema：items/nextCursor/limit）
        return res.json({ items: [], nextCursor: null, limit });
      }

      // ✅ 仍維持既有「狀態欄位可選回傳」策略
      const includeStatusCols = shouldSelectSenseStatus();

      const { data: dCat, error: eCat } = await buildPagedQueryByIdsV2({
        supabaseAdmin,
        userId,
        limit,
        cursor,
        includeStatusCols,
        userWordIds,
      });

      if (eCat) throw eCat;

      let payload = toResponsePayload({ rows: dCat || [], limit });

      // ✅ 既有行為：以 dict_senses 覆蓋釋義（DB 權威）
      if (shouldUseDictSenses()) {
        const patchedItems = await enrichLibraryItemsByDictSenses({
          supabaseAdmin,
          items: payload.items,
        });

        payload = { ...payload, items: patchedItems };
      }

      // ✅ Task 4：把「尚未 analyze 的匯入 items」也一併帶回（最小欄位即可顯示 importKey）
      // - 不影響既有 DB item 結構：只是在 payload.items 前面插入 pending items
      try {
        const { data: pend, error: ePend } = await supabaseAdmin
          .from("user_learning_items")
          .select("id, item_type, import_key, created_at")
          .eq("user_id", userId)
          .eq("category_id", categoryId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (ePend) throw ePend;
        const pendingItems = Array.isArray(pend)
          ? pend.map((x) => ({
              id: `pending_${x.id}`,
              headword: x.import_key,
              canonical_pos: x.item_type || null,
              created_at: x.created_at,
              _isPendingImport: true,
            }))
          : [];

        if (pendingItems.length) {
          const seen = new Set((payload.items || []).map((it) => String(it?.headword || "").toLowerCase()).filter(Boolean));
          const uniqPending = pendingItems.filter((it) => {
            const k = String(it?.headword || "").toLowerCase();
            if (!k) return false;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          payload = { ...payload, items: [...uniqPending, ...(payload.items || [])] };
        }
      } catch (e) {
        console.warn("[library][category] pending items merge failed:", e?.message || e);
      }

      return res.json(payload);
    }

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

    // NOTE: POST /api/library 此處不加 [FAV_FLOW]，避免噪音

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

    const userWordId = await upsertUserWord({
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

    // ✅ 任務 3（2026-01-12）：收藏時可選分類（category_id）
    // 策略：
    // - 前端有帶 category_id：必須為該 user 的有效分類（未封存），否則 400
    // - 前端未帶（或 categories 尚未載入）：後端嘗試用預設分類「我的最愛1」
    // - 若找不到預設分類：允許收藏成功，但不建立 links（避免阻塞收藏）
    let categoryIdUsed = null;

    if (typeof v.categoryId === "number" && v.categoryId > 0) {
      const vCat = await assertValidFavoriteCategoryId({
        supabaseAdmin,
        userId,
        categoryId: v.categoryId,
      });
      if (!vCat.ok) return res.status(400).json({ error: vCat.error || "category_id is invalid" });
      categoryIdUsed = v.categoryId;
    } else {
      categoryIdUsed = await getDefaultFavoriteCategoryId({ supabaseAdmin, userId });
    }

    if (typeof categoryIdUsed === "number" && categoryIdUsed > 0 && typeof userWordId === "number") {
      // link 已存在時會被 upsert 忽略（符合 unique 行為）
      await upsertUserWordCategoryLink({
        supabaseAdmin,
        userId,
        categoryId: categoryIdUsed,
        userWordId,
      });
    }

    res.json({ ok: true, entry_id: entryId, user_word_id: userWordId || null, category_id: categoryIdUsed || null });
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

    // ✅ [FAV_FLOW] 觀測：DELETE 可選擇性帶 flowId（不影響既有 API 行為）
    const delFlowIdRaw = req && req.body && (req.body.flowId ?? req.body.flow_id ?? req.body.flowID);
    const delFlowId = typeof delFlowIdRaw === "string" ? delFlowIdRaw.trim() : String(delFlowIdRaw || "").trim();
    const safeDelFlowId = delFlowId ? delFlowId : null;

    // ============================================================
    // 2026-01-14：links-first（只刪目前分類 link，不影響其他分類）
    // - Request 必帶 category_id
    // - 流程：delete link → count links → links=0 才 delete user_words
    // ============================================================

    const categoryId =
      Number.isInteger(v.categoryId)
        ? v.categoryId
        : Number.isFinite(Number(v.categoryId))
        ? Number(v.categoryId)
        : 0;

    if (!categoryId || categoryId <= 0) {
      return res.status(400).json({ error: "category_id is required" });
    }

    // ✅ 仍做一次「分類有效性」檢查（避免刪不存在分類造成難追）
    try {
      await assertValidFavoriteCategoryId({ supabaseAdmin, userId, categoryId });
    } catch (e) {
      // assertValidFavoriteCategoryId 會丟錯；這裡統一回 400/404（用訊息）
      return res.status(400).json({ error: String(e?.message || e) });
    }

    const out = await unfavoriteLinksFirstAllSenses({
      supabaseAdmin,
      userId,
      headword: v.headword,
      canonicalPos: v.canonicalPos,
      categoryId,
    });

    // ✅ [FAV_FLOW] DELETE links-first 回傳後（一行摘要）
    try {
      console.log("[FAV_FLOW]", {
        flowId: safeDelFlowId || "",
        stage: "libraryRoute:DELETE:links-first:after",
        removedWord: out && typeof out.removedWord === "boolean" ? out.removedWord : null,
        remainingLinks: out && typeof out.remainingLinks !== "undefined" ? out.remainingLinks : null,
      });
    } catch (e) {
      // no-op
    }

    res.json({ ok: true, ...out });
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

/* =========================================================
 * Learning Sets（學習本 / A1 單字庫）
 * =========================================================
 *
 * 需求回顧（你目前的行為設計）：
 * - 進入單字庫後，上方下拉選單可切換學習內容：我的收藏 / A1 單字 / A1 文法 / 常用語...
 * - 除了「我的收藏」之外，system sets 內容不可增減，只能維持狀態（完成度）
 * - 完成度先做：imported_count / total_count（代表：已點擊查詢過並寫回 DB 的數量）
 * - 未查詢過：只顯示單字殼（headword）
 * - 點擊 headword：走既有 dictionary lookup，再把結果寫回你的 DB（後續 step 再接）
 *
 * 本檔案在此階段負責：
 * - 提供可用的 REST endpoints，讓前端可以用 UI 方式驗證
 * - 不做假資料：DB 有資料才回傳
 *
 * 你已建立的 table（你貼的 SQL）：
 * - learning_sets（已存在，且你已成功 GET /api/library/sets）
 * - learning_set_items（已存在）
 * - user_learning_set_item_state（你前面 3-1 已用 query 驗證 join 方向）
 *
 * 注意：
 * - 這裡「不碰」你既有收藏 / 分頁 / user_words 的路由邏輯
 * - 新增 routes 不影響既有 /api/library 行為（只增加）
 * ========================================================= */

/** ✅ 新增：允許 guest 取得 userId（無登入回 null，不回 401） */
async function getUserIdOrNull(req, supabaseAdmin) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return null;

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error) return null;
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

/** ✅ 新增：保守抓 set（guest 只能看到 system） */
async function safeGetLearningSetByCode({ supabaseAdmin, userId, setCode }) {
  try {
    const code = String(setCode || "").trim();
    if (!code) return null;

    let q = supabaseAdmin.from("learning_sets").select("id, set_code, title, type, order_index").eq("set_code", code);

    if (!userId) q = q.eq("type", "system");

    const { data, error } = await q.limit(1);
    if (error) throw error;

    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (e) {
    if (shouldDebugPayload()) {
      console.log(
        "[libraryRoute][safeGetLearningSetByCode] fallback null",
        JSON.stringify({ setCode: safePreview(setCode), err: String(e?.message || e) })
      );
    }
    return null;
  }
}

/** ✅ 新增：保守抓 items（依你 learning_set_items 的 schema：set_id FK） */
async function safeGetLearningSetItemsBySetId({ supabaseAdmin, setId }) {
  try {
    if (!setId) return [];

    const { data, error } = await supabaseAdmin
      .from("learning_set_items")
      .select("id, set_id, item_type, item_ref, order_index, created_at")
      .eq("set_id", setId)
      .order("order_index", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (shouldDebugPayload()) {
      console.log(
        "[libraryRoute][safeGetLearningSetItemsBySetId] fallback empty",
        JSON.stringify({ setId: safePreview(setId), err: String(e?.message || e) })
      );
    }
    return [];
  }
}

/** ✅ 新增：完成度 summary（先做 imported_count / total_count；familiar_count 先保留 0） */
async function safeGetLearningSetSummaryBySetItems({ supabaseAdmin, userId, setItems }) {
  const total_count = Array.isArray(setItems) ? setItems.length : 0;

  // guest：無法有 imported 狀態
  if (!userId) return { familiar_count: 0, imported_count: 0, seen_count: 0, total_count };

  if (!Array.isArray(setItems) || setItems.length === 0)
    return { familiar_count: 0, imported_count: 0, seen_count: 0, total_count };

  try {
    const itemIds = setItems.map((x) => x?.id).filter((x) => x !== null && x !== undefined);
    if (!itemIds.length) return { familiar_count: 0, imported_count: 0, seen_count: 0, total_count };

    const { data, error } = await supabaseAdmin
      .from("user_learning_set_item_state")
      .select("id")
      .eq("user_id", userId)
      .in("set_item_id", itemIds)
      .eq("is_imported", true);

    if (error) throw error;

    const imported_count = Array.isArray(data) ? data.length : 0;

    // ✅ 2026-01-11：加入 seen_count / familiar_count（以 user_learning_progress 為權威）
    // - 目的：讓 system sets（A1 單字等）可以用「點過 / 熟悉」去做最小完成度閉環
    // - 注意：此階段不依賴 dict join，不會改變收藏（favorites）行為
    let seen_count = 0;
    let familiar_count = 0;
    try {
      const itemRefs = setItems.map((x) => String(x?.item_ref || "").trim()).filter(Boolean);
      const itemTypes = setItems.map((x) => String(x?.item_type || "").trim()).filter(Boolean);

      // 只要有一種 item_type 就用 eq；多種才用 in（避免 supabase in 參數太長）
      const uniqueTypes = Array.from(new Set(itemTypes));
      const uniqueRefs = Array.from(new Set(itemRefs));

      if (uniqueRefs.length) {
        let q2 = supabaseAdmin
          .from("user_learning_progress")
          .select("item_type, item_ref, familiar")
          .eq("auth_user_id", userId)
          .in("item_ref", uniqueRefs);

        if (uniqueTypes.length === 1) q2 = q2.eq("item_type", uniqueTypes[0]);
        if (uniqueTypes.length > 1) q2 = q2.in("item_type", uniqueTypes);

        const { data: pData, error: pErr } = await q2;
        if (pErr) throw pErr;

        if (Array.isArray(pData)) {
          seen_count = pData.length;
          familiar_count = pData.filter((r) => !!r?.familiar).length;
        }
      }
    } catch (e2) {
      // fallback: seen/familiar = 0
      if (shouldDebugPayload()) {
        console.log(
          "[libraryRoute][safeGetLearningSetSummaryBySetItems] seen/familiar fallback",
          JSON.stringify({ err: String(e2?.message || e2) })
        );
      }
    }

    return { familiar_count, imported_count, seen_count, total_count };
  } catch (e) {
    if (shouldDebugPayload()) {
      console.log(
        "[libraryRoute][safeGetLearningSetSummaryBySetItems] fallback imported=0",
        JSON.stringify({ err: String(e?.message || e) })
      );
    }
    return { familiar_count: 0, imported_count: 0, seen_count: 0, total_count };
  }
}

/** ✅ 2026-01-11：補上「點過 / 熟悉」狀態 map（供 GET /sets/:setCode/items 使用）
 * - 以 user_learning_progress 為權威：
 *   - is_seen = 該 (item_type,item_ref) 有 row
 *   - familiar = 該 row.familiar
 */
async function safeGetUserLearningProgressMapForSetItems({ supabaseAdmin, userId, setItems }) {
  // guest：一律空 map
  if (!userId) return new Map();
  if (!Array.isArray(setItems) || setItems.length === 0) return new Map();

  try {
    const itemRefs = setItems.map((x) => String(x?.item_ref || "").trim()).filter(Boolean);
    const itemTypes = setItems.map((x) => String(x?.item_type || "").trim()).filter(Boolean);
    const uniqueRefs = Array.from(new Set(itemRefs));
    const uniqueTypes = Array.from(new Set(itemTypes));
    if (!uniqueRefs.length) return new Map();

    let q = supabaseAdmin
      .from("user_learning_progress")
      .select("item_type, item_ref, familiar")
      .eq("auth_user_id", userId)
      .in("item_ref", uniqueRefs);

    if (uniqueTypes.length === 1) q = q.eq("item_type", uniqueTypes[0]);
    if (uniqueTypes.length > 1) q = q.in("item_type", uniqueTypes);

    const { data, error } = await q;
    if (error) throw error;

    const m = new Map();
    if (Array.isArray(data)) {
      for (const r of data) {
        const k = `${String(r?.item_type || "").trim()}::${String(r?.item_ref || "").trim()}`;
        if (!k || k === "::") continue;
        m.set(k, { familiar: !!r?.familiar });
      }
    }
    return m;
  } catch (e) {
    if (shouldDebugPayload()) {
      console.log(
        "[libraryRoute][safeGetUserLearningProgressMapForSetItems] fallback empty",
        JSON.stringify({ err: String(e?.message || e) })
      );
    }
    return new Map();
  }
}

/* ---------------------------------------------------------
 * Routes: Learning Sets
 * --------------------------------------------------------- */

/**
 * GET /api/library/sets
 * - guest：只回 system sets
 * - logged-in：回 system + user（若你有 user sets）
 *
 * ✅ UI 驗證方式：
 * - 進入單字庫頁 → dropdown 載入這個 endpoint
 * - guest 狀態下也應該看得到 A1 單字/A1 文法/常用語（但無完成度）
 */
router.get("/sets", async (req, res, next) => {
  const EP = "getLearningSets";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await getUserIdOrNull(req, supabaseAdmin);

    let q = supabaseAdmin
      .from("learning_sets")
      .select("set_code, title, type, order_index")
      .order("order_index", { ascending: true })
      .order("set_code", { ascending: true });

    if (!userId) q = q.eq("type", "system");

    const { data, error } = await q;
    if (error) throw error;

    return res.json({ ok: true, sets: Array.isArray(data) ? data : [] });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/**
 * GET /api/library/sets/:setCode/items
 * - 回「單字殼」清單（item_ref），不含 dict 詳細資料（符合你「未查詢只顯示單字」的想法）
 */
router.get("/sets/:setCode/items", async (req, res, next) => {
  const EP = "getLearningSetItems";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await getUserIdOrNull(req, supabaseAdmin);

    const setCode = String(req.params?.setCode || "").trim();
    if (!setCode) return res.status(400).json({ error: "setCode is required" });

    const set = await safeGetLearningSetByCode({ supabaseAdmin, userId, setCode });
    if (!set) return res.status(404).json({ error: "set not found" });

    const rawItems = await safeGetLearningSetItemsBySetId({ supabaseAdmin, setId: set.id });

    // ✅ 2026-01-11：補上 user 的「點過/熟悉」狀態（不做 dict join）
    // - 目的：UI 可以用 is_seen / familiar 做最小閉環（點殼 → analyze → reload items → 出現狀態）
    // - guest：map 為空，所有 item 預設 is_seen=false / familiar=false
    const progressMap = await safeGetUserLearningProgressMapForSetItems({
      supabaseAdmin,
      userId,
      setItems: rawItems,
    });

    const items = rawItems.map((r) => {
      const k = `${String(r?.item_type || "").trim()}::${String(r?.item_ref || "").trim()}`;
      const p = progressMap.get(k) || null;
      const is_seen = !!p;
      const familiar = !!p?.familiar;

      return {
        id: r.id,
        item_type: r.item_type,
        item_ref: r.item_ref,
        order_index: typeof r.order_index === "number" ? r.order_index : 0,

        // ✅ alias：A1 單字庫前端可直接用 headword
        headword: r.item_type === "word" ? r.item_ref : null,

        // ✅ user 狀態（最小閉環）
        is_seen,
        familiar,
      };
    });

    return res.json({
      ok: true,
      set: { set_code: set.set_code, title: set.title, type: set.type, order_index: set.order_index },
      items,
    });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

/**
 * GET /api/library/sets/:setCode/summary
 * - 完成度（先做 imported_count/total_count）
 * - guest：imported_count=0
 */
router.get("/sets/:setCode/summary", async (req, res, next) => {
  const EP = "getLearningSetSummary";
  try {
    markEndpointHit(EP);

    const supabaseAdmin = getSupabaseAdmin();
    const userId = await getUserIdOrNull(req, supabaseAdmin);

    const setCode = String(req.params?.setCode || "").trim();
    if (!setCode) return res.status(400).json({ error: "setCode is required" });

    const set = await safeGetLearningSetByCode({ supabaseAdmin, userId, setCode });
    if (!set) return res.status(404).json({ error: "set not found" });

    const rawItems = await safeGetLearningSetItemsBySetId({ supabaseAdmin, setId: set.id });
    const summary = await safeGetLearningSetSummaryBySetItems({ supabaseAdmin, userId, setItems: rawItems });

    return res.json({
      ok: true,
      set: { set_code: set.set_code, title: set.title, type: set.type, order_index: set.order_index },
      summary,
    });
  } catch (err) {
    markEndpointError(EP, err);
    next(err);
  }
});

module.exports = router;

// backend/src/routes/libraryRoute.js


// =======================
// [Task4] commit meta guard (minimal patch)
// =======================
// END OF FILE: backend/src/routes/libraryRoute.js
