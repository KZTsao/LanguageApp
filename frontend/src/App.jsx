// frontend/src/App.jsx
// App 只管狀態與邏輯，畫面交給 LayoutShell / SearchBox / ResultPanel

import { useState, useEffect } from "react";
import { uiText } from "./uiText";
import WordCard from "./components/WordCard";
import GrammarCard from "./components/GrammarCard";
import LayoutShell from "./components/LayoutShell";
import SearchBox from "./components/SearchBox";
import ResultPanel from "./components/ResultPanel";

function App() {
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
  console.log("🔥 API_BASE in production is:", API_BASE);
  // 深淺色主題
  const [theme, setTheme] = useState(() => {
    const stored = window.localStorage.getItem("appTheme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    window.localStorage.setItem("appTheme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // 查詢歷史：存最近 10 筆
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // 每次 UI 語言改變，寫入 localStorage
  useEffect(() => {
    window.localStorage.setItem("uiLang", uiLang);
  }, [uiLang]);

  // 初始化：從 localStorage 撈 uiLang 和 lastText
  useEffect(() => {
    const storedLang = window.localStorage.getItem("uiLang");
    if (storedLang) setUiLang(storedLang);

    const storedText = window.localStorage.getItem("lastText");
    if (storedText) setText(storedText);
  }, []);

  // 輸入框變動
  const handleTextChange = (value) => {
    setText(value);
    window.localStorage.setItem("lastText", value);
  };

  // 呼叫後端 /api/analyze
  const runAnalyze = async (inputText) => {
    const trimmed = (inputText || "").trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    try {
      const resp = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          explainLang: uiLang,
        }),
      });

      const data = await resp.json();
      setResult(data);
      setShowRaw(false);

      // 更新查詢歷史
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
      alert("後端服務目前無法使用，請稍後再試或檢查伺服器狀態。");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = () => {
    runAnalyze(text);
  };

  const handleWordClick = (word) => {
    setText(word);
    runAnalyze(word);
  };

  const handleToggleRaw = () => {
    setShowRaw((prev) => !prev);
  };

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

  // 🚑 uiText 的安全 fallback，避免 undefined
  const currentUiText =
    uiText[uiLang] || uiText["zh-TW"] || Object.values(uiText)[0] || {};

  return (
    <LayoutShell
      theme={theme}
      onToggleTheme={() =>
        setTheme((prev) => (prev === "dark" ? "light" : "dark"))
      }
    >
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
        onToggleRaw={handleToggleRaw}
        uiText={currentUiText}
        WordCard={WordCard}
        GrammarCard={GrammarCard}
        onWordClick={handleWordClick}
        canPrev={canGoPrev}
        canNext={canGoNext}
        onPrev={handlePrevResult}
        onNext={handleNextResult}
        historyIndex={historyIndex}
        historyLength={history.length}
      />
    </LayoutShell>
  );
}

export default App;
