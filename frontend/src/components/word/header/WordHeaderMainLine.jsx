// frontend/src/components/WordHeaderMainLine.jsx

import { playTTS } from "../../utils/ttsClient";
import HeaderSection from "./WordHeaderMainLineHeader";
import PosSection from "./WordHeaderMainLinePos";
import DefinitionZhSection from "./WordHeaderMainLineDefinitionZh";
import DefinitionDeSection from "./WordHeaderMainLineDefinitionDe";
// ❌ PluralSection 已移除
import ExampleSection from "./WordHeaderMainLineExample";
import NotesSection from "./WordHeaderMainLineNotes";

function WordCard({ data, labels = {}, onWordClick, onSpeak }) {
  if (!data) return null;
  const d = data.dictionary || {};

  /* ------------------------
     冠詞顏色（支援 theme）
     ------------------------ */
  const genderColors = {
    der: "var(--article-der)",
    die: "var(--article-die)",
    das: "var(--article-das)",
  };

  const article = d.gender || "";
  const articleColor = genderColors[article] || "var(--text-main)";

  /* ------------------------
     Labels
     ------------------------ */
  const {
    labelRoot = "詞根",
    labelDefinition = "釋義",
    sectionExample = "例句",
    sectionExampleTranslation = "翻譯",
    sectionNotes = "補充說明",
    posLocalNameMap: externalPosLocalNameMap,
  } = labels;

  const defaultPosLocalNameMap = {
    Nomen: "名詞",
    Verb: "動詞",
    Adjektiv: "形容詞",
    Adverb: "副詞",
    Artikel: "冠詞",
    Pronomen: "代名詞",
    Präposition: "介系詞",
    Konjunktion: "連接詞",
    Numerale: "數詞",
    Interjektion: "感歎詞",
    Partikel: "語氣詞／功能小詞",
    Hilfsverb: "助動詞",
    Modalverb: "情態動詞",
    Reflexivpronomen: "反身代名詞",
    Possessivpronomen: "所有格代名詞",
  };
  const posLocalNameMap = externalPosLocalNameMap || defaultPosLocalNameMap;

  /* ------------------------
     詞性轉換
     ------------------------ */
  const rawPos = d.partOfSpeech || "";
  const rawPosKey = rawPos ? rawPos.trim().toLowerCase() : "";

  const posKeyMap = {
    noun: "Nomen",
    substantiv: "Nomen",
    nomen: "Nomen",
    verb: "Verb",
    adjective: "Adjektiv",
    adjektiv: "Adjektiv",
    adverb: "Adverb",
    artikel: "Artikel",
    pronomen: "Pronomen",
    pronoun: "Pronomen",
    präposition: "Präposition",
    preposition: "Präposition",
    konjunktion: "Konjunktion",
    numerale: "Numerale",
    zahlwort: "Numerale",
    interjektion: "Interjektion",
    partikel: "Partikel",
    hilfsverb: "Hilfsverb",
    modalverb: "Modalverb",
  };

  const canonicalPos =
    rawPosKey && posKeyMap[rawPosKey] ? posKeyMap[rawPosKey] : rawPos;

  let posDisplay = "";
  if (canonicalPos) {
    const local = posLocalNameMap[canonicalPos];
    posDisplay = `${canonicalPos}${local ? `（${local}）` : ""}`;
  }

  /* ------------------------
     釋義（中文）
     ------------------------ */
  let definitionList = [];
  if (Array.isArray(d.definition)) {
    definitionList = d.definition
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  } else if (typeof d.definition === "string") {
    const raw = d.definition.trim();
    if (raw) {
      const parts = raw
        .split(/[；;／/、]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      definitionList = parts.length > 0 ? parts : [raw];
    }
  }

  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  const getDefinitionIndexLabel = (idx) =>
    circledNumbers[idx] || `${idx + 1}.`;

  /* ------------------------
     Definition(DE)
     ------------------------ */
  let definitionDeList = [];
  if (Array.isArray(d.definition_de)) {
    definitionDeList = d.definition_de
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((s) => s.length > 0);
  } else if (typeof d.definition_de === "string" && d.definition_de.trim()) {
    definitionDeList = [d.definition_de.trim()];
  }

  let definitionDeTransList = [];
  if (Array.isArray(d.definition_de_translation)) {
    definitionDeTransList = d.definition_de_translation
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((s) => s.length > 0);
  } else if (
    typeof d.definition_de_translation === "string" &&
    d.definition_de_translation.trim()
  ) {
    definitionDeTransList = [d.definition_de_translation.trim()];
  }

  if (definitionDeTransList.length === 0) {
    const fallbackHint = Array.isArray(d.definition)
      ? d.definition.join("；")
      : d.definition || "";
    if (fallbackHint) {
      definitionDeTransList = [fallbackHint];
    }
  }

  const getDefinitionDeHint = (index) => {
    if (definitionDeTransList.length === 0) return "";
    if (definitionDeTransList.length === 1) return definitionDeTransList[0];
    return definitionDeTransList[index] || definitionDeTransList[0];
  };

  const exampleTranslation =
    typeof (d.exampleTranslation || d.example_translation) === "string"
      ? d.exampleTranslation || d.example_translation
      : "";

  const renderClickableText = (text, hoverHint) => {
    if (!text) return null;
    const tokens = text.split(/(\s+|[.,!?;:"()«»„“”])/);
    return tokens.map((tok, idx) => {
      if (!tok.trim()) return tok;
      if (!/[A-Za-zÄÖÜäöüß]/.test(tok)) return tok;
      return (
        <span
          key={idx}
          onClick={() => onWordClick(tok)}
          title={hoverHint}
          style={{
            cursor: "pointer",
            textDecoration: "underline dotted",
            textUnderlineOffset: 2,
          }}
        >
          {tok}
        </span>
      );
    });
  };

  const headword = d.word || data.text;
  const headerSpeakText = `${article ? article + " " : ""}${headword}`.trim();

  const handleSpeak = (text) => {
    if (!text || typeof text !== "string" || !text.trim()) return;
    if (typeof onSpeak === "function") {
      onSpeak(text);
    } else {
      playTTS(text, "de-DE");
    }
  };

  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        boxShadow: "none",
      }}
    >
      {/* Header */}
      <HeaderSection
        article={article}
        articleColor={articleColor}
        headword={headword}
        headerSpeakText={headerSpeakText}
        onWordClick={onWordClick}
        handleSpeak={handleSpeak}
      />

      {/* 詞性 */}
      <PosSection posDisplay={posDisplay} />

      {/* 分隔線 */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right, transparent, var(--border-subtle), transparent)",
          marginBottom: 10,
        }}
      />

      {/* 中文釋義 */}
      <DefinitionZhSection
        definitionList={definitionList}
        labelDefinition={labelDefinition}
        getDefinitionIndexLabel={getDefinitionIndexLabel}
      />

      {/* Definition (DE) */}
      <DefinitionDeSection
        definitionDeList={definitionDeList}
        getDefinitionIndexLabel={getDefinitionIndexLabel}
        renderClickableText={renderClickableText}
        getDefinitionDeHint={getDefinitionDeHint}
        handleSpeak={handleSpeak}
      />

      {/* ❌ 複數區塊已完全移除 */}

      {/* 例句 */}
      <ExampleSection
        example={d.example}
        sectionExample={sectionExample}
        sectionExampleTranslation={sectionExampleTranslation}
        exampleTranslation={exampleTranslation}
        renderClickableText={renderClickableText}
        handleSpeak={handleSpeak}
      />

      {/* 補充說明 */}
      <NotesSection notes={d.notes} sectionNotes={sectionNotes} />
    </div>
  );
}

export default WordCard;
