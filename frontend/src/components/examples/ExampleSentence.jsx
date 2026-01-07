// frontend/src/components/examples/ExampleSentence.jsx
/**
 * 文件說明
 * - 用途：渲染「例句」標題列 + 主例句（德文）+ 翻譯切換（眼睛）
 * - Phase 2-UX（Option A）：
 *   - 將「多重參考」toggle 放到「例句」標題旁邊（同一列）
 *   - 不影響 Phase 1 查詢規則：仍然只有 Refresh 才會呼叫 /api/dictionary/examples
 * - Phase 2-UX（RefControls Slot）：
 *   - ✅ 提供一個 refControls slot，讓「新增參考 / pills / 提示」不要卡在例句與對話之間
 *   - ✅ refControls 由上層（ExampleList/WordExampleBlock）決定內容與狀態，本檔只負責位置
 *
 * 異動紀錄（保留舊紀錄，新增於下）
 * - 2026-01-06：Option A：Example 標題列加入 multiRef toggle（由上層透過 ExampleList 傳入），亮/暗模式可見；不改任何查詢流程
 * - 2026-01-06：RefControls Slot：新增 refControls prop，並固定 render 在翻譯區塊之後，避免卡在例句與對話之間
 * - 2026-01-06：UI 微調：三個按鈕維持左側，僅將 multiRef toggle 推到同一行最右側（透過 margin-left:auto）
 *
 * 初始化狀態（Production 排查）
 * - component: ExampleSentence
 * - phase: 2-UX
 */

// frontend/src/components/examples/ExampleSentence.jsx (file start)
import React, { useState, useEffect, useMemo } from "react";

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

// ✅ Phase 2-UX：Multi-ref toggle（亮/暗模式可見）
// - OFF：淡底 + 邊框（看得到）
// - ON：淡綠底 + 綠邊框 + dot 實心
const getMultiRefToggleStyle = (enabled) => {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "2px 12px",
    borderRadius: 999,
    cursor: "pointer",
    userSelect: "none",
    border: enabled
      ? "1px solid rgba(60, 180, 120, 0.92)"
      : "1px solid rgba(0, 0, 0, 0.28)",
    background: enabled ? "rgba(80, 200, 120, 0.18)" : "rgba(0, 0, 0, 0.04)",
    color: "inherit",
    fontSize: 13,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
};

const getMultiRefToggleDotStyle = (enabled) => {
  return {
    width: 10,
    height: 10,
    borderRadius: 999,
    display: "inline-block",
    border: enabled
      ? "1px solid rgba(60, 180, 120, 0.95)"
      : "1px solid rgba(0, 0, 0, 0.25)",
    background: enabled
      ? "rgba(60, 180, 120, 0.95)"
      : "rgba(0, 0, 0, 0.12)",
  };
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

  // ✅ Phase 2-UX：由 ExampleList 轉傳（Option A：放在例句標題旁）
  multiRefEnabled,
  onToggleMultiRef,
  multiRefToggleLabel,
  multiRefToggleHint,

  // ✅ Phase 2-UX：RefControls Slot（由上層提供內容：新增參考 input / pills / 提示）
  // - 本檔只決定位置：固定放在翻譯區塊之後，避免卡在例句與對話中間
  refControls,
}) {
  // =========================
  // 初始化狀態（Production 排查）
  // =========================
  const __initState = useMemo(
    () => ({
      component: "ExampleSentence",
      phase: "2-UX",
      timestamp: new Date().toISOString(),
    }),
    []
  );

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

  // ✅ Phase 2-UX：Multi-ref toggle 點擊（只改狀態，不觸發自動查詢）
  const handleToggleMultiRefClick = () => {
    if (onToggleMultiRef && typeof onToggleMultiRef === "function") {
      onToggleMultiRef();
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

  // ✅ Phase 2-UX：是否顯示 multiRef toggle（需上層有接線才顯示）
  const showMultiRefToggle = !!multiRefToggleLabel && !!onToggleMultiRef;

  // ✅ Phase 2-UX：是否顯示 refControls（需上層有提供內容才顯示）
  const showRefControls = !!refControls;

  return (
    <>
      {/* 標題列：例句 + Multi-ref toggle（Option A） + 播放 + 重整 + 對話 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>{sectionExample || "例句"}</div>

        {/* DEPRECATED 2026/01/06: multiRef toggle 原本放在標題旁，會讓後面的三個按鈕（播放/刷新/對話）位置跟著變動；
            需求是「三個按鈕維持原本左側，只移動 multiRef toggle」，因此改為在本列最右側 render（見下方）。
            這段原碼保留以利回溯（不執行）。

        {/* ✅ Option A：toggle 放在例句旁邊（同一列） * /}
        {showMultiRefToggle && (
          <button
            type="button"
            onClick={handleToggleMultiRefClick}
            aria-pressed={multiRefEnabled ? "true" : "false"}
            title={multiRefToggleHint || ""}
            style={getMultiRefToggleStyle(!!multiRefEnabled)}
          >
            <span>{multiRefToggleLabel}</span>
            <span style={getMultiRefToggleDotStyle(!!multiRefEnabled)} />
          </button>
        )}
        */}

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

        {/* ✅ 2026-01-06：僅移動 multiRef toggle 到同一行最右側（不影響其他按鈕維持左側） */}
        {showMultiRefToggle && (
          <button
            type="button"
            onClick={handleToggleMultiRefClick}
            aria-pressed={multiRefEnabled ? "true" : "false"}
            title={multiRefToggleHint || ""}
            style={{
              ...getMultiRefToggleStyle(!!multiRefEnabled),
              marginLeft: "auto",
            }}
          >
            <span>{multiRefToggleLabel}</span>
            <span style={getMultiRefToggleDotStyle(!!multiRefEnabled)} />
          </button>
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

      {/* ✅ Phase 2-UX：RefControls Slot（固定放在翻譯之後，避免卡在例句與對話之間） */}
      {showRefControls && (
        <div
          style={{
            marginTop: 10,
          }}
        >
          {refControls}
        </div>
      )}
    </>
  );
}
// frontend/src/components/examples/ExampleSentence.jsx (file end)
