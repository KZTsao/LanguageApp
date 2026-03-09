// frontend/src/components/library/CreateFirstLearningSetModal.jsx
import React, { useEffect, useMemo } from "react";

/**
 * CreateFirstLearningSetModal
 * - UI only (no business logic)
 * - Caller controls:
 *   - open
 *   - value / onChange
 *   - onConfirm / onClose
 */
export default function CreateFirstLearningSetModal({
  open,
  titleText,
  descText,
  placeholder,
  confirmText,
  value,
  onChange,
  busy,
  onConfirm,
  onClose,
}) {
  const isOpen = !!open;

  const ui = useMemo(() => {
    const title = String(titleText || "").trim() || "新增您的學習本";
    const desc = String(descText || "").trim() || "您的學習本名稱叫做 ex: 我的最愛";
    const ph = String(placeholder || "").trim() || "我的最愛";
    const ok = String(confirmText || "").trim() || "確認";
    return { title, desc, ph, ok };
  }, [titleText, descText, placeholder, confirmText]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      try {
        if (e.key === "Escape") {
          e.preventDefault();
          if (typeof onClose === "function") onClose();
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ui.title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        // click on backdrop => close
        if (e.target === e.currentTarget && typeof onClose === "function") onClose();
      }}
    >
      <div
        style={{
          width: "min(520px, 96vw)",
          borderRadius: 16,
          background: "var(--panel, #ffffff)",
          color: "var(--text, #111827)",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.25)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>{ui.title}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted, #6b7280)" }}>{ui.desc}</div>
          </div>
          <button
            type="button"
            onClick={() => (typeof onClose === "function" ? onClose() : null)}
            aria-label="close"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: "32px",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <input
            value={value || ""}
            onChange={(e) => (typeof onChange === "function" ? onChange(e.target.value) : null)}
            placeholder={ui.ph}
            autoFocus
            style={{
              width: "100%",
              height: 42,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              padding: "0 12px",
              fontSize: 14,
              outline: "none",
              background: "transparent",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && typeof onConfirm === "function") onConfirm();
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => (typeof onConfirm === "function" ? onConfirm() : null)}
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "var(--accent, var(--accent-orange, #f59e0b))",
              color: "#111",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 900,
              fontSize: 13,
              opacity: busy ? 0.75 : 1,
            }}
          >
            {busy ? "..." : ui.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
