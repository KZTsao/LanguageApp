// backend/src/routes/unitsRoute.js

/**
 * Units / Reader API
 * - 讀取 unit（含 teaser_at / publish_at 鎖定狀態）
 * - 讀取 pages（每頁一張圖）與 sentences（逐句音檔）
 *
 * 注意：
 * - 這支 route 只「新增」不影響既有功能；是否掛到 server 由你決定。
 *
 * 依賴：
 * - authMiddleware（可選）：若要支援「admin 可讀未上架」，請在 server 掛時加上 authMiddleware（或在此檔自行判斷 header）
 */

const express = require("express");
const { getSupabaseAdminClient } = require("../db/supabaseAdmin");

const router = express.Router();

/** 解析 admin emails：支援 SUPPORT_ADMIN_EMAILS 或 VITE_SUPPORT_ADMIN_EMAILS */
function getAdminEmailSet() {
  const raw =
    process.env.SUPPORT_ADMIN_EMAILS ||
    process.env.VITE_SUPPORT_ADMIN_EMAILS ||
    "";
  return new Set(
    String(raw)
      .split(/[,\n]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isAdminByEmail(email) {
  if (!email) return false;
  const set = getAdminEmailSet();
  return set.has(String(email).toLowerCase());
}

function nowIso() {
  return new Date().toISOString();
}

/** GET /api/units
 * query:
 * - state=available|teaser|all (default available)
 *
 * 回傳：
 * - items: [{ id,title,teaser_at,publish_at,lock_state }]
 */
router.get("/", async (req, res) => {
  try {
    const sb = getSupabaseAdminClient();
    const state = (req.query.state || "available").toString();

    // 你可以把 table 名換成你實際用的（此處先用 units）
    let q = sb
      .from("units")
      .select("id,title,teaser_at,publish_at,created_at")
      .order("publish_at", { ascending: false });

    const now = new Date();

    if (state === "available") {
      q = q.lte("publish_at", nowIso());
    } else if (state === "teaser") {
      q = q.lte("teaser_at", nowIso()).gt("publish_at", nowIso());
    } else if (state === "all") {
      // no filter
    } else {
      return res.status(400).json({ error: "Invalid state" });
    }

    const { data, error } = await q;
    if (error) throw error;

    const items = (data || []).map((u) => {
      const teaserAt = u.teaser_at ? new Date(u.teaser_at) : null;
      const publishAt = u.publish_at ? new Date(u.publish_at) : null;

      let lock_state = "available";
      if (publishAt && now < publishAt) {
        lock_state = teaserAt && now >= teaserAt ? "teaser" : "hidden";
      }

      return {
        id: u.id,
        title: u.title,
        teaser_at: u.teaser_at,
        publish_at: u.publish_at,
        lock_state,
      };
    });

    // 預設：不回 hidden（避免前端顯示未預告）
    const filtered =
      state === "all" ? items : items.filter((x) => x.lock_state !== "hidden");

    return res.json({ items: filtered });
  } catch (e) {
    console.error("[unitsRoute] list failed:", e);
    return res.status(500).json({ error: "Units list failed" });
  }
});

/** GET /api/units/:id
 * - 未上架：一般使用者回 403 + lock_state
 * - admin（以 req.authUser.email 判定）可讀未上架
 *
 * 回傳：
 * - unit: {id,title,teaser_at,publish_at,lock_state}
 * - pages: [{page_no,image_url}]
 * - sentences: [{page_no,idx,text,audio_url}]
 */
router.get("/:id", async (req, res) => {
  try {
    const sb = getSupabaseAdminClient();
    const id = req.params.id;

    const { data: unit, error: uerr } = await sb
      .from("units")
      .select("id,title,teaser_at,publish_at,meta")
      .eq("id", id)
      .maybeSingle();

    if (uerr) throw uerr;
    if (!unit) return res.status(404).json({ error: "Unit not found" });

    const now = new Date();
    const teaserAt = unit.teaser_at ? new Date(unit.teaser_at) : null;
    const publishAt = unit.publish_at ? new Date(unit.publish_at) : null;

    let lock_state = "available";
    if (publishAt && now < publishAt) {
      lock_state = teaserAt && now >= teaserAt ? "teaser" : "hidden";
    }

    const email = req.authUser && req.authUser.email;
    const isAdmin = isAdminByEmail(email);

    if (lock_state !== "available" && !isAdmin) {
      // 預告可見但鎖住：回 403 讓前端顯示鎖定
      return res.status(403).json({
        error: "Locked",
        lock_state,
        teaser_at: unit.teaser_at,
        publish_at: unit.publish_at,
      });
    }

    // pages
    const { data: pages, error: perr } = await sb
      .from("unit_pages")
      .select("page_no,image_url")
      .eq("unit_id", id)
      .order("page_no", { ascending: true });

    if (perr) throw perr;

    // sentences
    const { data: sentences, error: serr } = await sb
      .from("unit_sentences")
      .select("page_no,idx,text,audio_url")
      .eq("unit_id", id)
      .order("idx", { ascending: true });

    if (serr) throw serr;

    return res.json({
      unit: {
        id: unit.id,
        title: unit.title,
        teaser_at: unit.teaser_at,
        publish_at: unit.publish_at,
        lock_state,
      },
      pages: pages || [],
      sentences: sentences || [],
    });
  } catch (e) {
    console.error("[unitsRoute] get failed:", e);
    return res.status(500).json({ error: "Unit fetch failed" });
  }
});

module.exports = router;

// backend/src/routes/unitsRoute.js
