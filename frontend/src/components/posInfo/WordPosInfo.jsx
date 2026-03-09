

// frontend/src/components/posInfo/WordPosInfo.jsx
//
// 詞性資訊總管（WordPosInfo）
// ------------------------------------------------------
//
// ⭐ Step A（本次調整）
// - 移除「總管層級」的收合/展開（折疊應該由各子卡自己負責）
// - WordPosInfo.jsx 只負責依詞性分流渲染子卡
//
// ⭐ 2026-01-12 Task 1（Entry 狀態：Header 可被置換）— Step B（接線）
// - 新增 onEntrySurfaceChange(surface, meta) prop：
//   - 由名詞表點選 cell 後回拋的 form.surface，轉交給上層（WordCard/WordExampleBlock）用來覆蓋例句區 header 顯示
// - 僅影響 UI 顯示：不動 refs、不打 API、不觸發造句
//
// ------------------------------------------------------

import React from "react";
import { playTTS } from "../../utils/ttsClient";
import uiText from "../../uiText";

// =========================
// [共用] 推薦字區塊（WordPosInfo 統一渲染）
// - 子卡不再各自渲染 recommendations UI
// =========================
function __pickDefined(obj, keys) {
  const out = {};
  (keys || []).forEach((k) => {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  });
  return out;
}

function __getSurfaceFromForm(form) {
  if (form == null) return "";
  if (typeof form === "string") return form.toString().trim();
  // 支援不同詞卡回拋欄位命名：surface / form / text
  const s = (form.surface ?? form.form ?? form.text ?? "").toString().trim();
  return s;
}

function __mergeSurfaceMeta(meta, form) {
  const base = meta && typeof meta === "object" ? { ...meta } : {};
  if (form && typeof form === "object") {
    // ✅ 把人稱/時態等一起帶上去（若存在）
    Object.assign(
      base,
      __pickDefined(form, [
        "personKey",
        "tenseKey",
        "moodKey",
        "voiceKey",
        "numberKey",
        "genderKey",
        "caseKey",
        "degreeKey",
        "formKey",
        "cellKey",
        "rowKey",
        "colKey",
        "variantKey",
      ])
    );
  }
  return base;
}

import WordPosInfoNoun from "./WordPosInfoNoun";
import WordPosInfoVerb from "./WordPosInfoVerb";
import WordPosInfoAdjektiv from "./WordPosInfoAdjektiv";
import WordPosInfoPronomen from "./WordPosInfoPronomen";
import WordPosInfoArtikel from "./WordPosInfoArtikel";
import WordPosInfoAdverb from "./WordPosInfoAdverb";
import WordPosInfoPraeposition from "./WordPosInfoPraeposition";

