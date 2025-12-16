// frontend/src/components/WordHeaderMainLinePlural.jsx

function PluralSection({
  plural,
  labelPlural,
  pluralArticleColor,
  handleSpeak,
  onWordClick,
}) {
  if (!plural) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        marginBottom: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <strong>{labelPlural}：</strong>

      {/* 只讓「die」上色，名詞保持一般字色 */}
      <span onClick={() => onWordClick(plural)} style={{ cursor: "pointer" }}>
        <span
          style={{
            color: pluralArticleColor,
            textShadow: "var(--text-outline)",
          }}
        >
          die
        </span>{" "}
        <span style={{ color: "var(--text-main)" }}>{plural}</span>
      </span>

      {/* ▶ 複數發音（icon 外觀比照 WordHeader） */}
      <button
        type="button"
        onClick={() => handleSpeak(`die ${plural}`)}
        className="icon-button sound-button"
        title={`朗讀「die ${plural}」`}
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
  );
}

export default PluralSection;
