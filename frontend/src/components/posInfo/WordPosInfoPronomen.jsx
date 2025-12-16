// frontend/src/components/WordPosInfoPronomen.jsx
//
// 代名詞（Pronomen）骨架
// - Nominativ / Akkusativ / Dativ
// -----------------------------------------------------

import React from "react";

export default function WordPosInfoPronomen({ baseForm, labels = {} }) {
  if (!baseForm) return null;

  const {
    title = "代名詞變化",
    nom = baseForm,
    akk = baseForm,
    dat = baseForm,
  } = labels;

  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
        {title}
      </div>

      <div style={{ display: "grid", rowGap: 4, fontSize: 14 }}>
        <div>主格（Nominativ）：{nom}</div>
        <div>賓格（Akkusativ）：{akk}</div>
        <div>與格（Dativ）：{dat}</div>
      </div>
    </div>
  );
}
