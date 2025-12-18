// frontend/src/components/result/ResultPanel.jsx
import React from "react";
import { callTTS } from "../../utils/ttsClient";

function ResultPanel({
  result,
  loading,
  showRaw,
  onToggleRaw,
  uiText,
  uiLang,
  WordCard,
  GrammarCard,
  onWordClick,
  canPrev,
  canNext,
  onPrev,
  onNext,
  historyIndex,
  historyLength,
  isFavorited,        // (headword, canonicalPos) => boolean
  canFavorite,       // boolean（是否允許收藏，guest = false）
  onToggleFavorite,  // (headword, canonicalPos) => void
}) {
  const t = uiText || {};
  const sections = t.sections || {};
  const wordCardLabels = t.wordCard || {};
  const grammarCardLabels = t.grammarCard || {};

  const noResultText =
    t.noResultText || "請輸入上方欄位並按下 Analyze 開始查詢";
  const loadingText = t.loadingText || "正在分析中，請稍候…";

  const rawToggleLabelOn = t.rawToggleOn || "隱藏原始 JSON";
  const rawToggleLabelOff = t.rawToggleOff || "顯示原始 JSON";

  let wordItems = [];
  if (result) {
    if (Array.isArray(result.words)) {
      wordItems = result.words;
    } else if (result.dictionary) {
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

  const handleSpeak = async (text) => {
    if (!text) return;
    try {
      const audioSrc = await callTTS(text, "de-DE");
      if (!audioSrc) return;
      const audio = new Audio(audioSrc);
      audio.play();
    } catch (err) {
      console.error("TTS 播放錯誤：", err);
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
      {historyLength > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 12,
            color: "var(--text-muted)",
            gap: 12,
          }}
        >
          <div>
            {historyLength > 0
              ? historyIndex >= 0
                ? historyLength - historyIndex
                : historyLength
              : 0}{" "}
            / {historyLength}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onPrev}
              disabled={!canPrev}
              aria-label="Previous result"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid var(--border-main)",
                background: "var(--card-bg)",
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: canPrev ? "pointer" : "not-allowed",
                opacity: canPrev ? 1 : 0.4,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              onClick={onNext}
              disabled={!canNext}
              aria-label="Next result"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid var(--border-main)",
                background: "var(--card-bg)",
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: canNext ? "pointer" : "not-allowed",
                opacity: canNext ? 1 : 0.4,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
          </div>
        </div>
      )}

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

      {!loading && result && (
        <>
          {wordItems.length > 0 && WordCard && (
            <section>
              {wordItems.map((item, idx) => {
                const d = item?.dictionary || {};
                const headword =
                  d.baseForm || d.lemma || d.word || item.text || "";
                const canonicalPos = d.partOfSpeech || "";
                const entry = {
                  headword,
                  canonicalPos,
                };
                return (
                  <WordCard
                    key={idx}
                    data={item}
                    labels={wordCardLabels}
                    onWordClick={onWordClick}
                    onSpeak={handleSpeak}
                    uiLang={uiLang}

                    // ✅ 只轉交，不計算
                    favoriteActive={
                      typeof isFavorited === "function"
                        ? isFavorited(entry)
                        : false
                    }
                    favoriteDisabled={!canFavorite}
                    onToggleFavorite={onToggleFavorite}
                  />
                );
              })}
            </section>
          )}

          {grammarItems.length > 0 && GrammarCard && (
            <section>
              <h2
                style={{
                  fontSize: 14,
                  margin: "16px 0 8px 0",
                  color: "var(--text-muted)",
                }}
              >
                {sections.grammarCardTitle || "文法說明"}
              </h2>
              {grammarItems.map((g, idx) => (
                <GrammarCard key={idx} data={g} labels={grammarCardLabels} />
              ))}
            </section>
          )}

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
// frontend/src/components/result/ResultPanel.jsx
