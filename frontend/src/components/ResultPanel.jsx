// frontend/src/components/ResultPanel.jsx

import React from "react";

function ResultPanel({
  result,
  loading,
  showRaw,
  onToggleRaw,
  uiText,
  WordCard,
  GrammarCard,
  onWordClick,
  canPrev,
  canNext,
  onPrev,
  onNext,
  historyIndex,
  historyLength,
}) {
  // 安全處理 uiText，避免任何層級是 undefined
  const t = uiText || {};
  const sections = t.sections || {};
  const wordCardLabels = t.wordCard || {};
  const grammarCardLabels = t.grammarCard || {};

  const noResultText =
    t.noResultText || "請輸入上方欄位並按下 Analyze 開始查詢";
  const loadingText = t.loadingText || "正在分析中，請稍候…";
  const wordSectionTitle = sections.wordCardTitle || "字卡";
  const grammarSectionTitle = sections.grammarCardTitle || "文法說明";
  const rawToggleLabelOn = t.rawToggleOn || "隱藏原始 JSON";
  const rawToggleLabelOff = t.rawToggleOff || "顯示原始 JSON";

  // 從 result 裡安全地抓「單字結果」與「文法結果」
  let wordItems = [];
  if (result) {
    if (Array.isArray(result.words)) {
      wordItems = result.words;
    } else if (result.dictionary) {
      // 後端如果只回傳一個物件 { dictionary, ... }
      wordItems = [result];
    }
  }

  let grammarItems = [];
  if (result) {
    if (Array.isArray(result.grammarCards)) {
      grammarItems = result.grammarCards;
    } else if (result.grammar) {
      grammarItems = Array.isArray(result.grammar)
        ? result.grammar
        : [result.grammar];
    }
  }

  const handleSpeak = (text) => {
    if (!text) return;
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "de-DE";
      window.speechSynthesis.speak(utter);
    } else {
      console.log("[speak]", text);
    }
  };

  return (
    <div
      style={{
        marginTop: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* 歷史上一筆 / 下一筆 */}
      {historyLength > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <div>
            {historyIndex + 1} / {historyLength}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onPrev}
              disabled={!canPrev}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: canPrev ? "var(--chip-bg)" : "transparent",
                cursor: canPrev ? "pointer" : "default",
              }}
            >
              ← Prev
            </button>
            <button
              onClick={onNext}
              disabled={!canNext}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: canNext ? "var(--chip-bg)" : "transparent",
                cursor: canNext ? "pointer" : "default",
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Loading 狀態 */}
      {loading && (
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid var(--border-subtle)",
            background: "var(--card-bg)",
            fontSize: 14,
          }}
        >
          {loadingText}
        </div>
      )}

      {/* 沒結果 & 沒在 loading → 顯示提示文字 */}
      {!loading && !result && (
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid var(--border-subtle)",
            background: "var(--card-bg)",
            fontSize: 14,
            color: "var(--text-muted)",
          }}
        >
          {noResultText}
        </div>
      )}

      {/* 有結果時 */}
      {!loading && result && (
        <>
          {/* 單字卡區塊 */}
          {wordItems.length > 0 && WordCard && (
            <section>
              <h2
                style={{
                  fontSize: 14,
                  margin: "0 0 8px 0",
                  color: "var(--text-muted)",
                }}
              >
                {wordSectionTitle}
              </h2>
              {wordItems.map((item, idx) => (
                <WordCard
                  key={idx}
                  data={item}
                  labels={wordCardLabels}
                  onWordClick={onWordClick}
                  onSpeak={handleSpeak}
                />
              ))}
            </section>
          )}

          {/* 文法卡區塊（如果有） */}
          {grammarItems.length > 0 && GrammarCard && (
            <section>
              <h2
                style={{
                  fontSize: 14,
                  margin: "16px 0 8px 0",
                  color: "var(--text-muted)",
                }}
              >
                {grammarSectionTitle}
              </h2>
              {grammarItems.map((g, idx) => (
                <GrammarCard
                  key={idx}
                  data={g}
                  labels={grammarCardLabels}
                />
              ))}
            </section>
          )}

          {/* Raw JSON 切換 */}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={onToggleRaw}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: "transparent",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {showRaw ? rawToggleLabelOn : rawToggleLabelOff}
            </button>

            {showRaw && (
              <pre
                style={{
                  marginTop: 8,
                  maxHeight: 320,
                  overflow: "auto",
                  fontSize: 11,
                  background: "var(--code-bg)",
                  borderRadius: 12,
                  padding: 12,
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ResultPanel;
