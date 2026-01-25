// frontend/src/app/useAppState.js
import { useCallback, useMemo, useRef, useState } from "react";

/**
 * ✅ 目的：把 App.jsx 裡面「純 state / keys / helpers / actions」集中到 hook
 * - 不放 useEffect（避免把副作用一起搬走，降低風險）
 * - 不改行為：只是把 useState 與 localStorage key 計算搬家
 */
export function useAppState({ authUserId, defaultUiLang = "zh-TW" } = {}) {
  // ============================================================
  // keys（依 userBucket scoped）
  // ============================================================
  const keys = useMemo(() => {
    const userBucket = authUserId || "guest";

    // legacy keys（早期沒分 user）
    const WORDS_KEY_LEGACY = "langapp_user_words_v1";
    const UILANG_KEY_LEGACY = "langapp_ui_lang_v1";
    const THEME_KEY_LEGACY = "langapp_theme_v1";
    const LASTTEXT_KEY_LEGACY = "langapp_last_text_v1";

    // scoped keys（登入者用 userId；未登入用 guest）
    const WORDS_KEY = `langapp::${userBucket}::langapp_user_words_v1`;
    const UILANG_KEY = `langapp::${userBucket}::langapp_ui_lang_v1`;
    const THEME_KEY = `langapp::${userBucket}::langapp_theme_v1`;
    const LASTTEXT_KEY = `langapp::${userBucket}::langapp_last_text_v1`;

    // history keys（同樣 scoped）
    const HISTORY_KEY = `langapp::${userBucket}::history_v1`;

    // favorites category select（每個 user 各自記住）
    const FAVORITES_CATEGORY_KEY = `langapp::${userBucket}::favorites_category_id_v1`;

    // app mode + learning context（scoped）
    const APP_MODE_KEY = `langapp::${userBucket}::app_mode_v1`;
    const LEARNING_CONTEXT_KEY = `langapp::${userBucket}::learning_context_v1`;

    return {
      userBucket,

      WORDS_KEY,
      UILANG_KEY,
      THEME_KEY,
      LASTTEXT_KEY,
      HISTORY_KEY,
      FAVORITES_CATEGORY_KEY,

      WORDS_KEY_LEGACY,
      UILANG_KEY_LEGACY,
      THEME_KEY_LEGACY,
      LASTTEXT_KEY_LEGACY,

      APP_MODE_KEY,
      LEARNING_CONTEXT_KEY,
    };
  }, [authUserId]);

  // ============================================================
  // helpers（寫 localStorage）
  // ============================================================
  const safeWriteLocalStorageText = useCallback((k, v) => {
    try {
      if (!k) return;
      if (typeof v !== "string") return;
      window.localStorage.setItem(k, v);
    } catch {}
  }, []);

  const safeWriteLocalStorageJson = useCallback((k, v) => {
    try {
      if (!k) return;
      window.localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  }, []);

  // ============================================================
  // Task 1：全域模式（查詢 / 學習）+ 狀態流（MVP）
  // ============================================================
  const buildDefaultLearningContext = useCallback(() => {
    const nowIso = new Date().toISOString();
    return {
      sourceType: null, // "library" | "set" | "favorites" ...
      sourceId: null,
      title: null,
      items: [],
      index: 0,
      updatedAt: nowIso,
    };
  }, []);

  const [mode, setMode] = useState(() => {
    try {
      const raw = window.localStorage.getItem(keys.APP_MODE_KEY);
      if (raw === "learning" || raw === "search") return raw;
    } catch {}
    return "search";
  });

  const [learningContext, setLearningContext] = useState(() => {
    try {
      const raw = window.localStorage.getItem(keys.LEARNING_CONTEXT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {}
    return buildDefaultLearningContext();
  });

  // ✅ 動作：切回查詢模式（不清 learningContext，保持可回復）
  const enterSearchMode = useCallback(() => {
    setMode("search");
  }, []);

  // ✅ 動作：進入學習模式 + 更新 context
  const enterLearningMode = useCallback(
    (ctx) => {
      setMode("learning");
      setLearningContext((prev) => ({
        ...(prev && typeof prev === "object" ? prev : buildDefaultLearningContext()),
        ...(ctx && typeof ctx === "object" ? ctx : {}),
        updatedAt: new Date().toISOString(),
      }));
    },
    [buildDefaultLearningContext]
  );

  // ✅ 動作：只更新 context（不切 mode）
  const updateLearningContext = useCallback(
    (patch) => {
      setLearningContext((prev) => ({
        ...(prev && typeof prev === "object" ? prev : buildDefaultLearningContext()),
        ...(patch && typeof patch === "object" ? patch : {}),
        updatedAt: new Date().toISOString(),
      }));
    },
    [buildDefaultLearningContext]
  );

  // ============================================================
  // Task 1 — navContext（Single Source of Truth）
  // - 本任務：只建立 state 結構 + 唯一 setter 入口
  // - 禁止接線：不從 history/favorites/learningContext 讀寫導入
  // ============================================================
  const buildEmptyNavContext = useCallback(() => {
    return {
      // 1) 來源
      source: "none", // "history" | "favorites" | "none"

      // 2) 字集與位置
      items: [],
      index: -1,
      total: 0,

      // 3) 顯示用 label（UI 不推導）
      currentLabel: "",
      prevLabel: "",
      nextLabel: "",

      // 4) 狀態與行為（由上層封裝）
      canPrev: false,
      canNext: false,
      goPrev: null,
      goNext: null,
    };
  }, []);

  const [navContext, setNavContextState] = useState(() => buildEmptyNavContext());

  // ✅ 2026-01-19：解兩個問題
  // 1) StrictMode/Concurrent 下可能出現 "The provided callback is no longer runnable."
  //    -> 避免 setState(fn-updater)（也就是傳 callback 進 setState）
  // 2) App.jsx useEffect 依賴 setNavContext；若 setNavContext 不穩定會造成無限 render loop
  //    -> setNavContext 必須 stable（useCallback deps 不能含 navContext / 任何每次 render 會變的參考）
  const navContextRef = useRef(null);

  // ✅ 對外唯一入口：整包設定 navContext（後續任務在 App.jsx 組裝後丟進來）
  // - 容錯：永遠補齊欄位，避免 UI/下游解構 undefined
  const setNavContext = useCallback(
    (nextNavContext) => {
      const base = buildEmptyNavContext();

      // prev：只從 ref 取（避免 setState(fn) 的 callback updater）
      const prevObj =
        navContextRef.current && typeof navContextRef.current === "object" ? navContextRef.current : base;

      const nextObj = nextNavContext && typeof nextNavContext === "object" ? nextNavContext : {};
      const merged = { ...base, ...prevObj, ...nextObj };

      // ✅ 容錯校正（依 spec）
      const itemsArr = Array.isArray(merged.items) ? merged.items : [];
      const totalNum =
        typeof merged.total === "number" && Number.isFinite(merged.total) ? merged.total : itemsArr.length;

      const indexNum = typeof merged.index === "number" && Number.isFinite(merged.index) ? merged.index : -1;

      const normalized = {
        ...merged,
        source:
          merged.source === "history" || merged.source === "favorites" || merged.source === "none"
            ? merged.source
            : "none",
        items: itemsArr,
        total: totalNum,
        index: indexNum,
        currentLabel: typeof merged.currentLabel === "string" ? merged.currentLabel : "",
        prevLabel: typeof merged.prevLabel === "string" ? merged.prevLabel : "",
        nextLabel: typeof merged.nextLabel === "string" ? merged.nextLabel : "",
        canPrev: !!merged.canPrev,
        canNext: !!merged.canNext,
        goPrev: typeof merged.goPrev === "function" ? merged.goPrev : null,
        goNext: typeof merged.goNext === "function" ? merged.goNext : null,
      };

      // spec：items.length === 0 時強制空狀態
      const finalValue =
        normalized.items.length === 0
          ? {
              ...buildEmptyNavContext(),
              source: normalized.source === "none" ? "none" : normalized.source,
            }
          : normalized;

      // ✅ 先更新 ref，再更新 state（避免 callback updater）
      navContextRef.current = finalValue;
      setNavContextState(finalValue);
    },
    [buildEmptyNavContext]
  );

  // ============================================================
  // UI state（從 App.jsx 搬出）
  // ============================================================
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  const [uiLang, setUiLang] = useState(() => {
    try {
      const v = window.localStorage.getItem(keys.UILANG_KEY);
      if (v) return v;
    } catch {}
    try {
      const v2 = window.localStorage.getItem(keys.UILANG_KEY_LEGACY);
      if (v2) return v2;
    } catch {}
    return defaultUiLang;
  });

  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  // ✅ view 切換：search / test（library 改彈窗，不再佔 view）
  const [view, setView] = useState("search");

  // ✅ 單字庫彈窗
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  // ✅ 單字庫狀態
  const [libraryItems, setLibraryItems] = useState([]);
  const [libraryCursor, setLibraryCursor] = useState(null);

  // ✅ 任務 2：收藏分類（Favorites Categories）
  const [favoriteCategories, setFavoriteCategories] = useState([]);
  const [favoriteCategoriesLoading, setFavoriteCategoriesLoading] = useState(false);
  const [favoriteCategoriesLoadError, setFavoriteCategoriesLoadError] = useState(null);

  // ✅ favorites category select（初始化先讀 localStorage；後續 key 變更時由 App.jsx effect 重新 sync）
  const [selectedFavoriteCategoryId, setSelectedFavoriteCategoryId] = useState(() => {
    try {
      const raw = window.localStorage.getItem(keys.FAVORITES_CATEGORY_KEY);
      if (!raw) return null;
      const trimmed = String(raw).trim();
      if (!trimmed) return null;
      return trimmed;
    } catch {
      return null;
    }
  });

  // ✅ test
  const [testCard, setTestCard] = useState(null);
  const [testMetaMap, setTestMetaMap] = useState({});
  const [testMetaLoading, setTestMetaLoading] = useState(false);

  
  // ============================================================
  // UI state — POS info collapse (global, persistent during browsing)
  // ============================================================
  const [posInfoCollapseState, setPosInfoCollapseState] = useState(() => {
    // default: empty = all expanded
    return {};
  });

  const togglePosInfoCollapse = useCallback((posKey) => {
    if (!posKey) return;
    setPosInfoCollapseState((prev) => ({
      ...(prev && typeof prev === "object" ? prev : {}),
      [posKey]: !prev?.[posKey],
    }));
  }, []);


// ============================================================
  // 統一回傳（避免 App.jsx 一堆散落變數）
  // ============================================================
  const state = {
    posInfoCollapseState,
    text,
    result,
    uiLang,
    loading,
    showRaw,
    view,
    showLibraryModal,
    mode,
    learningContext,

    // navContext（Task 1）
    navContext,

    libraryItems,
    libraryCursor,
    favoriteCategories,
    favoriteCategoriesLoading,
    favoriteCategoriesLoadError,
    selectedFavoriteCategoryId,
    testCard,
    testMetaMap,
    testMetaLoading,
  };


  // ============================================================
  // debug flags & search normalize（從 App.jsx 拆出來，避免 App.jsx 過大）
  // ============================================================
  const isLibraryDebugEnabled = useCallback(() => {
    try {
      const v = window.localStorage.getItem("DEBUG") || "";
      return String(v).includes("library");
    } catch {
      return false;
    }
  }, []);

  const isSearchDebugEnabled = useCallback(() => {
    try {
      const v = window.localStorage.getItem("DEBUG") || "";
      return String(v).includes("search");
    } catch {
      return false;
    }
  }, []);

  const isVisitDebugEnabled = useCallback(() => {
    try {
      const v = window.localStorage.getItem("DEBUG") || "";
      return String(v).includes("visit");
    } catch {
      return false;
    }
  }, []);

  const isExamplesDebugEnabled = useCallback(() => {
    try {
      const v = window.localStorage.getItem("DEBUG") || "";
      return String(v).includes("examples");
    } catch {
      return false;
    }
  }, []);

  const normalizeSearchQuery = useCallback(
    (raw, source = "") => {
      const rawStr = (raw ?? "").toString();
      let s = rawStr.trim();

      // ✅ 去除頭尾標點（僅動頭尾，不動中間）
      s = s.replace(
        /^[\s\u00A0"'“”‘’\(\)\[\]\{\}<>.,!?;:。！？；：…，．、]+|[\s\u00A0"'“”‘’\(\)\[\]\{\}<>.,!?;:。！？；：…，．、]+$/g,
        ""
      );
      s = s.trim();

      const cleaned = s;

      // ✅ 可控 debug：只有開 DEBUG=search 才印
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
    },
    [isSearchDebugEnabled]
  );

  const actions = {
    setText,
    setResult,
    setUiLang,
    setLoading,
    setShowRaw,
    setView,
    setShowLibraryModal,

    // mode
    setMode,
    setLearningContext,
    enterSearchMode,
    enterLearningMode,
    updateLearningContext,

    // navContext（Task 1）
    setNavContext,

    // library
    setLibraryItems,
    setLibraryCursor,

    // favorites categories
    setFavoriteCategories,
    setFavoriteCategoriesLoading,
    setFavoriteCategoriesLoadError,
    setSelectedFavoriteCategoryId,

    // test
    setTestCard,
    setTestMetaMap,
    setTestMetaLoading,

    // POS info collapse
    togglePosInfoCollapse,
  };

  const helpers = {
    safeWriteLocalStorageText,
    safeWriteLocalStorageJson,

    // ✅ moved from App.jsx
    isLibraryDebugEnabled,
    isSearchDebugEnabled,
    isVisitDebugEnabled,
    isExamplesDebugEnabled,
    normalizeSearchQuery,
  };

  return { keys, helpers, state, actions };
}
// frontend/src/app/useAppState.js
