// START PATH: frontend/src/features/editorial/EditorialAdminModal.jsx
import React, { useEffect } from "react";

// NOTE: Reuse existing admin UI to avoid touching the in-progress support system.
import SupportAdminPage from "../../components/support/SupportAdminPage";

export default function EditorialAdminModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="編輯後台"
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />

      <div className="relative w-[min(1000px,92vw)] h-[min(80vh,760px)] bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">📝 編輯後台</div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onClose?.()}
            aria-label="關閉"
            title="關閉"
          >
            ✕
          </button>
        </div>

        <div className="h-[calc(100%-48px)] overflow-auto">
          <SupportAdminPage />
        </div>
      </div>
    </div>
  );
}
// END PATH: frontend/src/features/editorial/EditorialAdminModal.jsx
