// frontend/src/components/WordPosInfoAdjektiv.jsx
//
// 形容詞（Adjektiv）變化骨架
// - 原級/比較級/最高級
// - 三大詞尾變化各舉一例（弱/混合/強）
// -----------------------------------------------------

import React from "react";

export default function WordPosInfoAdjektiv({ baseForm, labels = {} }) {
  if (!baseForm) return null;

  const {
    title = "形容詞變化",
    positive = baseForm,
    comparative = baseForm + "er",
    superlative = "am " + baseForm + "sten",
    declWeak = `der ${baseForm}e Mann`,
    declMixed = `ein ${baseForm}er Mann`,
    declStrong = `${baseForm}er Mann`,
  } = labels;

  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
        {title}
      </div>

      <div style={{ display: "grid", rowGap: 4, fontSize: 14 }}>
        <div>原級：{positive}</div>
        <div>比較級：{comparative}</div>
        <div>最高級：{superlative}</div>

        <div style={{ marginTop: 6 }}>弱變化（definite）：{declWeak}</div>
        <div>混合變化（indefinite）：{declMixed}</div>
        <div>強變化（no article）：{declStrong}</div>
      </div>
    </div>
  );
}
