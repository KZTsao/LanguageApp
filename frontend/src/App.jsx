// frontend/src/App.jsx
/**
 * 文件說明：
 * - 本檔為 App 的主入口，負責「狀態與邏輯」；畫面交給 LayoutShell / SearchBox / ResultPanel 等元件。
 * - 本輪（Phase 4）採用「並存模式」：保留 localStorage legacy 邏輯，新增 DB API 路徑並以 wrapper 路由切換。
 *
 * 異動紀錄（僅追加，不可刪除）：
 * - 2025-12-17：Phase 4（並存模式）
 *   1) 新增 /api/library API 路徑的載入與收藏操作（GET/POST/DELETE）
 *   2) 新增 libraryInitStatus（Production 排查用）
 *   3) 保留既有 localStorage 收藏 function（僅加註 DEPRECATED，行為不移除）
 *   4) UI 綁定改指向 handleToggleFavorite（wrapper），避免直接呼叫 legacy toggleFavorite
 * - 2025-12-17：Phase 4 修正（Analyze 404）
 *   1) handleAnalyze 改呼叫既有後端路由 POST /api/analyze（避免誤打 /api/dictionary/analyze 造成 404）
 *   2) 新增 analyzeInitStatus（Production 排查用）
 * - 2025-12-17：Phase 4 修正（apiFetch Response 解析）
 *   1) handleAnalyze / loadLibraryFromApi / addFavoriteViaApi / removeFavoriteViaApi：補上 res.json() 解析
 *      避免把原生 Response 物件塞進 state 導致 render 取值噴錯（白畫面）
 *   2) 新增 readApiJson / assertApiOk（Production 排查用）：統一記錄 lastError 與回應內容片段
 * - 2025-12-17：Phase 4 清理（僅針對本對話窗新增且無效的排查碼）
 *   1) 移除 libraryInitStatus / analyzeInitStatus 與 create*InitStatus（避免檔案膨脹且未解決星星變色）
 *   2) 移除 assertApiOk / readApiJson，改回各 API 呼叫處就地做 res.ok 檢查與 res.json() 解析
 * - 2025-12-18：Phase 4 修正（查詢歷史導覽：前一頁/後一頁 UI 恢復）
 *   1) App.jsx 補回 ResultPanel 所需 props：historyIndex/historyLength/canPrev/canNext/onPrev/onNext
 *   2) 新增 historyNavInitStatus（Production 排查用），記錄歷史初始化狀態與筆數
 * - 2025-12-18：Phase 4 修正（查詢歷史導覽：前一頁/後一頁「真的翻結果」）
 *   1) history 每筆新增 resultSnapshot（完整查詢結果 JSON），寫入 localStorage（HISTORY_KEY）以便翻頁不重打 API
 *   2) goPrevHistory/goNextHistory 在切換 text 同步 setResult(resultSnapshot)，讓字卡跟著換
 *   3) 新增 historySnapshotInitStatus（Production 排查用）：記錄快照覆蓋率與是否有舊資料缺 snapshot
 * - 2025-12-18：Phase 4 修正（點擊德文字觸發新查詢）
 *   1) App.jsx 新增 handleWordClick（點字 → setText + 直接以該字觸發 analyze）
 *   2) ResultPanel 補回 onWordClick={handleWordClick} 接線，避免下游收到非 function
 *   3) 新增 wordClickInitStatus（Production 排查用）：記錄是否曾觸發、最後點擊字串與時間
 * - 2026-01-06：
 *   1) ✅ 詞性切換（pos switch）：handleAnalyzeByText 支援 options（targetPosKey/queryMode）
 *   2) ✅ App 接線：新增 handleSelectPosKey，接收 ResultPanel/WordCard 的詞性點擊事件並重新查詢
 *
 * - 2025-12-18：Phase 4 UI 調整（單字庫改彈窗，不再換 view）
 *   1) 移除 view === "library" 的換頁顯示，改用 showLibraryModal 彈窗顯示
 *   2) 單字庫入口改放到 ResultPanel 歷史導覽列最右側（字典 icon），風格比照導覽按鈕
 *   3) 修正 WordLibraryPanel props 對不上造成不顯示：改用 libraryItems/onReview/onToggleFavorite/favoriteDisabled
 * - 2025-12-18：Phase 4 調整（查詢歷史改為保留 30 筆 + 清除當下回放紀錄）
 *   1) HISTORY_LIMIT = 30，統一套用在「載入 / 寫回 / push」的 slice
 *   2) 新增 clearCurrentHistoryItem（僅刪除當下回放那筆，不打 API）
 *   3) 新增 historyClearInitStatus（Production 排查用）：記錄最後一次清除的 index 與時間
 * - 2025-12-18：Phase 4 UI 調整（清除當下回放紀錄移到箭頭旁邊）
 *   1) 移除 App.jsx 內的「點擊清除該筆紀錄」顯示區塊
 *   2) 改由 ResultPanel 在歷史導覽列（箭頭旁）顯示清除入口
 * - 2025-12-26：Phase 1（補寫入釋義）
 *   1) addFavoriteViaApi 支援 senseIndex/headwordGloss/headwordGlossLang，POST /api/library 時一併送出
 *   2) toggleFavoriteViaApi 新增收藏時，若 entry 帶上述欄位則透傳
 * - 2025-12-26：Phase 1 修正（補寫入釋義：payload keys）
 *   1) addFavoriteViaApi 永遠帶 headwordGloss/headwordGlossLang（即使 gloss 為空字串也送出 key，利於後端 log 追查）
 *   2) toggleFavoriteViaApi 增加保守 fallback 取 gloss（僅從 entry 既有欄位挑第一個非空字串，不生成新資料）
 *   3) 加入少量 console：觀察前端送出 payload 的 runtime 狀態
 * - 2025-12-26：Phase 1 擴充（多釋義：一次寫入多筆 senseIndex）
 *   1) toggleFavoriteViaApi：若 entry.senses 為陣列且長度 > 0，則逐一 upsert (senseIndex 0..n-1)
 *   2) 追加 console：觀察本次新增將送出幾筆 sense payload、每筆 gloss 長度
 * - 2025-12-29：Phase 1 修正（多釋義 payload 來源唯一化：支援 headwordSenses）
 *   1) buildFavoritePayloadsFromEntry：除了 entry.senses，也接受 entry.headwordSenses（WordCard 封裝的全釋義快照）
 *   2) toggleFavoriteViaApi 的 plan console 補印 headwordSenses 狀態，避免誤判只會送單筆
 * - 2026-01-01：Phase 1 擴充（義項狀態：familiarity/isHidden 沿用 POST /api/library）
 *   1) 新增 postLibraryUpsertViaApi（共用底層 upsert，不強制帶 gloss keys）
 *   2) addFavoriteViaApi 擴充支援 familiarity/isHidden（收藏當下可一併寫入狀態）
 *   3) 新增 updateSenseStatusViaApi/handleUpdateSenseStatus，供單字庫義項狀態 UI 直接寫 DB
 *   4) WordLibraryPanel 透過 onUpdateSenseStatus 接線（避免 UI disabled）
 * - 2026-01-03：Phase 1 修正（DB 寫入驗證與可控除錯）
 *   1) postLibraryUpsertViaApi：補上回應 JSON 解析與基本 sanity check（避免前端自以為 ok 但 DB 未寫入）
 *   2) 新增 libraryWriteInitStatus（Production 排查用）：記錄最近一次 upsert 的回應摘要與時間
 *   3) 新增可控 debug 開關（localStorage.DEBUG 包含 'library' 時才印出詳細回應）
 *
 * - 2026-01-04：Phase X（隨堂考入口：從單字庫彈窗進入）
 *   1) 單字庫彈窗 Header 左側新增「🧪 測驗」按鈕（入口更顯眼、可達）
 *   2) 點擊後：先 closeLibraryModal() 再 setView("test")，避免 UI 疊層造成誤判
 *   3) 加入少量 console 以便 Production 排查（確認入口點擊路徑是否有觸發）
 * - 2026-01-05：Phase X 修正（SearchBox/點字查詢：送後端前先做前處理）
 *   1) 新增 normalizeSearchQuery（去除頭尾常見標點/括號/引號 + trim，不動中間），避免 sehr. 要點多次才查
 *   2) handleWordClick/handleAnalyzeByText/handleAnalyze/handleLibraryReview 統一套用 normalizeSearchQuery（確保點字一次到位）
 *   3) 嚴格不以 text 變動觸發查詢，避免切換歷史紀錄造成重新查詢
 *   4) 新增 searchNormalizeInitStatus + 可控 debug（localStorage.DEBUG 包含 'search' 才印 log），供 Production 排查
 *
 * - 2026-01-05：Phase X 修正（查詢命中歷史：不重打 /api/analyze）
 *   1) handleAnalyze/handleAnalyzeByText：送出 API 前先比對 history（text/headword）
 *   2) 命中則直接 applyHistoryItemToUI（回放 resultSnapshot），並把該筆移到最前面（視為最新查詢）
 *   3) 追加少量可控 console（localStorage.DEBUG 包含 'search' 才印），供 Production 排查
 *
 * - 2026-01-05：Phase X 修正（歷史切換不影響 SearchBox）
 *   1) applyHistoryItemToUI 新增 options.syncInput（預設 true）
 *   2) goPrevHistory/goNextHistory 以 syncInput:false 回放 resultSnapshot，不回寫輸入框
 *   3) 保留既有 setText 行為（僅限非歷史導覽路徑），避免影響點字查詢/命中歷史回放
 *
 * - 2026-01-05：Phase 1｜Visit（訪問紀錄：前端最小導入）
 *   1) 新增 postVisitViaApi（POST /api/visit）與 visitInitStatus（Production 排查用）
 *   2) 新增 useEffect：登入成功（authUserId 有值）後在「同一個 user / 同一個 tab」只打一次 visit（避免狂加）
 *   3) 新增可控 debug：localStorage.DEBUG 包含 'visit' 才印 log
 * - 2026-01-06：App.jsx 刪減（使用者允許行數減少）
 *   1) 移除未被讀取的 Production 排查用 initStatus state（僅 set、不參與任何業務邏輯）
 *   2) 移除未被使用的 libraryCursor state（cursor 尚未在本檔參與任何流程）
 *   3) 移除已註解且無引用的 legacyPayload 殘留註解
 * - 2026-01-12：Task 3（新增收藏可選分類：category_id 接線修正）
 *   1) handleToggleFavorite / toggleFavoriteViaApi 支援第二參數 options（含 category_id）
 *   2) addFavoriteViaApi payload 支援 category_id（僅在有效整數時送出；否則省略走後端預設）
 *   3) fallback：未指定分類時，優先用 selectedFavoriteCategoryId；再嘗試 name===「我的最愛1」；最後不帶 category_id
 *
 * - 2026-01-14：拆分（useLibraryController）
 *   1) 將「單字庫/收藏/分類/彈窗/DB API/legacy localStorage」整包抽到 hooks/useLibraryController.js
 *   2) App.jsx 保留狀態與接線（減少檔案大小、降低讀檔壓力）
 */

