// frontend/src/components/WordPosInfoVerb.jsx
//
// 動詞（Verb）資訊區塊
// - 顯示：動詞類型 / 助動詞 / 常見搭配
// - 下拉選單切換時態（Präsens / Präteritum / Perfekt）
// - 3x2 格子顯示 ich / du / er_sie_es / wir / ihr / sie_Sie
// - 多國語系：從 uiText[currentLang].verbCard 讀取 labels（缺就顯示 "-"）
//
// ⭐ Step A-1（本次修正）
// - 後端可能誤標 separable=false（例如 "sich vorbereiten"），但 baseForm 可偵測到前綴
// - 改用 effectiveSeparable = separable || detectedPrefix 來拆前綴判斷
//
// ⭐ Step B-1（本次修正）
// - 在動詞下方顯示 recommendations：同義 / 反義 / 同字根
// - 點擊推薦字：優先走 onWordClick（若外層有傳入）；否則 dispatch window event "wordSearch"
//
// ⭐ Step B-2（本輪變更：只改「同字根」規則）
// - 同字根只在「可分離動詞」時顯示
// - 同字根過濾掉人格變化/變位形式，只保留「原形/詞條」
//
// ⭐ Step C-1（本輪變更：新增「不規則」拆分標籤 + 多國語系）
// - 支援 extraInfo.irregularType / extraInfo.irregular{type} / extraInfo.irregular=true
// - 只新增 badge 顯示，不影響 conjugation / TTS 行為
// -----------------------------------------------------

import React, { useMemo, useState } from "react";
import uiText from "../../uiText";
import { playTTS } from "../../utils/ttsClient";

