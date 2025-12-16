// frontend/src/components/WordHeaderMainLineDefinitionDe.jsx

function DefinitionDeSection({
  definitionDeList,
  getDefinitionIndexLabel,
  renderClickableText,
  getDefinitionDeHint,
  handleSpeak,
}) {
  if (!definitionDeList || definitionDeList.length === 0) return null;

  return (
    <div
      style={{
        fontSize: 13,
        color: "var(--text-muted)",
        marginBottom: 8,
      }}
    >
      <div style={{ marginBottom: 2 }}>Definition (DE)：</div>

      <div>
        {definitionDeList.map((sentence, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 2,
            }}
          >
            <span>{getDefinitionIndexLabel(idx)}</span>
            <span style={{ color: "var(--text-main)" }}>
              {renderClickableText(sentence, getDefinitionDeHint(idx))}
            </span>

            {/* Definition(DE) 播放 ▶ */}
            <button
              type="button"
              onClick={() => handleSpeak(sentence)}
              className="icon-button sound-button"
              title={getDefinitionDeHint(idx)}
            >
              <svg
                className="sound-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polygon points="7,5 7,19 19,12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DefinitionDeSection;