export default function WordPosInfo({
  partOfSpeech,
  queryWord,
  baseForm,
  gender,
  uiLabels = {},
  extraInfo = {},
  type,
  uiLang,

  // ✅ 既有：名詞表點選後的 form（供上層做自己想做的事，例如暫存/顯示）
  onSelectForm,

  // ✅ 2026-01-12 Task 1：例句 header 覆蓋用（只影響顯示）
  // - surface: string | null
  // - meta: 可帶 { case, number }（Task 1 不強制用，但先保留）
  onEntrySurfaceChange,

  onWordClick,

  // ✅ POS info collapse (global state passed from parent; optional fallback)
  posInfoCollapseState,
  onTogglePosInfoCollapse,
}) {
  if (!partOfSpeech || !baseForm) return null;

  const pos = (partOfSpeech || "").trim();

  // ✅ collapse state key: use raw partOfSpeech (keep stable)
  const __posKey = (partOfSpeech || "").trim();
  const __isCollapsed = !!(posInfoCollapseState && typeof posInfoCollapseState === "object"
    ? posInfoCollapseState[__posKey]
    : false);

  let currentLang = "zh-TW";
  if (uiLang && uiText[uiLang]) currentLang = uiLang;

  // ✅ Strict mode：不做 zh-TW fallback（缺 key 就讓下層顯示 "—"）
  const wordUi = uiText[currentLang]?.wordCard || {};

  const posLocalName = wordUi?.posLocalNameMap?.[pos] || pos;

  // ✅ 共用：推薦字點擊（優先走上層 onWordClick；否則 dispatch wordSearch）
  function handleSpeakForm(form) {
    // [形容詞優化] trace
    try {
      if (form && (form.pos === "Adjektiv" || form.source)) {
        console.info("[形容詞優化][WordPosInfo][handleSpeakForm]", {
          pos: form.pos,
          source: form.source,
          surface: form.surface,
          form: form.form,
          baseForm: form.baseForm,
        });
      }
    } catch (e) {}
    // ✅ 2026-01-12 Task 1：保持原本點選格表會唸出 TTS
    // 同時把選取結果往上回傳（供例句 header 覆蓋）
    // - form=null：代表 clear selection（上層可用來清掉 override）
    const surface =
      form && typeof form.surface === "string" ? form.surface.trim() : "";

    // ✅ Allow per-form TTS override (e.g. Pronomen card wants MALE)
    // - If not provided, ttsClient will fall back to stored prefs.
    const ttsOpts =
      form && typeof form === "object" && form.tts && typeof form.tts === "object"
        ? form.tts
        : null;

    if (surface) {
      playTTS(surface, "de-DE", ttsOpts);
    }

    // ✅ Task 1（只影響顯示）：把 surface 往上回拋（上層用 wordKey/senseIndex 分流）
    // meta 可包含 { case, number }，Task 1 不強制用，但先保留
    try {
      if (typeof onEntrySurfaceChange === "function") {
        const nounMeta =
          form && form.noun && typeof form.noun === "object" ? form.noun : null;
        const artikelMeta =
          form && form.artikel && typeof form.artikel === "object" ? form.artikel : null;

        const meta = {
          ...(nounMeta
            ? {
                case:
                  typeof nounMeta.case === "string" ? nounMeta.case : undefined,
                number:
                  typeof nounMeta.number === "string"
                    ? nounMeta.number
                    : undefined,
              }
            : null),
          ...(artikelMeta
            ? {
                artikelCase:
                  typeof artikelMeta.case === "string" ? artikelMeta.case : undefined,
                artikelGender:
                  typeof artikelMeta.gender === "string"
                    ? artikelMeta.gender
                    : undefined,
                artikelType:
                  typeof artikelMeta.type === "string" ? artikelMeta.type : undefined,
                artikelNumber:
                  typeof artikelMeta.number === "string" ? artikelMeta.number : undefined,
              }
            : null),
        };

        // ✅ merge extra meta from form (Pronomen / Verb etc.)
        const pronMeta =
          form && typeof form === "object" && form.pronoun && typeof form.pronoun === "object"
            ? __pickDefined(form.pronoun, [
                "headwordHintKey",
                "hintKey",
                "pronounMeaningKey",
                "card",
                "case",
                "gender",
                "stem",
                "sieVariant",
                "ihrMode",
              ])
            : {};

        const mergedMeta = {
          ...(Object.keys(meta).length ? meta : null),
          ...(Object.keys(pronMeta).length ? pronMeta : null),
        };

        onEntrySurfaceChange(
          surface || null,
          Object.keys(mergedMeta).length ? mergedMeta : undefined
        );
      }
    } catch (e) {
      // 不阻斷 UI；只要不 throw 影響點擊體驗
      // console.warn("[WordPosInfo][Task1] onEntrySurfaceChange failed", e);
    }

    // ✅ 既有：把 form 往上回傳（保留原行為）
    if (typeof onSelectForm === "function") {
      onSelectForm(form || null);
    }
  }

  const getProperNounLabel = () => {
    switch (type) {
      case "brand":
        return "品牌名";
      case "proper_place":
        return "地名";
      case "proper_person":
        return "人名";
      case "organization":
        return "組織";
      case "product_name":
        return "產品名";
      default:
        return null;
    }
  };

  const properLabel = getProperNounLabel();
  if (properLabel) {
    return (
      <div
        style={{
          marginTop: 8,
          marginBottom: 14,
          fontSize: 14,
          color: "var(--text-muted)",
        }}
      >
        <div style={{ marginBottom: 2 }}>
          詞性：{posLocalName}（{properLabel}）
        </div>
        <div>基本型：{baseForm}</div>
      </div>
    );
  }

  const renderPlaceholder = (labelZh) => (
    <div
      style={{
        marginTop: 8,
        marginBottom: 14,
        fontSize: 13,
        color: "var(--text-muted)",
      }}
    >
      <div style={{ marginBottom: 2 }}>
        詞性：{pos}（{labelZh}）
      </div>
      <div>基本型：{baseForm}</div>
      {gender && <div>性別：{gender}</div>}
    </div>
  );

  const injectedPlural =
    (typeof extraInfo?.plural === "string" && extraInfo.plural) ||
    (typeof extraInfo?.dictionary?.plural === "string" &&
      extraInfo.dictionary.plural) ||
    "";

  switch (pos) {
    case "Nomen": {
      const nounLabels = {
        caseTableTitle: wordUi.caseTableTitle,
        caseNom: wordUi.caseNom,
        caseAkk: wordUi.caseAkk,
        caseDat: wordUi.caseDat,
        caseGen: wordUi.caseGen,

        btnPlural: wordUi.btnPlural,
        btnClear: wordUi.btnClear,

        headerActiveDef: wordUi.headerDefinite,
        headerActiveEin: wordUi.headerIndefinite,
        headerActiveKein: wordUi.headerNegation,
        headerActivePoss: wordUi.headerPossessive,
        headerActiveWelch: wordUi.headerQuestionWord,
        headerActiveDies: wordUi.headerDemonstrative,

        headerReferenceDef: wordUi.headerDefinite,
        headerReferenceEin: wordUi.headerIndefinite,
        headerReferenceKein: wordUi.headerNegation,
        headerReferencePoss: wordUi.headerPossessive,
        headerReferenceWelch: wordUi.headerQuestionWord,
        headerReferenceDies: wordUi.headerDemonstrative,

        nounPosLabel: wordUi.posLocalNameMap?.Nomen,
        singularLabel: wordUi.singularLabel,
        pluralLabel: wordUi.pluralLabel,
        refShortDef: wordUi.refShortDef,
        refShortIndef: wordUi.refShortIndef,

        nounPlural: injectedPlural,
      };

      return (
        <>
          <WordPosInfoNoun
            gender={gender}
            baseForm={baseForm}
            labels={nounLabels}
            onSelectForm={handleSpeakForm}
          />
        </>
      );
    }

case "Verb": {
  const dictObj =
    extraInfo &&
    extraInfo.dictionary &&
    typeof extraInfo.dictionary === "object"
      ? extraInfo.dictionary
      : (extraInfo && typeof extraInfo === "object" ? extraInfo : {});

  // ✅ Keep dictionary fields, but also preserve upstream query/hints for downstream Verb UI.
  // - WordExampleBlock passes: { dictionary: d, query, queryHints, hints }
  // - We must NOT drop query/hints when handing off to WordPosInfoVerb.
  const verbExtraInfo = {
    ...dictObj,
    query: extraInfo?.query,
    queryHints: extraInfo?.queryHints,
    hints: extraInfo?.hints,
    // best-effort: keep headword/rawInput if upstream provides
    headword: extraInfo?.headword || dictObj?.headword,
    rawInput: extraInfo?.rawInput || extraInfo?.query?.raw || extraInfo?.query?.text,
    normalizedQuery: extraInfo?.normalizedQuery || extraInfo?.query?.normalizedQuery,
  };

  // 🔎 debug only (no logic change): compare dictionary vs query hints
 
  const __dictReflexive = verbExtraInfo?.reflexive === true;
  const __queryHintsReflexive =
    extraInfo?.query?.hints?.reflexive === true ||
    extraInfo?.hints?.reflexive === true ||
    extraInfo?.queryHints?.reflexive === true;

  console.debug("[reflexive] WordPosInfo Verb handoff", {
    queryWord,
    baseForm,
    dictReflexive: __dictReflexive,
    queryHintsReflexive: __queryHintsReflexive === true,
    extraInfoTopKeys: extraInfo && typeof extraInfo === "object" ? Object.keys(extraInfo) : null,
    verbExtraInfoKeys: verbExtraInfo && typeof verbExtraInfo === "object" ? Object.keys(verbExtraInfo) : null,
  });

  // 🔎 deeper debug: try multiple hint paths (no logic change)
  const __reflexiveCandidates = (() => {
    const root = extraInfo && typeof extraInfo === "object" ? extraInfo : {};
    const paths = [
      "query.hints.reflexive",
      "queryHints.reflexive",
      "hints.reflexive",
      "meta.hints.reflexive",
      "analysis.query.hints.reflexive",
      "analyze.query.hints.reflexive",
      "payload.query.hints.reflexive",
      "raw.query.hints.reflexive",
      "result.query.hints.reflexive",
    ];
    const out = {};
    for (const p of paths) {
      try {
        const parts = p.split(".");
        let cur = root;
        for (const k of parts) cur = cur && typeof cur === "object" ? cur[k] : undefined;
        out[p] = cur;
      } catch {
        out[p] = undefined;
      }
    }
    return out;
  })();

  console.debug("[reflexive] WordPosInfo extraInfo candidates", {
    queryWord,
    baseForm,
    candidates: __reflexiveCandidates,
    extraInfoType: typeof extraInfo,
    extraInfoKeys: extraInfo && typeof extraInfo === "object" ? Object.keys(extraInfo) : null,
    extraInfoQueryKeys:
      extraInfo?.query && typeof extraInfo.query === "object" ? Object.keys(extraInfo.query) : null,
  });

  return (
    <>
      <WordPosInfoVerb
        onSelectForm={handleSpeakForm} // ✅ Verb 格子點選：TTS + 同步例句 header（走統一路徑）
        baseForm={baseForm}
        queryWord={queryWord}
        labels={uiLabels.verb}
        extraInfo={verbExtraInfo}
        uiLang={uiLang}
        onWordClick={onWordClick}
      />
    </>
  );
}

case "Adjektiv":
      return (
        <>
          <WordPosInfoAdjektiv
            baseForm={baseForm}
            labels={uiLabels.adj}
            uiLang={uiLang}
            extraInfo={extraInfo?.dictionary || extraInfo}
            onSelectForm={handleSpeakForm}
          />
        </>
      );

    case "Pronomen": {
      // [代名詞] console trace (no logic change)
      try {
        // eslint-disable-next-line no-console
        console.debug("[代名詞] WordPosInfo: Pronomen branch", {
          partOfSpeech,
          pos,
          queryWord,
          baseForm,
          uiLang,
          currentLang,
          hasUiTextLang: !!(uiLang && uiText?.[uiLang]),
          uiLabelsKeys: uiLabels ? Object.keys(uiLabels) : null,
          hasPronLabels: !!uiLabels?.pron,
          pronLabelsKeys:
            uiLabels?.pron && typeof uiLabels.pron === "object"
              ? Object.keys(uiLabels.pron)
              : null,
          note:
            "WordPosInfoPronomen receives uiLang + onSelectForm here; this log is for flow verification.",
        });
      } catch (e) {}
      return (
        <>
          <WordPosInfoPronomen
            baseForm={baseForm}
            labels={uiLabels.pron}
            uiLang={currentLang}
            onSelectForm={handleSpeakForm}
          />
        </>
      );
    }

    case "Artikel": {
      return (
        <>
          <WordPosInfoArtikel
            baseForm={baseForm}
            queryWord={queryWord}
            labels={uiLabels.art}
            uiLang={currentLang}
            onSelectForm={handleSpeakForm}
          />
        </>
      );
    }

    case "Adverb": {
      const dictObj =
        extraInfo && extraInfo.dictionary && typeof extraInfo.dictionary === "object"
          ? extraInfo.dictionary
          : extraInfo && typeof extraInfo === "object"
            ? extraInfo
            : {};

      return (
        <>
          <WordPosInfoAdverb
            baseForm={baseForm}
            labels={uiLabels.adv}
            uiLang={uiLang}
            extraInfo={dictObj}
            onSelectForm={handleSpeakForm}
          />
        </>
      );
    }

    case "Präposition":
    case "Praeposition": {
      return (
        <>
          <WordPosInfoPraeposition baseForm={baseForm} labels={uiLabels.prep} />
        </>
      );
    }

    default:
      return renderPlaceholder("其他詞性");
  }
}
// frontend/src/components/posInfo/WordPosInfo.jsx

//
// (padding lines to keep file length stable for review merges)
//
