// FILE: frontend/src/components/examples/ExampleList.jsx
// END FILE: frontend/src/components/examples/ExampleList.jsx
import React, { useEffect, useMemo } from "react";
import ExampleSentence from "./ExampleSentence";
import useConversation from "../conversation/useConversation";

// =========================
// [***A] SentTypeTrace switch (dev-only)
// - Default OFF
// - Enable via Vite env: VITE_DEBUG_SENTENCE_TYPE_TRACE=1
// =========================
const __SENT_TYPE_TRACE_ON =
  typeof import.meta !== "undefined" &&
  import.meta?.env?.VITE_DEBUG_SENTENCE_TYPE_TRACE === "1";

function __sentTypeTrace(component, event, payload) {
  if (!__SENT_TYPE_TRACE_ON) return;
  try {
    // eslint-disable-next-line no-console
    console.log(
      `[***A][SentTypeTrace][${component}] ${new Date().toISOString()} ${event}`,
      payload
    );
  } catch (e) {
    // ignore
  }
}


// =========================
// [***A][***CONV] Conversation trace switch (dev-only)
// - Default OFF
// - Enable via Vite env: VITE_DEBUG_CONVERSATION=1
// =========================
const __CONV_TRACE_ON =
  typeof import.meta !== "undefined" &&
  import.meta?.env?.VITE_DEBUG_CONVERSATION === "1";

