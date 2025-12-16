import React from "react";

/**
 * FavoriteStar (backward compatible)
 *
 * Supports TWO prop styles:
 * A) New style (used by current WordCard.jsx):
 *    - active: boolean
 *    - disabled: boolean
 *    - onClick: () => void
 *
 * B) Old style (some older code paths):
 *    - data: any
 *    - isFavorited: boolean
 *    - canFavorite: boolean
 *    - toggleFavorite: (data) => void
 */
export default function FavoriteStar(props) {
  // --- normalize props ---
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

  const handleClick = (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();

    if (disabled) return;

    if (typeof props.onClick === "function") {
      props.onClick();
      return;
    }

    if (typeof props.toggleFavorite === "function") {
      props.toggleFavorite(props.data);
    }
  };

  const color = disabled
    ? "var(--text-muted)"
    : active
    ? "var(--accent)"
    : "var(--text-muted)";

  return (
    <button
      type="button"
      aria-label={active ? "Unfavorite" : "Favorite"}
      onClick={handleClick}
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
      title={disabled ? "" : active ? "Unfavorite" : "Favorite"}
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
