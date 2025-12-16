// frontend/src/components/WordPosInfoArtikel.jsx
//
// 冠詞（Artikel）骨架
// - 定冠詞 / 不定冠詞 四格
// -----------------------------------------------------

import React from "react";

export default function WordPosInfoArtikel({ labels = {} }) {
  const {
    title = "冠詞變化",
    nom = "der / ein",
    akk = "den / einen",
    dat = "dem / einem",
    gen = "des / eines",
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
        <div>屬格（Genitiv）：{gen}</div>
      </div>
    </div>
  );
}
