import React from "react";

export default function NounHeaderRow({
  isOpen,
  headerText,
  onToggle,
  arrowSize = 30,
  headerFontSize = 12,
  paddingY = 7,
  paddingX = 10,
  showBottomDivider = true,
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onToggle?.();
          e.preventDefault();
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: `${paddingY}px ${paddingX}px`,
        borderBottom: showBottomDivider ? "1px solid var(--border-subtle)" : "none",
        background: "transparent",
        borderRadius: 0,
        cursor: "pointer",
        userSelect: "none",
        outline: "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 18,
          textAlign: "center",
          fontSize: arrowSize,
          lineHeight: 1,
          color: "var(--text-main)",
          opacity: 0.85,
        }}
      >
        {isOpen ? "▾" : "▸"}
      </span>

      <div
        style={{
          fontSize: headerFontSize,
          fontWeight: 700,
          color: "var(--text-main)",
        }}
      >
        {headerText}
      </div>
    </div>
  );
}
