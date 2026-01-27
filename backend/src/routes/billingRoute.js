// backend/src/routes/billingRoute.js
/**
 * Billing Route（Lemon Squeezy）
 *
 * 目的：
 * - 由後端「呼叫 Lemon API 建立 Checkout」，回傳 checkout URL
 * - 把你系統的使用者 id 帶進 checkout_data.custom.external_id（用於 webhook 對應 profiles.id）
 *
 * 最終路徑：
 * POST /api/billing/checkout-url
 *
 * Request Body：
 * { "plan": "monthly" | "annual" }
 *
 * Response：
 * { "url": "https://...lemonsqueezy.com/checkout/custom/<uuid>?..." }
 *
 * 需求 env：
 * - LEMON_API_KEY：Lemon API Key（Test/Live 要用各自模式下建立的 key）
 * - LEMON_STORE_ID：Lemon Store ID（數字，例如 12345）
 * - LEMON_VARIANT_ID_MONTHLY：月繳 variant id（數字）
 * - LEMON_VARIANT_ID_ANNUAL：年繳 variant id（數字）
 * - (optional) LEMON_TEST_MODE：true/false（若想強制用 test mode 建 checkout）
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

  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;

  return data?.user?.id || null;
}

async function lemonCreateCheckout({ apiKey, storeId, variantId, externalId, testMode }) {
  if (typeof fetch !== "function") {
    throw new Error("global fetch is not available (Node 18+ required)");
  }

  // Lemon API: Create a Checkout
  // https://docs.lemonsqueezy.com/api/checkouts/create-checkout
  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        // 只顯示你指定的這個方案，避免使用者在 checkout 裡再選方案
        product_options: {
          enabled_variants: [variantId],
        },
        checkout_data: {
          custom: {
            // ✅ 你的 profiles.id（uuid）
            external_id: externalId,
          },
        },
      },
      relationships: {
        store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: String(variantId) } },
      },
    },
  };

  // 允許你用 env 強制 test mode（可選）
  if (testMode === true) {
    payload.data.attributes.test_mode = true;
  } else if (testMode === false) {
    payload.data.attributes.test_mode = false;
  }

  const resp = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = null;
  }

  if (!resp.ok) {
    const detail =
      (json && (json.error || json.message || json.errors)) || text || `HTTP ${resp.status}`;
    const err = new Error(`Lemon create checkout failed: ${detail}`);
    err.status = resp.status;
    throw err;
  }

  const url = json?.data?.attributes?.url;
  if (!url) throw new Error("Lemon create checkout failed: missing data.attributes.url");

  return { url, checkoutId: json?.data?.id || null };
}

router.post("/checkout-url", express.json(), async (req, res) => {
  try {
    const apiKey = requireEnv("LEMON_API_KEY");
    const storeId = Number(requireEnv("LEMON_STORE_ID"));
    const plan = (req.body && req.body.plan) || "monthly";

    const variantId = pickVariantId(plan);
    if (!variantId) return res.status(400).json({ error: "Invalid plan" });

    const userId = await requireUserIdFromBearer(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // optional: 讓你用 env 控制是否強制 test_mode
    const rawTest = process.env.LEMON_TEST_MODE;
    const testMode =
      rawTest == null
        ? undefined
        : String(rawTest).toLowerCase() === "true"
          ? true
          : String(rawTest).toLowerCase() === "false"
            ? false
            : undefined;

    const { url } = await lemonCreateCheckout({
      apiKey,
      storeId,
      variantId,
      externalId: userId,
      testMode,
    });

    return res.json({ url });
  } catch (err) {
    console.error("[billingRoute] error:", err);

    // 把 Lemon API error 也帶回去，方便你用 curl 一眼看懂
    const status = err && err.status ? err.status : 500;
    const msg = err && err.message ? err.message : "Server error";
    return res.status(status).json({ error: msg });
  }
});

module.exports = router;

// backend/src/routes/billingRoute.js
