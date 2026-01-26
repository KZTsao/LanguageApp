// backend/src/routes/queryNormalizeRoute.js
/**
 * ------------------------------------------------------------
 * queryNormalizeRoute.js
 * ------------------------------------------------------------
 * 目的：
 * - 在 Analyze 前，先用 LLM 做「查詢字前置處理」
 *   1) 判斷是否為德文（或常見變形）
 *   2) 若疑似拼錯/不存在：提供 bestGuess（最大可能）+ candidates
 *   3) 回傳 message（前端可紅字提示：拼錯/不存在/已修正）
 *
 * 前端預期呼叫：
 * POST /api/query/normalize
 * body: { text: string, uiLang?: string, meta?: any }
 *
 * 回傳（建議）：
 * {
 *   original: string,
 *   normalized?: string,
 *   bestGuess?: string,
 *   isGerman?: boolean,
 *   reason?: string,
 *   candidates?: string[],
 *   message?: { type: "error"|"info", text: string }
 * }
 *
 * 注意：
 * - fail-open：LLM 或外部依賴失敗時，請回 { original, normalized: original }（不要擋查詢）
 * - 本 route 不做字典查詢，只做「字串修正/判斷」。
 * ------------------------------------------------------------
 */

const express = require("express");
// ✅ 依你現有專案：大多使用 Groq/OpenAI client
// - 若你已經有 groqClient.js 的統一介面，請在這裡替換成實際呼叫方式
// - 以下用「最小可讀」的抽象，避免綁死特定 SDK
const groqClient = require("../clients/groqClient");
const { guessLanguage } = require("../core/languageRules");
const groqChatCompletion = groqClient && groqClient.groqChatCompletion ? groqClient.groqChatCompletion : null;
const router = express.Router();

// ✅ DB preflight：用 DB 先判斷「是否為合法詞形」，避免過早進入 typo / lemma rewrite
// - 目的：只要 DB 能證明是合法詞形，就禁止 spell correction 與 query 改寫（包含 lemma 改寫）
// - 注意：fail-open：DB 不可用時不擋流程
let _supabaseClient = null;
function getSupabaseClient() {
  try {
    if (_supabaseClient) return _supabaseClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const { createClient } = require("@supabase/supabase-js");
    _supabaseClient = createClient(url, key, { auth: { persistSession: false } });
    return _supabaseClient;
  } catch (e) {
    console.warn("[queryNormalize][db] init failed:", e?.message || String(e));
    return null;
  }
}

// ✅ 詞形探測：利用 extra_props 的 tenses（字串）快速判斷是否包含該 form（保守命中）
// - 命中：視為合法詞形（禁止 typo / rewrite）
// - miss：不代表不是合法詞形（fail-open）
async function probeInflectedFormInDb(form) {
  const w = String(form || "").trim();
  if (!w) return { hit: false };
  const supa = getSupabaseClient();
  if (!supa) return { hit: false, reason: "missing_env" };

  try {
    const like = `%${w}%`;

    const { data, error } = await supa
      .from("dict_entry_props")
      .select("entry_id, extra_props")
      .or(
        [
          `extra_props->tenses->>present.ilike.${like}`,
          `extra_props->tenses->>preterite.ilike.${like}`,
          `extra_props->tenses->>perfect.ilike.${like}`,
        ].join(",")
      )
      .limit(3);

    if (error) {
      console.warn("[queryNormalize][db] probe failed:", error.message || String(error));
      return { hit: false, reason: "probe_failed" };
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return { hit: false };

    const baseForm =
      row && row.extra_props && typeof row.extra_props.baseForm === "string"
        ? row.extra_props.baseForm
        : "";

    return { hit: true, entryId: row.entry_id || null, baseForm };
  } catch (e) {
    console.warn("[queryNormalize][db] probe exception:", e?.message || String(e));
    return { hit: false, reason: "exception" };
  }
}

function sanitizeText(s) {
  return String(s || "")
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, 80); // 防止過長
}

// ✅ 判斷輸入形態：查字（單字/短語）vs 句子（避免強制回填 query 造成困擾）
function analyzeInputShape(text) {
  const t = String(text || "").trim();
  const hasSentencePunct = /[.!?]/.test(t);
  const tokens = t ? t.split(/\s+/).filter(Boolean) : [];
  const tokenCount = tokens.length;
  const looksLikeSentence = hasSentencePunct || tokenCount > 3;
  return { tokenCount, hasSentencePunct, looksLikeSentence };
}

