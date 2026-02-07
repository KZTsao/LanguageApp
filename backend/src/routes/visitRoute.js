console.log("[visitRoute] LOADED", __filename);
// PATH: backend/src/routes/visitRoute.js
// backend/src/routes/visitRoute.js

/**
 * 文件說明：
 * Visit 訪問紀錄（最小 API）
 *
 * 異動日期：2026-01-05
 * 異動說明：
 * 1) 新增 POST /api/visit：每次訪問更新 profiles.visit_count / last_visit_at
 * 2) 若 profiles 不存在則先建立（以 user id 為主鍵）
 *
 * 異動日期：2026-01-05
 * 異動說明：
 * 3) 導入 RPC 原子遞增：優先呼叫 public.profile_visit()
 * 4) 修正 supabase.rpc 參數格式：必須使用 object（不可用 array），且 key 需完全匹配 DB function 參數名
 * 5) 保留舊的 read→+1→update 作為 fallback（Production 排查/避免中斷）
 */

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

/**
 * 中文功能說明：
 * 解析 Authorization Bearer Token，取得 userId/email
 * - 優先 verify（需要 SUPABASE_JWT_SECRET）
 * - fallback decode（只取資料，不驗證簽章）
 */
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
      console.warn("[visitRoute] jwt.verify failed, fallback to decode");
    }
  }

  // ② fallback decode（不驗證，只讀 sub/email）
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
 * 中文功能說明：
 * 建立 Supabase Admin Client（service role）
 * 用於寫入 profiles（避免 RLS 造成寫入失敗）
 */
function getAdminSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 功能初始化狀態（Production 排查）：
 * - 若 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 缺失，API 會回 500
 * - 若 SUPABASE_JWT_SECRET 缺失，會 fallback decode 但仍可取到 sub
 */

/**
 * POST /api/visit
 * 中文功能說明：
 * - 訪問一次就記一次 profiles.visit_count +1
 * - 同時更新 profiles.last_visit_at
 */
router.post("/visit", async (req, res) => {
  const authUser = requireAuthUser(req);

  // ✅ 允許匿名：未登入/無 token 時，不阻塞前端啟動
  // - 有登入：照常記錄 visit（profiles.visit_count / last_visit_at）
  // - 匿名：直接回 OK（不寫 DB）
  if (!authUser || !authUser.id) {
    return res.status(200).json({ ok: true, anonymous: true });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return res.status(500).json({
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const userId = authUser.id;
  const email = authUser.email || "";
  const nowIso = new Date().toISOString();

  /**
   * ✅ 優先路線：RPC 原子遞增
   * 注意：supabase.rpc() 只能吃 object，且 object key 必須完全匹配 DB function 參數名
   * 你目前 DB schema cache 顯示：public.profile_visit(p_email, p_user_id)
   */
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "profile_visit",
      {
        // ✅ 用你 DB cache 顯示的順序/命名：p_email -> p_user_id
        p_email: email,
        p_user_id: userId,
      }
    );

    if (rpcErr) {
      // RPC 失敗：回報 detail，並進 fallback（避免整個功能中斷）
      console.warn("[visitRoute][rpc] failed:", rpcErr);
    } else {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;

      return res.json({
        ok: true,
        userId,
        visit_count: row?.visit_count ?? null,
        last_visit_at: row?.last_visit_at ?? null,
        mode: "rpc",
      });
    }
  } catch (e) {
    console.warn("[visitRoute][rpc] exception:", e);
    // 進 fallback
  }

  /**
   * ✅ fallback 路線：舊版 read → +1 → update（可能有併發漏加風險）
   * - 保留作為保險，避免 RPC function/權限/部署問題導致 visit 直接壞掉
   */

  // 1) 先讀目前 profiles（若沒有就建立）
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, visit_count")
    .eq("id", userId)
    .maybeSingle();

  if (selErr) {
    return res.status(500).json({
      error: "profiles select failed",
      detail: selErr.message || String(selErr),
      mode: "fallback",
    });
  }

  // 2) 若不存在 → 先 insert 一筆（最小欄位）
  if (!existing) {
    const { error: insErr } = await supabase.from("profiles").insert([
      {
        id: userId,
        email: email || null,
        last_visit_at: nowIso,
        visit_count: 0,
      },
    ]);

    if (insErr) {
      return res.status(500).json({
        error: "profiles insert failed",
        detail: insErr.message || String(insErr),
        mode: "fallback",
      });
    }
  }

  // 3) 計算新 visit_count
  const prevCount = existing?.visit_count || 0;
  const nextCount = Number(prevCount) + 1;

  const { data: updated, error: updErr } = await supabase
    .from("profiles")
    .update({
      email: email || null,
      visit_count: nextCount,
      last_visit_at: nowIso,
    })
    .eq("id", userId)
    .select("id, visit_count, last_visit_at")
    .single();

  if (updErr) {
    return res.status(500).json({
      error: "profiles update failed",
      detail: updErr.message || String(updErr),
      mode: "fallback",
    });
  }

  return res.json({
    ok: true,
    userId,
    visit_count: updated.visit_count,
    last_visit_at: updated.last_visit_at,
    mode: "fallback",
  });
});

module.exports = router;

// backend/src/routes/visitRoute.js
// END PATH: backend/src/routes/visitRoute.js
