// backend/src/routes/dictionaryRoute.js

const express = require("express");
const router = express.Router();

const { lookupWord, generateExamples } = require("../clients/dictionaryClient");

/**
 * 例句刷新 API
 * POST /api/dictionary/examples
 */
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

      // 單義版舊欄位（原本就有的）
      definitionDe,
      definition,

      // ★ 新增：優先吃前端傳來的多義清單（如果有的話）
      definitionDeList: bodyDefinitionDeList,
      definitionLangList: bodyDefinitionLangList,

      options,
      _ts, // 前端丟來的時間戳，當作「隨機標記」
    } = req.body;

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

    // ★ 正規化成陣列：
    // 1. 若前端有直接傳 definitionDeList / definitionLangList 且非空陣列 → 優先用它
    // 2. 否則退回舊邏輯：用 definitionDe / definition 包成單一元素陣列

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
      _ts, // 傳給 LLM，用來打破完全相同的 prompt
    });

    if (process.env.DEBUG_DICTIONARY === "1") {
      console.log("[dictionaryRoute] /examples rawResult =", rawResult);
    }
    

    // 把結果整理成前端好吃的格式：
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

    // 只保留第一句例句
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

    // 翻譯（如果有）
    if (
      typeof rawResult.exampleTranslation === "string" &&
      rawResult.exampleTranslation.trim().length > 0
    ) {
      cleaned.exampleTranslation = rawResult.exampleTranslation.trim();
    }

    // 如果真的完全沒生成句子，給一個 placeholder，方便 debug
    if (cleaned.examples.length === 0) {
      const fallback = `(No example generated - ${Date.now()})`;
      cleaned.examples = [fallback];
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

module.exports = router;