/** ✅ 基礎預檢：避免把 URL/Email/程式碼/怪符號當查字輸入，浪費 token */
function looksLikeUrlOrEmail(text) {
  const t = String(text || "").trim();
  return /:\/\//.test(t) || /\S+@\S+\./.test(t);
}

function looksLikeCodeSnippet(text) {
  const t = String(text || "").trim();
  return /[{}\[\];]|=>|<\/?\w+|\bconst\b|\bfunction\b|\bimport\b|\bexport\b/.test(t);
}

// 允許：字母、空白、-、'、德文變音；其餘視為不適合「查字」的噪音
function hasWeirdNonQuerySymbols(text) {
  const t = String(text || "").trim();
  return /[^A-Za-zÄÖÜäöüß\s\-']/u.test(t);
}

/**
 * LLM Prompt（精簡、可控）
 * - 只要輸出 JSON（單行），避免 verbose
 */
function buildPrompt(text) {
  return [
    "你是一個德文查字前置處理器（拼字 + 變形/詞形辨識）。",
    "任務：",
    "1) 判斷輸入是否為德文（單字或短語/變形，例如可分動詞、反身動詞、分詞、變位）",
    "2) 若是德文且沒有拼字錯：請辨識其字典原形（lemma）與變化類型（variantType），並回 normalized=lemma（供查字）",
    "3) 若疑似拼錯/不存在：請提供 bestGuess（最大可能）與 0~5 candidates",
    "4) 只輸出 JSON（不要多餘文字）。",
    "",
    "輸入：",
    text,
    "",
    "輸出 JSON schema（必須符合）：",
    "{",
    "  \"isGerman\": boolean,",
    "  \"pos\": \"verb\"|\"noun\"|\"adj\"|\"adv\"|\"other\"|null,",
    "  \"normalized\": string,             // 供查字：若是變形請用 lemma；若本來就是原形則等於輸入（可做 äöü/ß/大小寫修正）",
    "  \"lemma\": string|null,             // 字典原形（動詞不定詞；反身動詞以 'sich + infinitiv'）",
    "  \"variantType\": string|null,       // separable_verb / reflexive_verb / separable_reflexive_verb / conjugated / participle_past / participle_present / none",
    "  \"features\": object|null,          // 可選：例如 {person:3, number:\"sg\", tense:\"pres\", separable:true, reflexive:false}",
    "  \"bestGuess\": string|null,         // 若疑似拼錯/不存在，提供最大可能正確詞；若無則 null",
    "  \"candidates\": string[],           // 0~5 個候選（含 bestGuess 也可）",
    "  \"reason\": string,                 // 簡短原因（要短）",
    "  \"confidence\": number              // 0~1",
    "}",
    "",
    "規則：",
    "- 這是查字/查片語的輸入：短輸入（1~3 個詞）很常見，不要因為短就判定 false",
    "- 可分動詞片語例：'sieht aus' → lemma='aussehen'，variantType='separable_verb'，normalized='aussehen'，bestGuess=null",
    "- 反身動詞：包含 mich/dich/sich/uns/euch/sich 時，lemma 以 'sich + infinitiv' 回傳，variantType='reflexive_verb'",
    "- 若看起來是句子（含 . ! ? 或詞數>3）：仍要盡量抽取 lemma/variantType，但 normalized 請回輸入原文（不要改寫整句）",
    "- 若明顯拼字錯：bestGuess 給最可能的正確詞；candidates 給 0~5",
  ].join("\n");
}

// ============================================================
// ✅ 多次小幅度 LLM（避免白名單/正向表列）：Stage 1/2/3
// Stage 1: 判斷語言 & 輸入形態（word/phrase/sentence）
// Stage 2: 形態辨識（lemma/variantType）不做拼字
// Stage 3: 拼字猜測（僅在需要時）
// ============================================================
function buildPromptStage1(text) {
  return [
    "你是語言判斷器。只輸出 JSON。",
    "輸入：",
    text,
    "",
    "請輸出：{\"isGermanLikely\":boolean,\"shape\":\"word\"|\"phrase\"|\"sentence\"|\"unknown\",\"confidence\":number,\"reason\":string}",
    "規則：",
    "- 這是查字/查片語的輸入：短輸入（1~3 個詞）很常見，不要因為短就判定 false",
    "- 德文可分動詞片語（如 'sieht aus'）應判定為 isGermanLikely=true, shape=phrase",
    "- 反身動詞片語（如 'erinnert sich'）也算 isGermanLikely=true",
    "- 若含 . ! ? 或詞數>3，shape=sentence",
    "- confidence 0~1，reason 要短",
  ].join("\n");
}

function buildPromptStage2(text, shape) {
  return [
    "你是德文詞形辨識器。只輸出 JSON。不要做拼字猜測。",
    "輸入：",
    text,
    "",
    "請輸出：{",
    "  \"isGermanLikely\": boolean,",
    "  \"pos\": \"verb\"|\"noun\"|\"adj\"|\"adv\"|\"other\"|null,",
    "  \"lemma\": string|null,",
    "  \"variantType\": string|null,",
    "  \"features\": object|null,",
    "  \"normalizedSuggestion\": string|null,",
    "  \"confidence\": number,",
    "  \"reason\": string",
    "}",
    "",
    "規則：",
    "- 這是查字/查片語的輸入：短輸入（1~3 個詞）很常見，不要因為短就判定 false",
    "- 可分動詞片語例：'sieht aus' → lemma='aussehen', variantType='separable_verb'",
    "- 反身動詞：'erinnert sich' → lemma='sich erinnern', variantType='reflexive_verb'",
    "- 若 shape=sentence：不要改寫整句；normalizedSuggestion 可為 null",
    "- confidence 0~1，reason 要短",
    "- 不要輸出 bestGuess/candidates",
  ].join("\n");
}

function buildPromptStage2b(phrase, particle, baseLemma) {
  return [
    "你是德文可分動詞片語的原形還原器。只輸出 JSON。",
    `片語：${phrase}`,
    `分離粒子（particle）：${particle}`,
    `LLM猜到的base lemma：${baseLemma}`,
    "",
    "請輸出：{\"lemma\": string|null, \"confidence\": number, \"reason\": string}",
    "規則：",
    "- lemma 必須是可查字典的原形（Infinitiv），且要包含 particle（例如 nimmt mit → mitnehmen）",
    "- 若無法確定，lemma=null",
    "- confidence 0~1，reason 要短",
  ].join("\n");
}

function buildPromptStage3(text) {
  return [
    "你是拼字校正器（德文）。只輸出 JSON。",
    "輸入：",
    text,
    "",
    "請輸出：{\"bestGuess\":string|null,\"candidates\":string[],\"confidence\":number,\"reason\":string}",
    "規則：",
    "- 這是查字/查片語的輸入：短輸入（1~3 個詞）很常見，不要因為短就判定 false",
    "- candidates 0~5 個",
    "- 若你無法確定，bestGuess=null",
  ].join("\n");
}

async function callLLMJsonOrNull(opts) {
  try {
    const llm = await groqChatCompletion({
      messages: [
        { role: "system", content: "Return ONLY valid JSON." },
        { role: "user", content: opts.prompt },
      ],
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.max_tokens ?? 160,
    });
    try {
      return JSON.parse(llm?.content || llm || "{}");
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  }
}

router.post("/normalize", async (req, res) => {
  
  const original = sanitizeText(req.body?.text);
  if (!original) {
    return res.json({
      original: "",
      normalized: "",
      isGerman: false,
      candidates: [],
      reason: "empty",
      message: { type: "error", text: "請輸入要查的字" },
    });
  }

  // ✅ 快速規則（不進 LLM 也可做的）
  // - 移除尾端標點（SearchBox 已做，這裡再做一次保險）
  const quick = original.replace(/[\s\.,;:!?]+$/g, "");
  const quickNormalized = quick;

  try {
    // ✅ 多次小幅度 LLM：Stage1/Stage2/(必要時 Stage3)
    // - 不依賴白名單或正向表列
    // - fail-open：任一步失敗都不擋查詢（維持既有流程）
    const shapeLocal = analyzeInputShape(quickNormalized);

    const stage1 = await callLLMJsonOrNull({
      prompt: buildPromptStage1(quickNormalized),
      max_tokens: 90,
      temperature: 0.1,
    });

    const stage1Shape =
      (stage1 && typeof stage1.shape === "string" ? stage1.shape : null) ||
      (shapeLocal && shapeLocal.looksLikeSentence ? "sentence" : (shapeLocal && shapeLocal.tokenCount > 1 ? "phrase" : "word")) ||
      "unknown";

    const stage1IsGermanLikelyRaw = stage1 ? Boolean(stage1.isGermanLikely) : true;
    const stage1ConfRaw =
      stage1 && typeof stage1.confidence === "number" ? Math.max(0, Math.min(1, stage1.confidence)) : null;

    // ✅ 泛化 fail-open（不靠白名單）：不要因為「短」就判定 not-german
    // 放行條件：像查字輸入（1~3 詞）、不像 URL/Email、不像 code、沒有數字、沒有奇怪符號
    const __t = String(quickNormalized || "").trim();
    const __tokenCount = shapeLocal && typeof shapeLocal.tokenCount === "number" ? shapeLocal.tokenCount : 0;
    const __looksLikeUrlOrEmail = /:\/\//.test(__t) || /\S+@\S+\./.test(__t);
    const __looksLikeCode = /[{}\[\];]|=>|<\/?\w+|\bconst\b|\bfunction\b|\bimport\b|\bexport\b/.test(__t);
    const __hasDigits = /\d/.test(__t);
    const __hasLatinOrUmlaut = /[A-Za-zÄÖÜäöüß]/.test(__t);
    const __hasWeirdSymbols = /[^A-Za-zÄÖÜäöüß\s\-']/u.test(__t);

    const __hardAllowShortQuery =
      __hasLatinOrUmlaut &&
      __tokenCount > 0 &&
      __tokenCount <= 3 &&
      !__looksLikeUrlOrEmail &&
      !__looksLikeCode &&
      !__hasDigits &&
      !__hasWeirdSymbols;

    const stage1IsGermanLikely = __hardAllowShortQuery ? true : stage1IsGermanLikelyRaw;
    const stage1Conf =
      __hardAllowShortQuery && stage1IsGermanLikelyRaw === false
        ? (stage1ConfRaw !== null ? Math.max(stage1ConfRaw, 0.6) : 0.6)
        : stage1ConfRaw;

    // Stage2：僅做 lemma/variantType（不做拼字）
    const stage2 = stage1IsGermanLikely
      ? await callLLMJsonOrNull({
          prompt: buildPromptStage2(quickNormalized, stage1Shape),
          max_tokens: 180,
          temperature: 0.1,
        })
      : null;

    const stage2IsGermanLikely = stage2 ? Boolean(stage2.isGermanLikely) : stage1IsGermanLikely;
    const stage2Conf =
      stage2 && typeof stage2.confidence === "number" ? Math.max(0, Math.min(1, stage2.confidence)) : null;

    let lemma = sanitizeText(stage2?.lemma || "") || null;
    const pos = sanitizeText(stage2?.pos || "") || null;
    const variantType = sanitizeText(stage2?.variantType || "") || null;
    const features = stage2?.features && typeof stage2.features === "object" ? stage2.features : null;

    // 是否允許改寫 query（句子不改寫）
    const allowRewrite = stage1Shape !== "sentence";

    // ============================================================
    // ✅ Stage2.5 — 德文合法詞形鎖定（禁止 typo / lemma rewrite）
    // 中文功能說明：
    // - 若輸入包含 ä/ö/ü/ß 或語言判定為 de，優先視為德文查字輸入
    // - 先用 DB extra_props.tenses 做「詞形是否存在」探測（命中就鎖定）
    // - 一旦鎖定：normalized 必須維持 original（不改寫成 lemma / bestGuess）
    // - 目的：避免 sägt/sägen 被錯誤改寫成 sagen
    // ============================================================
    const __shapeLocal2 = analyzeInputShape(quickNormalized);
    const __tokenCount2 =
      __shapeLocal2 && typeof __shapeLocal2.tokenCount === "number" ? __shapeLocal2.tokenCount : 0;
    const __looksLikeSentence2 = Boolean(__shapeLocal2 && __shapeLocal2.looksLikeSentence);

    const __hasUmlautOrEszett = /[äöüß]/i.test(quickNormalized);
    const __langGuess = (() => {
      try {
        const g = guessLanguage(quickNormalized);
        return g && typeof g.lang === "string" ? g.lang : "";
      } catch {
        return "";
      }
    })();
    const __germanLikely2 = __hasUmlautOrEszett || __langGuess === "de";

    // 單字查詢才做 DB preflight（避免句子/長文本）
    let __dbInflectHit = null;
    if (__germanLikely2 && !__looksLikeSentence2 && __tokenCount2 === 1) {
      __dbInflectHit = await probeInflectedFormInDb(quickNormalized);
    }

    // 鎖定條件（保守）：
    // - 有變音符：直接鎖（避免任何去變音 rewrite）
    // - 或 DB 命中詞形：鎖
    const __lockOriginal =
      (__germanLikely2 && __hasUmlautOrEszett) ||
      (__dbInflectHit && __dbInflectHit.hit === true);
    // normalized（優先用 lemma；其次 normalizedSuggestion；最後原字）
    

    // ✅ Stage2b：小幅度再問一次 LLM（不靠白名單）
    // 觸發：可分動詞片語 + lemma 看起來只有 base verb（缺 particle）
    if (allowRewrite && variantType === "separable_verb" && lemma) {
      const toks = String(quickNormalized || "").trim().split(/\s+/).filter(Boolean);
      if (toks.length >= 2 && toks.length <= 3) {
        const particle = toks[toks.length - 1];
        const base = String(lemma || "").trim();
        const p = particle ? particle.toLowerCase() : "";
        const b = base ? base.toLowerCase() : "";
        const particleLooksOk = particle && /^[A-Za-zÄÖÜäöüß]+$/.test(particle);
        const baseLooksOk = base && /^[A-Za-zÄÖÜäöüß]+$/.test(base);
        const missingParticle = particleLooksOk && baseLooksOk && !b.startsWith(p);

        const safeToAsk =
          particleLooksOk &&
          !looksLikeUrlOrEmail(quickNormalized) &&
          !looksLikeCodeSnippet(quickNormalized) &&
          !hasWeirdNonQuerySymbols(quickNormalized);

        if (missingParticle && safeToAsk) {
          const stage2b = await callLLMJsonOrNull({
            prompt: buildPromptStage2b(quickNormalized, particle, base),
            max_tokens: 80,
            temperature: 0.1,
          });

          const lemma2 = sanitizeText(stage2b?.lemma || "") || null;
          if (lemma2 && lemma2.toLowerCase().startsWith(p)) {
            lemma = lemma2;
          }
        }
      }
    }
const normalized = (__lockOriginal || !allowRewrite)
      ? quickNormalized
      : (sanitizeText(lemma || stage2?.normalizedSuggestion || "") || quickNormalized);

    // Stage3：只有在「明顯不是德文」或「形態辨識信心低」時才做拼字猜測
    const needSpell =
      !stage2IsGermanLikely ||
      (allowRewrite && !lemma && (stage2Conf !== null ? stage2Conf < 0.45 : true)) ||
      (stage1Conf !== null ? stage1Conf < 0.35 : false);

    const stage3 = needSpell
      ? await callLLMJsonOrNull({
          prompt: buildPromptStage3(quickNormalized),
          max_tokens: 140,
          temperature: 0.1,
        })
      : null;

    const bestGuess = sanitizeText(stage3?.bestGuess || "") || null;
    const candidates = Array.isArray(stage3?.candidates)
      ? stage3.candidates.map(sanitizeText).filter(Boolean).slice(0, 5)
      : [];

    const confidence =
      stage2Conf !== null
        ? stage2Conf
        : (stage1Conf !== null
            ? stage1Conf
            : (stage3 && typeof stage3.confidence === "number"
                ? Math.max(0, Math.min(1, stage3.confidence))
                : null));

    // ✅ 相容：保留 data?.reason 使用點（以 stage2/stage3 reason 為主）
    const data = {
      reason: (stage2 && stage2.reason) || (stage3 && stage3.reason) || (stage1 && stage1.reason) || null,
      isGerman: stage2IsGermanLikely,
    };

    // ✅ 相容：保留 shape 變數供後續 lemma_detected_sentence 判斷
    const shape = stage1Shape === "sentence" ? { looksLikeSentence: true } : analyzeInputShape(quickNormalized);

    const isGerman = Boolean(stage2IsGermanLikely);

    // ✅ message（前端紅字提示）
    let message = null;

    // Case A：有最佳猜測（拼錯/不存在）
    if (bestGuess && bestGuess !== normalized) {
      message = {
        type: "error",
        text: `可能拼錯或不存在：已改用「${bestGuess}」`,
      };
      return res.json({
        original: quickNormalized,
        normalized,
        lemma,
        pos,
        variantType,
        features,
        bestGuess,
        isGerman: true,
        candidates: Array.from(new Set([bestGuess, ...candidates])).slice(0, 5),
        reason: data?.reason || "spell-correct",
        confidence,
        message,
      });
    }

    // Case B：只是 normalize（大小寫/變形）
    if (normalized !== quickNormalized) {
      message = { type: "info", text: `已改用：${normalized}` };
      return res.json({
        original: quickNormalized,
        normalized,
        lemma,
        pos,
        variantType,
        features,
        isGerman: isGerman || true,
        candidates,
        reason: data?.reason || "normalized",
        confidence,
        message,
      });
    }

    // Case C：看起來不是德文（但仍 fail-open，讓主查詢去決定 Not found）
    if (!isGerman) {
      message = { type: "error", text: "看起來不是德文單字，可能拼錯或不是這個語言" };
      return res.json({
        original: quickNormalized,
        normalized: quickNormalized,
        lemma,
        pos,
        variantType,
        features,
        isGerman: false,
        candidates,
        reason: data?.reason || "not-german",
        confidence,
        message,
      });
    }

    // Case D：正常可用，不要一直彈提示
    // ✅ 形態辨識（無錯字）但有 lemma：在「查字輸入」情境下改用 lemma 查；在「句子」情境下不改寫，只給提示
    if (!bestGuess && lemma && lemma !== quickNormalized) {
      // ✅ 若已鎖定 original（德文合法字形/詞形），則不改寫 query
      // - 仍可提供 lemma 作為參考候選（讓前端決定是否要提示「可改查原形」）
      if (__lockOriginal) {
        const __lemmaFromDb =
          __dbInflectHit && __dbInflectHit.hit && typeof __dbInflectHit.baseForm === "string"
            ? __dbInflectHit.baseForm.trim()
            : "";
        const __lemmaCandidate = __lemmaFromDb || lemma;

        return res.json({
          original: quickNormalized,
          normalized: quickNormalized,
          lemma: __lemmaCandidate,
          pos,
          variantType,
          features,
          isGerman: true,
          candidates: Array.from(new Set([__lemmaCandidate].filter(Boolean))).slice(0, 5),
          reason: "locked_original_lemma_hint",
          confidence,
          message: {
            type: "info",
            text: __lemmaCandidate
              ? `偵測到原形：${__lemmaCandidate}（${variantType || "variant"}），但保留原輸入不改寫`
              : "偵測為德文合法字形/詞形，保留原輸入不改寫",
          },
        });
      }

      if (shape && shape.looksLikeSentence) {
        return res.json({
          original: quickNormalized,
          normalized: quickNormalized,
          lemma,
          pos,
          variantType,
          features,
          isGerman: true,
          candidates,
          reason: data?.reason || "lemma_detected_sentence",
          confidence,
          message: {
            type: "info",
            text: `偵測到原形：${lemma}（${variantType || "variant"}），可改查這個字`,
          },
        });
      }
      return res.json({
        original: quickNormalized,
        normalized: lemma,
        lemma,
        pos,
        variantType,
        features,
        isGerman: true,
        candidates,
        reason: data?.reason || "lemma_detected",
        confidence,
        message: {
          type: "info",
          text: `辨識為${variantType || "變形"}，已轉為原形：${lemma}`,
        },
      });
    }

    return res.json({
      original: quickNormalized,
      normalized: quickNormalized,
      lemma,
      pos,
      variantType,
      features,
      isGerman: true,
      candidates,
      reason: data?.reason || "ok",
      confidence,
      message: null,
    });
  } catch (err) {
    // ✅ fail-open：不擋查詢
    return res.json({
      original: quickNormalized,
      normalized: quickNormalized,
      isGerman: true,
      candidates: [],
      reason: "llm_error",
      message: null,
    });
  }
});

module.exports = router;

// backend/src/routes/queryNormalizeRoute.js

// END FILE: backend/src/routes/queryNormalizeRoute.js
