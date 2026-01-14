// backend/src/routes/ttsRoute.js
/**
 * 文件說明：
 * - /api/tts 路由：統一由 synthesizeTTS() 依 TTS_PROVIDER 決定實際 TTS 供應商（Google/Eleven/others）
 * - 目標：清除殘留的 ElevenLabs 寫死行為（lang 預設、cache key、provider 回傳、log 字樣）
 * - 同時加入 Production 排查用初始化狀態與關鍵 log（不洩漏敏感資訊）
 *
 * 異動紀錄：
 * - 2025/12/18：改為以 TTS_PROVIDER 為唯一決策來源；cache key 納入 provider/voice；修正 audioBase64 未定義；回傳 provider 改為實際 provider；保留 legacy ELEVEN_* 但標示 deprecated；強化 log 方便排查
 * - 2026/01/06：累加 TTS 使用量到 profiles.tts_chars_total（read → +add → update），失敗不擋 TTS 主流程；補齊 Service Role Supabase Admin Client；加入 [TTS_PROFILE] 關鍵 log
 * - 2026/01/13：✅ 修正計費語意：profiles.tts_chars_total 代表「你被 Google 計費的字元」
 *              - Cache HIT：不記費（不寫 usage / 不累加 profiles）
 *              - Cache MISS + synth 成功：才記費（寫 usage + 累加 profiles）
 *              - Cache MISS + synth 失敗：不記費
 *
 * 初始化狀態（Production 排查）：
 * - [/api/tts][init] 會輸出 provider / lang / voice 的「是否存在」與當前值（不輸出 key 內容）
 */

// backend/src/routes/ttsRoute.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const { synthesizeTTS } = require("../clients/ttsClient");

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

/**
 * ✅ 功能：建立 Supabase Admin Client（Service Role）
 * - 只在後端使用，用來更新 profiles 的用量欄位
 * - 若缺環境變數，回傳 null（並由呼叫端決定是否 fallback）
 */
function getAdminSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * ✅ 功能：確保 profiles row 存在（若沒有就補一筆最小欄位）
 */
async function ensureProfileRowExists(supabase, userId, email, nowIso) {
  if (!supabase || !userId)
    return { ok: false, reason: "missing supabase or userId" };

  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selErr) {
    return { ok: false, error: selErr };
  }

  if (existing) {
    return { ok: true, existed: true };
  }

  const { error: insErr } = await supabase.from("profiles").insert([
    {
      id: userId,
      email: email || null,
      last_visit_at: nowIso || new Date().toISOString(),
      visit_count: 0,
    },
  ]);

  if (insErr) {
    return { ok: false, error: insErr };
  }

  return { ok: true, existed: false };
}

/**
 * ✅ 功能：累加 profiles.tts_chars_total（不影響主流程：失敗只 log）
 *
 * ✅ 2026/01/13（重要）：
 * - profiles.tts_chars_total 定義為「你被 Google 計費的字元」
 * - 因此本函式只允許在「Cache MISS 且 synth 成功」時呼叫
 * - Cache HIT / synth 失敗都不應呼叫（避免誤記費）
 */
async function addTtsCharsToProfile({ userId, email, addChars, traceId }) {
  const tag = "[TTS_PROFILE]";

  if (!userId) {
    console.log(`${tag} skipped: missing userId`);
    return { ok: false, skipped: true, reason: "missing userId" };
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    console.warn(
      `${tag} skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`
    );
    return { ok: false, skipped: true, reason: "missing supabase env" };
  }

  const nowIso = new Date().toISOString();

  // 1) 確保 profiles row 存在
  const ensureRes = await ensureProfileRowExists(
    supabase,
    userId,
    email,
    nowIso
  );
  if (!ensureRes.ok) {
    console.warn(`${tag} ensureProfileRowExists failed`, {
      traceId,
      detail:
        ensureRes.error?.message ||
        String(ensureRes.error || ensureRes.reason),
    });
    return { ok: false, error: ensureRes.error || ensureRes.reason };
  }

  // 2) read → +add → update（最小可行，避免 RPC 依賴）
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, tts_chars_total")
    .eq("id", userId)
    .maybeSingle();

  if (selErr) {
    console.warn(`${tag} select failed`, {
      traceId,
      detail: selErr.message || String(selErr),
    });
    return { ok: false, error: selErr };
  }

  const prev = Number(existing?.tts_chars_total || 0);
  const inc = Number(addChars || 0);
  const next = prev + (Number.isFinite(inc) ? inc : 0);

  const { data: updated, error: updErr } = await supabase
    .from("profiles")
    .update({
      email: email || null,
      tts_chars_total: next,
      // 可選：也順便刷新 last_visit_at，方便後台觀察活躍（不影響 visit_count）
      last_visit_at: nowIso,
    })
    .eq("id", userId)
    .select("id, tts_chars_total")
    .single();

  if (updErr) {
    console.warn(`${tag} update failed`, {
      traceId,
      detail: updErr.message || String(updErr),
    });
    return { ok: false, error: updErr };
  }

  console.log(`${tag} ok`, {
    traceId,
    userId,
    addChars: inc,
    tts_chars_total: updated.tts_chars_total,
  });
  return { ok: true, tts_chars_total: updated.tts_chars_total };
}

