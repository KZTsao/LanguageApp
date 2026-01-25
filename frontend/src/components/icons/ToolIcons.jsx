// frontend/src/components/icons/ToolIcons.jsx
/**
 * ToolIcons.jsx
 * - 目的：提供一組「乾淨、工具型」SVG icons（全部吃 currentColor）
 * - 原則：跟 ExamIcon 一樣：不寫死語言，title/aria 外層給；stroke/fill 走 currentColor
 */

import React from "react";

function SvgBase({ size = 18, title = "", ariaLabel = "", children, className = "", style }) {
  const computedAria = ariaLabel || title || undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label={computedAria}
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

// ✅ 類似 sliders/settings：用來代表「管理/設定」
export function SlidersIcon({ size = 18, title = "", ariaLabel = "", color = "currentColor" }) {
  return (
    <SvgBase size={size} title={title} ariaLabel={ariaLabel}>
      <path
        d="M5 6h14M5 18h14M5 12h14"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="9" cy="6" r="2" fill={color} opacity="0.18" />
      <circle cx="15" cy="12" r="2" fill={color} opacity="0.18" />
      <circle cx="11" cy="18" r="2" fill={color} opacity="0.18" />
      <path
        d="M9 4v4M15 10v4M11 16v4"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </SvgBase>
  );
}

export function PlusIcon({ size = 18, title = "", ariaLabel = "", color = "currentColor" }) {
  return (
    <SvgBase size={size} title={title} ariaLabel={ariaLabel}>
      <path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </SvgBase>
  );
}

export function XIcon({ size = 18, title = "", ariaLabel = "", color = "currentColor" }) {
  return (
    <SvgBase size={size} title={title} ariaLabel={ariaLabel}>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </SvgBase>
  );
}

export function ChevronUpIcon({ size = 18, title = "", ariaLabel = "", color = "currentColor" }) {
  return (
    <SvgBase size={size} title={title} ariaLabel={ariaLabel}>
      <path
        d="M6 14l6-6 6 6"
        stroke={color}
        strokeWidth="2.0"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgBase>
  );
}

export function ChevronDownIcon({ size = 18, title = "", ariaLabel = "", color = "currentColor" }) {
  return (
    <SvgBase size={size} title={title} ariaLabel={ariaLabel}>
      <path
        d="M6 10l6 6 6-6"
        stroke={color}
        strokeWidth="2.0"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgBase>
  );
}

export function PencilIcon({ size = 18, title = "", ariaLabel = "", color = "currentColor" }) {
  return (
    <SvgBase size={size} title={title} ariaLabel={ariaLabel}>
      <path
        d="M14.5 5.5l4 4"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6 18l3.5-.8 8.3-8.3a1.4 1.4 0 0 0 0-2l-1.7-1.7a1.4 1.4 0 0 0-2 0L5.8 13.5 5 17.9z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5.8 13.5l4.7 4.7"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </SvgBase>
  );
}
