// frontend/src/components/GrammarOptions.jsx

import React from "react";

export default function GrammarOptions({
  show,
  onToggle,
  caseOpt,
  articleType,
  onChangeCase,
  onChangeArticle,
  labels,
  disabled = false, // ⭐ 新增：專有名詞 / 品牌時會傳 true 進來
}) {
  const {
    grammarOptions,
    grammarToggle,
    caseLabel,
    caseNom,
    caseAkk,
    caseDat,
    caseGen,
    articleLabel,
    artDef,
    artIndef,
    artNone,

    // ★ Kasus 多國語系標題（供 GrammarCard 使用）
    caseTableTitle,
  } = labels;

  // ⭐ 如果被標記為 disabled → 這整塊文法選單都不顯示
  if (disabled) {
    return null;
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* 收合 / 展開按鈕 */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          fontSize: 13,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span>{grammarToggle}</span>
        <span style={{ fontSize: 10 }}>{show ? "▴" : "▾"}</span>
      </button>

      {/* 文法選項內容（展開時顯示） */}
      {show && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            background: "var(--chip-bg)",
            borderRadius: 10,
          }}
        >
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            {grammarOptions}
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              fontSize: 13,
            }}
          >
            {/* case */}
            <label>
              {caseLabel}：
              <select
                value={caseOpt}
                onChange={(e) => onChangeCase(e.target.value)}
                style={{ marginLeft: 6 }}
              >
                <option value="nom">{caseNom}</option>
                <option value="akk">{caseAkk}</option>
                <option value="dat">{caseDat}</option>
                <option value="gen">{caseGen}</option>
              </select>
            </label>

            {/* 冠詞 */}
            <label>
              {articleLabel}：
              <select
                value={articleType}
                onChange={(e) => onChangeArticle(e.target.value)}
                style={{ marginLeft: 6 }}
              >
                <option value="def">{artDef}</option>
                <option value="indef">{artIndef}</option>
                <option value="none">{artNone}</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
