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

const client = require('./groqClient');
const {
  fallback,
  mapExplainLang,
  normalizeDictionaryResult,
} = require('./dictionaryUtils');
const { systemPrompt, buildUserPrompt } = require('./dictionaryPrompts');

// ✅ Step 2-3（本次新增）：LLM 真實 tokens 記帳（回寫 profiles 由 usageLogger 負責）
const { logLLMUsage } = require('../utils/usageLogger');

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

    const dbHit = await tryLookupFromDB(word, explainLang);
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

module.exports = { lookupWord };

// backend/src/clients/dictionaryLookup.js
