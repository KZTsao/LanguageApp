// backend/src/io/dictEntryIO.js
/**
 * dictEntryIO
 *
 * 職責：
 * - 封裝 dict_entries / dict_entry_props 的 DB I/O（Supabase admin）
 *
 * 設計原則：
 * - 只做資料存取，不處理 route/initStatus/debug/log 等上層 concerns
 * - 讓 routes/services 可以共用同一套寫入邏輯
 *
 * 注意：
 * - 這裡刻意不碰 INIT_STATUS / markEndpointHit / markEndpointError
 *   由呼叫端（route/service）決定是否要記錄 endpoint hit/error
 */

async function upsertDictEntryAndGetIdCore({
  supabaseAdmin,
  headword,
  canonicalPos,

  // ✅ Phase 2-2: optional quality/status fields
  // 不傳就不會寫入（維持原本行為）
  needs_refresh,
  quality_status,
}) {
  // 1) upsert
  // ✅ 只要 DB 有欄位就寫；不傳就不寫（避免破壞既有流程）
  const payload = {
    headword,
    canonical_pos: canonicalPos,
  };

  if (typeof needs_refresh === "boolean") payload.needs_refresh = needs_refresh;
  if (typeof quality_status === "string" && quality_status.trim()) payload.quality_status = quality_status.trim();

  const { error: upsertError } = await supabaseAdmin
    .from("dict_entries")
    .upsert(payload, { onConflict: "headword,canonical_pos" });

  if (upsertError) throw upsertError;

  // 2) select id
  const { data, error: selectError } = await supabaseAdmin
    .from("dict_entries")
    .select("id")
    .eq("headword", headword)
    .eq("canonical_pos", canonicalPos)
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;
  if (!data?.id) throw new Error("dict_entries upsert ok but id not found");

  // ✅ 你的 DB 是 UUID，因此回傳會是 string
  return data.id;
}

async function upsertDictEntryPropsCore({ supabaseAdmin, entryId, entryProps }) {
  if (!entryProps) return { skipped: true };

  const payload = {
    entry_id: entryId,

    noun_gender: typeof entryProps.noun_gender === "string" ? entryProps.noun_gender : null,
    noun_plural: typeof entryProps.noun_plural === "string" ? entryProps.noun_plural : null,

    verb_separable: typeof entryProps.verb_separable === "boolean" ? entryProps.verb_separable : null,
    verb_irregular: typeof entryProps.verb_irregular === "boolean" ? entryProps.verb_irregular : null,
    verb_reflexive: typeof entryProps.verb_reflexive === "boolean" ? entryProps.verb_reflexive : null,

    prep_case: typeof entryProps.prep_case === "string" ? entryProps.prep_case : null,

    extra_props: entryProps.extra_props && typeof entryProps.extra_props === "object" ? entryProps.extra_props : null,
  };

  const { error } = await supabaseAdmin.from("dict_entry_props").upsert(payload, {
    onConflict: "entry_id",
  });

  if (error) throw error;

  return { ok: true };
}

/**
 * ✅ Phase 2-2: dict_senses 寫入（同語言覆蓋）
 *
 * 策略：
 * - 先刪：entry_id + gloss_lang
 * - 再插入：依 sense_index 0..n-1
 *
 * 目的：
 * - 避免 dup（你有 unique(entry_id, sense_index, gloss_lang)）
 * - refresh 時可以乾淨覆蓋（不用猜要不要 upsert 哪幾筆）
 *
 * senses 允許格式：
 * - ["小","微小", ...]
 * - [{ gloss:"小", sense_index:0 }, ...]
 */
async function upsertDictSensesForLangCore({
  supabaseAdmin,
  entryId,
  gloss_lang,
  senses,
  source, // optional, default "llm"
}) {
  const lang = String(gloss_lang || "zh-TW").trim() || "zh-TW";
  const src = String(source || "llm").trim() || "llm";

  // normalize input
  const arr = Array.isArray(senses) ? senses : [];
  const rows = [];

  // 允許 string / object
  arr.forEach((s, idx) => {
    if (typeof s === "string") {
      const g = s.trim();
      if (!g) return;
      rows.push({
        entry_id: entryId,
        sense_index: rows.length, // 強制連續
        gloss: g,
        gloss_lang: lang,
        source: src,
        is_verified: false,
      });
      return;
    }

    if (s && typeof s === "object") {
      const g = String(s.gloss || s.definition || "").trim();
      if (!g) return;
      rows.push({
        entry_id: entryId,
        sense_index: rows.length, // 強制連續（忽略外部 index，避免跳號）
        gloss: g,
        gloss_lang: lang,
        source: typeof s.source === "string" && s.source.trim() ? s.source.trim() : src,
        is_verified: typeof s.is_verified === "boolean" ? s.is_verified : false,
      });
    }
  });

  if (!rows.length) return { skipped: true, reason: "no_senses" };

  // 1) delete (same entry + lang)
  const { error: delError } = await supabaseAdmin
    .from("dict_senses")
    .delete()
    .eq("entry_id", entryId)
    .eq("gloss_lang", lang);

  if (delError) throw delError;

  // 2) insert
  const { error: insError } = await supabaseAdmin.from("dict_senses").insert(rows);
  if (insError) throw insError;

  return { ok: true, count: rows.length };
}

module.exports = {
  upsertDictEntryAndGetIdCore,
  upsertDictEntryPropsCore,

  // ✅ Phase 2-2
  upsertDictSensesForLangCore,
};
// backend/src/io/dictEntryIO.js
