// frontend/src/components/posInfo/WordPosInfoNoun.jsx
import { playTTS } from "../../utils/ttsClient";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { genderColors } from "../../utils/wordCardConfig";
import {
  POSSESSIVE_STEMS,
  CASE_KEYS,
  getMiniCaseTableForGender,
} from "../../utils/nounCaseTables";
import NounHeaderRow from "./noun/NounHeaderRow";
import NounCaseTable from "./noun/NounCaseTable";

/**
 * 名詞格表（兩欄：Active + Reference）
 */

function makeGenitiveForm(noun, gender) {
  if (!noun) return "";
  if (gender === "die") return noun;
  const lower = noun.toLowerCase();
  const last = lower[lower.length - 1] || "";
  const vowels = "aeiouyäöü";
  if (vowels.includes(last)) return noun + "s";
  return noun + "es";
}

function addDativePluralN(pluralNoun) {
  if (!pluralNoun) return "";
  const lower = pluralNoun.toLowerCase();
  if (lower.endsWith("n") || lower.endsWith("s")) return pluralNoun;
  return pluralNoun + "n";
}

const PERSON_LABEL_DE = {
  ich: "ich",
  du: "du",
  er: "er",
  sie: "sie",
  es: "es",
  wir: "wir",
  ihr: "ihr",
  Sie: "Sie",
};

function getPossKeys() {
  const arr = Object.values(POSSESSIVE_STEMS || {})
    .map((p) => p.key)
    .filter(Boolean);
  const fallback = ["ich", "du", "er", "sie", "es", "wir", "ihr", "Sie"];
  const merged = arr.length ? arr : fallback;
  return Array.from(new Set(merged));
}

function getPossStemByKey(personKey) {
  const arr = Object.values(POSSESSIVE_STEMS || {});
  const found = arr.find((p) => p.key === personKey);
  return found?.stem || found?.base || found?.value || "";
}

function buildPossessivePluralForms(personKey) {
  const rawStem = getPossStemByKey(personKey) || "";
  if (!rawStem) return { Nom: "", Akk: "", Dat: "", Gen: "" };
  const stem = rawStem.toLowerCase() === "euer" ? "eur" : rawStem;
  return {
    Nom: `${stem}e`,
    Akk: `${stem}e`,
    Dat: `${stem}en`,
    Gen: `${stem}er`,
  };
}

function toKeinForm(einForm) {
  const s = (einForm || "").trim();
  if (!s) return "";
  if (s.startsWith("ein")) return "k" + s;
  return s;
}

function getDerWordDeterminer({ type, numberMode, gender, caseKey }) {
  const g =
    gender === "der"
      ? "m"
      : gender === "die"
      ? "f"
      : gender === "das"
      ? "n"
      : "m";
  const stem = type === "dies" ? "dies" : "welch";

  if (numberMode === "pl") {
    if (caseKey === "Nom") return `${stem}e`;
    if (caseKey === "Akk") return `${stem}e`;
    if (caseKey === "Dat") return `${stem}en`;
    if (caseKey === "Gen") return `${stem}er`;
    return "";
  }

  if (caseKey === "Nom") {
    if (g === "m") return `${stem}er`;
    if (g === "f") return `${stem}e`;
    if (g === "n") return `${stem}es`;
    return "";
  }

  if (caseKey === "Akk") {
    if (g === "m") return `${stem}en`;
    if (g === "f") return `${stem}e`;
    if (g === "n") return `${stem}es`;
    return "";
  }

  if (caseKey === "Dat") {
    if (g === "m") return `${stem}em`;
    if (g === "f") return `${stem}er`;
    if (g === "n") return `${stem}em`;
    return "";
  }

  if (caseKey === "Gen") {
    if (g === "m") return `${stem}es`;
    if (g === "f") return `${stem}er`;
    if (g === "n") return `${stem}es`;
    return "";
  }

  return "";
}

function getPluralArticleDef(caseKey) {
  if (caseKey === "Nom") return "die";
  if (caseKey === "Akk") return "die";
  if (caseKey === "Dat") return "den";
  if (caseKey === "Gen") return "der";
  return "";
}

function getPluralArticleKein(caseKey) {
  if (caseKey === "Nom") return "keine";
  if (caseKey === "Akk") return "keine";
  if (caseKey === "Dat") return "keinen";
  if (caseKey === "Gen") return "keiner";
  return "";
}

