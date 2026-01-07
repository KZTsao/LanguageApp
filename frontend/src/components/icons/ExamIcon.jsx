// frontend/src/components/icons/ExamIcon.jsx
/**
 * 文件說明（ExamIcon）
 * - 目的：提供「鉛筆考試」SVG 圖示（鉛筆 + 考卷）
 * - 使用方式：<ExamIcon title="..." ariaLabel="..." size={18} />
 *
 * 異動紀錄（請保留舊紀錄）
 * - 2026/01/04：新增鉛筆考試 SVG 元件
 *
 * 功能初始化狀態（Production 排查）
 * - 無狀態元件（pure icon），不依賴外部環境
 */

// frontend/src/components/icons/ExamIcon.jsx

import React from "react";

/**
 * 中文功能說明：
 * - 這是一個可重用 SVG Icon 元件
 * - 不寫死任何語言文字，title/aria-label 必須由呼叫方依 uiText 傳入
 */
export default function ExamIcon({
  size = 18,
  color = "currentColor",
  title = "",
  ariaLabel = "",
  className = "",
  style = undefined,
}) {
  // ✅ 不寫死任何語言：title/ariaLabel 由外部傳入
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
      {/* 若有 title 才渲染，避免固定語言 */}
      {title ? <title>{title}</title> : null}

      {/* 考卷（圓角紙張） */}
      <rect
        x="4"
        y="3"
        width="12.5"
        height="16.5"
        rx="2.2"
        stroke={color}
        strokeWidth="1.6"
      />

      {/* 考卷上的線條 */}
      <path
        d="M7 7.2h6.5M7 10.2h6.5M7 13.2h4.2"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* 鉛筆（斜放在右下角） */}
      <path
        d="M14.6 14.8l5.7-5.7c.5-.5 1.3-.5 1.8 0l.8.8c.5.5.5 1.3 0 1.8l-5.7 5.7-3 .8.4-3.4z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* 鉛筆尖 */}
      <path
        d="M14.9 18.4l2.6-.7-1.9-1.9-.7 2.6z"
        fill={color}
        opacity="0.15"
      />

      {/* 鉛筆內部線（筆芯） */}
      <path
        d="M19.3 8.9l2 2"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// frontend/src/components/icons/ExamIcon.jsx
