// frontend/src/components/WordDefinitionBlock.jsx

import {
  normalizeDefinitionList,
  normalizeDefinitionDe,
  normalizeDefinitionDeTranslation,
  splitTextTokens,
  isLikelyGermanWord,
} from "../../../utils/wordCardRender";

import { playTTS } from "../../../utils/ttsClient";

function WordDefinitionBlock({
  d,
  labelDefinition,
  onWordClick,
  senseIndex,
  onSenseChange,
}) {
  if (!d) return null;

  // 中文釋義（多義）
  const definitionList = normalizeDefinitionList(d.definition);

  // Definition (DE)
  const definitionDeList = normalizeDefinitionDe(d.definition_de);
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
                : `義項 ${idx + 1}`;

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
              gap: 6,
            }}
          >
            <span>Definition (DE)：</span>

            <button
              className="icon-button sound-button"
              onClick={() => playTTS(currentDe, "de-DE")}
              title="播放德語釋義"
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
