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

  const [showRaw, setShowRaw] = useState(false);

  // ✅ view 切換：search / test（library 改彈窗，不再佔 view）
  const [view, setView] = useState("search");

  // ✅ 單字庫彈窗
  const [showLibraryModal, setShowLibraryModal] = useState(false);

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

  // ✅ 測試模式：隨機單字卡 + 收藏狀態
  const [testCard, setTestCard] = useState(null); // { headword, canonicalPos, userId? }
  const [testMetaMap, setTestMetaMap] = useState({}); // { [headword]: { brief, pron } }
  const [testMetaLoading, setTestMetaLoading] = useState(false);

  // 查詢歷史：存最近 10 筆
  // ✅ 2025-12-18：本輪需求改為保留 30 筆（統一套用在所有 slice）
  const HISTORY_LIMIT = 30;

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  /**
   * 功能初始化狀態（Production 排查用）
   * - 用途：快速確認「歷史資料是否成功從 localStorage 載入」、目前筆數、最後一次更新時間
   * - 注意：此狀態僅供排查，不參與任何業務邏輯
   */
  const [historyNavInitStatus, setHistoryNavInitStatus] = useState({
    ok: false,
    count: 0,
    at: "",
    note: "init",
  });

  /**
   * 功能初始化狀態（Production 排查用）
   * - 用途：確認 history 中是否含有 resultSnapshot（用於前後頁不重新訪問即可切換字卡內容）
   * - 規格：snapshotCoverage = 有 snapshot 的筆數 / 總筆數
   * - 注意：此狀態僅供排查，不參與任何業務邏輯
   */
  const [historySnapshotInitStatus, setHistorySnapshotInitStatus] = useState({
    ok: false,
    count: 0,
    withSnapshot: 0,
    snapshotCoverage: 0,
    at: "",
    note: "init",
  });

  /**
   * 功能初始化狀態（Production 排查用）
   * - 用途：確認「點擊德文字觸發新查詢」接線是否成功、最後一次點擊的字串
   * - 注意：此狀態僅供排查，不參與任何業務邏輯
   */
  const [wordClickInitStatus, setWordClickInitStatus] = useState({
    ok: false,
    lastWord: "",
    at: "",
    note: "init",
  });

  /**
   * 功能初始化狀態（Production 排查用）
   * - 用途：確認「清除當下回放紀錄」是否觸發成功
   * - 注意：此狀態僅供排查，不參與任何業務邏輯
   */
  const [historyClearInitStatus, setHistoryClearInitStatus] = useState({
    ok: false,
    lastClearedIndex: -1,
    at: "",
    note: "init",
  });

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

          // ✅ Production 排查：記錄成功載入（不影響任何業務邏輯）
          setHistoryNavInitStatus({
            ok: true,
            count: next.length,
            at: new Date().toISOString(),
            note: "loaded-from-localStorage",
          });

          // ✅ Production 排查：記錄 snapshot 覆蓋率（不影響任何業務邏輯）
          const withSnapshot = next.filter((x) => !!x?.resultSnapshot).length;
          const count = next.length;
          const snapshotCoverage = count > 0 ? withSnapshot / count : 0;
          setHistorySnapshotInitStatus({
            ok: true,
            count,
            withSnapshot,
            snapshotCoverage,
            at: new Date().toISOString(),
            note:
              withSnapshot === count
                ? "all-have-snapshot"
                : withSnapshot === 0
                  ? "no-snapshot-legacy-history"
                  : "partial-snapshot-legacy-history",
          });
        }
      } else {
        // ✅ Production 排查：本 bucket 沒有歷史資料（不影響任何業務邏輯）
        setHistoryNavInitStatus({
          ok: true,
          count: 0,
          at: new Date().toISOString(),
          note: "no-history-key",
        });

        // ✅ Production 排查：本 bucket 沒有歷史資料（不影響任何業務邏輯）
        setHistorySnapshotInitStatus({
          ok: true,
          count: 0,
          withSnapshot: 0,
          snapshotCoverage: 0,
          at: new Date().toISOString(),
          note: "no-history-key",
        });
      }
    } catch {
      // ✅ Production 排查：解析失敗（不影響任何業務邏輯）
      setHistoryNavInitStatus({
        ok: false,
        count: 0,
        at: new Date().toISOString(),
        note: "parse-failed",
      });

      // ✅ Production 排查：解析失敗（不影響任何業務邏輯）
      setHistorySnapshotInitStatus({
        ok: false,
        count: 0,
        withSnapshot: 0,
        snapshotCoverage: 0,
        at: new Date().toISOString(),
        note: "parse-failed",
      });
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

      // ✅ Production 排查：記錄最後寫回狀態（不影響任何業務邏輯）
      setHistoryNavInitStatus((prev) => ({
        ...prev,
        count: Array.isArray(history) ? history.slice(0, HISTORY_LIMIT).length : 0,
        at: new Date().toISOString(),
        note:
          prev?.note === "parse-failed"
            ? "write-after-parse-failed"
            : "written-to-localStorage",
      }));

      // ✅ Production 排查：寫回時同步更新 snapshot 覆蓋率（不影響任何業務邏輯）
      const sliced = Array.isArray(history)
        ? history.slice(0, HISTORY_LIMIT)
        : [];
      const withSnapshot = sliced.filter((x) => !!x?.resultSnapshot).length;
      const count = sliced.length;
      const snapshotCoverage = count > 0 ? withSnapshot / count : 0;
      setHistorySnapshotInitStatus((prev) => ({
        ...prev,
        ok: true,
        count,
        withSnapshot,
        snapshotCoverage,
        at: new Date().toISOString(),
        note:
          withSnapshot === count
            ? "written-all-have-snapshot"
            : withSnapshot === 0
              ? "written-no-snapshot"
              : "written-partial-snapshot",
      }));
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
  const applyHistoryItemToUI = (item) => {
    if (!item) return;

    // 1) 同步輸入框
    if (item?.text) setText(item.text);

    // 2) 同步字卡結果（真正翻頁的關鍵）
    if (item?.resultSnapshot) {
      setResult(item.resultSnapshot);
    } else {
      // 舊 history 沒有 snapshot：避免顯示錯的結果，直接清掉
      setResult(null);
    }
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

    setHistoryClearInitStatus({
      ok: true,
      lastClearedIndex: historyIndex,
      at: new Date().toISOString(),
      note: "cleared-current-history-item",
    });

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
   * 功能：Analyze（字典）- 以指定文字觸發查詢（供點字觸發使用）
   * - 注意：保留既有 handleAnalyze() 不改其介面（避免影響 SearchBox 既有呼叫）
   */
  const handleAnalyzeByText = async (rawText) => {
    const q = (rawText || "").trim();
    if (!q) return;

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

  // ✅ 查詢：Analyze（字典）
  const handleAnalyze = async () => {
    const q = (text || "").trim();
    if (!q) return;

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
    const q = (rawWord || "").trim();
    if (!q) return;

    setWordClickInitStatus({
      ok: true,
      lastWord: q,
      at: new Date().toISOString(),
      note: "clicked-word-triggered",
    });

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
    applyHistoryItemToUI(item);

    // DEPRECATED (2025-12-18): 已由 applyHistoryItemToUI 統一處理
    if (item?.text) setText(item.text);
  };
  const goNextHistory = () => {
    if (!history.length) return;
    const nextIndex = clamp(historyIndex - 1, -1, history.length - 1);
    setHistoryIndex(nextIndex);
    if (nextIndex === -1) return;
    const item = history[nextIndex];
    applyHistoryItemToUI(item);

    // DEPRECATED (2025-12-18): 已由 applyHistoryItemToUI 統一處理
    if (item?.text) setText(item.text);
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

  /** 功能：讀取單字庫（分頁） */
  const loadLibraryFromApi = async ({ limit = 50, cursor = null } = {}) => {
    if (!authUserId) return;

    try {
      const qs = new URLSearchParams();
      qs.set("limit", String(limit));
      if (cursor) qs.set("cursor", cursor);

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
    } catch (e) {
      // 保留 try/catch 結構避免 throw 影響 UI
    }
  };

  /** 功能：新增收藏（upsert） */
  const addFavoriteViaApi = async ({ headword, canonicalPos }) => {
    if (!authUserId) return;

    const res = await apiFetch(`/api/library`, {
      method: "POST",
      body: JSON.stringify({ headword, canonicalPos }),
    });

    if (!res) throw new Error("[library] response is null");
    if (!res.ok) {
      let detail = "";
      try {
        detail = await res.text();
      } catch {}
      throw new Error(
        `[library] POST /api/library failed: ${res.status} ${res.statusText}${
          detail ? ` | ${detail}` : ""
        }`
      );
    }
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
      await loadLibraryFromApi({ limit: 50 });
    } catch (e) {}
  };

  /**
   * 功能：收藏切換 wrapper（並存模式）
   */
  const handleToggleFavorite = (entry) => {
    if (!authUserId) return;
    if (USE_API_LIBRARY) {
      toggleFavoriteViaApi(entry);
      return;
    }
    toggleFavorite(entry);
  };

  // ✅ Phase 4：彈窗打開時載入單字庫（取代 view===library 的舊觸發方式）
  useEffect(() => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;
    if (!showLibraryModal) return;

    loadLibraryFromApi({ limit: 50 });
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
    const hw = (headword || "").trim();
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
            // ✅ 單字庫彈窗入口（icon 按鈕在 ResultPanel 最右邊）
            onOpenLibrary={openLibraryModal}
            // ✅ 清除當下回放紀錄：移到 ResultPanel 箭頭旁邊
            canClearHistory={historyIndex >= 0 && historyIndex < history.length}
            onClearHistoryItem={clearCurrentHistoryItem}
            clearHistoryLabel={t("app.history.clearThis")}
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
                <div style={{ fontSize: 14, fontWeight: 800 }}>
                  {t("app.topbar.library")}
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
                    favoriteDisabled={!authUserId}
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
