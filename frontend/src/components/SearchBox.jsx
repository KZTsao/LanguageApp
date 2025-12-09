// frontend/src/components/SearchBox.jsx

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
    "Gib ein Wort oder einen Satz ein / 請輸入單字或句子";

  const analyzeLabel = safeText.analyzeButtonLabel || "Analyze";
  const inputLabel = safeText.inputLabel || "";
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

      {/* 簡單的 UI 語言切換（保留介面，之後你要再做漂亮都可以） */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "flex-end",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        <span>{langLabel}:</span>
        <select
          value={uiLang}
          onChange={(e) => onUiLangChange(e.target.value)}
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            border: "1px solid var(--border-subtle)",
            background: "var(--input-bg)",
            color: "var(--text-main)",
          }}
        >
          <option value="zh-TW">中文</option>
          <option value="de-DE">Deutsch</option>
          <option value="en-US">English</option>
        </select>
      </div>
    </div>
  );
}

export default SearchBox;
