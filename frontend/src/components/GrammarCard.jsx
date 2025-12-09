// frontend/src/components/GrammarCard.jsx

function GrammarCard({ labels, grammar, onWordClick, onSpeak }) {
  if (!grammar) return null;

  const hasErrors = Array.isArray(grammar.errors) && grammar.errors.length > 0;

  const renderClickableText = (text) => {
    if (!text) return null;
    const tokens = text.split(/(\s+|[.,!?;:"()«»„“”])/);
    return tokens.map((tok, idx) => {
      if (!tok.trim()) return tok;
      if (!/[A-Za-zÄÖÜäöüß]/.test(tok)) return tok;
      return (
        <span
          key={idx}
          onClick={() => onWordClick(tok)}
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

  return (
    <div
      style={{
        marginTop: 20,
        padding: 14,
        borderRadius: 14,
        background: "var(--card-bg)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text-main)" }}>
        {labels.title}
      </div>

      {grammar.overallComment && (
        <div style={{ marginBottom: 10, fontSize: 14 }}>{grammar.overallComment}</div>
      )}

      {hasErrors &&
        grammar.errors.map((err, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              borderRadius: 8,
              background: "var(--card-subtle-bg)",
              border: "1px solid var(--border-subtle)",
              marginBottom: 12,
            }}
          >
            {/* 原句 */}
            {err.original && (
              <div style={{ fontSize: 13, marginBottom: 4, color: "var(--text-muted)" }}>
                <strong>{labels.labelOriginal}：</strong>{" "}
                {renderClickableText(err.original)}
              </div>
            )}

            {/* 建議句 */}
            {err.suggestion && (
              <div
                style={{
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 4,
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <strong>{labels.labelSuggestion}：</strong>{" "}
                {renderClickableText(err.suggestion)}
                <button
                  onClick={() => onSpeak(err.suggestion)}
                  style={{
                    padding: "2px 6px",
                    borderRadius: 999,
                    border: "none",
                    background: "var(--chip-bg)",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  🔊
                </button>
              </div>
            )}

            {/* 說明 */}
            {err.explanation && (
              <div style={{ marginTop: 6, fontSize: 13 }}>
                <strong>{labels.labelExplanation}：</strong> {err.explanation}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

export default GrammarCard;
