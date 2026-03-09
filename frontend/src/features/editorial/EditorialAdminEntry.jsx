// START PATH: frontend/src/features/editorial/EditorialAdminEntry.jsx
import React from "react";

export default function EditorialAdminEntry({ onOpen }) {
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={onOpen}
      title="編輯後台"
      aria-label="編輯後台"
    >
      📝 編輯後台
    </button>
  );
}
// END PATH: frontend/src/features/editorial/EditorialAdminEntry.jsx
