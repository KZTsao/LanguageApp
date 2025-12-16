// frontend/src/App.jsx
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

  const [showRaw, setShowRaw] = useState(false);

  // ✅ view 切換：search / library / test
  const [view, setView] = useState("search");

  // ✅ 取得目前登入 userId（未登入 = ""）
  // ✅ 解法 A：App 的 authUserId 以 AuthProvider.user 為唯一真相（避免兩份 auth state 不同步）
  const { user } = useAuth();
  const authUserId = user?.id || "";

  // ✅ user bucket：guest / user.id
  const userBucket = authUserId ? authUserId : "guest";

  // ✅ legacy keys（舊：不分桶）
  const WORDS_KEY_LEGACY = "langapp_user_words_v1";
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

  const safeJsonParse = (raw, fallback) => {
    try {
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const safeJsonStringify = (obj, fallbackString) => {
    try {
      return JSON.stringify(obj);
    } catch {
      return fallbackString;
    }
  };

  const currentUiText =
    uiText[uiLang] || uiText["zh-TW"] || Object.values(uiText)[0] || {};

  // ✅ i18n：只從 uiText 取字；缺 key 就顯示 "—"（避免默默回到中文）
  const t = useMemo(() => {
    const getByPath = (obj, path) => {
      if (!obj || !path) return undefined;
      const parts = String(path).split(".");
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

  // ✅ legacy -> scoped copy（不刪 legacy）
  useEffect(() => {
    try {
      const desiredUserId = authUserId || "";

      // words
      const scopedWords = window.localStorage.getItem(WORDS_KEY);
      if (!scopedWords) {
        const legacyWords = window.localStorage.getItem(WORDS_KEY_LEGACY);
        if (legacyWords) {
          const parsed = safeJsonParse(legacyWords, null);

          let list = [];
          if (Array.isArray(parsed)) list = parsed;
          else if (parsed && typeof parsed === "object")
            list = Object.values(parsed);

          const cleaned = list
            .map((x) => {
              if (!x || typeof x !== "object") return null;
              const headword = (x.headword || x.word || x.text || "").trim();
              const canonicalPos = (
                x.canonicalPos ||
                x.pos ||
                x.partOfSpeech ||
                ""
              ).trim();
              const createdAt = x.createdAt || x.created_at || x.created || null;
              if (!headword) return null;
              return {
                ...x,
                userId: desiredUserId,
                headword,
                canonicalPos,
                createdAt,
              };
            })
            .filter(Boolean);

          window.localStorage.setItem(
            WORDS_KEY,
            safeJsonStringify(cleaned, legacyWords)
          );
          console.log("[migrate] words legacy -> scoped (sanitized userId)", {
            to: WORDS_KEY,
            desiredUserId: desiredUserId ? "(logged-in)" : "(guest)",
          });
        }
      }

      // uiLang
      const scopedLang = window.localStorage.getItem(UILANG_KEY);
      if (!scopedLang) {
        const legacyLang = window.localStorage.getItem(UILANG_KEY_LEGACY);
        if (legacyLang) {
          window.localStorage.setItem(UILANG_KEY, legacyLang);
          console.log("[migrate] uiLang legacy -> scoped", { to: UILANG_KEY });
        }
      }

      // theme
      const scopedTheme = window.localStorage.getItem(THEME_KEY);
      if (!scopedTheme) {
        const legacyTheme = window.localStorage.getItem(THEME_KEY_LEGACY);
        if (legacyTheme) {
          window.localStorage.setItem(THEME_KEY, legacyTheme);
          console.log("[migrate] theme legacy -> scoped", { to: THEME_KEY });
        }
      }

      // lastText
      const scopedLast = window.localStorage.getItem(LASTTEXT_KEY);
      if (!scopedLast) {
        const legacyLast = window.localStorage.getItem(LASTTEXT_KEY_LEGACY);
        if (legacyLast) {
          window.localStorage.setItem(LASTTEXT_KEY, legacyLast);
          console.log("[migrate] lastText legacy -> scoped", { to: LASTTEXT_KEY });
        }
      }
    } catch (e) {
      console.warn("[migrate] failed:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WORDS_KEY, UILANG_KEY, THEME_KEY, LASTTEXT_KEY, authUserId]);

  // ✅ 本輪新增：對「目前 bucket」做一次 userId 清洗（scoped 已存在時也會修）
  useEffect(() => {
    try {
      const desiredUserId = authUserId || "";

      const rawText = window.localStorage.getItem(WORDS_KEY);
      if (!rawText) return;

      const parsed = safeJsonParse(rawText, null);
      let list = [];
      if (Array.isArray(parsed)) list = parsed;
      else if (parsed && typeof parsed === "object") list = Object.values(parsed);
      else return;

      // 只要有任何一筆 userId 不符合，就整批修正
      const needFix = list.some((x) => {
        if (!x || typeof x !== "object") return false;
        const uid = x.userId || x.user_id || "";
        return uid !== desiredUserId;
      });

      if (!needFix) return;

      const fixed = list.map((x) => {
        if (!x || typeof x !== "object") return x;
        return { ...x, userId: desiredUserId };
      });

      window.localStorage.setItem(WORDS_KEY, safeJsonStringify(fixed, rawText));

      // 同步目前畫面上的 libraryItems（避免你要重整才更新）
      setLibraryItems((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        return prev.map((x) => ({ ...x, userId: desiredUserId }));
      });

      // 如果 testCard 有舊 userId，也同步一下（不改 headword/pos）
      setTestCard((prev) => {
        if (!prev) return prev;
        return { ...prev, userId: desiredUserId };
      });

      console.log("[WordLibrary] sanitized userId in bucket", {
        bucket: userBucket,
        desiredUserId: desiredUserId ? "(logged-in)" : "(guest)",
      });
    } catch (e) {
      console.warn("[WordLibrary] sanitize failed:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WORDS_KEY, authUserId, userBucket]);

  // ✅ 當 userBucket 改變時，載入該 bucket 的 uiLang/theme/lastText/history
  useEffect(() => {
    try {
      const storedLang = window.localStorage.getItem(UILANG_KEY);
      if (storedLang) setUiLang(storedLang);

      const storedTheme = window.localStorage.getItem(THEME_KEY);
      if (storedTheme === "light" || storedTheme === "dark")
        setTheme(storedTheme);

      const storedText = window.localStorage.getItem(LASTTEXT_KEY);
      if (storedText) setText(storedText);

      const h = safeJsonParse(window.localStorage.getItem(HISTORY_KEY), null);
      if (h && Array.isArray(h.items)) {
        setHistory(h.items);
        setHistoryIndex(
          typeof h.index === "number" ? h.index : h.items.length - 1
        );
      } else {
        setHistory([]);
        setHistoryIndex(-1);
      }
    } catch (e) {
      console.warn("[bucket load] failed:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userBucket]);

  // theme 寫回 scoped key + 套用 dark class
  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {}
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme, THEME_KEY]);

  // uiLang 寫回 scoped key
  useEffect(() => {
    try {
      window.localStorage.setItem(UILANG_KEY, uiLang);
    } catch {}
  }, [uiLang, UILANG_KEY]);

  // history 寫回 scoped key
  useEffect(() => {
    try {
      window.localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify({ items: history, index: historyIndex })
      );
    } catch {}
  }, [history, historyIndex, HISTORY_KEY]);

  // 接 wordSearch 事件（延伸詞點擊 → 重新查詢）
  useEffect(() => {
    const handler = (e) => {
      const w = (e?.detail?.text || "").trim();
      if (!w) return;

      setText(w);
      try {
        window.localStorage.setItem(LASTTEXT_KEY, w);
      } catch {}

      runAnalyze(w);
    };

    window.addEventListener("wordSearch", handler);
    return () => window.removeEventListener("wordSearch", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiLang, LASTTEXT_KEY]);

  // 輸入框變動
  const handleTextChange = (value) => {
    setText(value);
    try {
      window.localStorage.setItem(LASTTEXT_KEY, value);
    } catch {}
  };

  // 呼叫後端 /api/analyze
  const runAnalyze = async (inputText) => {
    const trimmed = (inputText || "").trim();
    if (!trimmed) return;

    setLoading(true);

    try {
      const resp = await apiFetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          explainLang: uiLang,
        }),
      });

      const data = await resp.json();

      // ✅ 句子/標點符號錯誤：顯示 alert，且本次查詢不列入紀錄、不覆寫畫面
      // 後端目前會在 HTTP 400 回傳：{ error: "<message>" }
      const isNonSentenceOnlyError =
        !resp.ok &&
        typeof data?.error === "string" &&
        data.error.includes("目前只支援") &&
        data.error.includes("非句子");

      if (isNonSentenceOnlyError) {
        alert(t("app.errors.nonSentenceOnly"));
        return;
      }

      // ✅✅✅ 本輪唯一核心修改：歷史去重 key 一律使用「使用者輸入」
      // 這樣 Kind / Kinder 不會互相覆寫搜尋框
      const nextKey = trimmed.toLowerCase();

      const getEntryKey = (entry) => {
        return ((entry?.text || "") + "").trim().toLowerCase();
      };

      const foundIndex = history.findIndex((entry) => {
        return getEntryKey(entry) === nextKey;
      });

      if (foundIndex >= 0) {
        setHistory((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) return prev;
          if (foundIndex < 0 || foundIndex >= prev.length) return prev;
          const next = prev.slice();
          next[foundIndex] = { ...next[foundIndex], result: data };
          return next;
        });
        setHistoryIndex(foundIndex);
        setResult(data);

        // ✅ 不再 setText(entryText)（避免覆寫使用者輸入）
        setShowRaw(false);
        return;
      }

      setResult(data);
      setShowRaw(false);

      setHistory((prev) => {
        let base = prev;
        if (historyIndex >= 0 && historyIndex < prev.length - 1) {
          base = prev.slice(0, historyIndex + 1);
        }
        const next = [...base, { text: trimmed, result: data }];
        if (next.length > 10) next.shift();
        return next;
      });

      setHistoryIndex((prev) => {
        const afterUpdateLength =
          historyIndex >= 0 && historyIndex < history.length - 1
            ? historyIndex + 2
            : history.length + 1;
        return Math.min(afterUpdateLength - 1, 9);
      });
    } catch (err) {
      console.error("Error calling /api/analyze:", err);
      alert(t("app.errors.backendUnavailable"));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = () => runAnalyze(text);

  const handleWordClick = (word) => {
    setText(word);
    runAnalyze(word);
  };

  const handleToggleRaw = () => setShowRaw((prev) => !prev);

  const handlePrevResult = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const entry = history[newIndex];
    if (!entry) return;
    setHistoryIndex(newIndex);
    setResult(entry.result);
    setText(entry.text);
    setShowRaw(false);
  };

  const handleNextResult = () => {
    if (historyIndex < 0 || historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const entry = history[newIndex];
    if (!entry) return;
    setHistoryIndex(newIndex);
    setResult(entry.result);
    setText(entry.text);
    setShowRaw(false);
  };

  const canGoPrev = historyIndex > 0;
  const canGoNext = historyIndex >= 0 && historyIndex < history.length - 1;

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
          x.partOfSpeech ||
          ""
        ).trim();
        const createdAt = x.createdAt || x.created_at || x.created || null;
        const userId = x.userId || x.user_id || "";
        if (!headword) return null;
        return { headword, canonicalPos, createdAt, userId };
      })
      .filter(Boolean);

    cleaned.sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });

    return cleaned;
  };

  // ✅✅✅ 本輪唯一修改：scoped 無資料時 fallback legacy，並把 legacy 補回 scoped
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

  // ✅ 讀取單字庫（scoped，若沒有就 fallback legacy），再 normalize 成陣列
  const loadLibrary = () => {
    const raw = readWordLibraryRaw();
    const list = normalizeWordLibrary(raw);
    setLibraryItems(list);
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

  // ✅ isFavorited：WordCard 顯示用（以 lemma/headword 來對照）
  const isFavorited = (entry) => {
    const headword = (entry?.headword || "").trim();
    const canonicalPos = (entry?.canonicalPos || "").trim();
    if (!headword) return false;

    return libraryItems.some((x) => {
      return (
        (x?.headword || "").trim() === headword &&
        (x?.canonicalPos || "").trim() === canonicalPos
      );
    });
  };

  // ✅ toggleFavorite：統一收藏/取消（只存原型）
  const toggleFavorite = (entry) => {
    if (!authUserId) return;

    const headword = (entry?.headword || "").trim();
    const canonicalPos = (entry?.canonicalPos || "").trim();
    if (!headword) return;

    setLibraryItems((prev) => {
      const existsIndex = prev.findIndex(
        (x) =>
          (x?.headword || "").trim() === headword &&
          (x?.canonicalPos || "").trim() === canonicalPos
      );

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
      userBucket={userBucket}
    >
      {view === "library" ? (
        <WordLibraryPanel
          uiText={currentUiText}
          uiLang={uiLang}
          items={libraryItems}
          onRemove={(item) => toggleFavorite(item)}
          canFavorite={!!authUserId}
        />
      ) : view === "test" ? (
        <TestModePanel
          uiText={currentUiText}
          uiLang={uiLang}
          canFavorite={!!authUserId}
          isFavorite={isFavorited}
          onToggleFavorite={toggleFavorite}
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
            onWordClick={handleWordClick}
            canPrev={canGoPrev}
            canNext={canGoNext}
            onPrev={handlePrevResult}
            onNext={handleNextResult}
            historyIndex={historyIndex}
            historyLength={history.length}
            isFavorite={isFavorited}
            canFavorite={!!authUserId}
            onToggleFavorite={toggleFavorite}
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
