// PATH: backend/src/utils/usageIO.js
// backend/src/utils/usageIO.js
// FILE: backend/src/utils/usageIO.js
// backend/src/utils/usageIO.js
/**
 * 文件說明：
 * - 功能：共用用量記帳 IO（完成交易才算）
 * - 寫入表：
 *   - public.usage_events（明細）
 *   - public.usage_daily（今日聚合）
 *   - public.usage_monthly（本月聚合）
 *
 * 設計原則：
 * - 不影響主流程：任何錯誤只 console.warn，呼叫端可 await 也可不 await
 * - 向下相容：沿用既有表欄位（event_type 仍用 'llm' / 'tts' / 'visit'）
 * - requestId 可能不是 uuid：只有在格式正確時才寫入 request_id，否則寫 null
 */

let _supa = null;

// ======================================
// USAGE IO mode switches
// - Default: STRICT (RPC must succeed; no silent fallback)
// - If you explicitly allow fallback: set USAGE_ALLOW_FALLBACK=1
// ======================================

function __usageAllowFallback() {
  try {
    const v = (process?.env?.USAGE_ALLOW_FALLBACK || "").toString().trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "on";
  } catch (_) {
    return false;
  }
}

// ======================================
// RPC health cache (infra-grade)
// - RPC failure is NOT a success path.
// - Avoid retrying a known-bad RPC on every request.
// - STRICT by default: no fallback unless explicitly allowed.
// Env:
//   USAGE_RPC_COOLDOWN_MS (default 300000 = 5m)
//   USAGE_RPC_NOT_FOUND_COOLDOWN_MS (default 1800000 = 30m)
// ======================================

const __RPC_COOLDOWN_MS = (() => {
  const raw = (process?.env?.USAGE_RPC_COOLDOWN_MS || "").toString().trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 300000;
})();

const __RPC_NOT_FOUND_COOLDOWN_MS = (() => {
  const raw = (process?.env?.USAGE_RPC_NOT_FOUND_COOLDOWN_MS || "").toString().trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1800000;
})();

// rpcName -> { unavailableUntil:number, lastLoggedAt:number, lastErrorSummary:string }
const __rpcHealth = new Map();

function __isRpcNotFoundError(err) {
  const code = err?.code || err?.error?.code;
  if (code === "PGRST202") return true; // PostgREST: function not found
  const msg = (err?.message || err?.error?.message || "").toString().toLowerCase();
  if (msg.includes("function") && msg.includes("does not exist")) return true;
  if (msg.includes("rpc") && msg.includes("not found")) return true;
  return false;
}

function __rpcGetState(rpcName) {
  if (!__rpcHealth.has(rpcName)) __rpcHealth.set(rpcName, { unavailableUntil: 0, lastLoggedAt: 0, lastErrorSummary: "" });
  return __rpcHealth.get(rpcName);
}

function __rpcShouldTry(rpcName) {
  const s = __rpcGetState(rpcName);
  return Date.now() >= (s.unavailableUntil || 0);
}

function __rpcMarkUnavailable(rpcName, err, ctx) {
  const s = __rpcGetState(rpcName);
  const cooldown = __isRpcNotFoundError(err) ? __RPC_NOT_FOUND_COOLDOWN_MS : __RPC_COOLDOWN_MS;
  const now = Date.now();
  const until = now + cooldown;

  // Update state
  s.unavailableUntil = Math.max(s.unavailableUntil || 0, until);

  const summary = {
    rpc: rpcName,
    code: err?.code || err?.error?.code || "",
    message: (err?.message || err?.error?.message || "").toString().slice(0, 300),
  };
  s.lastErrorSummary = JSON.stringify(summary);

  // Log only once per cooldown window
  if (!s.lastLoggedAt || now - s.lastLoggedAt > cooldown / 2) {
    s.lastLoggedAt = now;
    console.error("[usageIO][rpcHealth] degraded", {
      rpc: rpcName,
      allowFallback: __usageAllowFallback(),
      unavailableUntil: new Date(s.unavailableUntil).toISOString(),
      ctx,
      err: {
        code: err?.code || err?.error?.code || "",
        details: err?.details || err?.error?.details || "",
        hint: err?.hint || err?.error?.hint || "",
        message: err?.message || err?.error?.message || "",
      },
    });
  }
}

async function __rpcCallWithHealth(supa, rpcName, rpcArgs, ctx) {
  if (!__rpcShouldTry(rpcName)) {
    return { ok: false, skipped: true, reason: "rpc_unavailable_cached", rpc: rpcName };
  }
  try {
    const { error: rpcErr, data } = await supa.rpc(rpcName, rpcArgs);
    if (!rpcErr) return { ok: true, data, rpc: rpcName };
    __rpcMarkUnavailable(rpcName, rpcErr, ctx);
    return { ok: false, reason: "rpc_failed", rpc: rpcName, error: rpcErr };
  } catch (e) {
    __rpcMarkUnavailable(rpcName, e, ctx);
    return { ok: false, reason: "rpc_exception", rpc: rpcName, error: e };
  }
}

function __usageErrInfo(e) {
  try {
    if (!e) return { message: "" };
    // Supabase errors often have: code, details, hint
    return {
      name: e.name || "",
      message: e.message || String(e),
      code: e.code || "",
      details: e.details || "",
      hint: e.hint || "",
      stack: e.stack || "",
    };
  } catch (_) {
    return { message: String(e) };
  }
}

function __usageLogFail(tag, ctx, e) {
  try {
    console.warn(tag, { ...(ctx || {}), err: __usageErrInfo(e) });
  } catch (_) {
    console.warn(tag, (e && (e.message || String(e))) || String(e));
  }
}

// ======================================
// [統計] trace helper (module-scope)
// Avoid ReferenceError when __statTrace is referenced outside init scope.
const __STAT_TRACE_ON = (process?.env?.USAGE_DEBUG_STATS || "").toString() === "1";
function __statTrace(event, payload) {
  if (!__STAT_TRACE_ON) return;
  try {
    console.info("[統計]", event, payload || {});
  } catch (_) {}
}

