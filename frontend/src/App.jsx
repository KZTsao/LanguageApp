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
 * - 2025-12-17：Phase 4 修正（FavoriteStar active 永遠 false）
 *   1) getFavoriteKey：支援多種 entry 形狀（WordCard/ResultPanel 可能傳 dictionary 型或 entry 型），統一計算 headword/canonicalPos
 *   2) isFavorited：改用 getFavoriteKey 做一致化比對，避免「點星星存的是一套 key、active 判斷用另一套 key」造成星星永不變色
 */

// App 只管狀態與邏輯，畫面交給 LayoutShell / SearchBox / ResultPanel

import { useState, useEffect, useMemo } from "react";
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
   * 功能：建立單字庫初始化狀態（Production 排查用）
   * - ready：API client / env 是否可用（此處以「成功呼叫過一次 API」作為 ready）
   * - lastAction / lastFetchAt / lastError：協助定位 Production 問題
   */
  const createLibraryInitStatus = () => ({
    module: "frontend/src/App.jsx::library",
    createdAt: new Date().toISOString(),
    ready: false,
    lastAction: null,
    lastFetchAt: null,
    lastError: null,
  });

  /**
   * 功能：建立 Analyze 初始化狀態（Production 排查用）
   * - ready：是否至少成功呼叫一次 analyze API
   * - lastAction / lastFetchAt / lastError：協助定位 Production 問題
   */
  const createAnalyzeInitStatus = () => ({
    module: "frontend/src/App.jsx::analyze",
    createdAt: new Date().toISOString(),
    ready: false,
    lastAction: null,
    lastFetchAt: null,
    lastError: null,
    lastEndpoint: null,
  });

  const [showRaw, setShowRaw] = useState(false);

  // ✅ view 切換：search / library / test
  const [view, setView] = useState("search");

  // ✅ 取得目前登入 userId（未登入 = ""）
  // ✅ 解法 A：App 的 authUserId 以 AuthProvider.user 為唯一真相（避免兩份 auth state 不同步）
  const { user } = useAuth();
  const authUserId = user?.id || "";

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

  const [libraryItems, setLibraryItems] = useState([]);

  // ✅ 單字庫分頁游標（Phase 2/4：後端已支援 cursor，本輪先保留狀態欄位）
  const [libraryCursor, setLibraryCursor] = useState(null);

  // ✅ 單字庫初始化狀態（Production 排查用）
  const [libraryInitStatus, setLibraryInitStatus] = useState(() =>
    createLibraryInitStatus()
  );

  // ✅ Analyze 初始化狀態（Production 排查用）
  const [analyzeInitStatus, setAnalyzeInitStatus] = useState(() =>
    createAnalyzeInitStatus()
  );

  // ✅ 測試模式：隨機單字卡 + 收藏狀態
  const [testCard, setTestCard] = useState(null); // { headword, canonicalPos, userId? }
  const [testMetaMap, setTestMetaMap] = useState({}); // { [headword]: { brief, pron } }
  const [testMetaLoading, setTestMetaLoading] = useState(false);

  // 查詢歷史：存最近 10 筆
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

  // ✅ 以前這裡有 supabase.getSession + onAuthStateChange 訂閱。
  // ✅ 已移除：AuthProvider 已經統一管理 auth 狀態，App 只讀取 useAuth().user，避免兩邊不同步。

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
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, 10));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [HISTORY_KEY]);

  // ✅ 寫回查詢歷史（只寫 scoped key）
  useEffect(() => {
    try {
      window.localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history.slice(0, 10))
      );
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

  /* =========================================================
   * Phase 4 修正：API 回應解析（避免白畫面）
   * - apiFetch 回傳的是原生 Response
   * - 若直接 setResult(Response) / 直接讀 res.items，render 會拿不到資料而噴錯
   * ========================================================= */

  /**
   * 功能：檢查 API 是否成功（Production 排查用）
   * - 若 res.ok = false，嘗試讀取錯誤 body（文字/JSON）並丟出 Error
   */
  const assertApiOk = async (res, { scope = "api", action = "unknown" } = {}) => {
    if (!res) {
      const msg = `[${scope}] ${action} response is null`;
      throw new Error(msg);
    }
    if (res.ok) return;

    let detail = "";
    try {
      const ct = res.headers?.get?.("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await res.json();
        detail = JSON.stringify(j);
      } else {
        detail = await res.text();
      }
    } catch {
      detail = "";
    }

    const msg = `[${scope}] ${action} failed: ${res.status} ${res.statusText} ${detail ? `| ${detail}` : ""}`;
    throw new Error(msg);
  };

  /**
   * 功能：安全解析 JSON（Production 排查用）
   * - 若非 JSON 或空 body，回傳 null（避免 json() 直接 throw 造成 UI 白畫面）
   */
  const readApiJson = async (res, { scope = "api", action = "unknown" } = {}) => {
    if (!res) return null;
    const ct = res.headers?.get?.("content-type") || "";
    try {
      if (ct.includes("application/json")) return await res.json();
      // 若後端回 text/json 不一致，這裡不硬轉，避免 throw
      const txt = await res.text();
      if (!txt) return null;
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    } catch (e) {
      const msg = `[${scope}] ${action} parse json failed: ${String(e?.message || e)}`;
      throw new Error(msg);
    }
  };

  // ✅ 查詢：Analyze（字典）
  const handleAnalyze = async () => {
    const q = (text || "").trim();
    if (!q) return;

    setLoading(true);
    try {
      // ✅ Production 排查：記錄本次 analyze 開始
      setAnalyzeInitStatus((s) => ({
        ...s,
        lastAction: "handleAnalyze",
        lastError: null,
        lastEndpoint: "/api/analyze",
      }));

      // ✅ 修正：後端既有分析入口為 POST /api/analyze（避免誤打 /api/dictionary/analyze 造成 404）
      const res = await apiFetch(`/api/analyze`, {
        method: "POST",
        body: JSON.stringify({ text: q, uiLang }),
      });

      // ✅ Phase 4 修正：先確認 res.ok，再解析 JSON
      await assertApiOk(res, { scope: "analyze", action: "POST /api/analyze" });
      const data = await readApiJson(res, {
        scope: "analyze",
        action: "POST /api/analyze",
      });

      // ✅ Production 排查：記錄本次 analyze 成功
      setAnalyzeInitStatus((s) => ({
        ...s,
        ready: true,
        lastFetchAt: new Date().toISOString(),
        lastError: null,
        lastEndpoint: "/api/analyze",
      }));

      // 若後端回錯誤（例如句子模式/標點），交給 UI 顯示 alert（此段保持原設計）
      // ✅ Phase 4 修正：setResult 必須是 JSON 物件，而不是 Response
      setResult(data);

      // ✅ 歷史去重與 normalize（這段保持原設計）
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
          },
          ...next,
        ].slice(0, 10);
      });
      setHistoryIndex(0);
    } catch (e) {
      // ✅ Production 排查：記錄本次 analyze 失敗
      setAnalyzeInitStatus((s) => ({
        ...s,
        lastError: String(e?.message || e),
        lastEndpoint: "/api/analyze",
      }));
      throw e;
    } finally {
      setLoading(false);
    }
  };

  // ✅ 歷史上一頁/下一頁（此段保持原設計）
  const goPrevHistory = () => {
    if (!history.length) return;
    const nextIndex = clamp(historyIndex + 1, 0, history.length - 1);
    setHistoryIndex(nextIndex);
    const item = history[nextIndex];
    if (item?.text) setText(item.text);
  };
  const goNextHistory = () => {
    if (!history.length) return;
    const nextIndex = clamp(historyIndex - 1, -1, history.length - 1);
    setHistoryIndex(nextIndex);
    if (nextIndex === -1) return;
    const item = history[nextIndex];
    if (item?.text) setText(item.text);
  };

  // ✅ legacy 遷移：WORDS / UILANG / THEME / LASTTEXT（此段保持原設計）
  useEffect(() => {
    // ✅ 先搬 WORDS（若 scoped 沒有、legacy 有）
    try {
      const scopedText = window.localStorage.getItem(WORDS_KEY);
      const legacyText = window.localStorage.getItem(WORDS_KEY_LEGACY);
      if (!scopedText && legacyText) {
        window.localStorage.setItem(WORDS_KEY, legacyText);
      }
    } catch {}

    // ✅ 其他 key：只在 scoped 沒有時搬 legacy
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
      // 1) scoped
      const scopedText = window.localStorage.getItem(WORDS_KEY);
      if (scopedText) return JSON.parse(scopedText);

      // 2) legacy fallback
      const legacyText = window.localStorage.getItem(WORDS_KEY_LEGACY);
      if (legacyText) {
        const parsed = JSON.parse(legacyText);

        // ✅ 補回 scoped（保持行為一致）
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

    // ✅ 去重（headword + canonicalPos）
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

  // ✅ loadLibrary：讀出 localStorage 並更新 state
  const loadLibrary = () => {
    // Phase 4：若啟用 API 單字庫，避免 legacy localStorage 載入覆蓋 DB 結果（legacy code 仍保留供追溯）
    if (USE_API_LIBRARY) return;

    const raw = readWordLibraryRaw();
    const list = normalizeWordLibrary(raw);

    // ✅ 清掉舊 userId（避免不同 bucket 汙染）
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

  /* =========================================================
   * Phase 4：DB 單字庫（/api/library）並存模式
   * - 保留 legacy localStorage function（不刪）
   * - 新增 API 路徑，並由 wrapper（handleToggleFavorite）決定使用哪條路徑
   * ========================================================= */

  /**
   * 功能：從 entry 取出收藏 key（headword + canonicalPos）
   * - 只存原型（你已定義收藏只存原型）
   */
  const getFavoriteKey = (entry) => {
    // DEPRECATED (2025-12-17): 早期版本只吃 entry.headword / entry.canonicalPos
    // const headword = (entry?.headword || "").trim();
    // const canonicalPos = (entry?.canonicalPos || "").trim();
    // return { headword, canonicalPos };

    /**
     * 功能：安全取值（避免不同元件傳入不同 entry 形狀）
     * - WordCard/ResultPanel 可能傳：
     *   A) { headword, canonicalPos }
     *   B) { dictionary: { baseForm/word, canonicalPos/partOfSpeech } }
     *   C) { baseForm/word, canonicalPos/partOfSpeech }（少一層 dictionary）
     */
    const pickString = (...vals) => {
      for (const v of vals) {
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return "";
    };

    /**
     * 功能：標準化詞性欄位（canonicalPos）
     * - 保持原字串，不做映射（避免自行推測），但先 trim
     * - 若 entry 來自 dictionary，可能只有 partOfSpeech
     */
    const normalizePos = (pos) => (typeof pos === "string" ? pos.trim() : "");

    const dict = entry?.dictionary && typeof entry.dictionary === "object" ? entry.dictionary : null;

    // headword：優先原型（baseForm），其次 word/headword（維持你「只存原型」的設計）
    const headword = pickString(
      entry?.headword,
      entry?.baseForm,
      dict?.baseForm,
      entry?.word,
      dict?.word
    );

    // canonicalPos：優先 canonicalPos，其次 partOfSpeech（兼容不同回傳）
    const canonicalPos = normalizePos(
      pickString(
        entry?.canonicalPos,
        dict?.canonicalPos,
        entry?.canonical_pos,
        dict?.canonical_pos,
        entry?.partOfSpeech,
        dict?.partOfSpeech
      )
    );

    return { headword, canonicalPos };
  };

  /** 功能：讀取單字庫（分頁，Phase 2：limit 生效，不做全量） */
  const loadLibraryFromApi = async ({ limit = 50, cursor = null } = {}) => {
    if (!authUserId) return;

    try {
      const qs = new URLSearchParams();
      qs.set("limit", String(limit));
      if (cursor) qs.set("cursor", cursor);

      setLibraryInitStatus((s) => ({
        ...s,
        lastAction: "loadLibraryFromApi",
        lastError: null,
      }));

      const res = await apiFetch(`/api/library?${qs.toString()}`);

      // ✅ Phase 4 修正：先確認 res.ok，再解析 JSON
      await assertApiOk(res, { scope: "library", action: "GET /api/library" });
      const data = await readApiJson(res, {
        scope: "library",
        action: "GET /api/library",
      });

      const items = Array.isArray(data?.items) ? data.items : [];
      const nextCursor = data?.nextCursor ?? null;

      setLibraryItems(items);
      setLibraryCursor(nextCursor);

      setLibraryInitStatus((s) => ({
        ...s,
        ready: true,
        lastFetchAt: new Date().toISOString(),
        lastError: null,
      }));
    } catch (e) {
      setLibraryInitStatus((s) => ({
        ...s,
        lastError: String(e?.message || e),
      }));
    }
  };

  /** 功能：新增收藏（upsert） */
  const addFavoriteViaApi = async ({ headword, canonicalPos }) => {
    if (!authUserId) return;

    setLibraryInitStatus((s) => ({
      ...s,
      lastAction: "addFavoriteViaApi",
      lastError: null,
    }));

    const res = await apiFetch(`/api/library`, {
      method: "POST",
      body: JSON.stringify({ headword, canonicalPos }),
    });

    // ✅ Phase 4 修正：避免後端錯誤時靜默
    await assertApiOk(res, { scope: "library", action: "POST /api/library" });
    await readApiJson(res, { scope: "library", action: "POST /api/library" });
  };

  /** 功能：取消收藏 */
  const removeFavoriteViaApi = async ({ headword, canonicalPos }) => {
    if (!authUserId) return;

    setLibraryInitStatus((s) => ({
      ...s,
      lastAction: "removeFavoriteViaApi",
      lastError: null,
    }));

    const res = await apiFetch(`/api/library`, {
      method: "DELETE",
      body: JSON.stringify({ headword, canonicalPos }),
    });

    // ✅ Phase 4 修正：避免後端錯誤時靜默
    await assertApiOk(res, { scope: "library", action: "DELETE /api/library" });
    await readApiJson(res, {
      scope: "library",
      action: "DELETE /api/library",
    });
  };

  /**
   * 功能：API 版收藏切換（DB 唯一真相）
   * - 行為：存在則 DELETE，不存在則 POST
   * - 為了維持狀態一致，操作後直接 reload 第一頁（Phase 4 先用最穩的方式）
   */
  const toggleFavoriteViaApi = async (entry) => {
    if (!authUserId) return;
    const { headword, canonicalPos } = getFavoriteKey(entry);
    if (!headword) return;

    const exists = libraryItems.some((x) => {
      return (
        (x?.headword || "").trim() === headword &&
        ((x?.canonical_pos ?? x?.canonicalPos) || "").trim() === canonicalPos
      );
    });

    try {
      if (exists) {
        await removeFavoriteViaApi({ headword, canonicalPos });
      } else {
        await addFavoriteViaApi({ headword, canonicalPos });
      }

      // ✅ 以 DB 為準：操作後重新載入第一頁（limit 生效）
      await loadLibraryFromApi({ limit: 50 });
    } catch (e) {
      setLibraryInitStatus((s) => ({
        ...s,
        lastError: String(e?.message || e),
      }));
    }
  };

  /**
   * 功能：收藏切換 wrapper（並存模式）
   * - USE_API_LIBRARY = true：走 DB（/api/library）
   * - USE_API_LIBRARY = false：走 legacy localStorage（toggleFavorite）
   */
  const handleToggleFavorite = (entry) => {
    if (!authUserId) return;
    if (USE_API_LIBRARY) {
      // 不 await：保持 UI 行為與 legacy 同步（異步更新由 API 自己 refresh）
      toggleFavoriteViaApi(entry);
      return;
    }
    toggleFavorite(entry);
  };

  // ✅ Phase 4：切到 library view 且已登入時，從 DB 載入單字庫（不動既有 legacy useEffect）
  useEffect(() => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;
    if (view !== "library") return;

    loadLibraryFromApi({ limit: 50 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [USE_API_LIBRARY, authUserId, view]);

  // ✅ isFavorited：WordCard 顯示用（以 lemma/headword 來對照）
  const isFavorited = (entry) => {
    // DEPRECATED (2025-12-17): 早期版本只吃 entry.headword / entry.canonicalPos
    // const headword = (entry?.headword || "").trim();
    // const canonicalPos = (entry?.canonicalPos || "").trim();
    // if (!headword) return false;

    const { headword, canonicalPos } = getFavoriteKey(entry);
    if (!headword) return false;

    return libraryItems.some((x) => {
      return (
        (x?.headword || "").trim() === headword &&
        ((x?.canonical_pos ?? x?.canonicalPos) || "").trim() === canonicalPos
      );
    });
  };

  // ✅ toggleFavorite：統一收藏/取消（只存原型）
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
      {view === "library" ? (
        <WordLibraryPanel
          uiText={currentUiText}
          items={libraryItems}
          onRemove={(item) => handleToggleFavorite(item)}
          onReview={(item) => {
            const hw = (item?.headword || "").trim();
            if (hw) {
              setText(hw);
              setView("search");
            }
          }}
        />
      ) : view === "test" ? (
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
          />
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
