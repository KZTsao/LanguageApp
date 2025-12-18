// frontend/src/components/result/ResultPanel.jsx
/**
 * 文件說明：
 * - 本元件負責顯示查詢結果（WordCard/GrammarCard）與結果導覽（history 前後頁）
 * - 本輪新增：在「前後頁箭頭旁邊」提供「清除當下回放紀錄」入口（由 App 傳入 handler）
 *
 * 異動紀錄（僅追加，不可刪除）：
 * - 2025-12-18：
 *   1) 新增 canClearHistory / onClearHistoryItem / clearHistoryLabel
 *   2) 「點擊清除該筆紀錄」移到導覽列箭頭旁，低調樣式並支援多國
 */

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
  isFavorited,
  canFavorite,
  onToggleFavorite,

  // ✅ 新增：單字庫彈窗入口
  onOpenLibrary,

  // ✅ 新增：清除當下回放紀錄（由 App 管 state）
  canClearHistory,
  onClearHistoryItem,
  clearHistoryLabel,
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

  // ✅ 共用：導覽/工具按鈕樣式（比照既有 prev/next）
  const navButtonStyle = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid var(--border-main)",
    background: "var(--card-bg)",
    color: "var(--text-main)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  // ✅ 低調清除文案（props > fallback）
  const clearLabel =
    (typeof clearHistoryLabel === "string" && clearHistoryLabel.trim()) ||
    "點擊清除該筆紀錄";

  const canClear =
    !!canClearHistory && typeof onClearHistoryItem === "function";

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
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--text-muted)",
            gap: 12,
          }}
        >
          {/* 左側：頁碼 + 前後 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              {historyLength > 0
                ? historyIndex >= 0
                  ? historyLength - historyIndex
                  : historyLength
                : 0}{" "}
              / {historyLength}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={onPrev}
                disabled={!canPrev}
                aria-label="Previous result"
                style={{
                  ...navButtonStyle,
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
                  ...navButtonStyle,
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

              {/* ✅ 清除當下回放紀錄：放在箭頭旁邊（低調） */}
              {canClear && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={onClearHistoryItem}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onClearHistoryItem();
                    }
                  }}
                  aria-label={clearLabel}
                  title={clearLabel}
                  style={{
                    marginLeft: 6,
                    opacity: 0.55,
                    fontSize: 12,
                    userSelect: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {clearLabel}
                </span>
              )}
            </div>
          </div>

          {/* 右側：單字庫 icon（最右邊） */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => {
                if (typeof onOpenLibrary === "function") onOpenLibrary();
              }}
              aria-label="Open library"
              title="單字庫"
              // ✅ 比照播放聲音：橘色線條、透明底、亮暗版由 CSS 控制
              className="icon-button sound-button"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
              }}
            >
              {/* ✅ 線條版字典 icon：stroke 用 currentColor，fill 透明 */}
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 外圈圓形（比照播放按鈕的圓框感） */}
                <circle cx="12" cy="12" r="10" fill="none" />
                {/* 書本 */}
                <path d="M9 7.5h7.2c.7 0 1.3.6 1.3 1.3v8.9" />
                <path d="M9 7.5c-1.1 0-2 .9-2 2v9.2c0 .8.6 1.3 1.3 1.3H17.5" />
                <path d="M9 10h6" />
                <path d="M9 13h6" />
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
                const entry = { headword, canonicalPos };

                return (
                  <WordCard
                    key={idx}
                    data={item}
                    labels={wordCardLabels}
                    onWordClick={onWordClick}
                    onSpeak={handleSpeak}
                    uiLang={uiLang}
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
