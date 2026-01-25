// backend/src/clients/dictionaryLookup.js

/**
 * 文件說明：
 * - 查字主流程（dictionaryLookup）
 * - 本檔案負責：DB-first（先查 Supabase dict_entries/dict_senses）→ miss 才走 LLM
 *
 * 異動紀錄：
 * - 2026-01-04：加入 DB-first（DICT_DB_FIRST）、加入 DB log（DEBUG_DICT_DB）、加入 Supabase admin client 自動偵測（避免 export 名稱不一致）
 * - 2026-01-04：支援 ../db/supabaseAdmin 匯出為 getSupabaseAdmin()（避免只有函式匯出時無法取得 client）
 * - 2026-01-05：✅ Step 2-2：lookupWord 支援 options.targetPosKey（POS re-query）：
 *   - 若 DB-first hit 但 canonical_pos 與 targetPosKey 不符 → 視為 miss（讓 LLM 有機會回指定詞性）
 *   - 若走 LLM：在 user prompt 後追加 POS override 指令（不改 dictionaryPrompts.js 也能生效）
 *   - 加入 DEBUG_LLM_DICT_POS=1 時的 runtime console（Production 排查）
 *
 * - 2026-01-05：✅ Step 3：LLM 回傳 posOptions（可切換詞性 scaffolding）
 *   - 在 user prompt 後追加 POS_OPTIONS 指令（不改 dictionaryPrompts.js 也能生效）
 *   - normalize 後補上 normalized.posOptions（若 normalizeDictionaryResult 尚未處理）
 *   - 加入 DEBUG_LLM_DICT_POS_OPTIONS=1 時的 runtime console（Production 排查）
 *
 * - 2026-01-05：✅ Step 2-3：Dictionary Lookup（lookupWord）導入 LLM 真實 tokens 記帳
 *   - 在 Groq 回傳 response.usage 後呼叫 logLLMUsage()
 *   - 可透過 options 傳入 userId/email/ip/endpoint/requestId（向下相容：沒傳也不影響查字）
 *
 * - 2026-01-08：✅ Phase 2：DB-first HIT 時同時回填 dict_entry_props，並支援 dict_entries.needs_refresh
 *   - dict_entries：讀 needs_refresh / quality_status / refresh meta
 *   - 若 needs_refresh=true：視為 miss（允許走 LLM refresh）
 *   - dict_entry_props：讀 noun/verb/prep + extra_props，並以「白名單」merge 回 parsedLike（避免污染結構）
 *
 * - 2026-01-09：✅ Phase 2-2：LLM 查詢完成後，落地寫入 dict_entries / dict_entry_props / dict_senses（DB-first 真正生效）
 *   - dict_entries：needs_refresh=false、quality_status='ok'
 *   - dict_senses：以 explainLang 覆蓋（同語言先刪再插入）
 *   - dict_entry_props：noun/verb/prep 欄位 + extra_props（保留結構化資訊供 DB-first 還原）
 *
 * 功能初始化狀態（Production 排查）（Step 3 補充）：
 * - DICT_LLM_POS_OPTIONS=1：要求 LLM 回傳 posOptions（預設 1）
 * - DEBUG_LLM_DICT_POS_OPTIONS=1：印出 posOptions 指令是否套用與回傳長度（預設 0）
 *
 * 功能初始化狀態（Production 排查）：
 * - DICT_DB_FIRST=1：啟用 DB-first（命中 DB 時不呼叫 LLM）
 * - DEBUG_DICT_DB=1：輸出 [dictionary][db] 觀察 log
 * - DEBUG_LLM_DICT=1：印出 LLM 回傳 content length/preview（既有）
 * - DEBUG_LLM_DICT_POS=1：印出 lookupWord 的 targetPosKey / prompt override（本次新增）
 */

// backend/src/clients/dictionaryLookup.js

// const client = require('./groqClient'); // (moved to lazy-load to avoid require-time side effects)
let __groqClient = null;
function getGroqClient() {
  if (__groqClient) return __groqClient;
  // Lazy-load: avoid loading Groq client (and its deps) unless we truly need LLM fallback.
  // This prevents noisy warnings / stack traces during DB-hit or authority-hit paths.
  __groqClient = require('./groqClient');
  return __groqClient;
}
const {
  fallback,
  mapExplainLang,
  normalizeDictionaryResult,
} = require('./dictionaryUtils');
const {
  systemPrompt,
  buildUserPrompt,
  glossSystemPrompt,
  buildGlossUserPrompt,
  senseSplitSystemPrompt,
  buildSenseSplitUserPrompt,
} = require('./dictionaryPrompts');
// ✅ Plugin-based authorities (DWDS/Wiktionary/etc.)
let __authorities = null;
function getAuthoritiesRegistry() {
  if (__authorities) return __authorities;
  // Lazy-load to avoid require-time side effects
  __authorities = require('./dictionary/authorities');
  return __authorities;
}


// ✅ Step 2-3（本次新增）：LLM 真實 tokens 記帳（回寫 profiles 由 usageLogger 負責）
const { logLLMUsage } = require('../utils/usageLogger');
/**
 * ✅ Learner language label (for LLM prompts)
 * - 不信任 mapExplainLang 對某些 locale 的 fallback（例如 zh-TW 有時會落到 English）
 * - 在這裡先做最小保底：只要是 zh-*，就給明確中文標籤，避免 LLM 產出英文 gloss
 */
function getTargetLangLabelSafe(explainLang) {
  const code = String(explainLang || '').trim();
  const lower = code.toLowerCase();

  if (lower === 'zh-tw' || lower === 'zh-hant' || lower.startsWith('zh-hant-')) {
    return `Chinese (Traditional) [${code}]`;
  }
  if (lower === 'zh-cn' || lower === 'zh-hans' || lower.startsWith('zh-hans-') || lower.startsWith('zh-')) {
    return `Chinese (Simplified) [${code}]`;
  }

  const label = mapExplainLang(code);
  if (label) return `${label} [${code}]`;

  // Fallback: still pass code so model knows it's not English by default
  return `(${code})`;
}



// ✅ Phase 2-2：DB 落地寫入（dict_entries / dict_entry_props / dict_senses）
const {
  upsertDictEntryAndGetIdCore,
  upsertDictEntryPropsCore,
  upsertDictSensesForLangCore,
} = require('../io/dictEntryIO');

/**
 * ✅ DB-first / Debug 開關（預設關）
 */
const DICT_DB_FIRST_ENABLED = String(process.env.DICT_DB_FIRST || '0') === '1';
const DEBUG_DICT_DB = String(process.env.DEBUG_DICT_DB || '0') === '1';

/**
 * ✅ POS Debug（本次新增）
 * - 用於確認：targetPosKey 是否有一路傳到 dictionaryLookup.js，並且 prompt override 是否有套用
 */
const DEBUG_LLM_DICT_POS = String(process.env.DEBUG_LLM_DICT_POS || '0') === '1';


/**
 * ✅ Step 3（本次新增）posOptions 開關
 * 中文功能說明：
 * - 目的：第一次 LLM 查詢就回傳 posOptions（可切換詞性清單）
 * - 預設啟用：避免每次都要額外設定 env
 * - 注意：此功能只要求 LLM 回傳，不做本地推測
 */
const DICT_LLM_POS_OPTIONS_ENABLED = String(process.env.DICT_LLM_POS_OPTIONS || '1') === '1';

/**
 * ✅ Step 3（本次新增）posOptions Debug
 * 中文功能說明：
 * - 用於確認：POS_OPTIONS scaffold 是否有附加到 prompt，以及模型是否回傳 posOptions
 */
const DEBUG_LLM_DICT_POS_OPTIONS = String(process.env.DEBUG_LLM_DICT_POS_OPTIONS || '0') === '1';

/**
 * ✅ 檔案載入即輸出（只在 DEBUG_DICT_DB=1 時印）
 * - 用來確認：你跑到的就是這份 dictionaryLookup.js
 */
if (DEBUG_DICT_DB) {
  // eslint-disable-next-line no-console
  console.log('[dictionary] dictionaryLookup loaded:', __filename);
  // eslint-disable-next-line no-console
  console.log('[dictionary] env DEBUG_DICT_DB:', process.env.DEBUG_DICT_DB);
  // eslint-disable-next-line no-console
  console.log('[dictionary] env DICT_DB_FIRST:', process.env.DICT_DB_FIRST);
}

/**
 * ✅ 判斷是否像 Supabase client（最低限度）
 */
function isSupabaseLikeClient(obj) {
  try {
    return !!obj && typeof obj === 'object' && typeof obj.from === 'function';
  } catch (e) {
    return false;
  }
}

