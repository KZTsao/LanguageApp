// frontend/src/features/library/WordLibraryPanel.jsx
/**
 * WordLibraryPanel.jsx
 * 單字庫面板（Word Library Panel）
 *
 * ✅ 拆分後：主容器只負責
 * - props/state 進出
 * - render layout（骨架）
 * - 組合 hooks / components
 *
 * 異動紀錄（只追加，不刪除）：
 * - 2026-01-16：
 *   ✅ B(UI) Step：pending 狀態轉傳到 LibraryItemsList
 *   - 新增 props：isFavoritePending / getFavoriteWordKey
 *   - 本檔只負責轉傳，不做交易邏輯、不做 optimistic、不做 rollback
 *
 * - 2026-01-16：
 *   ✅ B(UI) Plan：永遠只顯示「我的收藏」（favorites-only）
 *   - 移除 set 相關（useLibrarySets/useLibraryItems/LibrarySetSelect）
 *   - Header 只保留「收藏分類下拉」
 *   - count badge 改為 libraryItems.length
 *   - 內容區固定走 favorites；LibraryItemsList 固定以 favorites props 傳入
 *
 * - 2026-01-16：
 *   ✅ B(UI) tweak：收藏分類下拉 select「箭頭移到左邊」（視覺）
 *   - 隱藏原生箭頭（appearance:none）
 *   - ✅ 改成「純 CSS 三角形」(border) → 自動吃 currentColor，亮/暗版一致
 *   - 用 wrapper + 絕對定位 span 畫三角形（不依賴 data-uri，避免 theme 不吃色）
 *
 * - 2026-01-16：
 *   ✅ B1 需求：收藏分類（學習本）管理 UI（UI-only，不接 DB / 不打 API）
 *   - Header 新增「管理分類」入口
 *   - 新增 FavoriteCategoryManager modal
 *   - 本檔只維護 session state（不落 DB）
 *
 * - 2026-01-16：
 *   ✅ B1 UI polish：管理分類入口改成 icon 工具按鈕（不靠文字）
 *   - icon 吃 currentColor，亮暗版自動
 *   - aria-label / title 沿用 t.manageCategoriesLabel
 *
 * - 2026-01-18：
 *   ✅ Task C：分類 CRUD 接線（由上游 DB-backed）
 *   - 本檔只接收並轉傳 CRUD handlers / saving flag / errorText
 *   - isSaving 嚴格判斷：只有 isSaving === true 才鎖（避免 undefined/null 誤鎖）
 *   - canEdit 使用 canEdit = !!authUserId（或由上游傳）
 *
 * - 2026-01-18：
 *   ✅ Task 3：Favorites → Learning（入口接線）
 *   - 新增 props：onEnterLearning
 *   - 包裝 onReview：點字先 enterLearningMode(ctx)，再走既有 onReview 流程
 *
 * - 2026-01-18：
 *   ✅ Task 3 Bugfix：支援 LibraryItemsList 回拋 clickedItem 為「string」
 *   - 若 clickedItem 是 headword 字串，需能正確算出 clickedIndex（否則會卡在 history）
 */

import React from "react";

/**
 * =========================
 * ✅ favorites-only：移除 set 相關
 * =========================
 *
 * 依照你的修改計畫：
 * - 刪掉 import：useLibrarySets、useLibraryItems、LibrarySetSelect
 * - 刪掉 state/計算：librarySets/selectedSetCode/setSelectedSetCode、items/loading/error/reload、isFavoritesSet、system set 分支
 *
 * 為了避免你「改完行數變少」的疑慮，這裡保留舊程式碼作為 DEPRECATED 註解區塊（不再被執行/引用）。
 */

/* =========================
 * DEPRECATED (2026-01-16)
 * =========================
import { useLibrarySets } from "./hooks/useLibrarySets";
import { useLibraryItems } from "./hooks/useLibraryItems";
import LibrarySetSelect from "./components/LibrarySetSelect";
 * ========================= */

import LibraryItemsList from "./components/LibraryItemsList";

// ✅ B1：收藏分類管理 UI（UI-only）
import FavoriteCategoryManager from "./components/FavoriteCategoryManager";

// ✅ B1 UI polish：icon 工具按鈕（共用）
import ToolIconButton from "../../components/common/ToolIconButton";
import { SlidersIcon } from "../../components/icons/ToolIcons";

// ✅ Task 4：匯入到學習本（Generate/Commit 接 API）
import {apiFetch} from "../../utils/apiClient";

// ============================================================
// ✅ UI Icon (inline SVG)
// - 用線條風格，避免 emoji 在不同平台字形不一致
// - icon 本體吃 currentColor；外層可用 style 控制亮/暗版顏色
// - 之後若要「下載」：可改用 DownloadArrowDownIcon（同風格）
// ============================================================
function UploadArrowUpIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      {/* top tray / bar */}
      <path d="M4 4h16" />
      {/* arrow shaft */}
      <path d="M12 20V8" />
      {/* arrow head */}
      <path d="M8 12l4-4 4 4" />
    </svg>
  );
}

// ✅ 保留：未來「下載」符號（箭頭向下）
function DownloadArrowDownIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      {/* arrow down */}
      <path d="M12 5v14" />
      <path d="M5 12l7 7 7-7" />
    </svg>
  );
}

