// backend/src/routes/analyzeRoute.js
/**
 * 文件說明：
 * - 功能：/api/analyze 路由入口，負責：
 *   - 讀取 req.body 參數
 *   - 判斷是否為單字/片語（非句子）
 *   - 組 options 並呼叫 analyzeWord
 *   - 記錄粗略用量 logUsage
 *
 * 異動紀錄：
 * - 2026-01-05：✅ Step 2（POS 可切換機制）：新增 targetPosKey 參數（僅透傳到 analyzeWord，不改既有 UI 行為）
 * - 2026-01-05：✅ Step 2-3（用量歸戶打通）：將 userId/email/ip/endpoint/requestId 透傳到 analyzeWord options（供 lookup 記帳）
 * - 2026-01-07：✅ Step Guard(只讀不擋)：在進入 analyzeWord 前呼叫 can_consume_usage（僅 console 觀測，不阻擋）
 * - 2026-01-07：✅ Fix Guard RPC keys：對齊 DB function args：p_add_llm_completion_tokens / p_add_tts_chars
 *
 * 注意：
 * - 本檔案遵守「只插入 / 局部替換」原則
 * - 本階段只做後端參數打通與 runtime console（Production 排查）
 */

const express = require('express');
const router = express.Router();

const jwt = require("jsonwebtoken");

// ✅ 2026-01-07：Guard(只讀不擋) - 需要 supabase client（lazy init）
let _supabaseGuardClient = null;
function getSupabaseGuardClient() {
  try {
    if (_supabaseGuardClient) return _supabaseGuardClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;

    // 延後 require，避免在缺依賴/缺 env 時影響主流程
    const { createClient } = require("@supabase/supabase-js");
    _supabaseGuardClient = createClient(url, key, {
      auth: { persistSession: false },
    });
    return _supabaseGuardClient;
  } catch (e) {
    console.warn("[GUARD][init] failed:", e?.message || String(e));
    return null;
  }
}

/**
 * ✅ 2026-01-07：中文功能說明（Guard 只讀不擋）
 * - 用途：在呼叫昂貴資源（LLM）前，讀取 can_consume_usage 的結果做觀測
 * - 注意：本階段不阻擋，只 console，避免影響現有使用流程
 * - 參數：
 *   - userId：必須有值才查
 *   - estAddCompletionTokens：本次預計新增的 completion tokens（此階段先用 0）
 *   - estAddTtsChars：本次預計新增的 TTS chars（analyze 固定 0）
 */