/**
 * ✅ 取得 Supabase admin client（容錯：不同 export 名稱 / default export）
 * - 你目前錯誤：supabaseAdmin client not found in ../db/supabaseAdmin exports
 * - 這裡改成「先判斷 mod 本身是不是 client」，再依序嘗試各種常見命名
 *
 * 注意：
 * - 不改動其他檔案
 * - 只在這裡做 require + 偵測
 */
let __dictSupabaseAdminClient = null;

function getSupabaseAdminClientSafe() {
  if (__dictSupabaseAdminClient) return __dictSupabaseAdminClient;

  try {
    // eslint-disable-next-line global-require
    const mod = require('../db/supabaseAdmin');

    // 0-1) module.exports = { getSupabaseAdmin() }（你目前 supabaseAdmin.js 就是這種）
    // - 若存在 getSupabaseAdmin 函式，必須呼叫它才拿得到 supabase client
    // - 這裡只做「向下相容擴充」，不移除既有偵測
    if (typeof mod?.getSupabaseAdmin === 'function') {
      const maybeClient = mod.getSupabaseAdmin();

      if (isSupabaseLikeClient(maybeClient)) {
        __dictSupabaseAdminClient = maybeClient;

        if (DEBUG_DICT_DB) {
          // eslint-disable-next-line no-console
          console.log('[dictionary][db] supabase client detected via getSupabaseAdmin()');
        }

        return __dictSupabaseAdminClient;
      }

      if (DEBUG_DICT_DB) {
        // eslint-disable-next-line no-console
        console.warn('[dictionary][db] getSupabaseAdmin() returned non-supabase client');
      }
    }

    // 0) module.exports = client（最常見盲點）
    if (isSupabaseLikeClient(mod)) {
      __dictSupabaseAdminClient = mod;
      if (DEBUG_DICT_DB) {
        // eslint-disable-next-line no-console
        console.log('[dictionary][db] supabase client detected as module export');
      }
      return __dictSupabaseAdminClient;
    }

    // 1) module.exports = { default: client }
    if (isSupabaseLikeClient(mod?.default)) {
      __dictSupabaseAdminClient = mod.default;
      if (DEBUG_DICT_DB) {
        // eslint-disable-next-line no-console
        console.log('[dictionary][db] supabase client detected as default export');
      }
      return __dictSupabaseAdminClient;
    }

    // 2) module.exports = { supabaseAdmin / supabase / adminClient / client }
    const candidates = [
      mod?.supabaseAdmin,
      mod?.supabase,
      mod?.adminClient,
      mod?.client,
      mod?.sb,
      mod?.db,
    ];

    for (const c of candidates) {
      if (isSupabaseLikeClient(c)) {
        __dictSupabaseAdminClient = c;
        if (DEBUG_DICT_DB) {
          // eslint-disable-next-line no-console
          console.log('[dictionary][db] supabase client detected from named export');
        }
        return __dictSupabaseAdminClient;
      }
    }

    // 3) 找不到就印出 keys（只在 DEBUG）
    if (DEBUG_DICT_DB) {
      const keys = mod && typeof mod === 'object' ? Object.keys(mod) : [];
      // eslint-disable-next-line no-console
      console.warn('[dictionary][db] supabaseAdmin client not found in ../db/supabaseAdmin exports', { keys });
    }

    return null;
  } catch (e) {
    if (DEBUG_DICT_DB) {
      // eslint-disable-next-line no-console
      console.warn('[dictionary][db] require ../db/supabaseAdmin failed:', e?.message || e);
    }
    return null;
  }
}

/**
 * ✅ Phase 2（本次新增）
 * 中文功能說明：
 * - 從 dict_entry_props.extra_props 安全地取出指定 key（避免 extra_props 非 object）
 * - 只讀不寫，避免污染資料
 */
function safeGetExtraProp(extraProps, key) {
  try {
    if (!extraProps || typeof extraProps !== 'object') return undefined;
    return extraProps[key];
  } catch (e) {
    return undefined;
  }
}

/**
 * ✅ Phase 2（本次新增）
 * 中文功能說明：
 * - 白名單 merge：把 extra_props 內的「已知欄位」補到 parsedLike（僅當 parsedLike 尚未有該 key）
 * - 目的：讓 normalizeDictionaryResult 能吃到更多結構化資訊（不改 dictionaryUtils）
 * - 設計原則：
 *   - 不做推測、不做 mapping
 *   - 不覆寫已存在欄位（避免 DB 資料錯誤覆蓋）
 */
function mergeExtraPropsWhitelistIntoParsedLike(parsedLike, extraProps) {
  try {
    if (!parsedLike || typeof parsedLike !== 'object') return parsedLike;
    if (!extraProps || typeof extraProps !== 'object') return parsedLike;

    // 白名單：依你目前 normalized/LLM schema 常見欄位
    const whitelistKeys = [
      'baseForm',
      'gender',
      'plural',
      'verbSubtype',
      'separable',
      'reflexive',
      'auxiliary',
      'conjugation',
      'valenz',
      'tenses',
      'comparison',
      'notes',
      'posOptions',
      'recommendations',
      'irregular',
      'primaryPos',
      'posKey',
      'canonicalPos',
    ];

    for (const k of whitelistKeys) {
      if (parsedLike[k] === undefined) {
        const v = safeGetExtraProp(extraProps, k);
        if (v !== undefined) {
          parsedLike[k] = v;
        }
      }
    }

    return parsedLike;
  } catch (e) {
    return parsedLike;
  }
}

/**
 * ✅ Phase 2-2（本次新增）
 * 中文功能說明：
 * - 從 normalized 組出 entryProps（dict_entry_props）
 * - 注意：不做詞性推測，只做「把已存在資料搬進 DB」
 */
function buildEntryPropsFromNormalized(normalized) {
  try {
    const pos = String(normalized?.partOfSpeech || normalized?.canonicalPos || '').trim();

    const noun_gender = String(normalized?.gender || '').trim() || null;
    const noun_plural = String(normalized?.plural || '').trim() || null;

    const verb_separable = typeof normalized?.separable === 'boolean' ? normalized.separable : null;

    // normalize 內 irregular 是 { enabled, type }；DB 欄位是 verb_irregular boolean
    // - 若 enabled=true -> verb_irregular=true
    // - 若 undefined -> null
    let verb_irregular = null;
    if (typeof normalized?.irregular?.enabled === 'boolean') {
      verb_irregular = normalized.irregular.enabled;
    }

    const verb_reflexive = typeof normalized?.reflexive === 'boolean' ? normalized.reflexive : null;

    const prep_case = String(normalized?.prep_case || '').trim() || null;

    // extra_props：保留你 DB-first 還原要用的結構化欄位（白名單）
    const extra_props = {
      baseForm: normalized?.baseForm,
      gender: normalized?.gender,
      plural: normalized?.plural,
      verbSubtype: normalized?.verbSubtype,
      separable: normalized?.separable,
      reflexive: normalized?.reflexive,
      auxiliary: normalized?.auxiliary,
      conjugation: normalized?.conjugation,
      valenz: normalized?.valenz,
      tenses: normalized?.tenses,
      comparison: normalized?.comparison,
      notes: normalized?.notes,
      posOptions: normalized?.posOptions,
      recommendations: normalized?.recommendations,
      irregular: normalized?.irregular,
      primaryPos: normalized?.primaryPos,
      posKey: normalized?.posKey,
      canonicalPos: normalized?.canonicalPos,
      definition_de: normalized?.definition_de,
      definition_de_translation: normalized?.definition_de_translation,
      example: normalized?.example,
      exampleTranslation: normalized?.exampleTranslation,
      // 保留 trace：讓你 debug 好查（不影響 UI）
      _requestedPosKey: normalized?._requestedPosKey,
    };

    // 小清理：移除 undefined（避免 extra_props 被塞滿 undefined）
    Object.keys(extra_props).forEach((k) => {
      if (extra_props[k] === undefined) delete extra_props[k];
    });

    // propsRow 不應該完全依賴 pos，但保持語意：只有在 Nomen/Verb/Präposition 時提供對應欄位
    // - 不做推測：如果 normalized 有值就存，沒值就 null
    const entryProps = {
      noun_gender: pos === 'Nomen' ? noun_gender : noun_gender, // 不阻擋，避免資料丟失
      noun_plural: pos === 'Nomen' ? noun_plural : noun_plural,
      verb_separable: pos === 'Verb' ? verb_separable : verb_separable,
      verb_irregular: pos === 'Verb' ? verb_irregular : verb_irregular,
      verb_reflexive: pos === 'Verb' ? verb_reflexive : verb_reflexive,
      prep_case: prep_case,
      extra_props,
    };

    return entryProps;
  } catch (e) {
    return null;
  }
}

