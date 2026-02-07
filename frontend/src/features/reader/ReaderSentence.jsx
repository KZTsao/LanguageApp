// frontend/src/features/reader/ReaderSentence.jsx
import React, { useMemo } from "react";

/**
 * ReaderSentence
 * - 顯示句子（可點擊播放）
 * - 先只做句子層 click；單字 click/查詢/加入學習下一步接
 */
export default function ReaderSentence({
  sentence,
  index,
  active,
  onClick,
} = {}) {
  const text = sentence && sentence.text ? String(sentence.text) : "";

  const style = useMemo(() => {
    const base = {
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.04)",
      cursor: "pointer",
      userSelect: "none",
      lineHeight: 1.55,
      fontSize: 14,
      opacity: 0.92,
      transition: "transform 120ms ease, opacity 120ms ease",
    };
    if (!active) return base;
    return {
      ...base,
      border: "1px solid rgba(245,158,11,0.65)",
      background: "rgba(245,158,11,0.10)",
      opacity: 1,
      transform: "translateY(-1px)",
    };
  }, [active]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`sentence-${index}`}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof onClick === "function") onClick(sentence, index);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          if (typeof onClick === "function") onClick(sentence, index);
        }
      }}
      title={text}
    >
      {text}
    </div>
  );
}
