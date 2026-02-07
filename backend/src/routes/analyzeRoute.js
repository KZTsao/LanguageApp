// backend/src/routes/analyzeRoute.js
// ===== FILE: backend/src/routes/analyzeRoute.js =====
// PATH: backend/src/routes/analyzeRoute.js
// backend/src/routes/analyzeRoute.js
/**
 * 文件說明：
 * - 功能：/api/analyze 路由入口，負責：
 *   - 讀取 req.body 參數
 *   - 分流 word | phrase | sentence（sentence 僅能由 Task2 classifier 判定）
 *   - 組 options 並呼叫 analyzeWord / analyzeSentence
 *   - 記錄粗略用量 logUsage + usage events
 *
 * 異動紀錄：
 * - 2026-01-05：✅ Step 2（POS 可切換機制）：新增 targetPosKey 參數（僅透傳到 analyzeWord，不改既有 UI 行為）
 * - 2026-01-05：✅ Step 2-3（用量歸戶打通）：將 userId/email/ip/endpoint/requestId 透傳到 analyzeWord options（供 lookup 記帳）
 * - 2026-01-07：✅ Step Guard(只讀不擋)：在進入 analyzeWord 前呼叫 can_consume_usage（僅 console 觀測，不阻擋）
 * - 2026-01-07：✅ Fix Guard RPC keys：對齊 DB function args：p_add_llm_completion_tokens / p_add_tts_chars
 * - 2026-01-11：✅ Step Set Seen（最小閉環）：/api/analyze 成功後，寫入 user_learning_progress（seen/touch，不覆蓋 familiar）
 * - 2026-01-29：✅ Task3 /api/analyze 分流重構（串接 Task1 + Task2）
 *   - detectMode(text) => word | phrase | uncertain
 *   - word/phrase => analyzeWord
 *   - uncertain => classifySentence(text)（Task2）=> sentence => analyzeSentence；phrase => analyzeWord(phrase)
 *   - route 不得自行猜 sentence（sentence 只能由 classifier 判定）
 */

const express = require("express");

const { buildPronunciationTipsPrompt } = require("../prompts/pronunciationTips.prompt");let __groqClient = null;
function getGroqClient() {
  if (__groqClient) return __groqClient;
  __groqClient = require("../clients/groqClient");
  return __groqClient;
}
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
 */
