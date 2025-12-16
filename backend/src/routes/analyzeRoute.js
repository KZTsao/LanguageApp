const express = require('express');
const router = express.Router();

const jwt = require("jsonwebtoken");

const { analyzeWord } = require('../services/analyzeWord');
const { analyzeSentence } = require('../services/analyzeSentence'); // 先保留引用（未使用）
const { AppError } = require('../utils/errorHandler');
const { detectMode } = require('../core/languageRules');
const { logUsage } = require('../utils/usageLogger');

// 判斷是否「像句子」
function looksLikeSentence(input) {
  const s = (input || '').trim();
  if (!s) return false;
  return /[.!?;:]/.test(s);
}

function detectNonSentenceLookupMode(input) {
  const s = (input || '').trim();
  if (!s) return 'word';

  const hasSpace = /\s/.test(s);
  if (!hasSpace && detectMode(s) === 'word') return 'word';
  return 'phrase';
}

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

  // ① 優先嘗試 verify
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

router.post('/', async (req, res, next) => {
  try {
    const { text, explainLang } = req.body;

    if (!text || typeof text !== 'string') {
      throw new AppError('請提供要分析的文字 text（字串）', 400);
    }

    const trimmed = text.trim();
    if (!trimmed) return res.json({ error: 'empty_input' });

    const authUser = tryGetAuthUser(req);

    // 記錄本次 /api/analyze 呼叫的粗略用量
    logUsage({
      endpoint: '/api/analyze',
      charCount: trimmed.length,
      kind: 'llm',
      ip: req.ip,
      userId: authUser?.id || "",
      email: authUser?.email || "",
    });

    const options = {
      explainLang: explainLang || 'zh-TW',
    };

    if (looksLikeSentence(trimmed)) {
      throw new AppError(
        '目前只支援「單字 / 片語 / 慣用語」（非句子）。若要分析句子，之後會在輸入匡加入「句子模式」選擇。',
        400
      );
    }

    const lookupMode = detectNonSentenceLookupMode(trimmed);
    options.queryMode = lookupMode;

    const result = await analyzeWord(trimmed, options);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
