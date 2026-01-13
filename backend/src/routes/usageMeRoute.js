// backend/src/routes/usageMeRoute.js
// ------------------------------------------------------------
// 用途：回傳「目前登入使用者」的用量（給右上角使用者下拉選單顯示）
//
// 2026-01-06
// - 新增：改為優先從 DB（usage_events / usage_monthly）讀取
// - 顯示對齊：LLM 僅採用 completion_tokens（輸出 tokens）
// - 保留：舊版檔案 usage-log.jsonl 的 fallback（不刪、不改既有 function）
//
// 2026-01-07
// - 修正：UI 顯示 0 的 root cause → 回傳欄位 total/byKind 仍為 0（UI 吃的是 total 而不是 totalReal）
// - 調整：Today 改為「直接讀 usage_daily」（completion only），不再用 usage_events 即時累加（避免時區/limit/資料量干擾）
// - 顯示策略：total 只顯示 LLM completion_tokens；TTS chars 仍保留在 byKind.tts / byKindReal.tts（但不併入 total）
// - 開發預設值：not available（避免中文定字）
//
// 注意：這支 route 只做「顯示用」摘要，不做計費結算
// ------------------------------------------------------------

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

// ✅ DB 讀取（Supabase）
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  // 功能初始化狀態（Production 排查）
  if (!_supabaseAdmin) {
    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      console.warn(
        "[usageMeRoute] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing, will fallback to file usageLogger"
      );
      return null;
    }

    try {
      // 延遲 require：避免在沒有安裝套件時直接炸掉
      const { createClient } = require("@supabase/supabase-js");
      _supabaseAdmin = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      console.log("[usageMeRoute] supabase admin client init ok");
    } catch (e) {
      console.warn(
        "[usageMeRoute] failed to init supabase admin client, fallback to file usageLogger",
        e && e.message ? e.message : e
      );
      _supabaseAdmin = null;
      return null;
    }
  }
  return _supabaseAdmin;
}

const { getUserUsageMe } = require("../utils/usageLogger");

