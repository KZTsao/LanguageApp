// backend/src/routes/dictionaryRoute.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const {
  lookupWord,
  generateExamples,
  generateConversation,
} = require("../clients/dictionaryClient");

const { logUsage } = require("../utils/usageLogger");

/**
 * 文件說明（dictionaryRoute）
 * - 用途：提供 /api/dictionary 的路由（lookup / examples / conversation）
 * - 注意：本檔案的 /examples 端點需遵守 Phase 1 硬規則：
 *   - history 切換不查
 *   - refs 變更不自動查
 *   - 只有按 Refresh 才打 /api/dictionary/examples
 *   （此規則主要由前端控制；後端僅回傳結果與可觀測欄位）
 *
 * 異動紀錄（保留舊紀錄，僅新增）
 * - 2026-01-06：Phase 2-5：refs 資料結構擴充（kind + surfaceForms），並更新後驗檢查：
 *   - 後驗檢查優先使用 ref.surfaceForms（若存在），否則使用 ref.key
 *   - 僅針對 kind: custom / entry 做字串包含檢查（case-insensitive）
 *   - kind: grammar 不做字串檢查，避免誤判；可依賴 LLM 回報（usedRefs/missingRefs）
 *   - 回傳 usedRefs/missingRefs/notes（向後相容：若無 refs 則回空陣列）
 *
 * 功能初始化狀態（Production 排查）
 * - DICT_ROUTE_REFS_DIAG.enabled = false（預設關閉）
 */

const DICT_ROUTE_REFS_DIAG = {
  enabled: false,
  tag: "[dictionaryRoute][refs]",
};

function diagRefsLog(...args) {
  if (!DICT_ROUTE_REFS_DIAG.enabled) return;
  // eslint-disable-next-line no-console
  console.log(DICT_ROUTE_REFS_DIAG.tag, ...args);
}

// =========================
// 共用：嘗試解析登入使用者（不強制）
// verify → decode fallback（只用於用量歸戶）
// =========================
function tryGetAuthUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return null;

  // ① 優先 verify
  try {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (secret) {
      const decoded = jwt.verify(token, secret);
      return {
        id: decoded.sub || "",
        email: decoded.email || "",
        source: "verify",
      };
    }
  } catch {
    // ignore
  }

  // ② fallback：decode（不驗證，只做用量歸戶）
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

// =========================
// Phase 2-5：refs 後驗檢查（surfaceForms 優先）
// - 只對 kind: custom / entry 做字串包含檢查（避免 grammar 誤判）
// - 優先用 surfaceForms；沒有就用 key
// =========================

/**
 * 中文功能說明：把字串正規化成可用於 includes 的形式（小寫 + trim）
 */
function normalizeForIncludes(input) {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}

/**
 * 中文功能說明：取得某個 ref 的「可接受表面型」清單
 * - 若有 surfaceForms（且為非空陣列），優先使用
 * - 否則回退到 key（單一）
 */
function getRefSurfaceForms(ref) {
  if (!ref || typeof ref !== "object") return [];

  const sf = Array.isArray(ref.surfaceForms) ? ref.surfaceForms : [];
  const cleanedSf = sf
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());

  if (cleanedSf.length > 0) return cleanedSf;

  if (typeof ref.key === "string" && ref.key.trim().length > 0) {
    return [ref.key.trim()];
  }

  return [];
}

/**
 * 中文功能說明：檢查 examples 是否包含任一 surface form（case-insensitive includes）
 */
function isAnySurfaceFormUsedInExamples(examples, surfaceForms) {
  const exList = Array.isArray(examples) ? examples : [];
  const forms = Array.isArray(surfaceForms) ? surfaceForms : [];
  if (exList.length === 0 || forms.length === 0) return false;

  const normalizedExamples = exList
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .map((s) => normalizeForIncludes(s));

  for (const form of forms) {
    const f = normalizeForIncludes(form);
    if (!f) continue;
    for (const ex of normalizedExamples) {
      if (ex.includes(f)) return true;
    }
  }

  return false;
}

/**
 * 中文功能說明：根據 refs + examples 做極簡後驗檢查（Phase 2-2/2-5）
 * - custom/entry：用 surfaceForms/key 做字串包含檢查
 * - grammar：不做字串檢查（避免誤判），先不列入後驗 missing
 */