/**
 * ✅ Phase 2-2（本次新增）
 * 中文功能說明：
 * - 從 normalized 組 senses（dict_senses）
 * - 來源優先順序：
 *   1) normalized.definitions（若是 array）
 *   2) normalized.definition（若是 string）
 *   3) 回傳空陣列（不寫 senses）
 */
function buildSensesFromNormalized(normalized) {
  try {
    const defs = normalized?.definitions;
    if (Array.isArray(defs) && defs.length) {
      return defs.map((x) => String(x || '').trim()).filter(Boolean);
    }

    const d = String(normalized?.definition || '').trim();
    if (d) return [d];

    return [];
  } catch (e) {
    return [];
  }
}

/**
 * ✅ Phase 2-2（本次新增）
 * 中文功能說明：
 * - LLM 查詢後落地寫入（用 dictEntryIO）
 * - 注意：寫入失敗不應影響回應（避免查字整個報錯）
 */
async function persistDictionarySnapshotSafe({
  word,
  normalized,
  explainLang,
  targetPosKey,
}) {
  const sb = getSupabaseAdminClientSafe();

  if (!sb) {
    if (DEBUG_DICT_DB) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][db] persist skip (no supabase client):', { word, explainLang });
    }
    return { skipped: true, reason: 'no_supabase_client' };
  }

  try {
    const canonicalPos = String(normalized?.partOfSpeech || normalized?.canonicalPos || '').trim() || '';

    // ✅ 若 canonicalPos 空字串，仍寫入會造成 unique key 行為不明確（你有 unique(headword, canonical_pos)）
    // - 這裡保守：沒有 pos 就不落地，避免污染 DB
    if (!canonicalPos) {
      if (DEBUG_DICT_DB) {
        // eslint-disable-next-line no-console
        console.log('[dictionary][db] persist skip (missing canonicalPos):', { word, explainLang });
      }
      return { skipped: true, reason: 'missing_canonical_pos' };
    }

    // dict_entries：預設寫入 ok 狀態（你不做人工覆核；有問題用 needs_refresh=true 觸發 refresh）
    const entryId = await upsertDictEntryAndGetIdCore({
      supabaseAdmin: sb,
      headword: word,
      canonicalPos,
      needs_refresh: false,
      quality_status: 'ok',
    });

    // dict_entry_props
    const entryProps = buildEntryPropsFromNormalized(normalized);
    if (entryProps) {
      await upsertDictEntryPropsCore({
        supabaseAdmin: sb,
        entryId,
        entryProps,
      });
    }

    // dict_senses（同語言覆蓋）
    const senses = buildSensesFromNormalized(normalized);
    if (senses.length) {
      await upsertDictSensesForLangCore({
        supabaseAdmin: sb,
        entryId,
        gloss_lang: explainLang,
        senses,
        source: 'llm',
      });
    }

    if (DEBUG_DICT_DB) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][db] persistDictionarySnapshot OK:', {
        word,
        explainLang,
        canonicalPos,
        entryId,
        senses: senses.length,
        hasProps: !!entryProps,
        requestedPosKey: targetPosKey || null,
      });
    }

    return { ok: true, entryId, senses: senses.length };
  } catch (e) {
    if (DEBUG_DICT_DB) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][db] persistDictionarySnapshot FAILED (ignored):', e?.message || e);
    }
    return { ok: false, error: e?.message || String(e || '') };
  }
}

/**
 * ✅ DB 查詢（命中回 normalized；miss 回 null）
 * - dict_entries：用 headword 找 entry_id（先不綁 pos，避免你目前 pos 格式/大小寫造成 miss）
 * - dict_senses：用 entry_id + gloss_lang 找 senses（依 sense_index 排序）
 * - dict_entry_props：用 entry_id 找詞性屬性（noun/verb/prep + extra_props）
 *
 * 回傳格式：
 * - 會包成「類 LLM 結構」再丟 normalizeDictionaryResult，避免 UI 欄位不一致
 */
async function tryLookupFromDB(word, explainLang) {
  const sb = getSupabaseAdminClientSafe();

  if (!sb) {
    if (DEBUG_DICT_DB) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][db] supabase client missing, skip DB lookup');
    }
    return null;
  }

  try {
    if (DEBUG_DICT_DB) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][db] tryLookupFromDB enter:', { word, explainLang });
    }

    // 1) entries
    const entryRes = await sb
      .from('dict_entries')
      .select('id, headword, canonical_pos, needs_refresh, quality_status, refresh_reason, refresh_count, last_refreshed_at')
      .eq('headword', word)
      .limit(1);

    if (entryRes?.error) {
      if (DEBUG_DICT_DB) {
        // eslint-disable-next-line no-console
        console.log('[dictionary][db] entry query error:', entryRes.error);
      }
      return null;
    }

    const entry = Array.isArray(entryRes?.data) ? entryRes.data[0] : null;
    if (!entry?.id) {
      if (DEBUG_DICT_DB) {
        // eslint-disable-next-line no-console
        console.log('[dictionary][db] tryLookupFromDB miss (no entry):', { word, explainLang });
      }
      return null;
    }

    // ✅ Phase 2：needs_refresh=true → 視為 miss（允許走 LLM refresh）
    // - 注意：依你需求，只有回報才會打開 needs_refresh
    if (entry?.needs_refresh) {
      if (DEBUG_DICT_DB) {
        // eslint-disable-next-line no-console
        console.log('[dictionary][db] tryLookupFromDB miss (needs_refresh=true):', {
          word,
          explainLang,
          entryId: entry.id,
          quality_status: entry.quality_status || null,
          refresh_reason: entry.refresh_reason || null,
          refresh_count: typeof entry.refresh_count === 'number' ? entry.refresh_count : null,
        });
      }
      return null;
    }

    // 2) senses
    const sensesRes = await sb
      .from('dict_senses')
      .select('sense_index, gloss, gloss_lang, source, is_verified')
      .eq('entry_id', entry.id)
      .eq('gloss_lang', explainLang)
      .order('sense_index', { ascending: true });

    if (sensesRes?.error) {
      if (DEBUG_DICT_DB) {
        // eslint-disable-next-line no-console
        console.log('[dictionary][db] senses query error:', sensesRes.error);
      }
      return null;
    }

    const sensesRows = Array.isArray(sensesRes?.data) ? sensesRes.data : [];
    if (!sensesRows.length) {
      if (DEBUG_DICT_DB) {
        // eslint-disable-next-line no-console
        console.log('[dictionary][db] tryLookupFromDB miss (no senses):', { word, explainLang, entryId: entry.id });
      }
      return null;
    }

    // 2-1) props（optional but recommended）
    // - 若 props 不存在：仍可命中（避免卡住），但 normalized 會較不完整
    let propsRow = null;
    try {
      const propsRes = await sb
        .from('dict_entry_props')
        .select('noun_gender, noun_plural, verb_separable, verb_irregular, verb_reflexive, prep_case, extra_props')
        .eq('entry_id', entry.id)
        .limit(1);

      if (propsRes?.error) {
        if (DEBUG_DICT_DB) {
          // eslint-disable-next-line no-console
          console.log('[dictionary][db] props query error (ignored):', propsRes.error);
        }
      } else {
        propsRow = Array.isArray(propsRes?.data) ? propsRes.data[0] : null;
      }
    } catch (e) {
      if (DEBUG_DICT_DB) {
        // eslint-disable-next-line no-console
        console.log('[dictionary][db] props query exception (ignored):', e?.message || e);
      }
    }

    // 3) 組成類 LLM 結構交給 normalize（維持既有 UI 相容）
    const parsedLike = {
      word: entry.headword,
      baseForm: entry.headword,
      partOfSpeech: entry.canonical_pos || '',
      senses: sensesRows.map((r) => ({
        index: r.sense_index,
        senseIndex: r.sense_index,
        gloss: r.gloss,
        glossLang: r.gloss_lang,
        source: r.source || 'db',
        isVerified: !!r.is_verified,
      })),
      source: 'db',
      explainLang,
    };

    // ✅ Phase 2：把 props 補進 parsedLike（不覆寫既有 key）
    // - 固定欄位：noun_gender / noun_plural / verb_* / prep_case
    // - 其餘走 extra_props 白名單 merge
    if (propsRow && typeof propsRow === 'object') {
      const eg = String(propsRow.noun_gender || '').trim();
      const ep = String(propsRow.noun_plural || '').trim();
      const pc = String(propsRow.prep_case || '').trim();

      if (eg && parsedLike.gender === undefined) {
        parsedLike.gender = eg;
      }
      if (ep && parsedLike.plural === undefined) {
        parsedLike.plural = ep;
      }

      // verb flags（只在還沒定義時才補）
      if (parsedLike.separable === undefined && typeof propsRow.verb_separable === 'boolean') {
        parsedLike.separable = propsRow.verb_separable;
      }
      if (parsedLike.reflexive === undefined && typeof propsRow.verb_reflexive === 'boolean') {
        parsedLike.reflexive = propsRow.verb_reflexive;
      }

      // verb_irregular（保持向下相容：若 normalize/上游用得到，這裡只是補 meta，不強行改 irregular 結構）
      if (parsedLike.verb_irregular === undefined && typeof propsRow.verb_irregular === 'boolean') {
        parsedLike.verb_irregular = propsRow.verb_irregular;
      }

      if (pc && parsedLike.prep_case === undefined) {
        parsedLike.prep_case = pc;
      }

      // extra_props 白名單 merge
      const extraProps = propsRow.extra_props && typeof propsRow.extra_props === 'object'
        ? propsRow.extra_props
        : null;

      if (extraProps) {
        mergeExtraPropsWhitelistIntoParsedLike(parsedLike, extraProps);
      }
    }

    const normalized = normalizeDictionaryResult(parsedLike, word);

    // ✅ Phase 2：把 DB entry 的狀態 meta 附加回去（不影響 UI，方便 trace）
    // - 注意：這不是覆核機制，只是讓上游可看到當前狀態
    try {
      normalized._dbEntryMeta = {
        entryId: entry.id,
        quality_status: entry.quality_status || 'ok',
        needs_refresh: !!entry.needs_refresh,
        refresh_reason: entry.refresh_reason || null,
        refresh_count: typeof entry.refresh_count === 'number' ? entry.refresh_count : 0,
        last_refreshed_at: entry.last_refreshed_at || null,
      };
    } catch (e) {
      // ignore
    }

    // 保底：避免 normalize 沒帶出 definition（讓 UI 不會空白）
    if (!normalized.definition && sensesRows[0]?.gloss) {
      normalized.definition = sensesRows[0].gloss;
    }
    if (!normalized.definitions && sensesRows[0]?.gloss) {
      normalized.definitions = [sensesRows[0].gloss];
    }

    if (DEBUG_DICT_DB) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][db] tryLookupFromDB HIT:', {
        word,
        explainLang,
        entryId: entry.id,
        senses: sensesRows.length,
        hasProps: !!propsRow,
      });
    }

    return normalized;
  } catch (e) {
    if (DEBUG_DICT_DB) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][db] tryLookupFromDB exception:', e?.message || e);
    }
    return null;
  }
}

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
 * ✅ Step 2-2（本次新增）
 * 中文功能說明：
 * - 正規化 targetPosKey（避免 undefined/空字串）
 * - 注意：只做資料清理，不推測詞性、不做 mapping
 */
