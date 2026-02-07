// frontend/src/components/word/definition/WordDefinitionBlock.jsx

import {
  normalizeDefinitionList,
  normalizeDefinitionDe,
  normalizeDefinitionDeTranslation,
  splitTextTokens,
  isLikelyGermanWord,
} from "../../../utils/wordCardRender";

import { playTTS } from "../../../utils/ttsClient";

import uiText from "../../../uiText";

// =========================
// FlagIcon（純 UI / 行為元件，無語言責任）
// - 以 currentColor 上色，暗亮版跟著 CSS var 走
// - aria-label / title 由外層傳入
// =========================
function ReportFlagIcon({ onClick, title, ariaLabel, disabled }) {
  const color = disabled ? "var(--text-muted)" : "var(--text-muted)";
  return (
    <button
      type="button"
      onClick={(e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        if (disabled) return;
        if (typeof onClick === "function") onClick(e);
      }}
      aria-label={ariaLabel}
      title={title}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 0.95,
        pointerEvents: disabled ? "none" : "auto",
        userSelect: "none",
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* pole */}
        <path d="M6 3v18" />
        {/* flag */}
        <path d="M6 4h11l-2 4 2 4H6" />
      </svg>
    </button>
  );
}

function WordDefinitionBlock({
  d,
  labelDefinition,
  uiLang,
  onWordClick,
  senseIndex,
  onSenseChange,

  // ✅ 2026-01-12：Phase X（問題回報入口）— 定義行尾端旗子按鈕（需要登入才顯示）
  // - responsibility: WordDefinitionBlock 只負責「入口位置」與「popover UI」呈現
  // - state/submit 邏輯仍由上層 WordCard 控制並傳入（避免多處重複）
  canReportIssue,
  reportIssueHint,
  reportIssueOpen,
  setReportIssueOpen,
  reportIssueTitle,
  reportIssueCloseLabel,
  reportIssueCategoryLabel,
  reportIssueCategory,
  setReportIssueCategory,
  reportIssueCategories,
  reportIssueSubmitLabel,
  reportIssueCancelLabel,
  onSubmitReportIssue,
}) {
  if (!d) return null;

  // ✅ 2026-01-12: i18n glue (avoid hard-coded strings in this block)
  // - prefer explicit uiLang
  // - fallback: infer from labelDefinition (which is already localized by WordCard/uiText)
  const __resolvedUiLang = (() => {
    if (typeof uiLang === "string" && uiLang) return uiLang;
    const ld = typeof labelDefinition === "string" ? labelDefinition.trim() : "";
    if (!ld) return "zh-TW";
    try {
      const langs = Object.keys(uiText || {});
      for (const k of langs) {
        const v = uiText?.[k]?.wordCard?.labelDefinition;
        if (typeof v === "string" && v.trim() === ld) return k;
      }
    } catch (e) {}
    // heuristic fallback
    if (ld.includes("释义")) return "zh-CN";
    if (ld.includes("釋義")) return "zh-TW";
    return "zh-TW";
  })();

  const t = uiText?.[__resolvedUiLang]?.wordCard || {};
  const definitionDeLabel = typeof t.definitionDeLabel === "string" && t.definitionDeLabel
    ? t.definitionDeLabel
    : "Definition (DE)";
  const definitionDeTtsTitle = typeof t.definitionDeTtsTitle === "string" && t.definitionDeTtsTitle
    ? t.definitionDeTtsTitle
    : "Play German definition";
  const senseFallbackPrefix = typeof t.senseFallbackPrefix === "string" && t.senseFallbackPrefix
    ? t.senseFallbackPrefix
    : "Sense";

  // 中文釋義（多義）
  const definitionList = normalizeDefinitionList(d.definition);

  // Definition (DE)
  const rawDefinitionDe = d.definition_de;
  let definitionDeList = normalizeDefinitionDe(rawDefinitionDe);

  // ✅ 2026-01-12: robustness (avoid DE block disappearing if backend returns a format
  // that normalizeDefinitionDe doesn't recognize yet)
  if (definitionDeList.length === 0 && rawDefinitionDe) {
    if (Array.isArray(rawDefinitionDe)) {
      const xs = rawDefinitionDe
        .map((x) => (typeof x === "string" ? x.trim() : String(x || "").trim()))
        .filter(Boolean);
      if (xs.length > 0) definitionDeList = xs;
    } else if (typeof rawDefinitionDe === "string") {
      const s = rawDefinitionDe.trim();
      if (s) definitionDeList = [s];
    } else {
      const s = String(rawDefinitionDe || "").trim();
      if (s) definitionDeList = [s];
    }
  }
  let definitionDeTransList = normalizeDefinitionDeTranslation(
    d.definition_de_translation
  );

  // fallback: 若後端沒給 definition_de_translation，就用 definition
  if (definitionDeTransList.length === 0) {
    const fb = Array.isArray(d.definition)
      ? d.definition.join("；")
      : d.definition || "";
    if (fb) definitionDeTransList = [fb];
  }

  const getDefinitionDeHint = (index) => {
    if (definitionDeTransList.length === 0) return "";
    if (definitionDeTransList.length === 1) return definitionDeTransList[0];
    return definitionDeTransList[index] || definitionDeTransList[0];
  };

  const isZhUI =
    typeof labelDefinition === "string" &&
    (labelDefinition.includes("釋義") || labelDefinition.includes("释义"));

  const hasChineseChar = (str) => /[\u4e00-\u9fff]/.test(str || "");

  const getSenseLabelSource = (index) => {
    const fromList = definitionList[index];
    const fromTrans = getDefinitionDeHint(index);

    if (isZhUI) {
      if (typeof fromList === "string" && hasChineseChar(fromList))
        return fromList;
      if (typeof fromTrans === "string" && hasChineseChar(fromTrans))
        return fromTrans;
      if (typeof fromList === "string") return fromList;
      if (typeof fromTrans === "string") return fromTrans;
      return "";
    }

    if (typeof fromList === "string" && fromList.trim()) return fromList;
    if (typeof fromTrans === "string" && fromTrans.trim()) return fromTrans;
    return "";
  };

  // clickable tokens
  const buildClickableTokens = (text, hoverHint) => {
    if (!text) return null;
    const tokens = splitTextTokens(text);

    return tokens.map((tok, idx) => {
      const clean = tok.trim();

      if (!clean || !isLikelyGermanWord(clean)) {
        return <span key={idx}>{tok}</span>;
      }

      return (
        <span
          key={idx}
          onClick={() => onWordClick(clean)}
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

  const hasAnySense =
    definitionList.length > 0 ||
    definitionDeList.length > 0 ||
    definitionDeTransList.length > 0;

  if (!hasAnySense) return null;

  const senseCount = Math.max(
    definitionList.length,
    definitionDeList.length,
    definitionDeTransList.length
  );

  const safeIndex =
    typeof senseIndex === "number" && senseIndex < senseCount
      ? senseIndex
      : 0;

  const currentDe =
    definitionDeList[safeIndex] || definitionDeList[0] || "";
  const currentDeHint = getDefinitionDeHint(safeIndex);

  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥"];

  return (
    <div style={{ marginBottom: 8 }}>
      {/* 釋義列 */}
      <div
        style={{
          marginBottom: 4,
          fontSize: 15,
        }}
      >
        <strong style={{ fontSize: 15 }}>{labelDefinition}：</strong>

        {senseCount > 0 &&
          Array.from({ length: senseCount }).map((_, idx) => {
            const labelSource = getSenseLabelSource(idx);
            const labelText =
              typeof labelSource === "string" && labelSource.trim()
                ? labelSource.trim()
                : `${senseFallbackPrefix} ${idx + 1}`;

            const shortLabel = labelText;
            const isActive = idx === safeIndex;
            const numLabel = circledNumbers[idx] || `${idx + 1}.`;

            return (
              <span
                key={idx}
                style={{
                  marginLeft: idx === 0 ? 4 : 6,
                  fontSize: 15,
                  color: "var(--text-main)",
                }}
              >
                <span
                  onClick={() => onSenseChange(idx)}
                  style={{
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: isActive ? 700 : 500,
                    textDecoration: isActive ? "underline" : "none",
                  }}
                >
                  {numLabel} {shortLabel}
                </span>
                {idx < senseCount - 1 && <span>；</span>}
              </span>
            );
          })}
      </div>

      {/* Definition (DE) 區塊 */}
      {currentDe && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          {/* 標題 + 播放按鈕（顏色統一版） */}
          <div
            style={{
              marginBottom: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
              position: "relative",
            }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>{definitionDeLabel}：</span>

              <button
              className="icon-button sound-button"
              onClick={() => playTTS(currentDe, "de-DE")}
              title={definitionDeTtsTitle}
            >
              <svg
                className="sound-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 外圈圓形 */}
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                {/* 置中的三角形 */}
                <polygon points="10,8 10,16 16,12" />
              </svg>
            </button>
            </div>


            {/* 🚩 問題回報入口已移到 ResultPanel 的「清除該筆紀錄」左側（2026-02-07） */}

          </div>

          {/* 主體文字，可點擊 */}
          <div style={{ color: "var(--text-main)", lineHeight: 1.4 }}>
            {buildClickableTokens(currentDe, currentDeHint)}
          </div>
        </div>
      )}
    </div>
  );
}

export default WordDefinitionBlock;
