// backend/src/routes/dictionaryRoute.js

const express = require("express");
const router = express.Router();

const {
  lookupWord,
  generateExamples,
  generateConversation,
} = require("../clients/dictionaryClient");

const { logUsage } = require("../utils/usageLogger");

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

    // ★ 記錄用量（依字元數粗估 Token）
    const textForCount = (word || baseForm || "").toString();
    logUsage({
      endpoint: "/api/dictionary/examples",
      charCount: textForCount.length,
      kind: "llm",
      ip: req.ip,
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
      rawExamples.find(
        (s) => typeof s === "string" && s.trim().length > 0
      ) || "";

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

    // ★ 記錄用量
    logUsage({
      endpoint: "/api/dictionary/conversation",
      charCount: sentence.length,
      kind: "llm",
      ip: req.ip,
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