function normalizeTargetPosKey(options) {
  try {
    const k = String(options?.targetPosKey || '').trim();
    return k ? k : null;
  } catch (e) {
    return null;
  }
}

/**
 * ✅ Step 2-2（本次新增）
 * 中文功能說明：
 * - 建立「POS override」提示文字（附加在 user prompt 後）
 * - 設計原則：
 *   - 不修改 dictionaryPrompts.js（避免擴散修改範圍）
 *   - 直接在 user message 追加明確指令，讓模型固定輸出指定詞性
 * - 注意：
 *   - 不帶任何特定國家字眼
 *   - targetPosKey 用系統內既有 POS key（例如 Adjektiv / Adverb / Verb / Nomen）
 */
function buildPosOverrideInstruction(targetPosKey) {
  const k = String(targetPosKey || '').trim();
  if (!k) return '';

  return [
    '',
    '---',
    '[POS_OVERRIDE]',
    `- You MUST treat this lookup as the target part of speech: "${k}".`,
    '- If the surface form can belong to multiple parts of speech, you MUST return the entry only for the requested POS.',
    '- Do NOT include other POS in this response.',
    '---',
    '',
  ].join('\n');
}


/**
 * ✅ Step 3（本次新增）
 * 中文功能說明：
 * - 建立「POS options」提示文字（附加在 user prompt 後）
 * - 目的：要求模型回傳可能的 posOptions（可切換詞性）
 * - 注意：
 *   - 不帶任何特定國家字眼
 *   - posOptions 內容用系統內既有 POS key（例如 Adjektiv / Adverb / Verb / Nomen）
 *   - 若只有一種詞性，也必須回傳單一陣列（例如 ["Adverb"]）
 */
function buildPosOptionsInstruction() {
  return [
    '',
    '---',
    '[POS_OPTIONS]',
    '- In addition to the main partOfSpeech, you MUST include "posOptions" as an array of possible POS keys for this surface form.',
    '- If multiple POS are plausible, include them all (e.g., ["Adjektiv","Adverb"]).',
    '- If only one POS is plausible, still return a single-item array (e.g., ["Adverb"]).',
    '- Do NOT include long explanations inside posOptions. Only POS keys.',
    '---',
    '',
  ].join('\n');
}

/**
 * ✅ Step 3（本次新增）
 * 中文功能說明：
 * - 正規化 posOptions（避免模型回傳非陣列/含空值/重複）
 * - 回傳：string[] 或 null
 */
function normalizePosOptionsArray(posOptions) {
  try {
    if (!posOptions) return null;

    const arr = Array.isArray(posOptions) ? posOptions : [posOptions];
    const cleaned = arr
      .map((x) => String(x || '').trim())
      .filter(Boolean);

    // 去重（保持順序）
    const seen = new Set();
    const uniq = [];
    for (const k of cleaned) {
      if (!seen.has(k)) {
        seen.add(k);
        uniq.push(k);
      }
    }

    return uniq.length ? uniq : null;
  } catch (e) {
    return null;
  }
}

/**
 * ✅ Step 2-3（本次新增）
 * 中文功能說明：
 * - 從 options 取出用量記帳 meta（向下相容：沒傳就回空字串）
 * - endpoint：可讓你在 profiles/usage 看到用量來源（例如 /api/analyze）
 */
function buildUsageMetaFromOptions(options) {
  try {
    const endpoint =
      String(options?.endpoint || options?.endpointPath || options?.apiPath || '').trim()
      || '/api/analyze';

    const userId = String(options?.userId || '').trim();
    const email = String(options?.email || '').trim();
    const ip = String(options?.ip || '').trim();
    const requestId = String(options?.requestId || '').trim();

    return { endpoint, userId, email, ip, requestId };
  } catch (e) {
    return { endpoint: '/api/analyze', userId: '', email: '', ip: '', requestId: '' };
  }
}

/**
 * 查詢單字主函式
 * rawWord: 使用者查的字
 * explainLang: zh-TW / en / ...
 *
 * ✅ Step 2-2（本次新增）：
 * - lookupWord(rawWord, explainLang, options)
 * - options.targetPosKey：指定查詢目標詞性（POS re-query）
 *
 * 注意：
 * - 向下相容：舊呼叫 lookupWord(word, explainLang) 不受影響
 */