// App 只管狀態與邏輯，畫面交給 LayoutShell / SearchBox / ResultPanel

import { useState, useEffect, useMemo, useRef } from "react";
import uiText from "./uiText";
import WordCard from "./components/word/WordCard";
import GrammarCard from "./components/grammar/GrammarCard";
import { AuthProvider, useAuth } from "./context/AuthProvider";
import AppShellView from "./components/layout/AppShellView";

// ✅ 新增：統一帶 Authorization
import { apiFetch } from "./utils/apiClient";

// ✅ 新增：右上角登入/登出改由 LoginHeader 自己負責（它內部用 useAuth）
import { useHistoryFlow } from "./hooks/useHistoryFlow";
import { useAppState } from "./app/useAppState";

// ✅ 拆出：單字庫/收藏 controller
import { useLibraryController } from "./hooks/useLibraryController";

function AppInner() {
  // ✅ 取得登入 userId（未登入 = guest bucket）
  const { user } = useAuth();
  const authUserId = user && user.id ? user.id : "";

  // ✅ Step 1：集中 state（不含 effect）
  const { keys, helpers, state, actions } = useAppState({
    authUserId,
    defaultUiLang: "zh-TW",
  });

  const {
    text,
    result,
    uiLang,
    loading,
    showRaw,
    view,
    showLibraryModal,
    mode,
    learningContext,
    libraryItems,
    libraryCursor,
    favoriteCategories,
    favoriteCategoriesLoading,
    favoriteCategoriesLoadError,
    selectedFavoriteCategoryId,
    testCard,
    testMetaMap,
    testMetaLoading,
  } = state;

  const {
    setText,
    setResult,
    setUiLang,
    setLoading,
    setShowRaw,
    setView,
    setShowLibraryModal,
    setMode,
    setLearningContext,
    enterSearchMode,
    enterLearningMode,
    updateLearningContext,
    setLibraryItems,
    setLibraryCursor,
    setFavoriteCategories,
    setFavoriteCategoriesLoading,
    setFavoriteCategoriesLoadError,
    setSelectedFavoriteCategoryId,
    setTestCard,
    setTestMetaMap,
    setTestMetaLoading,
  } = actions;

  const { safeWriteLocalStorageText, safeWriteLocalStorageJson } = helpers;

  const {
    // scoped
    WORDS_KEY,
    UILANG_KEY,
    THEME_KEY,
    LASTTEXT_KEY,
    HISTORY_KEY,
    FAVORITES_CATEGORY_KEY,
    // legacy
    WORDS_KEY_LEGACY,
    UILANG_KEY_LEGACY,
    THEME_KEY_LEGACY,
    LASTTEXT_KEY_LEGACY,
    // mode
    APP_MODE_KEY,
    LEARNING_CONTEXT_KEY,
    // bucket
    userBucket,
  } = keys;

  const API_BASE =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000"
      : "https://languageapp-8j45.onrender.com";

  // ✅ Phase 4（並存模式）開關：true = 單字庫收藏走 DB（/api/library）；false = 使用 legacy localStorage
  const USE_API_LIBRARY = true;

  /**
   * 功能：取得 debug 開關（localStorage.DEBUG）
   * - 目的：避免 console 噪音過多；只有在你需要排查時才打開詳細 log
   * - 使用方式：
   *   - 開：localStorage.setItem("DEBUG", "library")（或包含 library 的字串）
   *   - 關：localStorage.removeItem("DEBUG") 或設成不含 library
   */
  const isLibraryDebugEnabled = () => {
    try {
      const v = window.localStorage.getItem("DEBUG") || "";
      return String(v).includes("library");
    } catch {
      return false;
    }
  };

  /**
   * 功能：取得 debug 開關（localStorage.DEBUG）
   * - 目的：Search normalize 排查用（避免 console 噪音過多）
   * - 使用方式：
   *   - 開：localStorage.setItem("DEBUG", "search")（或包含 search 的字串）
   *   - 關：localStorage.removeItem("DEBUG") 或設成不含 search
   */
  const isSearchDebugEnabled = () => {
    try {
      const v = window.localStorage.getItem("DEBUG") || "";
      return String(v).includes("search");
    } catch {
      return false;
    }
  };

  /**
   * 功能：取得 debug 開關（localStorage.DEBUG）
   * - 目的：Visit（/api/visit）排查用（避免 console 噪音過多）
   * - 使用方式：
   *   - 開：localStorage.setItem("DEBUG", "visit")（或包含 visit 的字串）
   *   - 關：localStorage.removeItem("DEBUG") 或設成不含 visit
   */
  const isVisitDebugEnabled = () => {
    try {
      const v = window.localStorage.getItem("DEBUG") || "";
      return String(v).includes("visit");
    } catch {
      return false;
    }
  };

  // ✅ view 切換：search / test（library 改彈窗，不再佔 view）

  /**
   * 功能：同一個 user / 同一個 tab 只送一次 visit（避免狂加）
   * - 規則：
   *   1) authUserId 變成有值（登入完成）才送
   *   2) 同一個 userId 在同一個 tab 只送一次
   * - 注意：這是前端節流；真正是否要「每次刷新都算一次」後續可再調整策略
   */
  const visitOnceRef = useRef({ userId: "", done: false });

  /**
   * 功能：POST /api/visit（最小）
   * - 目的：更新 profiles.visit_count / last_visit_at
   * - 注意：apiFetch 會自動帶 Authorization（你已統一在 apiClient 做）
   */
  const postVisitViaApi = async ({ reason = "" } = {}) => {
    if (!authUserId) return;

    // ✅ 可控 debug
    if (isVisitDebugEnabled()) {
      try {
        console.debug("[visit][postVisitViaApi] start", {
          reason: reason || "",
          userId: authUserId,
        });
      } catch {}
    }

    try {
      const res = await apiFetch(`/api/visit`, { method: "POST" });
      if (!res) throw new Error("[visit] response is null");

      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[visit] POST /api/visit failed: ${res.status} ${res.statusText}${detail ? " | " + detail : ""}`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (isVisitDebugEnabled()) {
        try {
          console.debug("[visit][postVisitViaApi] ok", {
            mode: data?.mode || "",
            visit_count: data?.visit_count,
            last_visit_at: data?.last_visit_at,
          });
        } catch {}
      }
    } catch (e) {
      if (isVisitDebugEnabled()) {
        try {
          console.warn("[visit][postVisitViaApi] failed", e);
        } catch {}
      }
    }
  };

  /**
   * Phase 1｜Visit：登入後送出一次（同 user / 同 tab 只一次）
   * - 注意：不合併既有 useEffect；僅新增一個最小 useEffect
   */
  useEffect(() => {
    if (!authUserId) return;

    // 同一個 userId 在同一個 tab 已送出就不再送
    if (
      visitOnceRef.current &&
      visitOnceRef.current.userId === authUserId &&
      visitOnceRef.current.done
    ) {
      return;
    }

    // 標記為已送（先標記，避免重複觸發造成多次）
    visitOnceRef.current = { userId: authUserId, done: true };

    // 送出 visit（最小：不阻斷 UI）
    postVisitViaApi({ reason: "authUserId-ready" });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  // 查詢歷史：存最近 10 筆
  // ✅ 2025-12-18：本輪需求改為保留 30 筆（統一套用在所有 slice）
  const HISTORY_LIMIT = 30;

  // ✅ 查詢歷史（已拆出 useHistoryFlow，避免 App.jsx 過大）
  const {
    history,
    setHistory,
    historyIndex,
    setHistoryIndex,
    canPrevHistory,
    canNextHistory,
    goPrevHistory,
    goNextHistory,
    clearCurrentHistoryItem,
    findHistoryHitIndex,
    replayHistoryHit,
    applyHistoryItemToUI,
  } = useHistoryFlow({
    HISTORY_KEY,
    HISTORY_LIMIT,
    isSearchDebugEnabled,
    setText,
    setResult,
  });

  // 深淺色主題（分桶，但初始仍可用 legacy 當 fallback）
  const [theme, setTheme] = useState(() => {
    const legacy = window.localStorage.getItem(THEME_KEY_LEGACY);
    if (legacy === "light" || legacy === "dark") return legacy;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // ✅ uiText 取用（嚴格：缺字顯示 —）
  const currentUiText = useMemo(() => {
    return uiText[uiLang] || uiText["zh-TW"] || {};
  }, [uiLang]);

  const t = useMemo(() => {
    const getByPath = (obj, path) => {
      const parts = String(path || "").split(".");
      let cur = obj;
      for (const p of parts) {
        if (!cur || typeof cur !== "object") return undefined;
        cur = cur[p];
      }
      return cur;
    };
    return (path) => {
      const v = getByPath(currentUiText, path);
      return typeof v === "string" && v.trim() ? v : "—";
    };
  }, [currentUiText]);

  // ✅ 初始化：語言/主題/最後查詢（分桶），並保留 legacy fallback
  useEffect(() => {
    try {
      const scopedLang = window.localStorage.getItem(UILANG_KEY);
      const legacyLang = window.localStorage.getItem(UILANG_KEY_LEGACY);
      if (scopedLang) setUiLang(scopedLang);
      else if (legacyLang) setUiLang(legacyLang);

      const scopedTheme = window.localStorage.getItem(THEME_KEY);
      const legacyTheme = window.localStorage.getItem(THEME_KEY_LEGACY);
      if (scopedTheme === "light" || scopedTheme === "dark") setTheme(scopedTheme);
      else if (legacyTheme === "light" || legacyTheme === "dark") setTheme(legacyTheme);

      const scopedLast = window.localStorage.getItem(LASTTEXT_KEY);
      const legacyLast = window.localStorage.getItem(LASTTEXT_KEY_LEGACY);
      if (scopedLast) setText(scopedLast);
      else if (legacyLast) setText(legacyLast);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [UILANG_KEY, THEME_KEY, LASTTEXT_KEY]);

  // ✅ 寫回：語言/主題/最後查詢（只寫 scoped key，避免不同 bucket 汙染）
  useEffect(() => {
    try {
      window.localStorage.setItem(UILANG_KEY, uiLang);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiLang, UILANG_KEY]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, THEME_KEY]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LASTTEXT_KEY, text);
    } catch {}
    // eslint-disable-next-line ret-hooks/exhaustive-deps
  }, [history, HISTORY_KEY]);

  // ✅ handleTextChange：輸入時同步更新 text，並重置 index
  const handleTextChange = (v) => {
    setText(v);
    setHistoryIndex(-1);
  };

  /**
   * 功能：查詢文字前處理（normalize）
   * - 目的：在送後端之前，先把「頭尾多餘標點/括號/引號」去掉，避免 sehr. 要點多次才查
   * - 規則：
   *   1) 只動「頭尾」：不動中間（例如 z.B. / e-mail / C++ 不會被破壞）
   *   2) 先 trim，再去頭尾常見符號，最後再 trim 一次
   *   3) 若 clean 後為空字串，回傳空字串（上游會直接 return）
   * - 注意：
   *   - 不依賴任何外部 library（使用原生 JS）
   *   - 不以 text 變動觸發查詢（避免 history 切換誤觸發）
   */
  const normalizeSearchQuery = (raw, source = "") => {
    const rawStr = (raw ?? "").toString();
    let s = rawStr.trim();

    // ✅ 去除頭尾標點（僅動頭尾，不動中間）
    // - 覆蓋：英文常見標點 + 中文全形標點 + 引號/括號
    // - 例：sehr. / „sehr.“ / (sehr) / [sehr] / sehr... / sehr;  → sehr
    // - 注意：不要在這裡動中間字元（例如 z.B. 保留）
    s = s.replace(
      /^[\s\u00A0"'“”‘’\(\)\[\]\{\}<>.,!?;:。！？；：…，．、]+|[\s\u00A0"'“”‘’\(\)\[\]\{\}<>.,!?;:。！？；：…，．、]+$/g,
      ""
    );
    s = s.trim();

    const cleaned = s;

    // ✅ 可控 debug：只有開 DEBUG=search 才印（避免噪音）
    if (isSearchDebugEnabled()) {
      try {
        const changed = rawStr !== cleaned;
        if (changed) {
          console.debug("[search][normalizeSearchQuery]", {
            source: source || "",
            raw: rawStr,
            cleaned,
          });
        }
      } catch {}
    }

    return cleaned;
  };

  /**
   * 功能：Analyze（字典）- 以指定文字觸發查詢（供點字觸發使用）
   * - 注意：保留既有 handleAnalyze() 不改其介面（避免影響 SearchBox 既有呼叫）
   */
  const handleAnalyzeByText = async (rawText, options = {}) => {
    const q = normalizeSearchQuery(rawText, "handleAnalyzeByText");
    if (!q) return;

    /**
     * ✅ 2026-01-06：詞性切換必須「強制重查」
     * 中文功能說明：
     * - 背景：既有 Phase X 有「命中 history 就回放、不打 API」的優化
     * - 但詞性切換（targetPosKey）同一個 q 需要打 API 才會回不同詞性結果
     * - 因此：只要 options.targetPosKey 存在 → 跳過 history 命中回放，直接打 /api/analyze
     */
    const hasTargetPosKey =
      options && typeof options?.targetPosKey === "string" && options.targetPosKey.trim();

    // ✅ 可控 runtime 觀察（你現在排查用）：確認是否被 history-hit 擋掉
    try {
      console.log("[App][posSwitch][handleAnalyzeByText] precheck", {
        q,
        hasTargetPosKey: !!hasTargetPosKey,
        targetPosKey: hasTargetPosKey ? options.targetPosKey : "",
      });
    } catch {}

    // ✅ Phase X：若命中 history，直接回放（不重打 /api/analyze）
    // ⚠️ 但詞性切換必須重查，所以 hasTargetPosKey=true 時跳過
    if (!hasTargetPosKey) {
      const hitIndex = findHistoryHitIndex(q);
      if (hitIndex !== -1) {
        const replayed = replayHistoryHit(hitIndex, q, "handleAnalyzeByText");
        if (replayed) return;
      }
    }

    setLoading(true);
    try {
      const res = await apiFetch(`/api/analyze`, {
        method: "POST",
        body: JSON.stringify({ text: q, uiLang, explainLang: uiLang, ...(options || {}) }),
      });

      if (!res) throw new Error("[analyze] response is null");
      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[analyze] POST /api/analyze failed: ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ""}`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      setResult(data);

      const headword = (data?.dictionary?.baseForm || data?.dictionary?.word || q).trim();
      const canonicalPos = (data?.dictionary?.canonicalPos || data?.dictionary?.partOfSpeech || "").trim();

      const key = `${headword}::${canonicalPos}`;
      setHistory((prev) => {
        const next = prev.filter((x) => (x?.key || "") !== key);
        return [
          {
            key,
            text: q,
            headword,
            canonicalPos,
            createdAt: new Date().toISOString(),
            resultSnapshot: data,
          },
          ...next,
        ].slice(0, HISTORY_LIMIT);
      });
      setHistoryIndex(0);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 功能：詞性切換（Adjektiv / Adverb ...）
   * 中文功能說明：
   * - 由 WordCard → ResultPanel 回拋 clickedPosKey，App 再觸發 /api/analyze 並帶 targetPosKey
   * - 目的：同一個字可在不同詞性間切換，並且視為不同歷史紀錄（key 由後端 canonicalPos 決定）
   *
   * 功能初始化狀態（Production 排查）：
   * - 若 clickedPosKey 缺失：直接 return，不拋錯
   * - 若點擊的詞性等於目前 activePosKey：不重查（避免重複查詢）
   */
  const handleSelectPosKey = (payload) => {
    try {
      const clickedPosKey = (payload?.clickedPosKey || payload?.posKey || "").trim();
      const word = (payload?.word || payload?.text || payload?.headword || "").toString().trim();

      const activePosKey =
        (payload?.activePosKey ||
          result?.dictionary?.posKey ||
          result?.dictionary?.partOfSpeech ||
          result?.dictionary?.canonicalPos ||
          "")
          .toString()
          .trim();

      console.log("[App][posSwitch] handleSelectPosKey", {
        clickedPosKey,
        activePosKey,
        word,
        hasClickedPosKey: !!clickedPosKey,
        hasWord: !!word,
      });

      if (!clickedPosKey || !word) return;
      if (clickedPosKey === activePosKey) return;

      // 🔒 詞性 pill = 歷史切換（不打 API）
      const historyKey = `${word}::${clickedPosKey}`;

      const hitIndex = history.findIndex(
        (h) =>
          h?.text === word &&
          (h?.resultSnapshot?.dictionary?.posKey === clickedPosKey ||
            h?.resultSnapshot?.dictionary?.canonicalPos === clickedPosKey)
      );

      if (hitIndex >= 0) {
        console.log("[App][posSwitch] hit history", historyKey, hitIndex);

        setHistoryIndex(hitIndex);

        const snapshot = history[hitIndex]?.resultSnapshot;
        if (snapshot) {
          setResult(snapshot);
        }
      } else {
        console.log("[App][posSwitch] no history for posKey", historyKey);
      }

      return;
    } catch (err) {
      console.warn("[App][posSwitch] handleSelectPosKey error", err);
    }
  };

  // ✅ 查詢：Analyze（字典）
  const handleAnalyze = async () => {
    const q = normalizeSearchQuery(text, "handleAnalyze");
    if (!q) return;

    // ✅ Phase X：若命中 history，直接回放（不重打 /api/analyze）
    const hitIndex = findHistoryHitIndex(q);
    if (hitIndex !== -1) {
      const replayed = replayHistoryHit(hitIndex, q, "handleAnalyze");
      if (replayed) return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(`/api/analyze`, {
        method: "POST",
        body: JSON.stringify({ text: q, uiLang, explainLang: uiLang }),
      });

      if (!res) throw new Error("[analyze] response is null");
      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[analyze] POST /api/analyze failed: ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ""}`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      setResult(data);

      const headword = (data?.dictionary?.baseForm || data?.dictionary?.word || q).trim();
      const canonicalPos = (data?.dictionary?.canonicalPos || data?.dictionary?.partOfSpeech || "").trim();

      const key = `${headword}::${canonicalPos}`;
      setHistory((prev) => {
        const next = prev.filter((x) => (x?.key || "") !== key);
        return [
          {
            key,
            text: q,
            headword,
            canonicalPos,
            createdAt: new Date().toISOString(),
            resultSnapshot: data,
          },
          ...next,
        ].slice(0, HISTORY_LIMIT);
      });
      setHistoryIndex(0);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 功能：點擊字卡/例句中的德文字 → 觸發新查詢
   * - 注意：library 改彈窗後，不再需要切回 view=search 才看得到結果
   */
  const handleWordClick = (rawWord) => {
    const q = normalizeSearchQuery(rawWord, "handleWordClick");
    if (!q) return;

    setText(q);
    setHistoryIndex(-1);
    handleAnalyzeByText(q);
  };

  // ✅ 單字庫/收藏 controller（已拆出）
  const {
    isFavorited,
    handleToggleFavorite,
    handleUpdateSenseStatus,
    openLibraryModal,
    closeLibraryModal,
    handleLibraryReview,
    handleSelectFavoriteCategory,
    handleSelectFavoriteCategoryForAdd,
  } = useLibraryController({
    // flags / env
    USE_API_LIBRARY,

    // auth / lang
    authUserId,
    uiLang,

    // api
    apiFetch,

    // debug
    isLibraryDebugEnabled,

    // keys
    WORDS_KEY,
    WORDS_KEY_LEGACY,
    UILANG_KEY,
    UILANG_KEY_LEGACY,
    THEME_KEY,
    THEME_KEY_LEGACY,
    LASTTEXT_KEY,
    LASTTEXT_KEY_LEGACY,
    FAVORITES_CATEGORY_KEY,

    // state
    showLibraryModal,
    libraryItems,
    favoriteCategories,
    favoriteCategoriesLoading,
    selectedFavoriteCategoryId,

    // setters
    setLibraryItems,
    setLibraryCursor,
    setFavoriteCategories,
    setFavoriteCategoriesLoading,
    setFavoriteCategoriesLoadError,
    setSelectedFavoriteCategoryId,
    setShowLibraryModal,

    // helpers
    normalizeSearchQuery,
    handleAnalyzeByText,
  });
  // ============================================================
  // 2026-01-14：Task 2-1｜切換分類時主畫面星號即時連動（後端分類狀態 API）
  // - 星號亮暗以「分類內是否存在 link」為準（不得用全域收藏）
  // - 觸發：分類切換 / 查詢新單字 / 點星號收藏或取消後
  // - API：GET /api/library/favorites/category-status
  // ============================================================

  const [favoriteInSelectedCategory, setFavoriteInSelectedCategory] = useState(false);
  const [favoriteCategoryStatusLoading, setFavoriteCategoryStatusLoading] = useState(false);

  // ✅ 避免 race：只採用最後一次請求的結果
  const favoriteCategoryStatusReqSeqRef = useRef(0);

  // ✅ 從目前查詢結果推導「要查分類狀態」所需 key
  const currentCategoryStatusKey = useMemo(() => {
    const hw = (
      result?.dictionary?.baseForm ||
      result?.dictionary?.word ||
      result?.dictionary?.headword ||
      ""
    )
      .toString()
      .trim();

    const pos = (
      result?.dictionary?.canonicalPos ||
      result?.dictionary?.canonical_pos ||
      result?.dictionary?.partOfSpeech ||
      result?.dictionary?.posKey ||
      ""
    )
      .toString()
      .trim();

    const siRaw =
      result?.dictionary?.senseIndex ??
      result?.dictionary?.sense_index ??
      0;

    const si = Number.isInteger(siRaw)
      ? siRaw
      : Number.isFinite(Number(siRaw))
      ? Number(siRaw)
      : 0;

    if (!hw || !pos) return null;

    return {
      headword: hw,
      canonical_pos: pos,
      sense_index: si,
    };
  }, [result]);

  const fetchFavoriteCategoryStatus = async ({ reason = "" } = {}) => {
    // 未登入 / 未啟用 API：保守顯示暗
    if (!USE_API_LIBRARY || !authUserId) {
      setFavoriteInSelectedCategory(false);
      return { ok: false, inCategory: false, skipped: true };
    }

    const cidRaw = selectedFavoriteCategoryId;
    const cidNum = Number.parseInt(String(cidRaw ?? ""), 10);
    const category_id = Number.isFinite(cidNum) && cidNum > 0 ? cidNum : null;

    // 沒選分類或沒有當前字卡：保守顯示暗
    if (!category_id || !currentCategoryStatusKey) {
      setFavoriteInSelectedCategory(false);
      return { ok: true, inCategory: false, skipped: true };
    }

    const seq = (favoriteCategoryStatusReqSeqRef.current || 0) + 1;
    favoriteCategoryStatusReqSeqRef.current = seq;

    setFavoriteCategoryStatusLoading(true);

    try {
      const qs = new URLSearchParams();
      qs.set("headword", String(currentCategoryStatusKey.headword));
      qs.set("canonical_pos", String(currentCategoryStatusKey.canonical_pos));
      qs.set("sense_index", String(currentCategoryStatusKey.sense_index));
      qs.set("category_id", String(category_id));

      const res = await apiFetch(`/api/library/favorites/category-status?${qs.toString()}`, {
        method: "GET",
      });

      if (!res) throw new Error("[favorites][category-status] response is null");

      if (res.status === 401 || res.status === 403) {
        // token / session 問題：保守顯示暗
        if (favoriteCategoryStatusReqSeqRef.current === seq) {
          setFavoriteInSelectedCategory(false);
        }
        return { ok: false, inCategory: false, unauthorized: true };
      }

      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[favorites][category-status] GET failed: ${res.status} ${res.statusText}${detail ? " | " + detail : ""}`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      const inCategory = !!data?.inCategory;

      if (favoriteCategoryStatusReqSeqRef.current === seq) {
        setFavoriteInSelectedCategory(inCategory);
      }

      if (isLibraryDebugEnabled()) {
        try {
          console.debug("[favorites][category-status] ok", {
            reason: reason || "",
            key: currentCategoryStatusKey,
            category_id,
            inCategory,
          });
        } catch {}
      }

      return { ok: true, inCategory };
    } catch (e) {
      if (favoriteCategoryStatusReqSeqRef.current === seq) {
        // 失敗：保守顯示暗，避免誤亮
        setFavoriteInSelectedCategory(false);
      }

      if (isLibraryDebugEnabled()) {
        try {
          console.warn("[favorites][category-status] failed", e);
        } catch {}
      }

      return { ok: false, inCategory: false, error: e };
    } finally {
      if (favoriteCategoryStatusReqSeqRef.current === seq) {
        setFavoriteCategoryStatusLoading(false);
      }
    }
  };

  // ✅ 觸發 1：分類切換
  useEffect(() => {
    fetchFavoriteCategoryStatus({ reason: "category-changed" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFavoriteCategoryId]);

  // ✅ 觸發 2：顯示新單字（查詢結果變更）
  useEffect(() => {
    fetchFavoriteCategoryStatus({ reason: "result-changed" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentCategoryStatusKey?.headword,
    currentCategoryStatusKey?.canonical_pos,
    currentCategoryStatusKey?.sense_index,
  ]);

  // ✅ ResultPanel/WordCard 會呼叫 isFavorited(entry)：這裡改為「分類狀態優先」，避免依賴 libraryItems 是否剛好載入到
  const isFavoritedForUI = (entry) => {
    // 若 entry = 當前畫面顯示的字卡，就直接回 Task 2-1 的 inCategory
    try {
      const eHeadword = (
        entry?.headword ||
        entry?.baseForm ||
        entry?.word ||
        entry?.lemma ||
        entry?.text ||
        ""
      )
        .toString()
        .trim();

      const ePos = (
        entry?.canonical_pos ||
        entry?.canonicalPos ||
        entry?.canonicalPOS ||
        entry?.partOfSpeech ||
        entry?.posKey ||
        ""
      )
        .toString()
        .trim();

      const eSiRaw = entry?.sense_index ?? entry?.senseIndex ?? 0;
      const eSi = Number.isInteger(eSiRaw)
        ? eSiRaw
        : Number.isFinite(Number(eSiRaw))
        ? Number(eSiRaw)
        : 0;

      if (
        currentCategoryStatusKey &&
        eHeadword &&
        ePos &&
        eHeadword === currentCategoryStatusKey.headword &&
        ePos === currentCategoryStatusKey.canonical_pos &&
        eSi === currentCategoryStatusKey.sense_index
      ) {
        return !!favoriteInSelectedCategory;
      }
    } catch {
      // fallthrough
    }

    // fallback：維持既有 controller 的判斷（例如 Test mode / Library modal）
    if (typeof isFavorited === "function") return !!isFavorited(entry);
    return false;
  };

  // ✅ 點星號後：先走既有 toggle，再拉一次 category-status 對齊（避免只靠 optimistic）
  const handleToggleFavoriteForUI = (entry, options = {}) => {
    if (typeof handleToggleFavorite === "function") {
      handleToggleFavorite(entry, options);
    }

    // 只有在「當前畫面有分類選擇」才需要刷新狀態
    try {
      window.setTimeout(() => {
        fetchFavoriteCategoryStatus({ reason: "after-toggle" });
      }, 200);
    } catch {}
  };

  const canClearHistory = historyIndex >= 0 && historyIndex < history.length;

  return (
    <AppShellView
      // core
      uiLang={uiLang}
      setUiLang={setUiLang}
      theme={theme}
      setTheme={setTheme}
      currentUiText={currentUiText}
      uiText={uiText}
      t={t}
      loading={loading}
      view={view}
      setView={setView}
      authUserId={authUserId}
      apiBase={API_BASE}
      // layout
      history={history}
      historyIndex={historyIndex}
      onPrevHistory={goPrevHistory}
      onNextHistory={goNextHistory}
      // test mode
      isFavorited={isFavoritedForUI}
      onToggleFavorite={handleToggleFavoriteForUI}
      libraryItems={libraryItems}
      testCard={testCard}
      setTestCard={setTestCard}
      testMetaMap={testMetaMap}
      setTestMetaMap={setTestMetaMap}
      testMetaLoading={testMetaLoading}
      setTestMetaLoading={setTestMetaLoading}
      // search box
      text={text}
      onTextChange={handleTextChange}
      onAnalyze={handleAnalyze}
      onEnterSearch={enterSearchMode}
      onEnterLearning={enterLearningMode}
      onOpenLibrary={openLibraryModal}
      // result panel
      result={result}
      showRaw={showRaw}
      onToggleRaw={() => setShowRaw((p) => !p)}
      mode={mode}
      learningContext={learningContext}
      WordCard={WordCard}
      GrammarCard={GrammarCard}
      historyLength={history.length}
      canPrev={canPrevHistory}
      canNext={canNextHistory}
      onPrev={goPrevHistory}
      onNext={goNextHistory}
      onWordClick={handleWordClick}
      favoriteCategories={favoriteCategories}
      favoriteCategoriesLoading={favoriteCategoriesLoading}
      selectedFavoriteCategoryId={selectedFavoriteCategoryId}
      onSelectFavoriteCategoryForAdd={handleSelectFavoriteCategoryForAdd}
      canClearHistory={canClearHistory}
      onClearHistoryItem={clearCurrentHistoryItem}
      clearHistoryLabel={t("app.history.clearThis")}
      onSelectPosKey={handleSelectPosKey}
      // library modal
      showLibraryModal={showLibraryModal}
      closeLibraryModal={closeLibraryModal}
      handleLibraryReview={handleLibraryReview}
      onUpdateSenseStatus={handleUpdateSenseStatus}
      favoriteDisabled={!authUserId}
      onSelectFavoriteCategory={handleSelectFavoriteCategory}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;

// frontend/src/App.jsx
