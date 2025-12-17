// backend/src/clients/elevenTTS.js
// 使用 ElevenLabs Text-to-Speech，優先用 eleven_v3（Lotti 教學風格）
// 若 v3 不可用或報錯，會自動 fallback 到 eleven_multilingual_v2

async function elevenTTS(text, lang = "de") {
  const apiKey = process.env.ELEVEN_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ELEVEN_API_KEY in .env");
  }

  // 若 .env 有設定 ELEVEN_VOICE_ID（請填 Lotti 的 Voice ID UUID），就用你設定的；
  // 否則 fallback 用原本你已經成功用過的預設 voiceId。
  const voiceId = process.env.ELEVEN_VOICE_ID || "ErXwobaYiN019PkySvjV";

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  // 共用 fetch 邏輯的 helper
  async function callElevenLabs(body, modelLabel) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        `[elevenTTS] ElevenLabs API error on ${modelLabel}`,
        res.status,
        res.statusText,
        errText
      );
      return { ok: false, status: res.status, statusText: res.statusText, errText };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    return { ok: true, audioBase64: `data:audio/mpeg;base64,${base64}` };
  }

  // 1️⃣ 優先嘗試 eleven_v3（支援 speed）
  const v3Body = {
    text,
    model_id: "eleven_v3",
    // 教學用穩定風格：
    // - speed: 0.95  稍微慢一點，適合學習
    // - stability: 0.85  很穩定，不亂飆情緒
    // - similarity_boost: 0.9  接近 voice demo
    // - style: 0.05  幾乎不誇張
    // - use_speaker_boost: true  提升清晰度
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.9,
      style: 0.05,
      use_speaker_boost: true,
      speed: 0.95,
    },
  };

  const v3Result = await callElevenLabs(v3Body, "eleven_v3");

  if (v3Result.ok) {
    // v3 成功 → 直接回傳
    return v3Result.audioBase64;
  }

  // 判斷是否要 fallback 到 v2：
  // 常見情況：模型沒權限 / 不支援 / alpha 關閉
  const shouldFallbackToV2 =
    v3Result.status === 400 ||
    v3Result.status === 403 ||
    (v3Result.errText &&
      (v3Result.errText.toLowerCase().includes("model") ||
        v3Result.errText.toLowerCase().includes("unsupported") ||
        v3Result.errText.toLowerCase().includes("not allowed")));

  if (!shouldFallbackToV2) {
    // v3 發生非模型相關錯誤（例如 quota 用完、voiceId 不存在）
    // 直接拋錯，讓上層 /api/tts 回傳 500
    throw new Error(
      `ElevenLabs TTS Error (v3 ${v3Result.status} ${v3Result.statusText}): ${v3Result.errText}`
    );
  }

  console.warn(
    "[elevenTTS] eleven_v3 unavailable or not allowed, falling back to eleven_multilingual_v2"
  );

  // 2️⃣ fallback：使用 eleven_multilingual_v2（穩定版，不使用 speed）
  const v2Body = {
    text,
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
      // v2 不加 speed / style，避免不相容
    },
  };

  const v2Result = await callElevenLabs(v2Body, "eleven_multilingual_v2");

  if (!v2Result.ok) {
    throw new Error(
      `ElevenLabs TTS Error (v2 ${v2Result.status} ${v2Result.statusText}): ${v2Result.errText}`
    );
  }

  return v2Result.audioBase64;
}

module.exports = elevenTTS;
