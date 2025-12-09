const express = require('express');
const router = express.Router();

const { analyzeWord } = require('../services/analyzeWord');
const { analyzeSentence } = require('../services/analyzeSentence');
const { AppError } = require('../utils/errorHandler');
const { detectMode } = require('../core/languageRules');

router.post('/', async (req, res, next) => {
  try {
    const { text, explainLang } = req.body;

    if (!text || typeof text !== 'string') {
      throw new AppError('請提供要分析的文字 text（字串）', 400);
    }

    const mode = detectMode(text);
    const options = {
      explainLang: explainLang || 'zh-TW',
    };

    let result;
    if (mode === 'word') {
      result = await analyzeWord(text.trim(), options);
    } else {
      result = await analyzeSentence(text, options);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
