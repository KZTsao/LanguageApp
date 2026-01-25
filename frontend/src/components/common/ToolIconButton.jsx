// frontend/src/components/common/ToolIconButton.jsx
/**
 * ToolIconButton.jsx
 * - 目的：統一「工具型 icon button」外觀與互動（亮暗版吃 currentColor）
 * - 原則：
 *   - 不寫死文字（aria-label/title 由外層決定）
 *   - 不做發光暈色（hover 只做淡淡背景）
 *   - disabled 明確（opacity + cursor），但不改 icon 的顏色規則（由外層決定 color）
 *
 * 參考：
 * - ExamIcon 的設計哲學：color= currentColor、title/aria 由外層給
 * - FavoriteStar 的互動哲學：乾淨、無語言責任、無誇張特效
 */

import React from "react";

export default function ToolIconButton({
  onClick,
  disabled = false,

  // a11y
  ariaLabel,
  title,

  // sizing
  size = 30, // button square
  iconSize = 16, // child svg size (建議 icon 本身吃 style/class)
  icon,

  // style knobs
  variant = "soft", // "soft" | "ghost"
  style,
  className,

  // pass-through
  type = "button",
}) {
  const canClick = typeof onClick === "function" && !disabled;

  const baseBg =
    variant === "ghost" ? "transparent" : "rgba(255,255,255,0.04)";
  const hoverBg =
    variant === "ghost" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)";

  return (
    <button
      type={type}
      onClick={(e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        if (!canClick) return;
        onClick(e);
      }}
      disabled={!!disabled}
      aria-label={ariaLabel}
      title={title}
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",

        borderRadius: 10,
        border: variant === "ghost" ? "none" : "1px solid rgba(255,255,255,0.10)",
        background: baseBg,

        color: "inherit",
        lineHeight: 1,

        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 0.92,
        userSelect: "none",

        // ✅ 不要暈光，只做非常淡的背景變化
        transition: "background 120ms ease, opacity 120ms ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        try {
          e.currentTarget.style.background = hoverBg;
          e.currentTarget.style.opacity = "1";
        } catch {}
      }}
      onMouseLeave={(e) => {
        try {
          e.currentTarget.style.background = baseBg;
          e.currentTarget.style.opacity = disabled ? "0.45" : "0.92";
        } catch {}
      }}
    >
      {/* ✅ icon 一律吃 currentColor；icon 元件內部用 stroke/fill={color} */}
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          width: iconSize,
          height: iconSize,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </span>
    </button>
  );
}
