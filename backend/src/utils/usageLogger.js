// backend/src/utils/usageLogger.js
// 檔案版用量紀錄（server 重啟也會累積）
// - 每次呼叫 logUsage() 寫一行到 usage-log.jsonl（JSONL 格式）
// - logLLMUsage() 用來記錄供應商回傳的「真實 token usage」（例如 Groq usage）
// - getUsageSummary() / getMonthlyUsage() / getUserUsageMe() 會從檔案讀取並彙總
//
// ✅ 相容舊資料：舊行只有 estTokens；新行可能有 totalTokens / promptTokens / completionTokens
//
// 文件說明：
// - 本檔案負責「用量紀錄」與「用量彙總」
// - 2026-01-05 起：新增將 LLM 真實 tokens 同步累加到 public.profiles（帳務用途）
//
// 異動紀錄：
// - 2026-01-05：新增 logLLMUsage 寫入真實 tokens（既有）
// - 2026-01-05：新增 profiles 累加（llm_tokens_in_total / out_total / total）【本次異動】
// - 2026-01-06：新增 usage_monthly 彙總表回寫（RPC: usage_monthly_add）【本次異動】
// - 2026-01-07：新增 usage_daily 彙總表回寫（RPC: usage_daily_add）【本次異動】
// - 2026-01-06：新增 usage_events 事件明細寫入（insert into usage_events）【本次異動】
//
// 功能初始化狀態（Production 排查）：
// - 若缺 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY：只寫檔、不回寫 profiles / usage_monthly / usage_events（不影響功能）
// - 若 userId 缺失：只寫檔、不回寫 profiles / usage_monthly / usage_events（不影響功能）

const fs = require("fs");
const path = require("path");

// ✅ 新增：用於回寫 profiles（service role）
const { createClient } = require("@supabase/supabase-js");

// log 檔案位置：backend/src/usage-log.jsonl
const LOG_FILE = path.join(__dirname, "..", "usage-log.jsonl");

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 中文功能說明：
 * 建立 Supabase Admin Client（service role）
 * - 用於回寫 profiles（計費用量累加）
 * - 若環境變數不完整，回傳 null（維持只寫檔不報錯）
 */
function getAdminSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 中文功能說明：
 * 取得 UTC 月起始日（YYYY-MM-01）字串
 * - 用於 usage_monthly 的 ym 欄位（建議用 UTC，避免跨時區造成歸戶錯月）
 */
function getMonthStartDateUTCString() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-11
  const first = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return first.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * 中文功能說明：
 * ✅（新增）寫入 usage_events（事件明細）
 * - best-effort：失敗只 warn，不影響主要流程
 *
 * 依照你現在的設計：
 * - TTS：由 logUsage(kind=tts) 寫入（tts_chars）
 * - LLM：由 logLLMUsage 寫入（prompt/completion/total tokens）
 */
async function addUsageEventToDb({
  userId,
  email = "",
  ym = "",
  kind = "",
  endpoint = "",
  provider = "",
  model = "",
  promptTokens = null,
  completionTokens = null,
  totalTokens = null,
  ttsChars = null,
  ip = "",
  requestId = "",
  source = "",
}) {
  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    console.warn("[USAGE_EVENTS] skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  if (!userId) {
    console.warn("[USAGE_EVENTS] skipped: missing userId");
    return;
  }

  const ymValue = ym || getMonthStartDateUTCString();

  try {
    const payload = {
      user_id: userId,
      email: email || null,
      ym: ymValue,
      kind: kind || null,
      endpoint: endpoint || null,
      provider: provider || null,
      model: model || null,
      prompt_tokens: typeof promptTokens === "number" ? promptTokens : null,
      completion_tokens: typeof completionTokens === "number" ? completionTokens : null,
      total_tokens: typeof totalTokens === "number" ? totalTokens : null,
      tts_chars: typeof ttsChars === "number" ? ttsChars : null,
      ip: ip || null,
      request_id: requestId || null,
      source: source || null,
    };

    const { error } = await supabase.from("usage_events").insert([payload]);
    if (error) {
      const rid = requestId ? ` requestId=${requestId}` : "";
      console.warn("[USAGE_EVENTS] insert failed:", rid, error.message || String(error));
      return;
    }

    const rid = requestId ? ` requestId=${requestId}` : "";
    console.log(
      `[USAGE_EVENTS] ok userId=${userId}${rid} ym=${ymValue} kind=${kind || "-"} endpoint=${endpoint || "-"} provider=${provider || "-"} model=${model || "-"} ttsChars=${typeof ttsChars === "number" ? ttsChars : "-"} totalTokens=${typeof totalTokens === "number" ? totalTokens : "-"}`
    );
  } catch (e) {
    const rid = requestId ? ` requestId=${requestId}` : "";
    console.warn("[USAGE_EVENTS] exception:", rid, e?.message || String(e));
  }
}

