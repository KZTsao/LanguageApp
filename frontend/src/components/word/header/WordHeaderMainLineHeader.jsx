// frontend/src/components/WordHeaderMainLineHeader.jsx

function HeaderSection({
  article,
  articleColor,
  headword,
  headerSpeakText,
  onWordClick,
  handleSpeak,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {article && (
        <span
          onClick={() => onWordClick(article)}
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: articleColor,
            cursor: "pointer",
            textShadow: "var(--text-outline)",
          }}
        >
          {article}
        </span>
      )}

      <span
        onClick={() => onWordClick(headword)}
        style={{
          fontSize: 24,
          fontWeight: 700,
          cursor: "pointer",
          textShadow: "var(--text-outline)",
        }}
      >
        {headword}
      </span>

      {/* 單字主發音 ▶ */}
      <button
        type="button"
        onClick={() => handleSpeak(headerSpeakText)}
        className="icon-button sound-button"
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
  );
}

export default HeaderSection;
