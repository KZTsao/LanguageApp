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

function getSupabaseServiceClient() {
  try {
    if (_supa) return _supa;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;

    // lazy require，避免在缺依賴時影響其他流程
    const { createClient } = require("@supabase/supabase-js");
    _supa = createClient(url, key, { auth: { persistSession: false } });
    return _supa;
  } catch (e) {
    console.warn("[usageIO][init] failed:", e?.message || String(e));
    return null;
  }
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
    console.warn("[usageIO][commitUsageEventSafe] failed:", e?.message || String(e));
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
  if (!userId) return { ok: false, reason: "missing_userId" };

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

  return { ok: true };
}

module.exports = {
  commitUsageEventSafe,
  commitUsageEvent,
};

// backend/src/utils/usageIO.js
