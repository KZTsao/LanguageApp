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
  labels,
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

  const [showConversationGerman, setShowConversationGerman] = useState(true);
  const [showConversationTranslation, setShowConversationTranslation] =
    useState(true);

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
                currentTurnDe
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
