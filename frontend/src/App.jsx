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
 */

// App 只管狀態與邏輯，畫面交給 LayoutShell / SearchBox / ResultPanel

import { useState, useEffect, useMemo, useRef } from "react";
import uiText from "./uiText";
import WordCard from "./components/word/WordCard";
import GrammarCard from "./components/grammar/GrammarCard";
import LayoutShell from "./components/layout/LayoutShell";
import SearchBox from "./components/search/SearchBox";
import ResultPanel from "./components/result/ResultPanel";
import { AuthProvider, useAuth } from "./context/AuthProvider";

import WordLibraryPanel from "./features/library/WordLibraryPanel";
import TestModePanel from "./features/testMode/TestModePanel";

// ✅ 新增：統一帶 Authorization
import { apiFetch } from "./utils/apiClient";

// ✅ 新增：右上角登入/登出改由 LoginHeader 自己負責（它內部用 useAuth）
import LoginHeader from "./components/LoginHeader";

function AppInner() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [uiLang, setUiLang] = useState("zh-TW");
  const [loading, setLoading] = useState(false);

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

  const [showRaw, setShowRaw] = useState(false);

  // ✅ view 切換：search / test（library 改彈窗，不再佔 view）
  const [view, setView] = useState("search");

  // ✅ 單字庫彈窗
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  // ✅ 取得目前登入 userId（未登入 = ""）
  // ✅ 解法 A：App 的 authUserId 以 AuthProvider.user 為唯一真相（避免兩份 auth state 不同步）
  const { user } = useAuth();
  const authUserId = user?.id || "";


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

    // Production 排查：開始送出
    try {
    } catch {}

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

      // Production 排查：成功
      try {
      } catch {}

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
      // Production 排查：失敗
      try {
      } catch {}

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

  // ✅ user bucket（登入者用 userId；未登入用 guest）
  const userBucket = authUserId || "guest";

  // ✅ legacy keys（舊：未分桶）
  const WORDS_KEY_LEGACY = "WORDS";
  const UILANG_KEY_LEGACY = "uiLang";
  const THEME_KEY_LEGACY = "appTheme";
  const LASTTEXT_KEY_LEGACY = "lastText";
  // （history 以前沒存 localStorage，就不需要 legacy）

  // ✅ scoped keys（新：分桶）
  const WORDS_KEY = `langapp::${userBucket}::langapp_user_words_v1`;
  const UILANG_KEY = `langapp::${userBucket}::uiLang`;
  const THEME_KEY = `langapp::${userBucket}::appTheme`;
  const LASTTEXT_KEY = `langapp::${userBucket}::lastText`;
  const HISTORY_KEY = `langapp::${userBucket}::history_v1`;
  const FAVORITES_CATEGORY_KEY = `langapp::${userBucket}::favoritesCategoryId`;


  const [libraryItems, setLibraryItems] = useState([]);

  // ✅ 分頁 cursor（沿用後端 nextCursor；分類切換時需要 reset）
  const [libraryCursor, setLibraryCursor] = useState(null);

  // ✅ 任務 2：收藏分類（Favorites Categories）
  const [favoriteCategories, setFavoriteCategories] = useState([]);
  const [favoriteCategoriesLoading, setFavoriteCategoriesLoading] = useState(false);
  const [favoriteCategoriesLoadError, setFavoriteCategoriesLoadError] = useState(null);

  // ✅ 任務 2：目前選取的收藏分類（localStorage per userId）
  const [selectedFavoriteCategoryId, setSelectedFavoriteCategoryId] = useState(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_CATEGORY_KEY);
      const v = raw === null || typeof raw === "undefined" ? "" : String(raw).trim();
      return v ? v : null;
    } catch (e) {
      return null;
    }
  });

  // ✅ 任務 2：userId 變更時，同步讀取 localStorage（每個 userId 各自記住）
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_CATEGORY_KEY);
      const v = raw === null || typeof raw === "undefined" ? "" : String(raw).trim();
      setSelectedFavoriteCategoryId(v ? v : null);
    } catch (e) {
      setSelectedFavoriteCategoryId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [FAVORITES_CATEGORY_KEY]);



  // ✅ 測試模式：隨機單字卡 + 收藏狀態
  const [testCard, setTestCard] = useState(null); // { headword, canonicalPos, userId? }
  const [testMetaMap, setTestMetaMap] = useState({}); // { [headword]: { brief, pron } }
  const [testMetaLoading, setTestMetaLoading] = useState(false);

  // 查詢歷史：存最近 10 筆
  // ✅ 2025-12-18：本輪需求改為保留 30 筆（統一套用在所有 slice）
  const HISTORY_LIMIT = 30;

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);







  // 深淺色主題（分桶，但初始仍可用 legacy 當 fallback）
  const [theme, setTheme] = useState(() => {
    const legacy = window.localStorage.getItem(THEME_KEY_LEGACY);
    if (legacy === "light" || legacy === "dark") return legacy;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
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
      if (scopedTheme === "light" || scopedTheme === "dark")
        setTheme(scopedTheme);
      else if (legacyTheme === "light" || legacyTheme === "dark")
        setTheme(legacyTheme);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, LASTTEXT_KEY]);

  // ✅ 初始化查詢歷史（分桶）
  useEffect(() => {
    try {
      const scoped = window.localStorage.getItem(HISTORY_KEY);
      if (scoped) {
        const parsed = JSON.parse(scoped);
        if (Array.isArray(parsed)) {
          const next = parsed.slice(0, HISTORY_LIMIT);
          setHistory(next);

          // ✅ Production 排查：記錄 snapshot 覆蓋率（不影響任何業務邏輯）
          const withSnapshot = next.filter((x) => !!x?.resultSnapshot).length;
          const count = next.length;
          const snapshotCoverage = count > 0 ? withSnapshot / count : 0;
        }
      } else {
      }
    } catch {
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [HISTORY_KEY]);

  // ✅ 寫回查詢歷史（只寫 scoped key）
  useEffect(() => {
    try {
      window.localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history.slice(0, HISTORY_LIMIT))
      );

      // ✅ Production 排查：寫回時同步更新 snapshot 覆蓋率（不影響任何業務邏輯）
      const sliced = Array.isArray(history)
        ? history.slice(0, HISTORY_LIMIT)
        : [];
      const withSnapshot = sliced.filter((x) => !!x?.resultSnapshot).length;
      const count = sliced.length;
      const snapshotCoverage = count > 0 ? withSnapshot / count : 0;
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, HISTORY_KEY]);

  // ✅ handleTextChange：輸入時同步更新 text，並重置 index
  const handleTextChange = (v) => {
    setText(v);
    setHistoryIndex(-1);
  };

  // ✅ 取得下一個 index（避免超界）
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  /**
   * 功能：從 history item 回放結果（不重新訪問）
   * - 若該筆缺少 resultSnapshot（舊資料），則清空 result（避免顯示上一筆結果造成誤會）
   * - 注意：此函式只做 UI 狀態同步，不做任何 network 行為
   */
  const applyHistoryItemToUI = (item, options = {}) => {
    if (!item) return;

    /**
     * ✅ 2026-01-05：Phase X 修正（SearchBox 不跟著歷史切換改變）
     * - 背景：SearchBox 是 controlled input（value 綁定 text），若歷史翻頁時 setText(item.text) 會導致輸入框跟著變
     * - 規格：歷史導覽（Prev/Next）只回放 resultSnapshot，不回寫輸入框
     * - 作法：新增 options.syncInput（預設 true）；歷史導覽呼叫時傳 syncInput:false
     */
    const syncInput = options && options.syncInput === false ? false : true;

    // 1) 同步輸入框
    // ✅ 注意：歷史導覽（Prev/Next）不應回寫 SearchBox，因此當 syncInput=false 時略過 setText
    if (syncInput) {
      if (item?.text) setText(item.text);
    }

    // 2) 同步字卡結果（真正翻頁的關鍵）
    if (item?.resultSnapshot) {
      setResult(item.resultSnapshot);
    } else {
      // 舊 history 沒有 snapshot：避免顯示錯的結果，直接清掉
      setResult(null);
    }
  };

  /**
   * 功能：查詢命中歷史（不重打 /api/analyze）
   * - 目的：同一個字再次查詢時，不再訪問後端；直接切到對應的歷史結果（或視為最新、移到最前面）
   * - 命中規則（保守）：
   *   1) q === historyItem.text（忽略大小寫，de-DE）
   *   2) q === historyItem.headword（忽略大小寫，de-DE）
   * - 注意：此處的 normalize 僅用於「比對」，不更新 searchNormalizeInitStatus，避免影響排查狀態與造成 console 噪音
   */
  const normalizeForHistoryCompare = (v) => {
    return (v ?? "").toString().trim().toLocaleLowerCase("de-DE");
  };

  /**
   * 功能：尋找 history 命中 index
   * - 回傳：找到則回 index；找不到回 -1
   */
  const findHistoryHitIndex = (q) => {
    const nq = normalizeForHistoryCompare(q);
    if (!nq) return -1;
    if (!Array.isArray(history) || history.length === 0) return -1;

    // 先比 text，再比 headword（保持最直覺：你搜尋什麼就回放什麼）
    const byText = history.findIndex((h) => normalizeForHistoryCompare(h?.text) === nq);
    if (byText !== -1) return byText;

    const byHeadword = history.findIndex(
      (h) => normalizeForHistoryCompare(h?.headword) === nq
    );
    if (byHeadword !== -1) return byHeadword;

    return -1;
  };

  /**
   * 功能：命中 history 後的回放（不重打 API）
   * - 行為：
   *   1) 直接回放 resultSnapshot（applyHistoryItemToUI）
   *   2) 把該筆移到最前面（視為最新查詢）
   *   3) historyIndex 設為 0
   */
  const replayHistoryHit = (hitIndex, q, source = "") => {
    if (!Array.isArray(history) || hitIndex < 0 || hitIndex >= history.length) return false;

    const hitItem = history[hitIndex];

    // ✅ 可控 debug：只有開 DEBUG=search 才印（避免噪音）
    if (isSearchDebugEnabled()) {
      try {
        console.debug("[search][history-hit][replay]", {
          source,
          q,
          hitIndex,
          hitText: hitItem?.text || "",
          hitHeadword: hitItem?.headword || "",
          hasSnapshot: !!hitItem?.resultSnapshot,
        });
      } catch {}
    }

    // 先回放 UI（不做任何 network）
    applyHistoryItemToUI(hitItem);

    // 再把該筆移到最前面（視為最新查詢）
    setHistory((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      if (hitIndex < 0 || hitIndex >= prev.length) return prev;

      const item = prev[hitIndex];
      const rest = prev.filter((_, i) => i !== hitIndex);
      return [item, ...rest].slice(0, HISTORY_LIMIT);
    });

    setHistoryIndex(0);
    return true;
  };

  /**
   * 功能：清除當下回放中的那一筆 history（不重新訪問）
   * - 規則：只有在 historyIndex >= 0（正在回放某筆）時才允許清除
   * - 清除後：優先回放「同 index 的下一筆（原下一筆上移）」；若不存在則回放上一筆；都沒有就清空並回到 -1
   * - 注意：此函式只做 state/localStorage 行為，不做任何 network 行為
   */
  const clearCurrentHistoryItem = () => {
    if (!Array.isArray(history) || history.length === 0) return;
    if (historyIndex < 0) return;
    if (historyIndex >= history.length) return;


    // 使用函式式更新避免 stale state
    setHistory((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      // 以當下的 historyIndex（state）為準：這裡依照本檔既有模式，不新增 useRef 以免擾動
      const idx = historyIndex;
      if (idx < 0 || idx >= prev.length) return prev;

      const next = prev.filter((_, i) => i !== idx);

      // 清除後同步 UI（不重打 API）
      if (next.length === 0) {
        setHistoryIndex(-1);
        setText("");
        setResult(null);
      } else {
        let nextIndex = idx;
        if (nextIndex >= next.length) nextIndex = next.length - 1;
        setHistoryIndex(nextIndex);
        applyHistoryItemToUI(next[nextIndex]);
      }

      return next.slice(0, HISTORY_LIMIT);
    });
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

    // ✅ Production 排查：記錄最後一次 normalize 狀態（不影響任何業務邏輯）
    try {
    } catch {}

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
            `[analyze] POST /api/analyze failed: ${res.status} ${res.statusText}${
              detail ? ` | ${detail}` : ""
            }`
          );
        }
  
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
  
        setResult(data);
  
        const headword = (
          data?.dictionary?.baseForm ||
          data?.dictionary?.word ||
          q
        ).trim();
        const canonicalPos = (
          data?.dictionary?.canonicalPos ||
          data?.dictionary?.partOfSpeech ||
          ""
        ).trim();
  
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
      const word =
        (payload?.word || payload?.text || payload?.headword || "").toString().trim();

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

      // 你目前的歷史是用 index + snapshot
      // 這裡直接在 history 裡找「同 word + posKey」的那一筆
      const hitIndex = history.findIndex(
        (h) =>
          h?.text === word &&
          (
            h?.resultSnapshot?.dictionary?.posKey === clickedPosKey ||
            h?.resultSnapshot?.dictionary?.canonicalPos === clickedPosKey
          )
      );

      if (hitIndex >= 0) {
        console.log("[App][posSwitch] hit history", historyKey, hitIndex);

        // 切換歷史索引（這是你 Phase 4 已完成的能力）
        setHistoryIndex(hitIndex);

        // 同步顯示該筆結果（避免 re-render 亂跳）
        const snapshot = history[hitIndex]?.resultSnapshot;
        if (snapshot) {
          setResult(snapshot);
        }
      } else {
        console.log("[App][posSwitch] no history for posKey", historyKey);
        // 沒有歷史：依你的規則，pill 也不打 API
      }

      return; // ⭐ 關鍵：阻斷後續所有 analyze 流程

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
          `[analyze] POST /api/analyze failed: ${res.status} ${res.statusText}${
            detail ? ` | ${detail}` : ""
          }`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      setResult(data);

      const headword = (
        data?.dictionary?.baseForm ||
        data?.dictionary?.word ||
        q
      ).trim();
      const canonicalPos = (
        data?.dictionary?.canonicalPos ||
        data?.dictionary?.partOfSpeech ||
        ""
      ).trim();

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

  // ✅ 歷史上一頁/下一頁
  const goPrevHistory = () => {
    if (!history.length) return;
    const nextIndex = clamp(historyIndex + 1, 0, history.length - 1);
    setHistoryIndex(nextIndex);
    const item = history[nextIndex];
    applyHistoryItemToUI(item, { syncInput: false, source: "history-nav-prev" });

    // DEPRECATED (2025-12-18): 已由 applyHistoryItemToUI 統一處理
    // ✅ 2026-01-05：歷史導覽不回寫輸入框（SearchBox 不跟著變）
    // if (item?.text) setText(item.text);
  };

  const goNextHistory = () => {
    if (!history.length) return;
    const nextIndex = clamp(historyIndex - 1, -1, history.length - 1);
    setHistoryIndex(nextIndex);
    if (nextIndex === -1) return;
    const item = history[nextIndex];
    applyHistoryItemToUI(item, { syncInput: false, source: "history-nav-next" });

    // DEPRECATED (2025-12-18): 已由 applyHistoryItemToUI 統一處理
    // ✅ 2026-01-05：歷史導覽不回寫輸入框（SearchBox 不跟著變）
    // if (item?.text) setText(item.text);
  };

  const canPrevHistory = history.length > 0 && historyIndex < history.length - 1;
  const canNextHistory = history.length > 0 && historyIndex > -1;

  // ✅ legacy 遷移：WORDS / UILANG / THEME / LASTTEXT
  useEffect(() => {
    try {
      const scopedText = window.localStorage.getItem(WORDS_KEY);
      const legacyText = window.localStorage.getItem(WORDS_KEY_LEGACY);
      if (!scopedText && legacyText) {
        window.localStorage.setItem(WORDS_KEY, legacyText);
      }
    } catch {}

    try {
      const legacyLang = window.localStorage.getItem(UILANG_KEY_LEGACY);
      const scopedLang = window.localStorage.getItem(UILANG_KEY);
      if (!scopedLang && legacyLang)
        window.localStorage.setItem(UILANG_KEY, legacyLang);
    } catch {}
    try {
      const legacyTheme = window.localStorage.getItem(THEME_KEY_LEGACY);
      const scopedTheme = window.localStorage.getItem(THEME_KEY);
      if (!scopedTheme && legacyTheme)
        window.localStorage.setItem(THEME_KEY, legacyTheme);
    } catch {}
    try {
      const legacyLast = window.localStorage.getItem(LASTTEXT_KEY_LEGACY);
      const scopedLast = window.localStorage.getItem(LASTTEXT_KEY);
      if (!scopedLast && legacyLast)
        window.localStorage.setItem(LASTTEXT_KEY, legacyLast);
    } catch {}

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WORDS_KEY, UILANG_KEY, THEME_KEY, LASTTEXT_KEY]);

  // ✅ 讀取單字庫（先 scoped，沒有就 fallback legacy）
  const readWordLibraryRaw = () => {
    try {
      const scopedText = window.localStorage.getItem(WORDS_KEY);
      if (scopedText) return JSON.parse(scopedText);

      const legacyText = window.localStorage.getItem(WORDS_KEY_LEGACY);
      if (legacyText) {
        const parsed = JSON.parse(legacyText);
        try {
          window.localStorage.setItem(WORDS_KEY, legacyText);
        } catch {}
        return parsed;
      }

      return null;
    } catch {
      return null;
    }
  };

  // 單字庫 normalize
  const normalizeWordLibrary = (raw) => {
    if (!raw) return [];
    let list = [];
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === "object") list = Object.values(raw);
    else return [];

    const cleaned = list
      .map((x) => {
        if (!x || typeof x !== "object") return null;
        const headword = (x.headword || x.word || x.text || "").trim();
        const canonicalPos = (
          x.canonicalPos ||
          x.pos ||
          x.canonical_pos ||
          x.canonicalPOS ||
          ""
        ).trim();
        if (!headword) return null;

        return {
          headword,
          canonicalPos,
          createdAt: x.createdAt || x.created_at || x.time || "",
          userId: x.userId || x.user_id || "",
        };
      })
      .filter(Boolean);

    const seen = new Set();
    const uniq = [];
    for (const it of cleaned) {
      const key = `${it.headword}::${it.canonicalPos}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(it);
    }
    return uniq;
  };

  // ✅ loadLibrary：讀出 localStorage 並更新 state（僅 legacy 模式用）
  const loadLibrary = () => {
    if (USE_API_LIBRARY) return;

    const raw = readWordLibraryRaw();
    const list = normalizeWordLibrary(raw);

    const sanitized = list.map((x) => ({ ...x, userId: authUserId }));
    setLibraryItems(sanitized);
  };

  useEffect(() => {
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WORDS_KEY]);

  // ✅ 寫回單字庫（只寫 scoped key）
  const writeWordLibraryRaw = (raw) => {
    try {
      window.localStorage.setItem(WORDS_KEY, JSON.stringify(raw));
    } catch {}
  };

  /**
   * 功能：收藏比對用的字串正規化
   */
  const normalizeFavoriteText = (v) => {
    return (v || "").toString().trim();
  };

  const normalizeFavoriteTextLower = (v) => {
    return normalizeFavoriteText(v).toLocaleLowerCase("de-DE");
  };

  /**
   * 功能：從 entry 取出收藏 key（headword + canonicalPos）
   */
  const getFavoriteKey = (entry) => {
    const headword = (entry?.headword || "").trim();
    const canonicalPos = (entry?.canonicalPos || "").trim();
    const headwordKey = normalizeFavoriteTextLower(headword);
    const canonicalPosKey = normalizeFavoriteTextLower(canonicalPos);
    return { headword, canonicalPos, headwordKey, canonicalPosKey };
  };

  /**
   * 功能：從 entry 取出 gloss snapshot（保守 fallback）
   * - 只挑 entry 既有欄位的「第一個非空字串」
   * - 不做任何推論、不生成新資料
   */
  const pickFirstNonEmptyString = (candidates) => {
    if (!Array.isArray(candidates)) return "";
    for (const v of candidates) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };

  const getGlossSnapshotFromEntry = (entry) => {
    const senseIndex = Number.isInteger(entry?.senseIndex) ? entry.senseIndex : 0;

    // ✅ Phase 1（多釋義）：senses 來源以 entry.senses 為主；若不存在則嘗試 entry.headwordSenses
    const senses = Array.isArray(entry?.senses)
      ? entry.senses
      : Array.isArray(entry?.headwordSenses)
      ? entry.headwordSenses
      : null;
    const senseGloss =
      senses && senses[senseIndex] && typeof senses[senseIndex]?.gloss === "string"
        ? senses[senseIndex].gloss
        : "";

    const sense0Gloss =
      senses && senses[0] && typeof senses[0]?.gloss === "string" ? senses[0].gloss : "";

    return pickFirstNonEmptyString([
      entry?.headwordGloss,
      entry?.headword_gloss,
      entry?.gloss,
      entry?.meaning,
      entry?.definition,
      senseGloss,
      sense0Gloss,
    ]);
  };

  /**
   * 功能：由 entry 產生「要寫入 DB 的收藏 payload 清單」
   * - 單筆：回傳 1 筆（維持既有行為）
   * - 多釋義：若 entry.senses 為陣列且長度 > 0，回傳 N 筆（senseIndex 0..N-1）
   * - 注意：本函式只做「資料整形」，不做 network
   */
  const buildFavoritePayloadsFromEntry = (entry, { headword, canonicalPos }) => {
    // ✅ Phase 1（多釋義）：senses 來源以 entry.senses 為主；若不存在則嘗試 entry.headwordSenses（WordCard 全釋義快照）
    const senses = Array.isArray(entry?.senses)
      ? entry.senses
      : Array.isArray(entry?.headwordSenses)
      ? entry.headwordSenses
      : null;

    const defaultLang =
      typeof entry?.headwordGlossLang === "string" && entry.headwordGlossLang.trim()
        ? entry.headwordGlossLang.trim()
        : uiLang;

    // 多釋義：逐一寫入
    if (senses && senses.length > 0) {
      const payloads = senses.map((s, idx) => {
        const senseGloss =
          s && typeof s?.gloss === "string" && s.gloss.trim() ? s.gloss : "";

        const headwordGloss = pickFirstNonEmptyString([
          // 若上游已給 headwordGloss，仍以 sense gloss 優先（更精準對應 senseIndex）
          senseGloss,
          // 保守 fallback：同一 entry 的其他欄位（避免空字串）
          entry?.headwordGloss,
          entry?.headword_gloss,
          entry?.gloss,
          entry?.meaning,
          entry?.definition,
        ]);

        return {
          headword,
          canonicalPos,
          senseIndex: idx,
          headwordGloss,
          headwordGlossLang: defaultLang,
        };
      });

      return payloads;
    }

    // 單筆（既有行為）
    const senseIndex = Number.isInteger(entry?.senseIndex) ? entry.senseIndex : 0;
    const headwordGloss =
      typeof entry?.headwordGloss === "string" && entry.headwordGloss.trim()
        ? entry.headwordGloss
        : getGlossSnapshotFromEntry(entry);

    return [
      {
        headword,
        canonicalPos,
        senseIndex,
        headwordGloss,
        headwordGlossLang: defaultLang,
      },
    ];
  };

  /** 功能：讀取單字庫（分頁） */

  /**
   * 任務 2：讀取「收藏分類清單」
   * - GET /api/library/favorites/categories
   * - 失敗時：不影響既有收藏清單（fallback：不篩選）
   */
  const loadFavoriteCategoriesFromApi = async () => {
    if (!authUserId) return { ok: false, categories: null, error: new Error("not logged in") };

    setFavoriteCategoriesLoading(true);
    setFavoriteCategoriesLoadError(null);

    try {
      const res = await apiFetch(`/api/library/favorites/categories`);
      if (!res) throw new Error("[favorites] categories response is null");

      // ✅ 401/403：視為未登入（維持既有行為：讓外層靠 authUserId 控制）
      if (res.status === 401 || res.status === 403) {
        const err = new Error(`[favorites] categories unauthorized: ${res.status}`);
        setFavoriteCategoriesLoadError(err);
        setFavoriteCategories([]);
        return { ok: false, categories: null, error: err, unauthorized: true };
      }

      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[favorites] GET /api/library/favorites/categories failed: ${res.status} ${res.statusText}${
            detail ? " | " + detail : ""
          }`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      const categories = Array.isArray(data?.categories) ? data.categories : [];
      setFavoriteCategories(categories);

      return { ok: true, categories };
    } catch (e) {
      // ✅ fallback：不影響原本收藏清單
      setFavoriteCategoriesLoadError(e);
      setFavoriteCategories([]);
      return { ok: false, categories: null, error: e };
    } finally {
      setFavoriteCategoriesLoading(false);
    }
  };

  const loadLibraryFromApi = async ({ limit = 50, cursor = null, categoryId = null } = {}) => {
    if (!authUserId) return;

    try {
      const qs = new URLSearchParams();
      qs.set("limit", String(limit));
      if (cursor) qs.set("cursor", cursor);
      if (categoryId) qs.set("category_id", String(categoryId));

      const res = await apiFetch(`/api/library?${qs.toString()}`);
      if (!res) throw new Error("[library] response is null");
      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[library] GET /api/library failed: ${res.status} ${res.statusText}${
            detail ? ` | ${detail}` : ""
          }`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      const items = Array.isArray(data?.items) ? data.items : [];
      const nextCursor = data?.nextCursor ?? null;

      setLibraryItems(items);
      setLibraryCursor(nextCursor);

      // ✅ 回傳最新資料，供上層做「寫入驗證」與除錯（不影響既有 UI 流程）
      return { items, nextCursor };
    } catch (e) {
      // 保留 try/catch 結構避免 throw 影響 UI

      // ✅ 回傳錯誤狀態（供上層「寫入驗證」判斷）
      return { items: null, nextCursor: null, error: e };
    }
  };

  /**
   * 功能：POST /api/library（upsert）共用底層
   * - 用途：統一處理 res.ok 檢查與錯誤訊息，避免各處重複拼字串
   * - 注意：本函式不強制帶 gloss keys（gloss 僅在收藏當下由 addFavoriteViaApi 處理）
   */
  const postLibraryUpsertViaApi = async (payload) => {
    if (!authUserId) return;

    /**
     * ✅ 重要修正（2026-01-03）
     * - 原本這裡誤寫成遞迴呼叫自己，會導致「看起來有送出、但實際上根本沒打到後端」
     * - 依照既有設計：本函式應該統一呼叫後端 POST /api/library 做 upsert
     */
    // DEPRECATED (2026-01-03): 避免遞迴呼叫自己造成 Maximum call stack size exceeded
    // await postLibraryUpsertViaApi(payload);

    const safePayload = payload || {};
    const actionHeadword = (safePayload?.headword || "").toString().trim();
    const actionCanonicalPos = (safePayload?.canonicalPos || "").toString().trim();
    const actionSenseIndex = Number.isInteger(safePayload?.senseIndex)
      ? safePayload.senseIndex
      : null;

    // Production 排查：記錄開始寫入（不影響任何業務邏輯）
    try {
    } catch {}

    const res = await apiFetch(`/api/library`, {
      method: "POST",
      body: JSON.stringify(safePayload),
    });

    if (!res) {
      try {
      } catch {}
      throw new Error("[library] response is null");
    }

    if (!res.ok) {
      let detail = "";
      try {
        detail = await res.text();
      } catch {}

      try {
      } catch {}

      throw new Error(
        `[library] POST /api/library failed: ${res.status} ${res.statusText}${
          detail ? " | " + detail : ""
        }`
      );
    }

    // ✅ DB 寫入驗證：嘗試解析回應 JSON（不影響既有流程；解析失敗也不阻斷）
    let respJson = null;
    try {
      respJson = await res.clone().json();
    } catch {
      respJson = null;
    }

    // Production 排查：記錄回應摘要（不影響任何業務邏輯）
    try {
      const hasError = !!respJson?.error;
    } catch {}

    // ✅ 可控 debug：避免 console 噪音，只有開 DEBUG=library 才印詳細回應
    if (isLibraryDebugEnabled()) {
      try {
        console.debug("[library][postLibraryUpsertViaApi][verify]", {
          payload: {
            headword: actionHeadword,
            canonicalPos: actionCanonicalPos,
            senseIndex: actionSenseIndex,
            familiarity: Number.isInteger(safePayload?.familiarity)
              ? safePayload.familiarity
              : null,
            isHidden: typeof safePayload?.isHidden === "boolean" ? safePayload.isHidden : null,
          },
          responseJson: respJson,
        });
      } catch {}
    }

    // ✅ 保守提醒：res.ok 但回應帶 error（不拋錯避免 UI 中斷；你可以用 console filter 看到）
    if (respJson?.error) {
      try {
        console.warn("[library][postLibraryUpsertViaApi][warn] res.ok but response.error exists", {
          error: respJson.error,
        });
      } catch {}
    }
  };

  /** 功能：新增收藏（upsert） */
  const addFavoriteViaApi = async ({
    headword,
    canonicalPos,
    senseIndex,
    headwordGloss,
    headwordGlossLang,
    familiarity,
    isHidden,
    // ✅ Task 3：新增收藏可選分類（容錯：允許 categoryId / category_id）
    categoryId,
    category_id,
  }) => {
    if (!authUserId) return;

    /**
     * Phase 1：補寫入釋義（gloss snapshot）
     * - 永遠帶 headwordGloss/headwordGlossLang（即使 gloss 為空字串，也送出 key 方便後端 log 追查）
     * - senseIndex 仍維持「有整數才送」的行為
     */
    const safeGloss = typeof headwordGloss === "string" ? headwordGloss : "";
    const safeGlossLang =
      typeof headwordGlossLang === "string" && headwordGlossLang.trim()
        ? headwordGlossLang.trim()
        : uiLang;

// ✅ Task 3：category_id（必須是有效整數；不合法就不帶，讓後端走預設策略）
const rawCat = category_id ?? categoryId;
const catNum = Number.parseInt(String(rawCat ?? ""), 10);
const safeCategoryId = Number.isFinite(catNum) && catNum > 0 ? catNum : null;

    const payload = {
      headword,
      canonicalPos,
      ...(Number.isInteger(senseIndex) ? { senseIndex } : {}),
      headwordGloss: safeGloss,
      headwordGlossLang: safeGlossLang,
      ...(Number.isInteger(familiarity) ? { familiarity } : {}),
      ...(typeof isHidden === "boolean" ? { isHidden } : {}),
      ...(safeCategoryId != null ? { category_id: safeCategoryId } : {}),
    };

    // ✅ runtime 觀察：確認前端送出的 payload 是否包含 gloss key/值
    try {
      console.log("[favorite][addFavoriteViaApi][payload]", {
        headword,
        canonicalPos,
        senseIndex: Number.isInteger(senseIndex) ? senseIndex : null,
        headwordGlossLen: typeof safeGloss === "string" ? safeGloss.length : -1,
        headwordGlossPreview:
          typeof safeGloss === "string" ? safeGloss.slice(0, 60) : "",
        headwordGlossLang: safeGlossLang,
      });
    } catch {}

    // DEPRECATED (2025-12-26): legacy payload（不含 gloss），保留作為歷史參考

    const res = await apiFetch(`/api/library`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res) throw new Error("[library] response is null");
    if (!res.ok) {
      let detail = "";
      try {
        detail = await res.text();
      } catch {}
      throw new Error(
        `[library] POST /api/library failed: ${res.status} ${res.statusText}${detail ? " | " + detail : ""}`
      );
    }
  };

  /**
   * 功能：更新「義項狀態」到 DB（沿用 POST /api/library）
   * - 目的：讓 WordLibraryPanel 的熟悉度/禁止顯示 UI 可以直接寫入 user_words
   * - 注意：此路徑不應覆寫收藏當下的 gloss snapshot，因此不帶 headwordGloss/headwordGlossLang
   */
  const updateSenseStatusViaApi = async ({
    headword,
    canonicalPos,
    senseIndex,
    familiarity,
    isHidden,
  }) => {
    if (!authUserId) return;
    if (!headword) return;

    const payload = {
      headword,
      canonicalPos,
      ...(Number.isInteger(senseIndex) ? { senseIndex } : {}),
      ...(Number.isInteger(familiarity) ? { familiarity } : {}),
      ...(typeof isHidden === "boolean" ? { isHidden } : {}),
    };

    // ✅ runtime 觀察：確認義項狀態是否真的送出（不影響業務邏輯）
    try {
      console.log("[library][updateSenseStatusViaApi][payload]", {
        headword,
        canonicalPos,
        senseIndex: Number.isInteger(senseIndex) ? senseIndex : null,
        familiarity: Number.isInteger(familiarity) ? familiarity : null,
        isHidden: typeof isHidden === "boolean" ? isHidden : null,
      });
    } catch {}

    await postLibraryUpsertViaApi(payload);

    // ✅ 重新拉一次 library（維持既有行為）
    const after = await loadLibraryFromApi({ limit: 50 });

    // ✅ 寫入驗證：避免「API 回 200 但 DB/RLS 未寫入」或「list endpoint 查不到」卻不自知
    // - 正常情況下：不印 log（降低噪音）
    // - 異常情況下：印 warn，方便你用 Console Filter 抓「[library][verify]」
    try {
      const afterItems = after?.items || null;

      const match = Array.isArray(afterItems)
        ? afterItems.find((x) => {
            return (
              x &&
              x.headword === headword &&
              x.canonicalPos === canonicalPos &&
              Number(x.senseIndex) === Number(senseIndex)
            );
          })
        : null;

      const wantedF = Number.isInteger(familiarity) ? familiarity : null;
      const wantedH = typeof isHidden === "boolean" ? isHidden : null;

      const gotF =
        match && Object.prototype.hasOwnProperty.call(match, "familiarity")
          ? match.familiarity ?? null
          : null;
      const gotH =
        match && Object.prototype.hasOwnProperty.call(match, "isHidden")
          ? match.isHidden ?? null
          : null;

      const mismatch = !match || gotF !== wantedF || gotH !== wantedH;

      if (mismatch) {
        console.warn("[library][verify] write seems NOT reflected in list result", {
          headword,
          canonicalPos,
          senseIndex,
          wanted: { familiarity: wantedF, isHidden: wantedH },
          got: match ? { familiarity: gotF, isHidden: gotH } : null,
        });
      }
    } catch (e) {
      console.warn("[library][verify] verification error", e);
    }
  };

  /**
   * 功能：義項狀態更新 wrapper（並存模式）
   * - USE_API_LIBRARY=true：寫 DB
   * - USE_API_LIBRARY=false：僅 log（目前 legacy localStorage 未實作義項顆粒度狀態）
   */
  const handleUpdateSenseStatus = (payload) => {
    if (!authUserId) return;
    if (USE_API_LIBRARY) {
      updateSenseStatusViaApi(payload);
      return;
    }

    // DEPRECATED (2026-01-01): legacy localStorage 尚未支援義項顆粒度狀態，先保留 log 方便排查
    try {
      console.log("[library][handleUpdateSenseStatus][legacy][noop]", payload);
    } catch {}
  };

  /** 功能：取消收藏 */
  const removeFavoriteViaApi = async ({ headword, canonicalPos }) => {
    if (!authUserId) return;

    const res = await apiFetch(`/api/library`, {
      method: "DELETE",
      body: JSON.stringify({ headword, canonicalPos }),
    });

    if (!res) throw new Error("[library] response is null");
    if (!res.ok) {
      let detail = "";
      try {
        detail = await res.text();
      } catch {}
      throw new Error(
        `[library] DELETE /api/library failed: ${res.status} ${res.statusText}${
          detail ? ` | ${detail}` : ""
        }`
      );
    }
  };

  /**
   * 功能：API 版收藏切換（DB 唯一真相）
   */
  const toggleFavoriteViaApi = async (entry, options = null) => {
    if (!authUserId) return;
    const { headword, canonicalPos } = getFavoriteKey(entry);
    if (!headword) return;

    const exists = libraryItems.some((x) => {
      return (
        (x?.headword || "").trim() === headword &&
        ((x?.canonical_pos ?? x?.canonicalPos) || "").trim() === canonicalPos
      );
    });

// ✅ Task 3：決定要送出的 category_id（新增收藏時）
// - 優先：呼叫端 options.category_id / options.categoryId
// - 其次：目前 ResultPanel 下拉所選（selectedFavoriteCategoryId）
// - 再其次：收藏分類清單內 name===「我的最愛1」的 id
// - 最後：不帶 category_id（讓後端用預設策略）
const pickDefaultCategoryIdForAdd = () => {
  try {
    // 1) options
    const optRaw =
      options && typeof options === "object"
        ? options.category_id ?? options.categoryId
        : null;
    if (optRaw !== null && typeof optRaw !== "undefined") return optRaw;

    // 2) state selected
    if (selectedFavoriteCategoryId) return selectedFavoriteCategoryId;

    // 3) name===我的最愛1
    if (Array.isArray(favoriteCategories) && favoriteCategories.length > 0) {
      const prefer = favoriteCategories.find((c) => (c?.name || "") === "我的最愛1");
      if (prefer && (prefer?.id ?? null) !== null) return prefer.id;
    }
  } catch (e) {
    // no-op
  }
  return null;
};

const rawCat = pickDefaultCategoryIdForAdd();
const catNum = Number.parseInt(String(rawCat ?? ""), 10);
const safeCategoryId = Number.isFinite(catNum) && catNum > 0 ? catNum : null;

    try {
      if (exists) {
        await removeFavoriteViaApi({ headword, canonicalPos });
      } else {
        // Phase 1：多釋義 → 逐一 upsert（senseIndex 0..n-1）
        const payloads = buildFavoritePayloadsFromEntry(entry, {
          headword,
          canonicalPos,
        });

        // ✅ runtime 觀察：本次要送出幾筆 sense payload
        try {
          console.log("[favorite][toggleFavoriteViaApi][multi-sense][plan]", {
            headword,
            canonicalPos,
            payloadCount: Array.isArray(payloads) ? payloads.length : 0,
            hasSensesArray: Array.isArray(entry?.senses),
            sensesLen: Array.isArray(entry?.senses) ? entry.senses.length : 0,
            hasHeadwordSensesArray: Array.isArray(entry?.headwordSenses),
            headwordSensesLen: Array.isArray(entry?.headwordSenses)
              ? entry.headwordSenses.length
              : 0,
          });
        } catch {}

        if (Array.isArray(payloads) && payloads.length > 0) {
          for (const p of payloads) {
            // ✅ runtime 觀察：每筆 payload 的 gloss 狀態
            try {
              console.log("[favorite][toggleFavoriteViaApi][multi-sense][one]", {
                headword: p?.headword,
                canonicalPos: p?.canonicalPos,
                senseIndex: Number.isInteger(p?.senseIndex) ? p.senseIndex : null,
                headwordGlossLen:
                  typeof p?.headwordGloss === "string" ? p.headwordGloss.length : -1,
                headwordGlossPreview:
                  typeof p?.headwordGloss === "string"
                    ? p.headwordGloss.slice(0, 60)
                    : "",
                headwordGlossLang: p?.headwordGlossLang,
              });
            } catch {}

            await addFavoriteViaApi({
              ...p,
              ...(safeCategoryId != null ? { category_id: safeCategoryId } : {}),
            });
          }
        } else {
          // DEPRECATED (2025-12-26): 理論上不會走到（payloads 最少回 1），保留以便排查
          await addFavoriteViaApi({
            headword,
            canonicalPos,
            senseIndex: 0,
            headwordGloss: "",
            headwordGlossLang: uiLang,
            ...(safeCategoryId != null ? { category_id: safeCategoryId } : {}),
          });
        }
      }
      await loadLibraryFromApi({ limit: 50 });
    } catch (e) {}
  };

  /**
   * 功能：收藏切換 wrapper（並存模式）
   */
  const handleToggleFavorite = (entry, options = null) => {
    if (!authUserId) return;
    if (USE_API_LIBRARY) {
      toggleFavoriteViaApi(entry, options);
      return;
    }
    toggleFavorite(entry);
  };

  /**
   * 任務 2：切換收藏分類（下拉選單）
   * - 必須 reset cursor（從第一頁開始）
   * - localStorage per userId 記住
   */
  const handleSelectFavoriteCategory = async (categoryId) => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;

    const nextId = categoryId ? String(categoryId) : null;

    try {
      if (nextId) window.localStorage.setItem(FAVORITES_CATEGORY_KEY, nextId);
      else window.localStorage.removeItem(FAVORITES_CATEGORY_KEY);
    } catch (e) {
      // no-op
    }

    setSelectedFavoriteCategoryId(nextId);

    // ✅ reset cursor
    try {
      setLibraryCursor(null);
    } catch (e) {}

    // ✅ 重新拉收藏清單（依分類 / fallback：不篩選）
    if (nextId) {
      await loadLibraryFromApi({ limit: 50, cursor: null, categoryId: nextId });
    } else {
      await loadLibraryFromApi({ limit: 50, cursor: null });
    }
  };

  /**
   * 任務 3：查字結果區「新增收藏」用的分類選擇（不影響單字庫清單的篩選）
   * - 目的：ResultPanel 的下拉可用，並記住使用者最後選擇
   * - 注意：不要在這裡觸發 loadLibraryFromApi（避免你只是想換收藏分類，卻導致單字庫列表被重拉）
   */
  const handleSelectFavoriteCategoryForAdd = (categoryId) => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;

    const nextId = categoryId ? String(categoryId) : null;

    try {
      if (nextId) window.localStorage.setItem(FAVORITES_CATEGORY_KEY, nextId);
      else window.localStorage.removeItem(FAVORITES_CATEGORY_KEY);
    } catch (e) {
      // no-op
    }

    setSelectedFavoriteCategoryId(nextId);
  };

  /**
   * 任務 3：為了讓 ResultPanel 的分類下拉「一進查字結果就能用」
   * - 原本分類只在打開單字庫彈窗時才載入，會導致 ResultPanel 下拉永遠沒有 options → disabled
   * - 這裡改成：只要登入後且使用 API library，就先載入一次分類（失敗也不阻斷收藏）
   */
  useEffect(() => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;

    if (favoriteCategoriesLoading) return;
    if (Array.isArray(favoriteCategories) && favoriteCategories.length > 0) return;

    loadFavoriteCategoriesFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [USE_API_LIBRARY, authUserId]);



  // ✅ Phase 4：彈窗打開時載入單字庫（取代 view===library 的舊觸發方式）
// ✅ 任務 2：同時載入收藏分類，並依分類重新載入 items（fallback：不篩選）
  useEffect(() => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;
    if (!showLibraryModal) return;

    let cancelled = false;

    (async () => {
      // 1) 先拉分類（若失敗，不阻斷：仍可走不篩選）
      const catRes = await loadFavoriteCategoriesFromApi();

      if (cancelled) return;

      const cats = Array.isArray(catRes?.categories) ? catRes.categories : [];

      // 2) 決定預設分類（優先：localStorage；其次：name===我的最愛1；最後：第一個）
      let nextSelectedId = selectedFavoriteCategoryId;

      if (!nextSelectedId) {
        const prefer = cats.find((c) => (c?.name || "") === "我的最愛1");
        if (prefer && (prefer?.id ?? null) !== null) nextSelectedId = String(prefer.id);
        else if (cats[0] && (cats[0]?.id ?? null) !== null) nextSelectedId = String(cats[0].id);
        else nextSelectedId = null;
      } else {
        // ✅ 若 localStorage 記住的 id 不在清單中，則回退到第一個
        const hit = cats.some((c) => String(c?.id ?? "") === String(nextSelectedId));
        if (!hit) {
          if (cats[0] && (cats[0]?.id ?? null) !== null) nextSelectedId = String(cats[0].id);
          else nextSelectedId = null;
        }
      }

      // 3) 設定 state + localStorage（每個 userId 各自記住）
      try {
        if (nextSelectedId) {
          setSelectedFavoriteCategoryId(String(nextSelectedId));
          window.localStorage.setItem(FAVORITES_CATEGORY_KEY, String(nextSelectedId));
        } else {
          setSelectedFavoriteCategoryId(null);
          window.localStorage.removeItem(FAVORITES_CATEGORY_KEY);
        }
      } catch (e) {
        // no-op
      }

      // 4) reset cursor + 載入收藏清單（依分類 / fallback：不帶 category_id）
      try {
        setLibraryCursor(null);
      } catch (e) {}

      if (nextSelectedId) {
        await loadLibraryFromApi({ limit: 50, cursor: null, categoryId: nextSelectedId });
      } else {
        await loadLibraryFromApi({ limit: 50, cursor: null });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [USE_API_LIBRARY, authUserId, showLibraryModal]);

  // ✅ isFavorited：WordCard 顯示用
  const isFavorited = (entry) => {
    const headword = (entry?.headword || "").trim();
    const canonicalPos = (entry?.canonicalPos || "").trim();
    if (!headword) return false;

    const headwordKey = normalizeFavoriteTextLower(headword);
    const canonicalPosKey = normalizeFavoriteTextLower(canonicalPos);

    return libraryItems.some((x) => {
      const xHeadwordRaw = (x?.headword || "").trim();
      const xPosRaw = ((x?.canonical_pos ?? x?.canonicalPos) || "").trim();

      return (
        normalizeFavoriteTextLower(xHeadwordRaw) === headwordKey &&
        normalizeFavoriteTextLower(xPosRaw) === canonicalPosKey
      );
    });
  };

  // ✅ toggleFavorite：legacy localStorage（保留）
  // DEPRECATED (2025-12-17): Phase 4 啟用 USE_API_LIBRARY 時，UI 應改呼叫 handleToggleFavorite（wrapper），避免直接走 localStorage
  const toggleFavorite = (entry) => {
    if (!authUserId) return;

    const headword = (entry?.headword || "").trim();
    const canonicalPos = (entry?.canonicalPos || "").trim();
    if (!headword) return;

    setLibraryItems((prev) => {
      const existsIndex = prev.findIndex((x) => {
        return (
          (x?.headword || "").trim() === headword &&
          ((x?.canonical_pos ?? x?.canonicalPos) || "").trim() === canonicalPos
        );
      });

      let next = [];
      if (existsIndex >= 0) {
        next = prev.filter((_, i) => i !== existsIndex);
      } else {
        next = [
          {
            headword,
            canonicalPos,
            createdAt: new Date().toISOString(),
            userId: authUserId,
          },
          ...prev,
        ];
      }

      writeWordLibraryRaw(next);
      return next;
    });
  };

  /**
   * 功能：開啟單字庫彈窗
   * - guest 不允許收藏，因此也不開啟（避免看到空白造成誤會）
   */
  const openLibraryModal = () => {
    if (!authUserId) return;
    setShowLibraryModal(true);
  };

  /**
   * 功能：關閉單字庫彈窗
   */
  const closeLibraryModal = () => {
    setShowLibraryModal(false);
  };

  /**
   * 功能：單字庫內點選複習
   * - 行為：把 headword 帶回輸入框並觸發查詢
   */
  const handleLibraryReview = (headword) => {
    const hw = normalizeSearchQuery(headword, "handleLibraryReview");
    if (!hw) return;
    setText(hw);
    closeLibraryModal();
    handleAnalyzeByText(hw);
  };

  return (
    <LayoutShell
      uiLang={uiLang}
      onUiLangChange={setUiLang}
      theme={theme}
      onThemeChange={setTheme}
      rightHeader={<LoginHeader uiText={currentUiText} />}
      view={view}
      onViewChange={setView}
      uiText={currentUiText}
      t={t}
      loading={loading}
      history={history}
      historyIndex={historyIndex}
      onPrevHistory={goPrevHistory}
      onNextHistory={goNextHistory}
      canFavorite={!!authUserId}
    >
      {view === "test" ? (
        <TestModePanel
          uiText={currentUiText}
          apiBase={API_BASE}
          userId={authUserId}
          uiLang={uiLang}
          isFavorited={isFavorited}
          onToggleFavorite={handleToggleFavorite}
          libraryItems={libraryItems}
          testCard={testCard}
          setTestCard={setTestCard}
          testMetaMap={testMetaMap}
          setTestMetaMap={setTestMetaMap}
          testMetaLoading={testMetaLoading}
          setTestMetaLoading={setTestMetaLoading}
        />
      ) : (
        <>
          <SearchBox
            text={text}
            onTextChange={handleTextChange}
            onAnalyze={handleAnalyze}
            loading={loading}
            uiLang={uiLang}
            onUiLangChange={setUiLang}
            uiText={currentUiText}
          />

          <ResultPanel
            result={result}
            loading={loading}
            showRaw={showRaw}
            onToggleRaw={() => setShowRaw((p) => !p)}
            uiText={currentUiText}
            uiLang={uiLang}
            WordCard={WordCard}
            GrammarCard={GrammarCard}
            isFavorited={isFavorited}
            onToggleFavorite={handleToggleFavorite}
            canFavorite={!!authUserId}
            historyIndex={historyIndex}
            historyLength={history.length}
            canPrev={canPrevHistory}
            canNext={canNextHistory}
            onPrev={goPrevHistory}
            onNext={goNextHistory}
            onWordClick={handleWordClick}
            // ✅ 任務 3：新增收藏時可選分類（ResultPanel 下拉）
            favoriteCategories={favoriteCategories}
            favoriteCategoriesLoading={favoriteCategoriesLoading}
            selectedFavoriteCategoryId={selectedFavoriteCategoryId}
            onSelectFavoriteCategory={handleSelectFavoriteCategoryForAdd}

            // ✅ 單字庫彈窗入口（icon 按鈕在 ResultPanel 最右邊）
            onOpenLibrary={openLibraryModal}
            // ✅ 清除當下回放紀錄：移到 ResultPanel 箭頭旁邊
            canClearHistory={historyIndex >= 0 && historyIndex < history.length}
            onClearHistoryItem={clearCurrentHistoryItem}
            clearHistoryLabel={t("app.history.clearThis")}
            // ✅ 詞性切換：由 ResultPanel → App
            onSelectPosKey={handleSelectPosKey}
            onSelectPosKeyFromApp={handleSelectPosKey}

          />

          {/* ✅ 單字庫彈窗（不換 view） */}
          {showLibraryModal && (
            <div
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                // 點遮罩關閉
                if (e.target === e.currentTarget) closeLibraryModal();
              }}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                zIndex: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 720,
                  borderRadius: 16,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--card-bg)",
                  color: "var(--text-main)",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                  overflow: "hidden",
                }}
              >
                {/* Header（極簡） */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 12px",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {/* ✅ 2026-01-04：隨堂考入口（從單字庫彈窗直接進入測試模式） */}
                    {/* 功能說明：
                       - 目的：讓使用者在「單字庫」能直接進入「測驗」模式（入口可達、可發現）
                       - 行為：先關閉單字庫彈窗，再切換 view="test"，避免 UI 疊層造成誤判
                       - 注意：此入口只負責切換模式，不處理出題邏輯（後續 Step 再做）
                     */}
                    <button
                      type="button"
                      onClick={() => {
                        // ✅ Production 排查：確認入口點擊是否觸發（不影響業務邏輯）
                        try {
                          console.log("[library->test] enter test mode");
                        } catch {}

                        // ✅ 先關閉單字庫彈窗，再切換到測試模式（避免疊層）
                        closeLibraryModal();
                        setView("test");
                      }}
                      style={{
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 10,
                        border: "1px solid var(--accent)",
                        background: "transparent",
                        color: "var(--accent)",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.04) inset",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      title="測驗（隨堂考）"
                      aria-label="測驗（隨堂考）"
                    >
                      <span aria-hidden="true">🧪</span>
                      <span>測驗</span>
                    </button>

                    <div style={{ fontSize: 14, fontWeight: 800 }}>
                      {t("app.topbar.library")}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeLibraryModal}
                    aria-label="Close"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--card-bg)",
                      color: "var(--text-main)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ padding: 8 }}>
                  {/* ✅ 關鍵：用 WordLibraryPanel 期待的 props，避免不顯示 */}
                  <WordLibraryPanel
                    libraryItems={libraryItems}
                    onReview={handleLibraryReview}
                    onToggleFavorite={handleToggleFavorite}
                    onUpdateSenseStatus={handleUpdateSenseStatus}
                    favoriteDisabled={!authUserId}
                    uiText={uiText}
                    uiLang={uiLang}

                    // ✅ 任務 2：收藏分類（下拉）
                    favoriteCategories={favoriteCategories}
                    favoriteCategoriesLoading={favoriteCategoriesLoading}
                    selectedFavoriteCategoryId={selectedFavoriteCategoryId}
                    onSelectFavoriteCategory={handleSelectFavoriteCategory}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </LayoutShell>
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