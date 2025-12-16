// frontend/src/components/WordPosInfo.jsx
//
// 詞性資訊總管（WordPosInfo）
// ------------------------------------------------------
//
// ⭐ Step A（本次調整）
// - 移除「總管層級」的收合/展開（折疊應該由各子卡自己負責）
// - WordPosInfo.jsx 只負責依詞性分流渲染子卡
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
  baseForm,
  gender,
  uiLabels = {},
  extraInfo = {},
  type,
  uiLang,
}) {
  if (!partOfSpeech || !baseForm) return null;

  const pos = (partOfSpeech || "").trim();

  let currentLang = "zh-TW";
  if (uiLang && uiText[uiLang]) currentLang = uiLang;

  // ✅ Strict mode：不做 zh-TW fallback（缺 key 就讓下層顯示 "—"）
  const wordUi = uiText[currentLang]?.wordCard || {};

  const posLocalName = wordUi?.posLocalNameMap?.[pos] || pos;

  function handleSpeakForm(form) {
    if (!form || !form.surface) return;
    playTTS(form.surface, "de-DE");
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
      <div style={{ marginTop: 4, fontSize: 12 }}>
        ※ 專用的 {labelZh} 變化區塊尚未實作。
      </div>
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
          labels={uiLabels.verb}
          extraInfo={verbExtraInfo || {}}
          uiLang={uiLang}
        />
      );
    }

    case "Adjektiv":
      return <WordPosInfoAdjektiv baseForm={baseForm} labels={uiLabels.adj} />;

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
