// frontend/src/components/WordPosInfo.jsx
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
}) {
  if (!partOfSpeech || !baseForm) return null;

  const pos = (partOfSpeech || "").trim();

  let currentLang = "zh-TW";
  if (uiLang && uiText[uiLang]) currentLang = uiLang;

  // ✅ Strict mode：不做 zh-TW fallback（缺 key 就讓下層顯示 "—"）
  const wordUi = uiText[currentLang]?.wordCard || {};

  const posLocalName = wordUi?.posLocalNameMap?.[pos] || pos;

  function handleSpeakForm(form) {
    // ✅ 2026-01-12 Task 1：保持原本點選格表會唸出 TTS
    // 同時把選取結果往上回傳（供例句 header 覆蓋）
    // - form=null：代表 clear selection（上層可用來清掉 override）
    const surface =
      form && typeof form.surface === "string" ? form.surface.trim() : "";

    if (surface) {
      playTTS(surface, "de-DE");
    }

    // ✅ Task 1（只影響顯示）：把 surface 往上回拋（上層用 wordKey/senseIndex 分流）
    // meta 可包含 { case, number }，Task 1 不強制用，但先保留
    try {
      if (typeof onEntrySurfaceChange === "function") {
        const nounMeta =
          form && form.noun && typeof form.noun === "object" ? form.noun : null;
        const meta = nounMeta
          ? {
              case:
                typeof nounMeta.case === "string" ? nounMeta.case : undefined,
              number:
                typeof nounMeta.number === "string"
                  ? nounMeta.number
                  : undefined,
            }
          : undefined;

        onEntrySurfaceChange(surface || null, meta);
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
        <WordPosInfoNoun
          gender={gender}
          baseForm={baseForm}
          labels={nounLabels}
          onSelectForm={handleSpeakForm}
        />
      );
    }

    case "Verb": {
      const verbExtraInfo =
        extraInfo &&
        extraInfo.dictionary &&
        typeof extraInfo.dictionary === "object"
          ? extraInfo.dictionary
          : extraInfo;

      return (
        <WordPosInfoVerb
          baseForm={baseForm}
          queryWord={queryWord}
          labels={uiLabels.verb}
          extraInfo={verbExtraInfo || {}}
          uiLang={uiLang}
          onWordClick={onWordClick}
        />
      );
    }

    case "Adjektiv":
      return (
        <WordPosInfoAdjektiv
          baseForm={baseForm}
          labels={uiLabels.adj}
          uiLang={uiLang}
        />
      );

    case "Pronomen":
      return <WordPosInfoPronomen baseForm={baseForm} labels={uiLabels.pron} />;

    case "Artikel":
      return <WordPosInfoArtikel labels={uiLabels.art} />;

    case "Adverb":
      return <WordPosInfoAdverb baseForm={baseForm} labels={uiLabels.adv} />;

    case "Präposition":
    case "Praeposition":
      return (
        <WordPosInfoPraeposition baseForm={baseForm} labels={uiLabels.prep} />
      );

    default:
      return renderPlaceholder("其他詞性");
  }
}
// frontend/src/components/WordPosInfo.jsx
