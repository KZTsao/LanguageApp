// backend/src/clients/dictionaryLookup.js

const client = require('./groqClient');
const {
  fallback,
  mapExplainLang,
  normalizeDictionaryResult,
} = require('./dictionaryUtils');
const { systemPrompt, buildUserPrompt } = require('./dictionaryPrompts');

/**
 * 查詢單字主函式
 * rawWord: 使用者查的字
 * explainLang: zh-TW / en / ...
 */
async function lookupWord(rawWord, explainLang = 'zh-TW') {
  const word = String(rawWord || '').trim();
  if (!word) {
    return fallback('');
  }

  const targetLangLabel = mapExplainLang(explainLang);

  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildUserPrompt(word, targetLangLabel) },
      ],
    });

    const content = response.choices?.[0]?.message?.content;

    // 紀錄長度幫助除錯（避免印出過長內容）
    if (!content) {
      console.error('[dictionary] Empty content from LLM in lookup for word:', word);
      return fallback(word);
    }

    if (process.env.DEBUG_LLM_DICT === "1") {
      console.log(
        '[dictionary] raw LLM dictionary content length:',
        content.length,
        'for word:',
        word
      );
    }
    if (process.env.DEBUG_LLM_DICT === "1") {
      if (content.length <= 800) {
        console.log('[dictionary] raw LLM dictionary content preview:', content);
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('[dictionary] JSON parse error in lookup:', e);
      console.error('[dictionary] raw content that failed to parse in lookup:', content);
      return fallback(word);
    }

    // 正規化結果（內含欄位整理，例如確保 definition/definition_de 皆為陣列等）
    const normalized = normalizeDictionaryResult(parsed, word);

    // ★ 若模型有給 exampleTranslation / example_translation，但 normalize 尚未處理，這裡補上
    if (parsed.exampleTranslation && !normalized.exampleTranslation) {
      normalized.exampleTranslation = parsed.exampleTranslation;
    }
    if (parsed.example_translation && !normalized.exampleTranslation) {
      normalized.exampleTranslation = parsed.example_translation;
    }

    // ★ 若 example 遺失，嘗試從 parsed 補上
    if (!normalized.example && parsed.example) {
      normalized.example = parsed.example;
    }

    return normalized;
  } catch (err) {
    // 這裡同時處理一般錯誤與 Groq rate limit
    const message =
      err && typeof err.message === 'string' ? err.message : String(err || '');
    console.error('[dictionary] Groq lookup error:', message, 'for word:', word);

    const base = fallback(word);

    // ★ 若是 Groq 的每日額度用完（rate_limit_exceeded）
    if (message.includes('rate_limit_exceeded')) {
      return {
        ...base,
        definition: '今日用量已達上限，暫時無法查詢。',
      };
    }

    return base;
  }
}

module.exports = { lookupWord };