async function guardCanConsumeReadOnly({
  userId,
  estAddCompletionTokens,
  estAddTtsChars,
  requestId,
  endpoint,
}) {
  try {
    const supa = getSupabaseGuardClient();
    if (!supa) {
      console.warn(
        "[GUARD][readOnly] skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
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
      p_add_llm_completion_tokens:
        typeof estAddCompletionTokens === "number" ? estAddCompletionTokens : 0,
      p_add_tts_chars: typeof estAddTtsChars === "number" ? estAddTtsChars : 0,
    };

    const { data, error } = await supa.rpc("can_consume_usage", payload);

    if (error) {
      console.warn(
        "[GUARD][readOnly] rpc failed:",
        requestId ? `rid=${requestId}` : "",
        error.message || String(error)
      );
      return { ok: null, reason: "rpc_failed", error };
    }

    // data 可能是 object 或 array（視 RPC 實作），這裡都兼容
    const row = Array.isArray(data) ? data[0] || null : data || null;

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
    console.warn(
      "[GUARD][readOnly] exception:",
      requestId ? `rid=${requestId}` : "",
      e?.message || String(e)
    );
    return { ok: null, reason: "exception" };
  }
}

/**
 * ✅ 2026-01-11：Set Seen（最小閉環）
 * 中文功能說明：
 * - 目的：在 /api/analyze 成功後，記錄「user 已接觸此 item」（seen）
 * - 表：public.user_learning_progress
 * - 原則：
 *   - 不覆蓋 familiar（避免 user 已熟悉被寫回 false）
 *   - 不影響主流程：任何錯誤只 console.warn
 */
async function touchUserLearningProgressSeen({
  userId,
  itemType,
  itemRef,
  requestId,
  endpoint,
}) {
  try {
    const supa = getSupabaseGuardClient();
    if (!supa) {
      console.warn(
        "[LEARN][seen] skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
      return { ok: null, reason: "missing_env" };
    }
    if (!userId) {
      return { ok: null, reason: "missing_userId" };
    }

    const ref = (itemRef || "").trim();
    const type = (itemType || "").trim();
    if (!ref || !type) return { ok: null, reason: "missing_item" };

    // ① 先確保 row 存在：用 upsert + ignoreDuplicates 避免覆蓋 familiar
    const upsertPayload = {
      auth_user_id: userId,
      item_type: type,
      item_ref: ref,
    };

    const { error: upsertErr } = await supa
      .from("user_learning_progress")
      .upsert(upsertPayload, {
        onConflict: "auth_user_id,item_type,item_ref",
        ignoreDuplicates: true,
      });

    if (upsertErr) {
      console.warn(
        "[LEARN][seen] upsert failed:",
        requestId ? `rid=${requestId}` : "",
        upsertErr.message || String(upsertErr)
      );
      return { ok: null, reason: "upsert_failed", error: upsertErr };
    }

    // ② 觸發 updated_at（seen touch）：只更新 updated_at，不動 familiar
    const { error: touchErr } = await supa
      .from("user_learning_progress")
      .update({ updated_at: new Date().toISOString() })
      .eq("auth_user_id", userId)
      .eq("item_type", type)
      .eq("item_ref", ref);

    if (touchErr) {
      console.warn(
        "[LEARN][seen] touch failed:",
        requestId ? `rid=${requestId}` : "",
        touchErr.message || String(touchErr)
      );
      return { ok: null, reason: "touch_failed", error: touchErr };
    }

    console.log("[LEARN][seen] ok", {
      endpoint: endpoint || "",
      requestId: requestId || "",
      userId,
      item_type: type,
      item_ref: ref,
    });

    return { ok: true };
  } catch (e) {
    console.warn(
      "[LEARN][seen] exception:",
      requestId ? `rid=${requestId}` : "",
      e?.message || String(e)
    );
    return { ok: null, reason: "exception" };
  }
}

const { analyzeWord } = require("../services/analyzeWord");
const { analyzeSentence } = require("../services/analyzeSentence");

// ✅ Phrase canonicalization (LLM) — only for lookupMode === "phrase"
let normalizePhrase = null;
try {
  ({ normalizePhrase } = require("../services/normalizePhrase"));
} catch (e) {
  normalizePhrase = null;
}


// ✅ Task1: detectMode(text) => word | phrase | uncertain
const { detectMode } = require("../core/languageRules");

// ✅ Task2: classifySentence(text) => { mode: "sentence" | "phrase", ... }
const { classifySentence } = require("../services/classifySentence");

const { AppError } = require("../utils/errorHandler");
const { logUsage } = require("../utils/usageLogger");
const { commitUsageEventSafe, commitLlmTokensSafe, commitQueryCountSafe } = require("../utils/usageIO");

// ======================================
// ✅ Anonymous daily query limit
// - Enforced server-side (hard limit)
// - Identity: logged-in userId OR anonId from header x-visit-id
// - Limit: 10 / day
// ======================================
const ANON_DAILY_QUERY_LIMIT = 10;

function __isUuidLike(v) {
  try {
    const s = String(v || "").trim();
    if (!s) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
  } catch {
    return false;
  }
}

function __getTodayDateStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function __getAnonIdFromReq(req) {
  try {
    const h = req?.headers || {};
    const v = String(h["x-visit-id"] || h["x-visitor-id"] || h["x-anon-id"] || "").trim();
    return v;
  } catch {
    return "";
  }
}

async function __getDailyQueryCountByUserId({ userId }) {
  try {
    if (!userId) return 0;
    const supa = getSupabaseGuardClient();
    if (!supa) return 0;
    const day = __getTodayDateStr();
    const { data, error } = await supa
      .from("usage_daily")
      .select("query_count")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle();
    if (error) return 0;
    return Number(data?.query_count || 0) || 0;
  } catch {
    return 0;
  }
}

// =========================
// [normal] trace helper (dev)
// - Enable: DEBUG_NORMALIZE_TRACE=1
// - Optional: DEBUG_NORMALIZE_TRACE_TEXT=1 (prints text/rawText/lookupText)
// =========================
function __nlog(event, payload) {
  try {
    const on =
      typeof process !== "undefined" &&
      process?.env?.DEBUG_NORMALIZE_TRACE === "1";
    if (!on) return;

    const textOn =
      typeof process !== "undefined" &&
      process?.env?.DEBUG_NORMALIZE_TRACE_TEXT === "1";

    const safePayload =
      payload && typeof payload === "object"
        ? { ...payload }
        : payload || {};

    if (safePayload && typeof safePayload === "object" && !textOn) {
      if ("text" in safePayload) delete safePayload.text;
      if ("rawText" in safePayload) delete safePayload.rawText;
      if ("lookupText" in safePayload) delete safePayload.lookupText;
      if ("trimmed" in safePayload) delete safePayload.trimmed;
    }

    console.info("[normal]", "analyzeRoute", event, safePayload);
  } catch (e) {
    // silent
  }
}


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
    // ✅ 2026-01-11：Set Seen runtime
    lastSeenOk: null,
    lastSeenReason: null,
    lastSeenItemType: null,
    lastSeenItemRef: null,
  },
  features: {
    supportTargetPosKey: true,
    supportUsageAttributionOptions: true,
    supportGuardReadOnly: true,
    supportSetSeenTouch: true,
  },
};