function __convTrace(event, payload) {
  if (!__CONV_TRACE_ON) return;
  try {
    // eslint-disable-next-line no-console
    console.log(
      `[***A][***CONV][ExampleList] ${new Date().toISOString()} ${event}`,
      payload
    );
  } catch (e) {
    // ignore
  }
}


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
 * - 2026-01-07：UI 調整：多重參考 refControls 改用小視窗（popover-like）浮層呈現，避免佔版面；顯示與否跟隨 multiRefEnabled（toggle）
 * - 2026-01-09：Bugfix：停止在 ExampleList render refControls popover（避免畫面出現「方匡/面板」誤判為錯誤狀態）
 *              改為僅將 refControls 往下傳到 ExampleSentence（讓控制列在 toggle 左側，由 ExampleSentence 負責呈現位置）
 * - 2026-01-10：Phase 2-UX：新增可選 props（refBadgesInline / refActionInline），往下傳到 ExampleSentence，
 *              用於把 badges / action 拆到不同 div（不影響 refControls 向後相容）
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

  // ✅ 2026-01-27：參考形式提示（小 i / hover）
  headwordRefHint,

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

  // ✅ 2026-01-10：可選插槽（更細分）
  // - 用途：讓 ExampleSentence 可以把 badges/action 放在不同 div（不同列/不同位置）
  // - 規範：此插槽僅 UI，不得在這裡新增任何自動查詢行為
  // - 向後相容：若上游未提供，ExampleSentence 仍可使用 refControls
  refBadgesInline,
  refActionInline,
  refConfirm,

  // ✅ SentenceType（句型）— 由上游傳入
  // - 注意：此檔僅轉傳/顯示，不在此產生 options
  sentenceType,
  sentenceTypeLabel,
  sentenceTypeOptions,
  onSentenceTypeChange,
}) {
  console.log("[20260203 record][ExampleList][render]", { ts: Date.now() });

  console.log("[20260202 record][ExampleList][render]", { ts: Date.now() });
  
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

      // ✅ 2026-01-07：multiRef presence
      multiRefEnabled: !!multiRefEnabled,

      // ✅ 2026-01-09：refControls routing (debug only)
      // - 目的：快速判斷 refControls 是否由 ExampleList 自己 render（應為 false）
      // - 目的：快速判斷 refControls 是否往下傳到 ExampleSentence（應為 true）
      refControlsAboveExampleSentence: false,
      refControlsPassToExampleSentence: true,

      // ✅ 2026-01-10：細分插槽 presence（debug only）
      hasRefBadgesInline: !!refBadgesInline,
      hasRefActionInline: !!refActionInline,
    }),
    [refControls, headword, multiRefEnabled, refBadgesInline, refActionInline]
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
  //
  // ✅ 2026-01-07（本次）：refControls 改為「小視窗浮層」呈現
  // 中文功能說明：
  // - 需求：多重參考的輸入匡 + 說明，用小視窗呈現，不要一直佔版面
  // - 最小改動策略：不改 refControls 內容，只改呈現容器（absolute overlay）
  // - 顯示/隱藏：跟隨 multiRefEnabled（toggle 開 = 顯示）
  //
  // ✅ 2026-01-09（本次）：停止在 ExampleList 這層 render popover
  // 中文功能說明：
  // - 需求：目前畫面上看到的「方匡/面板」被誤判為錯誤狀態，需要先移除來源
  // - 最小改動策略：不碰 refControls 內容，不改上游邏輯，只調整「由誰 render」：
  //   - ExampleList：不 render refControls（避免出現方匡）
  //   - ExampleSentence：接收 refControls，放在 toggle 左側（由 ExampleSentence 負責呈現位置）
  const __RENDER_REFCONTROLS_ABOVE_EXAMPLESENTENCE = false; // ✅ 2026-01-09：關掉方匡來源
  const __PASS_REFCONTROLS_TO_EXAMPLESENTENCE = true; // ✅ 2026-01-09：改為往下傳
  const __RENDER_REFCONTROLS_BELOW_EXAMPLESENTENCE = false;

  // ✅ 2026-01-07：Popover-like 浮層模式開關（純 UI，不影響任何查詢）
  // - 預設：啟用浮層
  // - 若需回滾：改成 false 會回到原本 inline render（保留原碼）
  // ✅ 2026-01-09：雖保留此旗標與相關區塊原碼（避免大量改動/便於回滾），但上方 render 已停用
  const __USE_REFCONTROLS_POPOVER = true;

  // ✅ 2026-01-07：浮層顯示條件（最小規則）
  // - 目前使用 multiRefEnabled 直接控制（toggle 開才顯示）
  // - 若未來要改成「點一下才展開」，可再加入獨立 state（此處先不做，避免動太多）
  // ✅ 2026-01-09：render 來源已停用，保留條件計算供 debug（不影響 UI）
  const __SHOULD_SHOW_REFCONTROLS_POPOVER = !!multiRefEnabled;

  // ✅ 開發用：確認 refControls/headword 是否有被上游傳入（不影響 production 行為）
  // - 注意：這裡只做 debug，不得觸發任何 API
  useMemo(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug("[ExampleList][presence] =", {
        headword: headword || null,
        hasHeadword: !!headword,
        hasRefControls: !!refControls,
        multiRefEnabled: !!multiRefEnabled,

        // ✅ 2026-01-10：細分插槽 presence
        hasRefBadgesInline: !!refBadgesInline,
        hasRefActionInline: !!refActionInline,

        __initState,
      });
    } catch (e) {
      // ignore
    }
    return null;
  }, [
    refControls,
    headword,
    multiRefEnabled,
    refBadgesInline,
    refActionInline,
    __initState,
  ]);

  // =========================
  // [***A] SentTypeTrace: ExampleList presence/render snapshot
  // - 不影響任何邏輯：僅 log
  // - 依 VITE_DEBUG_SENTENCE_TYPE_TRACE 控制
  // =========================
  useMemo(() => {
    __sentTypeTrace("ExampleList", "presence", {
      loading: !!loading,
      examplesLen: Array.isArray(examples) ? examples.length : -1,
      headwordType: typeof headword,
      sentenceTypeType: typeof sentenceType,
      sentenceTypeLabelType: typeof sentenceTypeLabel,
      sentenceTypeOptionsType: Array.isArray(sentenceTypeOptions)
        ? "array"
        : typeof sentenceTypeOptions,
      sentenceTypeOptionsCount: Array.isArray(sentenceTypeOptions)
        ? sentenceTypeOptions.length
        : -1,
    });
    return null;
  }, [examples, loading, headword, sentenceType, sentenceTypeLabel, sentenceTypeOptions]);

  const hasExamples = Array.isArray(examples) && examples.length > 0;
  const mainSentence = hasExamples ? examples[0] : "";

