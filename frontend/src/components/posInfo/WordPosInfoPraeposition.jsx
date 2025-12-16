// frontend/src/components/WordPosInfoPraeposition.jsx
//
// 介系詞（Präposition）骨架
// - 支配格（Akk / Dat / Wechsel）
// -----------------------------------------------------

import React from "react";

export default function WordPosInfoPraeposition({ baseForm, labels = {} }) {
  if (!baseForm) return null;

  const {
    title = "介系詞用法",
    kase = "Akkusativ / Dativ / Wechsel",
    example = "",
  } = labels;

  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
        {title}
      </div>

      <div style={{ display: "grid", rowGap: 4, fontSize: 14 }}>
        <div>支配格：{kase}</div>
        {example && <div>例句：{example}</div>}
      </div>
    </div>
  );
}
