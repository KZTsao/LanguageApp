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

// =========================
// 共用：嘗試解析登入使用者（不強制）
// verify → decode fallback（只用於用量歸戶）
// =========================
function tryGetAuthUser(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  // ① 優先 verify（若環境變數存在）
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
        "[dictionaryRoute] jwt.verify failed, fallback to decode"
      );
    }
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
      _ts,
    } = req.body;

    const authUser = tryGetAuthUser(req);

    // ★ 記錄用量（依字元數粗估 Token）
    const textForCount = (word || baseForm || "").toString();
    logUsage({
      endpoint: "/api/dictionary/examples",
      charCount: textForCount.length,
      kind: "llm",
      ip: req.ip,
      userId: authUser?.id || "",
      email: authUser?.email || "",
    });

    console.log("[dictionaryRoute] /examples START", {
      word,
      baseForm,
      partOfSpeech,
      gender,
      senseIndex,
      explainLang,
      options,
      _ts,
    });

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

    if (cleaned.examples.length === 0) {
      cleaned.examples = [`(No example generated - ${Date.now()})`];
      cleaned.exampleTranslation = "";
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
// 連續對話 API
// POST /api/dictionary/conversation
// =========================

router.post("/conversation", async (req, res) => {
  try {
    const { sentence, explainLang } = req.body || {};

    console.log("[dictionaryRoute] /conversation START", {
      sentence,
      explainLang,
    });

    if (!sentence || typeof sentence !== "string") {
      return res.status(400).json({ error: "sentence is required" });
    }

    // ✅【新增】解析使用者（僅用於用量歸戶）
    const authUser = tryGetAuthUser(req);

    // ★ 記錄用量
    logUsage({
      endpoint: "/api/dictionary/conversation",
      charCount: sentence.length,
      kind: "llm",
      ip: req.ip,
      userId: authUser?.id || "",
      email: authUser?.email || "",
    });

    const turns = await generateConversation({
      sentence,
      explainLang,
    });

    console.log(
      "[dictionaryRoute] /conversation DONE, turns.length =",
      Array.isArray(turns) ? turns.length : 0
    );

    return res.json({ turns: Array.isArray(turns) ? turns : [] });
  } catch (err) {
    console.error("[dictionaryRoute] /conversation error:", err);
    return res
      .status(500)
      .json({ error: "conversation_generation_failed" });
  }
});

module.exports = router;
// backend/src/routes/dictionaryRoute.js
