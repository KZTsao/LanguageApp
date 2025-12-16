import React, { useState, useEffect } from "react";

const MOSAIC_LINE = "----------------------------";

const EyeIconOpen = () => (
  <svg
    className="eye-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M12 5C7 5 3.2 8 1.5 12 3.2 16 7 19 12 19s8.8-3 10.5-7C20.8 8 17 5 12 5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

const EyeIconClosed = () => (
  <svg
    className="eye-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M12 5C7 5 3.2 8 1.5 12 3.2 16 7 19 12 19s8.8-3 10.5-7C20.8 8 17 5 12 5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <line
      x1="4"
      y1="4"
      x2="20"
      y2="20"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const eyeButtonStyle = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  flexShrink: 0,
};

export default function ExampleSentence({
  hasExamples,
  mainSentence,
  exampleTranslation,
  sectionExample,
  loading,
  onRefresh,
  refreshTooltip,
  onWordClick,
  onSpeak,
  onToggleConversation,
  conversationToggleTooltip,
}) {
  // 顯示狀態：從 localStorage 初始化
  const [showGerman, setShowGerman] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("exampleShowGerman");
    return stored === "false" ? false : true;
  });

  const [showTranslation, setShowTranslation] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("exampleShowTranslation");
    return stored === "false" ? false : true;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("exampleShowGerman", String(showGerman));
  }, [showGerman]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "exampleShowTranslation",
      String(showTranslation)
    );
  }, [showTranslation]);

  const handleWordClick = (word) => {
    if (onWordClick && typeof onWordClick === "function") {
      onWordClick(word);
    }
  };

  const handleSpeakSentence = () => {
    if (!mainSentence) return;
    if (onSpeak && typeof onSpeak === "function") {
      onSpeak(mainSentence);
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

  const renderSentenceMosaic = () => {
    return <span style={{ whiteSpace: "nowrap" }}>{MOSAIC_LINE}</span>;
  };

  const renderTranslation = () => {
    if (!exampleTranslation) return null;
    if (showTranslation) return <span>{exampleTranslation}</span>;
    return <span style={{ whiteSpace: "nowrap" }}>{MOSAIC_LINE}</span>;
  };

  return (
    <>
      {/* 標題列：例句 + 播放 + 重整 + 對話 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>{sectionExample || "例句"}</div>

        {hasExamples && onSpeak && (
          <button
            type="button"
            onClick={handleSpeakSentence}
            title="播放語音"
            className="icon-button sound-button"
          >
            <svg
              className="sound-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <polygon points="10,8 10,16 16,12" />
            </svg>
          </button>
        )}

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

        {hasExamples && onToggleConversation && (
          <button
            type="button"
            onClick={onToggleConversation}
            title={conversationToggleTooltip}
            className="icon-button sound-button"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 4h16a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H9l-3.2 3.2A1 1 0 0 1 4 18.9V5a1 1 0 0 1 1-1z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="10" r="0.9" fill="currentColor" />
              <circle cx="12" cy="10" r="0.9" fill="currentColor" />
              <circle cx="15" cy="10" r="0.9" fill="currentColor" />
            </svg>
          </button>
        )}

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

      {/* 主例句（德文）＋ 眼睛切換 */}
      {hasExamples && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setShowGerman((v) => !v)}
            title={showGerman ? "隱藏德文例句" : "顯示德文例句"}
            className="icon-button sound-button"
            style={eyeButtonStyle}
          >
            {showGerman ? <EyeIconOpen /> : <EyeIconClosed />}
          </button>

          <div
            style={{
              fontSize: 18,
              lineHeight: 1.6,
              marginBottom: 4,
            }}
          >
            {showGerman ? renderSentence() : renderSentenceMosaic()}
          </div>
        </div>
      )}

      {/* 翻譯 ＋ 眼睛切換 */}
      {exampleTranslation && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setShowTranslation((v) => !v)}
            title={showTranslation ? "隱藏翻譯" : "顯示翻譯"}
            className="icon-button sound-button"
            style={eyeButtonStyle}
          >
            {showTranslation ? <EyeIconOpen /> : <EyeIconClosed />}
          </button>

          <div
            style={{
              fontSize: 15,
              opacity: 0.9,
            }}
          >
            {renderTranslation()}
          </div>
        </div>
      )}
    </>
  );
}
