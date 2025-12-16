// frontend/src/utils/ttsClient.js

import { apiFetch } from "./apiClient";

/**
 * 呼叫後端 /api/tts 取得 base64 音檔
 */
export async function callTTS(text, lang = "de-DE") {
  if (!text || typeof text !== "string") {
    throw new Error("callTTS: `text` must be a string");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("callTTS: text is empty after trim()");
  }

  const res = await apiFetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: trimmed, lang }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`[TTS] HTTP ${res.status}: ${detail}`);
  }

  const data = await res.json();

  if (!data || typeof data.audioContent !== "string") {
    throw new Error("[TTS] Missing audioContent from response");
  }

  return data.audioContent;
}

// -----------------------------
// 讓前端所有喇叭都能播放 TTS
// -----------------------------
let currentAudio = null;

// ✅ 新增：用來中止上一個還在跑的 fetch（避免「舊的晚回來也播」）
let currentController = null;

// ✅ 新增：播放序號（保護 async out-of-order）
let playSeq = 0;

// 內部版本：支援 AbortController
async function callTTSWithSignal(text, lang, signal) {
  if (!text || typeof text !== "string") {
    throw new Error("callTTSWithSignal: `text` must be a string");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("callTTSWithSignal: text is empty after trim()");
  }

  const res = await apiFetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: trimmed, lang }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`[TTS] HTTP ${res.status}: ${detail}`);
  }

  const data = await res.json();

  if (!data || typeof data.audioContent !== "string") {
    throw new Error("[TTS] Missing audioContent from response");
  }

  return data.audioContent;
}

export async function playTTS(text, lang = "de-DE") {
  const seq = ++playSeq;

  try {
    if (!text || typeof text !== "string" || !text.trim()) return;

    // 停掉上一段 audio（已在播的）
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.src = "";
      } catch {}
      currentAudio = null;
    }

    // ✅ 中止上一個還在跑的 TTS 請求（還沒回來的）
    if (currentController) {
      try {
        currentController.abort();
      } catch {}
      currentController = null;
    }

    const controller = new AbortController();
    currentController = controller;

    const audioDataUrl = await callTTSWithSignal(text, lang, controller.signal);

    if (seq !== playSeq) return;

    const audio = new Audio(audioDataUrl);
    currentAudio = audio;

    await audio.play();
  } catch (err) {
    if (err && (err.name === "AbortError" || err.code === 20)) return;
    console.error("[TTS] playTTS failed:", err);
  }
}
