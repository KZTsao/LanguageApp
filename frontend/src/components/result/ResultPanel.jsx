// frontend/src/components/result/ResultPanel.jsx
/**
 * 文件說明：
 * - 本元件負責顯示查詢結果（WordCard/GrammarCard）與結果導覽（history 前後頁）
 * - 本輪新增：在「前後頁箭頭旁邊」提供「清除當下回放紀錄」入口（由 App 傳入 handler）
 * - 本輪新增：在「單字庫 icon 左邊」提供「測驗（鉛筆考試）」入口（由 App 傳入 handler）
 *
 * 異動紀錄（僅追加，不可刪除）：
 * - 2025-12-18：
 *   1) 新增 canClearHistory / onClearHistoryItem / clearHistoryLabel
 *   2) 「點擊清除該筆紀錄」移到導覽列箭頭旁，低調樣式並支援多國
 * - 2026-01-04：
 *   1) 新增 onEnterTestMode（由外層接入）
 *   2) 在「單字庫 icon 左邊」插入測驗入口（ExamIcon）
 *   3) title/aria-label 改為優先使用 uiText（避免寫死繁中）
 * - 2026-01-04：
 *   4) 單字庫 icon SVG：改為「厚字典（B）」視覺；舊版圓圈書本 SVG 以 deprecated 註解保留
 * - 2026-01-05：
 *   1) 單字庫 icon：改為「純色封面 + W（右邊不圓角）」（避免與測驗 icon 太像、避免書背/書頁誤判）
 *   2) 測驗/單字庫兩顆 icon：按鈕容器改為 display:flex + alignItems/justifyContent（修正垂直高度不一致）
 * - 2026-01-05：
 *   3) 視覺高度一致：測驗 icon 與單字庫 icon 統一使用 18px（避免看起來一大一小）
 * - 2026-01-05：
 *   4) ✅ 視覺高度再對齊：放大 W 的筆畫範圍（讓單字庫 icon 看起來高度更接近測驗 icon）
 * - 2026-01-05：
 *   5) ✅ AI 免責聲明多國漏接修正：支援 uiText.aiDisclaimerLines（array）與舊版 aiDisclaimerLine1/2（string）
 *   6) ✅ 免責聲明水平對齊：改為與 JSON 區塊一致的 padding/border/radius（白框外但視覺齊）
 * - 2026-01-05：
 *   7) ✅ 單字庫 icon 尺寸改為獨立常數（不再使用 TOOL_ICON_SIZE）
 *   8) ✅ W 不再佔滿版：調整 W path 內縮，讓上下留白更明顯
 * - 2026-01-05：
 *   9) ✅ 單字庫 icon：SVG 內容使用 g transform 非等比縮放（可獨立調整長寬比例，不影響按鈕外框）
 * - 2026-01-06：
 *   1) ✅ 兩顆 icon 視覺垂直對齊：新增統一 icon holder（固定盒 + lineHeight:0），避免 SVG 內容留白差造成「看起來不齊」
 * - 2026-01-06：
 *   2) ✅ POS 切換（多詞性）事件往下傳：插入 WordCard onSelectPosKey handler（先只做 console 驗證，不改既有查詢流程）
 * - 2026-01-07：
 *   1) ✅ 單字庫 icon（W）暫時註解隱藏（保留原碼，未來可恢復）
 *   2) ✅ 測驗（小考）icon 暫時改為「單字庫入口」（點擊改呼叫 onOpenLibrary，並加入可觀測 console）
 *
 * 功能初始化狀態（Production 排查）：
 * - 若 onEnterTestMode 未傳入：點擊測驗 icon 只會 console 提示，不會拋錯
 * - 若 onOpenLibrary 未傳入：點擊單字庫 icon 不會拋錯
 * - 若 uiText 未提供免責聲明字串：使用內建繁中 fallback，不影響既有功能
 * - ✅ 若 WordCard 未提供 posOptions/pos UI：本檔案插入的 onSelectPosKey 不會造成錯誤（僅在 WordCard 觸發時 console）
 * - ✅ 2026-01-07：測驗 icon 已改作單字庫入口；若 onOpenLibrary 未傳入，會 console 顯示 hasHandler=false（不中斷）
 */