export default function WordPosInfoVerb({
  baseForm,
  labels = {},
  extraInfo = {},
  onSelectForm,
  onWordClick, // ✅ 外層若有傳，就用它重新查詢
  uiLang,
}) {
  if (!baseForm) return null;

  // ✅ 折疊（比照 WordPosInfoNoun）
  const [isOpen, setIsOpen] = useState(true);

  // ✅ 第三人稱下拉（er / sie / es）
  const [thirdPerson, setThirdPerson] = useState("er");
  // ✅ sie/Sie 下拉
  const [siePerson, setSiePerson] = useState("sie");

  // 讀目前 UI 語言（缺就維持 zh-TW，但文字仍只吃 uiText；uiText 也缺就顯示 "-"）
  let currentLang = "zh-TW";
  if (uiLang && uiText[uiLang]) currentLang = uiLang;

  // ❗嚴格模式：不 fallback 到 zh-TW
  const verbUi = uiText[currentLang]?.verbCard || {};
  const colon = verbUi.colon || "-";

  // 自動 labels，允許後續 props.labels 覆蓋
  const autoLabels = {
    posLabel: verbUi.posLabel || "-",
    title: verbUi.title || "-",

    subtypeLabel: verbUi.subtypeLabel || "-",
    subtypeFullVerb: verbUi.subtypeFullVerb || "-",
    subtypeModal: verbUi.subtypeModal || "-",
    subtypeAux: verbUi.subtypeAux || "-",

    auxiliaryLabel: verbUi.auxiliaryLabel || "-",
    valenzLabel: verbUi.valenzLabel || "-",

    // ✅ 不規則（多國語系 key）
    irregularLabel: verbUi.irregularLabel || "-",
    irregularStrongLabel: verbUi.irregularStrongLabel || "-",
    irregularMixedLabel: verbUi.irregularMixedLabel || "-",
    irregularSuppletiveLabel: verbUi.irregularSuppletiveLabel || "-",

    tenseSelectLabel: verbUi.tenseSelectLabel || "-",
    praesensLabel: verbUi.praesensLabel || "-",
    praeteritumLabel: verbUi.praeteritumLabel || "-",
    perfektLabel: verbUi.perfektLabel || "-",

    ichLabel: verbUi.ichLabel || "-",
    duLabel: verbUi.duLabel || "-",
    erSieEsLabel: verbUi.erSieEsLabel || "-",
    wirLabel: verbUi.wirLabel || "-",
    ihrLabel: verbUi.ihrLabel || "-",
    sieSieLabel: verbUi.sieSieLabel || "-",

    noFormText: verbUi.noFormText || "-",

    // ✅ 推薦字區塊（多國語系 key）
    recTitle: verbUi.recTitle || "-",
    recSynLabel: verbUi.recSynLabel || "-",
    recAntLabel: verbUi.recAntLabel || "-",
    recRootLabel: verbUi.recRootLabel || "-",

    // ✅ Debug（也走多國；缺就顯示 "-"）
    debugMissingRecs: verbUi.debugMissingRecs || "-",
  };

  const mergedLabels = {
    ...autoLabels,
    ...(labels || {}),
  };

  const {
    posLabel,
    title,
    subtypeLabel,
    subtypeFullVerb,
    subtypeModal,
    subtypeAux,
    auxiliaryLabel,
    valenzLabel,

    irregularLabel,
    irregularStrongLabel,
    irregularMixedLabel,
    irregularSuppletiveLabel,

    tenseSelectLabel,
    praesensLabel,
    praeteritumLabel,
    perfektLabel,
    ichLabel,
    duLabel,
    erSieEsLabel,
    wirLabel,
    ihrLabel,
    sieSieLabel,
    noFormText,

    recTitle,
    recSynLabel,
    recAntLabel,
    recRootLabel,

    debugMissingRecs,
  } = mergedLabels;

  const {
    verbSubtype = "",
    separable = false,
    reflexive = false,
    auxiliary = "",
    conjugation = {},
    valenz = [],
    recommendations = {}, // ✅ 後端 analyzeWord 回來的 recommendations

    // ✅ 不規則（新增支援）
    irregularType,
    irregular,
  } = extraInfo || {};

  // ✅ 不規則解析（只做 badge 顯示，不影響其他行為）
  const irregularResolvedType = (() => {
    // 1) irregularType: "strong" | "mixed" | "suppletive"
    if (typeof irregularType === "string" && irregularType.trim()) {
      return irregularType.trim();
    }

    // 2) irregular: { type }
    if (irregular && typeof irregular === "object") {
      const t = irregular.type;
      if (typeof t === "string" && t.trim()) return t.trim();
      if (irregular.enabled === true) return "irregular";
    }

    // 3) irregular: true
    if (irregular === true) return "irregular";

    return "";
  })();

  const irregularTypeText = (() => {
    switch (irregularResolvedType) {
      case "strong":
        return irregularStrongLabel;
      case "mixed":
        return irregularMixedLabel;
      case "suppletive":
        return irregularSuppletiveLabel;
      case "irregular":
        return "";
      default:
        return "";
    }
  })();

  const irregularBadgeText = (() => {
    if (!irregularResolvedType) return "";
    if (!irregularTypeText) return irregularLabel; // 只有 true 不分型
    return `${irregularLabel}${colon}${irregularTypeText}`; // 拆分型
  })();

  // 時態下拉選單
  const [tense, setTense] = useState("praesens");

  // 被選取的格子（給外框用）：{ tense, personKey } | null
  const [selectedCell, setSelectedCell] = useState(null);

  const forms =
    conjugation && conjugation[tense] && typeof conjugation[tense] === "object"
      ? conjugation[tense]
      : {};

  const subtypeText = (() => {
    switch (verbSubtype) {
      case "vollverb":
        return subtypeFullVerb;
      case "modal":
        return subtypeModal;
      case "hilfsverb":
        return subtypeAux;
      default:
        return "";
    }
  })();

  // helper 判斷是否選取
  function isSelected(personKey) {
    if (!selectedCell) return false;
    return selectedCell.tense === tense && selectedCell.personKey === personKey;
  }

  // ✅ 下拉共同樣式：小、無外匡、無原生箭頭、底線提示、與動詞更靠近
  const subjectSelectStyle = {
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1,

    border: "none",
    outline: "none",
    boxShadow: "none",
    background: "transparent",
    color: "var(--text-muted)",

    padding: 0,
    height: 18,

    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",

    // ✅ 底線提示：可切換主詞
    borderBottom: "1px solid var(--text-muted)",

    cursor: "pointer",

    // ✅ 讓主詞更貼近後面動詞（不改 ConjugationCell 的 gap）
    marginRight: -3,
  };

  // -----------------------------
  // Step A：反身 + 可分 的合併呈現（顯示 UI 已移除，但邏輯保留）
  // -----------------------------

  const reflexivePronounMap = {
    ich: "mich",
    du: "dich",
    er_sie_es: "sich",
    wir: "uns",
    ihr: "euch",
    sie_Sie: "sich",
  };

  // 常見可分前綴（簡化版）
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
    // 若 lemma 本身已含空白（例如 "sich vorbereiten"），先取最後一段
    const last = w.split(/\s+/).slice(-1)[0] || w;

    // 最長匹配優先
    const sorted = [...separablePrefixes].sort((a, b) => b.length - a.length);
    for (const p of sorted) {
      if (last.startsWith(p) && last.length > p.length + 1) return p;
    }
    return "";
  }

  // ✅ 改：不管後端 separable true/false 都做偵測（容錯）
  const detectedPrefix = useMemo(() => detectSeparablePrefix(baseForm), [
    baseForm,
    separablePrefixes,
  ]);

  // ✅ 改：有效可分判斷（後端誤標時也能補救）
  const effectiveSeparable = separable === true || !!detectedPrefix;

  const valenzText =
    Array.isArray(valenz) && valenz.length > 0
      ? valenz
          .map((v) => {
            const p = v?.prep || "";
            const k = v?.kasus || "";
            const n = v?.note || "";
            if (p && k) return `${p} + ${k}`;
            if (p) return p;
            if (k) return k;
            if (n) return n;
            return "";
          })
          .filter(Boolean)
          .join("；")
      : "";

  function splitSeparableFiniteForm(raw, prefix) {
    const s = (raw || "").trim();
    if (!s || !prefix) return { core: s, suffix: "" };

    const lower = s.toLowerCase();
    if (!lower.startsWith(prefix)) return { core: s, suffix: "" };

    const core = s.slice(prefix.length);
    if (!core) return { core: s, suffix: "" };

    return { core, suffix: prefix };
  }

  function injectReflexivePerfekt(raw, personKey) {
    const s = (raw || "").trim();
    if (!s) return s;

    const pron = reflexivePronounMap[personKey] || "";
    if (!pron) return s;

    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return `${s} ${pron}`.trim();

    const aux = parts[0];
    const rest = parts.slice(1).join(" ");
    return `${aux} ${pron} ${rest}`.trim();
  }

  function buildDisplayForm(personKey, rawValue) {
    const raw = (rawValue || "").trim();
    if (!raw) return "";

    const needsReflexive = reflexive === true;

    const needsSeparable =
      effectiveSeparable === true &&
      detectedPrefix &&
      (tense === "praesens" || tense === "praeteritum");

    if (tense === "perfekt") {
      if (!needsReflexive) return raw;
      return injectReflexivePerfekt(raw, personKey);
    }

    let core = raw;
    let suffix = "";
    if (needsSeparable) {
      const splitted = splitSeparableFiniteForm(raw, detectedPrefix);
      core = (splitted.core || "").trim();
      suffix = (splitted.suffix || "").trim();
    }

    const pron = needsReflexive ? reflexivePronounMap[personKey] || "" : "";
    const chunks = [core];
    if (pron) chunks.push(pron);
    if (suffix) chunks.push(suffix);

    return chunks.filter(Boolean).join(" ").trim();
  }

  function handleCellClick(personKey, rawValue) {
    const displayed = buildDisplayForm(personKey, rawValue);
    const trimmed = (displayed || "").trim();
    if (!trimmed) return;

    const next = { tense, personKey };
    setSelectedCell(next);

    if (typeof onSelectForm === "function") {
      onSelectForm({
        pos: "Verb",
        baseForm,
        tense,
        personKey,
        form: trimmed,
        verbSubtype: verbSubtype || "",
        separable: !!effectiveSeparable,
        reflexive: !!reflexive,
      });
    }

    // ✅ 點選後直接播放 TTS（德語）
    // ✅ er/sie/es 與 sie/Sie：只念下拉選到的單一主詞
    try {
      const subjectMap = {
        ich: ichLabel,
        du: duLabel,
        er_sie_es: thirdPerson,
        wir: wirLabel,
        ihr: ihrLabel,
        sie_Sie: siePerson,
      };

      const subjectText = (subjectMap[personKey] || "").trim();
      const spokenText = subjectText ? `${subjectText} ${trimmed}` : trimmed;

      playTTS(spokenText, "de-DE");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[WordPosInfoVerb] playTTS failed:", e);
    }
  }

  // raw forms
  const ichRaw = forms.ich || "";
  const duRaw = forms.du || "";
  const erSieEsRaw = forms.er_sie_es || "";
  const wirRaw = forms.wir || "";
  const ihrRaw = forms.ihr || "";
  const sieSieRaw = forms.sie_Sie || "";

  // display forms
  const ichDisplay = buildDisplayForm("ich", ichRaw);
  const duDisplay = buildDisplayForm("du", duRaw);
  const erSieEsDisplay = buildDisplayForm("er_sie_es", erSieEsRaw);
  const wirDisplay = buildDisplayForm("wir", wirRaw);
  const ihrDisplay = buildDisplayForm("ihr", ihrRaw);
  const sieSieDisplay = buildDisplayForm("sie_Sie", sieSieRaw);

  // -----------------------------
  // Step B：同義 / 反義 / 同字根（UI + click）
  // -----------------------------
  const recSynonyms = Array.isArray(recommendations?.synonyms)
    ? recommendations.synonyms
    : [];
  const recAntonyms = Array.isArray(recommendations?.antonyms)
    ? recommendations.antonyms
    : [];
  const recRootsRaw = Array.isArray(recommendations?.roots)
    ? recommendations.roots
    : [];

  const looksLikeVerbLemma = (s) => {
    const w = String(s || "").trim();
    if (!w) return false;

    if (/^sich\s+/i.test(w)) {
      const rest = w.replace(/^sich\s+/i, "").trim();
      return /^[A-Za-zÄÖÜäöüß]+(en|n)$/.test(rest);
    }

    if (!/^[A-Za-zÄÖÜäöüß]+$/.test(w)) return false;
    return /[A-Za-zÄÖÜäöüß]+(en|n)$/.test(w);
  };

  const allowShowRoots = useMemo(() => {
    if (effectiveSeparable) return true;

    const base = String(baseForm || "").trim().toLowerCase();
    if (!base) return false;

    return recRootsRaw.some((w) => {
      const t = String(w || "").trim().toLowerCase();
      return t && t !== base;
    });
  }, [effectiveSeparable, recRootsRaw, baseForm]);

  const recRoots = useMemo(() => {
    if (!allowShowRoots) return [];
    const uniq = [];
    const seen = new Set();

    for (const x of recRootsRaw) {
      const w = String(x || "").trim();
      if (!w) continue;
      if (!looksLikeVerbLemma(w)) continue;

      const key = w.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(w);
    }
    return uniq;
  }, [recRootsRaw, allowShowRoots]);

  const hasRecs =
    recSynonyms.length > 0 || recAntonyms.length > 0 || recRoots.length > 0;

  function handleRecClick(w) {
    const word = String(w || "").trim();
    if (!word) return;

    if (typeof onWordClick === "function") {
      onWordClick(word);
      return;
    }

    if (
      typeof window !== "undefined" &&
      typeof window.dispatchEvent === "function"
    ) {
      window.dispatchEvent(
        new CustomEvent("wordSearch", { detail: { text: word } })
      );
    }
  }

  if (typeof window !== "undefined") {
    window.__verbDebug = {
      ts: Date.now(),
      baseForm,
      tense,
      extraInfoKeys: extraInfo ? Object.keys(extraInfo) : [],
      recommendations,
      recSynonyms,
      recAntonyms,
      recRootsRaw,
      recRoots,
      effectiveSeparable,
      detectedPrefix,
      hasRecs,

      irregularType,
      irregular,
      irregularResolvedType,
      irregularBadgeText,
    };
  }

  // eslint-disable-next-line no-console
  console.log("[WordPosInfoVerb] baseForm =", baseForm);
  // eslint-disable-next-line no-console
  console.log(
    "[WordPosInfoVerb] extraInfoKeys =",
    extraInfo ? Object.keys(extraInfo) : []
  );
  
  const headerText = `${posLabel}｜${title}`;

  const ARROW_SIZE = 30;
  const HEADER_FONT_SIZE = 12;
  const HEADER_PADDING_Y = 7;
  const HEADER_PADDING_X = 10;

  const OuterBoxStyle = {
    marginTop: 8,
    border: "1px solid var(--border-subtle)",
    borderRadius: 0,
    background: "transparent",
    overflow: "hidden",
  };

  const HeaderRow = (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setIsOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setIsOpen((v) => !v);
          e.preventDefault();
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: `${HEADER_PADDING_Y}px ${HEADER_PADDING_X}px`,
        borderBottom: "1px solid var(--border-subtle)",
        background: "transparent",
        borderRadius: 0,
        cursor: "pointer",
        userSelect: "none",
        outline: "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 18,
          textAlign: "center",
          fontSize: ARROW_SIZE,
          lineHeight: 1,
          color: "var(--text-main)",
          opacity: 0.85,
        }}
      >
        {isOpen ? "▾" : "▸"}
      </span>

      <div
        style={{
          fontSize: HEADER_FONT_SIZE,
          fontWeight: 700,
          color: "var(--text-main)",
        }}
      >
        {headerText}
      </div>
    </div>
  );

  if (!isOpen) {
    return (
      <div style={OuterBoxStyle}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setIsOpen(true);
              e.preventDefault();
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: `${HEADER_PADDING_Y}px ${HEADER_PADDING_X}px`,
            borderBottom: "none",
            background: "transparent",
            cursor: "pointer",
            userSelect: "none",
            outline: "none",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 18,
              textAlign: "center",
              fontSize: ARROW_SIZE,
              lineHeight: 1,
              color: "var(--text-main)",
              opacity: 0.85,
            }}
          >
            {"▸"}
          </span>

          <div
            style={{
              fontSize: HEADER_FONT_SIZE,
              fontWeight: 700,
              color: "var(--text-main)",
            }}
          >
            {headerText}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={OuterBoxStyle}>
      {HeaderRow}

      <div
        style={{
          padding: 10,
          borderRadius: 0,
          backgroundColor: "var(--bg-card)",
          border: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-main)",
            }}
          >
            <span>
              {tenseSelectLabel}
              {colon}
            </span>
            <select
              value={tense}
              onChange={(e) => setTense(e.target.value)}
              style={{
                fontSize: 13,
                padding: "2px 6px",
                borderRadius: 0,
                border: "1px solid var(--border-subtle)",
                background: "transparent",
                color: "var(--text-main)",
              }}
            >
              <option value="praesens">{praesensLabel}</option>
              <option value="praeteritum">{praeteritumLabel}</option>
              <option value="perfekt">{perfektLabel}</option>
            </select>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              justifyContent: "flex-end",
              fontSize: 11,
            }}
          >
            {auxiliary && (
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 0,
                  backgroundColor: "var(--bg-soft)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                }}
              >
                {auxiliaryLabel}
                {colon}
                {auxiliary}
              </span>
            )}

            {/* ✅ 多國一致性：不顯示「不規則」badge（邏輯仍保留） */}
            {false && irregularBadgeText && (
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 0,
                  backgroundColor: "var(--bg-soft)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                }}
              >
                {irregularBadgeText}
              </span>
            )}

            {/* ✅ 若未來要顯示 subtype（目前原檔沒顯示，保留計算結果不動） */}
            {false && subtypeText && (
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 0,
                  backgroundColor: "var(--bg-soft)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                }}
              >
                {subtypeLabel}
                {colon}
                {subtypeText}
              </span>
            )}
          </div>
        </div>

        {valenzText && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            <strong>
              {valenzLabel}
              {colon}
            </strong>
            <span>{valenzText}</span>
          </div>
        )}

        <div
          style={{
            padding: 8,
            borderRadius: 0,
            backgroundColor: "var(--bg-soft)",
            border: "1px solid var(--border-subtle)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            columnGap: 8,
            rowGap: 4,
          }}
        >
          <ConjugationCell
            label={ichLabel}
            value={ichDisplay || noFormText}
            hasValue={!!ichDisplay}
            isSelected={isSelected("ich")}
            onClick={() => handleCellClick("ich", ichRaw)}
          />
          <ConjugationCell
            label={duLabel}
            value={duDisplay || noFormText}
            hasValue={!!duDisplay}
            isSelected={isSelected("du")}
            onClick={() => handleCellClick("du", duRaw)}
          />

          <ConjugationCell
            label={
              <select
                value={thirdPerson}
                onChange={(e) => setThirdPerson(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={subjectSelectStyle}
                aria-label={erSieEsLabel}
              >
                <option value="er">er</option>
                <option value="sie">sie</option>
                <option value="es">es</option>
              </select>
            }
            value={erSieEsDisplay || noFormText}
            hasValue={!!erSieEsDisplay}
            isSelected={isSelected("er_sie_es")}
            onClick={() => handleCellClick("er_sie_es", erSieEsRaw)}
          />

          <ConjugationCell
            label={wirLabel}
            value={wirDisplay || noFormText}
            hasValue={!!wirDisplay}
            isSelected={isSelected("wir")}
            onClick={() => handleCellClick("wir", wirRaw)}
          />

          <ConjugationCell
            label={ihrLabel}
            value={ihrDisplay || noFormText}
            hasValue={!!ihrDisplay}
            isSelected={isSelected("ihr")}
            onClick={() => handleCellClick("ihr", ihrRaw)}
          />

          <ConjugationCell
            label={
              <select
                value={siePerson}
                onChange={(e) => setSiePerson(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={subjectSelectStyle}
                aria-label={sieSieLabel}
              >
                <option value="sie">sie</option>
                <option value="Sie">Sie</option>
              </select>
            }
            value={sieSieDisplay || noFormText}
            hasValue={!!sieSieDisplay}
            isSelected={isSelected("sie_Sie")}
            onClick={() => handleCellClick("sie_Sie", sieSieRaw)}
          />
        </div>

        {!hasRecs && (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "var(--text-muted)",
              opacity: 0.85,
            }}
          >
            {debugMissingRecs}
          </div>
        )}

        {hasRecs && (
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              {recTitle}
            </div>

            <RecRow
              label={recSynLabel}
              items={recSynonyms}
              onClick={handleRecClick}
            />
            <RecRow
              label={recAntLabel}
              items={recAntonyms}
              onClick={handleRecClick}
            />
            <RecRow
              label={recRootLabel}
              items={recRoots}
              onClick={handleRecClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RecRow({ label, items, onClick }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 6,
      }}
    >
      <div
        style={{
          width: 56,
          fontSize: 12,
          color: "var(--text-muted)",
          paddingTop: 2,
        }}
      >
        {label}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((w) => (
          <button
            key={String(w)}
            type="button"
            onClick={() => onClick && onClick(w)}
            style={{
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-main)",
              borderRadius: 0,
              padding: "3px 8px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {String(w)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConjugationCell({ label, value, hasValue, isSelected, onClick }) {
  const baseStyle = {
    borderRadius: 0,
    padding: "6px 8px",
    backgroundColor: "transparent",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    boxSizing: "border-box",
    transition:
      "background-color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
    fontWeight: 700,
  };

  const finalStyle = {
    ...baseStyle,
    border: isSelected
      ? "2px solid var(--border-strong)"
      : "1px solid transparent",
    backgroundColor: isSelected ? "var(--bg-elevated)" : "transparent",
    cursor: hasValue ? "pointer" : "default",
    opacity: hasValue ? 1 : 0.55,
  };

  return (
    <div style={finalStyle} onClick={hasValue ? onClick : undefined}>
      <span
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: 14,
          color: "var(--text-main)",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}
// frontend/src/components/WordPosInfoVerb.jsx
