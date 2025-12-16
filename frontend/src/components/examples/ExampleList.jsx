import React from "react";
import ExampleSentence from "./ExampleSentence";
import ConversationBox from "../conversation/ConversationBox";
import useConversation from "../conversation/useConversation";

/**
 * ExampleList
 *
 * - 負責「例句 + 連續對話」這一整塊的 UI 排版
 * - 所有文案（labels）都由外部傳入（通常來自 uiText），這裡只做 fallback
 * - ConversationBox 完全不做語言判斷，所有字串透過 labels 傳下去
 */
export default function ExampleList({
  examples,
  loading,
  sectionExample,
  sectionExampleTranslation,
  exampleTranslation,
  onRefresh,
  refreshTooltip,
  onWordClick,
  onSpeak,

  // 語言資訊（只給後端 / hook 用，不在這裡做文案判斷）
  explainLang,

  // 連續對話相關文案（通常由 uiText 注入）
  conversationTitle,
  conversationToggleTooltip,
  conversationTurnLabel,
  conversationPrevLabel,
  conversationNextLabel,
  conversationPlayLabel,
  conversationCloseLabel,
  conversationLoadingLabel,
}) {
  const hasExamples = Array.isArray(examples) && examples.length > 0;
  const mainSentence = hasExamples ? examples[0] : "";

  // 連續對話邏輯：統一集中在 useConversation
  const {
    conversation,
    loading: conversationLoading,
    error: conversationError,
    isOpen: isConversationOpen,
    openConversation,
    closeConversation,
    nextTurn,
    prevTurn,
  } = useConversation({ mainSentence, explainLang });

  // ===== 文案：這裡只做「有傳就用、沒傳用預設中文」的 fallback =====
  const tConversationTitle = conversationTitle || "連續對話";

  const tConversationToggleTooltip =
    conversationToggleTooltip ||
    (isConversationOpen ? "隱藏連續對話" : "產生連續對話");

  const tConversationTurnLabel = conversationTurnLabel || "turn";
  const tConversationPrev = conversationPrevLabel || "上一句";
  const tConversationNext = conversationNextLabel || "下一句";
  const tConversationPlay = conversationPlayLabel || "播放";
  const tConversationClose = conversationCloseLabel || "關閉";
  const tConversationLoading =
    conversationLoadingLabel || "對話產生中…";

  return (
    <div style={{ marginTop: 16 }}>
      {/* 例句區塊 */}
      <ExampleSentence
        hasExamples={hasExamples}
        mainSentence={mainSentence}
        exampleTranslation={exampleTranslation}
        sectionExample={sectionExample}
        sectionExampleTranslation={sectionExampleTranslation}
        loading={loading}
        onRefresh={onRefresh}
        refreshTooltip={refreshTooltip}
        onWordClick={onWordClick}
        onSpeak={onSpeak}
        onToggleConversation={openConversation}
        conversationToggleTooltip={tConversationToggleTooltip}
      />

      {/* 連續對話區塊 */}
      {isConversationOpen && conversation && (
        <ConversationBox
          conversation={conversation}
          loading={conversationLoading}
          error={conversationError}
          onPrev={prevTurn}
          onNext={nextTurn}
          onClose={closeConversation}
          onSpeak={onSpeak}
          labels={{
            conversationTitle: tConversationTitle,
            conversationTurnLabel: tConversationTurnLabel,
            conversationPrevLabel: tConversationPrev,
            conversationNextLabel: tConversationNext,
            conversationPlayLabel: tConversationPlay,
            conversationCloseLabel: tConversationClose,
            conversationLoadingLabel: tConversationLoading,
          }}
        />
      )}
    </div>
  );
}
