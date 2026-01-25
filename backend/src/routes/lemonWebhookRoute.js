// backend/src/routes/lemonWebhookRoute.js
/**
 * Lemon Squeezy Webhook Route
 *
 * 功能：
 * - 接收 Lemon Squeezy webhook
 * - 驗證 X-Signature（HMAC SHA256）
 * - 依 variant_id 更新 profiles.plan（monthly / annual）
 * - 取消/退款/到期 → 立即降回 free
 *
 * 最終路徑：
 * POST /api/webhooks/lemon
 *
 * 重要：Lemon 的自訂 user id 會在 webhook payload 的 meta.custom_data 出現
 * 參考官方說明：Passing custom data / Webhook requests
 * - checkout link: ?checkout[custom][user_id]=<uuid>
 * - webhook: meta.custom_data.user_id
 */

const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const { getSupabaseAdmin } = require("../db/supabaseAdmin");

const VARIANT_TO_PLAN = {
  1249899: "annual",
  1249905: "monthly",
};

const DOWNGRADE_EVENTS = new Set([
  "subscription_cancelled",
  "subscription_expired",
  "order_refunded",
]);

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ⚠️ 必須用 raw body 做驗簽（不能依賴外層 express.json）
router.post("/webhooks/lemon", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const secret = process.env.LEMON_WEBHOOK_SECRET;
    if (!secret) return res.status(500).send("Missing LEMON_WEBHOOK_SECRET");

    const signature = req.headers["x-signature"];
    if (!signature) return res.status(400).send("Missing X-Signature");

    const rawBody = req.body; // Buffer

    const computed = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (!timingSafeEqualStr(computed, signature)) {
      return res.status(401).send("Invalid signature");
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).send("Invalid JSON");
    }

    const eventName = event?.event_name;
    const attrs = event?.data?.attributes || {};
    const meta = event?.meta || {};
    const customData = meta?.custom_data || {};

    // ✅ 取 user_id（你系統 profiles.id）
    // 優先：meta.custom_data.user_id（官方）
    // fallback：attributes.external_id（若你未來改成別種帶法）
    const userId = customData.user_id || attrs.external_id || null;

    // ✅ 取 variant_id
    const variantId = Number(attrs.variant_id);

    if (!userId) return res.status(200).end();

    const supabase = getSupabaseAdmin();

    // 1) 取消/退款/到期：立即降回 free
    if (DOWNGRADE_EVENTS.has(eventName)) {
      const { error } = await supabase
        .from("profiles")
        .update({ plan: "free" })
        .eq("id", userId);

      if (error) {
        console.error("[lemonWebhook] downgrade error:", error);
        return res.status(500).send("Supabase update failed");
      }

      return res.status(200).end();
    }

    // 2) 建立/更新：依 variant_id 升級
    if (eventName === "subscription_created" || eventName === "subscription_updated") {
      const plan = VARIANT_TO_PLAN[variantId];
      if (!plan) return res.status(200).end();

      const { error } = await supabase
        .from("profiles")
        .update({ plan })
        .eq("id", userId);

      if (error) {
        console.error("[lemonWebhook] upgrade error:", error);
        return res.status(500).send("Supabase update failed");
      }

      return res.status(200).end();
    }

    return res.status(200).end();
  } catch (err) {
    console.error("[lemonWebhook] handler error:", err);
    return res.status(500).send("Webhook handler error");
  }
});

module.exports = router;

// backend/src/routes/lemonWebhookRoute.js
