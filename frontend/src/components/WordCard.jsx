// frontend/src/components/WordCard.jsx

import { useState } from "react";
import WordHeader from "./WordHeader";
import WordDefinitionBlock from "./WordDefinitionBlock";
import WordExampleBlock from "./WordExampleBlock";
import {
  genderColors,
  pluralArticleColor,
  defaultPosLocalNameMap,
  normalizePos,
} from "../utils/wordCardConfig";

function WordCard({ data, labels = {}, onWordClick, onSpeak }) {
  if (!data) return null;
  const d = data.dictionary || {};

  // 目前選擇的釋義 index（預設 0）
  const [senseIndex, setSenseIndex] = useState(0);

  // labels（保留多國語系）
  const {
    labelPlural = "複數",
    labelRoot = "詞根",
    labelDefinition = "釋義",
    sectionExample = "例句",
    sectionExampleTranslation = "翻譯",
    sectionNotes = "補充說明",

    // ★ 新增：句型結構 / 四格 / 冠詞等多國語系文案
    grammarOptionsLabel,
    grammarToggleLabel,
    grammarCaseLabel,
    grammarCaseNomLabel,
    grammarCaseAkkLabel,
    grammarCaseDatLabel,
    grammarCaseGenLabel,
    grammarArticleLabel,
    grammarArticleDefLabel,
    grammarArticleIndefLabel,
    grammarArticleNoneLabel,
    refreshExamplesTooltipLabel,

    posLocalNameMap: externalPosLocalNameMap,
  } = labels;

  const posLocalNameMap = externalPosLocalNameMap || defaultPosLocalNameMap;

  // 詞性
  const rawPos = d.partOfSpeech || "";
  const canonicalPos = normalizePos(rawPos);

  let posDisplay = "";
  if (canonicalPos) {
    const local = posLocalNameMap[canonicalPos];
    posDisplay = `${canonicalPos}${local ? `（${local}）` : ""}`;
  }

  // 例句翻譯（後端可能兩種寫法）
  const exampleTranslation =
    typeof (d.exampleTranslation || d.example_translation) === "string"
      ? d.exampleTranslation || d.example_translation
      : "";

  // explainLang：從整體結果帶下來（App 呼叫 /analyze 時有傳）
  const explainLang = data.explainLang || "zh-TW";

  const headword = d.word || data.text;
  const headerSpeakText = `${d.gender ? d.gender + " " : ""}${headword}`.trim();

  // 冠詞顏色
  const articleColor = genderColors[d.gender || ""] || "var(--text-main)";

  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
      }}
    >
      {/* Header */}
      <WordHeader
        article={d.gender}
        headword={headword}
        articleColor={articleColor}
        headerSpeakText={headerSpeakText}
        posDisplay={posDisplay}
        onWordClick={onWordClick}
        onSpeak={onSpeak}
      />

      {/* 分隔線 */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right, transparent, var(--border-subtle), transparent)",
          marginBottom: 10,
        }}
      />

      {/* 複數 */}
      {d.plural && (
        <div
          style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}
        >
          <strong>{labelPlural}：</strong>
          <span style={{ cursor: "pointer" }} onClick={() => onWordClick(d.plural)}>
            <span
              style={{
                color: pluralArticleColor,
                textShadow: "var(--text-outline)",
              }}
            >
              die
            </span>{" "}
            <span style={{ color: "var(--text-main)" }}>{d.plural}</span>
          </span>

          <button
            onClick={() => onSpeak(`die ${d.plural}`)}
            style={{
              padding: "2px 6px",
              borderRadius: 999,
              border: "none",
              background: "var(--chip-bg)",
              cursor: "pointer",
            }}
          >
            🔊
          </button>
        </div>
      )}

      {/* 釋義 */}
      <WordDefinitionBlock
        d={d}
        labelDefinition={labelDefinition}
        senseIndex={senseIndex}
        onSenseChange={setSenseIndex}
        onWordClick={onWordClick}
        onSpeak={onSpeak}
      />

      {/* 例句區塊 */}
      <WordExampleBlock
        d={d}
        senseIndex={senseIndex}
        sectionExample={sectionExample}
        sectionExampleTranslation={sectionExampleTranslation}
        exampleTranslation={exampleTranslation}
        explainLang={explainLang}
        onWordClick={onWordClick}
        onSpeak={onSpeak}
        // ★ 把多國語系文案全部往下傳，給 GrammarOptions + NounCaseTable 用
        grammarOptionsLabel={grammarOptionsLabel}
        grammarToggleLabel={grammarToggleLabel}
        grammarCaseLabel={grammarCaseLabel}
        grammarCaseNomLabel={grammarCaseNomLabel}
        grammarCaseAkkLabel={grammarCaseAkkLabel}
        grammarCaseDatLabel={grammarCaseDatLabel}
        grammarCaseGenLabel={grammarCaseGenLabel}
        grammarArticleLabel={grammarArticleLabel}
        grammarArticleDefLabel={grammarArticleDefLabel}
        grammarArticleIndefLabel={grammarArticleIndefLabel}
        grammarArticleNoneLabel={grammarArticleNoneLabel}
        refreshExamplesTooltipLabel={refreshExamplesTooltipLabel}
      />

      {/* 補充說明 */}
      {d.notes && (
        <div style={{ marginTop: 14, fontSize: 13 }}>
          <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>
            {sectionNotes}
          </div>
          <div>{d.notes}</div>
        </div>
      )}
    </div>
  );
}

export default WordCard;