function postCheckMissingRefs({ refs, examples }) {
  const refList = Array.isArray(refs) ? refs : [];
  const exList = Array.isArray(examples) ? examples : [];

  const used = [];
  const missing = [];

  for (const ref of refList) {
    if (!ref || typeof ref !== "object") continue;

    const kind = typeof ref.kind === "string" ? ref.kind : "custom";
    const key = typeof ref.key === "string" ? ref.key.trim() : "";
    if (!key) continue;

    // ✅ grammar refs：跳過字串檢查（避免誤判），留給 LLM usedRefs/missingRefs 或 notes
    if (kind === "grammar") {
      continue;
    }

    // ✅ 只針對 custom / entry 做後驗檢查
    if (kind !== "custom" && kind !== "entry") {
      continue;
    }

    const surfaceForms = getRefSurfaceForms(ref);
    const hit = isAnySurfaceFormUsedInExamples(exList, surfaceForms);

    if (hit) used.push(key);
    else missing.push(key);
  }

  return { used, missing };
}

// =========================
// 例句刷新 API
// POST /api/dictionary/examples
// =========================

router.post("/examples", async (req, res) => {
  const startedAt = Date.now();
  try {
    const {
      word,
      baseForm,
      partOfSpeech,
      gender,
      senseIndex,
      explainLang,

      definitionDe,
      definition,

      definitionDeList: bodyDefinitionDeList,
      definitionLangList: bodyDefinitionLangList,

      options,

      // ✅ Phase 2-5：多重參考點（可選；向後相容）
      // - multiRef: 是否啟用多重參考
      // - refs: [{ kind, key, displayText?, surfaceForms? ... }]
      multiRef,
      refs,
      _ts,
    } = req.body;

    const authUser = tryGetAuthUser(req);

    // ======== 正規化成陣列 ========
    const definitionDeList =
      Array.isArray(bodyDefinitionDeList) && bodyDefinitionDeList.length > 0
        ? bodyDefinitionDeList
        : Array.isArray(definitionDe)
        ? definitionDe
        : definitionDe
        ? [definitionDe]
        : [];

    const definitionLangList =
      Array.isArray(bodyDefinitionLangList) &&
      bodyDefinitionLangList.length > 0
        ? bodyDefinitionLangList
        : Array.isArray(definition)
        ? definition
        : definition
        ? [definition]
        : [];

    // ======== LLM 呼叫 ========
    const rawResult = await generateExamples({
      word,
      baseForm,
      partOfSpeech,
      gender,
      senseIndex,
      explainLang,
      options,
      definitionDeList,
      definitionLangList,

      // ✅ Phase 2-5：多重參考點（可選；向後相容）
      multiRef: !!multiRef,
      refs: Array.isArray(refs) ? refs : [],
      _ts,
    });

    if (process.env.DEBUG_DICTIONARY === "1") {
      console.log("[/examples raw]", rawResult);
    }

    // ======== 清洗回傳 ========
    const cleaned = {
      word: rawResult.word || word || "",
      baseForm: rawResult.baseForm || baseForm || "",
      partOfSpeech: rawResult.partOfSpeech || partOfSpeech || "",
      gender: rawResult.gender || gender || "",
      senseIndex:
        typeof rawResult.senseIndex === "number"
          ? rawResult.senseIndex
          : senseIndex || 0,
      options: rawResult.options || options || {},
      examples: [],
      exampleTranslation: "",
      // ✅ Phase 2：可觀測欄位（向後相容）
      usedRefs: Array.isArray(rawResult.usedRefs) ? rawResult.usedRefs : [],
      missingRefs: Array.isArray(rawResult.missingRefs)
        ? rawResult.missingRefs
        : [],
      notes: typeof rawResult.notes === "string" ? rawResult.notes : "",
    };

    const rawExamples = Array.isArray(rawResult.examples)
      ? rawResult.examples
      : [];

    const firstExample =
      rawExamples.find((s) => typeof s === "string" && s.trim().length > 0) ||
      "";

    if (firstExample) {
      cleaned.examples = [firstExample];
    }

    if (
      typeof rawResult.exampleTranslation === "string" &&
      rawResult.exampleTranslation.trim().length > 0
    ) {
      cleaned.exampleTranslation = rawResult.exampleTranslation.trim();
    }

    // =========================
    // Phase 2-5：後驗檢查（surfaceForms 優先）
    // - custom/entry：以 examples 內容做 case-insensitive includes
    // - grammar：不做 includes 檢查（避免誤判），保留 LLM 回報值
    // =========================
    try {
      const reqRefs = Array.isArray(refs) ? refs : [];
      if (reqRefs.length > 0) {
        const post = postCheckMissingRefs({
          refs: reqRefs,
          examples: cleaned.examples,
        });

        // ✅ 合併：保留 LLM 回報（可能含 grammar），再加入後驗結果（custom/entry）
        const mergedUsed = Array.from(
          new Set([
            ...(Array.isArray(cleaned.usedRefs) ? cleaned.usedRefs : []),
            ...(post.used || []),
          ])
        );
        const mergedMissing = Array.from(
          new Set([
            ...(Array.isArray(cleaned.missingRefs) ? cleaned.missingRefs : []),
            ...(post.missing || []),
          ])
        );

        cleaned.usedRefs = mergedUsed;
        cleaned.missingRefs = mergedMissing;

        diagRefsLog("post-check", {
          word: cleaned.word,
          refsCount: reqRefs.length,
          examplesCount: Array.isArray(cleaned.examples)
            ? cleaned.examples.length
            : 0,
          usedRefsCount: mergedUsed.length,
          missingRefsCount: mergedMissing.length,
        });
      }
    } catch (e) {
      // ✅ 保守：後驗檢查失敗不影響主要產出
      console.error("[dictionaryRoute] refs post-check failed:", e);
    }

    if (cleaned.examples.length === 0) {
      cleaned.examples = [`(No example generated - ${Date.now()})`];
      cleaned.exampleTranslation = "";
    }

    // ======== 用量紀錄（不影響回傳） ========
    try {
      const textForCount = JSON.stringify({
        word: cleaned.word,
        baseForm: cleaned.baseForm,
        partOfSpeech: cleaned.partOfSpeech,
        examples: cleaned.examples,
        exampleTranslation: cleaned.exampleTranslation,
        usedRefs: cleaned.usedRefs,
        missingRefs: cleaned.missingRefs,
        notes: cleaned.notes,
      });

      await logUsage({
        userId: authUser?.id || "",
        userEmail: authUser?.email || "",
        endpoint: "/api/dictionary/examples",
        charCount: textForCount.length,
        kind: "llm",
      });
    } catch (e) {
      console.error("[dictionaryRoute] logUsage failed:", e);
    }

    const elapsed = Date.now() - startedAt;
    console.log("[dictionaryRoute] /examples DONE in", elapsed, "ms");
    res.json(cleaned);
  } catch (err) {
    console.error("[dictionaryRoute] /examples error:", err);
    res.status(500).json({ error: "example_generation_failed" });
  }
});

