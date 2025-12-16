// frontend/src/components/word/WordCard.jsx
import { useMemo, useState } from "react";
import WordHeader from "./header/WordHeader";
import WordHeaderMainLinePlural from "./header/WordHeaderMainLinePlural";
import WordDefinitionBlock from "./definition/WordDefinitionBlock";
import WordExampleBlock from "../examples/WordExampleBlock";
import {
  genderColors,
  defaultPosLocalNameMap,
  normalizePos,
} from "../../utils/wordCardConfig";
import FavoriteStar from "../common/FavoriteStar";
import uiText from "../../uiText";

function WordCard({
  data,
  labels = {},
  uiLang,
  onWordClick,
  onSpeak,

  // ✅ 收藏統一由 App.jsx 管理：WordCard 不再碰 auth/localStorage
  favoriteActive = false,
  favoriteDisabled = false,
  onToggleFavorite,
}) {
  if (!data) return null;
  const d = data.dictionary || {};

  const [senseIndex, setSenseIndex] = useState(0);

  // ✅ WordCard 統一注入多國文字（唯一來源 uiText.js）
  const DEFAULT_LANG = "zh-TW";
  const lang = uiLang && uiText[uiLang] ? uiLang : DEFAULT_LANG;
  const wordUi = uiText[lang]?.wordCard || uiText[DEFAULT_LANG]?.wordCard || {};
  const verbUi = uiText[lang]?.verbCard || uiText[DEFAULT_LANG]?.verbCard || {};

  const {
    labelPlural = wordUi.labelPlural || "-",
    labelRoot = wordUi.labelRoot || "-",
    labelDefinition = wordUi.labelDefinition || "-",
    sectionExample = wordUi.sectionExample || "-",
    sectionExampleTranslation = wordUi.sectionExampleTranslation || "-",
    sectionNotes = wordUi.sectionNotes || "-",

    grammarOptionsLabel = wordUi.grammarOptionsLabel || "-",
    grammarToggleLabel = wordUi.grammarToggleLabel || "-",
    grammarCaseLabel = wordUi.grammarCaseLabel || "-",
    grammarCaseNomLabel = wordUi.grammarCaseNomLabel || "-",
    grammarCaseAkkLabel = wordUi.grammarCaseAkkLabel || "-",
    grammarCaseDatLabel = wordUi.grammarCaseDatLabel || "-",
    grammarCaseGenLabel = wordUi.grammarCaseGenLabel || "-",
    grammarArticleLabel = wordUi.grammarArticleLabel || "-",
    grammarArticleDefLabel = wordUi.grammarArticleDefLabel || "-",
    grammarArticleIndefLabel = wordUi.grammarArticleIndefLabel || "-",
    grammarArticleNoneLabel = wordUi.grammarArticleNoneLabel || "-",
    refreshExamplesTooltipLabel = wordUi.refreshExamplesTooltipLabel || "-",

    posLocalNameMap: externalPosLocalNameMap,
  } = labels;

  const posLocalNameMap =
    externalPosLocalNameMap ||
    wordUi.posLocalNameMap ||
    defaultPosLocalNameMap;

  const rawPos = d.partOfSpeech || "";
  const canonicalPos = normalizePos(rawPos);

  let posDisplay = "";
  if (canonicalPos) {
    const local = posLocalNameMap[canonicalPos];
    posDisplay = `${canonicalPos}${local ? `（${local}）` : ""}`;
  }

  const exampleTranslation =
    typeof (d.exampleTranslation || d.example_translation) === "string"
      ? d.exampleTranslation || d.example_translation
      : "";

  const explainLang = uiLang || data.explainLang || "zh-TW";

  // ✅ 顯示用 headword：只對名詞（Nomen）優先用原型（baseForm/lemma）
  // 其他詞性（Verb/Adjektiv...）維持 user 輸入的樣子
  const inputText = data.text;

  const lemmaFromDict =
    (typeof d.baseForm === "string" && d.baseForm.trim()) ||
    (typeof d.base_form === "string" && d.base_form.trim()) ||
    (typeof d.lemma === "string" && d.lemma.trim()) ||
    (typeof d.headword === "string" && d.headword.trim()) ||
    "";

  // ✅ 改動點：只保留名詞使用 lemma/baseForm
  const shouldPreferLemma = canonicalPos === "Nomen";

  const headword = (
    (shouldPreferLemma && lemmaFromDict) ||
    (typeof d.word === "string" && d.word.trim()) ||
    (typeof inputText === "string" && inputText.trim()) ||
    ""
  ).trim();

  // ✅ 本輪單一目標：名詞用原型顯示時，冠詞也要跟著原型
  const escapeRegExp = (s) =>
    String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // ✅ 1) 先吃後端若已提供的「原型冠詞」欄位（多種命名都支援）
  const baseGenderFromDict =
    (typeof d.baseGender === "string" && d.baseGender.trim()) ||
    (typeof d.base_gender === "string" && d.base_gender.trim()) ||
    (typeof d.lemmaGender === "string" && d.lemmaGender.trim()) ||
    (typeof d.lemma_gender === "string" && d.lemma_gender.trim()) ||
    (typeof d.headwordGender === "string" && d.headwordGender.trim()) ||
    (typeof d.headword_gender === "string" && d.headword_gender.trim()) ||
    "";

  // ✅ 2) 其次才用 definition 文字去抓 der/die/das + headword
  const inferBaseArticle = () => {
    if (canonicalPos !== "Nomen") return "";
    if (!headword) return "";

    const sources = [];

    const pushIfString = (v) => {
      if (typeof v === "string" && v.trim()) sources.push(v);
    };
    const pushIfArray = (v) => {
      if (!Array.isArray(v)) return;
      for (const it of v) pushIfString(it);
    };

    pushIfString(d.definition_de);
    pushIfString(d.definitionDe);
    pushIfString(d.definition);
    pushIfString(d.definition_de_short);
    pushIfString(d.definition_de_long);
    pushIfString(d.definition_de_text);
    pushIfString(d.definition_de_plain);
    pushIfArray(d.definition_de_list);
    pushIfArray(d.definition_list);

    const hw = headword.trim();
    const re = new RegExp(`\\b(der|die|das)\\s+${escapeRegExp(hw)}\\b`, "i");

    for (const s of sources) {
      const m = String(s).match(re);
      if (m && m[1]) return String(m[1]).toLowerCase();
    }
    return "";
  };

  const inputTrim = (typeof inputText === "string" ? inputText : "").trim();
  const usedLemmaForDisplay = canonicalPos === "Nomen" && !!lemmaFromDict;
  const headwordDiffersFromInput =
    !!inputTrim &&
    !!headword &&
    inputTrim.toLowerCase() !== headword.toLowerCase();

  const inferredBaseArticle =
    usedLemmaForDisplay && headwordDiffersFromInput ? inferBaseArticle() : "";

  // ✅ 最終顯示冠詞決策：
  const displayArticle = (() => {
    if (canonicalPos !== "Nomen") return d.gender || "";
    if (usedLemmaForDisplay && headwordDiffersFromInput) {
      return (
        (baseGenderFromDict ? baseGenderFromDict.trim().toLowerCase() : "") ||
        inferredBaseArticle ||
        (d.gender || "")
      );
    }
    return d.gender || "";
  })();

  const headerSpeakText = `${displayArticle ? displayArticle + " " : ""}${headword}`.trim();

  const articleColor = genderColors[displayArticle || ""] || "var(--text-main)";
  const pluralArticleColor = genderColors["die_plural"] || "var(--text-main)";

  const isVerb = canonicalPos === "Verb";

  const separablePrefixes = useMemo(
    () => [
      "ab",
      "an",
      "auf",
      "aus",
      "bei",
      "ein",
      "fest",
      "fort",
      "her",
      "hin",
      "los",
      "mit",
      "nach",
      "nieder",
      "vor",
      "weg",
      "weiter",
      "zu",
      "zurück",
      "zusammen",
    ],
    []
  );

  function detectSeparablePrefix(lemma) {
    if (!lemma || typeof lemma !== "string") return "";
    const w = lemma.trim().toLowerCase();
    const last = w.split(/\s+/).slice(-1)[0] || w;

    const sorted = [...separablePrefixes].sort((a, b) => b.length - a.length);
    for (const p of sorted) {
      if (last.startsWith(p) && last.length > p.length + 1) return p;
    }
    return "";
  }

  const detectedPrefix = useMemo(() => {
    const lemma =
      (typeof d.baseForm === "string" && d.baseForm.trim()) ||
      (typeof d.word === "string" && d.word.trim()) ||
      (typeof headword === "string" && headword.trim()) ||
      "";
    return detectSeparablePrefix(lemma);
  }, [d.baseForm, d.word, headword]);

  const isSeparable =
    isVerb &&
    (d.separable === true ||
      d.separable === "true" ||
      d.separable === 1 ||
      !!detectedPrefix);

  const isReflexive =
    isVerb &&
    (d.reflexive === true || d.reflexive === "true" || d.reflexive === 1);

  // ★ 新增：不規則動詞（來自後端 normalized.irregular）
  const irregularInfo = d.irregular || null;
  const isIrregular = isVerb && irregularInfo && irregularInfo.enabled === true;

  // ✅ 一律吃 uiText；缺 key 就顯示 "-"
  const phraseBadgeText = verbUi.phraseLabel || "-";
  const separableBadgeText = verbUi.separableLabel || "-";
  const reflexiveBadgeText = verbUi.reflexiveLabel || "-";

  const irregularPrefix = verbUi.irregularPrefix || "-";
  const irregularTypeLabelMap = {
    strong: verbUi.irregularStrong || "-",
    mixed: verbUi.irregularMixed || "-",
    suppletive: verbUi.irregularSuppletive || "-",
  };

  const irregularBadgeText = isIrregular
    ? `${irregularPrefix} ${
        irregularTypeLabelMap[irregularInfo.type] || irregularInfo.type || "-"
      }`.trim()
    : "";

  const verbSubtypeRaw =
    (typeof d.verbSubtype === "string" && d.verbSubtype.trim()) ||
    (typeof d.verb_subtype === "string" && d.verb_subtype.trim()) ||
    "";

  const verbSubtypeBadgeText = (() => {
    if (!isVerb) return "";
    switch (verbSubtypeRaw) {
      case "vollverb":
        return verbUi.subtypeFullVerb || "-";
      case "modal":
        return verbUi.subtypeModal || "-";
      case "hilfsverb":
        return verbUi.subtypeAux || "-";
      default:
        return "";
    }
  })();

  const plural =
    typeof (d.plural || d.pluralForm || d.nounPlural || d.pluralBaseForm) ===
    "string"
      ? (d.plural || d.pluralForm || d.nounPlural || d.pluralBaseForm).trim()
      : "";

  const nounType = d.type || "common_noun";
  const shouldShowGrammar =
    nounType === "common_noun" && canonicalPos === "Nomen";

  // ✅ 收藏 UI：完全由 App props 決定
  const favDisabled =
    !!favoriteDisabled || typeof onToggleFavorite !== "function";

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
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WordHeader
            article={shouldShowGrammar ? displayArticle : ""}
            headword={headword}
            articleColor={articleColor}
            headerSpeakText={headerSpeakText}
            posDisplay={posDisplay}
            onWordClick={onWordClick}
            onSpeak={onSpeak}
          />
        </div>

        {/* ⭐ 我的最愛（App 管） */}
        <FavoriteStar
          active={!!favoriteActive}
          disabled={favDisabled}
          onClick={onToggleFavorite}
          size={16}
          ariaLabel="-"
        />
      </div>

      {(data.mode === "phrase" ||
        isSeparable ||
        isReflexive ||
        isIrregular ||
        !!verbSubtypeBadgeText) && (
        <div
          style={{
            marginTop: 6,
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {data.mode === "phrase" && (
            <div style={badgeStyle}>{phraseBadgeText}</div>
          )}
          {isSeparable && <div style={badgeStyle}>{separableBadgeText}</div>}
          {isReflexive && <div style={badgeStyle}>{reflexiveBadgeText}</div>}
          {verbSubtypeBadgeText && (
            <div style={badgeStyle}>{verbSubtypeBadgeText}</div>
          )}
          {isIrregular && <div style={badgeStyle}>{irregularBadgeText}</div>}
        </div>
      )}

      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right, transparent, var(--border-subtle), transparent)",
          marginBottom: 10,
        }}
      />

      {shouldShowGrammar && plural ? (
        <WordHeaderMainLinePlural
          plural={plural}
          labelPlural={labelPlural}
          pluralArticleColor={pluralArticleColor}
          handleSpeak={onSpeak}
          onWordClick={onWordClick}
        />
      ) : null}

      <WordDefinitionBlock
        d={d}
        labelDefinition={labelDefinition}
        senseIndex={senseIndex}
        onSenseChange={setSenseIndex}
        onWordClick={onWordClick}
        onSpeak={onSpeak}
        shouldShowGrammar={shouldShowGrammar}
      />

      <WordExampleBlock
        d={d}
        senseIndex={senseIndex}
        sectionExample={sectionExample}
        sectionExampleTranslation={sectionExampleTranslation}
        exampleTranslation={exampleTranslation}
        explainLang={explainLang}
        onWordClick={onWordClick}
        onSpeak={onSpeak}
        uiLang={uiLang}
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
        shouldShowGrammar={shouldShowGrammar}
      />

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

// 共用 badge 樣式（避免重複）
const badgeStyle = {
  display: "inline-flex",
  width: "fit-content",
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: 12,
  background: "var(--accent-soft, #e0f2fe)",
  color: "var(--accent, #0369a1)",
  border: "1px solid var(--border-subtle)",
};

export default WordCard;
// frontend/src/components/word/WordCard.jsx
