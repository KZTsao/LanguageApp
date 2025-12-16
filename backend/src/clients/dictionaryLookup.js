// backend/src/clients/dictionaryLookup.js

const client = require('./groqClient');
const {
  fallback,
  mapExplainLang,
  normalizeDictionaryResult,
} = require('./dictionaryUtils');
const { systemPrompt, buildUserPrompt } = require('./dictionaryPrompts');

/**
 * 依據已正規化的 conjugation 判斷「不規則」類型（B 方案：結構化）
 * - strong: 強變化（Präteritum 通常非 -te，Partizip II 常為 -en）
 * - mixed: 混合（Präteritum 為 -te，但仍非完全規則；Partizip II 常為 -t）
 * - suppletive: 完全不規則（目前先針對 sein）
 *
 * 回傳：
 * - null：代表判定為規則或資料不足
 * - "strong" | "mixed" | "suppletive"
 */
function detectIrregularTypeFromNormalized(normalized) {
  try {
    if (!normalized || normalized.partOfSpeech !== 'Verb') return null;

    const base = String(normalized.baseForm || normalized.word || '').trim().toLowerCase();

    // 先處理最明確的 suppletive
    // （德語教學上最典型：sein）
    if (base === 'sein') return 'suppletive';

    const conj = normalized.conjugation || {};
    const praesens = conj.praesens || {};
    const praeteritum = conj.praeteritum || {};
    const perfekt = conj.perfekt || {};

    const prI = String(praesens.ich || '').trim();
    const ptI = String(praeteritum.ich || '').trim();
    const pfI = String(perfekt.ich || '').trim();

    // 資料不足：不判
    if (!ptI && !pfI) return null;

    // ---- 取 Partizip II（perfekt.ich 通常像： "habe gegessen" / "bin gegangen"）
    let partizip = '';
    if (pfI) {
      const parts = pfI.split(/\s+/).filter(Boolean);
      partizip = parts.length >= 2 ? parts[parts.length - 1] : '';
    }

    const ptLower = ptI.toLowerCase();
    const partLower = partizip.toLowerCase();

    const praeteritumLooksWeak = !!ptLower && ptLower.endsWith('te'); // ich machte / ich dachte
    const partizipLooksWeak = !!partLower && partLower.endsWith('t'); // gemacht / gedacht
    const partizipLooksStrong = !!partLower && partLower.endsWith('en'); // gegangen / gegessen

    // ---- mixed：Präteritum 是 -te，但仍不當作純規則（多半會伴隨詞幹變化）
    // 這裡用最保守判斷：pt=-te 且 Partizip II = -t -> mixed
    // （machen: machte / gemacht 會符合，但它是規則；因此再加一個「詞幹明顯不同」的檢查）
    if (praeteritumLooksWeak && partizipLooksWeak) {
      // 詞幹差異粗略判斷（避免把純規則當 mixed）
      // 取 baseForm 的詞幹（去掉 -en / -n）
      const baseStem = base.replace(/(en|n)$/i, '');
      const ptStem = ptLower.replace(/te$/i, '');
      const partStem = partLower
        .replace(/^ge/i, '')
        .replace(/t$/i, '');

      // 若 präteritum / partizip 的 stem 都跟 baseStem 很接近，就當作規則（不標）
      // 若至少一個明顯不同，視為 mixed
      const looksSimilar = (a, b) => {
        if (!a || !b) return false;
        if (a === b) return true;
        // 簡易相似：其中一個包含另一個
        return a.includes(b) || b.includes(a);
      };

      const ptSimilar = looksSimilar(ptStem, baseStem);
      const partSimilar = looksSimilar(partStem, baseStem);

      if (!(ptSimilar && partSimilar)) {
        return 'mixed';
      }
      return null;
    }

    // ---- strong：Präteritum 不像弱變化（非 -te）或 Partizip II 明顯為 -en
    if (partizipLooksStrong) return 'strong';
    if (!!ptLower && !praeteritumLooksWeak) return 'strong';

    // 其餘：不判（當作規則或資訊不足）
    return null;
  } catch (e) {
    return null;
  }
}

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

    // ★ 補回 normalize 可能忽略的欄位（保持向下相容）
    if (parsed.type && !normalized.type) {
      normalized.type = parsed.type;
    }

    if (parsed.recommendations && !normalized.recommendations) {
      normalized.recommendations = {
        synonyms: Array.isArray(parsed.recommendations.synonyms)
          ? parsed.recommendations.synonyms
          : [],
        antonyms: Array.isArray(parsed.recommendations.antonyms)
          ? parsed.recommendations.antonyms
          : [],
        roots: Array.isArray(parsed.recommendations.roots)
          ? parsed.recommendations.roots
          : [],
      };
    }

    // ★ Step C（本輪新增）：不規則動詞判斷（B 方案：結構化）
    // - 不改動既有欄位，只新增 normalized.irregular
    // - 若判定為規則或資料不足：enabled=false
    const irregularType = detectIrregularTypeFromNormalized(normalized);
    normalized.irregular = {
      enabled: !!irregularType,
      type: irregularType || null, // "strong" | "mixed" | "suppletive" | null
    };

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

// backend/src/clients/dictionaryLookup.js
