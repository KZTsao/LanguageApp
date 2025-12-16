const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const elevenTTS = require("../clients/elevenTTS");

const {
  ttsMemoryCache,
  makeTtsCacheKey,
} = require("../clients/ttsMemoryCache");

const { logUsage } = require("../utils/usageLogger");

// 嘗試從 Authorization Bearer token 解析出 user（不強制登入）
// 規則：
// 1) 有 SUPABASE_JWT_SECRET → 先 verify
// 2) verify 失敗或沒 secret → fallback 用 decode（只用來記錄用量）
function tryGetAuthUser(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  // ① 優先嘗試 verify（若環境變數存在）
  if (process.env.SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      return {
        id: decoded.sub || "",
        email: decoded.email || "",
        source: "verify",
      };
    } catch (e) {
      console.warn(
        "[tryGetAuthUser] jwt.verify failed, fallback to decode"
      );
    }
  }

  // ② fallback：只 decode（不驗證，用量歸戶用）
  try {
    const decoded = jwt.decode(token);
    if (!decoded) return null;

    return {
      id: decoded.sub || "",
      email: decoded.email || "",
      source: "decode",
    };
  } catch {
    return null;
  }
}

router.post("/", async (req, res) => {
  console.log("[/api/tts] hit");

  try {
    const { text, lang = process.env.ELEVEN_LANGUAGE || "de" } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing `text` field" });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        error: "Text too long (max 1000 chars)",
      });
    }

    const authUser = tryGetAuthUser(req);

    // ★ 記錄用量（若有登入，順便記 userId）
    logUsage({
      endpoint: "/api/tts",
      charCount: text.length,
      kind: "tts",
      ip: req.ip,
      userId: authUser?.id || "",
      email: authUser?.email || "",
    });

    // ------------- Cache Key -------------
    const voiceId = process.env.ELEVEN_VOICE_ID || "";
    const cacheKey = makeTtsCacheKey(text, lang, voiceId);

    // ------------- Cache HIT -------------
    const cached = ttsMemoryCache.get(cacheKey);
    if (cached) {
      console.log("[/api/tts] TTS CACHE HIT");
      return res.json({
        audioContent: cached,
        provider: "elevenlabs",
        lang,
        cache: "HIT",
      });
    }

    // ------------- Cache MISS -------------
    console.log("[/api/tts] MISS → calling ElevenLabs");
    const audioBase64 = await elevenTTS(text, lang);

    ttsMemoryCache.set(cacheKey, audioBase64);

    return res.json({
      audioContent: audioBase64,
      provider: "elevenlabs",
      lang,
      cache: "MISS",
    });
  } catch (err) {
    console.error("[/api/tts] ERROR:", err);
    return res.status(500).json({ error: "TTS server error" });
  }
});

module.exports = router;
