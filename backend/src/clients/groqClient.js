// groqClient.js (FULL FILE REPLACE)
const Groq = require("groq-sdk");

/**
 * Supported env formats:
 *  - GROQ_API_KEY=xxx (single, fallback)
 *  - GROQ_API_KEY_001=xxx
 *    GROQ_API_KEY_002=xxx
 *    ...
 *
 * Priority:
 *  1) Numbered keys (GROQ_API_KEY_001+)
 *  2) Single GROQ_API_KEY
 */

function maskKey(key) {
  const k = String(key || "");
  if (!k) return "(empty)";
  return k.slice(0, 6) + "******";
}

function parseKeysFromEnv() {
  // 1️⃣ numbered keys: GROQ_API_KEY_001, _002, ...
  const numbered = Object.keys(process.env)
    .filter((k) => /^GROQ_API_KEY_\d+$/.test(k))
    .sort((a, b) => {
      const na = parseInt(a.split("_").pop(), 10);
      const nb = parseInt(b.split("_").pop(), 10);
      return na - nb;
    })
    .map((k) => process.env[k])
    .filter(Boolean);

  if (numbered.length > 0) {
    return numbered;
  }

  // 2️⃣ fallback: single key
  const single = String(process.env.GROQ_API_KEY || "").trim();
  return single ? [single] : [];
}

function isRateLimitLikeError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 429) return true;

  const code = String(err?.code || "").toLowerCase();
  if (code.includes("rate") || code.includes("quota") || code.includes("limit")) return true;

  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("rate-limit") ||
    msg.includes("quota") ||
    msg.includes("too many requests") ||
    msg.includes("limit exceeded")
  );
}

function createRotatingGroqClient() {
  const keys = parseKeysFromEnv();

  if (!keys.length) {
    console.warn(
      "[groqClient] ❌ No GROQ_API_KEY or GROQ_API_KEY_### found. Client will fail."
    );
  } else if (keys.length === 1) {
    console.log("[groqClient] Using API Key:", maskKey(keys[0]));
  } else {
    console.log(
      `[groqClient] Using ${keys.length} API keys (numbered rotation). Current: ${maskKey(
        keys[0]
      )}`
    );
  }

  let index = 0;

  function currentKey() {
    return keys[index] || "";
  }

  function currentKeyInfo() {
    return {
      index,
      total: keys.length,
      masked: maskKey(currentKey()),
    };
  }

  const clients = keys.map((key) => new Groq({ apiKey: key }));

  function rotate(reason, err) {
    if (keys.length <= 1) return false;

    const from = index;
    index = (index + 1) % keys.length;

    console.warn(
      `[groqClient] 🔄 Rotate API key (${reason}) ${from + 1}/${keys.length} ${maskKey(
        keys[from]
      )} -> ${index + 1}/${keys.length} ${maskKey(keys[index])}`
    );

    if (err) {
      console.warn("[groqClient] Rotate triggered by error:", {
        status: err?.status ?? err?.response?.status,
        message: String(err?.message || "").slice(0, 200),
      });
    }

    return true;
  }

  const rotatingClient = {
    // for backend debug / frontend pass-through later
    getCurrentKeyInfo: () => currentKeyInfo(),

    chat: {
      completions: {
        create: async (params) => {
          const info = currentKeyInfo();
          console.log(
            `[groqClient] ▶ request using key ${info.index + 1}/${info.total}: ${info.masked}`
          );

          try {
            return await clients[index].chat.completions.create(params);
          } catch (err) {
            if (isRateLimitLikeError(err) && keys.length > 1) {
              const didRotate = rotate("rate-limit", err);
              if (didRotate) {
                const info2 = currentKeyInfo();
                console.log(
                  `[groqClient] ▶ retry using key ${info2.index + 1}/${info2.total}: ${info2.masked}`
                );
                return await clients[index].chat.completions.create(params);
              }
            }
            throw err;
          }
        },
      },
    },
  };

  return rotatingClient;
}

module.exports = createRotatingGroqClient();