async function guardCanConsumeReadOnly({ userId, estAddCompletionTokens, estAddTtsChars, requestId, endpoint }) {
  try {
    const supa = getSupabaseGuardClient();
    if (!supa) {
      console.warn("[GUARD][readOnly] skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return { ok: null, reason: "missing_env" };
    }
    if (!userId) {
      console.warn("[GUARD][readOnly] skipped: missing userId");
      return { ok: null, reason: "missing_userId" };
    }

    // ✅ 2026-01-07 Fix：對齊 DB function args
    // public.can_consume_usage(p_user_id uuid, p_add_llm_completion_tokens bigint, p_add_tts_chars bigint)
    const payload = {
      p_user_id: userId,
      p_add_llm_completion_tokens: typeof estAddCompletionTokens === "number" ? estAddCompletionTokens : 0,
      p_add_tts_chars: typeof estAddTtsChars === "number" ? estAddTtsChars : 0,
    };

    const { data, error } = await supa.rpc("can_consume_usage", payload);

    if (error) {
      console.warn("[GUARD][readOnly] rpc failed:", requestId ? `rid=${requestId}` : "", error.message || String(error));
      return { ok: null, reason: "rpc_failed", error };
    }

    // data 可能是 object 或 array（視 RPC 實作），這裡都兼容
    const row = Array.isArray(data) ? (data[0] || null) : (data || null);

    console.log("[GUARD][readOnly] ok", {
      endpoint: endpoint || "",
      requestId: requestId || "",
      userId,
      add_completion_tokens: payload.p_add_llm_completion_tokens,
      add_tts_chars: payload.p_add_tts_chars,
      ok: row ? row.ok : null,
      reason: row ? row.reason : null,
      day: row ? row.day : null,
      period_start: row ? row.period_start : null,
      period_end: row ? row.period_end : null,
      day_llm: row ? row.day_llm : null,
      day_tts: row ? row.day_tts : null,
      period_llm: row ? row.period_llm : null,
      period_tts: row ? row.period_tts : null,
      cap_day_llm: row ? row.cap_day_llm : null,
      cap_day_tts: row ? row.cap_day_tts : null,
      cap_period_llm: row ? row.cap_period_llm : null,
      cap_period_tts: row ? row.cap_period_tts : null,
    });

    return row || { ok: null, reason: "no_row" };
  } catch (e) {
    console.warn("[GUARD][readOnly] exception:", requestId ? `rid=${requestId}` : "", e?.message || String(e));
    return { ok: null, reason: "exception" };
  }
}

const { analyzeWord } = require('../services/analyzeWord');
const { analyzeSentence } = require('../services/analyzeSentence'); // 先保留引用（未使用）
const { AppError } = require('../utils/errorHandler');
const { detectMode } = require('../core/languageRules');
const { logUsage } = require('../utils/usageLogger');

/**
 * 功能初始化狀態（Production 排查）
 * - 注意：此狀態只用於觀測，不改變既有邏輯
 */
const INIT_STATUS = {
  module: "analyzeRoute",
  createdAt: new Date().toISOString(),
  ready: true,
  lastError: null,
  runtime: {
    lastCalledAt: null,
    lastText: null,
    lastExplainLang: null,
    // ✅ 2026-01-05：POS override runtime
    lastTargetPosKey: null,
    lastQueryMode: null,
    // ✅ 2026-01-05：用量歸戶 runtime
    lastUserId: null,
    lastEmail: null,
    lastRequestId: null,
    // ✅ 2026-01-07：Guard runtime（只讀不擋）
    lastGuardOk: null,
    lastGuardReason: null,
  },
  features: {
    // ✅ 2026-01-05：支援指定詞性（僅透傳）
    supportTargetPosKey: true,
    // ✅ 2026-01-05：用量歸戶透傳（lookup 記帳）
    supportUsageAttributionOptions: true,
    // ✅ 2026-01-07：Guard(只讀不擋)
    supportGuardReadOnly: true,
  },
};

// 判斷是否「像句子」
function looksLikeSentence(input) {
  const s = (input || '').trim();
  if (!s) return false;
  return /[.!?;:]/.test(s);
}

function detectNonSentenceLookupMode(input) {
  const s = (input || '').trim();
  if (!s) return 'word';

  const hasSpace = /\s/.test(s);
  if (!hasSpace && detectMode(s) === 'word') return 'word';
  return 'phrase';
}

// 嘗試從 Authorization Bearer token 解析出 user（不強制登入）
// 規則：
// 1) 有 SUPABASE_JWT_SECRET → 先 verify
// 2) verify 失敗或沒 secret → fallback 用 decode（只用來記錄用量）
function tryGetAuthUser(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  // ① 優先嘗試 verify
  if (process.env.SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      return {
        id: decoded.sub || "",
        email: decoded.email || "",
        source: "verify",
      };
    } catch (e) {
      console.warn(
        "[tryGetAuthUser] jwt.verify failed, fallback to decode"
      );
    }
  }

  // ② fallback：decode（不驗證，只做用量歸戶）
  try {
    const decoded = jwt.decode(token);
    if (!decoded) return null;

    return {
      id: decoded.sub || "",
      email: decoded.email || "",
      source: "decode",
    };
  } catch {
    return null;
  }
}

/**
 * ✅ 2026-01-05（新增）
 * 中文功能說明：
 * - 取得 requestId（用於用量記帳 trace，不影響功能）
 * - 優先順序：x-request-id → x-vercel-id → cf-ray → x-amzn-trace-id
 */
function getRequestId(req) {
  try {
    const h = req.headers || {};
    const rid =
      String(h["x-request-id"] || "").trim() ||
      String(h["x-vercel-id"] || "").trim() ||
      String(h["cf-ray"] || "").trim() ||
      String(h["x-amzn-trace-id"] || "").trim();
    return rid || "";
  } catch (e) {
    return "";
  }
}

/**
 * 中文功能說明：
 * - ✅ Step 2（2026-01-05）：支援 targetPosKey
 * - 用途：
 *   - 讓前端（或 Postman）可以指定「想要用哪個詞性」再次查詢
 *   - 目前僅透傳 options.targetPosKey 給 analyzeWord（先打通機制，不改 UI）
 * - 備註：
 *   - 本階段仍保留既有 explainLang fallback / lookupMode 判斷邏輯
 */