/**
 * 中文功能說明：
 * 回寫 usage_monthly（每月彙總表）
 * - 透過 RPC: public.usage_monthly_add 原子累加
 * - best-effort：失敗只 warn，不影響主要流程
 *
 * RPC 參數：
 * - p_user_id uuid
 * - p_ym date（YYYY-MM-01）
 * - p_llm_in bigint
 * - p_llm_out bigint
 * - p_tts_chars bigint
 */
async function addMonthlyUsageToDb({
  userId,
  email = "",
  llmIn = 0,
  llmOut = 0,
  ttsChars = 0,
  endpoint = "",
  source = "",
  requestId = "",
}) {
  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    console.warn("[USAGE_MONTHLY] skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  if (!userId) {
    console.warn("[USAGE_MONTHLY] skipped: missing userId");
    return;
  }

  const ym = getMonthStartDateUTCString();

  try {
    const payload = {
      p_user_id: userId,
      p_ym: ym,
      p_llm_in: Number(llmIn || 0),
      p_llm_out: Number(llmOut || 0),
      p_tts_chars: Number(ttsChars || 0),
    };

    const { data, error } = await supabase.rpc("usage_monthly_add", payload);
    if (error) {
      const rid = requestId ? ` requestId=${requestId}` : "";
      console.warn("[USAGE_MONTHLY] rpc failed:", rid, error.message || String(error));
      return;
    }

    // RETURNS TABLE 可能回傳 array
    const row = Array.isArray(data) ? data[0] : data;

    const rid = requestId ? ` requestId=${requestId}` : "";
    console.log(
      `[USAGE_MONTHLY] ok userId=${userId}${rid} ym=${ym} source=${source || "-"} endpoint=${endpoint || "-"} +in=${payload.p_llm_in} +out=${payload.p_llm_out} +ttsChars=${payload.p_tts_chars} totals(llm=${row?.llm_tokens_total}, tts=${row?.tts_chars_total})`
    );
  } catch (e) {
    const rid = requestId ? ` requestId=${requestId}` : "";
    console.warn("[USAGE_MONTHLY] exception:", rid, e?.message || String(e));
  }
}

/**
 * 中文功能說明：
 * - 將每日用量累加到 usage_daily（帳務/限額用途）
 * - 目前「LLM 只計 completion_tokens」（使用者輸出）+ TTS 以字元數計
 *
 * RPC 參數：
 * - p_user_id uuid
 * - p_day date（YYYY-MM-DD）
 * - p_llm_completion_tokens bigint
 * - p_tts_chars bigint
 */