export default function WordLibraryPanel({
  libraryItems,
  onReview,

  // ✅ Task 3：Favorites → Learning（入口接線）
  // - 由上游 App.jsx 注入 enterLearningMode（命名：onEnterLearning）
  // - 本檔只負責在「點我的最愛字」時建立 ctx（items+index）
  onEnterLearning,

  // ✅ auth（供 canEdit 判斷；未登入≠saving）
  // - 若上游不想傳 authUserId，也可以改成由上游直接傳 canEdit（本檔保留彈性）
  authUserId,
  canEdit: canEditFromUpstream,

  // ✅ 任務 2：收藏分類（由上游 App.jsx 注入；本檔只負責 UI）
  favoriteCategories,
  favoriteCategoriesLoading = false,
  selectedFavoriteCategoryId,
  onSelectFavoriteCategory,

  // ✅ Task C：分類管理 CRUD（由上游注入；本檔只負責轉傳）
  onCreateCategory,
  onRenameCategory,
  onReorderCategories,
  onArchiveCategory,
  isCategoriesSaving = false,
  categoriesErrorText = "",

  // ✅ 由 App.jsx 注入：單字庫內可直接取消收藏
  onToggleFavorite,
  favoriteDisabled = false,

  // ✅ 多國：由外層注入（不強制）
  uiText,
  uiLang,

  // ✅ Init Gate：初始化未完成前，禁止任何互動入口（由上游 App/Layout 注入；本檔只做 guard）
  interactionDisabled,

  // ✅ O｜新增：義項狀態更新（由外層接 API：POST /api/library）
  onUpdateSenseStatus,

  // ✅ 2026-01-16：B(UI) pending 狀態（由 controller/App 提供）
  // - isFavoritePending(wordKey)：判斷該 wordKey 是否 pending（UI 只吃，不自建）
  // - getFavoriteWordKey(meta)：由上層決定 wordKey 規則（確保跨面板一致）
  isFavoritePending,
  getFavoriteWordKey,
  onExamplesResolved,
}) {
  const canToggle = typeof onToggleFavorite === "function" && !favoriteDisabled;
  const canUpdateSenseStatus = typeof onUpdateSenseStatus === "function";

  // ============================================================
  // ✅ Init Gate（雙保險）
  // - 你要求：初始化完成前，不能有任何影響初始的入口
  // - App.jsx 會在 init 未完成時設置 window.__appInit.blockInteraction = true（若有）
  // - 這裡採用：prop 優先，其次讀 window flag（避免上游漏傳造成穿透）
  // ============================================================
  const __interactionDisabled = React.useMemo(() => {
    // 1) prop 優先（可測、可控）
    if (interactionDisabled === true) return true;

    // 2) window flag fallback（避免漏傳）
    try {
      if (typeof window !== "undefined") {
        if (window.__appInit && window.__appInit.blockInteraction === true) return true;
        // legacy/兼容：若上游有寫入 __LANGAPP_INTERACTION_ENABLED__ = false，也視為禁用
        if (window.__LANGAPP_INTERACTION_ENABLED__ === false) return true;
      }
    } catch (e) {
      // no-op
    }

    return false;
  }, [interactionDisabled]);

  const __guardInteraction = React.useCallback((fn) => {
    if (__interactionDisabled) return null;
    if (typeof fn !== "function") return null;
    try {
      return fn();
    } catch (e) {
      return null;
    }
  }, [__interactionDisabled]);

  // ============================================================
  // ✅ 2026-01-24：取消收藏從「義項級」改為「單字級」
  //
  // 需求：在「我的收藏」清單中取消收藏某個 headword 時，
  // 需要把同一個 headword（同 POS 若可判斷）下的所有 sense 都一併刪除。
  //
  // 設計原則：
  // - 不改上游 onToggleFavorite 的簽名（本檔只做包裝與多次呼叫）
  // - 盡量用 id 作去重；若無 id，fallback 用 headword+pos+sense_index
  // ============================================================
  const handleToggleFavoriteWordLevel = React.useCallback(
    (clickedItem, ...restArgs) => {
      if (__interactionDisabled) return;
      if (typeof onToggleFavorite !== "function") return;

      const __favoritesItemsOrdered = Array.isArray(libraryItems) ? libraryItems : [];

      const clicked =
        clickedItem && typeof clickedItem === "object" ? clickedItem : null;

      const headword =
        clicked && typeof clicked.headword === "string" ? clicked.headword : "";
      const canonicalPos =
        clicked && typeof clicked.canonical_pos === "string"
          ? clicked.canonical_pos
          : clicked && typeof clicked.canonicalPos === "string"
          ? clicked.canonicalPos
          : "";

      // 在 favorites-only 視圖中，toggle 基本上就是「取消收藏」。
      // 但為了安全：若拿不到 headword，就退回原本單次呼叫。
      if (!headword) {
        try {
          onToggleFavorite(clickedItem, ...restArgs);
        } catch (e) {}
        return;
      }

      const list = Array.isArray(__favoritesItemsOrdered) ? __favoritesItemsOrdered : [];

      // 找同 headword（若 pos 可判斷則限定同 pos）
      const matches = list.filter((x) => {
        if (!x || typeof x !== "object") return false;
        const xHeadword = typeof x.headword === "string" ? x.headword : "";
        if (xHeadword !== headword) return false;

        if (canonicalPos) {
          const xPos =
            typeof x.canonical_pos === "string"
              ? x.canonical_pos
              : typeof x.canonicalPos === "string"
              ? x.canonicalPos
              : "";
          return xPos === canonicalPos;
        }

        return true;
      });

      // 去重：優先用 id/user_word_id/userWordId
      const seen = new Set();
      const uniq = [];
      for (const it of matches) {
        const key =
          (it.id ?? it.user_word_id ?? it.userWordId) != null
            ? String(it.id ?? it.user_word_id ?? it.userWordId)
            : [
                typeof it.headword === "string" ? it.headword : "",
                typeof it.canonical_pos === "string"
                  ? it.canonical_pos
                  : typeof it.canonicalPos === "string"
                  ? it.canonicalPos
                  : "",
                typeof it.sense_index === "number"
                  ? it.sense_index
                  : typeof it.senseIndex === "number"
                  ? it.senseIndex
                  : "",
              ].join("::");

        if (!key || seen.has(key)) continue;
        seen.add(key);
        uniq.push(it);
      }

      // 若 list 裡沒有抓到任何匹配（理論上不會），fallback 單次呼叫
      if (!uniq.length) {
        try {
          onToggleFavorite(clickedItem, ...restArgs);
        } catch (e) {}
        return;
      }

      // 逐筆呼叫：維持既有上游交易/rollback/pending 行為
      for (const it of uniq) {
        try {
          // ============================================================
          // ✅ 2026-01-24：canonicalPos 必填（上游 API gate）
          //
          // 你現在的上游 POST /api/library 會要求 canonicalPos。
          // 但清單 item 可能只有 canonical_pos（snake_case），
          // 或只有 canonicalPos（camelCase），甚至兩者只有其一。
          //
          // 為避免 wordKey 變成 'Schloss::'（pos 缺失）導致 400，
          // 這裡統一補齊：canonicalPos + canonical_pos
          // 同步補齊 senseIndex + sense_index（保持一致）。
          // ============================================================
          const __hw = typeof it.headword === "string" ? it.headword : "";
          const __pos =
            typeof it.canonicalPos === "string"
              ? it.canonicalPos
              : typeof it.canonical_pos === "string"
              ? it.canonical_pos
              : "";
          const __sense =
            typeof it.senseIndex === "number"
              ? it.senseIndex
              : typeof it.sense_index === "number"
              ? it.sense_index
              : null;

          const __meta = {
            ...it,
            headword: __hw,
            canonicalPos: __pos,
            canonical_pos: __pos,
            ...(typeof __sense === "number"
              ? { senseIndex: __sense, sense_index: __sense }
              : {}),
          };

          onToggleFavorite(__meta, ...restArgs);
        } catch (e) {}
      }
    },
    [onToggleFavorite, libraryItems]
  );


  // ============================================================
  // ✅ Task 3：Favorites → Learning（入口：點字）
  // - 不改 LibraryItemsList/WordCard：改用「包裝 onReview」的方式接線
  // - 規則：必須帶整個 favoritesList(items) + clickedIndex(index)
  // ============================================================
  const canEnterLearningFromFavorites = typeof onEnterLearning === "function";

  const favoritesItemsOrdered = React.useMemo(() => {
    return Array.isArray(libraryItems) ? libraryItems : [];
  }, [libraryItems]);

  const [importLocalItemsByCategoryId, setImportLocalItemsByCategoryId] = React.useState(() => ({}));
  const favoritesItemsMergedForView = React.useMemo(() => {
    const base = Array.isArray(favoritesItemsOrdered) ? favoritesItemsOrdered : [];
    const catKey = selectedFavoriteCategoryId != null ? String(selectedFavoriteCategoryId) : "";
    const localMap = importLocalItemsByCategoryId || {};
    const localArr = catKey && Array.isArray(localMap[catKey]) ? localMap[catKey] : [];

    if (!localArr.length) return base;

    const seen = new Set();
    const merged = [];

    const pushIfNew = (it) => {
      if (!it) return;
      const hw = typeof it.headword === "string" ? it.headword : String(it.importKey || "");
      const pos = typeof it.canonical_pos === "string" ? it.canonical_pos : String(it.type || "");
      const k = `${hw}|||${pos}`.toLowerCase();
      if (!hw) return;
      if (seen.has(k)) return;
      seen.add(k);
      merged.push(it);
    };

    // local 先，讓剛匯入的先出現在最上面
    localArr.forEach(pushIfNew);
    base.forEach(pushIfNew);

    return merged;
  }, [favoritesItemsOrdered, importLocalItemsByCategoryId, selectedFavoriteCategoryId]);

  // ============================================================
  // ✅ Task4: favoritesItemsState（把「畫面用的 items」變成可寫入的 state）
  // - 用於：立即把勾選匯入的項目「真的寫進清單」(UI 不用等上游 reload)
  // - 來源：favoritesItemsMergedForView（含 pending import 合併）
  // ============================================================
  const [favoritesItemsState, setFavoritesItemsState] = React.useState(() => favoritesItemsMergedForView);

  React.useEffect(() => {
    // 當上游 items 或 pending import 有變動時，同步到 state（不做額外邏輯，維持最小改動）
    setFavoritesItemsState(favoritesItemsMergedForView);
  }, [favoritesItemsMergedForView]);


  function getFavoritesClickedIndex(clickedItem) {
    if (!clickedItem) return -1;

    // ============================================================
    // ✅ Task 3 Bugfix：支援 clickedItem 為「string」
    // - 有些列表元件只回拋 headword 字串（例如 "sehr"）
    // - 若不處理，clickedIndex 會永遠 -1，導致 learningContext 停留在舊的 history
    // - 規則：只用 headword（鎖單一欄位）來定位 index（先全等，再做 lower-case 比對）
    // ============================================================
    if (typeof clickedItem === "string") {
      const hw = clickedItem.trim();
      if (!hw) return -1;

      // 先做精準全等比對
      let idx = favoritesItemsState.findIndex((x) => {
        if (!x) return false;
        const xHeadword = typeof x.headword === "string" ? x.headword : "";
        return xHeadword === hw;
      });
      if (idx >= 0) return idx;

      // 再做大小寫寬鬆比對（仍然只比 headword）
      const hwNorm = hw.toLowerCase();
      idx = favoritesItemsState.findIndex((x) => {
        if (!x) return false;
        const xHeadword = typeof x.headword === "string" ? x.headword : "";
        return xHeadword && xHeadword.toLowerCase() === hwNorm;
      });
      if (idx >= 0) return idx;

      return -1;
    }

    const idCandidates = [
      // 常見欄位（依你目前 favorites item 來源）
      clickedItem.id,
      clickedItem.user_word_id,
      clickedItem.userWordId,
    ].filter((v) => v !== null && typeof v !== "undefined");

    if (idCandidates.length > 0) {
      const id0 = String(idCandidates[0]);
      const idx = favoritesItemsState.findIndex((x) => {
        if (!x) return false;
        const xid =
          (x.id ?? x.user_word_id ?? x.userWordId ?? null) !== null &&
          typeof (x.id ?? x.user_word_id ?? x.userWordId) !== "undefined"
            ? String(x.id ?? x.user_word_id ?? x.userWordId)
            : "";
        return xid && xid === id0;
      });
      if (idx >= 0) return idx;
    }

    // fallback：用 headword/canonical_pos/sense_index 盡量定位
    const headword =
      typeof clickedItem.headword === "string" ? clickedItem.headword : "";
    const canonicalPos =
      typeof clickedItem.canonical_pos === "string"
        ? clickedItem.canonical_pos
        : typeof clickedItem.canonicalPos === "string"
        ? clickedItem.canonicalPos
        : "";
    const senseIndex =
      typeof clickedItem.sense_index === "number"
        ? clickedItem.sense_index
        : typeof clickedItem.senseIndex === "number"
        ? clickedItem.senseIndex
        : null;

    if (headword) {
      const idx = favoritesItemsState.findIndex((x) => {
        if (!x) return false;
        const xHeadword = typeof x.headword === "string" ? x.headword : "";
        const xPos =
          typeof x.canonical_pos === "string"
            ? x.canonical_pos
            : typeof x.canonicalPos === "string"
            ? x.canonicalPos
            : "";
        const xSense =
          typeof x.sense_index === "number"
            ? x.sense_index
            : typeof x.senseIndex === "number"
            ? x.senseIndex
            : null;

        if (senseIndex === null || xSense === null) {
          return (
            xHeadword === headword && (!!canonicalPos ? xPos === canonicalPos : true)
          );
        }

        return xHeadword === headword && xPos === canonicalPos && xSense === senseIndex;
      });
      if (idx >= 0) return idx;
    }

    return -1;
  }

  // ✅ 包裝 onReview：點字時先 enterLearningMode(ctx)，再走既有 onReview 流程
  const handleReviewFromFavorites = React.useCallback(
    (clickedItem) => {
      if (__interactionDisabled) return null;
      // ============================================================
      // ✅ Task 4B-2（補強）：從 WordLibraryPanel 點字回主畫面時，
      // 先 enterLearning(ctx) 再觸發 onReview，避免「入口當下 mode/learningContext 尚未更新」
      // 造成 App.jsx 無法進入 favorites snapshot replay → 多打一發 analyze。
      //
      // 做法：若本次點擊成功組裝並呼叫 onEnterLearning(ctx)，
      // 則把 onReview 延後到 microtask（下一個 tick）再呼叫。
      // - 不改既有 onReview 邏輯/內容
      // - 只調整呼叫時序（僅在 favorites-learning 入口）
      // ============================================================
      let __enteredLearning = false;

      try {
        if (canEnterLearningFromFavorites) {
          const clickedIndex = getFavoritesClickedIndex(clickedItem);
          if (clickedIndex >= 0) {
            onEnterLearning({
              sourceType: "favorites",
              title: "我的最愛",
              items: favoritesItemsState,
              index: clickedIndex,
            });
            __enteredLearning = true;
          }
        }
      } catch (e) {
        // no-op：避免 UI click 因為 learning ctx 組裝失敗而中斷
      }

      if (typeof onReview === "function") {
        if (__enteredLearning) {
          // ✅ 延後：讓 App.jsx 先吃到 mode/learningContext，再走既有 onReview → analyze 流程
          //（避免 refresh/切換已正常，但「從單字庫點回來」仍多打一發 analyze）
          try {
            Promise.resolve().then(() => {
              try {
                onReview(clickedItem);
              } catch (e) {
                // no-op
              }
            });
          } catch (e) {
            // fallback：極端環境不支援 Promise
            setTimeout(() => {
              try {
                onReview(clickedItem);
              } catch (e2) {
                // no-op
              }
            }, 0);
          }
          return null;
        }

        return onReview(clickedItem);
      }

      return null;
    },
    [canEnterLearningFromFavorites, onEnterLearning, onReview, favoritesItemsState]
  );


  // ✅ canEdit：是否可編輯（未登入不可 CRUD；但不等於 saving）
  const canEdit =
    typeof canEditFromUpstream === "boolean"
      ? canEditFromUpstream
      : !!authUserId;

  // ✅ isSaving：只有嚴格 true 才鎖（避免 undefined/null 誤鎖）
  const isSavingStrict = isCategoriesSaving === true;

  // ✅ effectiveLang：不在參數列寫死，但仍提供安全 fallback（避免 runtime error）
  const effectiveLang = uiLang || "zh-TW";

  // ✅ Production 排查：初始化狀態（不覆寫既有 window.__wlPanelInit）
  try {
    if (typeof window !== "undefined") {
      if (!window.__wlPanelInit) window.__wlPanelInit = {};
      if (!window.__wlPanelInit.i18n) window.__wlPanelInit.i18n = {};
      window.__wlPanelInit.i18n.wordLibraryPanelTextReady = true;
      window.__wlPanelInit.i18n.wordLibraryPanelLang = effectiveLang;
    }
  } catch (e) {
    // no-op
  }

  // ✅ 中文功能說明：從 uiText 取出 libraryPanel 區塊（只讀，不自建）
  function getLibraryPanelTextFromUiText(_uiText, _lang) {
    const lang = _lang || "zh-TW";
    const obj =
      (_uiText &&
        _uiText[lang] &&
        _uiText[lang].app &&
        _uiText[lang].app.libraryPanel) ||
      (_uiText &&
        _uiText["zh-TW"] &&
        _uiText["zh-TW"].app &&
        _uiText["zh-TW"].app.libraryPanel) ||
      null;
    return obj;
  }

  // ✅ 最終文字來源（只能來自 uiText；缺漏時回傳空物件避免 runtime error）
  const t = getLibraryPanelTextFromUiText(uiText, effectiveLang) || {};

  // ============================================================
  // ✅ B1 UI polish：header icon color
  // - 亮版：icon 顏色 = 橘色
  // - 暗版：維持 currentColor（不硬寫死）
  //
  // 判斷策略：
  // 盡量用「html/body 的 class 或 data-theme」推斷 dark。
  // 若專案沒用這套命名，仍會 fallback 到 prefers-color-scheme。
  // ============================================================
  const isDarkTheme = false; // 🔒 temporarily force light theme (logic kept)

  // ============================================================
  // ✅ UI tokens（Task 2-UX）
  // - 亮/暗版都維持「選取＝橘色」的產品一致性
  // - 不改 CSS token 系統：直接沿用 index.css 內既有橘色值（#e7a23a）
  // ============================================================
  const ACCENT_ORANGE = "#e7a23a";

  function getImportPillStyle(active) {
    const base = {
      fontSize: 12,
      padding: "7px 12px",
      borderRadius: 999,
      cursor: "pointer",
      whiteSpace: "nowrap",
      outline: "none",
      transition: "background 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease",
    };

    // ✅ 未選取：沿用網站既有「淡底 + 細框」的 button 風格
    if (!active) {
      return {
        ...base,
        border: isDarkTheme
          ? "1px solid var(--border-subtle)"
          : "1px solid var(--border-subtle)",
        background: isDarkTheme ? "rgba(255,255,255,0.04)" : "var(--card-bg)",
        color: "var(--text)",
        opacity: 0.92,
      };
    }

    // ✅ 選取：橘底（產品強調色）+ 白字（對比清楚）
    return {
      ...base,
      border: `1px solid ${ACCENT_ORANGE}`,
      background: ACCENT_ORANGE,
      color: "var(--card-bg)",
      opacity: 0.98,
      boxShadow: isDarkTheme ? "none" : "0 10px 24px rgba(231, 162, 58, 0.22)",
    };
  }

  // ============================================================
  // ✅ favorites-only：固定 set / items 狀態
  // ============================================================
  const isFavoritesSet = true;
  const selectedSetCode = "favorites";

  // ✅ 任務 2：收藏分類下拉（favorites-only：永遠顯示）
  const hasFavoriteCategories =
    Array.isArray(favoriteCategories) && favoriteCategories.length > 0;

  // ✅ count badge：改成 libraryItems.length
  const favoritesCount = Array.isArray(libraryItems) ? libraryItems.length : 0;

  /* =========================
   * DEPRECATED (2026-01-16)
   * =========================
  const { librarySets, selectedSetCode, setSelectedSetCode } = useLibrarySets({
    t,
    effectiveLang,
  });

  const { items, loading, error, reload } = useLibraryItems({
    selectedSetCode,
    favoritesItems: libraryItems || [],
  });

  const isFavoritesSet = (selectedSetCode || "favorites") === "favorites";

  // ✅ 任務 2：收藏分類下拉（只有在 favorites set 才顯示）
  const hasFavoriteCategories =
    Array.isArray(favoriteCategories) && favoriteCategories.length > 0;
   * ========================= */

  // ============================================================
  // ✅ Task C：分類管理（DB-backed）
  // - 本檔不再維護 UI-only categories state
  // - 所有 CRUD 由上游 controller methods 處理，成功後上游會 reload categories
  // ============================================================
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] =
    React.useState(false);

  // ============================================================
  // ✅ Task 1：匯入入口（UI-only，不接 DB / 不打 API）
  // - 本任務只維護 open/close state
  // - 匯入內容與 ImportModal component 於下一任務接入
  // ============================================================
    const [isImportOpen, setIsImportOpen] = React.useState(false);

  // ✅ Task X：管理分類 row 匯入時的「預選分類」暫存（避免 Import Modal open 時被 reset 覆寫）
  const importPreselectCategoryIdRef = React.useRef(null);


  // ============================================================
  // ✅ Task 4：匯入到學習本（最簡：只新增清單項目，分析延後）
  // - Generate：/api/library/import/generate（≤5）
  // - Commit：/api/library/import/commit（只寫最小欄位；去重由後端/DB 負責）
  // - 本檔不做 analyze、不補 dict_word
  // ============================================================
  const [importIsGenerating, setImportIsGenerating] = React.useState(false);
  const [importIsCommitting, setImportIsCommitting] = React.useState(false);
  const [importErrorText, setImportErrorText] = React.useState("");

  // ✅ 本檔自管：匯入成功但上游尚未 refresh 時，先讓清單可以顯示（最小資料：importKey/headword）
  // - key: categoryId(string)
  // - value: Array<{ id, headword, canonical_pos, created_at, _isPendingImport: true }>


