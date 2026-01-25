// frontend/src/features/library/hooks/useLibrarySets.js
/**
 * useLibrarySets.js
 * - 取得 sets（含插入 favorites 那段）
 * - selectedSetCode persistence（localStorage）
 * 回傳：librarySets, selectedSetCode, setSelectedSetCode
 */

import React from "react";
import { apiFetch } from "../../../utils/apiClient";

function resolveLibrarySetTitle(setCode, backendTitle, t, effectiveLang) {
  // 1) uiText 優先
  if (t) {
    if (setCode === "favorites") {
      if (t.setFavoritesLabel) return t.setFavoritesLabel;
      if (t.favoritesLabel) return t.favoritesLabel; // legacy key
    }

    if (setCode === "a1_vocab" && t.setTitleA1Vocab) return t.setTitleA1Vocab;
    if (setCode === "a1_grammar" && t.setTitleA1Grammar) return t.setTitleA1Grammar;
    if (setCode === "common_phrases" && t.setTitleCommonPhrases) return t.setTitleCommonPhrases;
  }

  // 2) 後端 title 保底
  if (backendTitle) return backendTitle;

  // 3) 最後保底
  return String(effectiveLang || "").startsWith("zh") ? "我的收藏" : "Favorites";
}

export function useLibrarySets({ t, effectiveLang }) {
  const WL_SELECTED_SET_KEY = "langapp::library::selectedSetCode";

  const [librarySets, setLibrarySets] = React.useState(() => []);
  const [selectedSetCode, setSelectedSetCode] = React.useState(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const v = window.localStorage.getItem(WL_SELECTED_SET_KEY);
        return v || "favorites";
      }
    } catch (e) {}
    return "favorites";
  });

  React.useEffect(() => {
    let cancelled = false;

    async function fetchSets() {
      try {
        const res = await apiFetch("/api/library/sets", { method: "GET" });
        const json = await res.json();
        const sets = json && json.ok && Array.isArray(json.sets) ? json.sets : [];

        // ✅ favorites 永遠由前端插入（避免依賴後端）
        const favorites = {
          set_code: "favorites",
          title: resolveLibrarySetTitle("favorites", null, t, effectiveLang),
          type: "user",
          order_index: 0,
        };

        // ✅ 關鍵：先排除後端回傳的 favorites，避免重複 key
        const filtered = (sets || []).filter((s) => (s && s.set_code) !== "favorites");

        // ✅ system sets：套用顯示 title
        const normalizedSets = filtered.map((s) => {
          const setCode = s && s.set_code;
          const backendTitle = s && s.title;
          return {
            ...s,
            title: resolveLibrarySetTitle(setCode, backendTitle, t, effectiveLang),
          };
        });

        // ✅ 再做一次保險：依 set_code 去重（避免後端資料髒）
        const seen = new Set();
        const deduped = [];
        [favorites, ...normalizedSets].forEach((s) => {
          const code = s && s.set_code ? String(s.set_code) : "";
          if (!code) return;
          if (seen.has(code)) return;
          seen.add(code);
          deduped.push(s);
        });

        if (!cancelled) setLibrarySets(deduped);
      } catch (e) {
        // 後端掛了也能用 favorites
        const favorites = {
          set_code: "favorites",
          title: resolveLibrarySetTitle("favorites", null, t, effectiveLang),
          type: "user",
          order_index: 0,
        };
        if (!cancelled) setLibrarySets([favorites]);
      }
    }

    fetchSets();

    return () => {
      cancelled = true;
    };
  }, [t, effectiveLang]);

  React.useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(WL_SELECTED_SET_KEY, selectedSetCode || "favorites");
      }
    } catch (e) {}
  }, [selectedSetCode]);

  return { librarySets, selectedSetCode, setSelectedSetCode };
}