async function addDailyUsageToDb({
  userId,
  email = "",
  llmCompletionTokens = 0,
  ttsChars = 0,
  endpoint = "",
  source = "",
  requestId = "",
}) {
  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    console.warn("[USAGE_DAILY] skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  if (!userId) {
    console.warn("[USAGE_DAILY] skipped: missing userId");
    return;
  }

  try {
    const day = getTodayDateString(); // YYYY-MM-DD
    const payload = {
      p_user_id: userId,
      p_day: day,
      p_llm_completion_tokens: Math.max(Number(llmCompletionTokens || 0), 0),
      p_tts_chars: Math.max(Number(ttsChars || 0), 0),
    };

    const { data, error } = await supabase.rpc("usage_daily_add", payload);

    if (error) {
      const rid = requestId ? ` requestId=${requestId}` : "";
      console.warn("[USAGE_DAILY] rpc failed:", rid, error.message || String(error));
      return;
    }

    // RETURNS TABLE 可能回傳 array
    const row = Array.isArray(data) ? data[0] : data;

    const rid = requestId ? ` requestId=${requestId}` : "";
    console.log(
      `[USAGE_DAILY] ok userId=${userId}${rid} day=${day} add(llm_completion=${payload.p_llm_completion_tokens}, tts_chars=${payload.p_tts_chars}) totals(llm_completion=${row?.llm_completion_tokens}, tts=${row?.tts_chars})`
    );
  } catch (e) {
    const rid = requestId ? ` requestId=${requestId}` : "";
    console.warn("[USAGE_DAILY] exception:", rid, e?.message || String(e));
  }
}


/**
 * 中文功能說明：
 * 確保 profiles 有該 userId 的 row（若沒有就建立）
 * - 避免「使用量回寫」因為找不到 row 而失敗
 * - 注意：profiles.id 是 PK（uuid）
 */
async function ensureProfileRow({ supabase, userId, email = "" }) {
  if (!supabase || !userId) return { ok: false, reason: "missing_supabase_or_userId" };

  try {
    const { data: existing, error: selErr } = await supabase
      .from("profiles")
      .select("id, email, llm_tokens_in_total, llm_tokens_out_total, llm_tokens_total, tts_chars_total")
      .eq("id", userId)
      .maybeSingle();

    if (selErr) {
      return { ok: false, reason: "select_failed", detail: selErr.message || String(selErr) };
    }

    if (existing) {
      return { ok: true, existed: true, row: existing };
    }

    // 若不存在，建立最小 row（符合 table 定義：plan 有 default；created_at 有 default）
    const payload = {
      id: userId,
      email: email || null,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("profiles")
      .insert([payload])
      .select("id, email, llm_tokens_in_total, llm_tokens_out_total, llm_tokens_total, tts_chars_total")
      .maybeSingle();

    if (insErr) {
      return { ok: false, reason: "insert_failed", detail: insErr.message || String(insErr) };
    }

    return { ok: true, existed: false, row: inserted || null };
  } catch (e) {
    return { ok: false, reason: "exception", detail: e?.message || String(e) };
  }
}

/**
 * 中文功能說明：
 * 回寫 LLM 真實 tokens 到 profiles（累加）
 * - llm_tokens_in_total += promptTokens
 * - llm_tokens_out_total += completionTokens
 * - llm_tokens_total += totalTokens
 *
 * 注意：
 * - 目前採「讀 → 算 → 寫」；高併發可能有競態（之後可改成 RPC 原子累加）
 * - 這裡採 best-effort：失敗只 warn，不會影響主要功能
 */
async function addLLMTokensToProfile({
  userId,
  email = "",
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = 0,
  endpoint = "",
  provider = "",
  model = "",
  requestId = "",
}) {
  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    console.warn("[USAGE_PROFILE] skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  if (!userId) {
    console.warn("[USAGE_PROFILE] skipped: missing userId");
    return;
  }

  // 1) 確保 row 存在 & 取回目前累計
  const ensured = await ensureProfileRow({ supabase, userId, email });
  if (!ensured.ok) {
    console.warn("[USAGE_PROFILE] ensureProfileRow failed:", ensured.reason, ensured.detail || "");
    return;
  }

  const row = ensured.row || {};
  const prevIn = Number(row.llm_tokens_in_total || 0);
  const prevOut = Number(row.llm_tokens_out_total || 0);
  const prevTotal = Number(row.llm_tokens_total || 0);

  const addIn = Number(promptTokens || 0);
  const addOut = Number(completionTokens || 0);
  const addTotal = Number(totalTokens || 0);

  const nextIn = prevIn + addIn;
  const nextOut = prevOut + addOut;
  const nextTotal = prevTotal + addTotal;

  // 2) 更新累計
  try {
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        llm_tokens_in_total: nextIn,
        llm_tokens_out_total: nextOut,
        llm_tokens_total: nextTotal,
      })
      .eq("id", userId);

    if (updErr) {
      console.warn("[USAGE_PROFILE] update failed:", updErr.message || String(updErr));
      return;
    }

    const rid = requestId ? ` requestId=${requestId}` : "";
    console.log(
      `[USAGE_PROFILE] ok userId=${userId}${rid} +in=${addIn} +out=${addOut} +total=${addTotal} endpoint=${endpoint || "-"} provider=${provider || "-"} model=${model || "-"}`
    );
  } catch (e) {
    console.warn("[USAGE_PROFILE] update exception:", e?.message || String(e));
  }
}

function getTodayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate() + 0).padStart(2, "0");
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}

function getYearMonthString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // YYYY-MM
}

/**
 * 記錄一次呼叫（估算 tokens：字元/4）
 * @param {Object} options
 * @param {string} options.endpoint 例如 "/api/analyze"
 * @param {number} options.charCount 輸入字元數
 * @param {string} [options.kind]  "llm" | "tts" ...
 * @param {string} [options.ip]    來源 IP
 * @param {string} [options.userId] 使用者 id（Supabase user id / decoded.sub）
 * @param {string} [options.email]  使用者 email（顯示用）
 */
function logUsage({
  endpoint,
  charCount,
  kind = "llm",
  ip = "",
  userId = "",
  email = "",
}) {
  const date = getTodayDateString();
  const estimatedTokens = Math.ceil((charCount || 0) / 4); // 超粗估

  const record = {
    ts: new Date().toISOString(),
    date, // YYYY-MM-DD
    endpoint, // "/api/analyze" ...
    charCount: charCount || 0,
    estTokens: estimatedTokens,
    kind,
    ip,
    userId: userId || "",
    email: email || "",
  };

  const time = record.ts.replace("T", " ").slice(0, 19);
  const u = record.userId ? ` userId=${record.userId}` : "";
  console.log(
    `[USAGE] ${time} kind=${kind} endpoint=${endpoint} ip=${ip}${u} chars=${record.charCount} estTokens=${estimatedTokens}`
  );

  appendRecordToFile(record);

  /**
   * ✅ 2026-01-06：同步回寫 usage_monthly（TTS 以字元數計）
   * - best-effort：失敗只 warn，不影響主要流程
   * - LLM 真實 tokens 仍以 logLLMUsage 為準（避免用 estTokens 計費）
   */
  try {
    if (kind === "tts") {
      addMonthlyUsageToDb({
        userId: userId || "",
        email: email || "",
        llmIn: 0,
        llmOut: 0,
        ttsChars: Number(charCount || 0),
        endpoint: endpoint || "",
        source: "logUsage",
        requestId: "",
      });
      
      // ✅ 2026-01-07：同步回寫 usage_daily（TTS 以字元數計）
      // - best-effort：失敗只 warn，不影響主要流程
      if (kind === "tts") {
        addDailyUsageToDb({
          userId: userId || "",
          email: email || "",
          llmCompletionTokens: 0,
          ttsChars: Number(charCount || 0),
          endpoint: endpoint || "",
          source: "logUsage",
          requestId: "",
        });
      }
    }
  } catch (e) {
    console.warn("[USAGE_MONTHLY] enqueue failed (logUsage):", e?.message || String(e));
  }

  /**
   * ✅ 2026-01-06：新增 usage_events（TTS 事件明細）
   * - best-effort：失敗只 warn，不影響主要流程
   */
  try {
    if (kind === "tts") {
      addUsageEventToDb({
        userId: userId || "",
        email: email || "",
        ym: getMonthStartDateUTCString(),
        kind: "tts",
        endpoint: endpoint || "",
        provider: "google",
        model: process.env.TTS_VOICE || process.env.TTS_LANGUAGE || "",
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        ttsChars: Number(charCount || 0),
        ip: ip || "",
        requestId: "",
        source: "logUsage",
      });
    }
  } catch (e) {
    console.warn("[USAGE_EVENTS] enqueue failed (logUsage):", e?.message || String(e));
  }
}

