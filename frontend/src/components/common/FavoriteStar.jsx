// frontend/src/components/common/FavoriteStar.jsx
/**
 * FavoriteStar（純 UI / 行為元件，無語言責任）
 *
 * 功能說明：
 * - 顯示「收藏 / 取消收藏」星號
 * - 僅處理點擊與狀態，不處理任何語言文字
 * - 所有 aria-label / title 必須由外層傳入（多國）
 *
 * ─────────────────────────────
 * 支援的 prop 型式（向後相容）
 *
 * A) 新版（建議）
 * - active: boolean
 * - disabled: boolean
 * - onClick: (event?) => void
 * - ariaLabel?: string   // ✅ 外層多國傳入
 * - title?: string       // ✅ 外層多國傳入
 *
 * B) 舊版（保留）
 * - data: any
 * - isFavorited: boolean
 * - canFavorite: boolean
 * - toggleFavorite: (data) => void
 *
 * ─────────────────────────────
 *
 * 異動紀錄：
 * - 2025/12/25
 *   L｜移除所有內建語言字串
 *   - 不再出現 "Favorite" / "Unfavorite"
 *   - aria-label / title 若未傳入，保持為 undefined（不 fallback）
 *   - 多國責任完全交由外層
 */

// frontend/src/components/common/FavoriteStar.jsx

import React from "react";

export default function FavoriteStar(props) {
  // =========================
  // normalize props（既有行為保留）
  // =========================
  const active =
    typeof props.active === "boolean"
      ? props.active
      : typeof props.isFavorited === "boolean"
      ? props.isFavorited
      : false;

  const disabled =
    typeof props.disabled === "boolean"
      ? props.disabled
      : typeof props.canFavorite === "boolean"
      ? !props.canFavorite
      : false;

  // =========================
  // 點擊處理（既有邏輯，不變）
  // =========================
  const handleClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (disabled) return;

    if (typeof props.onClick === "function") {
      props.onClick(e);
      return;
    }

    if (typeof props.toggleFavorite === "function") {
      props.toggleFavorite(props.data);
    }
  };

  // =========================
  // 視覺狀態（既有）
  // =========================
  const color = disabled
    ? "var(--text-muted)"
    : active
    ? "var(--accent)"
    : "var(--text-muted)";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={props.ariaLabel} // ✅ 完全由外層決定
      title={props.title}         // ✅ 完全由外層決定
      style={{
        background: "none",
        border: "none",
        padding: 0,
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        pointerEvents: disabled ? "none" : "auto",
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontSize: 16,
          color,
          transition: "color 0.15s",
        }}
      >
        {active ? "★" : "☆"}
      </span>
    </button>
  );
}
// frontend/src/components/common/FavoriteStar.jsx
