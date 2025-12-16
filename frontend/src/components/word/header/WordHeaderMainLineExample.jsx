// frontend/src/components/WordHeaderMainLineExample.jsx

function ExampleSection({
  example,
  sectionExample,
  sectionExampleTranslation,
  exampleTranslation,
  renderClickableText,
  handleSpeak,
}) {
  if (!example) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          color: "var(--text-muted)",
          fontSize: 13,
          display: "flex",
          gap: 6,
        }}
      >
        <span>{sectionExample}</span>

        {/* 例句整句播放 ▶ */}
        <button
          type="button"
          onClick={() => handleSpeak(example)}
          className="icon-button sound-button"
          title="朗讀整句例句"
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

      <div
        style={{
          marginTop: 6,
          padding: "10px 12px",
          borderRadius: 12,
          background: "var(--card-subtle-bg)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* 德文例句（hover 整句翻譯） */}
        <div
          style={{
            borderLeft: "2px solid var(--border-subtle)",
            paddingLeft: 10,
          }}
        >
          {renderClickableText(example, exampleTranslation)}
        </div>

        {exampleTranslation && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)", marginRight: 4 }}>
              {sectionExampleTranslation}：
            </span>
            {exampleTranslation}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExampleSection;