function getReferenceDetByActiveTab(activeTab, numberMode) {
  if (numberMode === "pl" && activeTab === "kein") return "def";

  if (activeTab === "def") return "ein";
  if (activeTab === "ein") return "def";
  if (activeTab === "kein") return "ein";
  if (activeTab === "poss") return "kein";
  if (activeTab === "dies") return "def";
  if (activeTab === "welch") return "def";
  return "def";
}

export default function WordPosInfoNoun({
  gender,
  baseForm,
  labels = {},
  onSelectForm,
}) {
  const noun = (baseForm || "").trim();
  if (!gender || !noun) return null;

  // uiLang
  // ✅ Strict mode：本檔不做任何 fallback / 文案判斷
  // 只吃上層注入的 labels；缺值一律顯示 "—"
  const L = (v) => (typeof v === "string" && v.trim() ? v : "—");

  const caseTableTitle = L(labels.caseTableTitle);

  const caseNom = L(labels.caseNom);
  const caseAkk = L(labels.caseAkk);
  const caseDat = L(labels.caseDat);
  const caseGen = L(labels.caseGen);

  const btnPlural = L(labels.btnPlural);
  const btnClear = L(labels.btnClear);

  const headerActiveByType = {
    def: L(labels.headerActiveDef),
    ein: L(labels.headerActiveEin),
    kein: L(labels.headerActiveKein),
    poss: L(labels.headerActivePoss),
    welch: L(labels.headerActiveWelch),
    dies: L(labels.headerActiveDies),
  };

  const headerReferenceByType = {
    def: L(labels.headerReferenceDef),
    ein: L(labels.headerReferenceEin),
    kein: L(labels.headerReferenceKein),
    poss: L(labels.headerReferencePoss),
    welch: L(labels.headerReferenceWelch),
    dies: L(labels.headerReferenceDies),
  };

  const nounPosLabel = L(labels.nounPosLabel);
  const singularLabel = L(labels.singularLabel);
  const pluralLabel = L(labels.pluralLabel);
  const refShortDef = L(labels.refShortDef);
  const refShortIndef = L(labels.refShortIndef);

  const nounPlural = (labels.nounPlural || "").trim();
  const genderKey =
    gender === "der"
      ? "m"
      : gender === "die"
      ? "f"
      : gender === "das"
      ? "n"
      : "m";

  const baseArticleColor = genderColors[gender] || "var(--text-main)";
  const genForm = makeGenitiveForm(noun, gender);

  const [numberMode, setNumberMode] = useState("sg");
  const [activeTab, setActiveTab] = useState("def");
  const referenceDet = getReferenceDetByActiveTab(activeTab, numberMode);

  const [personKey, setPersonKey] = useState("ich");
  const [selectedCell, setSelectedCell] = useState(null);

  const [isOpen, setIsOpen] = useState(true);

  const [showPossPicker, setShowPossPicker] = useState(false);
  const possPrevKeyRef = useRef("ich");
  const possKeys = useMemo(() => getPossKeys(), []);
  const [possCursor, setPossCursor] = useState(0);

  const [focusedKey, setFocusedKey] = useState(null);
  const tabRefs = useRef({});
  const possOptionRefs = useRef([]);

  const rootRef = useRef(null);

  const possPluralForms = useMemo(
    () => buildPossessivePluralForms(personKey),
    [personKey]
  );

  const miniTableRows = getMiniCaseTableForGender(genderKey, personKey);

  useEffect(() => {
    setSelectedCell(null);
  }, [activeTab, numberMode, personKey]);

  useEffect(() => {
    if (activeTab !== "poss") setShowPossPicker(false);
  }, [activeTab]);

  useEffect(() => {
    if (!showPossPicker) return;
    const idx = possKeys.indexOf(personKey);
    setPossCursor(idx >= 0 ? idx : 0);
  }, [showPossPicker, personKey, possKeys]);

  useEffect(() => {
    if (!showPossPicker) return;
    requestAnimationFrame(() => {
      possOptionRefs.current[possCursor]?.focus?.();
      setFocusedKey(`poss:${possCursor}`);
    });
  }, [showPossPicker, possCursor]);

  function isDetTypeAvailableInNumber(detType) {
    if (numberMode === "sg") return true;
    if (detType === "ein") return false;
    return true;
  }

  function getNounForDisplay(caseKey) {
    if (numberMode === "sg") {
      if (caseKey === "Gen" && (gender === "der" || gender === "das"))
        return genForm;
      return noun;
    }
    if (!nounPlural) return "—";
    if (caseKey === "Dat") return addDativePluralN(nounPlural);
    return nounPlural;
  }

  function getArticleForCell(caseKey, detType, row) {
    if (numberMode === "sg") {
      if (detType === "def") return (row.definite || "").trim();
      if (detType === "ein") return (row.indefinite || "").trim();
      if (detType === "kein") return toKeinForm((row.indefinite || "").trim());
      if (detType === "poss") return (row.possessive || "").trim();
      if (detType === "dies")
        return getDerWordDeterminer({
          type: "dies",
          numberMode,
          gender,
          caseKey,
        });
      if (detType === "welch")
        return getDerWordDeterminer({
          type: "welch",
          numberMode,
          gender,
          caseKey,
        });
      return "";
    }

    if (detType === "def") return getPluralArticleDef(caseKey);
    if (detType === "kein") return getPluralArticleKein(caseKey);
    if (detType === "poss") return (possPluralForms[caseKey] || "").trim();
    if (detType === "dies")
      return getDerWordDeterminer({ type: "dies", numberMode, gender, caseKey });
    if (detType === "welch")
      return getDerWordDeterminer({
        type: "welch",
        numberMode,
        gender,
        caseKey,
      });
    return "";
  }

  function handleSelectCell(caseKey, columnType, row) {
    if (columnType === "reference") return;
    if (!isDetTypeAvailableInNumber(activeTab)) return;

    setSelectedCell({ caseKey, column: columnType });

    const articleForm = getArticleForCell(caseKey, activeTab, row);
    const nounForm = getNounForDisplay(caseKey);

    const surface =
      !articleForm || articleForm === "-"
        ? nounForm
        : `${articleForm} ${nounForm}`;

    playTTS(surface, "de-DE");

    if (typeof onSelectForm === "function") {
      onSelectForm({
        pos: "noun",
        surface,
        noun: {
          base: noun,
          gender,
          number: numberMode,
          pluralBase: nounPlural || null,

          case: caseKey,
          determinerType: activeTab,
          article: articleForm || null,
          personKey: activeTab === "poss" ? personKey : null,
        },
      });
    }
  }

  function handleClearSelectionOnly() {
    setSelectedCell(null);
    if (typeof onSelectForm === "function") onSelectForm(null);
  }

  function togglePlural() {
    setNumberMode((m) => (m === "sg" ? "pl" : "sg"));
    if (numberMode === "sg" && activeTab === "ein") {
      setActiveTab("def");
      requestAnimationFrame(() => {
        tabRefs.current["def"]?.focus?.();
        setFocusedKey("def");
      });
    }
  }

  function openPossPicker() {
    possPrevKeyRef.current = personKey;
    setShowPossPicker(true);
  }

  function closePossPickerCommit() {
    const nextKey = possKeys[possCursor] || personKey;
    setPersonKey(nextKey);
    setShowPossPicker(false);
    requestAnimationFrame(() => {
      tabRefs.current["poss"]?.focus?.();
      setFocusedKey("poss");
    });
  }

  function closePossPickerCancel() {
    setPersonKey(possPrevKeyRef.current || personKey);
    setShowPossPicker(false);
    requestAnimationFrame(() => {
      tabRefs.current["poss"]?.focus?.();
      setFocusedKey("poss");
    });
  }

  const resolvedCaseLabels = {
    Nom: caseNom,
    Akk: caseAkk,
    Dat: caseDat,
    Gen: caseGen,
  };

  const TAB_ORDER = ["def", "ein", "kein", "poss", "welch", "dies"];

  function focusTab(key) {
    requestAnimationFrame(() => {
      tabRefs.current[key]?.focus?.();
      setFocusedKey(key);
    });
  }

  function setActiveTabAndFocus(key) {
    setActiveTab(key);
    focusTab(key);
  }

  function nextTabKey(currentKey, dir) {
    let idx = TAB_ORDER.indexOf(currentKey);
    if (idx < 0) idx = 0;

    for (let i = 0; i < TAB_ORDER.length; i++) {
      idx = (idx + dir + TAB_ORDER.length) % TAB_ORDER.length;
      const next = TAB_ORDER[idx];
      if (numberMode === "pl" && next === "ein") continue;
      return next;
    }
    return currentKey;
  }

  function handleKeyDownCapture(e) {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " ") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (activeTab === "poss" && showPossPicker) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const dir = e.key === "ArrowDown" ? 1 : -1;
        setPossCursor((c) => {
          const len = possKeys.length || 1;
          const next = (c + dir + len) % len;
          return next;
        });
        e.preventDefault();
        return;
      }

      if (e.key === "Enter") {
        closePossPickerCommit();
        e.preventDefault();
        return;
      }

      if (e.key === "Escape") {
        closePossPickerCancel();
        e.preventDefault();
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        return;
      }

      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = nextTabKey(activeTab, dir);

      setActiveTab(next);
      focusTab(next);

      e.preventDefault();
      return;
    }

    if (activeTab === "poss" && (e.key === "Enter" || e.key === "ArrowDown")) {
      openPossPicker();
      e.preventDefault();
      return;
    }
  }

  const tabBtnStyle = (isActive, isFocused, isDisabled = false) => ({
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    cursor: isDisabled ? "not-allowed" : "pointer",
    border: isActive
      ? "1px solid var(--border-strong)"
      : "1px solid var(--border-subtle)",
    background: isActive ? "var(--bg-elevated)" : "transparent",
    color: isActive ? "var(--text-main)" : "var(--text-muted)",
    fontWeight: isActive ? 700 : 500,
    opacity: isDisabled ? 0.5 : 1,
    boxShadow: isFocused ? "0 0 0 2px var(--text-main)" : "none",
    outline: "none",
  });

  const controlBtnStyle = (isActive, isFocused) => ({
    ...tabBtnStyle(isActive, isFocused, false),
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    borderRadius: 0,
  });

  const activeHeaderLabel = headerActiveByType[activeTab] || "—";
  const headerReference = headerReferenceByType[referenceDet] || "—";

  const posLabel = nounPosLabel;
  const numLabel = numberMode === "pl" ? pluralLabel : singularLabel;
  const refLabelShort = referenceDet === "ein" ? refShortIndef : refShortDef;

  const headerText = `${posLabel}｜${caseTableTitle}  `;

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

  if (!isOpen) {
    return (
      <div
        ref={rootRef}
        tabIndex={0}
        onKeyDownCapture={handleKeyDownCapture}
        style={{
          ...OuterBoxStyle,
        }}
      >
        <NounHeaderRow
          isOpen={false}
          headerText={headerText}
          onToggle={() => setIsOpen(true)}
          arrowSize={ARROW_SIZE}
          headerFontSize={HEADER_FONT_SIZE}
          paddingY={HEADER_PADDING_Y}
          paddingX={HEADER_PADDING_X}
          showBottomDivider={false}
        />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDownCapture={handleKeyDownCapture}
      style={OuterBoxStyle}
    >
      <NounHeaderRow
        isOpen={true}
        headerText={headerText}
        onToggle={() => setIsOpen((v) => !v)}
        arrowSize={ARROW_SIZE}
        headerFontSize={HEADER_FONT_SIZE}
        paddingY={HEADER_PADDING_Y}
        paddingX={HEADER_PADDING_X}
        showBottomDivider={true}
      />

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
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              ref={(el) => (tabRefs.current["def"] = el)}
              type="button"
              onClick={() => setActiveTabAndFocus("def")}
              onFocus={() => setFocusedKey("def")}
              style={tabBtnStyle(activeTab === "def", focusedKey === "def")}
            >
              der
            </button>

            <button
              ref={(el) => (tabRefs.current["ein"] = el)}
              type="button"
              disabled={numberMode === "pl"}
              aria-disabled={numberMode === "pl"}
              onClick={() => {
                if (numberMode === "pl") return;
                setActiveTabAndFocus("ein");
              }}
              onFocus={() => setFocusedKey("ein")}
              style={tabBtnStyle(
                activeTab === "ein",
                focusedKey === "ein",
                numberMode === "pl"
              )}
              title={""}
            >
              ein
            </button>

            <button
              ref={(el) => (tabRefs.current["kein"] = el)}
              type="button"
              onClick={() => setActiveTabAndFocus("kein")}
              onFocus={() => setFocusedKey("kein")}
              style={tabBtnStyle(activeTab === "kein", focusedKey === "kein")}
            >
              kein
            </button>

            <div style={{ position: "relative", display: "inline-flex" }}>
              <button
                ref={(el) => (tabRefs.current["poss"] = el)}
                type="button"
                onClick={() => {
                  if (activeTab !== "poss") {
                    setActiveTabAndFocus("poss");
                    return;
                  }
                  if (!showPossPicker) openPossPicker();
                  else closePossPickerCancel();
                }}
                onFocus={() => setFocusedKey("poss")}
                style={tabBtnStyle(activeTab === "poss", focusedKey === "poss")}
                title={""}
              >
                mein{" "}
                {activeTab === "poss"
                  ? `(${PERSON_LABEL_DE[personKey] || personKey})`
                  : ""}
                {activeTab === "poss" && (
                  <span
                    aria-hidden="true"
                    style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}
                  >
                    {showPossPicker ? "▲▼" : "▼"}
                  </span>
                )}
              </button>

              {activeTab === "poss" && showPossPicker && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: "100%",
                    marginBottom: 6,
                    zIndex: 50,
                    padding: 6,
                    borderRadius: 0,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                    minWidth: 140,
                  }}
                >
                  <div style={{ display: "grid", rowGap: 6 }}>
                    {possKeys.map((k, idx) => {
                      const isCurrent = idx === possCursor;
                      const isFocused = focusedKey === `poss:${idx}`;
                      return (
                        <button
                          key={k}
                          ref={(el) => (possOptionRefs.current[idx] = el)}
                          type="button"
                          tabIndex={isCurrent ? 0 : -1}
                          onFocus={() => setFocusedKey(`poss:${idx}`)}
                          onClick={() => {
                            setPossCursor(idx);
                            setPersonKey(k);
                            setShowPossPicker(false);
                            requestAnimationFrame(() => {
                              tabRefs.current["poss"]?.focus?.();
                              setFocusedKey("poss");
                            });
                          }}
                          style={{
                            ...tabBtnStyle(isCurrent, isFocused),
                            width: "100%",
                            justifyContent: "center",
                            textAlign: "center",
                            borderRadius: 0,
                          }}
                        >
                          {PERSON_LABEL_DE[k] || k}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              ref={(el) => (tabRefs.current["welch"] = el)}
              type="button"
              onClick={() => setActiveTabAndFocus("welch")}
              onFocus={() => setFocusedKey("welch")}
              style={tabBtnStyle(activeTab === "welch", focusedKey === "welch")}
            >
              welch
            </button>

            <button
              ref={(el) => (tabRefs.current["dies"] = el)}
              type="button"
              onClick={() => setActiveTabAndFocus("dies")}
              onFocus={() => setFocusedKey("dies")}
              style={tabBtnStyle(activeTab === "dies", focusedKey === "dies")}
            >
              dies
            </button>
          </div>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              flexWrap: "nowrap",
              alignItems: "center",
            }}
          >
            <button
              ref={(el) => (tabRefs.current["__plural__"] = el)}
              type="button"
              onClick={togglePlural}
              onFocus={() => setFocusedKey("__plural__")}
              style={{
                ...controlBtnStyle(
                  numberMode === "pl",
                  focusedKey === "__plural__"
                ),
                background:
                  numberMode === "pl" ? "var(--bg-elevated)" : "transparent",
              }}
              title={caseTableTitle}
            >
              <span aria-hidden="true">⇆</span>
              <span>{btnPlural}</span>
            </button>

            {selectedCell && (
              <button
                ref={(el) => (tabRefs.current["__clear__"] = el)}
                type="button"
                onClick={handleClearSelectionOnly}
                onFocus={() => setFocusedKey("__clear__")}
                style={controlBtnStyle(false, focusedKey === "__clear__")}
              >
                <span aria-hidden="true">⟲</span>
                <span>{btnClear}</span>
              </button>
            )}
          </div>
        </div>

        <NounCaseTable
          CASE_KEYS={CASE_KEYS}
          miniTableRows={miniTableRows}
          resolvedCaseLabels={resolvedCaseLabels}
          activeHeaderLabel={activeHeaderLabel}
          headerReference={headerReference}
          activeTab={activeTab}
          referenceDet={referenceDet}
          numberMode={numberMode}
          baseArticleColor={baseArticleColor}
          selectedCell={selectedCell}
          isDetTypeAvailableInNumber={isDetTypeAvailableInNumber}
          getNounForDisplay={getNounForDisplay}
          getArticleForCell={getArticleForCell}
          onSelectCell={handleSelectCell}
        />
      </div>
    </div>
  );
}
// frontend/src/components/posInfo/WordPosInfoNoun.jsx
