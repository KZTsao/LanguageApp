// backend/src/routes/billingRoute.js
/**
 * Billing Route（Lemon Squeezy）
 *
 * 目的：
 * - 由後端產生「付款連結」，並把你系統的使用者 id 帶入 Lemon（custom data）
 * - 讓 webhook 能回寫 profiles.plan
 *
 * 最終路徑：
 * POST /api/billing/checkout-url
 *
 * Request Body：
 * { "plan": "monthly" | "annual" }
 *
 * Response：
 * { "url": "https://...lemonsqueezy.com/checkout/buy/..." }
 *
 * 需求 env：
 * - LEMON_STORE_SLUG：你的 Lemon store 網域前綴，例如 https://[SLUG].lemonsqueezy.com
 * - LEMON_VARIANT_ID_MONTHLY：月繳 variant id（你的是 1249905）
 * - LEMON_VARIANT_ID_ANNUAL：年繳 variant id（你的是 1249899）
 *
 * Auth：
 * - 需帶 Authorization: Bearer <supabase access_token>
 * - 後端用 supabaseAdmin.auth.getUser(token) 取回 user.id（= profiles.id）
 */

const express = require("express");
const router = express.Router();

const { getSupabaseAdmin } = require("../db/supabaseAdmin");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function pickVariantId(plan) {
  const m = Number(process.env.LEMON_VARIANT_ID_MONTHLY || "1249905");
  const a = Number(process.env.LEMON_VARIANT_ID_ANNUAL || "1249899");
  if (plan === "monthly") return m;
  if (plan === "annual") return a;
  return null;
}

async function requireUserIdFromBearer(req) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const token = m[1];
  const supabase = getSupabaseAdmin();

  // service role client 也支援用 JWT 取回 user（用於 server-side verify）
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;

  return data?.user?.id || null;
}

router.post("/checkout-url", express.json(), async (req, res) => {
  try {
    const storeSlug = requireEnv("LEMON_STORE_SLUG"); // 例如：my-store
    const plan = (req.body && req.body.plan) || "monthly";

    const variantId = pickVariantId(plan);
    if (!variantId) return res.status(400).json({ error: "Invalid plan" });

    const userId = await requireUserIdFromBearer(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ✅ 透過 query string 傳 custom data（Lemon 官方支援）
    // checkout[custom][user_id]=<uuid> 會在 webhook 的 meta.custom_data 出現
    const url =
      `https://${storeSlug}.lemonsqueezy.com/checkout/buy/${variantId}` +
      `?checkout[custom][user_id]=${encodeURIComponent(userId)}`;

    return res.json({ url });
  } catch (err) {
    console.error("[billingRoute] error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

// backend/src/routes/billingRoute.js