/**
 * ✅ 功能：取得目前 TTS provider（唯一真相）
 * - 以 TTS_PROVIDER 為主
 * - 若未設定，保留 legacy fallback（但會在 log 中提示）
 */
function getActiveTtsProvider() {
  const p = "google";

  // legacy / fallback：保留但不鼓勵
  // 若你希望「未設定就直接停用」，可把 default 改成 "none"
  return p;
}

/**
 * ✅ 功能：取得語言（lang）預設值
 * - 以 TTS_LANGUAGE 為主（建議：de-DE）
 * - legacy：ELEVEN_LANGUAGE 保留，但標記 deprecated
 */
function getDefaultLang() {
  const v = (process.env.TTS_LANGUAGE || "").trim();
  if (v) return v;

  // DEPRECATED：舊邏輯使用 ELEVEN_LANGUAGE
  // const legacy = process.env.ELEVEN_LANGUAGE || "de";
  const legacy = (process.env.ELEVEN_LANGUAGE || "").trim();
  if (legacy) return legacy;

  // 最終保底
  return "de-DE";
}

/**
 * ✅ 功能：取得 voice/voiceId（用於 cache key）
 * - Google：使用 TTS_VOICE（例：de-DE-Wavenet-D）
 * - ElevenLabs：使用 ELEVEN_VOICE_ID（legacy）
 */
function getVoiceKeyForCache(provider) {
  const p = (provider || "").toLowerCase();

  if (p === "google") {
    return (process.env.TTS_VOICE || "").trim();
  }

  // legacy：ElevenLabs voice id
  return (process.env.ELEVEN_VOICE_ID || "").trim();
}

/**
 * ✅ 功能：啟動時/第一次呼叫時可用的初始化排查 log（不含敏感內容）
 */