/**
 * ✅ 新增：記錄供應商回傳的「真實 token usage」
 * @param {Object} options
 * @param {string} options.endpoint 例如 "/api/analyze"
 * @param {string} [options.model] 例如 "llama-3.1-70b-versatile"
 * @param {string} [options.provider] 例如 "groq"
 * @param {Object} options.usage Groq 回傳 usage：{prompt_tokens, completion_tokens, total_tokens}
 * @param {string} [options.kind] 預設 "llm"
 * @param {string} [options.ip]
 * @param {string} [options.userId]
 * @param {string} [options.email]
 * @param {string} [options.requestId] 用來抓重送/重試（可選）
 */
function logLLMUsage({
  endpoint,
  model = "",
  provider = "groq",
  usage,
  kind = "llm",
  ip = "",
  userId = "",
  email = "",
  requestId = "",
}) {
  // 必須有 total_tokens 才算有效
  if (!usage || typeof usage.total_tokens !== "number") {
    console.warn("[USAGE] logLLMUsage skipped: missing usage.total_tokens");
    return;
  }

  const date = getTodayDateString();

  const record = {
    ts: new Date().toISOString(),
    date,
    endpoint,
    kind,
    ip,
    userId: userId || "",
    email: email || "",

    provider,
    model,
    requestId: requestId || "",

    // ✅ 真實 token（供 dashboard 對齊供應商後台）
    promptTokens:
      typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : null,
    completionTokens:
      typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : null,
    totalTokens: usage.total_tokens,
  };

  const time = record.ts.replace("T", " ").slice(0, 19);
  const u = record.userId ? ` userId=${record.userId}` : "";
  const rid = record.requestId ? ` requestId=${record.requestId}` : "";
  console.log(
    `[USAGE_REAL] ${time} kind=${kind} endpoint=${endpoint} ip=${ip}${u}${rid} model=${model || "-"} totalTokens=${record.totalTokens}`
  );

  appendRecordToFile(record);

  /**
   * ✅ 2026-01-05：同步回寫 profiles（計費/額度用途）
   * - best-effort：失敗只 warn，不影響主要流程
   * - 目前採用「讀→算→寫」；後續若要完全避免併發，可再改成 RPC 原子累加
   */
  try {
    const promptTokens =
      typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0;
    const completionTokens =
      typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : 0;
    const totalTokens = usage.total_tokens;

    // fire-and-forget（不阻塞主流程）
    addLLMTokensToProfile({
      userId: userId || "",
      email: email || "",
      promptTokens,
      completionTokens,
      totalTokens,
      endpoint: endpoint || "",
      provider: provider || "",
      model: model || "",
      requestId: requestId || "",
    });
  } catch (e) {
    console.warn("[USAGE_PROFILE] enqueue failed:", e?.message || String(e));
  }

  /**
   * ✅ 2026-01-06：同步回寫 usage_monthly（LLM 以真實 tokens 計）
   * - best-effort：失敗只 warn，不影響主要流程
   */
  try {
    const promptTokens =
      typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0;
    const completionTokens =
      typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : 0;

    addMonthlyUsageToDb({
      userId: userId || "",
      email: email || "",
      llmIn: promptTokens,
      llmOut: completionTokens,
      ttsChars: 0,
      endpoint: endpoint || "",
      source: "logLLMUsage",
      requestId: requestId || "",
    });
  } catch (e) {
    console.warn("[USAGE_MONTHLY] enqueue failed (logLLMUsage):", e?.message || String(e));
  }


  /**
   * ✅ 2026-01-07：同步回寫 usage_daily（LLM 只計 completion_tokens）
   * - best-effort：失敗只 warn，不影響主要流程
   */
  try {
    const completionTokens =
      typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : 0;

    addDailyUsageToDb({
      userId: userId || "",
      email: email || "",
      llmCompletionTokens: completionTokens,
      ttsChars: 0,
      endpoint: endpoint || "",
      source: "logLLMUsage",
      requestId: requestId || "",
    });
  } catch (e) {
    console.warn("[USAGE_DAILY] enqueue failed (logLLMUsage):", e?.message || String(e));
  }
  /**
   * ✅ 2026-01-06：新增 usage_events（LLM 事件明細）
   * - best-effort：失敗只 warn，不影響主要流程
   */
  try {
    const promptTokens =
      typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0;
    const completionTokens =
      typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : 0;
    const totalTokens = usage.total_tokens;

    addUsageEventToDb({
      userId: userId || "",
      email: email || "",
      ym: getMonthStartDateUTCString(),
      kind: "llm",
      endpoint: endpoint || "",
      provider: provider || "",
      model: model || "",
      promptTokens,
      completionTokens,
      totalTokens,
      ttsChars: null,
      ip: ip || "",
      requestId: requestId || "",
      source: "logLLMUsage",
    });
  } catch (e) {
    console.warn("[USAGE_EVENTS] enqueue failed (logLLMUsage):", e?.message || String(e));
  }
}

