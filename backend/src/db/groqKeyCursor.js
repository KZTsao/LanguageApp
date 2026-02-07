// PATH: backend/src/db/groqKeyCursor.js
const { getSupabaseAdmin } = require("./supabaseAdmin");

/**
 * 功能：取得下一個 Groq key 起始 index（原子性）
 * - 依賴 Supabase RPC：next_groq_key_index(keys_len)
 */
async function getNextGroqKeyIndex(keysLen) {
  // 🔍 Debug 時才打開（避免 module load 階段就觸發）
  // console.trace("[groqKeyCursor] CALLED");

  if (!Number.isInteger(keysLen) || keysLen <= 0) {
    throw new Error("keysLen must be a positive integer");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("next_groq_key_index", {
    keys_len: keysLen,
  });

  if (error) throw error;
  return data;
}

module.exports = { getNextGroqKeyIndex };
// END PATH: backend/src/db/groqKeyCursor.js
