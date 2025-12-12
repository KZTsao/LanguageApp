const express = require('express');
const router = express.Router();

const { analyzeWord } = require('../services/analyzeWord');
const { analyzeSentence } = require('../services/analyzeSentence'); // 先保留引用（未使用），之後句子模式開啟可直接用
const { AppError } = require('../utils/errorHandler');
const { detectMode } = require('../core/languageRules');
const { logUsage } = require('../utils/usageLogger'); // ★ 新增：用量記錄

// 判斷是否「像句子」：先用標點做最保守的切分（符合你：句子之後用輸入匡模式才開）
// 你之後要更嚴格也可以，但這版先最小可行。
function looksLikeSentence(input) {
  const s = (input || '').trim();
  if (!s) return false;
  // 任何句子常見標點都先視為句子（含德文常見用法）
  return /[.!?;:]/.test(s);
}

// 非句子查詢分類：word / phrase（先不硬分 idiom，先都走同一條查詢邏輯）
function detectNonSentenceLookupMode(input) {
  const s = (input || '').trim();
  if (!s) return 'word';

  // 如果 detectMode 已經能判 word，就尊重它（通常單字）
  // 但保護：只要含空白，就視為 phrase（避免掉回 sentence）
  const hasSpace = /\s/.test(s);

  if (!hasSpace && detectMode(s) === 'word') return 'word';
  return 'phrase';
}

router.post('/', async (req, res, next) => {
  try {
    const { text, explainLang } = req.body;

    if (!text || typeof text !== 'string') {
      throw new AppError('請提供要分析的文字 text（字串）', 400);
    }

    const trimmed = text.trim();
    if (!trimmed) return res.json({ error: 'empty_input' });

    // 記錄本次 /api/analyze 呼叫的粗略用量
    logUsage({
      endpoint: '/api/analyze',
      charCount: trimmed.length,
      kind: 'llm',
      ip: req.ip,
    });

    const options = {
      explainLang: explainLang || 'zh-TW',
      // 可選：之後你要在 analyzeWord 內部用這個做 prompt 分流
      // queryMode: 'word' | 'phrase'
    };

    // ✅ 先不支援句子：有句子標點就擋掉
    if (looksLikeSentence(trimmed)) {
      throw new AppError(
        '目前只支援「單字 / 片語 / 慣用語」（非句子）。若要分析句子，之後會在輸入匡加入「句子模式」選擇。',
        400
      );
    }

    const lookupMode = detectNonSentenceLookupMode(trimmed);

    // ✅ 非句子：全部走 analyzeWord（先把「多字片語」導回字典路徑）
    // 你之後要把 idiom/phrase 做更精細的 prompt 分流，可在 analyzeWord 內使用 options.queryMode
    options.queryMode = lookupMode;

    const result = await analyzeWord(trimmed, options);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