// 寫一行 JSON 到 usage-log.jsonl
function appendRecordToFile(record) {
  try {
    const line = JSON.stringify(record) + "\n";
    fs.appendFile(LOG_FILE, line, (err) => {
      if (err) {
        console.error("[USAGE] Failed to append usage log:", err.message);
      }
    });
  } catch (err) {
    console.error("[USAGE] Failed to serialize usage record:", err.message);
  }
}

// 從檔案讀出所有紀錄
function loadRecordsFromFile() {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const raw = fs.readFileSync(LOG_FILE, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const records = [];
    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        // 只要 date + endpoint 有就收（相容新舊）
        if (rec && rec.date && rec.endpoint) {
          records.push(rec);
        }
      } catch {
        // 略過壞掉的行
      }
    }
    return records;
  } catch (err) {
    console.error("[USAGE] Failed to read usage log file:", err.message);
    return [];
  }
}

/**
 * 取得最近 N 天的用量摘要（含今天）
 * @param {number} [days] 預設 7
 * @returns {Array<{date, endpoint, callCount, estTokens, realTokens}>}
 */
function getUsageSummary(days = 7) {
  const records = loadRecordsFromFile();
  if (records.length === 0) return [];

  const today = new Date();
  const cutoffMs = today.getTime() - (days - 1) * DAY_MS;

  const buckets = new Map(); // key: `${date}:${endpoint}`

  for (const rec of records) {
    const recDateStr = rec.date;
    const recDateMs = new Date(recDateStr + "T00:00:00Z").getTime();
    if (Number.isNaN(recDateMs) || recDateMs < cutoffMs) continue;

    const key = `${recDateStr}:${rec.endpoint}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        date: recDateStr,
        endpoint: rec.endpoint,
        callCount: 0,
        estTokens: 0,
        realTokens: 0,
      };
      buckets.set(key, bucket);
    }

    bucket.callCount += 1;

    // ✅ 真實 tokens 優先累加；沒有就累加估算
    if (typeof rec.totalTokens === "number") {
      bucket.realTokens += rec.totalTokens;
    } else {
      bucket.estTokens += rec.estTokens || 0;
    }
  }

  const rows = Array.from(buckets.values());

  rows.sort((a, b) => {
    if (a.date === b.date) return a.endpoint.localeCompare(b.endpoint);
    return a.date.localeCompare(b.date);
  });

  return rows;
}

/**
 * 取得本月累計 tokens，含 LLM / TTS 分類
 * - 估算（estTokens）仍保留
 * - 真實（totalTokens）若有則另算一份
 * @returns {{
 *   month: string,
 *   totalEstimatedTokens: number,
 *   byKind: Record<string, number>,
 *   totalTokensReal: number,
 *   byKindReal: Record<string, number>
 * }}
 */
function getMonthlyUsage() {
  const records = loadRecordsFromFile();
  const ym = getYearMonthString(); // "YYYY-MM"

  if (records.length === 0) {
    return {
      month: ym,
      totalEstimatedTokens: 0,
      byKind: {},
      totalTokensReal: 0,
      byKindReal: {},
    };
  }

  let totalEstimated = 0;
  const byKind = {};

  let totalReal = 0;
  const byKindReal = {};

  for (const rec of records) {
    if (typeof rec.date !== "string" || !rec.date.startsWith(ym)) continue;

    const kind = rec.kind || "other";

    if (typeof rec.totalTokens === "number") {
      totalReal += rec.totalTokens;
      byKindReal[kind] = (byKindReal[kind] || 0) + rec.totalTokens;
    } else {
      const t = rec.estTokens || 0;
      totalEstimated += t;
      byKind[kind] = (byKind[kind] || 0) + t;
    }
  }

  return {
    month: ym,
    totalEstimatedTokens: totalEstimated,
    byKind,
    totalTokensReal: totalReal,
    byKindReal,
  };
}

/**
 * 依 userId 取得「今日 + 本月」用量（LLM / TTS 分開）
 * - 同時回傳 estimated 與 real
 * @param {Object} options
 * @param {string} options.userId
 * @param {string} [options.email]（可選，主要用來回傳給前端顯示）
 * @returns {{
 *   userId: string,
 *   email: string,
 *   today: {
 *     date: string,
 *     total: number,
 *     byKind: Record<string, number>,
 *     totalReal: number,
 *     byKindReal: Record<string, number>
 *   },
 *   month: {
 *     ym: string,
 *     total: number,
 *     byKind: Record<string, number>,
 *     totalReal: number,
 *     byKindReal: Record<string, number>
 *   }
 * }}
 */
function getUserUsageMe({ userId, email = "" }) {
  const records = loadRecordsFromFile();
  const todayStr = getTodayDateString(); // YYYY-MM-DD
  const ym = getYearMonthString(); // YYYY-MM

  const todayByKind = {};
  let todayTotal = 0;

  const todayByKindReal = {};
  let todayTotalReal = 0;

  const monthByKind = {};
  let monthTotal = 0;

  const monthByKindReal = {};
  let monthTotalReal = 0;

  for (const rec of records) {
    if (!rec || rec.userId !== userId) continue;

    const kind = rec.kind || "other";
    const hasReal = typeof rec.totalTokens === "number";
    const est = rec.estTokens || 0;
    const real = hasReal ? rec.totalTokens : 0;

    if (rec.date === todayStr) {
      if (hasReal) {
        todayTotalReal += real;
        todayByKindReal[kind] = (todayByKindReal[kind] || 0) + real;
      } else {
        todayTotal += est;
        todayByKind[kind] = (todayByKind[kind] || 0) + est;
      }
    }

    if (typeof rec.date === "string" && rec.date.startsWith(ym)) {
      if (hasReal) {
        monthTotalReal += real;
        monthByKindReal[kind] = (monthByKindReal[kind] || 0) + real;
      } else {
        monthTotal += est;
        monthByKind[kind] = (monthByKind[kind] || 0) + est;
      }
    }
  }

  return {
    userId,
    email: email || "",
    today: {
      date: todayStr,
      total: todayTotal,
      byKind: todayByKind,
      totalReal: todayTotalReal,
      byKindReal: todayByKindReal,
    },
    month: {
      ym,
      total: monthTotal,
      byKind: monthByKind,
      totalReal: monthTotalReal,
      byKindReal: monthByKindReal,
    },
  };
}

module.exports = {
  logUsage,
  logLLMUsage, // ✅ 新增
  getUsageSummary,
  getMonthlyUsage,
  getUserUsageMe,
};

// backend/src/utils/usageLogger.js
