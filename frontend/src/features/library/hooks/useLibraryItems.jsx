// frontend/src/features/library/hooks/useLibraryItems.js
/**
 * useLibraryItems.js
 * - 依 selectedSetCode 載 items
 * - system set 走 API、favorites 走 props（原本分流）
 * 回傳：items, loading, error, reload
 */

import React from "react";
import { apiFetch } from "../../../utils/apiClient";

export function useLibraryItems({ selectedSetCode, favoritesItems }) {
  const [items, setItems] = React.useState(() => []);
  const [loading, setLoading] = React.useState(() => false);
  const [error, setError] = React.useState(() => null);

  const fetchSetItems = React.useCallback(async (setCode) => {
    const code = setCode || "favorites";

    // ✅ favorites 不走 items API（維持原本：直接用 props）
    if (code === "favorites") {
      setItems(Array.isArray(favoritesItems) ? favoritesItems : []);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const safeCode = encodeURIComponent(code);
      const url = `/api/library/sets/${safeCode}/items`;

      // ✅ UI 驗證點：Network 會看到這支 GET
      const res = await apiFetch(url, { method: "GET" });
      const json = await res.json();

      const arr = json && json.ok && Array.isArray(json.items) ? json.items : [];
      setItems(arr);
      setLoading(false);
      setError(null);
    } catch (err) {
      setItems([]);
      setLoading(false);
      setError(err || new Error("fetchSetItems failed"));
    }
  }, [favoritesItems]);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await fetchSetItems(selectedSetCode || "favorites");
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSetCode, fetchSetItems]);

  const reload = React.useCallback(() => {
    fetchSetItems(selectedSetCode || "favorites");
  }, [fetchSetItems, selectedSetCode]);

  return { items, loading, error, reload };
}
