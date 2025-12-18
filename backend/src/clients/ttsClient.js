// backend/src/clients/ttsClient.js
/**
 * 文件說明：
 * - 統一管理「文字 → 語音」的呼叫介面（TTS Client）
 * - 依環境變數 TTS_PROVIDER 決定使用哪個供應商（目前支援 google / none）
 * - 提供 Production 排查用的初始化狀態與關鍵 log（不輸出敏感 key）
 *
 * 異動紀錄：
 * - (原始檔) 統一管理「文字 → 語音」的呼叫介面；stub 版本
 * - 2025/12/18：
 *   1) 修正 CommonJS 環境不可使用 import 的問題（改為 require，避免 "Cannot use import.meta outside a module" 類型錯誤）
 *   2) 補齊 Google Cloud Text-to-Speech 實作：成功回傳 data:audio/mpeg;base64,...
 *   3) 加入初始化狀態 initStatus 與 logInitOnce，方便 Production 排查
 *   4) 加入安全 logger wrapper（logger.info 不存在時 fallback console）
 */

// 統一管理「文字 → 語音」的呼叫介面
// 目前是 stub，下一步才會接真正的雲端 TTS 服務

const logger = require("../utils/logger");

// =============================
// Google Cloud Text-to-Speech
// =============================
// DEPRECATED：CommonJS 環境不可直接使用 import，會造成 runtime syntax error
// import textToSpeech from "@google-cloud/text-to-speech";
const textToSpeech = require("@google-cloud/text-to-speech"); // ✅ 使用 require 以符合 CommonJS

// --------------------------------------------------
// Production 排查：初始化狀態（新增）
// --------------------------------------------------
const initStatus = {
  initLogged: false,
  lastProvider: "",
  lastLang: "",
  lastError: "",
  hasGoogleCredPath: false,
  hasGoogleCredJson: false,
  hasTtsProvider: false,
  hasTtsVoice: false,
  ts: Date.now(),
};

// --------------------------------------------------
// 安全 logger：避免 logger.info/logger.error 不存在導致再次炸掉（新增）
// --------------------------------------------------
function safeLogInfo(...args) {
  try {
    if (logger && typeof logger.info === "function") return logger.info(...args);
  } catch {}
  console.log(...args);
}

function safeLogWarn(...args) {
  try {
    if (logger && typeof logger.warn === "function") return logger.warn(...args);
  } catch {}
  console.warn(...args);
}

function safeLogError(...args) {
  try {
    if (logger && typeof logger.error === "function") return logger.error(...args);
  } catch {}
  console.error(...args);
}

// --------------------------------------------------
// 初始化狀態 log（只印一次，不含敏感資訊）（新增）
// --------------------------------------------------
function logInitOnce(provider, lang) {
  if (initStatus.initLogged) return;
  initStatus.initLogged = true;

  initStatus.lastProvider = String(provider || "");
  initStatus.lastLang = String(lang || "");
  initStatus.hasGoogleCredPath = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  initStatus.hasGoogleCredJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  initStatus.hasTtsProvider = !!process.env.TTS_PROVIDER;
  initStatus.hasTtsVoice = !!process.env.TTS_VOICE;

  safeLogInfo(
    "[ttsClient][init]",
    JSON.stringify({
      provider: initStatus.lastProvider,
      lang: initStatus.lastLang,
      hasTtsProvider: initStatus.hasTtsProvider,
      hasTtsVoice: initStatus.hasTtsVoice,
      hasGoogleCredPath: initStatus.hasGoogleCredPath,
      hasGoogleCredJson: initStatus.hasGoogleCredJson,
    })
  );
}

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

  // 初始化狀態（Production 排查）
  logInitOnce(provider, lang);

  safeLogInfo(
    `[ttsClient] synthesizeTTS called with provider=${provider}, lang=${lang}, length=${text.length}`
  );

  // --------------------------------------------------
  // Google TTS implementation (新增)
  // --------------------------------------------------
  if (provider === "google") {
    try {
      safeLogInfo("[ttsClient][google] start synthesize");

      // 建立 client（支援本機 path 或 Render JSON）
      const clientOptions = {};

      // Render 建議：使用 GOOGLE_APPLICATION_CREDENTIALS_JSON（整包 JSON 字串）
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        try {
          clientOptions.credentials = JSON.parse(
            process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
          );
        } catch (e) {
          initStatus.lastError = String(e?.message || e);
          safeLogError(
            "[ttsClient][google] failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON",
            e
          );
          return { audioContent: null, mimeType: "audio/mpeg", provider: "google" };
        }
      }

      // 本機建議：使用 GOOGLE_APPLICATION_CREDENTIALS（檔案路徑）
      // Google SDK 會自動讀取該環境變數，不需要額外處理

      const client = new textToSpeech.TextToSpeechClient(clientOptions);

      const request = {
        input: { text },
        voice: {
          languageCode: lang || "de-DE",
          name: process.env.TTS_VOICE || `${lang || "de-DE"}-Wavenet-D`,
        },
        audioConfig: {
          audioEncoding: "MP3",
        },
      };

      const [response] = await client.synthesizeSpeech(request);

      if (!response || !response.audioContent) {
        safeLogError("[ttsClient][google] no audioContent returned");
        return { audioContent: null, mimeType: "audio/mpeg", provider: "google" };
      }

      const base64Audio = Buffer.from(response.audioContent).toString("base64");

      safeLogInfo(`[ttsClient][google] success, bytes=${base64Audio.length}`);

      return {
        provider: "google",
        mimeType: "audio/mpeg",
        audioContent: `data:audio/mpeg;base64,${base64Audio}`,
      };
    } catch (err) {
      initStatus.lastError = String(err?.message || err);
      safeLogError("[ttsClient][google] error", err);
      return { audioContent: null, mimeType: "audio/mpeg", provider: "google" };
    }
  }

  // --------------------------------------------------
  // 其他 provider：維持既有行為（none/stub）
  // --------------------------------------------------
  safeLogWarn(`[ttsClient] provider=${provider} not implemented; returning null audio`);
  return { audioContent: null, mimeType: "audio/mpeg", provider: String(provider) };
}

module.exports = {
  synthesizeTTS,
};

// backend/src/clients/ttsClient.js
