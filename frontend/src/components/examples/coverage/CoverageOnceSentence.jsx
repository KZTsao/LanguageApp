// frontend/src/components/examples/coverage/CoverageOnceSentence.jsx
import React from "react";

function getTokenColor(state, themeText = "var(--text)") {
  // 深色/淺色/紅色（不指定色彩系統時，盡量用接近現有主題）
  // - hit_high: 深色（用主題文字色）
  // - hit_low: 淺色（降低 opacity）
  // - miss: 紅色
  if (state === "miss") return "#dc2626";
  if (state === "hit_low") return "rgba(100,116,139,1)"; // slate-ish
  return themeText;
}

export default function CoverageOnceSentence({ tokens }) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;

  return (
    <div style={{ lineHeight: 1.8, marginTop: 6 }}>
      {tokens.map((t) => {
        const color = getTokenColor(t.state);
        const opacity = t.state === "hit_low" ? 0.7 : 1;
        return (
          <span key={t.idx} style={{ color, opacity, marginRight: 6 }}>
            {t.raw}
          </span>
        );
      })}
    </div>
  );
}