// 嘗試從 Authorization Bearer token 解析出 user（不強制登入）
function tryGetAuthUser(req) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
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
      console.warn("[tryGetAuthUser] jwt.verify failed, fallback to decode");
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
 * - 取得 requestId（用於用量記帳 trace，不影響功能）
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
 * ✅ 2026-01-25：Usage Event（完成交易才算）
 * - token 欄位會嘗試從 result 的常見位置抽取；抽不到就記 0
 */
function extractLlmTokensFromResult(result) {
  try {
    if (!result || typeof result !== "object") {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        provider: "",
        model: "",
      };
    }

    const usage =
      result.usage ||
      (result.meta && result.meta.usage) ||
      (result.llm && result.llm.usage) ||
      result.llmUsage ||
      (result.data && result.data.usage) ||
      null;

    const promptTokens =
      Number(
        usage?.prompt_tokens ??
          usage?.promptTokens ??
          result.prompt_tokens ??
          result.promptTokens ??
          0
      ) || 0;

    const completionTokens =
      Number(
        usage?.completion_tokens ??
          usage?.completionTokens ??
          result.completion_tokens ??
          result.completionTokens ??
          0
      ) || 0;

    const totalTokens =
      Number(
        usage?.total_tokens ??
          usage?.totalTokens ??
          result.total_tokens ??
          result.totalTokens ??
          0
      ) ||
      (promptTokens + completionTokens) ||
      0;

    const provider =
      String(
        result.provider ||
          result.llmProvider ||
          result.meta?.provider ||
          usage?.provider ||
          ""
      ) || "";

    const model =
      String(
        result.model || result.llmModel || result.meta?.model || usage?.model || ""
      ) || "";

    return { promptTokens, completionTokens, totalTokens, provider, model };
  } catch (e) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      provider: "",
      model: "",
    };
  }
}

/**
 * ✅ Task3：sanitize(text)
 * - 保守 normalize：trim + collapse spaces
 * - 不做白名單/硬編詞表
 */
function sanitizeInputText(input) {
  const s = String(input || "");
  return s.replace(/\s+/g, " ").trim();
}

