// frontend/src/components/WordHeader.jsx

import { playTTS } from "../../../utils/ttsClient";

// 第一行：冠詞 + 單字 + 喇叭
function WordHeaderMainLine({
  article,
  headword,
  articleColor,
  headerSpeakText,
  onWordClick,
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
            color: articleColor, // 性別顏色
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

      {/* ▶ 播放單字發音（改成 playTTS） */}
      <button
        onClick={() => playTTS(headerSpeakText, "de-DE")}
        className="icon-button sound-button"
        title={`朗讀「${headerSpeakText}」`}
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
}) {
  return (
    <>
      <WordHeaderMainLine
        article={article}
        headword={headword}
        articleColor={articleColor}
        headerSpeakText={headerSpeakText}
        onWordClick={onWordClick}
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
