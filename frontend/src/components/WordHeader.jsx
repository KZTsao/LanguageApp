// frontend/src/components/WordHeader.jsx

// 第一行：冠詞 + 單字 + 喇叭
function WordHeaderMainLine({
  article,
  headword,
  articleColor,
  headerSpeakText,
  onWordClick,
  onSpeak,
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
            color: articleColor,      // 性別顏色
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

      <button
        onClick={() => onSpeak(headerSpeakText)}
        style={{
          padding: "2px 6px",
          borderRadius: 999,
          border: "none",
          background: "var(--chip-bg)",
          cursor: "pointer",
        }}
      >
        🔊
      </button>
    </div>
  );
}

// 第二行：詞性
function WordHeaderMetaLine({ posDisplay }) {
  if (!posDisplay) return null;
  return (
    <div
      style={{
        color: "var(--text-muted)",
        marginBottom: 8,
        fontSize: 13,
      }}
    >
      {posDisplay}
    </div>
  );
}

// 外層組合元件：兩行 + 分隔線
function WordHeader({
  article,
  headword,
  articleColor,
  headerSpeakText,
  posDisplay,
  onWordClick,
  onSpeak,
}) {
  return (
    <>
      <WordHeaderMainLine
        article={article}
        headword={headword}
        articleColor={articleColor}
        headerSpeakText={headerSpeakText}
        onWordClick={onWordClick}
        onSpeak={onSpeak}
      />
      <WordHeaderMetaLine posDisplay={posDisplay} />
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right, transparent, var(--border-subtle), transparent)",
          marginBottom: 10,
        }}
      />
    </>
  );
}

export default WordHeader;