async function lookupWord(rawWord, explainLang = 'zh-TW', options = {}) {
  const word = String(rawWord || '').trim();
  if (!word) {
    return fallback('');
  }

  // ✅ Step 2-2：取出 targetPosKey（可能為 null）
  const targetPosKey = normalizeTargetPosKey(options);

  // ✅ Step 2-3：用量記帳 meta（向下相容：沒傳也不影響查字）
  const usageMeta = buildUsageMetaFromOptions(options);

  if (DEBUG_LLM_DICT_POS) {
    // eslint-disable-next-line no-console
    console.log('[dictionary][pos] lookupWord enter:', { word, explainLang, targetPosKey });
  }

  // ✅ DB-first：先查 DB（命中直接回傳，不打 LLM）
  if (DICT_DB_FIRST_ENABLED) {
    if (DEBUG_DICT_DB) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][db] DB-first enabled, start lookup:', { word, explainLang });
    }

    let dbHit = await tryLookupFromDB(word, explainLang);
    if (dbHit) {
      // ✅ Step 2-2：若指定 targetPosKey，但 DB hit 的 pos 不符 → 視為 miss，改走 LLM（避免卡在錯誤 POS）
      if (targetPosKey) {
        const hitPos = String(dbHit.partOfSpeech || dbHit.canonicalPos || '').trim();
        if (hitPos && hitPos !== targetPosKey) {
          if (DEBUG_DICT_DB || DEBUG_LLM_DICT_POS) {
            // eslint-disable-next-line no-console
            console.log('[dictionary][pos] DB-first hit but pos mismatch, fallback to LLM:', {
              word,
              explainLang,
              targetPosKey,
              hitPos,
            });
          }
        } else {
          if (DEBUG_DICT_DB) {
            // eslint-disable-next-line no-console
            console.log('[dictionary][db] DB-first hit, skip LLM:', { word, explainLang });
          }

          // ============================
          // Authority dictionary (Wiktionary) augmentation on DB HIT (no LLM)
          // NOTE: old injected block kept below (commented) to preserve history/line count.
          // Goal: if DB entry is missing authority fields (e.g., ipa/definitions), try Wiktionary and merge only missing fields.
          // Controlled by env:
          //   DICT_AUTHORITY_ENABLED=0 disables
          //   DICT_AUTHORITY_PROVIDER=wiktionary
          //   DICT_AUTHORITY_UA="YourApp/1.0 (contact@example.com)"  <-- strongly recommended by MediaWiki etiquette
          try {
            const needAuthorityOnHit =
              process.env.DICT_AUTHORITY_ENABLED !== '0' &&
              (!dbHit ||
                !dbHit.definition_de ||
                (Array.isArray(dbHit.definitions) && dbHit.definitions.length === 0) ||
                !dbHit.ipa);

            if (needAuthorityOnHit) {
              const authorityHit = await authorityLookup(word, explainLang, { targetPosKey });
              if (authorityHit) {
                if (DEBUG_DICT_DB) {
                  // eslint-disable-next-line no-console
                  console.log('[dictionary][authority] augment (db-hit) wiktionary hit:', {
                    word,
                    got: {
                      ipa: !!authorityHit.ipa,
                      definition_de: !!authorityHit.definition_de,
                      defs: Array.isArray(authorityHit.definitions) ? authorityHit.definitions.length : 0,
                      synonyms: authorityHit?.recommendations?.synonyms?.length || 0,
                      antonyms: authorityHit?.recommendations?.antonyms?.length || 0,
                      roots: authorityHit?.recommendations?.roots?.length || 0,
                    },
                  });
                }

                // Merge only missing fields; do not override DB values.
                dbHit = {
                  ...dbHit,
                  ipa: dbHit.ipa || authorityHit.ipa || null,
                  definition_de: dbHit.definition_de || authorityHit.definition_de || null,
                  definition_de_translation:
                    dbHit.definition_de_translation || authorityHit.definition_de_translation || null,
                  definitions:
                    (Array.isArray(dbHit.definitions) && dbHit.definitions.length > 0)
                      ? dbHit.definitions
                      : (authorityHit.definitions || []),
                  recommendations: {
                    ...(authorityHit.recommendations || {}),
                    ...(dbHit.recommendations || {}),
                    synonyms:
                      (dbHit.recommendations &&
                        Array.isArray(dbHit.recommendations.synonyms) &&
                        dbHit.recommendations.synonyms.length > 0)
                        ? dbHit.recommendations.synonyms
                        : (authorityHit.recommendations && authorityHit.recommendations.synonyms) || [],
                    antonyms:
                      (dbHit.recommendations &&
                        Array.isArray(dbHit.recommendations.antonyms) &&
                        dbHit.recommendations.antonyms.length > 0)
                        ? dbHit.recommendations.antonyms
                        : (authorityHit.recommendations && authorityHit.recommendations.antonyms) || [],
                    roots:
                      (dbHit.recommendations &&
                        Array.isArray(dbHit.recommendations.roots) &&
                        dbHit.recommendations.roots.length > 0)
                        ? dbHit.recommendations.roots
                        : (authorityHit.recommendations && authorityHit.recommendations.roots) || [],
                  },
                  _authority: dbHit._authority || authorityHit._authority || authorityHit._source || 'wiktionary',
                };
              } else {
                if (DEBUG_DICT_DB) {
                  // eslint-disable-next-line no-console
                  console.log('[dictionary][authority] augment (db-hit) wiktionary miss:', { word });
                }
              }
            }
          } catch (e) {
            if (DEBUG_DICT_DB) {
              // eslint-disable-next-line no-console
              console.log('[dictionary][authority] augment (db-hit) error, skip:', e?.message || e);
            }
          }

          /* ============================
           * OLD_AUTHORITY_BLOCK (commented out)
           * The previous injected block had brace/flow issues; kept for reference to avoid line deletions.
           *
           * // ============================
           * // Authority dictionary (Wiktionary) augmentation on DB HIT (no LLM)
           * // Goal: if DB entry is missing authority fields (e.g., ipa/definitions), tr...
           * ... (removed from execution) ...
           */

          return dbHit;
        }
      } else {
        if (DEBUG_DICT_DB) {
          // eslint-disable-next-line no-console
          console.log('[dictionary][db] DB-first hit, skip LLM:', { word, explainLang });
        }
        return dbHit;
      }
    }

    if (DEBUG_DICT_DB) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][db] DB-first miss, fallback to LLM:', { word, explainLang });
    }
  }


  // ============================
  // Authority dictionary (Wiktionary) BEFORE LLM
  // - Only runs on DB-first miss
  // - If hit: return a full dictionary object (based on fallback(word)) without calling LLM
  // ============================
  try {
    const authorityHit = await authorityLookup(word, explainLang, { targetPosKey });
    if (authorityHit) {
      console.log('[dictionary][authority] hit (wiktionary):', { word, explainLang, targetPosKey });
      return authorityHit;
    }
    console.log('[dictionary][authority] miss (wiktionary):', { word, explainLang, targetPosKey });
  } catch (e) {
    console.log('[dictionary][authority] error (wiktionary), skip:', e?.message || e);
  }


  const targetLangLabel = mapExplainLang(explainLang);

  try {
    // ✅ Step 2-2：在 user prompt 後附加 POS override（不改 dictionaryPrompts.js）
    const baseUserPrompt = buildUserPrompt(word, targetLangLabel);
    const posOverride = targetPosKey ? buildPosOverrideInstruction(targetPosKey) : '';
    const userPrompt = `${baseUserPrompt}${posOverride}`;


    // ✅ Step 3：在 user prompt 後附加 POS_OPTIONS（不改 dictionaryPrompts.js）
    // 中文功能說明：
    // - 目的：第一次查字就拿到 posOptions，供前端決定是否顯示「可切換詞性」
    const posOptionsInstr = DICT_LLM_POS_OPTIONS_ENABLED ? buildPosOptionsInstruction() : '';
    const userPromptFinal = `${userPrompt}${posOptionsInstr}`;

    if (DEBUG_LLM_DICT_POS_OPTIONS && DICT_LLM_POS_OPTIONS_ENABLED) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][posOptions] apply POS_OPTIONS scaffold:', {
        word,
        explainLang,
        enabled: true,
        posOptionsInstrLen: String(posOptionsInstr || '').length,
        userPromptLen: String(userPrompt || '').length,
        userPromptFinalLen: String(userPromptFinal || '').length,
      });
    }

    if (DEBUG_LLM_DICT_POS && targetPosKey) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][pos] apply POS override:', {
        word,
        explainLang,
        targetPosKey,
        baseUserPromptLen: String(baseUserPrompt || '').length,
        posOverrideLen: String(posOverride || '').length,
        userPromptLen: String(userPrompt || '').length,
      });
    }

    const client = getGroqClient();
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        // DEPRECATED (2026-01-05 Step 3): { role: 'user', content: userPrompt },
        { role: 'user', content: userPromptFinal },
      ],
    });

    // ✅ Step 2-3：LLM 真實 tokens 記帳（只要 response.usage 存在就記；失敗不影響查字）
    try {
      if (response?.usage && typeof response.usage.total_tokens === 'number') {
        logLLMUsage({
          endpoint: usageMeta.endpoint,
          model: String(response?.model || 'llama-3.3-70b-versatile'),
          provider: 'groq',
          usage: response.usage,
          kind: 'llm',
          ip: usageMeta.ip || '',
          userId: usageMeta.userId || '',
          email: usageMeta.email || '',
          requestId: usageMeta.requestId || '',
        });
      } else {
        // eslint-disable-next-line no-console
        console.warn('[dictionary][usage] response.usage missing (skip logLLMUsage)');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[dictionary][usage] logLLMUsage failed (ignored):', e?.message || e);
    }

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


    // ============================================================
    // ✅ Phase B/C：提高 definition（母語短釋義）品質
    // - Phase B：額外做一次「gloss-only」LLM 呼叫，只產生 definition（1~3詞短釋義）
    //           避免把 definition_de_translation 誤當成 definition
    // - Phase C：若 definition 仍出現混義（例如 "城堡,鎖"）或中文卻回英文，做 sense-splitting 修正
    //
    // 注意：本段只在 LLM 路徑生效（DB-first hit 不會跑，避免額外成本）
    // ============================================================

    // ✅ language 欄位代表「學習者母語 / UI language」，永遠用 explainLang 覆蓋（不可寫死 de）
    normalized.language = explainLang;

    const __looksLikeAsciiGloss = (s) => {
      const t = String(s || '').trim();
      return !!t && /^[\x00-\x7F]+$/.test(t) && /[A-Za-z]/.test(t);
    };

    const __hasMixedSenseSeparator = (s) => {
      const t = String(s || '').trim();
      if (!t) return false;
      return (
        t.includes(',') ||
        t.includes('，') ||
        t.includes('、') ||
        t.includes('/') ||
        t.includes(' 或 ') ||
        t.includes(' 和 ') ||
        t.includes(' 以及 ')
      );
    };

    const __shouldGlossSplit = () => {
      const label = String(mapExplainLang(explainLang) || '').toLowerCase();
      // If learner language is German, no need.
      if (label.includes('german') || label.includes('deutsch')) return false;
      // Need DE definition to derive gloss. If empty, skip.
      const defDe = normalized.definition_de;
      if (Array.isArray(defDe)) return defDe.some((x) => String(x || '').trim());
      return !!String(defDe || '').trim();
    };

    const __shouldSenseSplit = () => {
      // If definition already an array with >1, assume OK.
      if (Array.isArray(normalized.definition) && normalized.definition.length > 1) return false;
      const s = Array.isArray(normalized.definition)
        ? String(normalized.definition[0] || '')
        : String(normalized.definition || '');
      return __hasMixedSenseSeparator(s);
    };

    const __callGroqJson = async ({ system, user, label }) => {
      const client2 = getGroqClient();
      const resp2 = await client2.chat.completions.create({
        model: process.env.DICT_LLM_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const content2 = resp2?.choices?.[0]?.message?.content || '';
      if (process.env.DEBUG_LLM_DICT_GLOSS === '1') {
        // eslint-disable-next-line no-console
        console.log(`${label} raw content preview:`, String(content2).slice(0, 200));
      }
      try {
        return JSON.parse(content2);
      } catch (e) {
        logger.warn(`${label} JSON parse failed (ignore)`, {
          word,
          explainLang,
          err: e && e.message ? e.message : String(e),
          contentPreview: String(content2).slice(0, 200),
        });
        return null;
      }
    };

    // Phase B: gloss-only
    try {
      const __enableGlossSplit = String(process.env.DICT_LLM_GLOSS_SPLIT || '1') !== '0';
      if (__enableGlossSplit && __shouldGlossSplit()) {
        const __targetLangLabel = getTargetLangLabelSafe(explainLang);
        const __glossUser = buildGlossUserPrompt(word, __targetLangLabel, normalized.definition_de);
        const __glossJson = await __callGroqJson({
          system: glossSystemPrompt,
          user: __glossUser,
          label: '[dictionary][llm][gloss]',
        });

        if (__glossJson && (__glossJson.definition !== undefined)) {
          normalized.definition = __glossJson.definition;

          // Keep normalized.definitions in sync
          if (Array.isArray(normalized.definition)) normalized.definitions = normalized.definition;
          else if (typeof normalized.definition === 'string' && normalized.definition.trim())
            normalized.definitions = [normalized.definition.trim()];
        }
      }
    } catch (e) {
      logger.warn('[dictionary][llm][gloss] failed (ignore)', {
        word,
        explainLang,
        err: e && e.message ? e.message : String(e),
      });
    }

    // Phase C: sense-splitting (only if still mixed OR Chinese but looks English)
    try {
      const __enableSenseSplit = String(process.env.DICT_LLM_SENSE_SPLIT || '1') !== '0';

      const __defSample = Array.isArray(normalized.definition)
        ? String(normalized.definition[0] || '')
        : String(normalized.definition || '');

      if (
        __enableSenseSplit &&
        (__shouldSenseSplit() ||
          ((String(explainLang || '').toLowerCase().startsWith('zh')) && __looksLikeAsciiGloss(__defSample)))
      ) {
        const __targetLangLabel2 = getTargetLangLabelSafe(explainLang);
        const __senseUser = buildSenseSplitUserPrompt(word, __targetLangLabel2, {
          definition_de: normalized.definition_de,
          definition_de_translation: normalized.definition_de_translation,
          definition: normalized.definition,
        });

        const __senseJson = await __callGroqJson({
          system: senseSplitSystemPrompt,
          user: __senseUser,
          label: '[dictionary][llm][sense-split]',
        });

        if (__senseJson && typeof __senseJson === 'object') {
          if (__senseJson.definition_de !== undefined) normalized.definition_de = __senseJson.definition_de;
          if (__senseJson.definition_de_translation !== undefined)
            normalized.definition_de_translation = __senseJson.definition_de_translation;
          if (__senseJson.definition !== undefined) normalized.definition = __senseJson.definition;

          if (Array.isArray(normalized.definition)) normalized.definitions = normalized.definition;
          else if (typeof normalized.definition === 'string' && normalized.definition.trim())
            normalized.definitions = [normalized.definition.trim()];
        }
      }
    } catch (e) {
      logger.warn('[dictionary][llm][sense-split] failed (ignore)', {
        word,
        explainLang,
        err: e && e.message ? e.message : String(e),
      });
    }



  
    // ✅ Phase B：Gloss 來源切分（definition 一律由「gloss-only」第二次呼叫產生）
// 中文功能說明：
// - 目標：definition 是「單字本身」的母語短釋義（flashcard 1–3詞），不是德德釋義翻譯（definition_de_translation）
// - 做法：主呼叫仍負責產出 definition_de / definition_de_translation / 例句等；接著用第二次 LLM 呼叫只產出 definition（更穩）
// - 設定：DICT_LLM_GLOSS_SPLIT=0 可關閉（回到單次輸出），預設開啟
const DICT_LLM_GLOSS_SPLIT = process.env.DICT_LLM_GLOSS_SPLIT !== '0';

// 小工具：確保輸出型態可用
function __isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}
function __isNonEmptyArray(v) {
  return Array.isArray(v) && v.length > 0 && v.some((x) => __isNonEmptyString(String(x || '')));
}

// 僅針對「學習者語言 != de」才需要 split gloss（de 本身不需要翻譯）
function __shouldSplitGloss(targetLangLabel) {
  if (!__isNonEmptyString(targetLangLabel)) return false;
  const t = String(targetLangLabel).toLowerCase();
  // 常見德語標籤：de / deutsch / german
  if (t === 'de' || t.includes('deutsch') || t.includes('german')) return false;
  return true;
}

async function __generateGlossOnlySplit({ word, targetLangLabel, definitionDe }) {
  const client2 = getGroqClient();

  const user2 = buildGlossUserPrompt(word, targetLangLabel, definitionDe);

  const resp2 = await client2.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: glossSystemPrompt },
      { role: 'user', content: user2 },
    ],
  });

  const content2 = String(resp2?.choices?.[0]?.message?.content || '').trim();
  let parsed2;
  try {
    parsed2 = JSON.parse(content2);
  } catch (e) {
    console.error('[dictionary][gloss] JSON parse error in split gloss:', e);
    console.error('[dictionary][gloss] raw content that failed to parse in split gloss:', content2);
    return null;
  }

  const out = parsed2 && typeof parsed2 === 'object' ? parsed2.definition : null;
  if (__isNonEmptyString(out)) return out;
  if (__isNonEmptyArray(out)) return out;
  return null;
}

