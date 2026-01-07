// frontend/src/components/examples/ExampleList.jsx
import React, { useMemo } from "react";
import ExampleSentence from "./ExampleSentence";
import ConversationBox from "../conversation/ConversationBox";
import useConversation from "../conversation/useConversation";

/**
 * 文件說明
 * - 用途：負責「例句 + 連續對話」整塊 UI 排版與資料串接
 * - 原則：不在此檔做語言判斷，所有文案（labels）由外部傳入（通常來自 uiText），此檔只做 fallback
 * - Phase 2-UX：支援 Multi-ref toggle 顯示於 ExampleSentence 標題列
 * - Phase 2-UX（本次）：提供 refControls 插槽，讓「新增參考/refs badges/狀態提示」可下移到例句區塊內（ExampleSentence 下方）
 *
 * 異動紀錄（保留舊紀錄）
 * - 2026-01-06：Phase 2-UX：接受並轉傳 Multi-ref toggle 相關 props 到 ExampleSentence（例句標題列顯示），不影響查詢規則
 * - 2026-01-06：Phase 2-UX：新增 refControls slot，渲染於 ExampleSentence 下方（不改查詢規則）
 * - 2026-01-06：Phase 2-UX：補上 refControls 往 ExampleSentence 傳遞（避免 ExampleSentence 端 refControls 為 undefined）
 * - 2026-01-06：UI 調整：將「多參考輸入匡 + badges」移到 multiRef button 上方（ExampleSentence 之前），並停用下方 render（保留原碼註解回滾）
 * - 2026-01-07：例句標題：新增 headword prop 接收並往 ExampleSentence 傳遞（讓標題可顯示 headword 方框）
 *
 * 初始化狀態（Production 排查）
 * - component: ExampleList
 * - phase: 2-UX
 * - note: refControls 為純 UI 插槽，不得在此觸發任何 API
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

  // ✅ 2026-01-07：例句標題顯示用（往下傳到 ExampleSentence）
  headword,

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

  // ✅ Phase 2-UX：Multi-ref toggle（由 WordExampleBlock 傳入，顯示於 ExampleSentence 標題列）
  multiRefEnabled,
  onToggleMultiRef,
  multiRefToggleLabel,
  multiRefToggleHint,

  // ✅ Phase 2-UX：refs 控制區塊插槽（由 WordExampleBlock 組合後傳入）
  // - 用途：將「新增參考 / refs badges / dirty/used/missing 提示」下移到例句區塊內
  // - 規範：此插槽僅 UI，不得在這裡新增任何自動查詢行為
  refControls,
}) {
  // =========================
  // 初始化狀態（Production 排查）
  // =========================
  const __initState = useMemo(
    () => ({
      component: "ExampleList",
      phase: "2-UX",
      timestamp: new Date().toISOString(),
      hasRefControls: !!refControls,

      // ✅ 2026-01-07：headword presence
      hasHeadword: !!headword,
    }),
    [refControls, headword]
  );

  // DEPRECATED 2026-01-06：早期插入的控制旗標（避免重複宣告造成 syntax error）
  // - 保留原碼（註解）以利回溯，不刪除
  // const __RENDER_REFCONTROLS_ABOVE_EXAMPLESENTENCE = true;
  // const __PASS_REFCONTROLS_TO_EXAMPLESENTENCE = false;

  // ✅ Bugfix / UI 調整 2026-01-06：refControls 顯示位置與重複渲染控制
  // 中文功能說明：
  // - 需求：將「多參考輸入匡 + refs badges」移動到「多參考按鈕（Multi-ref toggle）」的上方
  // - 觀察：refControls 目前同時被 (1) 傳入 ExampleSentence 與 (2) 在 ExampleList 自己 render。
  //         若 ExampleSentence 也 render refControls，就會造成同一組 UI 出現兩次（兩個輸入匡）。
  // - 作法：
  //   1) 在 ExampleList 最上方（ExampleSentence 之前）render 一次 refControls → 位置一定在 multiRef button 上方
  //   2) 停用傳入 ExampleSentence 的 refControls（保留原碼註解，以便回滾）
  //   3) 停用原本 ExampleSentence 下方的 refControls render（保留原碼註解，以便回滾）
  const __RENDER_REFCONTROLS_ABOVE_EXAMPLESENTENCE = true;
  const __PASS_REFCONTROLS_TO_EXAMPLESENTENCE = false;
  const __RENDER_REFCONTROLS_BELOW_EXAMPLESENTENCE = false;

  // ✅ 開發用：確認 refControls/headword 是否有被上游傳入（不影響 production 行為）
  // - 注意：這裡只做 debug，不得觸發任何 API
  useMemo(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug("[ExampleList][presence] =", {
        headword: headword || null,
        hasHeadword: !!headword,
        hasRefControls: !!refControls,
        __initState,
      });
    } catch (e) {
      // ignore
    }
    return null;
  }, [refControls, headword, __initState]);

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
  const tConversationLoading = conversationLoadingLabel || "對話產生中…";

  return (
    <div style={{ marginTop: 16 }}>
      {/* ✅ Phase 2-UX：refs 控制區塊插槽（移動到 Multi-ref button 上方） */}
      {__RENDER_REFCONTROLS_ABOVE_EXAMPLESENTENCE && refControls ? (
        <div
          style={{
            marginBottom: 10,
          }}
        >
          {refControls}
        </div>
      ) : null}

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
        // ✅ 2026-01-07：headword 往下傳（例句標題顯示用）
        headword={headword}
        // ✅ Phase 2-UX：Multi-ref toggle（呈現在例句標題旁）
        multiRefEnabled={multiRefEnabled}
        onToggleMultiRef={onToggleMultiRef}
        multiRefToggleLabel={multiRefToggleLabel}
        multiRefToggleHint={multiRefToggleHint}
        // ✅ Phase 2-UX：refControls 往下傳（ExampleSentence 端需要可用）
        // DEPRECATED 2026-01-06: refControls 可能在 ExampleSentence 與 ExampleList 兩邊重複 render
        // refControls={refControls}
        refControls={__PASS_REFCONTROLS_TO_EXAMPLESENTENCE ? refControls : null}
      />

      {/* ✅ Phase 2-UX：refs 控制區塊下移插槽（ExampleSentence 下方） */}
      {/* DEPRECATED 2026-01-06: 位置需求改為「多參考按鈕上方」，故預設停用下方 render（保留原碼以利回溯） */}
      {__RENDER_REFCONTROLS_BELOW_EXAMPLESENTENCE && refControls ? (
        <div
          style={{
            marginTop: 10,
          }}
        >
          {refControls}
        </div>
      ) : null}

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
            conversationCloseLabel: tConversationClose,
            conversationPlayLabel: tConversationPlay,
            conversationLoadingLabel: tConversationLoading,
          }}
          onWordClick={onWordClick}
        />
      )}
    </div>
  );
}
// frontend/src/components/examples/ExampleList.jsx