// [***A][***CONV] lifecycle (dev-only)
useEffect(() => {
  const exampleCount = Array.isArray(examples) ? examples.length : 0;
  __convTrace("mount", {
    hasExamples: !!hasExamples,
    exampleCount,
    exampleIndex: 0,
    mainSentencePreview: String(mainSentence || "").slice(0, 120),
    explainLang,
  });
  return () => {
    __convTrace("unmount", {});
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  // 連續對話邏輯：統一集中在 useConversation
  const {
    conversation,
    loading: conversationLoading,
    error: conversationError,
    isOpen: isConversationOpen,
    openConversation,
    closeConversation,
    clearConversation,
    nextTurn,
    prevTurn,
  } = useConversation({
    mainSentence,
    mainTranslation: exampleTranslation,
    explainLang,
  });

  // ✅ Conversation overlay data mapping
  const __convTurns =
    conversation && Array.isArray(conversation.turns) ? conversation.turns : [];
  const __convIndex =
    conversation && Number.isFinite(conversation.currentIndex)
      ? conversation.currentIndex
      : 0;
  const __convTotal = __convTurns.length;
  const __convPage = __convTotal > 0 ? __convTurns[__convIndex] : null;
  const __convCanPrev = __convIndex > 0;
  const __convCanNext = __convIndex < __convTotal - 1;

  // ✅ Single source of truth for "currently displayed sentence" (for recording reference)
  // - conversation open: use current turn
  // - otherwise: use example sentence
  const displayedSentence = isConversationOpen
    ? (__convPage && typeof __convPage.de === "string" && __convPage.de.trim()
        ? __convPage.de
        : mainSentence)
    : mainSentence;

  // ✅ Single source of truth for "currently displayed translation"
  // - conversation open:
  //   - index 0 MUST reuse the original example translation (do not re-translate)
  //   - other turns use their own translation
  // - otherwise: use example translation
  const displayedTranslation = isConversationOpen
    ? (__convIndex === 0
        ? (exampleTranslation || "")
        : (__convPage && typeof __convPage.translation === "string" ? __convPage.translation : ""))
    : (exampleTranslation || "");

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

  // ✅ 2026-01-27：參考形式提示文字（hover 小 i）。
  // - ExampleList 不做語系判斷；上游傳什麼就用什麼。
  const tHeadwordRefHint = (headwordRefHint || "").toString();

  return (
    <div style={{ marginTop: 16 }}>
      {/* ✅ Phase 2-UX：refs 控制區塊插槽（移動到 Multi-ref button 上方） */}
      {__RENDER_REFCONTROLS_ABOVE_EXAMPLESENTENCE && refControls ? (
        <>
          {/* DEPRECATED 2026-01-07: 原本 inline render 會一直佔版面，需求改為小視窗呈現。
              - 保留原碼以利回滾（不刪行）
          <div
            style={{
              marginBottom: 10,
            }}
          >
            {refControls}
          </div>
          */}

          {/* ✅ 2026-01-07：Popover-like 浮層容器（不佔版面） */}
          {__USE_REFCONTROLS_POPOVER ? (
            <div
              style={{
                position: "relative",
                // ✅ 讓浮層不推擠版面：本容器高度不依內容撐開
                height: 0,
              }}
            >
              {__SHOULD_SHOW_REFCONTROLS_POPOVER ? (
                <div
                  style={{
                    position: "absolute",
                    // ✅ 顯示在例句區塊上方（不影響 layout）
                    top: -6,
                    right: 0,
                    zIndex: 20,

                    // ✅ 面板外觀（亮/暗版：避免寫死黑白，盡量使用 rgba）
                    padding: 12,
                    borderRadius: 12,
                    minWidth: 360,
                    maxWidth: 720,

                    background: "var(--panel-bg, rgba(255, 255, 255, 0.98))",
                    border: "1px solid rgba(0, 0, 0, 0.12)",
                    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.14)",

                    // ✅ 讓面板內容不要被壓縮
                    overflow: "visible",
                  }}
                >
                  {refControls}
                </div>
              ) : null}
            </div>
          ) : (
            // ✅ 回滾用：若關閉 __USE_REFCONTROLS_POPOVER，回到原本 inline（仍不建議）
            <div
              style={{
                marginBottom: 10,
              }}
            >
              {refControls}
            </div>
          )}
        </>
      ) : null}

      {/* 例句區塊 */}
      <ExampleSentence
        hasExamples={hasExamples}
        mainSentence={mainSentence}
        displayedSentence={displayedSentence}
        displayedTranslation={displayedTranslation}
        exampleTranslation={exampleTranslation}
        sectionExample={sectionExample}
        sectionExampleTranslation={sectionExampleTranslation}
        loading={loading}
        onRefresh={() => {
          try {
            if (typeof clearConversation === "function") clearConversation();
          } catch (e) {
            // ignore
          }
          try {
            if (typeof onRefresh === "function") onRefresh();
          } catch (e) {
            // ignore
          }
        }}
        refreshTooltip={refreshTooltip}
        onWordClick={onWordClick}
        onSpeak={onSpeak}
        onToggleConversation={(...args) => {
          console.log("[20260203 record][ExampleList][onToggleConversation]", { ts: Date.now() });

  __convTrace("conversation:toggle", {
    isOpen: isConversationOpen,
    mainSentencePreview: String(mainSentence || "").slice(0, 120),
    exampleIndex: 0,
    
  }        
);
  return openConversation(...args);
}}
        conversationToggleTooltip={tConversationToggleTooltip}
        // ✅ Conversation navigation (overlay on ExampleSentence)
        conversationActive={!!isConversationOpen}
        conversationPage={__convPage}
        conversationIndex={__convIndex}
        conversationTotal={__convTotal}
        conversationCanPrev={__convCanPrev}
        conversationCanNext={__convCanNext}
        onConversationPrev={prevTurn}
        onConversationNext={nextTurn}
        conversationLoading={conversationLoading}
        conversationError={conversationError}
        // ✅ 2026-01-07：headword 往下傳（例句標題顯示用）
        headword={headword}
        headwordRefHint={tHeadwordRefHint}
        // ✅ 2026-01-13：headword 可點擊（由 ExampleSentence 端決定是否使用）
        // - 目的：讓「點 headword badge」可以重新產生例句（不改既有 onRefresh button 行為）
        // - 注意：此處只做「把 handler 往下傳」；實際 click 行為要由 ExampleSentence 實作
        onHeadwordClick={() => {
          try {
            if (typeof clearConversation === "function") clearConversation();
          } catch (e) {
            // ignore
          }
          try {
            if (typeof onRefresh === "function") onRefresh();
          } catch (e) {
            // ignore
          }
        }}
        headwordClickTooltip={refreshTooltip || ""}
        // ✅ Phase 2-UX：Multi-ref toggle（呈現在例句標題旁）
        multiRefEnabled={multiRefEnabled}
        onToggleMultiRef={onToggleMultiRef}
        multiRefToggleLabel={multiRefToggleLabel}
        multiRefToggleHint={multiRefToggleHint}
        // ✅ Phase 2-UX：refControls 往下傳（ExampleSentence 端需要可用）
        // DEPRECATED 2026-01-06: refControls 可能在 ExampleSentence 與 ExampleList 兩邊重複 render
        // refControls={refControls}
        refControls={__PASS_REFCONTROLS_TO_EXAMPLESENTENCE ? refControls : null}
        // ✅ 2026-01-10：細分插槽（可選）
        // - 向後相容：ExampleSentence 若未接，也不影響既有行為
        refBadgesInline={refBadgesInline}
        refActionInline={refActionInline}
        refConfirm={refConfirm}
        // ✅ 2026-01-29: sentenceType（句型）selector（顯示於 headword badge 右側）
        sentenceTypeLabel={sentenceTypeLabel}
        sentenceType={sentenceType}
        sentenceTypeOptions={sentenceTypeOptions}
        onSentenceTypeChange={onSentenceTypeChange}
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
    </div>
  );
}
// frontend/src/components/examples/ExampleList.jsx