// ✅ 從 DB 取回：LLM 只算 completion_tokens；TTS 只算 tts_chars
// 回傳格式維持 getUserUsageMe() 相容，避免前端大改
async function getUserUsageMeFromDb({ userId, email = "" }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  // 開發預設值：not available（避免中文定字）
  const NA = "not available";

  const now = new Date();

  // ✅ 統一用 UTC 日期字串（避免部署後時區跨日顯示 0）
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const y = todayStr.slice(0, 4);
  const m = todayStr.slice(5, 7);
  const ymStr = `${y}-${m}`; // YYYY-MM
  const monthDate = `${y}-${m}-01`; // usage_monthly.ym

  // 1) Today：改為直接讀 usage_daily（completion only）
  let todayLLMCompletion = 0;
  let todayTTSChars = 0;

  try {
    const { data: daily, error: dErr } = await supabase
      .from("usage_daily")
      .select("llm_completion_tokens, tts_chars, updated_at")
      .eq("user_id", userId)
      .eq("day", todayStr)
      .maybeSingle();

    if (dErr) {
      console.warn("[usageMeRoute][db] usage_daily select failed:", dErr.message);
    } else if (daily) {
      todayLLMCompletion = Number(daily.llm_completion_tokens || 0);
      todayTTSChars = Number(daily.tts_chars || 0);
    }
  } catch (e) {
    console.warn(
      "[usageMeRoute][db] usage_daily read exception:",
      e && e.message ? e.message : e
    );
  }

  // DEPRECATED 2026-01-07:
  // 原本用 usage_events gte(created_at, since) 來累加 today
  // 問題：時區/limit/資料量會讓「顯示」不穩定；daily 已是計費/guard 的基準，顯示應對齊 daily
  /*
  try {
    const since = `${todayStr}T00:00:00.000Z`;
    const { data: rows, error } = await supabase
      .from("usage_events")
      .select("kind, completion_tokens, tts_chars, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .limit(5000);

    if (error) {
      console.warn("[usageMeRoute][db] usage_events select failed:", error.message);
    } else if (Array.isArray(rows)) {
      for (const r of rows) {
        const kind = (r && r.kind) || "";
        if (kind === "llm") {
          todayLLMCompletion += Number(r.completion_tokens || 0);
        }
        if (kind === "tts") {
          todayTTSChars += Number(r.tts_chars || 0);
        }
      }
    }
  } catch (e) {
    console.warn(
      "[usageMeRoute][db] usage_events read exception:",
      e && e.message ? e.message : e
    );
  }
  */

  // 2) Month：從 usage_monthly 讀取（llm_tokens_out = completion_tokens）
  let monthLLMCompletion = 0;
  let monthTTSChars = 0;
  try {
    const { data: monthly, error: mErr } = await supabase
      .from("usage_monthly")
      .select("llm_tokens_out, tts_chars_total")
      .eq("user_id", userId)
      .eq("ym", monthDate)
      .maybeSingle();

    if (mErr) {
      console.warn("[usageMeRoute][db] usage_monthly select failed:", mErr.message);
    } else if (monthly) {
      monthLLMCompletion = Number(monthly.llm_tokens_out || 0);
      monthTTSChars = Number(monthly.tts_chars_total || 0);
    }
  } catch (e) {
    console.warn(
      "[usageMeRoute][db] usage_monthly read exception:",
      e && e.message ? e.message : e
    );
  }

  // 3) 回傳：保持原結構
  // ✅ 修正：讓 UI 直接吃 total/byKind（不要再是 0）
  // ✅ 顯示策略：total 只呈現 LLM completion_tokens（你要的計費基準）；TTS chars 不併入 total
  return {
    userId: userId || NA,
    email: email || NA,
    mode: "db_completion_only_daily",
    today: {
      date: todayStr || NA,
      total: Number(todayLLMCompletion || 0), // ✅ UI 顯示用（只顯示 completion_tokens）
      byKind: {
        llm: Number(todayLLMCompletion || 0),
        tts: Number(todayTTSChars || 0),
      },
      // 保留：方便你比對/除錯（但 UI 不應依賴）
      totalReal: Number(todayLLMCompletion || 0), // completion only
      byKindReal: {
        llm: Number(todayLLMCompletion || 0),
        tts: Number(todayTTSChars || 0),
      },
    },
    month: {
      ym: ymStr || NA,
      total: Number(monthLLMCompletion || 0), // ✅ UI 顯示用（只顯示 completion_tokens）
      byKind: {
        llm: Number(monthLLMCompletion || 0),
        tts: Number(monthTTSChars || 0),
      },
      // 保留：方便你比對/除錯（但 UI 不應依賴）
      totalReal: Number(monthLLMCompletion || 0), // completion only
      byKindReal: {
        llm: Number(monthLLMCompletion || 0),
        tts: Number(monthTTSChars || 0),
      },
    },
  };
}

// 需要登入：必須有 Authorization: Bearer <token>
// verify → decode fallback（只用於讀取 userId，不做權限升級）
function requireAuthUser(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  // ① 優先 verify（若環境變數存在）
  if (process.env.SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      return {
        id: decoded.sub || "",
        email: decoded.email || "",
        source: "verify",
      };
    } catch (e) {
      console.warn("[usageMeRoute] jwt.verify failed, fallback to decode");
    }
  }

  // ② fallback：decode（不驗證，只讀 id/email）
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

// GET /api/usage/me
router.get("/me", async (req, res) => {
  const authUser = requireAuthUser(req);
  if (!authUser || !authUser.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ① 優先 DB（completion_tokens only）
  let data = null;
  try {
    data = await getUserUsageMeFromDb({
      userId: authUser.id,
      email: authUser.email || "",
    });
  } catch (e) {
    console.warn(
      "[usageMeRoute] getUserUsageMeFromDb failed, fallback to file usageLogger",
      e && e.message ? e.message : e
    );
    data = null;
  }

  // ② fallback：舊版檔案彙總（不改既有邏輯）
  if (!data) {
    data = getUserUsageMe({
      userId: authUser.id,
      email: authUser.email || "",
    });
    // 額外標記：方便你在 UI/Console 辨認是否落到 fallback
    data.mode = data.mode || "fallback_file";
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.send(JSON.stringify(data, null, 2));
});

module.exports = router;

// backend/src/routes/usageMeRoute.js