if (DICT_LLM_GLOSS_SPLIT && __shouldSplitGloss(targetLangLabel)) {
  try {
    const beforeDef = normalized.definition;

    const gloss = await __generateGlossOnlySplit({
      word,
      targetLangLabel,
      definitionDe: normalized.definition_de,
    });

    if (gloss) {
      normalized.definition = gloss;
      console.log('[dictionary][gloss] split-gloss applied', {
        word,
        explainLang,
        beforeType: Array.isArray(beforeDef) ? 'array' : typeof beforeDef,
        afterType: Array.isArray(gloss) ? 'array' : typeof gloss,
      });
    } else {
      console.log('[dictionary][gloss] split-gloss returned empty; keep original', {
        word,
        explainLang,
      });
    }
  } catch (e) {
    console.error('[dictionary][gloss] split-gloss failed; keep original', e);
  }
}

/*
DEPRECATED (2026-01-24):
原本的「gloss repair patch」屬於 hit-or-miss 補丁：只有在偵測到缺失/重複時才補修。
現在改成 Phase B 的「源頭切分」：definition 由獨立呼叫產生，避免單次輸出混欄。

// ✅ Phase B：Gloss 補強（definition 必須是「單字本身的母語短釋義」，不可用德語解釋翻譯頂替）
// 中文功能說明：
// - 問題：LLM 有時會把 definition 直接填成 definition_de_translation（變成長句），導致字卡「釋義」不夠短、不夠像 flashcard
// - 作法：若偵測到 definition 缺失 / 或與 definition_de_translation 重複，則用更小的 prompt 單獨要求 gloss
// - 範圍：僅補強 definition，不改動 definition_de / definition_de_translation
const DICT_LLM_GLOSS_REPAIR_ENABLED = process.env.DICT_LLM_GLOSS_REPAIR_ENABLED !== '0';

function __toArrayMaybe(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') return [v];
  return [];
}

function __needsGlossRepair(dictObj) {
  if (!dictObj) return false;
  const defArr = __toArrayMaybe(dictObj.definition);
  const detArr = __toArrayMaybe(dictObj.definition_de_translation);

  // 沒 definition，但有德語解釋翻譯（常見：definition 被漏掉）
  if (!defArr.length && detArr.length) return true;

  // definition 跟 definition_de_translation 重複（常見：用長句頂替短釋義）
  if (defArr.length && detArr.length) {
    const a0 = String(defArr[0] || '').trim();
    const b0 = String(detArr[0] || '').trim();
    if (a0 && b0 && a0 === b0) return true;
  }

  return false;
}

async function __repairGlossOnly({ word, targetLangLabel, definition_de, definition_de_translation }) {
  // ... (保留原碼，略)
}
*/