let __ttsRouteInitLogged = false;
function logInitOnce() {
  if (__ttsRouteInitLogged) return;
  __ttsRouteInitLogged = true;

  const provider = getActiveTtsProvider();
  const lang = getDefaultLang();
  const voiceKey = getVoiceKeyForCache(provider);

  console.log(
    "[/api/tts][init]",
    JSON.stringify({
      provider,
      lang,
      hasTtsProvider: !!process.env.TTS_PROVIDER,
      hasTtsLanguage: !!process.env.TTS_LANGUAGE,
      hasTtsVoice: !!process.env.TTS_VOICE,
      hasElevenVoiceId: !!process.env.ELEVEN_VOICE_ID,
      hasElevenApiKey: !!process.env.ELEVEN_API_KEY,
      hasGoogleCredPath: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      hasGoogleCredJson: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      voiceKeyPresent: !!voiceKey,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  );
}

/**
 * ✅ 功能：計費記錄（你被 Google 計費的字元）
 *
 * ✅ 2026/01/13（重要）：
 * - 只在 Cache MISS 且 synthesize 成功後呼叫
 * - Cache HIT / synthesize 失敗：不得呼叫
 *
 * 說明：
 * - 你原本是在 cache 判斷之前就 logUsage + addTtsCharsToProfile，
 *   會造成「Cache HIT 也一直加 tts_chars_total」→ 與“計費字元”的定義衝突
 * - 此 helper 讓主流程更乾淨，也避免未來又不小心放回 cache 前面
 */
async function recordTtsBillingAfterSynthesizeSuccess({
  authUser,
  text,
  req,
}) {
  // ★ 記錄用量（若有登入，順便記 userId）
  logUsage({
    endpoint: "/api/tts",
    charCount: text.length,
    kind: "tts",
    ip: req.ip,
    userId: authUser?.id || "",
    email: authUser?.email || "",
  });

  // ★ 累加用量到 profiles.tts_chars_total（失敗不擋主流程）
  // traceId：用來對照後端 log（不需要前端改動）
  const traceId = `tts_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  try {
    await addTtsCharsToProfile({
      userId: authUser?.id || "",
      email: authUser?.email || "",
      addChars: text.length,
      traceId,
    });
  } catch (e) {
    console.warn("[TTS_PROFILE] unexpected error", {
      traceId,
      detail: e?.message || String(e),
    });
  }
}

router.post("/", async (req, res) => {
  console.log("[/api/tts] hit");
  logInitOnce();

  try {
    // DEPRECATED：原本使用 ELEVEN_LANGUAGE 作為預設 lang
    // const { text, lang = process.env.ELEVEN_LANGUAGE || "de" } = req.body || {};

    // ✅ 改為以 TTS_LANGUAGE 為主的預設值
    const { text, lang = getDefaultLang() } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing `text` field" });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        error: "Text too long (max 1000 chars)",
      });
    }

    const authUser = tryGetAuthUser(req);

    // ✅ 目前 provider（唯一真相）
    const activeProvider = getActiveTtsProvider();

    // ------------- Cache Key -------------
    // DEPRECATED：原本 cache key 只用 ELEVEN_VOICE_ID，導致換 provider 仍共用同一份 cache
    // const voiceId = process.env.ELEVEN_VOICE_ID || "";

    const voiceKey = getVoiceKeyForCache(activeProvider) || "";
    const providerScopedVoiceKey = `${activeProvider}:${voiceKey}`;
    const cacheKey = makeTtsCacheKey(text, lang, providerScopedVoiceKey);

    // ------------- Cache HIT -------------
    const cached = ttsMemoryCache.get(cacheKey);
    if (cached) {
      console.log("[/api/tts] TTS CACHE HIT");

      // ✅ 2026/01/13：Cache HIT 不記費（tts_chars_total = 你被 Google 計費的字元）
      // - 不呼叫 logUsage
      // - 不呼叫 addTtsCharsToProfile
      // - 只回傳 cache 結果
      //
      // DEPRECATED：舊行為（HIT 也記費）如下，已移除：
      // logUsage({...});
      // addTtsCharsToProfile({...});

      return res.json({
        audioContent: cached,
        provider: activeProvider,
        lang,
        cache: "HIT",
      });
    }

    // ------------- Cache MISS -------------
    // DEPRECATED：舊 log 誤導為一定呼叫 ElevenLabs
    // console.log("[/api/tts] MISS → calling ElevenLabs");
    console.log(
      `[/api/tts] MISS → calling synthesizeTTS (provider=${activeProvider})`
    );

    // ✅ 統一由 synthesizeTTS 決定供應商（ttsClient 內部依 TTS_PROVIDER）
    const { audioContent, provider } = await synthesizeTTS({
      text,
      lang,
    });

    if (!audioContent) {
      console.warn(
        `[/api/tts] TTS not available (provider=${provider || activeProvider})`
      );

      // ✅ 2026/01/13：MISS 但 synthesize 失敗 → 不記費（因為你也不會被 Google 計費）
      // - 不呼叫 logUsage
      // - 不呼叫 addTtsCharsToProfile
      return res.status(503).json({ error: "TTS not available" });
    }

    // DEPRECATED：原本寫入 audioBase64（未定義，會造成 runtime error）
    // ttsMemoryCache.set(cacheKey, audioBase64);

    // ✅ 修正：寫入實際 audioContent（成功才 cache）
    ttsMemoryCache.set(cacheKey, audioContent);

    // ✅ 2026/01/13：只有「Cache MISS + synth 成功」才記費（你被 Google 計費字元）
    await recordTtsBillingAfterSynthesizeSuccess({
      authUser,
      text,
      req,
    });

    // DEPRECATED：原本回傳 audioBase64 / provider 固定 elevenlabs
    // return res.json({
    //   audioContent: audioBase64,
    //   provider: "elevenlabs",
    //   lang,
    //   cache: "MISS",
    // });

    return res.json({
      audioContent,
      provider: provider || activeProvider,
      lang,
      cache: "MISS",
    });
  } catch (err) {
    console.error("[/api/tts] ERROR:", err);
    return res.status(500).json({ error: "TTS server error" });
  }
});

module.exports = router;

// backend/src/routes/ttsRoute.js
