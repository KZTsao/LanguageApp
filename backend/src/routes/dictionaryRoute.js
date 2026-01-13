// backend/src/routes/dictionaryRoute.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

// =========================
// Phase X：回報問題（Example Report）寫入 Supabase
// - 目的：讓前端在「回報問題」當下，把畫面資訊（context/snapshot）一起送進 DB
// - 注意：這段僅新增，不影響既有 lookup/examples/conversation 流程
// =========================
const { createClient } = require("@supabase/supabase-js");

let __supabaseAdminClient = null;
function getSupabaseAdmin() {
  if (__supabaseAdminClient) return __supabaseAdminClient;

  const url = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    "";

  if (!url || !key) {
    return null;
  }

  __supabaseAdminClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return __supabaseAdminClient;
}

const {
  lookupWord,
  generateExamples,
  generateConversation,
} = require("../clients/dictionaryClient");

const { logUsage } = require("../utils/usageLogger");

// =========================
// refs 診斷開關（預設 false）
// =========================
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

  const normalizedForms = forms
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .map((s) => normalizeForIncludes(s));

  if (normalizedExamples.length === 0 || normalizedForms.length === 0) {
    return false;
  }

  for (const ex of normalizedExamples) {
    for (const f of normalizedForms) {
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
// 單字查詢 API
// POST /api/dictionary/lookup
// =========================
router.post("/lookup", async (req, res) => {
  try {
    const {
      word,
      explainLang,
      uiLang,
      useCache,
      enableMultiSense,
      includeDictEntry,
    } = req.body;

    const authUser = tryGetAuthUser(req);

    const result = await lookupWord({
      word,
      explainLang,
      uiLang,
      useCache,
      enableMultiSense,
      includeDictEntry,
    });

    // ✅ 用量紀錄（若沒有登入也可寫匿名，不阻塞）
    try {
      await logUsage({
        authUserId: authUser ? authUser.id : null,
        type: "dictionary_lookup",
        input: { word, explainLang, uiLang },
        output: result,
      });
    } catch (e) {
      console.warn("[dictionaryRoute] logUsage lookup failed:", e);
    }

    res.json(result);
  } catch (error) {
    console.error("[dictionaryRoute] /lookup error:", error);
    res.status(500).json({ error: "dictionary_lookup_failed" });
  }
});

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

    // ✅ 用量紀錄（若沒有登入也可寫匿名，不阻塞）
    try {
      await logUsage({
        authUserId: authUser ? authUser.id : null,
        type: "dictionary_examples",
        input: {
          word,
          baseForm,
          partOfSpeech,
          gender,
          senseIndex,
          explainLang,
          options,
          definitionDeList,
          definitionLangList,

          // ✅ Phase 2-5：記錄 refs 輸入，方便 audit
          multiRef: !!multiRef,
          refs: Array.isArray(refs) ? refs : [],
        },
        output: cleaned,
      });
    } catch (e) {
      console.warn("[dictionaryRoute] logUsage examples failed:", e);
    }

    const elapsedMs = Date.now() - startedAt;

    res.json({
      ...cleaned,
      _debug: {
        elapsedMs,
      },
    });
  } catch (error) {
    console.error("[dictionaryRoute] /examples error:", error);
    res.status(500).json({ error: "examples_generation_failed" });
  }
});

// =========================
// 對話生成 API
// POST /api/dictionary/conversation
// =========================
router.post("/conversation", async (req, res) => {
  try {
    const {
      word,
      baseForm,
      partOfSpeech,
      gender,
      senseIndex,
      explainLang,
      uiLang,

      // 對話主題/角色/程度
      scenario,
      difficulty,
      options,
    } = req.body;

    const authUser = tryGetAuthUser(req);

    const result = await generateConversation({
      word,
      baseForm,
      partOfSpeech,
      gender,
      senseIndex,
      explainLang,
      uiLang,
      scenario,
      difficulty,
      options,
    });

    // ✅ 用量紀錄（若沒有登入也可寫匿名，不阻塞）
    try {
      await logUsage({
        authUserId: authUser ? authUser.id : null,
        type: "dictionary_conversation",
        input: {
          word,
          baseForm,
          partOfSpeech,
          gender,
          senseIndex,
          explainLang,
          uiLang,
          scenario,
          difficulty,
          options,
        },
        output: result,
      });
    } catch (e) {
      console.warn("[dictionaryRoute] logUsage conversation failed:", e);
    }

    res.json(result);
  } catch (err) {
    console.error("[dictionaryRoute] /conversation error:", err);
    res.status(500).json({ error: "conversation_generation_failed" });
  }
});


