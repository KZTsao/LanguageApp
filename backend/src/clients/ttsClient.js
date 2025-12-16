// backend/src/clients/ttsClient.js
// 統一管理「文字 → 語音」的呼叫介面
// 目前是 stub，下一步才會接真正的雲端 TTS 服務

const logger = require("../utils/logger");

/**
 * 將文字轉成語音（雲端 TTS 的抽象介面）
 *
 * @param {Object} params
 * @param {string} params.text  要朗讀的文字
 * @param {string} [params.lang="de-DE"] 語言代碼，例如 "de-DE"
 * @returns {Promise<{ audioContent: string | null, mimeType: string, provider: string }>}
 */
async function synthesizeTTS({ text, lang = "de-DE" }) {
  if (!text || typeof text !== "string") {
    throw new Error("synthesizeTTS: `text` is required and must be a string");
  }

  const provider = process.env.TTS_PROVIDER || "none";

  logger.info(
    `[ttsClient] synthesizeTTS called with provider=${provider}, lang=${lang}, length=${text.length}`
  );

  // ⚠️ 目前先做成 stub：
  // - 還沒有真正呼叫任何雲端 TTS
  // - 只回傳 null，方便之後在 route 裡區分「還沒設定好 TTS」
  return {
    audioContent: null, // 之後會放 base64 音訊
    mimeType: "audio/mpeg", // 預設先用 mp3，之後依 provider 調整
    provider,
  };
}

module.exports = {
  synthesizeTTS,
};
