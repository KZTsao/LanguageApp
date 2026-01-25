// frontend/src/components/legal/TermsModal.jsx

import { useEffect, useState } from "react";
import TermsRenderer from "./TermsRenderer";

function TermsModal({
  open,
  onClose,
  uiLang,
  currentTosVersion,
  profileTosVersion,
  onAccept,
  acceptedAtText,
}) {
  if (!open) return null;

  const needAccept = profileTosVersion !== currentTosVersion;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "85vh",
          background: "var(--card-bg)",
          borderRadius: 12,
          border: "1px solid var(--border-subtle)",
          padding: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <strong>Terms of Service</strong>
          <button onClick={onClose}>✕</button>
        </div>

        <TermsRenderer uiLang={uiLang} />

        <div style={{ marginTop: 12 }}>
          {needAccept ? (
            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                onChange={(e) => {
                  if (e.target.checked) onAccept();
                }}
              />{" "}
              我已閱讀並同意上述條款
            </label>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {acceptedAtText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TermsModal;

// /frontend/src/components/legal/TermsModal.jsx
