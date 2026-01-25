// frontend/src/features/library/components/LibrarySetSelect.jsx
/**
 * LibrarySetSelect.jsx
 * - 下拉選單 UI（含 single select 的呈現）
 * - onChange 只回傳 value
 */

import React from "react";

export default function LibrarySetSelect({ value, sets, onChange, t }) {
  const v = value || "favorites";
  const list = Array.isArray(sets) ? sets : [];

  return (
    <select
      value={v}
      aria-label={t && t.setSelectAria ? t.setSelectAria : undefined}
      title={t && t.setSelectTitle ? t.setSelectTitle : undefined}
      onChange={(e) => {
        const next = e && e.target && e.target.value ? e.target.value : "favorites";
        if (typeof onChange === "function") onChange(next);
      }}
      style={{
        fontSize: 12,
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.04)",
        color: "inherit",
        outline: "none",
      }}
    >
      {list
        .slice()
        .sort((a, b) => {
          const a1 = typeof a?.order_index === "number" ? a.order_index : 999999;
          const b1 = typeof b?.order_index === "number" ? b.order_index : 999999;
          return a1 - b1;
        })
        .map((s) => {
          const code = s && s.set_code ? s.set_code : "";
          const label = s && s.title ? s.title : "";
          return (
            <option key={code || label} value={code}>
              {label}
            </option>
          );
        })}
    </select>
  );
}
