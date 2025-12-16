// backend/src/utils/usageLogger.js
// 檔案版用量紀錄（server 重啟也會累積）
// - 每次呼叫 logUsage() 寫一行到 usage-log.jsonl（JSONL 格式）
// - logLLMUsage() 用來記錄供應商回傳的「真實 token usage」（例如 Groq usage）
// - getUsageSummary() / getMonthlyUsage() / getUserUsageMe() 會從檔案讀取並彙總
//
// ✅ 相容舊資料：舊行只有 estTokens；新行可能有 totalTokens / promptTokens / completionTokens

const fs = require("fs");
const path = require("path");

// log 檔案位置：backend/src/usage-log.jsonl
const LOG_FILE = path.join(__dirname, "..", "usage-log.jsonl");

const DAY_MS = 24 * 60 * 60 * 1000;

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
      typeof usage.completion_tokens === "number" ? usage.completion_tokens : null,
    totalTokens: usage.total_tokens,
  };

  const time = record.ts.replace("T", " ").slice(0, 19);
  const u = record.userId ? ` userId=${record.userId}` : "";
  const rid = record.requestId ? ` requestId=${record.requestId}` : "";
  console.log(
    `[USAGE_REAL] ${time} kind=${kind} endpoint=${endpoint} ip=${ip}${u}${rid} model=${model || "-"} totalTokens=${record.totalTokens}`
  );

  appendRecordToFile(record);
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
