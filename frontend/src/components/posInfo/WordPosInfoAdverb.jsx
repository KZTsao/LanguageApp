// frontend/src/components/WordPosInfoAdverb.jsx
//
// 副詞（Adverb）骨架
// - 有比較級的副詞（gern/viel/oft…）
// -----------------------------------------------------

import React from "react";

export default function WordPosInfoAdverb({ baseForm, labels = {} }) {
  if (!baseForm) return null;

  const {
    title = "副詞變化",
    positive = baseForm,
    comparative = baseForm + "er",
    superlative = "am " + baseForm + "sten",
  } = labels;

  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
        {title}
      </div>

      <div style={{ display: "grid", rowGap: 4, fontSize: 14 }}>
        <div>基本型：{positive}</div>
        <div>比較級：{comparative}</div>
        <div>最高級：{superlative}</div>
      </div>
    </div>
  );
}
