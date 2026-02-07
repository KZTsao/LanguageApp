// frontend/src/components/result/ConversationBox.jsx
/**
 * 文件說明：
 * - ConversationBox：顯示「連續對話」的德文/翻譯內容，支援上一句/下一句/播放/關閉。
 * - 本次異動：讓「連續對話中的德文句子」也能逐字點擊，觸發外部 onWordClick 進行新查詢。
 *
 * 異動紀錄（僅追加，不可刪除）：
 * - 2025-12-18：
 *   1) 新增 onWordClick prop（從父層接線進來）
 *   2) 新增 renderClickableGerman：把德文句子拆成可點 token（保留標點/空白）
 *   3) 新增 conversationWordClickInitStatus（Production 排查）：記錄最後一次點擊字/時間
 */

import React, { useState } from "react";

const MOSAIC_LINE = "----------------------------";

const EyeIconOpen = () => (
  <svg
    className="eye-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M12 5C7 5 3.2 8 1.5 12 3.2 16 7 19 12 19s8.8-3 10.5-7C20.8 8 17 5 12 5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

const EyeIconClosed = () => (
  <svg
    className="eye-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M12 5C7 5 3.2 8 1.5 12 3.2 16 7 19 12 19s8.8-3 10.5-7C20.8 8 17 5 12 5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <line
      x1="4"
      y1="4"
      x2="20"
      y2="20"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const eyeButtonStyle = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  flexShrink: 0,
};

export default function ConversationBox({
  conversation,
  loading,
  error,
  onPrev,
  onNext,
  onClose,
  onSpeak,
  onWordClick,
  labels,
  variant,
}) {
  
  const {
    conversationTitle,
    conversationTurnLabel,
    conversationPrevLabel,
    conversationNextLabel,
    conversationPlayLabel,
    conversationCloseLabel,
    conversationLoadingLabel,
  } = labels || {};

  const hasConversationTurns =
    conversation &&
    Array.isArray(conversation.turns) &&
    conversation.turns.length > 0;

  const currentTurn =
    hasConversationTurns && conversation
      ? conversation.turns[conversation.currentIndex] || null
      : null;

  const currentTurnDe =
    currentTurn && typeof currentTurn.de === "string"
      ? currentTurn.de
      : typeof currentTurn === "string"
      ? currentTurn
      : "";

  const currentTurnTranslation =
    currentTurn && typeof currentTurn.translation === "string"
      ? currentTurn.translation
      : "";

  let tConversationTitle;
  if (conversationTitle && typeof conversationTitle === "string") {
    tConversationTitle = conversationTitle;
  } else if (
    conversationCloseLabel &&
    typeof conversationCloseLabel === "string" &&
    conversationCloseLabel.toLowerCase().includes("close")
  ) {
    tConversationTitle = "Conversation";
  } else {
    tConversationTitle = "連續對話";
  }

  const tConversationTurnLabel = conversationTurnLabel || "turn";
  const tConversationPrev = conversationPrevLabel || "上一句";
  const tConversationNext = conversationNextLabel || "下一句";
  const tConversationPlay = conversationPlayLabel || "播放";
  const tConversationClose = conversationCloseLabel || "關閉";
  const tConversationLoading = conversationLoadingLabel || "對話產生中…";

  const effectiveVariant = (variant || "panel").toString();

  const [showConversationGerman, setShowConversationGerman] = useState(true);
  const [showConversationTranslation, setShowConversationTranslation] =
    useState(true);

  /**
   * 功能初始化狀態（Production 排查用）
   * - 用途：確認「連續對話文字點擊」是否真的有觸發、最後點擊的字與時間
   * - 注意：此狀態僅供排查，不參與任何業務邏輯
   */
  const [conversationWordClickInitStatus, setConversationWordClickInitStatus] =
    useState({
      ok: false,
      lastWord: "",
      at: "",
      note: "init",
    });

  /**
   * 功能：把德文句子拆成可點的 token（連續對話用）
   * - 只讓「字母/變音/ß/連字號/撇號」組成的 token 可點
   * - 其他標點與空白原樣保留
   * - onWordClick 不是 function 時直接退回純文字（避免 TypeError）
   */
  const renderClickableGerman = (text) => {
    if (!text) return "";
    if (!onWordClick || typeof onWordClick !== "function") return text;

    // 保留空白與標點：把「可點字串」切出來，其餘片段原樣保留
    const parts = String(text).split(
      /([A-Za-zÄÖÜäöüß]+(?:[-'][A-Za-zÄÖÜäöüß]+)*)/g
    );

    return parts.map((part, idx) => {
      const isWord = /^[A-Za-zÄÖÜäöüß]+(?:[-'][A-Za-zÄÖÜäöüß]+)*$/.test(part);
      if (!isWord) {
        return <React.Fragment key={`cpt-${idx}`}>{part}</React.Fragment>;
      }

      return (
        <span
          key={`cpt-${idx}`}
          onClick={() => {
            // ✅ Production 排查：記錄點擊（不影響任何業務邏輯）
            setConversationWordClickInitStatus({
              ok: true,
              lastWord: part,
              at: new Date().toISOString(),
              note: "clicked-conversation-word",
            });

            // ✅ 交給外層 App：觸發新查詢
            onWordClick(part);
          }}
          style={{ cursor: "pointer" }}
          title="點一下查這個字"
        >
          {part}
        </span>
      );
    });
  };

  // ==================================================
  // Compact overlay variant
  // - Render ONLY current turn and navigation arrows
  // - Meant to be placed directly on the example sentence row
  // ==================================================
  if (effectiveVariant === "overlay") {
    return (
      <div
        data-ref="conversationOverlay"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasConversationTurns || !!loading || conversation?.currentIndex <= 0}
            title={tConversationPrev}
            className="icon-button sound-button"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              opacity:
                !hasConversationTurns || !!loading || conversation?.currentIndex <= 0
                  ? 0.35
                  : 0.95,
            }}
            aria-label="conversation-prev"
          >
            ◀
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, lineHeight: 1.6, wordBreak: "break-word" }}>
              {loading ? (
                <span style={{ opacity: 0.75 }}>{tConversationLoading}</span>
              ) : error ? (
                <span style={{ opacity: 0.85 }}>{String(error)}</span>
              ) : currentTurnDe ? (
                <span>{renderClickableGerman(currentTurnDe)}</span>
              ) : (
                <span style={{ opacity: 0.65 }}>{MOSAIC_LINE}</span>
              )}
            </div>
            {showConversationTranslation && currentTurnTranslation ? (
              <div style={{ fontSize: 13, opacity: 0.82, marginTop: 2 }}>
                {currentTurnTranslation}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={
              !hasConversationTurns ||
              !!loading ||
              conversation?.currentIndex >= (conversation?.turns?.length || 1) - 1
            }
            title={tConversationNext}
            className="icon-button sound-button"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              opacity:
                !hasConversationTurns ||
                !!loading ||
                conversation?.currentIndex >= (conversation?.turns?.length || 1) - 1
                  ? 0.35
                  : 0.95,
            }}
            aria-label="conversation-next"
          >
            ▶
          </button>

          <button
            type="button"
            onClick={onClose}
            title={tConversationClose}
            className="icon-button sound-button"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              opacity: 0.85,
              marginLeft: 2,
            }}
            aria-label="conversation-close"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 8,
        borderRadius: 8,
        border: "1px solid var(--border-subtle, rgba(120,120,120,0.35))",
        fontSize: 15,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: "var(--card-bg, rgba(0,0,0,0.02))",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          opacity: 0.85,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span>{tConversationTitle}</span>

          {onSpeak && currentTurnDe && (
            <button
              type="button"
              onClick={() => onSpeak(currentTurnDe)}
              title={tConversationPlay}
              className="icon-button sound-button"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                opacity: 0.95,
              }}
            >
              <svg
                className="sound-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <polygon points="10,8 10,16 16,12" />
              </svg>
            </button>
          )}
        </div>

        {hasConversationTurns && (
          <div>
            {tConversationTurnLabel} {conversation.currentIndex + 1} /{" "}
            {conversation.turns.length}
          </div>
        )}
      </div>

      {/* Content */}
      {loading && (
        <div style={{ fontSize: 13, opacity: 0.8, padding: "2px 0 4px" }}>
          {tConversationLoading}
        </div>
      )}

      {!loading && error && (
        <div style={{ fontSize: 12, opacity: 0.7, padding: "2px 0 4px" }}>
          {error}
        </div>
      )}

      {!loading && hasConversationTurns && (
        <>
          {/* German */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowConversationGerman((v) => !v)}
              title={showConversationGerman ? "隱藏德文對話" : "顯示德文對話"}
              className="icon-button sound-button"
              style={eyeButtonStyle}
            >
              {showConversationGerman ? <EyeIconOpen /> : <EyeIconClosed />}
            </button>

            <div style={{ lineHeight: 1.6 }}>
              {showConversationGerman ? (
                renderClickableGerman(currentTurnDe)
              ) : (
                <span style={{ whiteSpace: "nowrap" }}>{MOSAIC_LINE}</span>
              )}
            </div>
          </div>

          {/* Translation */}
          {currentTurnTranslation && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowConversationTranslation((v) => !v)}
                title={showConversationTranslation ? "隱藏翻譯" : "顯示翻譯"}
                className="icon-button sound-button"
                style={eyeButtonStyle}
              >
                {showConversationTranslation ? <EyeIconOpen /> : <EyeIconClosed />}
              </button>

              <div style={{ fontSize: 14, opacity: 0.9 }}>
                {showConversationTranslation ? (
                  currentTurnTranslation
                ) : (
                  <span style={{ whiteSpace: "nowrap" }}>{MOSAIC_LINE}</span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer: Prev / Next / Close */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasConversationTurns || conversation.currentIndex === 0}
            style={{
              minWidth: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.6)",
              background: "rgba(255,255,255,0.08)",
              cursor:
                !hasConversationTurns || conversation.currentIndex === 0
                  ? "default"
                  : "pointer",
              opacity:
                !hasConversationTurns || conversation.currentIndex === 0 ? 0.4 : 1,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--conversation-arrow-color)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 6 9 12 15 18" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={
              !hasConversationTurns ||
              conversation.currentIndex === conversation.turns.length - 1
            }
            style={{
              minWidth: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.6)",
              background: "rgba(255,255,255,0.08)",
              cursor:
                !hasConversationTurns ||
                conversation.currentIndex === conversation.turns.length - 1
                  ? "default"
                  : "pointer",
              opacity:
                !hasConversationTurns ||
                conversation.currentIndex === conversation.turns.length - 1
                  ? 0.4
                  : 1,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--conversation-arrow-color)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          title={tConversationClose}
          style={{
            padding: "2px 10px",
            fontSize: 13,
            borderRadius: 999,
            border:
              "1px solid var(--button-ghost-border, var(--border-subtle, rgba(120,120,120,0.4)))",
            background: "var(--button-ghost-bg, transparent)",
            color: "var(--button-ghost-fg, var(--text-color))",
            cursor: "pointer",
            opacity: 0.9,
          }}
        >
          {tConversationClose}
        </button>
      </div>
    </div>
  );
}
// frontend/src/components/result/ConversationBox.jsx
