// frontend/src/components/WordExampleBlock.jsx

import React, { useState } from "react";
import ExampleList from "./ExampleList";
import GrammarOptions from "./GrammarOptions";
import useExamples from "./useExamples";
import NounCaseTable from "./NounCaseTable";

export default function WordExampleBlock({
  d,
  senseIndex,
  sectionExample,
  sectionExampleTranslation,
  exampleTranslation,
  explainLang,
  onWordClick,
  onSpeak,

  grammarOptionsLabel,
  grammarCaseLabel,
  grammarArticleLabel,
  grammarCaseNomLabel,
  grammarCaseAkkLabel,
  grammarCaseDatLabel,
  grammarCaseGenLabel,
  grammarArticleDefLabel,
  grammarArticleIndefLabel,
  grammarArticleNoneLabel,
  refreshExamplesTooltipLabel,
  grammarToggleLabel,
}) {
  console.log("[WordExampleBlock] render", {
    word: d?.word,
    baseForm: d?.baseForm,
    senseIndex,
    partOfSpeech: d?.partOfSpeech,
    explainLang,
  });

  const [caseOpt, setCaseOpt] = useState("nom");
  const [articleType, setArticleType] = useState("def");
  const [showGrammarOptions, setShowGrammarOptions] = useState(false);

  const tGrammarOptions = grammarOptionsLabel || "句型結構";
  const tGrammarToggle = grammarToggleLabel || "調整句型";

  const tCaseLabel = grammarCaseLabel || "第幾格";
  const tCaseNom = grammarCaseNomLabel || "主格";
  const tCaseAkk = grammarCaseAkkLabel || "受格";
  const tCaseDat = grammarCaseDatLabel || "與格";
  const tCaseGen = grammarCaseGenLabel || "屬格";

  const tArticleLabel = grammarArticleLabel || "冠詞";
  const tArtDef = grammarArticleDefLabel || "定冠詞";
  const tArtIndef = grammarArticleIndefLabel || "不定冠詞";
  const tArtNone = grammarArticleNoneLabel || "無冠詞";

  const tRefreshTooltip =
    refreshExamplesTooltipLabel || "重新產生例句";

  const {
    examples,
    exampleTranslation: generatedTranslation,
    loading,
    refreshExamples,
  } = useExamples({
    d,
    senseIndex,
    caseOpt,
    articleType,
    explainLang,
  });

  // ⭐ 關鍵修改：
  // - 中文介面（zh-TW / zh-CN）：可以用原本 d.exampleTranslation 當 fallback
  // - 其他語言（例如 en）：只吃後端 /api/dictionary/examples 回來的 generatedTranslation，
  //   避免顯示之前語言的舊翻譯（例如中文）
  const isChineseUi =
    explainLang === "zh-TW" || explainLang === "zh-CN";

  const effectiveExampleTranslation =
    generatedTranslation ||
    (isChineseUi ? exampleTranslation || "" : "");

  const isNoun =
    d &&
    typeof d.partOfSpeech === "string" &&
    (d.partOfSpeech === "Nomen" || d.partOfSpeech === "Substantiv");

  const hasNounInfo =
    isNoun && d.gender && (d.baseForm || d.word);

  return (
    <div style={{ marginTop: 20 }}>
      {hasNounInfo && (
        <NounCaseTable
          gender={d.gender}
          baseForm={d.baseForm || d.word}
          labels={{
            caseTableTitle: d.caseTableTitle,
            caseNom: tCaseNom,
            caseAkk: tCaseAkk,
            caseDat: tCaseDat,
            caseGen: tCaseGen,
          }}
        />
      )}

      {/* 例句區塊 */}
      <ExampleList
        examples={examples}
        loading={loading}
        sectionExample={sectionExample}
        sectionExampleTranslation={sectionExampleTranslation}
        exampleTranslation={effectiveExampleTranslation}
        onSpeak={onSpeak}
        onRefresh={refreshExamples}
        refreshTooltip={tRefreshTooltip}
        onWordClick={onWordClick}
      />
      {/* ↑ onWordClick 已接好，例句內可點字 */}

      {/* 句型結構（可收合） */}
      <GrammarOptions
        show={showGrammarOptions}
        onToggle={() => {
          setShowGrammarOptions((v) => !v);
        }}
        caseOpt={caseOpt}
        articleType={articleType}
        onChangeCase={(val) => setCaseOpt(val)}
        onChangeArticle={(val) => setArticleType(val)}
        labels={{
          grammarOptions: tGrammarOptions,
          grammarToggle: tGrammarToggle,
          caseLabel: tCaseLabel,
          caseNom: tCaseNom,
          caseAkk: tCaseAkk,
          caseDat: tCaseDat,
          caseGen: tCaseGen,
          articleLabel: tArticleLabel,
          artDef: tArtDef,
          artIndef: tArtIndef,
          artNone: tArtNone,
        }}
      />
    </div>
  );
}