router.post('/', async (req, res, next) => {
  try {
    // ✅ 2026-01-05：新增 targetPosKey（僅透傳）
    const { text, explainLang, targetPosKey } = req.body;

    if (!text || typeof text !== 'string') {
      throw new AppError('請提供要分析的文字 text（字串）', 400);
    }

    const trimmed = text.trim();
    if (!trimmed) return res.json({ error: 'empty_input' });

    INIT_STATUS.runtime.lastCalledAt = new Date().toISOString();
    INIT_STATUS.runtime.lastText = trimmed;
    INIT_STATUS.runtime.lastExplainLang = explainLang || null;
    INIT_STATUS.runtime.lastTargetPosKey = (typeof targetPosKey === "string" ? targetPosKey.trim() : null) || null;

    const authUser = tryGetAuthUser(req);

    // ✅ 2026-01-05：用量歸戶 runtime（Production 排查）
    const requestId = getRequestId(req);
    INIT_STATUS.runtime.lastUserId = authUser?.id || null;
    INIT_STATUS.runtime.lastEmail = authUser?.email || null;
    INIT_STATUS.runtime.lastRequestId = requestId || null;

    // ✅ 2026-01-07：Guard(只讀不擋) - 進 LLM 前做觀測
    // - 本階段不阻擋，不改現有行為
    // - 估算：先用 0 觀測「目前用量/上限/是否已超」
    const guardRow = await guardCanConsumeReadOnly({
      userId: authUser?.id || "",
      estAddCompletionTokens: 0,
      estAddTtsChars: 0,
      requestId: requestId || "",
      endpoint: "/api/analyze",
    });
    INIT_STATUS.runtime.lastGuardOk = (guardRow && typeof guardRow.ok === "boolean") ? guardRow.ok : null;
    INIT_STATUS.runtime.lastGuardReason = (guardRow && guardRow.reason) ? String(guardRow.reason) : null;

    // 記錄本次 /api/analyze 呼叫的粗略用量
    logUsage({
      endpoint: '/api/analyze',
      charCount: trimmed.length,
      kind: 'llm',
      ip: req.ip,
      userId: authUser?.id || "",
      email: authUser?.email || "",
    });

    const options = {
      explainLang: explainLang || 'zh-TW',
    };

    // ✅ 2026-01-05：Step 2-3（用量歸戶打通）
    // - 目的：讓 dictionaryLookup / usageLogger 能拿到 userId → profiles 記帳
    // - 向下相容：即使沒登入（userId 空字串），也不影響查字功能
    options.userId = authUser?.id || "";
    options.email = authUser?.email || "";
    options.ip = req.ip || "";
    options.endpoint = "/api/analyze";
    options.requestId = requestId || "";

    // ✅ 2026-01-05：Step 2：透傳 targetPosKey（不影響既有流程）
    // - 只在 targetPosKey 是非空字串時才帶入
    if (typeof targetPosKey === "string" && targetPosKey.trim()) {
      options.targetPosKey = targetPosKey.trim();
    }

    if (looksLikeSentence(trimmed)) {
      throw new AppError(
        '目前只支援「單字 / 片語 / 慣用語」（非句子）。若要分析句子，之後會在輸入匡加入「句子模式」選擇。',
        400
      );
    }

    const lookupMode = detectNonSentenceLookupMode(trimmed);
    options.queryMode = lookupMode;
    INIT_STATUS.runtime.lastQueryMode = lookupMode;

    // ✅ runtime console（Production 排查）
    console.log("[analyzeRoute][request]", {
      text: trimmed,
      queryMode: lookupMode,
      explainLang: options.explainLang,
      hasTargetPosKey: Boolean(options.targetPosKey),
      targetPosKey: options.targetPosKey || null,
      userId: authUser?.id || "",
      email: authUser?.email || "",
      // ✅ 2026-01-05：用量歸戶 trace
      requestId: options.requestId || "",
      // ✅ 2026-01-07：Guard(只讀不擋) trace
      guard_ok: (guardRow && typeof guardRow.ok === "boolean") ? guardRow.ok : null,
      guard_reason: (guardRow && guardRow.reason) ? guardRow.reason : null,
    });

    const result = await analyzeWord(trimmed, options);

    // ✅ runtime console（Production 排查）
    console.log("[analyzeRoute][response]", {
      text: trimmed,
      queryMode: lookupMode,
      targetPosKey: options.targetPosKey || null,
      // 盡量不依賴 result 結構細節，只取常見欄位
      dictionaryPos: result && result.dictionary ? (result.dictionary.canonicalPos || result.dictionary.partOfSpeech || null) : null,
      hasPosOptions: Boolean(result && result.dictionary && Array.isArray(result.dictionary.posOptions)),
      posOptionsLen: result && result.dictionary && Array.isArray(result.dictionary.posOptions) ? result.dictionary.posOptions.length : 0,
      // ✅ 2026-01-05：用量歸戶 trace
      requestId: options.requestId || "",
      userId: options.userId || "",
    });

    res.json(result);
  } catch (err) {
    INIT_STATUS.lastError = String(err && (err.stack || err.message) ? (err.stack || err.message) : err);
    next(err);
  }
});

module.exports = router;

// backend/src/routes/analyzeRoute.js
