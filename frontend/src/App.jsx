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
  const [showRaw, setShowRaw] = useState(false);

  // 深淺色主題
  const [theme, setTheme] = useState(() => {
    const stored = window.localStorage.getItem("appTheme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return "light";
  });

  // 查詢歷史：[{ text, result }]
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // 指向 history 中目前顯示的那一筆

  useEffect(() => {
    window.localStorage.setItem("appTheme", theme);
  }, [theme]);

  const t = uiText[uiLang];

  // 共用的查詢函式：給目前輸入框 or 點擊單字都用這個
  const runAnalyze = async (inputText) => {
    const trimmed = (inputText || "").trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    try {
      const resp = await fetch("http://localhost:4000/api/analyze", {
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
        const updated = [...base, { text: trimmed, result: data }];

        // 同步更新指標到最後一筆
        setHistoryIndex(updated.length - 1);

        return updated;
      });
    } catch (err) {
      console.error(err);
      setResult({ error: "Failed to fetch" });
    } finally {
      setLoading(false);
    }
  };

  // 按下查詢按鈕（使用目前 input 的 text）
  const handleAnalyze = () => {
    if (!loading) {
      runAnalyze(text);
    }
  };

  // Enter 查詢
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) {
        runAnalyze(text);
      }
    }
  };

  // 點單字再查：直接用點到的字重新查，不依賴當下 text state
  const handleWordClick = (w) => {
    setText(w);
    if (!loading) {
      runAnalyze(w);
    }
  };

  // 德語發音
  const speak = (txt) => {
    if (!txt) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(txt);
    utter.lang = "de-DE";
    utter.rate = 1.0;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  };

  // 上一個 / 下一個 查詢結果
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
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      uiLang={uiLang}
      onChangeUiLang={setUiLang}
      t={t}
    >
      <SearchBox
        text={text}
        onChangeText={setText}
        onKeyDown={handleKeyDown}
        onSubmit={handleAnalyze}
        loading={loading}
        t={t}
      />

      <ResultPanel
        result={result}
        showRaw={showRaw}
        onToggleShowRaw={() => setShowRaw((prev) => !prev)}
        t={t}
        onWordClick={handleWordClick}
        onSpeak={speak}
        WordCard={WordCard}
        GrammarCard={GrammarCard}
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