router.post("/", async (req, res, next) => {
  try {
    // ✅ 維持既有 input schema，不破壞 consumer：text 必填；rawText/explainLang/其他 options 沿用既有
    const body = req.body || {};
    const { text, rawText, explainLang, targetPosKey, ...restOptions } = body;

    // ✅ rawInput：rawText ?? text（顯示用）
    const rawInput =
      rawText != null && typeof rawText === "string" ? rawText.trim() : null;

    if (!text || typeof text !== "string") {
      throw new AppError("請提供要分析的文字 text（字串）", 400);
    }

    const trimmed = sanitizeInputText(text);
    const rawInputFinal = rawInput && rawInput.trim() ? rawInput.trim() : trimmed;
    if (!trimmed) return res.json({ error: "empty_input" });

    INIT_STATUS.runtime.lastCalledAt = new Date().toISOString();
    INIT_STATUS.runtime.lastText = trimmed;
    INIT_STATUS.runtime.lastRawInput = rawInputFinal;
    INIT_STATUS.runtime.lastExplainLang = explainLang || null;
    INIT_STATUS.runtime.lastTargetPosKey =
      (typeof targetPosKey === "string" ? targetPosKey.trim() : null) || null;

    const authUser = tryGetAuthUser(req);

    // ✅ 用量歸戶 runtime（Production 排查）
    const requestId = getRequestId(req);

    // ======================================
    // ✅ Anonymous daily query limit (10/day)
    // - If not logged in, require x-visit-id header (uuid)
    // - Hard limit enforced BEFORE any expensive work
    // ======================================
    const anonId = !authUser?.id ? __getAnonIdFromReq(req) : "";
    // NOTE: anonymous quota key: prefer client-provided visit id; if missing, fall back to a shared bucket
    const anonUsageUserId = !authUser?.id
      ? (String(anonId || "").trim() || "__anon__")
      : "";

    if (!authUser?.id) {
      const todayCount = await __getDailyQueryCountByUserId({ userId: anonUsageUserId });
      if (todayCount >= ANON_DAILY_QUERY_LIMIT) {
        return res.status(429).json({ error: "ANON_DAILY_LIMIT_REACHED" });
      }
    }

    __nlog("request:start", {
      text: trimmed,
      rawText: rawInputFinal,
      requestId: requestId || "",
      hasUser: Boolean(authUser && authUser.id),
    });
    INIT_STATUS.runtime.lastUserId = authUser?.id || null;
    INIT_STATUS.runtime.lastEmail = authUser?.email || null;
    INIT_STATUS.runtime.lastRequestId = requestId || null;

    // ✅ Guard(只讀不擋) - 進 LLM 前做觀測
    const guardRow = await guardCanConsumeReadOnly({
      userId: authUser?.id || "",
      estAddCompletionTokens: 0,
      estAddTtsChars: 0,
      requestId: requestId || "",
      endpoint: "/api/analyze",
    });
    INIT_STATUS.runtime.lastGuardOk =
      guardRow && typeof guardRow.ok === "boolean" ? guardRow.ok : null;
    INIT_STATUS.runtime.lastGuardReason =
      guardRow && guardRow.reason ? String(guardRow.reason) : null;

    // 記錄本次 /api/analyze 呼叫的粗略用量
    logUsage({
      endpoint: "/api/analyze",
      charCount: trimmed.length,
      kind: "llm",
      ip: req.ip,
      userId: authUser?.id || "",
      email: authUser?.email || "",
    });

    // ✅ options：保留既有 options（case/articleType/sentenceType...等）透傳
    // - 注意：後面會覆蓋/補齊內部欄位，避免被外部覆寫
    const options = {
      ...restOptions,
      explainLang: explainLang || "zh-TW",
      rawInput: rawInputFinal,
    };

    // ✅ 用量歸戶打通（lookup 記帳）
    options.userId = authUser?.id || anonUsageUserId || "";
    options.email = authUser?.email || "";
    options.ip = req.ip || "";
    options.endpoint = "/api/analyze";
    options.requestId = requestId || "";

    // ✅ 透傳 targetPosKey（不影響既有流程）
    if (typeof targetPosKey === "string" && targetPosKey.trim()) {
      options.targetPosKey = targetPosKey.trim();
    }

    // ============================================================
    // ✅ Task3：分流主流程（固定順序）
    // - detectMode(trimmed) => word | phrase | uncertain
    // - word/phrase => analyzeWord
    // - uncertain => classifySentence(trimmed) => sentence => analyzeSentence；phrase => analyzeWord(phrase)
    // - route 不得自行猜 sentence
    // ============================================================

    // ✅ lookupMode：保證一定被定義（後面 log/usage/response 都會用到）
    let lookupMode = "phrase"; // 保守預設

    const detected = (() => {
      try {
        const m = detectMode(trimmed);
        return m === "word" || m === "phrase" || m === "uncertain" ? m : "uncertain";
      } catch (e) {
        return "uncertain";
      }
    })();

    __nlog("detectMode:done", { detected, text: trimmed, requestId: options.requestId || "" });


    async function commitUsageAfterSuccess(result, finalMode) {
      try {
        const t = extractLlmTokensFromResult(result);

        // ✅ For anonymous users, use anonUsageUserId (x-visit-id) as usage key.
        const usageUserId = options.userId || anonUsageUserId || "";

        await commitUsageEventSafe({
          userId: usageUserId,
          email: options.email || "",
          ip: options.ip || req.ip || "",
          endpoint: options.endpoint || "/api/analyze",
          path: req.originalUrl || req.path || "/api/analyze",
          requestId: options.requestId || "",
          eventType: "llm",
          kind: "llm",
          provider: t.provider || "",
          model: t.model || "",
          llmInTokens: t.promptTokens || 0,
          llmOutTokens: t.completionTokens || 0,
          llmTotalTokens: t.totalTokens || 0,
          promptTokens: t.promptTokens || 0,
          completionTokens: t.completionTokens || 0,
          totalTokens: t.totalTokens || 0,
          ttsChars: 0,
          source: authUser?.source || "",
          // 不新增 schema：此處只記 usage_events 既有欄位
        });

        // ✅ LLM tokens 主帳本（daily/monthly）— 完成交易才算
        await commitLlmTokensSafe({
          userId: usageUserId,
          email: options.email || "",
          requestId: options.requestId || "",
          promptTokens: t.promptTokens || 0,
          completionTokens: t.completionTokens || 0,
          totalTokens: t.totalTokens || 0,
          endpoint: options.endpoint || "/api/analyze",
          path: req.originalUrl || req.path || "",
          provider: t.provider || "",
          model: t.model || "",
          ip: options.ip || req.ip || "",
          kind: "analyze",
          // 保留 finalMode 僅供未來 debug（不寫入 DB schema）
          _mode: finalMode || "",
        });

        // ✅ 主帳本：查詢次數（完成交易才算）
        await commitQueryCountSafe({ userId: usageUserId, inc: 1 });
      } catch (e) {
        console.warn(
          "[usage][commit][analyze] failed:",
          options.requestId ? `rid=${options.requestId}` : "",
          e?.message || String(e)
        );
      }
    }

    async function analyzeWordFlow(effectiveLookupMode) {
      // ✅ variables for phrase canonicalization flow
      let lookupText = trimmed;
      let phraseCanonicalAdopted = null;

      // ✅ predeclare to avoid TDZ (used by trace/log)
      lookupMode = effectiveLookupMode === "word" ? "word" : "phrase";
      options.queryMode = lookupMode;
      INIT_STATUS.runtime.lastQueryMode = lookupMode;

      console.log("[analyzeRoute][request][word/phrase]", {
        text: trimmed,
        queryMode: lookupMode,
        explainLang: options.explainLang,
        hasTargetPosKey: Boolean(options.targetPosKey),
        targetPosKey: options.targetPosKey || null,
        userId: options.userId || "",
        email: options.email || "",
        requestId: options.requestId || "",
        guard_ok:
          guardRow && typeof guardRow.ok === "boolean" ? guardRow.ok : null,
        guard_reason: guardRow && guardRow.reason ? guardRow.reason : null,
      });

    __nlog("branch", { use: "analyzeWord" });
      __nlog("analyzeWord:call", { lookupMode, text: lookupText, targetPosKey: options.targetPosKey || null, requestId: options.requestId || "" });

      
      // ============================================================
      // ✅ phrase → normalizePhrase → analyzeWord (mainline)
      // - only when lookupMode === "phrase"
      // - adopt when confidence >= 0.6 and canonical is non-empty
      // - any failure => fallback (no behavior regression)
      // ============================================================
      if (lookupMode === "phrase" && typeof normalizePhrase === "function") {
        const __TRACE_TEXT =
          typeof process !== "undefined" &&
          process?.env?.DEBUG_NORMALIZE_TRACE_TEXT === "1";

        __nlog("normalizePhrase:start", {
          text: __TRACE_TEXT ? trimmed : undefined,
          requestId: options.requestId || "",
        });

        try {
          const norm = await normalizePhrase(trimmed, { requestId: options.requestId || "" });
          const canonical = String(norm && norm.canonical ? norm.canonical : "").trim();
          const confidence = typeof (norm && norm.confidence) === "number" ? norm.confidence : null;

          __nlog("normalizePhrase:done", {
            canonical: canonical || null,
            confidence,
            reason: norm && norm.reason ? norm.reason : null,
          });

          if (canonical && typeof confidence === "number" && confidence >= 0.6) {
            lookupText = canonical;
            phraseCanonicalAdopted = canonical;
            __nlog("normalizePhrase:adopt", {
              lookupText: __TRACE_TEXT ? lookupText : undefined,
              confidence,
            });
          } else {
            __nlog("normalizePhrase:skip", {
              why: canonical ? "low_confidence" : "no_canonical",
              confidence,
            });
          }
        } catch (e) {
          __nlog("normalizePhrase:error", { message: e?.message || String(e) });
        }
      } else {
        __nlog("normalizePhrase:skip", {
          why: lookupMode !== "phrase" ? "not_phrase" : "missing_impl",
        });
      }

const result = await analyzeWord(lookupText, options);
      
      // ✅ phrase canonical adopted: sync canonical/headword for UI (WordCard)
      // - do NOT change analysis logic; only align output fields for display
      if (lookupMode === "phrase" && phraseCanonicalAdopted) {
        try {
          if (!result || typeof result !== "object") {
            // no-op
          } else {
            if (!result.query || typeof result.query !== "object") result.query = {};
            if (!result.query.canonical) result.query.canonical = phraseCanonicalAdopted;
            if (!result.query.rawInput) result.query.rawInput = rawInputFinal;
            // Some UI reads headword directly
            if (!result.headword) result.headword = phraseCanonicalAdopted;
          }
        } catch (e) {
          // silent
        }
      }
__nlog("analyzeWord:done", { lookupMode, normalizedQuery: (result && result.query && result.query.canonical) || (result && result.normalizedQuery) || null, requestId: options.requestId || "" });


      // ✅ Set Seen（最小閉環）— 只在 analyzeWord 成功後 touch
      const seenItemType = lookupMode === "word" ? "headword" : "phrase";
      let shouldTouchSeen = false;
      try {
        const hasDict =
          Boolean(result && result.dictionary) ||
          Boolean(result && result.ok === true) ||
          Boolean(result && result.data && result.data.dictionary) ||
          Boolean(result && result.entryId) ||
          Boolean(result && result.headword) ||
          Boolean(result && result.lemma);
        shouldTouchSeen = Boolean(result) && hasDict;
      } catch (e) {
        shouldTouchSeen = Boolean(result);
      }

      if (shouldTouchSeen) {
        const seenRow = await touchUserLearningProgressSeen({
          userId: options.userId || "",
          itemType: seenItemType,
          itemRef: lookupText,
          requestId: options.requestId || "",
          endpoint: options.endpoint || "/api/analyze",
        });
        INIT_STATUS.runtime.lastSeenOk =
          seenRow && typeof seenRow.ok === "boolean" ? seenRow.ok : null;
        INIT_STATUS.runtime.lastSeenReason =
          seenRow && seenRow.reason ? String(seenRow.reason) : null;
        INIT_STATUS.runtime.lastSeenItemType = seenItemType;
        INIT_STATUS.runtime.lastSeenItemRef = lookupText;
      } else {
        INIT_STATUS.runtime.lastSeenOk = null;
        INIT_STATUS.runtime.lastSeenReason = "skipped_not_success";
        INIT_STATUS.runtime.lastSeenItemType = seenItemType;
        INIT_STATUS.runtime.lastSeenItemRef = lookupText;
      }

      console.log("[analyzeRoute][response][word/phrase]", {
        text: trimmed,
        queryMode: lookupMode,
        targetPosKey: options.targetPosKey || null,
        dictionaryPos: result && result.dictionary
          ? result.dictionary.canonicalPos || result.dictionary.partOfSpeech || null
          : null,
        hasPosOptions: Boolean(
          result && result.dictionary && Array.isArray(result.dictionary.posOptions)
        ),
        posOptionsLen:
          result && result.dictionary && Array.isArray(result.dictionary.posOptions)
            ? result.dictionary.posOptions.length
            : 0,
        requestId: options.requestId || "",
        userId: options.userId || "",
        seen_ok: INIT_STATUS.runtime.lastSeenOk,
        seen_reason: INIT_STATUS.runtime.lastSeenReason,
        seen_item_type: INIT_STATUS.runtime.lastSeenItemType,
        seen_item_ref: INIT_STATUS.runtime.lastSeenItemRef,
      });

      try {
        await commitUsageAfterSuccess(result, lookupMode);
      } catch (e) {
        console.warn("[analyzeRoute][usage] commitUsageAfterSuccess failed (ignored):", e?.message || String(e));
      }

      // ✅ normalizedQuery：
      // - phrase：若 Groq 規整過（adopt），就強制用 adopted 的 canonical（避免被 analyzeWord 的 normalizedQuery 覆蓋）
      // - 其他：優先 analyzeWord canonical → analyzeWord normalizedQuery → fallback trimmed
      const normalizedQueryOut =
        lookupMode === "phrase" && phraseCanonicalAdopted
          ? String(phraseCanonicalAdopted).trim()
          : String(
              (result && result.query && result.query.canonical) ||
                (result && result.normalizedQuery) ||
                ""
            ).trim() || trimmed;

      // ✅ Output schema：補齊 mode/kind + rawInput + normalizedQuery（不破壞既有 consumer）
      return res.json({
        ...result,
        mode: result && result.mode ? result.mode : lookupMode,
        kind: result && result.kind ? result.kind : lookupMode,
        rawInput: rawInputFinal,
        normalizedQuery: normalizedQueryOut,
      });
    }

    async function analyzeSentenceFlow() {
      lookupMode = "sentence";
      INIT_STATUS.runtime.lastQueryMode = "sentence";

      console.log("[analyzeRoute][request][sentence]", {
        text: trimmed,
        explainLang: options.explainLang,
        hasTargetPosKey: Boolean(options.targetPosKey),
        targetPosKey: options.targetPosKey || null,
        userId: options.userId || "",
        email: options.email || "",
        requestId: options.requestId || "",
        guard_ok:
          guardRow && typeof guardRow.ok === "boolean" ? guardRow.ok : null,
        guard_reason: guardRow && guardRow.reason ? guardRow.reason : null,
      });

      let sentenceResult = null;
      try {
      __nlog("analyzeSentence:call", { text: trimmed, requestId: options.requestId || "" });

        sentenceResult = await analyzeSentence(trimmed, options);
      __nlog("analyzeSentence:done", { ok: Boolean(sentenceResult), requestId: options.requestId || "" });

      } catch (e) {
        // ✅ 規格：analyzeSentence 失敗 → fallback 回 analyzeWord（phrase）或回錯誤（保持一致）
        console.warn(
          "[analyzeRoute][sentence] analyzeSentence failed, fallback to phrase:",
          options.requestId ? `rid=${options.requestId}` : "",
          e?.message || String(e)
        );
        return await analyzeWordFlow("phrase");
      }

      try {
        await commitUsageAfterSuccess(sentenceResult, "sentence");
      } catch (e) {
        console.warn("[analyzeRoute][usage] commitUsageAfterSuccess failed (ignored):", e?.message || String(e));
      }

      // ✅ sentence 流程不得產生 WordCard 顯示副作用：必須回 mode/kind === sentence
      return res.json({
        ...sentenceResult,
        mode: sentenceResult && sentenceResult.mode ? sentenceResult.mode : "sentence",
        kind: sentenceResult && sentenceResult.kind ? sentenceResult.kind : "sentence",
        rawInput: rawInputFinal,
        normalizedQuery: trimmed,
      });
    }

    // ===== 分流主流程（固定順序）=====
    if (detected === "word" || detected === "phrase") {
      __nlog("route:branch", { from: "detectMode", to: "analyzeWordFlow", detected, requestId: options.requestId || "" });
      // 規則：word → lookupMode=word；phrase → lookupMode=phrase
      return await analyzeWordFlow(detected);
    }

    // detected === "uncertain"
    // 規格：route 不得自行猜 sentence，只能靠 Task2 classifier
    let clsMode = "phrase"; // ✅ classifier 故障時：保守當 phrase
    try {
      const cls = await classifySentence(trimmed, { requestId: options.requestId || "" });
      
    __nlog("classifySentence", { cls });
if (cls && cls.mode === "sentence") clsMode = "sentence";
      else clsMode = "phrase";
    } catch (e) {
      console.warn(
        "[analyzeRoute][classifier] classifySentence failed, fallback to phrase:",
        options.requestId ? `rid=${options.requestId}` : "",
        e?.message || String(e)
      );
      clsMode = "phrase";
    }

    __nlog("route:branch", { from: "classifySentence", to: clsMode === "sentence" ? "analyzeSentenceFlow" : "analyzeWordFlow", clsMode, requestId: options.requestId || "" });

    if (clsMode === "sentence") {
      return await analyzeSentenceFlow();
    }

    // uncertain + classifier=phrase => analyzeWordFlow(trimmed, rawInput, "phrase")
    return await analyzeWordFlow("phrase");
  } catch (err) {
    INIT_STATUS.lastError = String(
      err && (err.stack || err.message) ? err.stack || err.message : err
    );
    // ✅ guard: avoid ERR_HTTP_HEADERS_SENT when response already sent
    if (res.headersSent) {
      console.warn("[analyzeRoute] headers already sent -> skip next(err)");
      return;
    }
    next(err);
  }
});