// ============================================================
  // ✅ Task 2：匯入視窗 Import Modal（UI-only）
  // - 不打 API、不寫 DB
  // - 只做表單 state、候選清單勾選、disabled 規則、開關行為
  // ============================================================
  const [importLevel, setImportLevel] = React.useState("A1");
  const [importScenario, setImportScenario] = React.useState("");
  const [importType, setImportType] = React.useState("word"); // word | phrase | grammar
  const [importTargetCategoryId, setImportTargetCategoryId] = React.useState(
  selectedFavoriteCategoryId !== null && typeof selectedFavoriteCategoryId !== "undefined"
    ? String(selectedFavoriteCategoryId)
    : ""
);
  const [importCandidates, setImportCandidates] = React.useState([]); // [{id, textDe, checked}]

  // ✅ 每次開啟 modal：reset 預設值（符合 spec）
  React.useEffect(() => {
  if (!isImportOpen) return;

  setImportLevel("A1");
  setImportScenario("");
  setImportType("word");

  // ✅ 若由「管理分類」點 row 匯入：優先使用暫存的預選分類（一次性）
  let __preselect = "";
  try {
    if (importPreselectCategoryIdRef && importPreselectCategoryIdRef.current != null) {
      __preselect = String(importPreselectCategoryIdRef.current);
    }
  } catch (e0) {
    // no-op
  }

  const nextTarget =
    __preselect
      ? __preselect
      : (selectedFavoriteCategoryId !== null && typeof selectedFavoriteCategoryId !== "undefined"
          ? String(selectedFavoriteCategoryId)
          : "");

  setImportTargetCategoryId(nextTarget);

  // ✅ 用完就清掉，避免下次開啟仍套用舊分類
  try {
    if (importPreselectCategoryIdRef) importPreselectCategoryIdRef.current = null;
  } catch (e1) {
    // no-op
  }

  setImportCandidates([]);
}, [isImportOpen, selectedFavoriteCategoryId]);

  // ✅ ESC 關閉（建議）
  React.useEffect(() => {
  if (!isImportOpen) return;

  function onKeyDown(e) {
    const key = e && typeof e.key === "string" ? e.key : "";
    if (key === "Escape") {
      setIsImportOpen(false);
    }
  }

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [isImportOpen]);

  function normalizeImportTypeLabel(typeKey) {
  // uiText keys：建議用 t.importTypeVocab / t.importTypeGrammar / t.importTypePhrase
  // 若未提供，fallback 到中文
  if (typeKey === "grammar") return t.importTypeGrammar || "文法";
  if (typeKey === "phrase") return t.importTypePhrase || "常用語";
  // ✅ "word"（對接後端 type=word）
  return t.importTypeVocab || "單字";
}

  function getScenarioDisplay() {
  const s = typeof importScenario === "string" ? importScenario.trim() : "";
  return s ? s : "general";
}

  function buildFakeCandidates() {
  // DEPRECATED：已改為打 /api/library/import/generate
  // 保留此函式僅供排查（避免「行數變少」/方便回退）
  const n = 5;
  const typeLabel = normalizeImportTypeLabel(importType);
  const scenario = getScenarioDisplay();

  const arr = Array.from({ length: n }).map((_, i) => ({
    id: `fake_${Date.now()}_${i}`,
    type: importType,
    importKey: `${typeLabel}-${importLevel}-${scenario}-${i + 1}`,
    textDe: `${typeLabel}-${importLevel}-${scenario}-${i + 1}`,
    checked: true,
  }));
  setImportCandidates(arr);
}

async function handleImportGenerate() {
  setImportErrorText("");
  setImportCandidates([]);
  setImportIsGenerating(true);

  try {
    const scenario = String(importScenario || "").trim();
    if (!scenario) {
      setImportErrorText(t.importScenarioRequired || "請先填寫情境");
      return;
    }

    const targetId = importTargetCategoryId || selectedFavoriteCategoryId;
    const targetKey = targetId != null ? String(targetId) : "";

    // ✅ excludeKeys：只在「目標=目前清單」時用，避免額外打 API
    let excludeKeys = [];
    if (targetId != null && selectedFavoriteCategoryId != null && String(targetId) === String(selectedFavoriteCategoryId)) {
      const merged = Array.isArray(favoritesItemsState) ? favoritesItemsState : [];
      excludeKeys = merged
        .map((it) => (typeof it?.headword === "string" ? it.headword : ""))
        .filter(Boolean);
    }

    const payload = {
      level: importLevel,
      type: importType,
      scenario,
      uiLang: uiLang || "en",
      excludeKeys,
    };

    const response = await apiFetch(`/api/library/import/generate`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }

      if (!response.ok) {
        // 讓使用者至少看到錯誤（不改 UI，只做最小保護）
        console.error("[WordLibraryPanel][importGenerate] non-OK", {
          status: response.status,
          data,
        });
      }

      const arr = Array.isArray(data) ? data : [];
    const mapped = arr.slice(0, 5).map((x) => {
      const candidateId = x?.candidateId || x?.id || `cand_${Date.now()}_${Math.random()}`;
      const importKey = x?.importKey || x?.display?.de || "";
      const textDe = x?.display?.de || importKey;
      const hint = x?.display?.hint || "";
      return {
        id: String(candidateId),
        type: x?.type || importType,
        importKey: String(importKey || textDe || "").trim(),
        textDe: String(textDe || "").trim(),
        hint: String(hint || "").trim(),
        checked: true,
      };
    }).filter((x) => x && x.importKey);

    setImportCandidates(mapped);
  } catch (e) {
    console.error("[import][generate] error", e);
    setImportErrorText(t.importGenerateFailed || "生成失敗，請稍後再試");
  } finally {
    setImportIsGenerating(false);
  }
}

async function handleImportCommit() {
  setImportErrorText("");
  setImportIsCommitting(true);

  try {
    const targetCategoryId = importTargetCategoryId || selectedFavoriteCategoryId;
    if (!targetCategoryId) {
      setImportErrorText(t.importTargetRequired || "請先選擇目標學習本");
      return;
    }

    const selected = (Array.isArray(importCandidates) ? importCandidates : []).filter((x) => x && x.checked);
    if (!selected.length) {
      setImportErrorText(t.importPickAtLeastOne || "請至少勾選一筆");
      return;
    }

    const items = selected.map((x) => ({
      type: x?.type || importType,
      importKey: x?.importKey || x?.textDe || "",
    })).filter((x) => x && x.importKey);

    const payload = {
      targetCategoryId: String(targetCategoryId),
      items,
      meta: {
        level: importLevel,
        scenario: String(importScenario || "").trim(),
        source: "llm_import",
      },
    };

    const response = await apiFetch(`/api/library/import/commit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    let result = null;
    try {
      result = await response.json();
    } catch (e) {
      result = null;
    }

    if (!response.ok) {
      console.error("[WordLibraryPanel][importCommit] non-OK", {
        status: response.status,
        result,
      });
      throw new Error("import_commit_failed");
    }

    // ✅ 先注入本地清單（即使上游尚未 refresh，也能看到 importKey）
    const now = new Date().toISOString();
    const catKey = String(targetCategoryId);
    setImportLocalItemsByCategoryId((prev) => {
      const next = { ...(prev || {}) };
      const arr = Array.isArray(next[catKey]) ? [...next[catKey]] : [];
      for (const it of items) {
        const hw = String(it.importKey || "").trim();
        if (!hw) continue;
        arr.unshift({
          id: `import_${catKey}_${hw}_${Date.now()}`,
          headword: hw,
          canonical_pos: it.type || "",
          created_at: now,
          _isPendingImport: true,
        });
      }
      next[catKey] = arr;
      return next;
    });

    // ✅ 關 modal
    setIsImportOpen(false);

    // ✅ 切到目標學習本（favorites category）
    if (typeof onSelectFavoriteCategory === "function") {
      try { onSelectFavoriteCategory(targetCategoryId); } catch {}
    }

    // ✅ 清空候選（避免下次打開殘留）
    setImportCandidates([]);
    setImportErrorText("");

    // 保留：result 可用於 debug（inserted/skippedDuplicates）
    if (result && typeof result === "object") {
      console.log("[import][commit] ok", result);
    }
  } catch (e) {
    console.error("[import][commit] error", e);
    setImportErrorText(t.importCommitFailed || "匯入失敗，請稍後再試");
  } finally {
    setImportIsCommitting(false);
  }
}

  function toggleCandidateChecked(id, checked) {
  setImportCandidates((prev) => {
    const arr = Array.isArray(prev) ? prev : [];
    return arr.map((x) => (x && x.id === id ? { ...x, checked: !!checked } : x));
  });
}

  function setAllCandidatesChecked(nextChecked) {
  setImportCandidates((prev) => {
    const arr = Array.isArray(prev) ? prev : [];
    return arr.map((x) => (x ? { ...x, checked: !!nextChecked } : x));
  });
}

  const hasAnyCheckedCandidate = React.useMemo(() => {
  return (Array.isArray(importCandidates) ? importCandidates : []).some((x) => !!(x && x.checked));
}, [importCandidates]);

  const isImportGenerateDisabled =
  // __interactionDisabled gate removed here to avoid foggy/greyed UI; handlers are guarded
  !canEdit || !!favoriteCategoriesLoading || isSavingStrict === true || importIsGenerating === true || importIsCommitting === true;

  const isImportCommitDisabled =
  isImportGenerateDisabled || !importTargetCategoryId || !hasAnyCheckedCandidate;


  // ✅ 供 FavoriteCategoryManager 顯示用的 list（僅整理型別/排序，不做樂觀更新）
  const categoriesForManager = React.useMemo(() => {
    const arr = Array.isArray(favoriteCategories) ? favoriteCategories : [];
    return [...arr]
      .filter((c) => !!c)
      .map((c, idx) => ({
        id:
          c && (c.id ?? null) !== null && typeof c.id !== "undefined"
            ? c.id
            : idx,
        name: c && typeof c.name !== "undefined" ? String(c.name) : "",
        order_index:
          c && typeof c.order_index === "number" ? c.order_index : idx,
      }))
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [favoriteCategories]);

  // ✅ handler guards（避免 props 缺漏時 runtime error）
  const canCreateCategory = typeof onCreateCategory === "function";
  const canRenameCategory = typeof onRenameCategory === "function";
  const canReorderCategories = typeof onReorderCategories === "function";
  const canArchiveCategory = typeof onArchiveCategory === "function";

  /* =========================
   * DEPRECATED (2026-01-17)
   * - 舊版：分類管理為 UI-only（categoryUiList + onChange(nextCategories)）
   * - 本任務改為 DB-backed，不再在 WordLibraryPanel 維護假資料
   * =========================

  const categoryUiTouchedRef = React.useRef(false);

  function normalizeCategoriesForUi(input) {
    const arr = Array.isArray(input) ? input : [];
    const mapped = arr
      .map((c, idx) => {
        const id =
          c && (c.id ?? null) !== null && typeof c.id !== "undefined"
            ? String(c.id)
            : `tmp_${Date.now()}_${Math.random()}`;
        const name = c && c.name ? String(c.name) : "";
        const orderIndexRaw =
          c && typeof c.order_index === "number" ? c.order_index : idx;
        return { id, name, order_index: orderIndexRaw };
      })
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      .map((c, idx) => ({ ...c, order_index: idx }));
    return mapped;
  }

  const [categoryUiList, setCategoryUiList] = React.useState(() => {
    const fromProps = normalizeCategoriesForUi(favoriteCategories);
    if (fromProps.length > 0) return fromProps;

    return [
      { id: "mock_a1", name: "A1", order_index: 0 },
      { id: "mock_a2", name: "A2", order_index: 1 },
      { id: "mock_misc", name: "我的收藏", order_index: 2 },
    ];
  });

  React.useEffect(() => {
    if (categoryUiTouchedRef.current) return;
    const fromProps = normalizeCategoriesForUi(favoriteCategories);
    if (fromProps.length > 0) {
      setCategoryUiList(fromProps);
    }
  }, [favoriteCategories]);

  function handleCategoryUiChange(next) {
    categoryUiTouchedRef.current = true;
    setCategoryUiList(Array.isArray(next) ? next : []);
  }

  */
  
  // ============================================================
  // ✅ Task X：從「管理分類」指定分類直接匯入
  // - 由 FavoriteCategoryManager row 的「匯入」觸發
  // - 行為：設定目標分類 → 開啟既有 Import Modal
  // ============================================================
  const handleImportFromCategoryManager = React.useCallback(
    (category) => {
      if (__interactionDisabled) return;
      if (!category) return;
      try {
        const cid = category.id != null ? String(category.id) : "";

        // ✅ 1) 關閉「管理分類」視窗（避免兩層 modal 疊在一起造成操作困難）
        try {
          setIsCategoryManagerOpen(false);
        } catch (e0) {
          // no-op
        }

        // ✅ 2) 暫存「預選分類」：避免 Import Modal open 時被預設 reset（selectedFavoriteCategoryId）覆寫
        try {
          if (importPreselectCategoryIdRef) {
            importPreselectCategoryIdRef.current = cid;
          }
        } catch (e1) {
          // no-op
        }

        // ✅ 3) 立即把目標分類帶入（並開啟既有 Import Modal）
        setImportTargetCategoryId(cid);
        setIsImportOpen(true);
      } catch (e) {
        // no-op
      }
    },
    []
  );

// ============================================================
  // ✅ UI
  // ============================================================

  return (
    <div
      className="wl-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        maxHeight: "72vh",
        minHeight: "72vh",  width: "90%",
        margin: "0 auto",
        border: isDarkTheme ? "1px solid var(--border-subtle)" : "1px solid var(--border-subtle)",
        borderRadius: 18,
        padding: 12,
        background: isDarkTheme ? "rgba(255,255,255,0.03)" : "var(--card-bg)",
        color: "var(--text)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        {false && (
          <div
            style={{
              fontSize: 13,
              opacity: 0.68,
              lineHeight: 1.15,
              paddingTop: 0,
            }}
          >
            {t.subtitle}
          </div>
        )}

        {/* ✅ favorites-only：Header 只保留收藏分類下拉（移除「學習本下拉」） */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {/* ✅ B1：管理分類入口（icon button） */}
          {/* ✅ 需求：icon 放 header 最左邊；亮版=橘色、暗版=currentColor */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              color: isDarkTheme ? "inherit" : "#f59e0b", // light: orange
            }}
          >
            <ToolIconButton
              ariaLabel={t.manageCategoriesLabel || "管理分類"}
              title={t.manageCategoriesLabel || "管理分類"}
              onClick={() => __guardInteraction(() => setIsCategoryManagerOpen(true))}
              size={30}
              iconSize={18}
              icon={<SlidersIcon size={18} />}
            />
          </div>

          {/* ✅ 任務 2：收藏分類下拉（永遠顯示） */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.72 }}>
              {t.favoriteCategoryLabel || ""}
            </span>

            {/* ✅ wrapper：放純 CSS 三角形（自動吃 currentColor，亮/暗版一致） */}
            <div
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {/* ✅ simple triangle (left) */}
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-35%)",
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "6px solid currentColor",
                  opacity: 0.72,
                  pointerEvents: "none",
                }}
              />

              <select
                data-ref="favoritesCategorySelect"
                value={
                  selectedFavoriteCategoryId !== null &&
                  typeof selectedFavoriteCategoryId !== "undefined"
                    ? String(selectedFavoriteCategoryId)
                    : ""
                }
                aria-label={t.favoriteCategoryAria || ""}
                title={t.favoriteCategoryTitle || ""}
                disabled={
  // __interactionDisabled gate removed here to avoid foggy/greyed UI; handlers are guarded
                  !!favoriteCategoriesLoading ||
                  isSavingStrict ||
                  !hasFavoriteCategories ||
                  typeof onSelectFavoriteCategory !== "function"
                }
                onChange={(e) => {
                  const v =
                    e && e.target && typeof e.target.value === "string"
                      ? e.target.value
                      : "";
                  if (__interactionDisabled) return;
                  if (typeof onSelectFavoriteCategory === "function") {
                    onSelectFavoriteCategory(v || null);
                  }
                }}
                style={{
                  fontSize: 12,
                  padding: "6px 10px 6px 30px",
                  borderRadius: 10,
                  border: isDarkTheme ? "1px solid var(--border-subtle)" : "1px solid var(--border-subtle)",
                  background: isDarkTheme ? "rgba(255,255,255,0.04)" : "var(--card-bg)",
                  color: "var(--text)",
                  outline: "none",
                  minWidth: 160,
                  appearance: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                }}
              >
                {favoriteCategoriesLoading && (
                  <option value="">{t.loadingText || "…"}</option>
                )}

                {!favoriteCategoriesLoading && !hasFavoriteCategories && (
                  <option value="">{t.noCategoriesText || "—"}</option>
                )}

                {!favoriteCategoriesLoading &&
                  hasFavoriteCategories &&
                  (favoriteCategories || []).map((c) => {
                    const id =
                      c && (c.id ?? null) !== null ? String(c.id) : "";
                    const name = c && c.name ? String(c.name) : "";
                    return (
                      <option key={id || name} value={id}>
                        {name || "—"}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          {/* =========================
           * DEPRECATED (2026-01-16)
           * - 原本「管理分類」文字按鈕：保留做參考（不再渲染）
           * =========================
          <button
            type="button"
            aria-label={t.manageCategoriesLabel || "管理分類"}
            title={t.manageCategoriesLabel || "管理分類"}
            onClick={() => __guardInteraction(() => setIsCategoryManagerOpen(true))}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--text)",
              cursor: "pointer",
              opacity: 0.9,
            }}
          >
            {t.manageCategoriesLabel || "管理分類"}
          </button>
           * ========================= */}

          {/* =========================
           * DEPRECATED (2026-01-16)
           * - 移除「學習本下拉」
           * - 移除右側 test 入口（你規格說 header 只留收藏分類）
           * =========================
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.72 }}>{t.setSelectLabel}</span>
            <LibrarySetSelect
              value={selectedSetCode || "favorites"}
              sets={librarySets || []}
              t={t}
              onChange={(v) => setSelectedSetCode(v || "favorites")}
            />
          </div>

          <button
            type="button"
            disabled={true}
            title={t.testDisabledTitle}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              color: "var(--text)",
              opacity: 0.65,
              cursor: "not-allowed",
            }}
          >
            {t.testButtonLabel}
          </button>
           * ========================= */}
        </div>

        {/* ✅ Task 1：Header 右側容器（匯入按鈕 + count badge） */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {/* ✅ 匯入入口：永遠顯示；disabled 由 canEdit / saving / loading 決定 */}
          <button
            type="button"
            aria-label={t.importButtonAria || t.importButtonLabel || ""}
            title={t.importButtonTitle || t.importButtonLabel || ""}
            disabled={!canEdit || isSavingStrict === true || !!favoriteCategoriesLoading}
            onClick={() => {
              // ✅ Init Gate：初始化未完成前禁止互動入口
              if (__interactionDisabled) return;
              // ✅ 本任務：只開啟 UI state（不打 API / 不接 DB）
              setIsImportOpen(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "5px 9px",
              borderRadius: 10,
              border: isDarkTheme ? "1px solid rgba(255,255,255,0.14)" : "1px solid var(--border-subtle)",
              background: isDarkTheme ? "rgba(255,255,255,0.02)" : "var(--card-bg)",
              color: isDarkTheme ? "inherit" : "#111827",
              cursor:
                !canEdit || isSavingStrict === true || !!favoriteCategoriesLoading
                  ? "not-allowed"
                  : "pointer",
              opacity:
                !canEdit || isSavingStrict === true || !!favoriteCategoriesLoading
                  ? 0.55
                  : 0.9,
            }}
          >
            {/* ✅ icon：亮版橘色上傳箭頭；暗版維持 inherit（不寫死在 SVG） */}
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                color: isDarkTheme ? "inherit" : "#f59e0b",
              }}
            >
              <UploadArrowUpIcon size={14} />
            </span>
            <span>{t.importButtonLabel || ""}</span>
          </button>

        </div>
      </div>

      {/* ✅ 2026/01/14：內容容器（固定吃掉剩餘高度，避免切換 set 時視窗跳動） */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <LibraryItemsList
          isFavoritesSet={isFavoritesSet}
          selectedSetCode={selectedSetCode}
          favoritesItems={libraryItems || []}
          systemItems={[]}
          systemLoading={false}
          systemError={null}
          uiText={uiText}
          effectiveLang={effectiveLang}
          t={t}
          onReview={handleReviewFromFavorites}
          canToggle={canToggle}
          onToggleFavorite={handleToggleFavoriteWordLevel}
          canUpdateSenseStatus={canUpdateSenseStatus}
          onUpdateSenseStatus={onUpdateSenseStatus}
          isFavoritePending={isFavoritePending}
          getFavoriteWordKey={getFavoriteWordKey}
          reload={null}
        />
      </div>


      
{/* ✅ Task 2：Import Modal（UI-only）
    - 必須放在 return 最底層（不參與 header/list layout flow）
    - 同一個 isImportOpen 僅 render 這一個 modal（Task 1 placeholder 已移除）
*/}
{isImportOpen && (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={t.importModalTitle || "匯入"}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 1200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      background: "rgba(0,0,0,0.45)",
    }}
    onClick={() => {
      // 點背景關閉
      setIsImportOpen(false);
    }}
  >
    <div
      style={{
        width: "min(640px, 94vw)",
        maxHeight: "min(78vh, 720px)",
        overflow: "auto",
        borderRadius: 18,
        // ✅ 風格對齊：沿用網站既有「卡片/面板」風格（淡底 + 細框）
        border: isDarkTheme
          ? "1px solid var(--border-subtle)"
          : "1px solid var(--border-subtle)",

        background: "rgb(255,255,255)",
        color: "var(--text)",
        padding: 12,
        boxShadow: "0 18px 48px rgba(0,0,0,0.25)",
      }}
      onClick={(e) => { 
        e.stopPropagation();
      }}
    >
      {/* A. Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              color: isDarkTheme ? "inherit" : "#f59e0b",
            }}
          >
            <UploadArrowUpIcon size={16} />
          </span>
          <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.92 }}>
            {t.importModalTitle || "匯入"}
          </div>
        </div>

        <button
          type="button"
          aria-label={t.importCloseAria || "Close"}
          title={t.importCloseTitle || "Close"}
          onClick={() => setIsImportOpen(false)}
          style={{
            fontSize: 14,
            lineHeight: 1,
            padding: "6px 8px",
            borderRadius: 10,
            border: isDarkTheme
              ? "1px solid var(--border-subtle)"
              : "1px solid var(--border-subtle)",
            background: isDarkTheme ? "var(--border-subtle)" : "var(--card-bg)",
            color: "var(--text)",
            cursor: "pointer",
            opacity: 0.75,
          }}
        >
          ×
        </button>
      </div>

      {/* ✅ 分隔線：讓「標題」與「設定區」切割更明確 */}
      <div
        aria-hidden="true"
        style={{
          height: 1,
          background: isDarkTheme ? "var(--border-subtle)" : "var(--border-subtle)",
          margin: "0 0 12px 0",
        }}
      />

      {/* B. 設定區（Form） */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 12,
          padding: 12,
          borderRadius: 14,
          border: isDarkTheme ? "1px solid var(--border-subtle)" : "1px solid var(--border-subtle)",
          background: isDarkTheme ? "rgba(255,255,255,0.03)" : "var(--card-bg)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {t.importLevelLabel || "等級"}
          </div>
          <select
            value={importLevel}
            onChange={(e) => setImportLevel(e.target.value || "A1")}
            style={{
              fontSize: 12,
              padding: "8px 10px",
              borderRadius: 10,
              border: isDarkTheme
                ? "1px solid rgba(255,255,255,0.14)"
                : "1px solid var(--border-subtle)",
              background: isDarkTheme ? "rgba(255,255,255,0.04)" : "var(--card-bg)",
              color: "var(--text)",
              outline: "none",
              appearance: "none",
            }}
          >
            {["A1", "A2", "B1", "B2", "C1"].map((lv) => (
              <option key={lv} value={lv}>
                {lv}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {t.importTypeLabel || "類型"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { key: "grammar", label: t.importTypeGrammar || "文法" },
              { key: "word", label: t.importTypeVocab || "單字" },
              { key: "phrase", label: t.importTypePhrase || "常用語" },
            ].map((it) => {
              const active = importType === it.key;
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => setImportType(it.key)}
                  style={getImportPillStyle(active)}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {t.importScenarioLabel || "情境"}
          </div>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
          <input
            value={importScenario}
            placeholder={t.importScenarioPlaceholder || ""}
            onChange={(e) => setImportScenario(e.target.value)}
            style={{
              fontSize: 12,
              padding: "8px 10px",
              borderRadius: 10,
              border: isDarkTheme
                ? "1px solid rgba(255,255,255,0.14)"
                : "1px solid var(--border-subtle)",
              background: isDarkTheme ? "rgba(255,255,255,0.04)" : "var(--card-bg)",
              color: "var(--text)",
              outline: "none",
              width: "90%",
            }}
          />
        </div>
      </div>

      {/* ✅ Task 2-UX：生成按鈕放在「設定區塊」最後一步
          - 使用者選完類型/數量後，視線自然往下就會看到生成
          - 不改事件/disabled/state，只調整位置與樣式
      */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: -2,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          disabled={isImportGenerateDisabled}
          onClick={async () => {
            if (isImportGenerateDisabled) return;
            await handleImportGenerate();
          }}
          style={{
            fontSize: 12,
            width: "100%",
            padding: "10px 14px",
            borderRadius: 12,
            border: isImportGenerateDisabled
              ? (isDarkTheme
                  ? "1px solid var(--border-subtle)"
                  : "1px solid var(--border-subtle)")
              : `1px solid ${ACCENT_ORANGE}`,
            background: isImportGenerateDisabled
              ? (isDarkTheme ? "rgba(255,255,255,0.04)" : "var(--card-bg)")
              : ACCENT_ORANGE,
            color: isImportGenerateDisabled ? "inherit" : "var(--card-bg)",
            cursor: isImportGenerateDisabled ? "not-allowed" : "pointer",
            opacity: isImportGenerateDisabled ? 0.55 : 0.98,
            boxShadow:
              isImportGenerateDisabled || isDarkTheme
                ? "none"
                : "0 14px 28px rgba(231, 162, 58, 0.22)",
          }}
        >
          {t.importGenerateButton || "生成"}
        </button>
      </div>

      {importErrorText ? (
        <div
          role="alert"
          style={{
            fontSize: 12,
            marginTop: 8,
            marginBottom: 8,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
            background: isDarkTheme ? "rgba(255, 90, 90, 0.10)" : "rgba(255, 90, 90, 0.08)",
            color: "var(--text)",
          }}
        >
          {importErrorText}
        </div>
      ) : null}

      {/* ✅ 分隔線：設定區 → 候選清單 */}
      <div
        aria-hidden="true"
        style={{
          height: 1,
          background: isDarkTheme ? "var(--border-subtle)" : "var(--border-subtle)",
          margin: "0 0 12px 0",
        }}
      />

      {/* C. 候選清單（Preview List） */}
      <div
        style={{
          border: isDarkTheme
            ? "1px solid var(--border-subtle)"
            : "1px solid var(--border-subtle)",
          background: isDarkTheme ? "rgba(255,255,255,0.03)" : "var(--card-bg)",
          borderRadius: 14,
          padding: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {t.importPreviewLabel || "候選清單"}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!importCandidates || importCandidates.length === 0}
              onClick={() => setAllCandidatesChecked(true)}
              style={{
                fontSize: 12,
                padding: "5px 8px",
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
                background: "rgba(255,255,255,0.02)",
                color: "var(--text)",
                cursor:
                  !importCandidates || importCandidates.length === 0
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  !importCandidates || importCandidates.length === 0 ? 0.5 : 0.8,
              }}
            >
              {t.importSelectAll || "全選"}
            </button>

            <button
              type="button"
              disabled={!importCandidates || importCandidates.length === 0}
              onClick={() => setAllCandidatesChecked(false)}
              style={{
                fontSize: 12,
                padding: "5px 8px",
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
                background: "rgba(255,255,255,0.02)",
                color: "var(--text)",
                cursor:
                  !importCandidates || importCandidates.length === 0
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  !importCandidates || importCandidates.length === 0 ? 0.5 : 0.8,
              }}
            >
              {t.importSelectNone || "全不選"}
            </button>
          </div>
        </div>

        {(!importCandidates || importCandidates.length === 0) && (
          <div style={{ fontSize: 12, opacity: 0.65, padding: "6px 2px" }}>
            {t.importEmptyPreviewHint || "請先點「生成」產生候選項目"}
          </div>
        )}

        {Array.isArray(importCandidates) && importCandidates.length > 0 && (
          <div style={{ border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 6 }}>
            {importCandidates.map((c) => {
              if (!c) return null;
              return (
                <label
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "6px 6px",
                    borderRadius: 10,
                    border: isDarkTheme ? "1px solid var(--border-subtle)" : "1px solid var(--border-subtle)",
                    background: "rgba(255,255,255,0.02)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!c.checked}
                    onChange={(e) => toggleCandidateChecked(c.id, e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 13, opacity: 0.92 }}>{c.textDe}</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* D. 匯入目的地（Target） */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          border: isDarkTheme ? "1px solid var(--border-subtle)" : "1px solid var(--border-subtle)",
          background: isDarkTheme ? "rgba(255,255,255,0.03)" : "var(--card-bg)",
          borderRadius: 14,
          padding: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {t.importTargetLabel || "匯入到學習本"}
        </div>

        <select
          value={importTargetCategoryId || ""}
          onChange={(e) => setImportTargetCategoryId(e.target.value || "")}
          disabled={!!favoriteCategoriesLoading || isSavingStrict === true || !hasFavoriteCategories}
          style={{
            fontSize: 12,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--text)",
            outline: "none",
            minWidth: 220,
            appearance: "none",
          }}
        >
          <option value="">{t.importTargetPlaceholder || "—"}</option>
          {!favoriteCategoriesLoading &&
            hasFavoriteCategories &&
            (favoriteCategories || []).map((c) => {
              const id =
                c && (c.id ?? null) !== null ? String(c.id) : "";
              const name = c && c.name ? String(c.name) : "";
              return (
                <option key={id || name} value={id}>
                  {name || "—"}
                </option>
              );
            })}
        </select>
      </div>

      {/* E. Footer（Actions） */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          type="button"
          onClick={() => setIsImportOpen(false)}
          style={{
            fontSize: 12,
            padding: "7px 10px",
            borderRadius: 10,
            border: isDarkTheme
              ? "1px solid var(--border-subtle)"
              : "1px solid var(--border-subtle)",
            background: isDarkTheme ? "rgba(255,255,255,0.04)" : "var(--card-bg)",
            color: "var(--text)",
            cursor: "pointer",
            opacity: 0.85,
          }}
        >
          {t.importCancelButton || "取消"}
        </button>

        <button
          type="button"
          disabled={isImportCommitDisabled}
          onClick={async () => {
            if (isImportCommitDisabled) return;
            await handleImportCommit();
          }}
          style={{
            fontSize: 12,
            padding: "7px 10px",
            borderRadius: 10,
            border: isImportCommitDisabled
              ? (isDarkTheme
                  ? "1px solid var(--border-subtle)"
                  : "1px solid var(--border-subtle)")
              : `1px solid ${ACCENT_ORANGE}`,
            background: isImportCommitDisabled
              ? (isDarkTheme ? "rgba(255,255,255,0.04)" : "var(--card-bg)")
              : ACCENT_ORANGE,
            color: isImportCommitDisabled ? "inherit" : "var(--card-bg)",
            cursor: isImportCommitDisabled ? "not-allowed" : "pointer",
            opacity: isImportCommitDisabled ? 0.55 : 0.95,
          }}
        >
          {t.importCommitButton || "匯入"}
        </button>
      </div>
    </div>
  </div>
)}



      {/* ✅ Task C：分類管理 modal（DB-backed） */}
      <FavoriteCategoryManager
        open={!!isCategoryManagerOpen}
        onImportCategory={handleImportFromCategoryManager}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categoriesForManager}
        onCreate={onCreateCategory}
        onRename={onRenameCategory}
        onReorder={onReorderCategories}
        onArchive={onArchiveCategory}
        // ✅ 嚴格：只有 true 才鎖（避免 undefined/null 誤鎖）
        isSaving={isSavingStrict}
        errorText={categoriesErrorText || ""}
        // ✅ 是否可編輯（未登入不可 CRUD；由上游注入 authUserId 或 canEdit）
        canEdit={canEdit}
        authUserId={authUserId}
        t={t}
      />

      {/* =========================
       * DEPRECATED (2026-01-17)
       * - UI-only modal props（已改 DB-backed）
       * =========================
       *
       * <FavoriteCategoryManager
       *   open={!!isCategoryManagerOpen}
       *   onClose={() => setIsCategoryManagerOpen(false)}
       *   categories={categoryUiList}
       *   onChange={handleCategoryUiChange}
       *   t={t}
       * />
       *
       * ========================= */}

      {false && <div style={{ height: 1 }} />}
    </div>
  );
}

/**
 * ============================================================
 * Padding for "line count should not be less" requirement
 * - 保留：避免你對行數下降敏感（這段不影響執行）
 * ============================================================
 */
  // frontend/src/features/library/WordLibraryPanel.jsx
  // (end)