// ✅ Step 3：把模型回傳的 posOptions 帶到 normalized（若 normalize 尚未處理）
    // 中文功能說明：
    // - 目的：讓上游（analyzeWord/analyzeRoute/frontend）在第一次查詢就能拿到可切換詞性清單
    // - 設計：不強行推測；僅透過模型回傳 + 本地正規化
    if (DICT_LLM_POS_OPTIONS_ENABLED) {
      const po = normalizePosOptionsArray(parsed?.posOptions);
      if (po && !normalized.posOptions) {
        normalized.posOptions = po;
      }
    }

    // ✅ Step 2-2：把 targetPosKey echo 回 normalized（方便上游 debug/trace，不影響既有 UI）
    // - 注意：不強行覆寫 partOfSpeech（避免誤導），只作為 trace 用
    if (targetPosKey) {
      normalized._requestedPosKey = targetPosKey;
    }

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

    if (DEBUG_LLM_DICT_POS && targetPosKey) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][pos] lookupWord DONE:', {
        word,
        explainLang,
        targetPosKey,
        gotPos: String(normalized.partOfSpeech || '').trim(),
        requestedEcho: String(normalized._requestedPosKey || '').trim() || null,
      });
    }


    if (DEBUG_LLM_DICT_POS_OPTIONS && DICT_LLM_POS_OPTIONS_ENABLED) {
      // eslint-disable-next-line no-console
      console.log('[dictionary][posOptions] lookupWord DONE:', {
        word,
        explainLang,
        gotPos: String(normalized.partOfSpeech || '').trim(),
        posOptionsLen: Array.isArray(normalized.posOptions) ? normalized.posOptions.length : 0,
        posOptions: Array.isArray(normalized.posOptions) ? normalized.posOptions : null,
      });
    }

    // ✅ Phase 2-2：LLM 查詢後落地（失敗不影響回傳）
    // - 目的：讓第二次查詢能 DB-first HIT，真正 skip LLM
    await persistDictionarySnapshotSafe({
      word,
      normalized,
      explainLang,
      targetPosKey,
    });

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


// ============================
// Authority lookup helpers (Wiktionary)
// - This is a best-effort HTML parse via MediaWiki parse API.
// - We keep it conservative: if we can't confidently parse, return null.
// - We NEVER override existing DB fields here because this only runs on DB miss.
// ============================
function _dwds_or_wiktionary_stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function _wiktionary_sliceGermanSection(html) {
  // de.wiktionary parse HTML does NOT reliably contain `mw-headline id="Deutsch"`.
  // Common structure:
  //   <h2 id="..._(Deutsch)"> ... <span id="Deutsch"></span> ...
  // So we anchor on `id="Deutsch"` span OR a heading containing "Deutsch".
  const s = String(html || '');

  // 1) Prefer the explicit span marker
  let idx = s.search(/\bid="Deutsch"\b/);
  if (idx < 0) {
    // 2) Fallback: h2 heading id contains "Deutsch" (encoded variants exist)
    idx = s.search(/<h2[^>]*\bid="[^"]*Deutsch[^"]*"[^>]*>/i);
  }
  if (idx < 0) return null;

  const tail = s.slice(idx);

  // Slice until the next H2 heading (next language section) if present
  const reNextH2 = /<h2\b[^>]*>/ig;
  let m;
  let first = true;
  while ((m = reNextH2.exec(tail)) !== null) {
    if (first) { first = false; continue; }
    return tail.slice(0, m.index);
  }
  return tail;
}

function _wiktionary_detectPos(germanHtml) {
  // de.wiktionary often renders:
  //   <h3 id="Substantiv,_n"><a ...>Substantiv</a>, <em ...>n</em></h3>
  // or other heading shapes. We'll detect POS primarily from headings.
  const s = String(germanHtml || '');

  const candidates = [
    { word: 'Substantiv', pos: 'Nomen' },
    { word: 'Nomen', pos: 'Nomen' },
    { word: 'Verb', pos: 'Verb' },
    { word: 'Adjektiv', pos: 'Adjektiv' },
    { word: 'Adverb', pos: 'Adverb' },
    { word: 'Pronomen', pos: 'Pronomen' },
    { word: 'Präposition', pos: 'Präposition' },
    { word: 'Konjunktion', pos: 'Konjunktion' },
    { word: 'Interjektion', pos: 'Interjektion' },
    { word: 'Artikel', pos: 'Artikel' },
    { word: 'Numerale', pos: 'Numerale' },
    { word: 'Partikel', pos: 'Partikel' },
  ];

  // 1) Headings (h3/h4) and mw-headline blocks.
  for (const c of candidates) {
    const w = c.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `(?:<h3[^>]*>|<h4[^>]*>|mw-headline"[^>]*>)\\s*(?:<[^>]+>\\s*)*${w}\\b`,
      'i'
    );
    if (re.test(s)) return c.pos;
  }

  // 2) Hilfe:Wortart links.
  for (const c of candidates) {
    const w = c.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`Hilfe:Wortart[^"<>]*"[^>]*>\\s*${w}\\b`, 'i');
    if (re.test(s)) return c.pos;
  }

  // 3) Last resort: visible text patterns (kept conservative).
  for (const c of candidates) {
    const w = c.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`>\\s*${w}\\s*<`, 'i');
    if (re.test(s)) return c.pos;
  }

  return null;
}

