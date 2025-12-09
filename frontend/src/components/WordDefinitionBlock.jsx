// frontend/src/components/WordDefinitionBlock.jsx

import {
  normalizeDefinitionList,
  normalizeDefinitionDe,
  normalizeDefinitionDeTranslation,
  splitTextTokens,
  isLikelyGermanWord,
} from "../utils/wordCardRender";

function WordDefinitionBlock({
  d,
  labelDefinition,
  onWordClick,
  onSpeak,
  senseIndex,
  onSenseChange,
}) {
  if (!d) return null;

  // 中文釋義：多義拆分（單字的簡單翻譯）
  const definitionList = normalizeDefinitionList(d.definition);

  // Definition (DE)：多義（德語釋義本體）
  const definitionDeList = normalizeDefinitionDe(d.definition_de);
  let definitionDeTransList = normalizeDefinitionDeTranslation(
    d.definition_de_translation
  );

  // 若後端沒給 definition_de_translation，就用 definition 當 fallback
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

  // ★ 目前 UI 是否為中文
  const isZhUI =
    typeof labelDefinition === "string" &&
    (labelDefinition.includes("釋義") || labelDefinition.includes("释义"));

  // ★ 判斷字串裡有沒有中文
  const hasChineseChar = (str) => /[\u4e00-\u9fff]/.test(str || "");

  // ★ 義項標籤顯示策略
  const getSenseLabelSource = (index) => {
    const fromList = definitionList[index];
    const fromTrans = getDefinitionDeHint(index);

    if (isZhUI) {
      if (
        typeof fromList === "string" &&
        fromList.trim() &&
        hasChineseChar(fromList)
      ) {
        return fromList;
      }
      if (
        typeof fromTrans === "string" &&
        fromTrans.trim() &&
        hasChineseChar(fromTrans)
      ) {
        return fromTrans;
      }
      if (typeof fromList === "string" && fromList.trim()) {
        return fromList;
      }
      if (typeof fromTrans === "string" && fromTrans.trim()) {
        return fromTrans;
      }
      return "";
    }

    if (typeof fromList === "string" && fromList.trim()) {
      return fromList;
    }
    if (typeof fromTrans === "string" && fromTrans.trim()) {
      return fromTrans;
    }
    return "";
  };

  // ★ 讓 Definition (DE) 的每個德文字都可點擊（你的原版本：保留）
  const renderClickableText = (text, hoverHint) => {
    if (!text) return null;
    const tokens = splitTextTokens(text);

    return tokens.map((tok, idx) => {
      const clean = tok.trim();
      if (!clean) return tok;

      if (!isLikelyGermanWord(clean)) return tok;

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

  // ★★★ 新增：正確生成 clickable tokens（你的版本不會產生 React element array）
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

      {/* Definition (DE) → 現在把 🔊 放在標題後面 */}
      {currentDe && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          {/* 標題 + 發音按鈕 */}
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
              onClick={() => onSpeak(currentDe)}
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

          {/* ★★★ 修正：Definition(DE) 的 token 要能 clickable */}
          <div style={{ color: "var(--text-main)", lineHeight: 1.4 }}>
            {buildClickableTokens(currentDe, currentDeHint)}
          </div>
        </div>
      )}
    </div>
  );
}

export default WordDefinitionBlock;
