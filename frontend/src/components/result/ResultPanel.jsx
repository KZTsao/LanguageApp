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
 * - 2026-01-12：
 *   1) ✅ 任務 3：收藏分類 UI 低調化，並移到「單字庫 icon」左邊（更直觀、靠近入口）
 *   2) ✅ 原本放在結果區下方的分類下拉改為 DEPRECATED（保留原碼但預設不顯示）
 *   3) ✅ UI 微調：移除「分類」兩字 label（只留 select）
 *
 * 功能初始化狀態（Production 排查）：
 * - 若 onEnterTestMode 未傳入：點擊測驗 icon 只會 console 提示，不會拋錯
 * - 若 onOpenLibrary 未傳入：點擊單字庫 icon 不會拋錯
 * - 若 uiText 未提供免責聲明字串：使用內建繁中 fallback，不影響既有功能
 * - ✅ 若 WordCard 未提供 posOptions/pos UI：本檔案插入的 onSelectPosKey 不會造成錯誤（僅在 WordCard 觸發時 console）
 * - ✅ 2026-01-07：測驗 icon 已改作單字庫入口；若 onOpenLibrary 未傳入，會 console 顯示 hasHandler=false（不中斷）
 * - ✅ 2026-01-12：分類下拉若 categories 未載入：下拉 disabled，但不阻斷收藏（收藏仍走後端預設策略）
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

  // ✅ 任務 3（2026-01-12）：收藏分類（由上游 App 注入；ResultPanel 只負責 UI + 轉傳）
  favoriteCategories,
  favoriteCategoriesLoading = false,
  selectedFavoriteCategoryId,
  onSelectFavoriteCategory,

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

  // ✅ 任務 3（2026-01-12）：收藏分類 UI（預設「我的最愛1」）
  // 中文功能說明：
  // - categories 由上游（App）沿用任務2的資料來源注入
  // - ResultPanel 只提供簡單下拉與「將 category_id 轉交給 onToggleFavorite」的包裝
  // - categories 尚未載入/失敗：收藏仍可用（不帶 category_id，交由後端預設策略處理）
  const favoriteCategoryList = Array.isArray(favoriteCategories)
    ? favoriteCategories
    : [];
  const hasFavoriteCategories = favoriteCategoryList.length > 0;

  function findDefaultFavoriteCategoryIdByName(list) {
    // ✅ 預設分類：我的最愛1（依需求固定）
    const targetName = "我的最愛1";
    const hit = (list || []).find(
      (c) => c && typeof c.name === "string" && c.name.trim() === targetName
    );
    const id = hit && (hit.id ?? hit.category_id);
    const n = Number.parseInt(String(id ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const defaultFavoriteCategoryId =
    findDefaultFavoriteCategoryIdByName(favoriteCategoryList);

  // ✅ effectiveSelectedFavoriteCategoryId：優先使用上游選擇，否則 fallback 預設分類
  const effectiveSelectedFavoriteCategoryId =
    selectedFavoriteCategoryId != null
      ? Number.parseInt(String(selectedFavoriteCategoryId), 10)
      : defaultFavoriteCategoryId;

  function getEffectiveFavoriteCategoryIdForRequest() {
    const n = Number.parseInt(
      String(effectiveSelectedFavoriteCategoryId ?? ""),
      10
    );
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // ✅ 包裝：將 category_id 一起傳給上游 onToggleFavorite
  // 注意：JS function 可以多帶參數；若上游尚未使用第二參數，不會影響既有流程
  function onToggleFavoriteWithCategory(entry) {
    if (typeof onToggleFavorite !== "function") return;

    const cid = getEffectiveFavoriteCategoryIdForRequest();

    // categories 尚未載入 / 找不到預設分類：不帶 category_id（交給後端預設策略）
    if (cid == null) {
      onToggleFavorite(entry);
      return;
    }

    onToggleFavorite(entry, { category_id: cid, categoryId: cid });
  }

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

  // ✅ 2026-01-12：分類下拉（低調版）樣式常數
  // 中文功能說明：
  // - 放在「單字庫 icon」左邊，因此要很低調，不要搶 UI 主視覺
  // - 不要大 padding / border；盡量像「inline text selector」
  // - focus 時才出現淡淡底線，避免看不出可互動
  const FAVORITE_CATEGORY_INLINE_SELECT_STYLE = {
    fontSize: 12,
    lineHeight: "16px",
    padding: "0px 2px",
    margin: 0,
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "transparent",
    color: "var(--text-muted)",
    outline: "none",
    minWidth: 88,
    maxWidth: 140,
    cursor: "pointer",
  };

  // ✅ 2026-01-12：分類下拉（低調版）容器（讓它跟 icon 垂直對齊）
  const FAVORITE_CATEGORY_INLINE_WRAP_STYLE = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    opacity: 0.85,
  };

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

          {/* 右側：分類（在單字庫 icon 左邊，低調） + 單字庫 icon */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* ✅ 2026-01-12：分類下拉移到單字庫 icon 左邊（低調版） */}
            <div style={FAVORITE_CATEGORY_INLINE_WRAP_STYLE}>
              {/* 2026-01-12: hide label "分類" per UI request */}
              {/* placeholder */}
              {/* placeholder */}
              {/* placeholder */}
              <select
                data-ref="resultFavoriteCategorySelect"
                value={
                  effectiveSelectedFavoriteCategoryId != null &&
                  Number.isFinite(
                    Number.parseInt(
                      String(effectiveSelectedFavoriteCategoryId),
                      10
                    )
                  )
                    ? String(effectiveSelectedFavoriteCategoryId)
                    : ""
                }
                aria-label={t.favoriteCategoryAria || ""}
                title={t.favoriteCategoryTitle || ""}
                disabled={
                  !!favoriteCategoriesLoading ||
                  !hasFavoriteCategories ||
                  typeof onSelectFavoriteCategory !== "function"
                }
                onChange={(e) => {
                  const v =
                    e && e.target && typeof e.target.value === "string"
                      ? e.target.value
                      : "";
                  const n = Number.parseInt(String(v ?? ""), 10);
                  const nextId = Number.isFinite(n) && n > 0 ? String(n) : "";
                  if (typeof onSelectFavoriteCategory === "function") {
                    // 上游規格：string / null（沿用任務2）
                    onSelectFavoriteCategory(nextId ? nextId : null);
                  }
                }}
                style={FAVORITE_CATEGORY_INLINE_SELECT_STYLE}
                onFocus={(e) => {
                  try {
                    if (e && e.target && e.target.style) {
                      e.target.style.borderBottom =
                        "1px solid rgba(255,255,255,0.24)";
                      e.target.style.color = "var(--text)";
                    }
                  } catch (err) {}
                }}
                onBlur={(e) => {
                  try {
                    if (e && e.target && e.target.style) {
                      e.target.style.borderBottom =
                        "1px solid rgba(255,255,255,0.10)";
                      e.target.style.color = "var(--text-muted)";
                    }
                  } catch (err) {}
                }}
              >
                {!hasFavoriteCategories && <option value="">(loading)</option>}

                {hasFavoriteCategories &&
                  favoriteCategoryList.map((c) => {
                    const id = c && (c.id ?? c.category_id);
                    const name = c && c.name;
                    const n = Number.parseInt(String(id ?? ""), 10);
                    if (
                      !Number.isFinite(n) ||
                      n <= 0 ||
                      typeof name !== "string"
                    )
                      return null;
                    return (
                      <option key={String(n)} value={String(n)}>
                        {name}
                      </option>
                    );
                  })}
              </select>
            </div>

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
                lineHeight: 0,
                padding: 0,
              }}
            >
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
                  <g transform="translate(0 3) scale(0.78 0.86)">
                    <path
                      d="M7 5H19V19H7Q4 19 4 16V8Q4 5 7 5Z"
                      fill="currentColor"
                      stroke="none"
                    />
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
          {/* ✅ 2026-01-12：DEPRECATED（原本的分類下拉放在結果區下方）
              中文功能說明：
              - 你要求分類要放在單字庫 icon 左邊，因此這段不再顯示
              - 但保留原碼避免回溯/比較，未來若要放回「收藏按鈕附近」可直接解除註解
          */}
          {false && typeof onToggleFavorite === "function" && canFavorite && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 6,
                marginBottom: 10,
                justifyContent: "flex-end",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {t.favoriteCategoryLabel || "分類"}
              </span>

              <select
                data-ref="resultFavoriteCategorySelect"
                value={
                  effectiveSelectedFavoriteCategoryId != null &&
                  Number.isFinite(
                    Number.parseInt(
                      String(effectiveSelectedFavoriteCategoryId),
                      10
                    )
                  )
                    ? String(effectiveSelectedFavoriteCategoryId)
                    : ""
                }
                aria-label={t.favoriteCategoryAria || ""}
                title={t.favoriteCategoryTitle || ""}
                disabled={
                  !!favoriteCategoriesLoading ||
                  !hasFavoriteCategories ||
                  typeof onSelectFavoriteCategory !== "function"
                }
                onChange={(e) => {
                  const v =
                    e && e.target && typeof e.target.value === "string"
                      ? e.target.value
                      : "";
                  const n = Number.parseInt(String(v ?? ""), 10);
                  const nextId = Number.isFinite(n) && n > 0 ? String(n) : "";
                  if (typeof onSelectFavoriteCategory === "function") {
                    onSelectFavoriteCategory(nextId ? nextId : null);
                  }
                }}
                style={{
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "var(--card-bg)",
                  color: "var(--text)",
                  outline: "none",
                  minWidth: 140,
                }}
              >
                {!hasFavoriteCategories && <option value="">(loading)</option>}

                {hasFavoriteCategories &&
                  favoriteCategoryList.map((c) => {
                    const id = c && (c.id ?? c.category_id);
                    const name = c && c.name;
                    const n = Number.parseInt(String(id ?? ""), 10);
                    if (
                      !Number.isFinite(n) ||
                      n <= 0 ||
                      typeof name !== "string"
                    )
                      return null;
                    return (
                      <option key={String(n)} value={String(n)}>
                        {name}
                      </option>
                    );
                  })}
              </select>
            </div>
          )}

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
                    onToggleFavorite={onToggleFavoriteWithCategory}
                    onSelectPosKey={(clickedPosKey, meta) => {
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