import React from "react";
import { callTTS } from "../../utils/ttsClient";
import ExamIcon from "../icons/ExamIcon";

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

  // ✅ 新增：測驗入口（由 App 管 view）
  onEnterTestMode,

  // ✅ 新增：清除當下回放紀錄（由 App 管 state）
  canClearHistory,
  onClearHistoryItem,
  clearHistoryLabel,

  // ✅ 2026-01-06：POS 切換（多詞性）事件往上傳（由 App 注入 handler）
  onSelectPosKeyFromApp,
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

  // ✅ 新增：AI 免責聲明（白框外、靠近 raw json 區域）
  // 中文功能說明：
  // - 此段文字用於告知使用者本詞條為 AI 生成內容，避免對「釋義順序/結構」變動產生誤解
  // - 放置於「顯示原始 JSON」按鈕上方、且在 WordCard 白框外，不影響主要閱讀

  // ✅ 2026-01-05：多國漏接修正：支援 uiText.aiDisclaimerLines（array）
  // 中文功能說明：
  // - 新版 uiText 可能會用 aiDisclaimerLines: [line1, line2]
  // - 舊版仍用 aiDisclaimerLine1 / aiDisclaimerLine2（string）
  // - 此處優先吃 array，再 fallback 舊版 string，再 fallback 內建繁中
  const aiDisclaimerLines = Array.isArray(t.aiDisclaimerLines)
    ? t.aiDisclaimerLines
    : null;

  const aiDisclaimerLine1FromArray =
    aiDisclaimerLines && typeof aiDisclaimerLines[0] === "string"
      ? aiDisclaimerLines[0].trim()
      : "";

  const aiDisclaimerLine2FromArray =
    aiDisclaimerLines && typeof aiDisclaimerLines[1] === "string"
      ? aiDisclaimerLines[1].trim()
      : "";

  // deprecated：舊版（只吃 string key），保留不刪除
  const aiDisclaimerLine1 =
    (typeof t.aiDisclaimerLine1 === "string" && t.aiDisclaimerLine1.trim()) ||
    "⚠️ 本詞條內容由 AI 自動生成並整理，涵蓋多國語言釋義與用法。";
  const aiDisclaimerLine2 =
    (typeof t.aiDisclaimerLine2 === "string" && t.aiDisclaimerLine2.trim()) ||
    "AI 可能依語境調整釋義結構或順序，內容僅供學習參考，非傳統權威辭典。";

  // ✅ 2026-01-05：實際使用的免責聲明（優先 array，其次舊 string）
  const aiDisclaimerLine1Final =
    aiDisclaimerLine1FromArray || aiDisclaimerLine1;
  const aiDisclaimerLine2Final =
    aiDisclaimerLine2FromArray || aiDisclaimerLine2;

  // ✅ 統一 icon 視覺高度（避免看起來一大一小）
  const TOOL_ICON_SIZE = 18;

  // ✅ 2026-01-05：Icon 尺寸/對齊獨立參數（可手動微調，不依賴 TOOL_ICON_SIZE）
  // 中文功能說明：
  // - EXAM_ICON_*：測驗 icon（左）
  // - LIB_ICON_*：單字庫 icon（右）
  // - NUDGE_Y：用於修正兩顆 icon 視覺水平高度不一致（可用 +1 / -1 微調）
  const EXAM_ICON_SIZE = 18;
  const EXAM_ICON_NUDGE_Y = 0;

  const LIB_ICON_WIDTH = 20;
  const LIB_ICON_HEIGHT = 30;
  const LIB_ICON_NUDGE_Y = -2;

  // ✅ 2026-01-06：統一 icon holder（避免 SVG 留白不同造成看起來不齊）
  // 中文功能說明：
  // - 兩顆 icon 都先塞進固定大小的容器（ICON_HOLDER_SIZE）
  // - 容器內用 flex 置中，並用 lineHeight:0 避免 inline baseline 造成偏移
  // - 真正要微調「看起來」上下位置：仍用 EXAM_ICON_NUDGE_Y / LIB_ICON_NUDGE_Y
  const ICON_HOLDER_SIZE = 18;

  // ✅ 2026-01-06：POS 切換（多詞性）驗證用 handler（先只做 console，不影響查詢流程）
  // 中文功能說明：
  // - 先把點擊事件「往下傳」打通，讓 WordCard 的 hasUpstreamHandler=true
  // - 這一步不做 re-query，不改結果 state，只提供可觀測 log
  const handleSelectPosKeyFromWordCard = ({
    clickedPosKey,
    activePosKey,
    word,
    idx,
  }) => {
    console.log("[ResultPanel][posSwitch] onSelectPosKey", {
      clickedPosKey,
      activePosKey,
      word,
      idx,
      hasUpstreamHandler: typeof onSelectPosKeyFromApp === "function",
    });

    // ✅ 2026-01-06：若外層（App）有注入 handler，則往上傳遞
    // 中文功能說明：
    // - 本檔案先確保「事件線」可以一路送到 App（用於觸發 re-query）
    // - 若 App 尚未導入：只會 console，不會造成錯誤
    if (typeof onSelectPosKeyFromApp === "function") {
      try {
        onSelectPosKeyFromApp({
          clickedPosKey,
          activePosKey,
          word,
          idx,
        });
      } catch (err) {
        console.error("[ResultPanel][posSwitch] upstream handler error", err);
      }
    }
  };

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

  // ✅ 多國顯示：單字庫/測驗 label（優先 uiText，不寫死繁中）
  //   - 若未提供對應字串：使用空字串，避免顯示固定語言
  const libraryLabel =
    (typeof t.libraryTitle === "string" && t.libraryTitle.trim()) ||
    (typeof t.library === "string" && t.library.trim()) ||
    "";
  const testLabel =
    (typeof t.testTitle === "string" && t.testTitle.trim()) ||
    (typeof t.test === "string" && t.test.trim()) ||
    (typeof t.quizTitle === "string" && t.quizTitle.trim()) ||
    (typeof t.quiz === "string" && t.quiz.trim()) ||
    "";

  // ✅ 中文功能說明：測驗入口 click handler（不中斷、可觀察）
  // ✅ 2026-01-07：目前 UI 測驗 icon 已改作單字庫入口，但此 function 不刪除（保留既有行為與未來恢復測驗用）
  const handleEnterTestModeClick = () => {
    console.log("[ResultPanel] enter test mode clicked", {
      hasHandler: typeof onEnterTestMode === "function",
    });
    if (typeof onEnterTestMode === "function") onEnterTestMode();
  };

  // ✅ 2026-01-07：測驗 icon 改作單字庫入口 click handler（不中斷、可觀察）
  // 中文功能說明：
  // - 需求：把小考 icon 暫時改成「連到單字庫功能」
  // - 作法：不改 icon 視覺，只改 onClick → 呼叫 onOpenLibrary
  // - Production 排查：印出 hasHandler，避免使用者點了沒反應時難追
  const handleOpenLibraryFromExamClick = () => {
    console.log("[ResultPanel] exam icon → open library clicked", {
      hasHandler: typeof onOpenLibrary === "function",
    });
    if (typeof onOpenLibrary === "function") onOpenLibrary();
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

          {/* 右側：測驗 icon（在單字庫左邊） + 單字庫 icon（最右邊） */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* ✅ 新增：測驗入口（鉛筆考試） */}
            {/* ✅ 2026-01-07：此 icon 暫時改作「單字庫入口」，不改 icon 外觀，只改 onClick */}
            <button
              onClick={handleOpenLibraryFromExamClick}
              aria-label={testLabel || undefined}
              title={testLabel || undefined}
              className="icon-button sound-button"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 0, // ✅ 2026-01-06：避免 inline baseline 造成視覺偏移
                padding: 0, // ✅ 保持純置中
              }}
            >
              <span
                style={{
                  width: ICON_HOLDER_SIZE,
                  height: ICON_HOLDER_SIZE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 0,
                  transform: `translateY(${EXAM_ICON_NUDGE_Y}px)`,
                }}
              >
                <ExamIcon
                  size={EXAM_ICON_SIZE}
                  ariaLabel={testLabel || ""}
                  title={testLabel || ""}
                />
              </span>
            </button>

            {/*
              DEPRECATED 2026-01-07：單字庫 icon 暫時註解隱藏（保留原碼，不刪除）
              中文功能說明：
              - 需求：先把單字庫 icon 隱藏（未來可能會用到）
              - 作法：整段 button 以 JSX 註解包住，保留原碼與 SVG（含 deprecated 區塊）
              - 未來恢復：解除註解即可（不需要重寫）
            */}
            {/*
            <button
              onClick={() => {
                if (typeof onOpenLibrary === "function") onOpenLibrary();
              }}
              aria-label={libraryLabel || "Open library"}
              title={libraryLabel || undefined}
              className="icon-button sound-button"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 0, // ✅ 2026-01-06：避免 inline baseline 造成視覺偏移
                padding: 0, // ✅ 保持純置中
              }}
            >
              {/* ✅ 2026-01-06：單字庫 icon 也用統一 holder，確保與 ExamIcon 視覺垂直對齊 *\/}
              <span
                style={{
                  width: LIB_ICON_WIDTH,
                  height: ICON_HOLDER_SIZE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 0,
                  transform: `translateY(${LIB_ICON_NUDGE_Y}px)`,
                }}
              >
                {/* ✅ 單字庫 icon：純色封面 + W（右邊不圓角） *\/}
                {/* ✅ 注意：保留舊版厚字典（B）作為 deprecated 註解，不刪除 *\/}
                <svg
                  viewBox="0 0 24 24"
                  width={LIB_ICON_WIDTH}
                  height={LIB_ICON_HEIGHT}
                  preserveAspectRatio="none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    display: "block",
                    width: LIB_ICON_WIDTH,
                    height: LIB_ICON_HEIGHT,
                  }}
                >
                  {/*
                    deprecated：舊版「圓圈＋書本」icon（保留原碼，不刪除）
                    <circle cx="12" cy="12" r="10" fill="none" />
                    <path d="M9 7.5h7.2c.7 0 1.3.6 1.3 1.3v8.9" />
                    <path d="M9 7.5c-1.1 0-2 .9-2 2v9.2c0 .8.6 1.3 1.3 1.3H17.5" />
                    <path d="M9 10h6" />
                    <path d="M9 13h6" />
                  *\/}

                  {/*
                    deprecated：2026-01-04 厚字典（B）版本（保留原碼，不刪除）
                    <path d="M6.5 5.2h10.2a2.8 2.8 0 0 1 2.8 2.8V20" />
                    <path d="M5.2 6.4v12.9A2.7 2.7 0 0 0 7.9 22H19.8" />
                    <path d="M7.6 5.2v16.6" />
                    <path d="M10.3 9.4h6.1" />
                    <path d="M10.3 12.4h6.1" />
                    <path d="M10.3 15.4h4.2" />
                    <path d="M16.8 5.2v3.0l-1.1-.7-1.1.7v-3.0" />
                  *\/}

                  {/* ✅ 2026-01-05：新版（純色封面 + W） *\/}

                  {/* ✅ 2026-01-05：內容非等比例縮放（可獨立調整長寬比例，不影響按鈕外框） *\/}
                  {/* 中文功能說明：
                    - 你希望「不同長寬」且 W 不佔滿版
                    - 透過 <g transform> 只縮放 SVG 內容（非等比），外框 width/height 不變
                    - scale(1, 0.78)：只壓扁高度；translate(0, 2)：補回視覺置中
                  *\/}
                  <g transform="translate(0 3) scale(0.78 0.86)">
                    {/* ✅ 2026-01-05：視覺高度對齊（Root cause 修正） *\/}
                    <path
                      d="M7 5H19V19H7Q4 19 4 16V8Q4 5 7 5Z"
                      fill="currentColor"
                      stroke="none"
                    />

                    {/* ✅ 2026-01-05：W 不佔滿版（上下留白更明顯） *\/}
                    {/* deprecated：舊的 W（看起來偏矮或貼邊），保留不刪除
                      <path
                        d="M8 7L10 17L12 12.2L14 17L16 7"
                        fill="none"
                        stroke="var(--card-bg)"
                        strokeWidth="2.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    *\/}
                    <path
                      d="M8.2 8.6L10.1 15.4L12 12.0L13.9 15.4L15.8 8.6"
                      fill="none"
                      stroke="var(--card-bg)"
                      strokeWidth="2.0"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                </svg>
              </span>
            </button>
            */}
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
                    // ✅ 2026-01-06：POS 切換（多詞性）事件往下傳（先只做 console 驗證）
                    // 中文功能說明：
                    // - WordCard 內部點擊 pill 時，會呼叫 onSelectPosKey(clickedPosKey)
                    // - ResultPanel 先只做 console，可確認 hasUpstreamHandler=true、事件已打通
                    // - 下一步才接 App 的 re-query（/api/analyze with targetPosKey）
                    onSelectPosKey={(clickedPosKey, meta) => {
                      // meta（若 WordCard 有傳）可包含 activePosKey / word 等，不依賴 meta 存在
                      const activePosKey =
                        meta && typeof meta.activePosKey === "string"
                          ? meta.activePosKey
                          : "";
                      const word =
                        meta && typeof meta.word === "string"
                          ? meta.word
                          : headword;
                      handleSelectPosKeyFromWordCard({
                        clickedPosKey,
                        activePosKey,
                        word,
                        idx,
                      });
                    }}
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

          {/* ✅ 2026-01-05：免責聲明容器化（水平對齊 JSON 區塊感） */}
          <div
            style={{
              marginTop: 8,
              marginBottom: 6,
              fontSize: 11,
              lineHeight: 1.35,
              opacity: 0.75,
              color: "var(--text-muted)",
              userSelect: "none",
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border-subtle)",
              background: "var(--card-bg)",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <div>{aiDisclaimerLine1Final}</div>
            <div>{aiDisclaimerLine2Final}</div>
          </div>

          {/* deprecated：舊版免責聲明（純文字、容易視覺不對齊），保留不刪除
          <div
            style={{
              marginTop: 8,
              marginBottom: 6,
              fontSize: 11,
              lineHeight: 1.35,
              opacity: 0.7,
              color: "var(--text-muted)",
              userSelect: "none",
            }}
          >
            <div>{aiDisclaimerLine1}</div>
            <div>{aiDisclaimerLine2}</div>
          </div>
          */}

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
