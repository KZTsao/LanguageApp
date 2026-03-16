// frontend/src/utils/ttsClient.js

import { apiFetch } from "./apiClient";

let currentAudio = null;
let currentController = null;
let playSeq = 0;
let currentObjectUrl = "";
let currentPlaybackResolver = null;

const TTS_OBSERVE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_OBSERVE_TTS === "1") ||
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_DEBUG_TTS === "1");

function observeTTS(event, payload = {}) {
  try {
    if (!TTS_OBSERVE) return;
    console.log('[observe][ttsClient]', event, payload || {});
  } catch {}
}

function cleanupObjectUrl() {
  if (!currentObjectUrl) return;
  try { URL.revokeObjectURL(currentObjectUrl); } catch {}
  currentObjectUrl = "";
}

function settlePlayback(result = "stopped") {
  const resolver = currentPlaybackResolver;
  currentPlaybackResolver = null;
  if (typeof resolver === "function") {
    try { resolver(result); } catch {}
  }
}

function stopCurrentAudioOnly() {
  if (!currentAudio) return;
  try {
    currentAudio.onended = null;
    currentAudio.onpause = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.src = "";
  } catch {}
  currentAudio = null;
  cleanupObjectUrl();
}

export function stopTTS(reason = "manual") {
  playSeq += 1;
  observeTTS("stop", { reason, playSeq });

  if (currentController) {
    try { currentController.abort(); } catch {}
    currentController = null;
  }

  stopCurrentAudioOnly();

  try {
    if (typeof window !== "undefined" && window.speechSynthesis && typeof window.speechSynthesis.cancel === "function") {
      window.speechSynthesis.cancel();
    }
  } catch {}

  settlePlayback(reason || "stopped");
}

if (typeof window !== "undefined") {
  window.__SOLANG_TTS_STOP = stopTTS;
}

export async function callTTS(text, lang = "de-DE") {
  if (!text || typeof text !== "string") {
    throw new Error("callTTS: `text` must be a string");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("callTTS: text is empty after trim()");
  }

  observeTTS("call.start", { lang, textLen: trimmed.length });

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
  observeTTS("call.ok", { lang, hasAudioContent: !!(data && typeof data.audioContent === "string"), provider: data?.provider || "" });

  if (!data || typeof data.audioContent !== "string") {
    throw new Error("[TTS] Missing audioContent from response");
  }

  return data.audioContent;
}


function playBrowserTTS(text, lang = "de-DE", seq = playSeq) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
        reject(new Error("[TTS] browser speechSynthesis not available"));
        return;
      }

      const utter = new window.SpeechSynthesisUtterance(String(text || ""));
      observeTTS("browser.start", { lang, textLen: String(text || "").length, seq });
      utter.lang = lang || "de-DE";

      currentPlaybackResolver = resolve;

      utter.onend = () => {
        observeTTS("browser.end", { lang, seq });
        if (seq !== playSeq) {
          settlePlayback("stale");
          return;
        }
        settlePlayback("ended");
      };

      utter.onerror = (event) => {
        currentPlaybackResolver = null;
        reject(event instanceof Error ? event : new Error("[TTS] browser speech failed"));
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (err) {
      currentPlaybackResolver = null;
      reject(err);
    }
  });
}

async function callTTSWithSignal(text, lang, signal) {
  if (!text || typeof text !== "string") {
    throw new Error("callTTSWithSignal: `text` must be a string");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("callTTSWithSignal: text is empty after trim()");
  }

  observeTTS("callWithSignal.start", { lang, textLen: trimmed.length, hasSignal: !!signal });

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
  observeTTS("callWithSignal.ok", { lang, hasAudioContent: !!(data && typeof data.audioContent === "string"), provider: data?.provider || "" });

  if (!data || typeof data.audioContent !== "string") {
    throw new Error("[TTS] Missing audioContent from response");
  }

  return data.audioContent;
}

export async function playTTS(text, lang = "de-DE") {
  const seq = ++playSeq;

  observeTTS("play.start", { lang, textLen: typeof text === "string" ? text.trim().length : 0, seq });
  stopTTS("replace");
  playSeq = seq;

  try {
    if (!text || typeof text !== "string" || !text.trim()) return "empty";

    const trimmed = text.trim();
    const controller = new AbortController();
    currentController = controller;

    let audioDataUrl = "";
    try {
      audioDataUrl = await callTTSWithSignal(text, lang, controller.signal);
    } catch (err) {
      const msg = String(err?.message || err || "");
      const shouldFallback = /HTTP 503|TTS not available|Failed to fetch|NetworkError/i.test(msg);
      if (!shouldFallback) throw err;
      observeTTS("play.fallback", { lang, seq, reason: msg });
      if (currentController === controller) currentController = null;
      return await playBrowserTTS(trimmed, lang, seq);
    }

    if (seq !== playSeq) return "stale";

    const audio = new Audio(audioDataUrl);
    observeTTS("play.audioReady", { lang, seq });
    currentAudio = audio;

    return await new Promise((resolve, reject) => {
      currentPlaybackResolver = resolve;

      audio.onended = () => {
        observeTTS("play.ended", { lang, seq });
        if (currentAudio === audio) currentAudio = null;
        cleanupObjectUrl();
        if (currentController === controller) currentController = null;
        settlePlayback("ended");
      };

      audio.onerror = (event) => {
        if (currentAudio === audio) currentAudio = null;
        cleanupObjectUrl();
        if (currentController === controller) currentController = null;
        currentPlaybackResolver = null;
        reject(event instanceof Error ? event : new Error("[TTS] audio playback failed"));
      };

      audio.play().catch((err) => {
        if (currentAudio === audio) currentAudio = null;
        cleanupObjectUrl();
        if (currentController === controller) currentController = null;
        currentPlaybackResolver = null;
        reject(err);
      });
    });
  } catch (err) {
    if (currentController && currentController.signal && currentController.signal.aborted) return "aborted";
    if (err && (err.name === "AbortError" || err.code === 20)) return "aborted";
    observeTTS("play.failed", { lang, seq, message: String(err?.message || err || "") });
    console.error("[TTS] playTTS failed:", err);
    throw err;
  } finally {
    if (currentController && currentController.signal && currentController.signal.aborted) {
      currentController = null;
    }
  }
}
