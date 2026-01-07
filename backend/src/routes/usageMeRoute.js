// backend/src/routes/usageMeRoute.js
// ------------------------------------------------------------
// 用途：回傳「目前登入使用者」的用量（給右上角使用者下拉選單顯示）
//
// 2026-01-06
// - 新增：改為優先從 DB（usage_events / usage_monthly）讀取
// - 顯示對齊：LLM 僅採用 completion_tokens（輸出 tokens）
// - 保留：舊版檔案 usage-log.jsonl 的 fallback（不刪、不改既有 function）
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

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`; // YYYY-MM-DD
  const ymStr = `${y}-${m}`; // YYYY-MM
  const monthDate = `${y}-${m}-01`; // usage_monthly.ym

  // 1) Today：從 usage_events 累加（completion_tokens / tts_chars）
  let todayLLMCompletion = 0;
  let todayTTSChars = 0;
  try {
    // 以 UTC day start 篩選（避免時區影響太大）
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

  // 3) 回傳：保持原結構（today/month + byKindReal）
  return {
    userId,
    email: email || "",
    mode: "db_completion_only",
    today: {
      date: todayStr,
      total: 0,
      byKind: {},
      totalReal: todayLLMCompletion + todayTTSChars,
      byKindReal: {
        llm: todayLLMCompletion,
        tts: todayTTSChars,
      },
    },
    month: {
      ym: ymStr,
      total: 0,
      byKind: {},
      totalReal: monthLLMCompletion + monthTTSChars,
      byKindReal: {
        llm: monthLLMCompletion,
        tts: monthTTSChars,
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