/**
 * ✅ 2026-02-06：Pronunciation tips (LLM) — word-level only
 * 路徑：POST /api/analyze/pronunciation-tips
 *
 * 輸入：
 * - tokens：token-level 判定資料（只用於挑選 focusTokens；不會傳給 LLM）
 * - uiLang / explainLang：決定回覆語言
 *
 * 行為：
 * - 從 tokens 選出最多 3 個 focusTokens（miss 優先；不足再用「非 miss 且非 hit」補，confidence 越低越優先）
 * - 若沒有 miss、也沒有「非 miss 且非 hit」：不呼叫 LLM，回 { tips: [], allGreen: true }
 * - 觀察期：不做任何後處理，直接回傳模型原始輸出（放在 tips[0]）
 *
 * 注意：
 * - 本 endpoint 不依賴 /api/speech（避免被 SPEECH_REQUIRE_AUTH 影響）
 */
router.post("/pronunciation-tips", async (req, res) => {
  try {
    // ===== debug: confirm route is hit & surface upstream failures =====
    try {
      res.set("X-PronTips-Route", "1");
      console.info("[HIT][analyzeRoute][/pronunciation-tips]", {
        hasAuth: Boolean(req?.headers?.authorization),
        uiLang: (req?.body?.uiLang || req?.body?.explainLang || "").toString(),
        tokensLen: Array.isArray(req?.body?.tokens) ? req.body.tokens.length : 0,
      });
    } catch (_) {}
    // ================================================================

    const body = req && req.body ? req.body : {};
    const tokens = Array.isArray(body.tokens) ? body.tokens : [];

    const uiLang = (body.uiLang || body.explainLang || "zh-TW").toString();
    const langLower = uiLang.toLowerCase();
    const replyLang =
      langLower.startsWith("zh-cn") ? "zh-CN" :
      langLower.startsWith("zh") ? "zh-TW" :
      langLower.startsWith("en") ? "en" :
      langLower.startsWith("de") ? "de" :
      langLower.startsWith("ar") ? "ar" :
      "zh-TW";

    const openaiKey = process.env.OPENAI_API_KEY || "";

    // Groq key detection: support GROQ_API_KEY and GROQ_API_KEY_1..N (rotation)
    const hasGroqKey = (() => {
      try {
        if (String(process.env.GROQ_API_KEY || "").trim()) return true;
        const keys = Object.keys(process.env || {});
        return keys.some((k) => /^GROQ_API_KEY_\d+$/.test(k) && String(process.env[k] || "").trim());
      } catch (e) {
        return false;
      }
    })();

    // ✅ provider selection:
    // - Prefer OpenAI if OPENAI_API_KEY is present
    // - Otherwise, use Groq via groqClient (same as dictionaryLookup)
    const provider = openaiKey ? "openai" : (hasGroqKey ? "groq" : "");

    if (!provider) {
      return res.json({ tips: [], error: "LLM_API_KEY_MISSING", need: ["OPENAI_API_KEY", "GROQ_API_KEY"] });
    }

    // ---- Build a compact token summary (for focusTokens selection only; NOT passed to LLM) ----
    const compactTokens = tokens
    .filter((t) => t && typeof t === "object")
    .slice(0, 200)
    .map((t) => {
      const tokenText = String(t.raw || t.norm || t.text || t.token || "").trim();
      return {
        text: tokenText,
        state: String(t.state || "").trim(),
        stateLower: String(t.state || "").trim().toLowerCase(),
        confidence:
          typeof t.confidence === "number"
            ? t.confidence
            : Number(t.confidence || 0) || 0,
      };
    })
    .filter((t) => t.text);
  

    // Determine focus tokens (max 3):
    // - miss (red) first
    // - then "shallow green": non-miss AND non-hit, sorted by lower confidence first
    const __isMiss = (t) => Boolean(t && t.stateLower && t.stateLower.includes("miss"));
    const __isHit = (t) => Boolean(t && t.stateLower && t.stateLower.includes("hit_high"));

    const missTokens = compactTokens
      .filter((t) => __isMiss(t))
      .sort((a, b) => (a.confidence || 0) - (b.confidence || 0));

    const shallowGreenTokens = compactTokens
      .filter((t) => !__isMiss(t) && !__isHit(t))
      .sort((a, b) => (a.confidence || 0) - (b.confidence || 0));

    const focusTokenObjs = [...missTokens, ...shallowGreenTokens].slice(0, 3);
    const focusTokens = focusTokenObjs.map((t) => t.text).filter(Boolean);

    // ✅ all-green short-circuit: if no miss and no shallow-green candidates -> no LLM
    if (focusTokens.length === 0) {
      return res.json({ tips: [], allGreen: true });
    }

    const { system: sys, user } = buildPronunciationTipsPrompt({
      uiLang: replyLang,
      focusTokens,
    });

    // ---- Call LLM (OpenAI preferred, Groq fallback) ----
    const openaiModel = process.env.OPENAI_PRON_TIPS_MODEL || "gpt-4o-mini";
    const groqModel = process.env.GROQ_PRON_TIPS_MODEL || "llama-3.1-8b-instant";

    let outText = "";

    if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: openaiModel,
          input: [
            { role: "system", content: [{ type: "text", text: sys }] },
            { role: "user", content: [{ type: "text", text: user }] },
          ],
          max_output_tokens: 260,
        }),
      });

      const __rawText = await resp.clone().text().catch(() => "");
      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data) {
        return res.json({
          tips: [],
          error: "OPENAI_FAILED",
          status: resp.status,
          detail: (data && (data.error || data.message)) || null,
          raw: __rawText ? __rawText.slice(0, 800) : null,
        });
      }

      // Extract text from responses API
      try {
        const output = Array.isArray(data.output) ? data.output : [];
        for (const item of output) {
          const content = Array.isArray(item.content) ? item.content : [];
          for (const c of content) {
            if (c && c.type === "output_text" && typeof c.text === "string") {
              outText += c.text;
            }
          }
        }
      } catch (e) {}
    } else {
      // Groq via groqClient (same as dictionaryLookup): key rotation + retry inside client
      const client = getGroqClient();
      try {
        const resp2 = await client.groqChatCompletion({
          model: groqModel,
          temperature: 0.2,
          max_tokens: 320,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
        });
        outText = String(resp2?.content || "");
      } catch (err) {
        const status = err?.status || err?.response?.status || err?.cause?.status || null;
        const detail =
          err?.error ||
          err?.message ||
          (err?.response && (err.response.error || err.response.message)) ||
          null;
        return res.json({ tips: [], error: "GROQ_FAILED", status, detail });
      }
    }

    // ✅ Observation phase: return raw model output (no post-processing / guardrails)
    const raw = String(outText || "").trim();
    return res.json({ tips: raw ? [raw] : [] });
  } catch (e) {
    try {
      console.error("[analyzeRoute][/pronunciation-tips] exception", {
        message: e?.message || String(e),
        stack: e?.stack || null,
      });
    } catch (_) {}
    return res.status(500).json({
      error: "PRON_TIPS_EXCEPTION",
      message: e?.message || String(e),
      stack: e?.stack || null,
    });
  }
});

module.exports = router;

// END PATH: backend/src/routes/analyzeRoute.js
// ===== END FILE: backend/src/routes/analyzeRoute.js =====

// backend/src/routes/analyzeRoute.js
