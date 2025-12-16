import React from "react";

function SearchBox({
  text,
  onTextChange,
  onAnalyze,
  loading,
  uiLang,
  onUiLangChange,
  uiText,
}) {
  // 安全展開 uiText，避免 undefined
  const safeText = uiText || {};

  const placeholder =
    safeText.placeholder ||
    "Gib ein Wort oder einen Satz ein / 請輸入單字 oder 句子";

  // 統一處理「查詢」按鈕多國語系
  const getDefaultAnalyzeLabel = (lang) => {
    switch (lang) {
      case "zh-TW":
        return "查詢";
      case "de":
        return "Nachschlagen";
      case "en":
        return "Search";
      case "ja":
        return "検索";
      case "es":
        return "Buscar";
      default:
        return "Search";
    }
  };

  const analyzeLabel =
    // 先吃你在 uiText 給的字串
    safeText.analyzeButtonLabel ||
    safeText.searchButtonLabel ||
    safeText.buttonLabel ||
    // 再用 uiLang 當 fallback
    getDefaultAnalyzeLabel(uiLang);

  const inputLabel = safeText.inputLabel || "";
  // 目前下方不要再顯示 UI Language，只保留這個值，不用
  const langLabel = safeText.langLabel || "UI Language";

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onAnalyze();
    }
  };

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 12,
        borderRadius: 16,
        border: "1px solid var(--border-subtle)",
        background: "var(--card-bg)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {inputLabel && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {inputLabel}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 999,
            border: "1px solid var(--border-subtle)",
            background: "var(--input-bg)",
            color: "var(--text-main)",
            outline: "none",
          }}
        />
        <button
          onClick={onAnalyze}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            cursor: loading ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Loading..." : analyzeLabel}
        </button>
      </div>

      {/* 原本這裡有 UI 語言切換，下方查詢匡不再顯示 UI Language */}
    </div>
  );
}

export default SearchBox;