function getSupabaseServiceClient() {
  try {
    if (_supa) return _supa;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;

    // lazy require，避免在缺依賴時影響其他流程
    const { createClient } = require("@supabase/supabase-js");

// ======================================
// [20260203 統計] stats trace switch (dev-only)
// - Enable via env: USAGE_DEBUG_STATS=1
// ======================================

    _supa = createClient(url, key, { auth: { persistSession: false } });
    return _supa;
  } catch (e) {
    console.warn("[usageIO][init] failed:", e?.message || String(e));
    return null;
  }
}

// ======================================
// [20260203 統計] alias: legacy getSupabase()
// - avoid ReferenceError in commitLlmTokensSafe
// - map to getSupabaseServiceClient()
// ======================================
async function getSupabase() {
  return getSupabaseServiceClient();
}


function isUuidLike(v) {
  try {
    const s = String(v || "").trim();
    if (!s) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
  } catch {
    return false;
  }
}

function getTodayDateStr() {
  // YYYY-MM-DD（以 server timezone 為準；你們 DB 的 day/date 也是 date）
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getMonthDateStr() {
  // 取當月 1 號做 ym（與你 usage_events.ym default 對齊）
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

/**
 * ✅ 安全記帳（不擋主流程）
 * - 呼叫端可 await；若不 await 也不影響主要功能
 */
async function commitUsageEventSafe(payload) {
  try {
    return await commitUsageEvent(payload);
  } catch (e) {
    __usageLogFail("[usageIO][commitUsageEventSafe] failed", { userId: payload?.userId || "", endpoint: payload?.endpoint || "", path: payload?.path || "", requestId: payload?.requestId || "", eventType: payload?.eventType || "", kind: payload?.kind || "" }, e);
    return { ok: false, reason: "exception" };
  }
}

/**
 * commitUsageEvent
 * payload:
 * {
 *   userId, email, ip, endpoint, path, requestId,
 *   eventType: "llm" | "tts" | "visit",
 *   kind, provider, model, source,
 *   llmInTokens, llmOutTokens, llmTotalTokens,
 *   promptTokens, completionTokens, totalTokens,
 *   ttsChars
 * }
 */
async function commitUsageEvent(payload) {
  const supa = getSupabaseServiceClient();
  if (!supa) {
    return { ok: false, reason: "missing_env_or_client" };
  }

  const userId = String(payload?.userId || "").trim();
  if (!userId) {
    console.warn("[usageIO][asr] missing_userId, skip commit", { email: payload?.email || "", endpoint: payload?.endpoint || "", path: payload?.path || "" });
    return { ok: false, reason: "missing_userId" };
  }

  const eventType = String(payload?.eventType || "").trim() || "llm";

  // 既有 schema 欄位
  const llmInTokens = Number(payload?.llmInTokens || 0) || 0;
  const llmOutTokens = Number(payload?.llmOutTokens || 0) || 0;
  const llmTotalTokens = Number(payload?.llmTotalTokens || 0) || 0;

  const ttsChars = Number(payload?.ttsChars || 0) || 0;

  const requestId = String(payload?.requestId || "").trim();
  const request_id = isUuidLike(requestId) ? requestId : null;

  const day = getTodayDateStr();
  const ym = getMonthDateStr();

  // 1) usage_events：明細（append-only）
  const eventRow = {
    user_id: userId,
    request_id,
    event_type: eventType, // 受 constraint 限制：visit/llm/tts
    path: String(payload?.path || payload?.endpoint || "").trim() || null,
    endpoint: String(payload?.endpoint || "").trim() || null,
    kind: String(payload?.kind || "").trim() || null,
    provider: String(payload?.provider || "").trim() || null,
    model: String(payload?.model || "").trim() || null,
    ip: String(payload?.ip || "").trim() || null,
    email: String(payload?.email || "").trim() || null,
    source: String(payload?.source || "").trim() || null,

    // 兩套 token 欄位都寫（避免你現有 code 用其中一套）
    llm_in_tokens: llmInTokens,
    llm_out_tokens: llmOutTokens,
    llm_total_tokens: llmTotalTokens,

    prompt_tokens: Number(payload?.promptTokens || llmInTokens || 0) || 0,
    completion_tokens: Number(payload?.completionTokens || llmOutTokens || 0) || 0,
    total_tokens: Number(payload?.totalTokens || llmTotalTokens || 0) || 0,

    tts_chars: ttsChars,
    ym, // 你 schema 是 date not null default date_trunc(month, now())
  };

  const { error: evErr } = await supa.from("usage_events").insert(eventRow);
  if (evErr) {
    console.warn("[usageIO][events] insert failed:", evErr.message || String(evErr));
    return { ok: false, reason: "events_insert_failed", error: evErr };
  }

  // 2) usage_daily：今日聚合（目前 schema 只有 llm_completion_tokens / tts_chars）
  // - 先用 completion_tokens 當 daily 的 llm_completion_tokens（向下相容）
  const dailyAddCompletion = Number(eventRow.completion_tokens || 0) || 0;
  const dailyAddTtsChars = ttsChars;

  const dailySelect = await supa
    .from("usage_daily")
    .select("user_id, day, llm_completion_tokens, tts_chars")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  if (dailySelect.error) {
    console.warn("[usageIO][daily] select failed:", dailySelect.error.message || String(dailySelect.error));
    // 不阻擋：events 已寫入
  } else {
    const cur = dailySelect.data;
    const nextRow = {
      user_id: userId,
      day,
      llm_completion_tokens: (Number(cur?.llm_completion_tokens || 0) || 0) + dailyAddCompletion,
      tts_chars: (Number(cur?.tts_chars || 0) || 0) + dailyAddTtsChars,
      updated_at: new Date().toISOString(),
    };

    const { error: dailyUpsertErr } = await supa
      .from("usage_daily")
      .upsert(nextRow, { onConflict: "user_id,day" });

    if (dailyUpsertErr) {
      console.warn("[usageIO][daily] upsert failed:", dailyUpsertErr.message || String(dailyUpsertErr));
    }
  }

  // 3) usage_monthly：本月聚合（schema 已有 in/out/total + tts_chars_total）
  const monthlySelect = await supa
    .from("usage_monthly")
    .select("user_id, ym, llm_tokens_in, llm_tokens_out, llm_tokens_total, tts_chars_total")
    .eq("user_id", userId)
    .eq("ym", ym)
    .maybeSingle();

  if (monthlySelect.error) {
    console.warn("[usageIO][monthly] select failed:", monthlySelect.error.message || String(monthlySelect.error));
  } else {
    const curM = monthlySelect.data;
    const nextM = {
      user_id: userId,
      ym,
      llm_tokens_in: (Number(curM?.llm_tokens_in || 0) || 0) + llmInTokens,
      llm_tokens_out: (Number(curM?.llm_tokens_out || 0) || 0) + llmOutTokens,
      llm_tokens_total: (Number(curM?.llm_tokens_total || 0) || 0) + llmTotalTokens,
      tts_chars_total: (Number(curM?.tts_chars_total || 0) || 0) + ttsChars,
      updated_at: new Date().toISOString(),
    };

    const { error: monthlyUpsertErr } = await supa
      .from("usage_monthly")
      .upsert(nextM, { onConflict: "user_id,ym" });

    if (monthlyUpsertErr) {
      console.warn("[usageIO][monthly] upsert failed:", monthlyUpsertErr.message || String(monthlyUpsertErr));
    }
  }

  __statTrace("[llm_tokens][commit] ok", { userId, day, ym, inTokens, outTokens, allTokens, kind });

  console.info("[統計] commitLlmTokens result", { ok: true, userId, day, ym, kind });

  return { ok: true };
}

/**
 * ✅ ASR 秒數記帳（daily/monthly 主帳本）
 * - 依賴欄位（你需要在 DB 補欄位，否則會被 catch 住而不影響主流程）：
 *   - usage_daily.asr_seconds (bigint default 0)
 *   - usage_monthly.asr_seconds_total (bigint default 0)
 * - events 先留：由呼叫端 logUsage / 其他機制處理
 */
async function commitAsrSecondsSafe(payload) {
  
  console.log("[COUNT][usageIO] commitAsrSecondsSafe called");
try {
    return await commitAsrSeconds(payload);
  } catch (e) {
    console.warn("[usageIO][commitAsrSecondsSafe] failed:", e?.message || String(e));
    return { ok: false, reason: "exception" };
  }
}

async function commitAsrSeconds(payload) {
  const supa = getSupabaseServiceClient();
  if (!supa) {
    console.warn("[usageIO][asr] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY, skip commit");
    return { ok: false, reason: "missing_env_or_client" };
  }

  const userId = String(payload?.userId || "").trim();
  if (!userId) {
    console.warn("[usageIO][asr] missing_userId, skip commit", { email: payload?.email || "", endpoint: payload?.endpoint || "", path: payload?.path || "" });
    return { ok: false, reason: "missing_userId" };
  }

  const usedSeconds = Number(payload?.usedSeconds || 0) || 0;
  if (usedSeconds <= 0) return { ok: true, skipped: true, reason: "no_seconds" };

  const day = getTodayDateStr();
  const ym = getMonthDateStr();

  // ✅ ASR 秒數累加（修正版，避免 double add）
  // - 完成交易才算：只在 ASR 成功後呼叫
  // - daily/monthly 是主帳本；events 先留
  // - 做法：select 目前累積值 -> + usedSeconds -> upsert
  // - 若欄位不存在：supabase 會回 error，會被 catch 住且不影響主流程

  // 1) usage_daily：累加 asr_seconds
  try {
    const sel = await supa
      .from("usage_daily")
      .select("asr_seconds")
      .eq("user_id", keyId)
      .eq("day", day)
      .maybeSingle();

    if (sel.error) {
      console.warn("[usageIO][daily][asr] select failed:", sel.error.message || String(sel.error));
    }

    const cur = Number(sel.data?.asr_seconds || 0) || 0;
    const next = cur + usedSeconds;

    const { error: upErr } = await supa
      .from("usage_daily")
      .upsert(
        { user_id: userId, day, asr_seconds: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id,day" }
      );

    if (upErr) {
      console.warn("[usageIO][daily][asr] upsert failed:", upErr.message || String(upErr));
    }
  } catch (e) {
    console.warn("[usageIO][daily][asr] exception:", e?.message || String(e));
  }

  // 2) usage_monthly：累加 asr_seconds_total
  try {
    const selM = await supa
      .from("usage_monthly")
      .select("asr_seconds_total")
      .eq("user_id", keyId)
      .eq("ym", ym)
      .maybeSingle();

    if (selM.error) {
      console.warn("[usageIO][monthly][asr] select failed:", selM.error.message || String(selM.error));
    }

    const curM = Number(selM.data?.asr_seconds_total || 0) || 0;
    const nextM = curM + usedSeconds;

    const { error: upMErr } = await supa
      .from("usage_monthly")
      .upsert(
        { user_id: userId, ym, asr_seconds_total: nextM, updated_at: new Date().toISOString() },
        { onConflict: "user_id,ym" }
      );

    if (upMErr) {
      console.warn("[usageIO][monthly][asr] upsert failed:", upMErr.message || String(upMErr));
    }
  } catch (e) {
    console.warn("[usageIO][monthly][asr] exception:", e?.message || String(e));
  }

  return { ok: true };
}

// ======================================
// ✅ ASR 次數記帳（完成交易才算）
// - 寫入：usage_daily.asr_count / usage_monthly.asr_count_total
// - 不影響主流程：Safe 版本不 throw
// - 不依賴 RPC（避免 DB 還沒建 function 就壞）
// ======================================

async function commitAsrCountSafe(payload) {
  try {
    const userId = String(payload?.userId || "").trim();
    const visitId = String(payload?.visitId || "").trim();

    if (!userId && !visitId) {
      console.warn("[usageIO][asr_count] missing userId/visitId, skip commit", {
        path: payload?.path || "",
        endpoint: payload?.endpoint || "",
      });
      return { ok: false, reason: "missing_identity" };
    }

    return await commitAsrCount({ ...payload, userId, visitId });
  } catch (e) {
    console.warn("[usageIO][commitAsrCountSafe] failed:", e?.message || String(e));
    return { ok: false, reason: "exception" };
  }
}

async function commitAsrCount(payload) {
  const supa = getSupabaseServiceClient();
  if (!supa) {
    console.warn("[usageIO][asr_count] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY, skip commit");
    return { ok: false, reason: "missing_env_or_client" };
  }

  const userId = String(payload?.userId || "").trim();
  const visitId = String(payload?.visitId || "").trim();
  const keyId = userId || visitId;
  if (!keyId) {
    console.warn("[usageIO][asr_count] missing_identity, skip commit", { endpoint: payload?.endpoint || "", path: payload?.path || "" });
    return { ok: false, reason: "missing_identity" };
  }

  const inc = Number(payload?.inc || 1) || 1;
  if (inc <= 0) return { ok: true, skipped: true, reason: "no_inc" };

  const day = getTodayDateStr();
  const ym = getMonthDateStr();

  // 1) usage_daily：累加 asr_count
  try {
    const sel = await supa
      .from("usage_daily")
      .select("asr_count")
      .eq("user_id", keyId)
      .eq("day", day)
      .maybeSingle();

    if (sel.error) {
      console.warn("[usageIO][daily][asr_count] select failed:", sel.error.message || String(sel.error));
    }

    const cur = Number(sel.data?.asr_count || 0) || 0;
    const next = cur + inc;

    const { error: upErr } = await supa
      .from("usage_daily")
      .upsert(
        { user_id: keyId, day, asr_count: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id,day" }
      );

    if (upErr) {
      console.warn("[usageIO][daily][asr_count] upsert failed:", upErr.message || String(upErr));
    }
  } catch (e) {
    console.warn("[usageIO][daily][asr_count] exception:", e?.message || String(e));
  }

  // 2) usage_monthly：累加 asr_count_total
  try {
    const selM = await supa
      .from("usage_monthly")
      .select("asr_count_total")
      .eq("user_id", keyId)
      .eq("ym", ym)
      .maybeSingle();

    if (selM.error) {
      console.warn("[usageIO][monthly][asr_count] select failed:", selM.error.message || String(selM.error));
    }

    const curM = Number(selM.data?.asr_count_total || 0) || 0;
    const nextM = curM + inc;

    const { error: upMErr } = await supa
      .from("usage_monthly")
      .upsert(
        { user_id: keyId, ym, asr_count_total: nextM, updated_at: new Date().toISOString() },
        { onConflict: "user_id,ym" }
      );

    if (upMErr) {
      console.warn("[usageIO][monthly][asr_count] upsert failed:", upMErr.message || String(upMErr));
    }
  } catch (e) {
    console.warn("[usageIO][monthly][asr_count] exception:", e?.message || String(e));
  }

  return { ok: true };
}


// ======================================
// ✅ LLM tokens 記帳（完成交易才算）
// - 寫入：usage_daily / usage_monthly（主帳本）
// - events：可留可不留（本函式不依賴 events）
// - 不影響主流程：Safe 版本不 throw
// ======================================

async function commitLlmTokensSafe({
  userId,
  email,
  requestId,
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = 0,
  endpoint = "",
  path = "",
  provider = "",
  model = "",
  ip = "",
  kind = "llm",
} = {}) {
  
  console.info("[統計] commitLlmTokensSafe enter", { userId, requestId, endpoint, path, kind, promptTokens, completionTokens, totalTokens });
try {
    if (!userId) {
      console.warn("[usageIO][commitLlmTokensSafe] missing_userId -> skip");
      __statTrace("[llm_tokens][safe] missing_userId -> skip");
      return { ok: false, reason: "missing_userId" };
    }

    __statTrace("[llm_tokens][safe] enter", { userId, promptTokens, completionTokens, totalTokens, endpoint, kind });
    const res = await commitLlmTokens({
      userId,
      email,
      requestId,
      promptTokens,
      completionTokens,
      totalTokens,
      endpoint,
      path,
      provider,
      model,
      ip,
      kind,
    });
    __statTrace("[llm_tokens][safe] done", res);
    return res;
  } catch (e) {
    __usageLogFail("[usageIO][commitLlmTokensSafe] exception", { userId, requestId, endpoint, path, kind, promptTokens, completionTokens, totalTokens, provider, model }, e);
    return { ok: false, reason: "exception", error: e?.message || String(e) };
  }
}

async function commitLlmTokens({
  userId,
  email,
  requestId,
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = 0,
  endpoint = "",
  path = "",
  provider = "",
  model = "",
  ip = "",
  kind = "llm",
} = {}) {
  const supa = await getSupabase();
  if (!supa) {
    console.warn("[usageIO][commitLlmTokens] supabase_not_ready -> skip");
    return { ok: false, reason: "supabase_not_ready" };
  }

  // day / ym keys
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const ym = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

  const inTokens = Number(promptTokens || 0) || 0;
  const outTokens = Number(completionTokens || 0) || 0;
  const allTokens = Number(totalTokens || 0) || (inTokens + outTokens);

  console.info("[統計] commitLlmTokens computed", { userId, day, ym, kind, inTokens, outTokens, allTokens });

  __statTrace("[llm_tokens][commit] computed", { userId, inTokens, outTokens, allTokens, day, ym, kind });

  const allowFallback = __usageAllowFallback();

  // 1) Preferred: atomic RPC (if installed)
  const __rpcCtx = { userId, day, ym, inTokens, outTokens, allTokens, kind };
  const __rpcRes = await __rpcCallWithHealth(
    supa,
    "usage_add_llm_tokens",
    {
      p_user_id: userId,
      p_day: day,
      p_ym: ym,
      p_in_tokens: inTokens,
      p_out_tokens: outTokens,
      p_total_tokens: allTokens,
    },
    __rpcCtx
  );

  if (__rpcRes.ok) {
    __statTrace("[llm_tokens][rpc] ok", { userId, day, ym, inTokens, outTokens, allTokens, kind });
    return { ok: true, via: "rpc" };
  }

  // RPC failure is NOT a success path.
  if (!allowFallback) {
    return {
      ok: false,
      reason: __rpcRes.reason || "rpc_failed",
      via: "rpc",
      allowFallback: false,
      skipped: !!__rpcRes.skipped,
      rpc: __rpcRes.rpc,
    };
  }

// 2) Fallback: select + upsert (non-atomic but keeps system working)
  // -------- daily
  try {
    const dailySelect = await supa
      .from("usage_daily")
      .select("user_id, day, llm_tokens_in, llm_tokens_out, llm_tokens_total, llm_completion_tokens, tts_chars")
      .eq("user_id", keyId)
      .eq("day", day)
      .maybeSingle();

    if (dailySelect.error) {
      console.warn("[usageIO][daily][llm] select failed:", dailySelect.error.message || String(dailySelect.error));
    } else {
      const cur = dailySelect.data;
      const nextRow = {
        user_id: userId,
        day,
        // ✅ new columns (if exist)
        llm_tokens_in: (Number(cur?.llm_tokens_in || 0) || 0) + inTokens,
        llm_tokens_out: (Number(cur?.llm_tokens_out || 0) || 0) + outTokens,
        llm_tokens_total: (Number(cur?.llm_tokens_total || 0) || 0) + allTokens,
        // ✅ keep legacy completion counter (if used elsewhere)
        llm_completion_tokens: (Number(cur?.llm_completion_tokens || 0) || 0) + outTokens,
        // keep existing columns untouched where possible
        tts_chars: Number(cur?.tts_chars || 0) || 0,
        updated_at: new Date().toISOString(),
      };

      const { error: upErr } = await supa.from("usage_daily").upsert(nextRow, { onConflict: "user_id,day" });
      if (upErr) console.warn("[usageIO][daily][llm] upsert failed:", upErr.message || String(upErr));
    }
  } catch (e) {
    console.warn("[usageIO][daily][llm] exception:", e?.message || String(e));
  }

  // -------- monthly
  try {
    const monthlySelect = await supa
      .from("usage_monthly")
      .select("user_id, ym, llm_tokens_in, llm_tokens_out, llm_tokens_total, tts_chars_total, asr_seconds_total")
      .eq("user_id", keyId)
      .eq("ym", ym)
      .maybeSingle();

    if (monthlySelect.error) {
      console.warn("[usageIO][monthly][llm] select failed:", monthlySelect.error.message || String(monthlySelect.error));
    } else {
      const cur = monthlySelect.data;
      const nextRow = {
        user_id: userId,
        ym,
        llm_tokens_in: (Number(cur?.llm_tokens_in || 0) || 0) + inTokens,
        llm_tokens_out: (Number(cur?.llm_tokens_out || 0) || 0) + outTokens,
        llm_tokens_total: (Number(cur?.llm_tokens_total || 0) || 0) + allTokens,
        tts_chars_total: Number(cur?.tts_chars_total || 0) || 0,
        asr_seconds_total: Number(cur?.asr_seconds_total || 0) || 0,
        updated_at: new Date().toISOString(),
      };

      const { error: upErr } = await supa.from("usage_monthly").upsert(nextRow, { onConflict: "user_id,ym" });
      if (upErr) console.warn("[usageIO][monthly][llm] upsert failed:", upErr.message || String(upErr));
    }
  } catch (e) {
    console.warn("[usageIO][monthly][llm] exception:", e?.message || String(e));
  }

  return { ok: true, via: "fallback" };
}


// ======================================
// ✅ 操作行為：查詢次數（主帳本）
// - 完成交易才算：由 route 在成功回傳前呼叫
// - 寫入：usage_daily.query_count / usage_monthly.query_count
// - 不影響主流程：Safe 版本不 throw
// - 優先 RPC：public.usage_add_query_count（若存在）
// ======================================

async function commitQueryCountSafe({ userId, inc = 1 } = {}) {
  try {
    if (!userId) return { ok: false, reason: "missing_userId" };
    return await commitQueryCount({ userId, inc });
  } catch (e) {
    __usageLogFail("[usageIO][commitQueryCountSafe] exception", { userId, inc }, e);
    return { ok: false, reason: "exception", error: e?.message || String(e) };
  }
}

async function commitQueryCount({ userId, inc = 1 } = {}) {
  const supa = getSupabaseServiceClient();
  if (!supa) {
    console.warn("[usageIO][commitQueryCount] skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return { ok: false, reason: "missing_env" };
  }

  const day = getTodayDateStr();
  const ym = getMonthDateStr();
  const delta = Number(inc || 0) || 0;
  if (delta <= 0) return { ok: true, skipped: true };

  const allowFallback = __usageAllowFallback();

  // 1) RPC 原子累加（優先）
  const __rpcCtx = { userId, day, ym, inc: delta };
  const __rpcRes = await __rpcCallWithHealth(
    supa,
    "usage_add_query_count",
    { p_user_id: userId, p_day: day, p_ym: ym, p_inc: delta },
    __rpcCtx
  );

  if (__rpcRes.ok) {
    __statTrace("[query_count][rpc] ok", { userId, day, ym, inc: delta, rpc: "usage_add_query_count" });
    return { ok: true, via: "rpc" };
  }

  // RPC failure is NOT a success path.
  if (!allowFallback) {
    return {
      ok: false,
      reason: __rpcRes.reason || "rpc_failed",
      via: "rpc",
      allowFallback: false,
      skipped: !!__rpcRes.skipped,
      rpc: __rpcRes.rpc,
    };
  }

// 2) Fallback：select + upsert（非原子，但不中斷主流程）
  try {
    const { data: curD, error: selD } = await supa
      .from("usage_daily")
      .select("user_id, day, query_count, llm_completion_tokens, tts_chars, asr_seconds, updated_at")
      .eq("user_id", keyId)
      .eq("day", day)
      .maybeSingle();

    if (selD) {
      console.warn("[usageIO][daily][query] select failed:", selD.message || String(selD));
    } else {
      const next = {
        user_id: userId,
        day,
        query_count: (Number(curD?.query_count || 0) || 0) + delta,
        // keep existing columns
        llm_completion_tokens: Number(curD?.llm_completion_tokens || 0) || 0,
        tts_chars: Number(curD?.tts_chars || 0) || 0,
        asr_seconds: Number(curD?.asr_seconds || 0) || 0,
        updated_at: new Date().toISOString(),
      };
      const { error: upD } = await supa.from("usage_daily").upsert(next, { onConflict: "user_id,day" });
      if (upD) console.warn("[usageIO][daily][query] upsert failed:", upD.message || String(upD));
    }
  } catch (e) {
    console.warn("[usageIO][daily][query] exception:", e?.message || String(e));
  }

  try {
    const { data: curM, error: selM } = await supa
      .from("usage_monthly")
      .select("user_id, ym, query_count, llm_tokens_in, llm_tokens_out, llm_tokens_total, tts_chars_total, asr_seconds_total, updated_at")
      .eq("user_id", keyId)
      .eq("ym", ym)
      .maybeSingle();

    if (selM) {
      console.warn("[usageIO][monthly][query] select failed:", selM.message || String(selM));
    } else {
      const next = {
        user_id: userId,
        ym,
        query_count: (Number(curM?.query_count || 0) || 0) + delta,
        // keep existing columns
        llm_tokens_in: Number(curM?.llm_tokens_in || 0) || 0,
        llm_tokens_out: Number(curM?.llm_tokens_out || 0) || 0,
        llm_tokens_total: Number(curM?.llm_tokens_total || 0) || 0,
        tts_chars_total: Number(curM?.tts_chars_total || 0) || 0,
        asr_seconds_total: Number(curM?.asr_seconds_total || 0) || 0,
        updated_at: new Date().toISOString(),
      };
      const { error: upM } = await supa.from("usage_monthly").upsert(next, { onConflict: "user_id,ym" });
      if (upM) console.warn("[usageIO][monthly][query] upsert failed:", upM.message || String(upM));
    }
  } catch (e) {
    console.warn("[usageIO][monthly][query] exception:", e?.message || String(e));
  }

  return { ok: true, via: "fallback" };
}


// ======================================
// ✅ Analyze 次數記帳（只給 pronunciation-tips 用）
// - 寫入：usage_daily.analyze_count / usage_monthly.analyze_count_total
// - 完成交易才算：由 route 在成功回傳前呼叫
// - 匿名允許：userId 或 visitId 任一存在即可（用 keyId = userId || visitId）
// - 不影響主流程：Safe 版本不 throw
// ======================================

async function commitAnalyzeCountSafe(payload) {
  try {
    const userId = String(payload?.userId || "").trim();
    const visitId = String(payload?.visitId || "").trim();
    if (!userId && !visitId) {
      console.warn("[usageIO][analyze_count] missing userId/visitId, skip commit", {
        path: payload?.path || "",
        endpoint: payload?.endpoint || "",
      });
      return { ok: false, reason: "missing_identity" };
    }
    return await commitAnalyzeCount({ ...payload, userId, visitId });
  } catch (e) {
    console.warn("[usageIO][commitAnalyzeCountSafe] failed:", e?.message || String(e));
    return { ok: false, reason: "exception" };
  }
}

async function commitAnalyzeCount(payload) {
  const supa = getSupabaseServiceClient();
  if (!supa) {
    console.warn("[usageIO][analyze_count] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY, skip commit");
    return { ok: false, reason: "missing_env_or_client" };
  }

  const userId = String(payload?.userId || "").trim();
  const visitId = String(payload?.visitId || "").trim();
  const keyId = userId || visitId;
  if (!keyId) {
    console.warn("[usageIO][analyze_count] missing_identity, skip commit", {
      endpoint: payload?.endpoint || "",
      path: payload?.path || "",
    });
    return { ok: false, reason: "missing_identity" };
  }

  const inc = Number(payload?.inc || 1) || 1;
  if (inc <= 0) return { ok: true, skipped: true, reason: "no_inc" };

  const day = getTodayDateStr();
  const ym = getMonthDateStr();

  // 1) usage_daily：累加 analyze_count
  try {
    const sel = await supa
      .from("usage_daily")
      .select("analyze_count")
      .eq("user_id", keyId)
      .eq("day", day)
      .maybeSingle();

    if (sel.error) {
      console.warn("[usageIO][daily][analyze_count] select failed:", sel.error.message || String(sel.error));
    }

    const cur = Number(sel.data?.analyze_count || 0) || 0;
    const next = cur + inc;

    const { error: upErr } = await supa
      .from("usage_daily")
      .upsert(
        { user_id: keyId, day, analyze_count: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id,day" }
      );

    if (upErr) {
      console.warn("[usageIO][daily][analyze_count] upsert failed:", upErr.message || String(upErr));
    }
  } catch (e) {
    console.warn("[usageIO][daily][analyze_count] exception:", e?.message || String(e));
  }

  // 2) usage_monthly：累加 analyze_count（你的 schema 目前是 analyze_count；若某些環境是 analyze_count_total，則 fallback）
  {
    // 先嘗試 schema: analyze_count
    const selM = await supa
      .from("usage_monthly")
      .select("analyze_count")
      .eq("user_id", keyId)
      .eq("ym", ym)
      .maybeSingle();

    if (!selM.error) {
      const curM = Number(selM.data?.analyze_count || 0) || 0;
      const nextM = curM + inc;

      const { error: upMErr } = await supa
        .from("usage_monthly")
        .upsert(
          { user_id: keyId, ym, analyze_count: nextM, updated_at: new Date().toISOString() },
          { onConflict: "user_id,ym" }
        );

      if (!upMErr) {
        // ✅ primary path ok
      } else {
        console.warn("[usageIO][monthly][analyze_count] upsert failed:", upMErr.message || String(upMErr));
      }
    } else {
      console.warn("[usageIO][monthly][analyze_count] select failed:", selM.error.message || String(selM.error));
    }

    // fallback：若某些環境 schema 叫 analyze_count_total
    if (selM.error) {
      try {
        const selM2 = await supa
          .from("usage_monthly")
          .select("analyze_count_total")
          .eq("user_id", keyId)
          .eq("ym", ym)
          .maybeSingle();

        if (selM2.error) {
          console.warn("[usageIO][monthly][analyze_count][fallback] select failed:", selM2.error.message || String(selM2.error));
        }

        const curM2 = Number(selM2.data?.analyze_count_total || 0) || 0;
        const nextM2 = curM2 + inc;

        const { error: upM2Err } = await supa
          .from("usage_monthly")
          .upsert(
            { user_id: keyId, ym, analyze_count_total: nextM2, updated_at: new Date().toISOString() },
            { onConflict: "user_id,ym" }
          );

        if (upM2Err) {
          console.warn("[usageIO][monthly][analyze_count][fallback] upsert failed:", upM2Err.message || String(upM2Err));
        }
      } catch (e2) {
        console.warn("[usageIO][monthly][analyze_count][fallback] exception:", e2?.message || String(e2));
      }
    }
  }

  return { ok: true };
}


// ======================================
// [統計] 主帳本：dictionary lookup 次數（完成交易才算）
// - usage_daily.lookup_count（同 user 同 day 累加）
// - usage_monthly.lookup_count（同 user 同 ym 累加）
// - Safe 版本不 throw，不影響主流程
// ======================================
async function commitLookupCountSafe({ userId, inc = 1 } = {}) {
  try {
    if (!userId) {
      console.warn("[統計] commitLookupCountSafe missing_userId -> skip");
      return { ok: false, reason: "missing_userId" };
    }
    return await commitLookupCount({ userId, inc });
  } catch (e) {
    console.warn("[統計] commitLookupCountSafe exception", e?.message || String(e));
    return { ok: false, reason: "exception", error: e?.message || String(e) };
  }
}

async function commitLookupCount({ userId, inc = 1 } = {}) {
  const supabase = getSupabaseServiceClient?.() || null;
  if (!supabase) {
    console.warn("[統計] commitLookupCount missing_supabase -> skip");
    return { ok: false, reason: "missing_supabase" };
  }

  const day = getTodayDateStr();
  const ym = getMonthDateStr();
  const delta = Number(inc || 0) || 0;
  if (delta <= 0) return { ok: true, skipped: true };

  console.info("[統計] commitLookupCount enter", { userId, day, ym, delta });

  // Prefer RPC if exists (atomic). If not, fallback to safe upsert.
  const __rpcCtx = { userId, day, ym, inc: delta };
  const __rpcRes = await __rpcCallWithHealth(
    supabase,
    "usage_add_lookup_count",
    { p_user_id: userId, p_day: day, p_ym: ym, p_inc: delta },
    __rpcCtx
  );

  if (__rpcRes.ok) {
    console.info("[統計] commitLookupCount ok", { via: "rpc" });
    return { ok: true, via: "rpc" };
  }

  // RPC failure is NOT a success path.
  if (!allowFallback) {
    return {
      ok: false,
      reason: __rpcRes.reason || "rpc_failed",
      via: "rpc",
      allowFallback: false,
      skipped: !!__rpcRes.skipped,
      rpc: __rpcRes.rpc,
    };
  }

  // Fallback: upsert counters (non-atomic but safe).
  try {
    const { data: curD } = await supabase
      .from("usage_daily")
      .select("user_id, day, lookup_count")
      .eq("user_id", keyId)
      .eq("day", day)
      .maybeSingle();

    const nextD = {
      user_id: userId,
      day,
      lookup_count: (Number(curD?.lookup_count || 0) || 0) + delta,
      updated_at: new Date().toISOString(),
    };
    const { error: upD } = await supabase.from("usage_daily").upsert(nextD, { onConflict: "user_id,day" });
    if (upD) console.warn("[統計] commitLookupCount daily_upsert_failed", upD?.message || String(upD));

    const { data: curM } = await supabase
      .from("usage_monthly")
      .select("user_id, ym, lookup_count")
      .eq("user_id", keyId)
      .eq("ym", ym)
      .maybeSingle();

    const nextM = {
      user_id: userId,
      ym,
      lookup_count: (Number(curM?.lookup_count || 0) || 0) + delta,
      updated_at: new Date().toISOString(),
    };
    const { error: upM } = await supabase.from("usage_monthly").upsert(nextM, { onConflict: "user_id,ym" });
    if (upM) console.warn("[統計] commitLookupCount monthly_upsert_failed", upM?.message || String(upM));

    console.info("[統計] commitLookupCount ok", { via: "fallback" });
    return { ok: true, via: "fallback" };
  } catch (e) {
    console.warn("[統計] commitLookupCount fallback_exception", e?.message || String(e));
    return { ok: false, reason: "fallback_exception", error: e?.message || String(e) };
  }
}


// ======================================
// Feature-based counters (query/lookup/conversation/examples)
// - For per-feature daily limits and unified counting.
// ======================================

const __FEATURE_COUNTERS = {
  query: { daily: "query_count", monthly: "query_count", rpc: "usage_add_query_count" },
  lookup: { daily: "lookup_count", monthly: "lookup_count", rpc: "usage_add_lookup_count" },
  conversation: { daily: "conversation_count", monthly: "conversation_count", rpc: "usage_add_conversation_count" },
  examples: { daily: "examples_count", monthly: "examples_count", rpc: "usage_add_examples_count" },
};

function __getFeatureCfg(feature) {
  const k = String(feature || "").trim();
  return __FEATURE_COUNTERS[k] || null;
}

async function getDailyFeatureCountByUserId({ userId, feature } = {}) {
  try {
    const supa = getSupabaseServiceClient();
    if (!supa) return 0;
    if (!userId) return 0;

    const cfg = __getFeatureCfg(feature);
    if (!cfg) return 0;

    const day = getTodayDateStr();
    const col = cfg.daily;

    const { data, error } = await supa
      .from("usage_daily")
      .select(`user_id, day, ${col}`)
      .eq("user_id", String(userId))
      .eq("day", day)
      .maybeSingle();

    if (error) {
      console.warn("[usageIO][getDailyFeatureCountByUserId] select_failed", error?.message || String(error));
      return 0;
    }
    return Number(data?.[col] || 0) || 0;
  } catch (e) {
    console.warn("[usageIO][getDailyFeatureCountByUserId] exception", e?.message || String(e));
    return 0;
  }
}

// Prefer env, optional DB setting (if table exists), fallback default.
const __DEFAULT_ANON_DAILY_LIMITS = {
  query: 10,
  lookup: 10,
  conversation: 20,
  examples: 10,
};

const __LIMIT_ENV_KEYS = {
  query: ["ANON_DAILY_QUERY_LIMIT", "ANON_DAILY_LOOKUP_LIMIT"],
  lookup: ["ANON_DAILY_LOOKUP_LIMIT", "ANON_DAILY_QUERY_LIMIT"],
  conversation: ["ANON_DAILY_CONVERSATION_LIMIT"],
  examples: ["ANON_DAILY_EXAMPLES_LIMIT"],
};

async function __getSettingNumberMaybe(key) {
  try {
    const supa = getSupabaseServiceClient();
    if (!supa) return null;

    const tablesToTry = ["app_settings", "settings", "config"];
    for (const table of tablesToTry) {
      try {
        const { data, error } = await supa
          .from(table)
          .select("key, value")
          .eq("key", key)
          .maybeSingle();

        if (error) continue;
        const raw = data?.value;
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
      } catch (_e) {
        // ignore per-table
      }
    }
    return null;
  } catch (_e) {
    return null;
  }
}

async function getAnonDailyLimit({ feature } = {}) {
  const f = String(feature || "").trim();

  const envKeys = __LIMIT_ENV_KEYS[f] || [];
  for (const k of envKeys) {
    const v = Number(process.env[k]);
    if (Number.isFinite(v) && v > 0) return Math.floor(v);
  }

  // Optional DB override for admin control:
  // key: anon_daily_<feature>_limit  (e.g. anon_daily_conversation_limit)
  const dbKey = `anon_daily_${f}_limit`;
  const dbVal = await __getSettingNumberMaybe(dbKey);
  if (dbVal && dbVal > 0) return dbVal;

  return __DEFAULT_ANON_DAILY_LIMITS[f] ?? 10;
}

async function commitFeatureCountSafe({ userId, feature, inc = 1 } = {}) {
  try {
    if (!userId) return { ok: false, reason: "missing_userId" };
    const cfg = __getFeatureCfg(feature);
    if (!cfg) return { ok: false, reason: "unknown_feature" };
    return await commitFeatureCount({ userId, feature, inc });
  } catch (e) {
    console.warn("[usageIO][commitFeatureCountSafe] exception", e?.message || String(e));
    return { ok: false, reason: "exception", error: e?.message || String(e) };
  }
}

async function commitFeatureCount({ userId, feature, inc = 1 } = {}) {
  const supa = getSupabaseServiceClient();
  if (!supa) {
    console.warn("[usageIO][commitFeatureCount] skipped: missing SUPABASE env");
    return { ok: false, reason: "missing_env" };
  }

  const cfg = __getFeatureCfg(feature);
  if (!cfg) return { ok: false, reason: "unknown_feature" };

  const day = getTodayDateStr();
  const ym = getMonthDateStr();
  const delta = Number(inc || 0) || 0;
  if (delta <= 0) return { ok: true, skipped: true };

  const allowFallback = __usageAllowFallback();

  // 1) RPC (primary)
  const __rpcCtx = { userId, feature, day, ym, inc: delta };
  const __rpcRes = await __rpcCallWithHealth(
    supa,
    cfg.rpc,
    { p_user_id: userId, p_day: day, p_ym: ym, p_inc: delta },
    __rpcCtx
  );

  if (__rpcRes.ok) return { ok: true, via: "rpc" };

  // RPC failure is NOT a success path.
  if (!allowFallback) {
    return {
      ok: false,
      reason: __rpcRes.reason || "rpc_failed",
      via: "rpc",
      allowFallback: false,
      skipped: !!__rpcRes.skipped,
      rpc: __rpcRes.rpc,
    };
  }

// 2) fallback upsert
  try {
    const dcol = cfg.daily;
    const mcol = cfg.monthly;

    const { data: curD } = await supa
      .from("usage_daily")
      .select(`user_id, day, ${dcol}`)
      .eq("user_id", keyId)
      .eq("day", day)
      .maybeSingle();

    const nextD = {
      user_id: userId,
      day,
      [dcol]: (Number(curD?.[dcol] || 0) || 0) + delta,
      updated_at: new Date().toISOString(),
    };
    await supa.from("usage_daily").upsert(nextD, { onConflict: "user_id,day" });

    const { data: curM } = await supa
      .from("usage_monthly")
      .select(`user_id, ym, ${mcol}`)
      .eq("user_id", keyId)
      .eq("ym", ym)
      .maybeSingle();

    const nextM = {
      user_id: userId,
      ym,
      [mcol]: (Number(curM?.[mcol] || 0) || 0) + delta,
      updated_at: new Date().toISOString(),
    };
    await supa.from("usage_monthly").upsert(nextM, { onConflict: "user_id,ym" });

    return { ok: true, via: "fallback" };
  } catch (e) {
    console.warn("[usageIO][commitFeatureCount][fallback] exception", e?.message || String(e));
    return { ok: false, reason: "fallback_exception", error: e?.message || String(e) };
  }
}

async function commitConversationCountSafe({ userId, inc = 1 } = {}) {
  return commitFeatureCountSafe({ userId, feature: "conversation", inc });
}

async function commitExamplesCountSafe({ userId, inc = 1 } = {}) {
  return commitFeatureCountSafe({ userId, feature: "examples", inc });
}

module.exports = {
  commitLookupCountSafe,
  commitLookupCount,
commitUsageEventSafe,
  commitUsageEvent,
  commitAnalyzeCountSafe,
  commitAnalyzeCount,
  commitAsrSecondsSafe,
  commitAsrSeconds,
  commitAsrCountSafe,
  commitAsrCount,
  commitLlmTokensSafe,
  commitLlmTokens,
  commitQueryCountSafe,
  commitQueryCount,
  // feature counters
  getDailyFeatureCountByUserId,
  getAnonDailyLimit,
  commitFeatureCountSafe,
  commitFeatureCount,
  commitConversationCountSafe,
  commitExamplesCountSafe,
};

// END PATH: backend/src/utils/usageIO.js