// backend/src/clients/groqClient.js
/**
 * 📘 文件說明
 * - 功能：Groq SDK Client（支援多把 API Key rotation + 例外情境 retry）
 * - 目的：
 *   1) 讀取多把 GROQ_API_KEY_###，以輪替方式分攤風險
 *   2) 支援特定錯誤（org restricted / rate limit / invalid_api_key）時自動切換 key 重試
 *   3) 啟動時可從 DB cursor（Supabase RPC）取得起始 key，並在 rotate 時盡量同步 DB cursor（Production 排查）
 *
 * ✅ 開發規範遵循：
 * - 保留既有 function，不刪除、不重排區塊
 * - 僅插入或局部替換
 * - 行數只增不減
 *
 * 🧾 異動紀錄（請保留舊紀錄）
 * - 2025-12-21
 *   1) 新增初始化狀態 initStatus（Production 排查）
 *   2) 新增 invalid_api_key(401) 判斷與 rotate + retry（避免卡死在壞 key）
 *   3) 新增 rotateWithDb：rotate 時嘗試透過 DB cursor 同步（避免重啟回到壞 cursor）
 */

const Groq = require("groq-sdk");

// ✅ DB cursor（Supabase RPC）
const { getNextGroqKeyIndex } = require("../db/groqKeyCursor");

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

// ✅ NEW: 判斷 Groq org 被限制（400 organization_restricted）
function isOrgRestrictedError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status !== 400) return false;

  const code = String(err?.code || "").toLowerCase();
  if (code === "organization_restricted") return true;

  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("organization has been restricted") || msg.includes("organization_restricted");
}

// ✅ NEW: 判斷 Groq API Key 無效（401 invalid_api_key）
function isInvalidApiKeyError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status !== 401) return false;

  const code = String(err?.code || "").toLowerCase();
  if (code === "invalid_api_key") return true;

  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("invalid api key") || msg.includes("invalid_api_key");
}

function createRotatingGroqClient() {
  const keys = parseKeysFromEnv();

  // ✅ NEW: 初始化狀態（Production 排查）
  // - 注意：不輸出完整 key，只輸出遮罩
  const initStatus = {
    module: "backend/src/clients/groqClient.js",
    provider: "groq",
    env: {
      hasGroqApiKey: Boolean(process.env.GROQ_API_KEY),
      hasGroqNumberedKeys: Object.keys(process.env).some((k) => /^GROQ_API_KEY_\d+$/.test(k)),
      keysCount: keys.length,
      sampleKeyMasked: keys.length ? maskKey(keys[0]) : "(empty)",
    },
    runtime: {
      nodeEnv: String(process.env.NODE_ENV || ""),
    },
    timestamp: new Date().toISOString(),
  };

  console.log("[groqClient] initStatus =", initStatus);

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

  // ✅ DB cursor 起始 index（只影響起點）
  if (keys.length > 1) {
    getNextGroqKeyIndex(keys.length)
      .then((dbIndex) => {
        const safeIndex =
          Number.isInteger(dbIndex) && dbIndex >= 0 ? dbIndex % keys.length : 0;
        index = safeIndex;

        console.log(
          `[groqClient] ▶ start from DB cursor: ${index + 1}/${keys.length} ${maskKey(
            keys[index]
          )}`
        );
      })
      .catch((err) => {
        console.warn("[groqClient] ⚠️ Failed to load DB cursor, fallback to 1/..", {
          message: String(err?.message || err),
        });
      });
  }

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

  /**
   * ✅ NEW: rotateWithDb（盡量同步 DB cursor）
   * - 用途：避免「壞 key + DB cursor 卡死」導致重啟後又回到壞 key
   * - 行為：
   *   1) 優先透過 getNextGroqKeyIndex(keys.length) 取得下一個 index（同時更新 DB cursor）
   *   2) 若 DB 失敗，fallback 到舊 rotate()
   *
   * ⚠️ 注意：
   * - 只在需要 rotate 的情境呼叫，不影響一般成功 request 流程
   */
  async function rotateWithDb(reason, err) {
    if (keys.length <= 1) return false;

    // 先記錄當下狀態（方便排查）
    const from = index;

    try {
      const dbIndex = await getNextGroqKeyIndex(keys.length);
      const safeIndex =
        Number.isInteger(dbIndex) && dbIndex >= 0 ? dbIndex % keys.length : 0;

      index = safeIndex;

      console.warn(
        `[groqClient] 🔄 Rotate API key (${reason}) via DB cursor ${from + 1}/${keys.length} ${maskKey(
          keys[from]
        )} -> ${index + 1}/${keys.length} ${maskKey(keys[index])}`
      );

      if (err) {
        console.warn("[groqClient] RotateWithDb triggered by error:", {
          status: err?.status ?? err?.response?.status,
          message: String(err?.message || "").slice(0, 200),
        });
      }

      return true;
    } catch (e) {
      console.warn("[groqClient] ⚠️ RotateWithDb failed, fallback to local rotate()", {
        message: String(e?.message || e),
      });
      return rotate(reason, err);
    }
  }

  const rotatingClient = {
    // ✅ NEW: 暴露 initStatus（若未來想在 admin route 顯示）
    getInitStatus: () => initStatus,
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
            // ✅ NEW: invalid_api_key(401) → 依序換 key 試到成功或試完一輪
            if (isInvalidApiKeyError(err) && keys.length > 1) {
              const maxTries = keys.length;
              for (let t = 0; t < maxTries; t++) {
                const didRotate = await rotateWithDb("invalid-api-key", err);
                if (!didRotate) break;

                const info2 = currentKeyInfo();
                console.log(
                  `[groqClient] ▶ retry (invalid-api-key) using key ${info2.index + 1}/${info2.total}: ${info2.masked}`
                );

                try {
                  return await clients[index].chat.completions.create(params);
                } catch (err2) {
                  // 若下一把也 invalid_api_key，就繼續 rotate；其他錯誤交回下面處理
                  if (isInvalidApiKeyError(err2)) {
                    err = err2;
                    continue;
                  }
                  err = err2;
                  break;
                }
              }
            }

            // ✅ NEW: organization_restricted → 依序換 key 試到成功或試完一輪
            if (isOrgRestrictedError(err) && keys.length > 1) {
              const maxTries = keys.length;
              for (let t = 0; t < maxTries; t++) {
                const didRotate = await rotateWithDb("org-restricted", err);
                if (!didRotate) break;

                const info2 = currentKeyInfo();
                console.log(
                  `[groqClient] ▶ retry (org-restricted) using key ${info2.index + 1}/${info2.total}: ${info2.masked}`
                );

                try {
                  return await clients[index].chat.completions.create(params);
                } catch (err2) {
                  // 若下一把也 org restricted，就繼續 rotate；其他錯誤交回下面處理
                  if (isOrgRestrictedError(err2)) {
                    err = err2;
                    continue;
                  }
                  // 不是 org restricted：交回原本流程（例如 rate limit）
                  err = err2;
                  break;
                }
              }
            }

            // 原本：rate limit 才 rotate + retry（保留）
            if (isRateLimitLikeError(err) && keys.length > 1) {
              // ✅ 改為優先同步 DB cursor（避免重啟回到壞 cursor）
              const didRotate = await rotateWithDb("rate-limit", err);
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

// backend/src/clients/groqClient.js
