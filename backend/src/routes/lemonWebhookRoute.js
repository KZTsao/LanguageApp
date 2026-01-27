// backend/src/routes/lemonWebhookRoute.js

const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const { getSupabaseAdmin } = require("../db/supabaseAdmin");

// 會導致「訂閱不可用」的事件 → 降級
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

// ⚠️ 一定要用 raw body，否則驗簽會失敗
router.post(
  "/webhooks/lemon",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    try {
      const secret = process.env.LEMON_WEBHOOK_SECRET;
      if (!secret) return res.status(500).send("Missing LEMON_WEBHOOK_SECRET");

      const signature = req.headers["x-signature"];
      if (!signature) return res.status(400).send("Missing X-Signature");

      const rawBody = req.body;

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
      const data = event?.data || {};
      const attrs = data?.attributes || {};
      const meta = event?.meta || {};
      const customData = meta?.custom_data || {};

      // 🔑 對回你系統的 user（profiles.id）
      const userId =
        customData.external_id ||
        customData.user_id ||
        attrs.external_id ||
        null;

      if (!userId) {
        // 沒 user 就直接吞掉（避免 Lemon 重送）
        return res.status(200).end();
      }

      // ✅ 取訂閱資訊（能抓多少抓多少；不足就留 null）
      const variantId = attrs?.variant_id != null ? Number(attrs.variant_id) : null;

      // Lemon subscription event：多數情況 data.id 即 subscription resource id（字串）
      const subscriptionId =
        data?.id != null
          ? String(data.id)
          : attrs?.subscription_id != null
            ? String(attrs.subscription_id)
            : null;

      const currentPeriodEnd =
        attrs?.current_period_end ||
        attrs?.renews_at ||
        attrs?.ends_at ||
        null;

      const status =
        attrs?.status ||
        (DOWNGRADE_EVENTS.has(eventName)
          ? "inactive"
          : (eventName === "subscription_created" || eventName === "subscription_updated")
            ? "active"
            : null);

      const supabase = getSupabaseAdmin();

      // 0) 事件歷史（append-only）— 寫失敗不阻斷 webhook（避免重送風暴）
      try {
        await supabase.from("user_subscription_events").insert({
          user_id: userId,
          provider: "lemon",
          event_name: eventName || "unknown",
          variant_id: variantId,
          subscription_id: subscriptionId,
          payload: event,
        });
      } catch (e) {
        console.error("[lemonWebhook] insert event exception:", e);
      }

      // 1) 最新訂閱快照（每 user 1 筆）
      {
        const { error } = await supabase.from("user_subscriptions").upsert(
          {
            user_id: userId,
            provider: "lemon",
            status,
            variant_id: variantId,
            subscription_id: subscriptionId,
            current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

        if (error) {
          console.error("[lemonWebhook] upsert subscription error:", error);
          return res.status(500).send("Supabase upsert failed");
        }
      }

      // 2) profiles.plan 當快取：free / pro
      // 1️⃣ 到期 / 取消 / 退款 → free
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

      // 2️⃣ 建立 / 更新訂閱 → pro
      if (
        eventName === "subscription_created" ||
        eventName === "subscription_updated"
      ) {
        const { error } = await supabase
          .from("profiles")
          .update({ plan: "pro" })
          .eq("id", userId);

        if (error) {
          console.error("[lemonWebhook] upgrade error:", error);
          return res.status(500).send("Supabase update failed");
        }

        return res.status(200).end();
      }

      // 其他事件：直接 ACK
      return res.status(200).end();
    } catch (err) {
      console.error("[lemonWebhook] handler error:", err);
      return res.status(500).send("Webhook handler error");
    }
  }
);

module.exports = router;

// backend/src/routes/lemonWebhookRoute.js