// =========================
// 單字查詢 API
// POST /api/dictionary/lookup
// =========================

router.post("/lookup", async (req, res) => {
  const startedAt = Date.now();
  try {
    const { word, explainLang, _ts } = req.body || {};
    const authUser = tryGetAuthUser(req);

    const rawResult = await lookupWord({
      word,
      explainLang,
      _ts,
    });

    if (process.env.DEBUG_DICTIONARY === "1") {
      console.log("[/lookup raw]", rawResult);
    }

    const elapsed = Date.now() - startedAt;
    console.log("[dictionaryRoute] /lookup DONE in", elapsed, "ms");

    // ======== 用量紀錄（不影響回傳） ========
    try {
      const textForCount = JSON.stringify(rawResult || {});
      await logUsage({
        userId: authUser?.id || "",
        userEmail: authUser?.email || "",
        endpoint: "/api/dictionary/lookup",
        charCount: textForCount.length,
        kind: "llm",
      });
    } catch (e) {
      console.error("[dictionaryRoute] logUsage failed:", e);
    }

    res.json(rawResult || {});
  } catch (err) {
    console.error("[dictionaryRoute] /lookup error:", err);
    res.status(500).json({ error: "dictionary_lookup_failed" });
  }
});

// =========================
// 連續對話 API
// POST /api/dictionary/conversation
// =========================

router.post("/conversation", async (req, res) => {
  const startedAt = Date.now();
  try {
    const authUser = tryGetAuthUser(req);

    const rawResult = await generateConversation(req.body || {});
    const elapsed = Date.now() - startedAt;
    console.log("[dictionaryRoute] /conversation DONE in", elapsed, "ms");

    // ======== 用量紀錄（不影響回傳） ========
    try {
      const textForCount = JSON.stringify(rawResult || {});
      await logUsage({
        userId: authUser?.id || "",
        userEmail: authUser?.email || "",
        endpoint: "/api/dictionary/conversation",
        charCount: textForCount.length,
        kind: "llm",
      });
    } catch (e) {
      console.error("[dictionaryRoute] logUsage failed:", e);
    }

    res.json(rawResult || {});
  } catch (err) {
    console.error("[dictionaryRoute] /conversation error:", err);
    res.status(500).json({ error: "conversation_generation_failed" });
  }
});

module.exports = router;
// backend/src/routes/dictionaryRoute.js
