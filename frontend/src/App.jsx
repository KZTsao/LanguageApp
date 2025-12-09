// frontend/src/App.jsx
// 拆成：App 只管狀態與邏輯，畫面交給 LayoutShell / SearchBox / ResultPanel

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
    import.meta.env.MODE === "development"
      ? "http://localhost:4000"
      : "https://languageapp-8j45.onrender.com";
  const [showRaw, setShowRaw] = useState(false);

  //
  // ★ 深淺色主題（存在 localStorage）
  //
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

  //
  // ★ 查詢歷史：存最近 10 筆（之後可以用在「上一筆 / 下一筆」）
  //
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  //
  // ★ 每次 UI 語言改變，把文字貼到 localStorage
  //
  useEffect(() => {
    window.localStorage.setItem("uiLang", uiLang);
  }, [uiLang]);

  //
  // ★ 進來時從 localStorage 撈 uiLang、最後一次輸入
  //
  useEffect(() => {
    const storedLang = window.localStorage.getItem("uiLang");
    if (storedLang) setUiLang(storedLang);

    const storedText = window.localStorage.getItem("lastText");
    if (storedText) setText(storedText);
  }, []);

  //
  // ★ 輸入框變動時，順便寫到 localStorage
  //
  const handleTextChange = (value) => {
    setText(value);
    window.localStorage.setItem("lastText", value);
  };

  //
  // ★ 核心：呼叫後端 analyze API
  //   （給目前輸入框 or 點擊單字都用這個）
  //
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
        // 如果之前有往回翻頁，先砍掉「當前指標之後」的紀錄，再接新的一筆
        let base = prev;
        if (historyIndex >= 0 && historyIndex < prev.length - 1) {
          base = prev.slice(0, historyIndex + 1);
        }
        const next = [...base, { text: trimmed, result: data }];
        // 最多保留 10 筆
        if (next.length > 10) next.shift();
        return next;
      });
      setHistoryIndex((prev) => {
        // 新的一筆永遠指向陣列最後一項
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

  //
  // ★ 按 Enter 或按「Analyze」時觸發
  //
  const handleAnalyze = () => {
    runAnalyze(text);
  };

  //
  // ★ 點某個字卡時，丟該單字給 runAnalyze
  //
  const handleWordClick = (word) => {
    setText(word);
    runAnalyze(word);
  };

  //
  // ★ 切換顯示 JSON 原始資料
  //
  const handleToggleRaw = () => {
    setShowRaw((prev) => !prev);
  };

  //
  // ★ 歷史：上一筆、下一筆
  //
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
        uiText={uiText[uiLang]}
      />

      <ResultPanel
        result={result}
        loading={loading}
        showRaw={showRaw}
        onToggleRaw={handleToggleRaw}
        uiText={uiText[uiLang]}
        WordCard={WordCard}
        GrammarCard={GrammarCard}
        onWordClick={handleWordClick}
        // ★ 新增：歷史導航相關 props
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