function _wiktionary_extractIpa(germanHtml) {
  const s = String(germanHtml || '');

  // Preferred (de.wiktionary):
  //   IPA: [<span class="ipa">ˈliːla</span>]
  const out = [];
  let m;

  const reIpaSpan = /class="ipa"[^>]*>([^<]+)</gi;
  while ((m = reIpaSpan.exec(s)) !== null) {
    const raw = _dwds_or_wiktionary_stripTags(m[1]);
    if (raw) out.push(raw);
    if (out.length >= 3) break;
  }

  // Backward-compatible: class="IPA"
  if (out.length === 0) {
    const re = /class="IPA"[^>]*>([^<]+)</g;
    while ((m = re.exec(s)) !== null) {
      const raw = _dwds_or_wiktionary_stripTags(m[1]);
      if (raw) out.push(raw);
      if (out.length >= 3) break;
    }
  }

  if (out.length === 0) return null;
  const first = String(out[0]).trim().replace(/^\//, '').replace(/\/$/, '');
  return first ? `/${first}/` : null;
}

function _wiktionary_extractDefinitions(germanHtml, max = 8) {
  const s = String(germanHtml || '');

  // de.wiktionary often uses:
  //   <p ...>Bedeutungen:</p>
  //   <dl><dd>[1] ...</dd></dl>
  // We'll extract the first dl after "Bedeutungen:" and parse dd entries.
  let block = null;

  const idx = s.search(/>\s*Bedeutungen:\s*</i);
  if (idx >= 0) {
    const tail = s.slice(idx);
    const mDl = tail.match(/<dl>[\s\S]*?<\/dl>/i);
    if (mDl) block = mDl[0];
  }

  // Fallback: old <ol> structure
  if (!block) {
    const mOl = s.match(/<ol[^>]*>[\s\S]*?<\/ol>/i);
    if (mOl) block = mOl[0];
  }

  if (!block) return [];

  const defs = [];
  let m;

  const reDd = /<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  while ((m = reDd.exec(block)) !== null) {
    const raw = _dwds_or_wiktionary_stripTags(m[1])
      .replace(/^\s*\[[0-9]+\]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (raw) defs.push(raw);
    if (defs.length >= max) break;
  }

  if (defs.length === 0) {
    const reLi = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    while ((m = reLi.exec(block)) !== null) {
      const raw = _dwds_or_wiktionary_stripTags(m[1]).replace(/\s+/g, ' ').trim();
      if (raw) defs.push(raw);
      if (defs.length >= max) break;
    }
  }

  return defs;
}

function _wiktionary_extractWordListBySection(germanHtml, sectionIds, max = 12) {
  const s = String(germanHtml || '');
  for (const id of sectionIds) {
    const idx = s.search(new RegExp(`mw-headline"\\s+id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    if (idx < 0) continue;
    const tail = s.slice(idx);
    const mUl = tail.match(/<ul[^>]*>[\s\S]*?<\/ul>/i);
    if (!mUl) continue;
    const ul = mUl[0];

    const reLi = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    const out = [];
    let mm;
    while ((mm = reLi.exec(ul)) !== null) {
      const txt = _dwds_or_wiktionary_stripTags(mm[1]);
      if (!txt) continue;
      const first = txt.split(/[,;，；]/)[0].trim();
      if (!first) continue;
      if (first.length > 40) continue;
      out.push(first);
      if (out.length >= max) break;
    }

    // uniq lower
    const seen = new Set();
    const uniq = [];
    for (const w of out) {
      const k = String(w).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(w);
    }
    return uniq;
  }
  return [];
}

function _wiktionary_buildApiUrl(word) {
  const u = new URL('https://de.wiktionary.org/w/api.php');
  u.searchParams.set('action', 'parse');
  u.searchParams.set('page', String(word || '').trim());
  u.searchParams.set('prop', 'text');
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  u.searchParams.set('redirects', '1');
  return u.toString();
}

function _wiktionary_httpGetJson(url) {
  const https = require('https');

  // MediaWiki API may return a plain-text error like:
  // "Please set a User-Agent header..." (NOT JSON). We must send UA and be tolerant.
  const headers = {
    'User-Agent': process.env.DICT_AUTHORITY_UA || 'LanguageApp/1.0 (authority-lookup; local dev)',
    'Accept': 'application/json',
  };

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: 'GET', headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          // Non-200 → treat as miss (resolve null)
          if (res.statusCode && res.statusCode >= 400) {
            console.log('[dictionary][authority] wiktionary http error:', {
              status: res.statusCode,
              sample: String(data || '').slice(0, 120),
            });
            return resolve(null);
          }

          try {
            resolve(JSON.parse(data));
          } catch (e) {
            // Non-JSON response → resolve null (do NOT throw)
            console.log('[dictionary][authority] wiktionary non-json response:', {
              sample: String(data || '').slice(0, 120),
            });
            resolve(null);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

const __DICT_AUTHORITY_CACHE = new Map(); // key -> { at, value }
function _authorityCacheGet(key, ttlMs) {
  const hit = __DICT_AUTHORITY_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    __DICT_AUTHORITY_CACHE.delete(key);
    return null;
  }
  return hit.value;
}
function _authorityCacheSet(key, value) {
  __DICT_AUTHORITY_CACHE.set(key, { at: Date.now(), value });
  return value;
}


async function authorityLookup(word, explainLang, options = {}) {
  // ============================================================
  // Plugin-based authority lookup (parsing providers are isolated as plugins)
  // - Controlled by env: DICT_AUTHORITIES="dwds,llm" (order matters)
  // - IMPORTANT: LLM is handled by main pipeline; authorityLookup only runs non-LLM authorities.
  // - Default: DICT_AUTHORITIES="llm" -> no authority providers -> treat as miss (return null)
  // ============================================================
  const envList = String(process.env.DICT_AUTHORITIES || 'llm')
    .split(',')
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);

  // Only run non-LLM authorities here (LLM is the existing fallback in lookupWord)
  const providers = envList.filter((p) => p !== 'llm');
  if (providers.length === 0) return null;

  const registry = getAuthoritiesRegistry();
  for (const name of providers) {
    const plugin = registry?.[name];
    if (!plugin || typeof plugin.lookup !== 'function') continue;
    try {
      const hit = await plugin.lookup(word, explainLang, options);
      if (hit) return hit;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[dictionary][authority] plugin error (skip):', { name, word, msg: e?.message || String(e) });
    }
  }
  return null;
}

/* ============================================================
 * LEGACY: Inline Wiktionary parsing authorityLookup (paused)
 * - Kept for history / line count
 * - Do NOT execute unless explicitly re-enabled and migrated into plugin.
 * ============================================================
async function authorityLookup(word, explainLang, options = {}) {
  if (process.env.DICT_AUTHORITY_ENABLED === '0') return null;
  const provider = (process.env.DICT_AUTHORITY_PROVIDER || 'wiktionary').toLowerCase();
  if (provider !== 'wiktionary') return null;

  const ttlMs = Number(process.env.DICT_AUTHORITY_TTL_MS || 6 * 60 * 60 * 1000);
  const cacheKey = `wiktionary:de:${String(word || '').toLowerCase()}`;
  const cached = _authorityCacheGet(cacheKey, ttlMs);
  if (cached) return cached;

  const url = _wiktionary_buildApiUrl(word);
  const json = await _wiktionary_httpGetJson(url);
  if (!json) {
    console.debug("[dictionary][authority] wiktionary: no json payload (treated as miss)", { word });
    return null;
  }
  const html = json?.parse?.text;
  if (!html) return _authorityCacheSet(cacheKey, null);

  const german = _wiktionary_sliceGermanSection(html);
  if (!german) return _authorityCacheSet(cacheKey, null);

  const detectedPosRaw = _wiktionary_detectPos(german);
  const ipa = _wiktionary_extractIpa(german);
  const defs = _wiktionary_extractDefinitions(german, 8);

  // Heuristic POS fallback: German nouns are capitalized (helps for inflected forms like "Produkte")
  let detectedPos = detectedPosRaw;
  if (!detectedPos) {
    const w = String(word || '');
    if (/^[A-ZÄÖÜ]/.test(w)) detectedPos = 'Nomen';
  }

  const DEBUG_AUTH = process.env.DEBUG_DICT_AUTHORITY === '1';
  if (DEBUG_AUTH) {
    // eslint-disable-next-line no-console
    console.log('[dictionary][authority] wiktionary parsed:', {
      word,
      detectedPosRaw,
      detectedPos,
      hasIpa: !!ipa,
      defs: Array.isArray(defs) ? defs.length : 0,
    });
  }

  const synonyms = _wiktionary_extractWordListBySection(
    german,
    ['Synonyme', 'Sinnverwandte_Wörter', 'Sinnverwandte_Wörter_und_Synonyme'],
    12
  );
  const antonyms = _wiktionary_extractWordListBySection(german, ['Gegenwörter', 'Antonyme'], 12);

  if (!detectedPos && !ipa && defs.length === 0) {
    // Avoid "hit but empty" results (e.g. inflected-form pages with no useful POS/defs).
    // If we can't confidently derive a POS or definition, treat as miss and fall back to LLM.
    return _authorityCacheSet(cacheKey, null);
  }

  // Build a full dictionary object using existing fallback(word) to keep shape stable.
  const base = fallback(word);

  // POS: only set if we detected something; keep caller's targetPosKey as a hint, not a requirement.
  if (detectedPos) {
    base.partOfSpeech = detectedPos;
    base.canonicalPos = detectedPos;
    base.primaryPos = detectedPos;
    base.posKey = detectedPos;
    base.posOptions = Array.isArray(base.posOptions) && base.posOptions.length > 0
      ? Array.from(new Set([detectedPos, ...base.posOptions]))
      : [detectedPos];
  }

  if (ipa) base.ipa = ipa;
  if (defs.length > 0) {
    // Keep as array to match normalizeDictionaryResult behavior (your pipeline already supports array)
    base.definition_de = defs;
    // We intentionally put German into definition_de_translation as a placeholder so downstream can derive senses.
    base.definition_de_translation = defs;
  }

  // Recommendations
  if (!base.recommendations || typeof base.recommendations !== 'object') base.recommendations = { synonyms: [], antonyms: [], roots: [] };
  if (synonyms.length > 0) base.recommendations.synonyms = synonyms;
  if (antonyms.length > 0) base.recommendations.antonyms = antonyms;

  // Lightweight marker for debugging (UI can ignore)
  base._authority = { provider: 'wiktionary', explainLang: String(explainLang || ''), at: new Date().toISOString() };

  return _authorityCacheSet(cacheKey, base);
}


*/

module.exports = { lookupWord };


// backend/src/clients/dictionaryLookup.js

// [patch] strict Deutsch marker not found; no-op
// backend/src/clients/dictionaryLookup.js