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
const groqChatCompletion = groqClient && groqClient.groqChatCompletion ? groqClient.groqChatCompletion : null;
const router = express.Router();

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
    "- 可分動詞片語例：'sieht aus' → lemma='aussehen', variantType='separable_verb'",
    "- 反身動詞：'erinnert sich' → lemma='sich erinnern', variantType='reflexive_verb'",
    "- 若 shape=sentence：不要改寫整句；normalizedSuggestion 可為 null",
    "- confidence 0~1，reason 要短",
    "- 不要輸出 bestGuess/candidates",
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

    const stage1IsGermanLikely = stage1 ? Boolean(stage1.isGermanLikely) : true;
    const stage1Conf =
      stage1 && typeof stage1.confidence === "number" ? Math.max(0, Math.min(1, stage1.confidence)) : null;

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

    const lemma = sanitizeText(stage2?.lemma || "") || null;
    const pos = sanitizeText(stage2?.pos || "") || null;
    const variantType = sanitizeText(stage2?.variantType || "") || null;
    const features = stage2?.features && typeof stage2.features === "object" ? stage2.features : null;

    // 是否允許改寫 query（句子不改寫）
    const allowRewrite = stage1Shape !== "sentence";

    // normalized（優先用 lemma；其次 normalizedSuggestion；最後原字）
    const normalized = allowRewrite
      ? (sanitizeText(lemma || stage2?.normalizedSuggestion || "") || quickNormalized)
      : quickNormalized;

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