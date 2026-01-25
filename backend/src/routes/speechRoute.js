// backend/src/routes/speechRoute.js

/**
 * 文件說明：
 * - Speech-to-Text（ASR）API：提供 coverage 模式用的轉文字能力
 * - 不做 streaming；前端以 pause 分段送出 blob
 *
 * Endpoint:
 * - POST /api/speech/asr   (multipart/form-data)
 *
 * Request fields:
 * - audio: file (webm/ogg/wav/flac)
 * - lang: "de-DE" (optional, default de-DE)
 * - mode: "coverage" (optional, for future routing)
 *
 * Response (minimum):
 * { ok: true, transcript: "...", confidence: 0.xx, words?: [{ w, confidence }] }
 */

const express = require("express");
const multer = require("multer");
const { SpeechClient } = require("@google-cloud/speech");

const { logUsage } = require("../utils/usageLogger");

// 使用 memory storage（不落地、不保存檔案）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024, // 12MB：coverage 分段通常很短，先保守
  },
});

const router = express.Router();

// 共享 Speech client（ADC：GOOGLE_APPLICATION_CREDENTIALS）
const speechClient = new SpeechClient();

/** 依 mimetype 猜測 encoding（MVP：以 MediaRecorder 常見格式為主） */
function guessEncodingByMime(mime = "") {
  const m = (mime || "").toLowerCase();
  if (m.includes("audio/webm") || m.includes("video/webm") || m.includes("webm")) return "WEBM_OPUS";
  if (m.includes("audio/ogg") || m.includes("ogg")) return "OGG_OPUS";
  if (m.includes("audio/wav") || m.includes("wav")) return null; // WAV/FLAC 可不指定 encoding
  if (m.includes("audio/flac") || m.includes("flac")) return null;
  return null;
}

/** coverage 用：把 words 統一成 [{w, confidence}]，沒有 confidence 就不塞 */
function normalizeWords(words) {
  if (!Array.isArray(words)) return undefined;
  const out = [];
  for (const w of words) {
    if (!w) continue;
    const token = (w.word || "").trim();
    if (!token) continue;
    const rec = { w: token };
    if (typeof w.confidence === "number") rec.confidence = w.confidence;
    out.push(rec);
  }
  return out.length ? out : undefined;
}

router.post("/asr", upload.single("audio"), async (req, res) => {
  const startedAt = Date.now();

  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ ok: false, error: "NO_AUDIO" });
    }

    const lang = (req.body && req.body.lang) || "de-DE";
    const mode = (req.body && req.body.mode) || "coverage";

    // 這裡不做 budget 檢查（MVP）：前端會先檢查；後端先記 log
    // 若你之後要加：可在這裡讀 user usage（seconds）並 reject

    const mimeType = file.mimetype || "";
    const encoding = guessEncodingByMime(mimeType);

    // Opus 類型通常是 48k，先給預設（可日後由前端附 sampleRate）
    const sampleRateHertzFromBody =
      req.body && req.body.sampleRateHertz ? Number(req.body.sampleRateHertz) : NaN;

    const config = {
      languageCode: lang,
      enableAutomaticPunctuation: true,
      // word-level（可選）：有就回傳 words，沒有就只回 transcript
      enableWordTimeOffsets: false,
      enableWordConfidence: true,
    };

    if (encoding) {
      config.encoding = encoding;
      config.sampleRateHertz = Number.isFinite(sampleRateHertzFromBody)
        ? sampleRateHertzFromBody
        : 48000;
    }

    const request = {
      config,
      audio: { content: file.buffer.toString("base64") },
    };

    const [response] = await speechClient.recognize(request);

    const results = Array.isArray(response.results) ? response.results : [];
    const transcripts = [];
    let bestConfidence = 0;
    let bestWords = undefined;

    for (const r of results) {
      const alt = r && Array.isArray(r.alternatives) ? r.alternatives[0] : null;
      if (!alt) continue;
      if (typeof alt.transcript === "string" && alt.transcript.trim()) {
        transcripts.push(alt.transcript.trim());
      }
      if (typeof alt.confidence === "number" && alt.confidence > bestConfidence) {
        bestConfidence = alt.confidence;
      }
      // words 只拿第一個有的（避免回傳過大）
      if (!bestWords && Array.isArray(alt.words)) {
        bestWords = normalizeWords(alt.words);
      }
    }

    const transcript = transcripts.join(" ").trim();

    // 記錄 ASR 用量（seconds 以 server 端估算：用處理時間當 proxy；之後可換成 blob duration）
    const elapsedMs = Date.now() - startedAt;
    const usedSeconds = Math.max(1, Math.round(elapsedMs / 1000)); // MVP：至少 1 秒

    logUsage({
      endpoint: "/api/speech/asr",
      kind: "asr",
      charCount: 0,
      usedSeconds,
      meta: {
        mode,
        lang,
        mimeType,
        encoding: encoding || "",
      },
      // userId/email/ip：若你之後有 auth middleware，可補上
      ip: req.ip || "",
      userId: (req.user && req.user.id) || "",
      email: (req.user && req.user.email) || "",
    });

    return res.json({
      ok: true,
      transcript,
      confidence: transcript ? Number(bestConfidence || 0) : 0,
      ...(bestWords ? { words: bestWords } : {}),
    });
  } catch (err) {
    console.error("[ASR] failed:", err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, error: "ASR_FAILED" });
  }
});

module.exports = router;

// backend/src/routes/speechRoute.js
