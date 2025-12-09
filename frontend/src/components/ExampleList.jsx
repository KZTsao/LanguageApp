// frontend/src/components/ExampleList.jsx

import React from "react";

export default function ExampleList({
  examples,
  loading,
  sectionExample,
  sectionExampleTranslation,
  exampleTranslation,
  onSpeak,
  onRefresh,
  refreshTooltip,
  onWordClick,
}) {
  const hasExamples = Array.isArray(examples) && examples.length > 0;
  const mainSentence = hasExamples ? examples[0] : "";

  const handleWordClick = (word) => {
    if (onWordClick && typeof onWordClick === "function") {
      onWordClick(word);
    }
  };

  const renderSentence = () => {
    if (!mainSentence) return null;

    const parts = mainSentence.split(/(\s+)/);
    return parts.map((part, idx) => {
      if (part.trim() === "") return part;
      return (
        <span
          key={idx}
          style={{
            cursor: onWordClick ? "pointer" : "default",
            paddingInline: 1,
          }}
          onClick={() => handleWordClick(part)}
        >
          {part}
        </span>
      );
    });
  };

  return (
    <div style={{ marginTop: 16 }}>
      {/* 標題列：例句 + 發音 + 重整 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        {/* 標題 */}
        <div style={{ fontWeight: 600 }}>
          {sectionExample || "例句"}
        </div>

        {/* 發音 icon（移到這裡） */}
        {onSpeak && hasExamples && (
          <button
            type="button"
            onClick={() => onSpeak(mainSentence)}
            title="播放語音"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              fontSize: 16,
            }}
          >
            🔊
          </button>
        )}

        {/* 重新產生例句（SVG icon） */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            title={refreshTooltip}
            className="example-refresh-button"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
          >
            <svg
              className="example-refresh-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                stroke="none"
                d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.07-.28 2.07-.77 2.94l1.46 1.46A7.932 7.932 0 0020 12c0-4.42-3.58-8-8-8zm-6.69.69L3.85 6.15A7.932 7.932 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-1.07.28-2.07.77-2.94z"
              />
            </svg>
          </button>
        )}

        {/* Loading 提示 */}
        {loading && (
          <span
            style={{
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            產生中…
          </span>
        )}
      </div>

      {/* 主例句文字區 */}
      {hasExamples && (
        <div
          style={{
            fontSize: 18,
            lineHeight: 1.6,
            marginBottom: 4,
          }}
        >
          {renderSentence()}
        </div>
      )}

      {/* 翻譯 */}
      {exampleTranslation && (
        <div
          style={{
            fontSize: 15,
            marginTop: 4,
            opacity: 0.9,
          }}
        >
          {exampleTranslation}
        </div>
      )}
    </div>
  );
}
