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
 *   4) ✅ 視覺高度再對齊：放大 W 的筆畫範圍（讓單字庫 icon 看起來高度更接近測驗 icon）
 *   5) ✅ AI 免責聲明多國漏接修正：支援 uiText.aiDisclaimerLines（array）與舊版 aiDisclaimerLine1/2（string）
 *   6) ✅ 免責聲明水平對齊：改為與 JSON 區塊一致的 padding/border/radius（白框外但視覺齊）
 *   7) ✅ 單字庫 icon 尺寸改為獨立常數（不再使用 TOOL_ICON_SIZE）
 *   8) ✅ W 不再佔滿版：調整 W path 內縮，讓上下留白更明顯
 *   9) ✅ 單字庫 icon：SVG 內容使用 g transform 非等比縮放（可獨立調整長寬比例，不影響按鈕外框）
 * - 2026-01-06：
 *   1) ✅ 兩顆 icon 視覺垂直對齊：新增統一 icon holder（固定盒 + lineHeight:0），避免 SVG 內容留白差造成「看起來不齊」
 *   2) ✅ POS 切換（多詞性）事件往下傳：插入 WordCard onSelectPosKey handler（先只做 console 驗證，不改既有查詢流程）
 * - 2026-01-07：
 *   1) ✅ 單字庫 icon（W）暫時註解隱藏（保留原碼，未來可恢復）
 *   2) ✅ 測驗（小考）icon 暫時改為「單字庫入口」（點擊改呼叫 onOpenLibrary，並加入可觀測 console）
 * - 2026-01-12：
 *   1) ✅ 任務 3：收藏分類 UI 低調化，並移到「單字庫 icon 左邊」（更直觀、靠近入口）
 *   2) ✅ 原本放在結果區下方的分類下拉改為 DEPRECATED（保留原碼但預設不顯示）
 *   3) ✅ UI 微調：移除「分類」兩字 label（只留 select）
 * - 2026-01-13：
 *   1) ✅ 任務 1：收藏分類下拉改由 WordCard slot 顯示在 FavoriteStar 上方（ResultPanel 不再放在單字庫 icon 旁）
 *   2) ✅ 不改資料流：select value/onChange/disabled 與 onToggleFavorite(category_id) 行為維持
 * - 2026-01-13：
 *   3) ✅ 任務 2-1：星號渲染支援「分類內狀態」boolean（inCategory）/ function（舊版 isFavorited(entry)）兩種模式
 * - 2026-01-16：
 *   4) ✅ B(UI) Step 2：把 pending 狀態往下傳到 WordCard（UI 只負責轉傳，不做交易邏輯）
 *      - 新增 props：isFavoritePending / getFavoriteWordKey
 *      - WordCard 會用 favoriteWordKey + isFavoritePending(wordKey) 決定 disabled
 * - 2026-01-16：
 *   5) ✅ B(UI) Step 2 修正：getFavoriteWordKey 參數形狀對齊 controller
 *      - 優先傳 entry（{ headword, canonicalPos }）給 getFavoriteWordKey
 *      - 為相容舊版，若 entry 版本取不到，再 fallback 舊的 { item, entry, idx }
 * - 2026-01-17：
 *   6) ✅ History 導覽列重排：三段式、同一高度（Prev / Current / Next 同列，中心固定）
 *      - 僅改 UI render / 排版，不新增 state、不改 flow、不改 Prev/Next 行為
 *      - 文字單行 + ellipsis，hover 顯示完整 tooltip
 * - 2026-01-18：
 *   7) ✅ 註解移除「顯示原始 JSON」按鈕與 JSON 內容（只註解保留原碼）
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
  // ✅ 2026-01-19：Task A（ResultPanel 導覽列雙路）
  // - favorites-learning 時改吃 navContext，其餘維持 history
  mode,
  learningContext,
  navContext,

  // ✅ Task F2：Favorites/Learning 例句補齊後回寫 cache（由 App 注入，ResultPanel 只轉傳）
  onExamplesResolved,

  // ✅ Task F2：控制例句 auto-refresh（由 App 注入，ResultPanel 只轉傳）
  examplesAutoRefreshEnabled,
  // ✅ 2026-01-17：History Prev/Next label（可選）
  // - 僅用於顯示「按下後會跳到的字」
  // - 不新增 state、不改 flow、不做 side effect
  // - 若上游未傳入：功能自動不啟用但不影響既有 UI
  history,
  isFavorited,
  canFavorite,
  onToggleFavorite,

  // ✅ 任務 3（2026-01-12）：收藏分類（由上游 App 注入；ResultPanel 只負責 UI + 轉傳）
  favoriteCategories,
  favoriteCategoriesLoading = false,
  selectedFavoriteCategoryId,
  onSelectFavoriteCategory,

  // ✅ 新增：測驗入口（由 App 管 view）
  onEnterTestMode,

  // ✅ 新增：清除當下回放紀錄（由 App 管 state）
  canClearHistory,
  onClearHistoryItem,
  clearHistoryLabel,

  // ✅ 2026-01-06：POS 切換（多詞性）事件往上傳（由 App 注入 handler）
  onSelectPosKeyFromApp,

  // ✅ 2026-01-16：B(UI) pending 狀態（由 controller/App 提供）
  // - isFavoritePending(wordKey)：判斷該 wordKey 是否 pending
  // - getFavoriteWordKey(entryOrKey)：由上層決定 wordKey（避免 UI 自己定義 key 規則）
  //   - ✅ 本檔案優先傳 entry（{headword, canonicalPos}）以對齊 controller
  //   - ✅ 為相容舊版（若你之前傳 meta），會 fallback { item, entry, idx }
  isFavoritePending,
  getFavoriteWordKey,
}) {

  // ============================================================
  // ✅ 2026-01-24：Init Gate（初始化完成前禁止互動）
  // - 由 App.jsx 設定 window.__appInit.blockInteraction
  // - 這裡只做「保險絲」：即使 overlay 被移除，也不會誤觸導航/事件
  // ============================================================
  const __interactionDisabled = !!(
    typeof window !== "undefined" &&
    window.__appInit &&
    window.__appInit.blockInteraction
  );

  const t = uiText || {};
  const sections = t.sections || {};
  const wordCardLabels = t.wordCard || {};
  const grammarCardLabels = t.grammarCard || {};

  const noResultText = t.noResultText || "請輸入上方欄位並按下 Analyze 開始查詢";
  const loadingText = t.loadingText || "正在分析中，請稍候…";

  const rawToggleLabelOn = t.rawToggleOn || "隱藏原始 JSON";
  const rawToggleLabelOff = t.rawToggleOff || "顯示原始 JSON";

  // ✅ 任務 3（2026-01-12）：收藏分類 UI（預設「我的最愛1」）
  // 中文功能說明：
  // - categories 由上游（App）沿用任務2的資料來源注入
  // - ResultPanel 只提供簡單下拉與「將 category_id 轉交給 onToggleFavorite」的包裝
  // - categories 尚未載入/失敗：收藏仍可用（不帶 category_id，交由後端預設策略處理）
  const favoriteCategoryList = Array.isArray(favoriteCategories) ? favoriteCategories : [];
  const hasFavoriteCategories = favoriteCategoryList.length > 0;

  function findDefaultFavoriteCategoryIdByName(list) {
    // ✅ 預設分類：我的最愛1（依需求固定）
    const targetName = "我的最愛1";
    const hit = (list || []).find((c) => c && typeof c.name === "string" && c.name.trim() === targetName);
    const id = hit && (hit.id ?? hit.category_id);
    const n = Number.parseInt(String(id ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const defaultFavoriteCategoryId = findDefaultFavoriteCategoryIdByName(favoriteCategoryList);

  // ✅ effectiveSelectedFavoriteCategoryId：優先使用上游選擇，否則 fallback 預設分類
  const effectiveSelectedFavoriteCategoryId =
    selectedFavoriteCategoryId != null
      ? Number.parseInt(String(selectedFavoriteCategoryId), 10)
      : defaultFavoriteCategoryId;

  function getEffectiveFavoriteCategoryIdForRequest() {
    const n = Number.parseInt(String(effectiveSelectedFavoriteCategoryId ?? ""), 10);
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
  const aiDisclaimerLines = Array.isArray(t.aiDisclaimerLines) ? t.aiDisclaimerLines : null;

  const aiDisclaimerLine1FromArray =
    aiDisclaimerLines && typeof aiDisclaimerLines[0] === "string" ? aiDisclaimerLines[0].trim() : "";

  const aiDisclaimerLine2FromArray =
    aiDisclaimerLines && typeof aiDisclaimerLines[1] === "string" ? aiDisclaimerLines[1].trim() : "";

  // deprecated：舊版（只吃 string key），保留不刪除
  const aiDisclaimerLine1 =
    (typeof t.aiDisclaimerLine1 === "string" && t.aiDisclaimerLine1.trim()) ||
    "⚠️ 本詞條內容由 AI 自動生成並整理，涵蓋多國語言釋義與用法。";
  const aiDisclaimerLine2 =
    (typeof t.aiDisclaimerLine2 === "string" && t.aiDisclaimerLine2.trim()) ||
    "AI 可能依語境調整釋義結構或順序，內容僅供學習參考，非傳統權威辭典。";

  // ✅ 2026-01-05：實際使用的免責聲明（優先 array，其次舊 string）
  const aiDisclaimerLine1Final = aiDisclaimerLine1FromArray || aiDisclaimerLine1;
  const aiDisclaimerLine2Final = aiDisclaimerLine2FromArray || aiDisclaimerLine2;

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
    // ✅ theme-aware underline（避免寫死 white alpha；亮/暗版都能成立）
    borderBottom: "1px solid var(--border-subtle)",
    background: "transparent",
    color: "var(--text-muted)",
    outline: "none",
    minWidth: 88,
    maxWidth: 140,
    cursor: "pointer",
    // ResultPanel.jsx 裡的 FAVORITE_CATEGORY_INLINE_SELECT_STYLE 加上：
    textAlign: "right",
    textAlignLast: "right", // Firefox 常用
    paddingRight: 2, // 讓右側不要貼邊
    unicodeBidi: "plaintext",
  };

  // ✅ 2026-01-12：分類下拉（低調版）容器（讓它跟 icon 垂直對齊）
  const FAVORITE_CATEGORY_INLINE_WRAP_STYLE = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    opacity: 0.85,
  };

  // ✅ 2026-01-13：任務 1｜收藏分類下拉搬移到 FavoriteStar 上方（由 WordCard slot 渲染）
  // 中文功能說明：
  // - 這個 JSX node 由 ResultPanel 建立（保留原資料流：value/onChange/disabled 都不變）
  // - 透過 WordCard 的 favoriteCategorySelectNode prop 放到收藏 ⭐ 上方
  // - 不改收藏資料流：仍由 onToggleFavoriteWithCategory 決定 category_id
  const favoriteCategorySelectNode =
    typeof onToggleFavorite === "function" && canFavorite ? (
      <div style={FAVORITE_CATEGORY_INLINE_WRAP_STYLE}>
        {/* 2026-01-12: hide label "分類" per UI request */}
        {/* placeholder */}
        {/* placeholder */}
        {/* placeholder */}
        <select
          data-ref="resultFavoriteCategorySelect"
          value={
            effectiveSelectedFavoriteCategoryId != null &&
            Number.isFinite(Number.parseInt(String(effectiveSelectedFavoriteCategoryId), 10))
              ? String(effectiveSelectedFavoriteCategoryId)
              : ""
          }
          aria-label={t.favoriteCategoryAria || ""}
          title={t.favoriteCategoryTitle || ""}
          disabled={!!favoriteCategoriesLoading || !hasFavoriteCategories || typeof onSelectFavoriteCategory !== "function"}
          onChange={(e) => {
            const v = e && e.target && typeof e.target.value === "string" ? e.target.value : "";
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
                // ✅ theme-aware focus underline
                e.target.style.borderBottom = "1px solid var(--border-main)";
                e.target.style.color = "var(--text)";
              }
            } catch (err) {}
          }}
          onBlur={(e) => {
            try {
              if (e && e.target && e.target.style) {
                e.target.style.borderBottom = "1px solid var(--border-subtle)";
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
              if (!Number.isFinite(n) || n <= 0 || typeof name !== "string") return null;
              return (
                <option key={String(n)} value={String(n)}>
                  {name}
                </option>
              );
            })}
        </select>
      </div>
    ) : null;

  // ✅ 2026-01-06：POS 切換（多詞性）驗證用 handler（先只做 console，不影響查詢流程）
  // 中文功能說明：
  // - 先把點擊事件「往下傳」打通，讓 WordCard 的 hasUpstreamHandler=true
  // - 這一步不做 re-query，不改結果 state，只提供可觀測 log
  const handleSelectPosKeyFromWordCard = ({ clickedPosKey, activePosKey, word, idx }) => {
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

  // ✅ 任務 2-1（2026-01-13）：星號亮/暗來源統一化
  // 中文功能說明：
  // - 舊版：isFavorited(entry) function（例如全域收藏 / 或其他策略）
  // - 新版（分類即時連動）：上游 App 可能直接傳 boolean（inCategory），例如 isFavorited={inCategory}
  // - 這裡做兼容：boolean 優先，其次 function(entry)，避免破壞既有行為
  function resolveFavoriteActive(entry) {
    if (typeof isFavorited === "boolean") return isFavorited;
    if (typeof isFavorited === "function") {
      try {
        return !!isFavorited(entry);
      } catch (err) {
        console.error("[ResultPanel] isFavorited(entry) error", err);
        return false;
      }
    }
    return false;
  }

  // ✅ 2026-01-16：B(UI) pending wordKey 決策（UI 只做「轉交」）
  // 中文功能說明：
  // - 優先由上層提供 getFavoriteWordKey(entryOrKey)，確保 wordKey 規則唯一且跨面板一致
  // - ✅ 本檔案一律先傳 entry（{headword, canonicalPos}）以對齊 controller
  // - ✅ 為相容舊版，若 entry 版本回傳空值，再 fallback 舊的 { item, entry, idx }
  // - 若未提供：回傳 null（等同不啟用 pending 鎖）
  function resolveFavoriteWordKey({ item, entry, idx }) {
    try {
      if (typeof getFavoriteWordKey !== "function") return null;

      // ✅ 優先：傳 entry（controller 端吃 entryOrKey）
      let k = null;
      try {
        k = getFavoriteWordKey(entry);
      } catch (errEntry) {
        // ignore, fallback below
      }

      // ✅ fallback：相容舊版 meta 傳法（若你還有舊的 getFavoriteWordKey 實作）
      if (!k) {
        try {
          k = getFavoriteWordKey({ item, entry, idx });
        } catch (errMeta) {
          // ignore
        }
      }

      return k || null;
    } catch (err) {
      console.error("[ResultPanel] getFavoriteWordKey error", err);
      return null;
    }
  }

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
      grammarItems = Array.isArray(result.grammar) ? result.grammar : [result.grammar];
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

  // ✅ 2026-01-17：History Prev/Next label（純顯示，不改行為、不新增 state）
  // 中文功能說明：
  // - 只在 History 導覽列顯示「按下後會跳到的字」
  // - 資料來源唯一：useHistoryFlow 的 history[] + historyIndex
  // - prevLabel：historyIndex + 1
  // - currentLabel：historyIndex
  // - nextLabel：historyIndex - 1（若為 -1 表示回 live → 無對應 item）
  // - 防呆：history 空、index 越界、live 狀態都不得報錯
  // - 若上游未傳入 history 或格式不符：自動不啟用（不影響既有 UI）
  const historyList = Array.isArray(history) ? history : null;
  const historyListLen = historyList ? historyList.length : 0;

  function pickHistoryLabel(item) {
    try {
      if (!item || typeof item !== "object") return "";
      const raw =
        (typeof item.headword === "string" && item.headword) ||
        (typeof item.text === "string" && item.text) ||
        (typeof item.query === "string" && item.query) ||
        "";
      return typeof raw === "string" ? raw.trim() : "";
    } catch (err) {
      return "";
    }
  }

  function getHistoryLabelByIndex(i) {
    try {
      if (!historyList || historyListLen <= 0) return "";
      const n = Number.parseInt(String(i ?? ""), 10);
      if (!Number.isFinite(n)) return "";
      if (n < 0 || n >= historyListLen) return "";
      return pickHistoryLabel(historyList[n]);
    } catch (err) {
      return "";
    }
  }

  const safeHistoryIndex = typeof historyIndex === "number" ? historyIndex : -1;

  const prevTargetIndex = safeHistoryIndex + 1;
  const currentTargetIndex = safeHistoryIndex;
  const nextTargetIndex = safeHistoryIndex - 1;

  const prevLabel = getHistoryLabelByIndex(prevTargetIndex);
  const currentLabel = getHistoryLabelByIndex(currentTargetIndex);
  const nextLabel = nextTargetIndex === -1 ? "" : getHistoryLabelByIndex(nextTargetIndex);

  const shouldShowHistoryNavLabels = !!historyList && historyListLen > 0;

  /**
   * ✅ 2026-01-19：Task A（ResultPanel 導覽列雙路）
   * - favorites-learning 時：導覽列資料來源改用 navContext
   * - 其他情況（search/history）：維持既有 history props
   *
   * 原則：不重寫 UI，只抽象「有效導覽資料」為 effectiveXXX
   */
  const isFavNav =
    mode === "learning" &&
    learningContext?.sourceType === "favorites" &&
    navContext?.source === "favorites";

  function pickNavLabel(v) {
    try {
      return typeof v === "string" ? v.trim() : "";
    } catch (err) {
      return "";
    }
  }

  const effectivePrevLabel = isFavNav ? pickNavLabel(navContext?.prevLabel) : prevLabel;
  const effectiveCurrentLabel = isFavNav ? pickNavLabel(navContext?.currentLabel) : currentLabel;
  const effectiveNextLabel = isFavNav ? pickNavLabel(navContext?.nextLabel) : nextLabel;

  const effectiveOnPrev = isFavNav ? navContext?.goPrev : onPrev;
  const effectiveOnNext = isFavNav ? navContext?.goNext : onNext;

  // ✅ 低調清除文案（props > fallback）
  const clearLabel = (typeof clearHistoryLabel === "string" && clearHistoryLabel.trim()) || "點擊清除該筆紀錄";
  // ✅ 2026-01-17（需求變更）：註解（移除）「點擊清除該筆紀錄」功能
  // - 保留原本 props 與 UI 程式碼（以註解方式保留），但功能不啟用
  // - 之後若要恢復：把 canClear 改回原先判斷即可
  // const canClear = !!canClearHistory && typeof onClearHistoryItem === "function";
  const canClear = false;

  // ✅ 2026-01-17：History 導覽列三段式（固定單列、同高度、中心固定不偏移）
  // 中文功能說明：
  // - 僅改 UI render / 排版，不新增 state、不改 flow、不改 Prev/Next 行為
  // - Prev/Next 必須是「箭頭+文字」同一顆按鈕
  // - 中間固定在正中央（不因左右文字長短位移）
  // - 全部單行 no-wrap；超過用 ellipsis；hover 用 title 顯示完整
  // ✅ UX：更「集中」的導覽列（降低高度/寬度，減少空白，讓按鈕更像導航而非 input）
  const HISTORY_NAV_ROW_HEIGHT = 30;
  const HISTORY_NAV_SIDE_WIDTH = 220; // 左右固定寬（可微調，但要固定）
  const HISTORY_NAV_CENTER_WIDTH = 220; // 中間固定寬（可微調，但要固定）

  const HISTORY_NAV_ROW_STYLE = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    height: HISTORY_NAV_ROW_HEIGHT,
    minHeight: HISTORY_NAV_ROW_HEIGHT,
    maxHeight: HISTORY_NAV_ROW_HEIGHT,
    whiteSpace: "nowrap",
    flexWrap: "nowrap",
  };

  const HISTORY_NAV_SIDE_BTN_BASE = {
    width: HISTORY_NAV_SIDE_WIDTH,
    minWidth: HISTORY_NAV_SIDE_WIDTH,
    maxWidth: HISTORY_NAV_SIDE_WIDTH,
    height: HISTORY_NAV_ROW_HEIGHT,
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background: "var(--card-bg)",
    color: "var(--text-main)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "0 8px",
    boxSizing: "border-box",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  const HISTORY_NAV_LABEL_ELLIPSIS = {
    display: "inline-block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: HISTORY_NAV_SIDE_WIDTH - 44, // 留給箭頭與 padding
    minWidth: 0,
    fontSize: 12,
    lineHeight: "16px",
  };

  const HISTORY_NAV_CENTER_STYLE = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    width: HISTORY_NAV_CENTER_WIDTH,
    minWidth: HISTORY_NAV_CENTER_WIDTH,
    maxWidth: HISTORY_NAV_CENTER_WIDTH,
    height: HISTORY_NAV_ROW_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "0 8px",
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background: "var(--card-bg)",
    overflow: "hidden",
    whiteSpace: "nowrap",
  };

  const HISTORY_NAV_CURRENT_TEXT_STYLE = {
    fontSize: 13,
    lineHeight: "16px",
    color: "var(--text-main)",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: HISTORY_NAV_CENTER_WIDTH - 80, // 留給 X/Y
    minWidth: 0,
  };

  const HISTORY_NAV_PAGE_STYLE = {
    fontSize: 12,
    lineHeight: "16px",
    color: "var(--text-muted)",
    opacity: 0.9,
    flex: "0 0 auto",
  };

  // X / Y（格式固定）
  // - 舊 UI 的定義：回放狀態 X = historyLength - historyIndex；live(-1) 則 X = historyLength
  const pageX =
    historyLength > 0
      ? safeHistoryIndex >= 0
        ? historyLength - safeHistoryIndex
        : historyLength
      : 0;
  const pageY = historyLength > 0 ? historyLength : 0;

  // ✅ 2026-01-19：Task A（favorites-learning）頁碼改用 navContext.index/total
  const effectivePageX = isFavNav ? (Number(navContext?.index) || 0) + 1 : pageX;
  const effectivePageY = isFavNav ? Number(navContext?.total) || 0 : pageY;

  // ✅ 2026-01-17（需求新增）：最後一頁不可再往「後一頁」切換
  // - 以目前 UI 顯示的頁碼 X / Y 為準：當 X === Y 代表在最後一頁
  const isAtLastPage = pageY > 0 && pageX === pageY;
  const canNextEffectiveHistory = !!canNext && !isAtLastPage;
  const canPrevEffectiveHistory = !!canPrev;

  // ✅ 2026-01-19：Task A
  // - favorites-learning：直接信任 navContext.canPrev/canNext（不可套 history 的最後一頁補丁）
  const canNextEffective = !__interactionDisabled && (isFavNav ? !!navContext?.canNext : canNextEffectiveHistory);
  const canPrevEffective = !__interactionDisabled && (isFavNav ? !!navContext?.canPrev : canPrevEffectiveHistory);

  // ✅ 2026-01-17（需求新增）：左右鍵快捷鍵切換前後筆歷史紀錄
  // - ArrowLeft  => 前一頁（onPrev）
  // - ArrowRight => 後一頁（onNext）
  // - 避免干擾輸入框：focus 在 input/textarea/select/contenteditable 時不觸發
  React.useEffect(() => {
    if (__interactionDisabled) return;
    function shouldIgnoreKeydown() {
      try {
        const el = document && document.activeElement;
        if (!el) return false;
        const tag = (el.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return true;
        if (typeof el.isContentEditable === "boolean" && el.isContentEditable) return true;
        return false;
      } catch (err) {
        return false;
      }
    }

    function onKeyDown(e) {
      if (!e) return;
      if (shouldIgnoreKeydown()) return;

      if (e.key === "ArrowLeft") {
        if (canPrevEffective && typeof effectiveOnPrev === "function") {
          e.preventDefault();
          effectiveOnPrev();
        }
        return;
      }

      if (e.key === "ArrowRight") {
        if (canNextEffective && typeof effectiveOnNext === "function") {
          e.preventDefault();
          effectiveOnNext();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canPrevEffective, canNextEffective, effectiveOnPrev, effectiveOnNext, __interactionDisabled]);

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

  return (
    <div
      style={{
        marginTop: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {(historyLength > 0 || isFavNav) && (
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
          {/* ✅ 2026-01-17：History 導覽列（新規格） */}
          <div style={{ width: "100%" }}>
            <div style={HISTORY_NAV_ROW_STYLE}>
              {/* Prev：箭頭 + 前一頁字（同一顆按鈕） */}
              <button
                onClick={() => {
                  if (!canPrevEffective) return;
                  if (typeof effectiveOnPrev === "function") effectiveOnPrev();
                }}
                disabled={!canPrevEffective}
                aria-label="Previous result"
                title={effectivePrevLabel || "—"}
                style={{
                  ...HISTORY_NAV_SIDE_BTN_BASE,
                  justifyContent: "flex-start",
                  cursor: canPrevEffective ? "pointer" : "not-allowed",
                  opacity: canPrevEffective ? 1 : 0.45,
                }}
              >
                <span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center" }}>
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </span>
                <span style={HISTORY_NAV_LABEL_ELLIPSIS}>{effectivePrevLabel || "—"}</span>
              </button>

              {/* Current：固定正中央（不因左右文字長短位移） */}
              <div
                style={HISTORY_NAV_CENTER_STYLE}
                title={effectiveCurrentLabel || "—"}
                aria-label={effectiveCurrentLabel || "—"}
              >
                <span style={HISTORY_NAV_CURRENT_TEXT_STYLE}>{effectiveCurrentLabel || "—"}</span>
                <span style={HISTORY_NAV_PAGE_STYLE}>
                  {effectivePageX} / {effectivePageY}
                </span>
              </div>

              {/* Next：下一頁字 + 箭頭（同一顆按鈕） */}
              <button
                onClick={() => {
                  if (!canNextEffective) return;
                  if (typeof effectiveOnNext === "function") effectiveOnNext();
                }}
                disabled={!canNextEffective}
                aria-label="Next result"
                title={effectiveNextLabel || "—"}
                style={{
                  ...HISTORY_NAV_SIDE_BTN_BASE,
                  justifyContent: "flex-end",
                  cursor: canNextEffective ? "pointer" : "not-allowed",
                  opacity: canNextEffective ? 1 : 0.45,
                }}
              >
                <span style={HISTORY_NAV_LABEL_ELLIPSIS}>{effectiveNextLabel || "—"}</span>
                <span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center" }}>
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </span>
              </button>
            </div>

            {/* ✅ 清除當下回放紀錄：仍放在導覽列附近（低調、不破壞單列導覽規格） */}
            {canClear && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
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
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------------
              DEPRECATED（2026-01-17 起停用）：
              舊版 History 導覽列（頁碼在左 + 兩顆小箭頭按鈕 + labels）
          ------------------------------------------------------------------- */}
          {false && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                {historyLength > 0 ? (historyIndex >= 0 ? historyLength - historyIndex : historyLength) : 0} /{" "}
                {historyLength}
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
              </div>
            </div>
          )}
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
          {/* ✅ 2026-01-12：DEPRECATED（原本的分類下拉放在結果區下方） */}
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
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.favoriteCategoryLabel || "分類"}</span>

              <select
                data-ref="resultFavoriteCategorySelect"
                value={
                  effectiveSelectedFavoriteCategoryId != null &&
                  Number.isFinite(Number.parseInt(String(effectiveSelectedFavoriteCategoryId), 10))
                    ? String(effectiveSelectedFavoriteCategoryId)
                    : ""
                }
                aria-label={t.favoriteCategoryAria || ""}
                title={t.favoriteCategoryTitle || ""}
                disabled={
                  !!favoriteCategoriesLoading || !hasFavoriteCategories || typeof onSelectFavoriteCategory !== "function"
                }
                onChange={(e) => {
                  const v = e && e.target && typeof e.target.value === "string" ? e.target.value : "";
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
                    if (!Number.isFinite(n) || n <= 0 || typeof name !== "string") return null;
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
                const headword = d.baseForm || d.lemma || d.word || item.text || "";
                const canonicalPos = d.partOfSpeech || "";
                const entry = { headword, canonicalPos };

                // ✅ 2026-01-16：B(UI) pending key（由上層決定）
                const favoriteWordKey = resolveFavoriteWordKey({
                  item,
                  entry,
                  idx,
                });

                return (
                  <WordCard
                    key={idx}
                    data={item}
                    labels={wordCardLabels}
                    onWordClick={onWordClick}
                    onSpeak={handleSpeak}
                    uiLang={uiLang}
                    // ✅ Task F2：Favorites/Learning examples cache 回寫 + auto-refresh 控制
                    // - ResultPanel 只負責轉傳，上游 App 才是 Single Source of Truth
                    mode={mode}
                    learningContext={learningContext}
                    onExamplesResolved={onExamplesResolved}
                    examplesAutoRefreshEnabled={examplesAutoRefreshEnabled}
                    favoriteActive={resolveFavoriteActive(entry)}
                    favoriteDisabled={!canFavorite}
                    onToggleFavorite={onToggleFavoriteWithCategory}
                    favoriteCategorySelectNode={favoriteCategorySelectNode}
                    canClearHistory={!!canClearHistory}
                    onClearHistoryItem={onClearHistoryItem}
                    favoriteWordKey={favoriteWordKey}
                    isFavoritePending={isFavoritePending}
                    onSelectPosKey={(clickedPosKey, meta) => {
                      const activePosKey = meta && typeof meta.activePosKey === "string" ? meta.activePosKey : "";
                      const word = meta && typeof meta.word === "string" ? meta.word : headword;
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

          {/* ====== 2026/01/25：Terms of Service 入口（移自 LayoutShell，避免 loading 時浮出） ====== */}
          <div
            style={{
              marginTop: 10,
              marginBottom: -2,
              paddingLeft: 12,
              paddingRight: 12,
              textAlign: "left",
              fontSize: 12,
              color: "var(--text-muted)",
              userSelect: "none",
            }}
          >
            <button
              type="button"
              onClick={() => {
                try {
                  window.dispatchEvent(new CustomEvent("open-terms"));
                } catch {}
              }}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "var(--text-muted)",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                fontWeight: 700,
              }}
            >
              {(t?.layout?.termsOfService && String(t.layout.termsOfService)) ||
                (uiLang === "zh-TW" ? "服務條款" : "Terms of Service")}
            </button>
          </div>
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

          {/* ============================================================
              ✅ 2026-01-18：DEPRECATED｜移除（註解）「顯示原始 JSON」按鈕與 JSON 內容
              - 只註解 UI render，不刪除 showRaw / onToggleRaw props（避免上游接線改動）
              - 之後若要恢復：把這段 {false && (...)} 改回原本 JSX 即可
          ============================================================ */}
          {false && (
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
          )}
        </>
      )}
    </div>
  );
}

export default ResultPanel;
// frontend/src/components/result/ResultPanel.jsx

// frontend/src/components/result/ResultPanel.jsx (end)