// =========================
// 回報問題 API（Example Report）
// POST /api/dictionary/examples/report
// - 前端於回報當下送：exampleId + reportType + context（畫面資訊）
// - 後端：寫入 public.dict_example_reports
// =========================
// =========================
// 回報問題 API（Example Report）
// POST /api/dictionary/examples/report
// - 前端於回報當下送：exampleId + reportType + context（畫面資訊）
// - 後端：寫入 public.dict_example_reports
// - DB schema (current): example_id / auth_user_id / report_type / reason / created_at
// =========================
router.post("/examples/report", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.status(500).json({
        ok: false,
        error: "supabase_admin_not_configured",
      });
    }

    const authUser = tryGetAuthUser(req);

    // ✅ Auth required: 回報問題必須登入
    if (!authUser || !authUser.id) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }


    const {
      exampleId,
      example_id,
      reportType,
      report_type,
      note,
      reportNote,
      report_note,
      reason,
      context,
      payload,
      snapshot,
    } = req.body || {};

    const finalExampleId =
      typeof exampleId === "number"
        ? exampleId
        : typeof example_id === "number"
        ? example_id
        : null;

    const finalReportType =
      typeof reportType === "string" && reportType.trim()
        ? reportType.trim()
        : typeof report_type === "string" && report_type.trim()
        ? report_type.trim()
        : "unknown";

    const finalNote =
      typeof note === "string"
        ? note
        : typeof reportNote === "string"
        ? reportNote
        : typeof report_note === "string"
        ? report_note
        : "";

    if (!finalExampleId) {
      return res.status(400).json({ ok: false, error: "missing_example_id" });
    }

    // ✅ 一律把「當下畫面資訊」收進 reason（JSON 字串），方便日後回放/除錯
    // - 若前端已提供 reason（字串），就把它當作 baseReason.note
    const nowIso = new Date().toISOString();
    const reasonObj = {
      note: typeof reason === "string" && reason.trim() ? reason.trim() : finalNote || "",
      context: context || payload || null,
      snapshot: snapshot || null,
      requestMeta: {
        receivedAt: nowIso,
        userAgent: req.headers["user-agent"] || "",
        referer: req.headers.referer || "",
        origin: req.headers.origin || "",
        ip: req.ip || "",
      },
    };

    // DEPRECATED (kept for backward comparison; DO NOT USE)
    // const insertRowLegacy = {
    //   example_id: finalExampleId,
    //   report_type: finalReportType,
    //   report_note: finalNote,
    //   context: { ...reasonObj },
    // };

    const insertRowAligned = {
      example_id: finalExampleId,
      report_type: finalReportType,
      reason: JSON.stringify(reasonObj),
    };

    if (authUser && authUser.id) {
      insertRowAligned.auth_user_id = authUser.id;
    }

    const { data, error } = await supabase
      .from("dict_example_reports")
      .insert(insertRowAligned)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[dictionaryRoute] /examples/report insert error:", error);
      return res.status(500).json({ ok: false, error: "db_insert_failed" });
    }

    return res.json({ ok: true, id: data ? data.id : null });
  } catch (err) {
    console.error("[dictionaryRoute] /examples/report error:", err);
    return res.status(500).json({ ok: false, error: "report_failed" });
  }
});
router.post("/reportIssue", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.status(500).json({
        ok: false,
        error: "supabase_admin_not_configured",
      });
    }

    const authUser = tryGetAuthUser(req);

    // ✅ Auth required: 回報問題必須登入
    if (!authUser || !authUser.id) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }


    const {
      headword,
      canonicalPos,
      canonical_pos,
      senseIndex,
      sense_index,
      reportIssueCategory,
      issueCategory,
      report_type,
      reportType,
      definition,
      definition_de,
      definition_de_translation,
      snapshot,
      context,
      payload,
    } = req.body || {};

    const finalHeadword =
      typeof headword === "string" && headword.trim() ? headword.trim() : "";

    const finalCanonicalPos =
      typeof canonicalPos === "string" && canonicalPos.trim()
        ? canonicalPos.trim()
        : typeof canonical_pos === "string" && canonical_pos.trim()
        ? canonical_pos.trim()
        : "";

    const finalSenseIndex =
      typeof senseIndex === "number"
        ? senseIndex
        : typeof sense_index === "number"
        ? sense_index
        : 0;

    const finalCategory =
      typeof reportIssueCategory === "string" && reportIssueCategory.trim()
        ? reportIssueCategory.trim()
        : typeof issueCategory === "string" && issueCategory.trim()
        ? issueCategory.trim()
        : typeof reportType === "string" && reportType.trim()
        ? reportType.trim()
        : typeof report_type === "string" && report_type.trim()
        ? report_type.trim()
        : "unknown";

    if (!finalHeadword || !finalCanonicalPos) {
      return res.status(400).json({
        ok: false,
        error: "missing_headword_or_pos",
      });
    }

    // ✅ 1) 先標記 dict_entries.needs_refresh = true（如果你的 schema 有這個欄位）
    // - 欄位不存在時 supabase 會回錯；這裡會轉成 warning，不讓整個回報失敗
    let updateOk = false;
    let updateWarning = null;

    try {
      const { error: updateErr } = await supabase
        .from("dict_entries")
        .update({ needs_refresh: true })
        .eq("headword", finalHeadword)
        .eq("canonical_pos", finalCanonicalPos);

      if (updateErr) {
        updateWarning = String(updateErr.message || updateErr.details || updateErr);
      } else {
        updateOk = true;
      }
    } catch (e) {
      updateWarning = String(e && e.message ? e.message : e);
    }

    // ✅ 2) 盡力寫入 dict_entry_reports（若表還沒建，不阻塞）
    // - reason：把當下畫面資訊塞進去（JSON 字串）
    const nowIso = new Date().toISOString();
    const reasonObj = {
      category: finalCategory,
      headword: finalHeadword,
      canonicalPos: finalCanonicalPos,
      senseIndex: finalSenseIndex,
      snapshot: snapshot || null,
      context: context || payload || null,
      definition: typeof definition === "string" ? definition : "",
      definition_de: typeof definition_de === "string" ? definition_de : "",
      definition_de_translation:
        typeof definition_de_translation === "string"
          ? definition_de_translation
          : "",
      requestMeta: {
        receivedAt: nowIso,
        userAgent: req.headers["user-agent"] || "",
        referer: req.headers.referer || "",
        origin: req.headers.origin || "",
        ip: req.ip || "",
      },
    };

    let reportInserted = false;
    let reportInsertWarning = null;

    try {
      const insertRow = {
        headword: finalHeadword,
        canonical_pos: finalCanonicalPos,
        sense_index: finalSenseIndex,
        report_issue_category: finalCategory,
        note: JSON.stringify(reasonObj),
      };

      if (authUser && authUser.id) {
        insertRow.auth_user_id = authUser.id;
      }

      const { error: insertErr } = await supabase
        .from("dict_entry_reports")
        .insert(insertRow);

      if (insertErr) {
        reportInsertWarning = String(insertErr.message || insertErr.details || insertErr);
      } else {
        reportInserted = true;
      }
    } catch (e) {
      reportInsertWarning = String(e && e.message ? e.message : e);
    }

    return res.json({
      ok: true,
      updateOk,
      reportInserted,
      warning: updateWarning || reportInsertWarning || null,
    });
  } catch (err) {
    console.error("[dictionaryRoute] /reportIssue error:", err);
    return res.status(500).json({ ok: false, error: "report_issue_failed" });
  }
});


module.exports = router;
// backend/src/routes/dictionaryRoute.js
