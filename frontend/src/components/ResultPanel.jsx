// frontend/src/components/ResultPanel.jsx
// 負責：根據 result.mode 顯示 WordCard / GrammarCard / JSON

function ResultPanel({
  result,
  showRaw,
  onToggleShowRaw,
  t,
  onWordClick,
  onSpeak,
  WordCard,
  GrammarCard,

  // ★ 新增：歷史導航
  canPrev,
  canNext,
  onPrev,
  onNext,
  historyIndex,
  historyLength,
}) {
  const hasHistory =
    typeof historyIndex === "number" &&
    historyIndex >= 0 &&
    historyLength > 1;

  return (
    <div style={{ marginTop: 28 }}>
      {/* 查詢歷史導航列 */}
      {hasHistory && (
        <div
          style={{
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid var(--border-subtle)",
              background: canPrev
                ? "var(--card-bg)"
                : "var(--card-subtle-bg)",
              color: "var(--text-main)",
              cursor: canPrev ? "pointer" : "default",
              fontSize: 12,
            }}
          >
            ← 上一個
          </button>

          <div style={{ flexShrink: 0 }}>
            {historyIndex + 1} / {historyLength}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid var(--border-subtle)",
              background: canNext
                ? "var(--card-bg)"
                : "var(--card-subtle-bg)",
              color: "var(--text-main)",
              cursor: canNext ? "pointer" : "default",
              fontSize: 12,
            }}
          >
            下一個 →
          </button>
        </div>
      )}

      {/* 單字模式 */}
      {result?.mode === "word" && (
        <WordCard
          data={result}
          labels={t.wordCard}
          onWordClick={onWordClick}
          onSpeak={onSpeak}
        />
      )}

      {/* 句子模式 */}
      {result?.mode === "sentence" && (
        <>
          {result.words?.map((w, idx) => (
            <WordCard
              key={idx}
              data={w}
              labels={t.wordCard}
              onWordClick={onWordClick}
              onSpeak={onSpeak}
            />
          ))}
          <GrammarCard
            grammar={result.grammar}
            labels={t.grammarCard}
            onWordClick={onWordClick}
            onSpeak={onSpeak}
          />
        </>
      )}

      {/* JSON 顯示 */}
      {result && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={onToggleShowRaw}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              background: "var(--card-bg)",
              color: "var(--text-main)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {showRaw ? "隱藏原始 JSON" : "顯示原始 JSON"}
          </button>

          {showRaw && (
            <pre
              style={{
                marginTop: 12,
                padding: 16,
                borderRadius: 10,
                background: "var(--code-bg)",
                color: "var(--text-main)",
                border: "1px solid var(--border-subtle)",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default ResultPanel;
