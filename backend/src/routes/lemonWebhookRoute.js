// backend/src/routes/lemonWebhookRoute.js
/**
 * Lemon Squeezy Webhook Route
 *
 * 功能：
 * - 接收 Lemon Squeezy webhook
 * - 驗證 X-Signature（HMAC SHA256）
 * - 依 variant_id 更新 profiles.plan
 * - 取消 / 退款 / 到期 → 立即降回 free
 *
 * 掛載路徑：
 * POST /api/webhooks/lemon
 */

const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const { getSupabaseAdmin } = require("../db/supabaseAdmin");

// ⚠️ 必須用 raw body，不能用 express.json()
router.post(
  "/webhooks/lemon",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    try {
      const secret = process.env.LEMON_WEBHOOK_SECRET;
      if (!secret) {
        return res.status(500).send("Missing LEMON_WEBHOOK_SECRET");
      }

      const signature = req.headers["x-signature"];
      if (!signature) {
        return res.status(400).send("Missing X-Signature");
      }

      const rawBody = req.body;

      const computed = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      // timing-safe compare
      const sigBuf = Buffer.from(signature, "utf8");
      const cmpBuf = Buffer.from(computed, "utf8");
      if (
        sigBuf.length !== cmpBuf.length ||
        !crypto.timingSafeEqual(sigBuf, cmpBuf)
      ) {
        return res.status(401).send("Invalid signature");
      }

      const event = JSON.parse(rawBody.toString("utf8"));
      const eventName = event?.event_name;
      const attrs = event?.data?.attributes || {};

      // Lemon external_id = profiles.id
      const userId = attrs.external_id;
      const variantId = Number(attrs.variant_id);

      if (!userId) {
        // 沒 external_id 不處理，但回 200 避免 Lemon 重送
        return res.status(200).end();
      }

      const supabase = getSupabaseAdmin();

      // 取消 / 退款 / 到期 → 立即降級
      if (
        [
          "subscription_cancelled",
          "subscription_expired",
          "order_refunded",
        ].includes(eventName)
      ) {
        await supabase
          .from("profiles")
          .update({ plan: "free" })
          .eq("id", userId);

        return res.status(200).end();
      }

      // variant_id → plan
      let plan = null;
      if (variantId === 1249899) plan = "annual";
      if (variantId === 1249905) plan = "monthly";

      if (
        plan &&
        (eventName === "subscription_created" ||
          eventName === "subscription_updated")
      ) {
        await supabase
          .from("profiles")
          .update({ plan })
          .eq("id", userId);
      }

      return res.status(200).end();
    } catch (err) {
      console.error("[lemonWebhook] error:", err);
      return res.status(500).send("Webhook handler error");
    }
  }
);

module.exports = router;

// backend/src/routes/lemonWebhookRoute.js
