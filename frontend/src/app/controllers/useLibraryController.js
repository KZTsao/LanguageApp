// frontend/src/app/controllers/useLibraryController.js
/**
 * useLibraryController
 * - 從 App.jsx 拆出 Library / Favorites / Categories / Modal 行為
 * - 目標：功能不變，只搬家
 *
 * 注意：
 * - 不搬 JSX（WordLibraryPanel 的 modal render 仍在 App.jsx）
 * - App.jsx 仍保留 legacy localStorage（toggleFavorite / loadLibrary 等），本 controller 只負責 API 路徑 + wrapper + modal 行為
 */

import { useEffect, useCallback, useRef } from "react";

export function useLibraryController({
  // flags/env
  USE_API_LIBRARY,
  uiLang,
  t, // 目前不一定用到，先保留
  keys, // { FAVORITES_CATEGORY_KEY }
  // auth
  authUserId,
  // state read
  libraryItems,
  favoriteCategories,
  favoriteCategoriesLoading,
  selectedFavoriteCategoryId,
  showLibraryModal,
  // setters
  setLibraryItems,
  setLibraryCursor,
  setFavoriteCategories,
  setFavoriteCategoriesLoading,
  setFavoriteCategoriesLoadError,
  setSelectedFavoriteCategoryId,
  setShowLibraryModal,
  // helpers
  apiFetch,
  normalizeSearchQuery,
  handleAnalyzeByText,
  // debug
  isLibraryDebugEnabled,
}) {
  const FAVORITES_CATEGORY_KEY =
    keys && keys.FAVORITES_CATEGORY_KEY ? keys.FAVORITES_CATEGORY_KEY : "";

  // -----------------------------
  // utils (搬自 App.jsx)
  // -----------------------------
  const normalizeFavoriteText = useCallback((v) => {
    return (v || "").toString().trim();
  }, []);

  const normalizeFavoriteTextLower = useCallback(
    (v) => normalizeFavoriteText(v).toLocaleLowerCase("de-DE"),
    [normalizeFavoriteText]
  );

  const getFavoriteKey = useCallback(
    (entry) => {
      const headword = (entry?.headword || "").trim();
      const canonicalPos = (entry?.canonicalPos || "").trim();
      const headwordKey = normalizeFavoriteTextLower(headword);
      const canonicalPosKey = normalizeFavoriteTextLower(canonicalPos);
      return { headword, canonicalPos, headwordKey, canonicalPosKey };
    },
    [normalizeFavoriteTextLower]
  );

  const pickFirstNonEmptyString = useCallback((candidates) => {
    if (!Array.isArray(candidates)) return "";
    for (const v of candidates) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  }, []);

  const getGlossSnapshotFromEntry = useCallback(
    (entry) => {
      const senseIndex = Number.isInteger(entry?.senseIndex) ? entry.senseIndex : 0;

      const senses = Array.isArray(entry?.senses)
        ? entry.senses
        : Array.isArray(entry?.headwordSenses)
        ? entry.headwordSenses
        : null;

      const senseGloss =
        senses && senses[senseIndex] && typeof senses[senseIndex]?.gloss === "string"
          ? senses[senseIndex].gloss
          : "";

      const sense0Gloss =
        senses && senses[0] && typeof senses[0]?.gloss === "string" ? senses[0].gloss : "";

      return pickFirstNonEmptyString([
        entry?.headwordGloss,
        entry?.headword_gloss,
        entry?.gloss,
        entry?.meaning,
        entry?.definition,
        senseGloss,
        sense0Gloss,
      ]);
    },
    [pickFirstNonEmptyString]
  );

  const buildFavoritePayloadsFromEntry = useCallback(
    (entry, { headword, canonicalPos }) => {
      const senses = Array.isArray(entry?.senses)
        ? entry.senses
        : Array.isArray(entry?.headwordSenses)
        ? entry.headwordSenses
        : null;

      const defaultLang =
        typeof entry?.headwordGlossLang === "string" && entry.headwordGlossLang.trim()
          ? entry.headwordGlossLang.trim()
          : uiLang;

      if (senses && senses.length > 0) {
        return senses.map((s, idx) => {
          const senseGloss =
            s && typeof s?.gloss === "string" && s.gloss.trim() ? s.gloss : "";

          const headwordGloss = pickFirstNonEmptyString([
            senseGloss,
            entry?.headwordGloss,
            entry?.headword_gloss,
            entry?.gloss,
            entry?.meaning,
            entry?.definition,
          ]);

          return {
            headword,
            canonicalPos,
            senseIndex: idx,
            headwordGloss,
            headwordGlossLang: defaultLang,
          };
        });
      }

      const senseIndex = Number.isInteger(entry?.senseIndex) ? entry.senseIndex : 0;
      const headwordGloss =
        typeof entry?.headwordGloss === "string" && entry.headwordGloss.trim()
          ? entry.headwordGloss
          : getGlossSnapshotFromEntry(entry);

      return [
        {
          headword,
          canonicalPos,
          senseIndex,
          headwordGloss,
          headwordGlossLang: defaultLang,
        },
      ];
    },
    [uiLang, pickFirstNonEmptyString, getGlossSnapshotFromEntry]
  );

  // -----------------------------
  // API: categories / library list
  // -----------------------------
  const loadFavoriteCategoriesFromApi = useCallback(async () => {
    if (!authUserId)
      return { ok: false, categories: null, error: new Error("not logged in") };

    setFavoriteCategoriesLoading(true);
    setFavoriteCategoriesLoadError(null);

    try {
      const res = await apiFetch(`/api/library/favorites/categories`);
      if (!res) throw new Error("[favorites] categories response is null");

      if (res.status === 401 || res.status === 403) {
        const err = new Error(`[favorites] categories unauthorized: ${res.status}`);
        setFavoriteCategoriesLoadError(err);
        setFavoriteCategories([]);
        return { ok: false, categories: null, error: err, unauthorized: true };
      }

      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[favorites] GET /api/library/favorites/categories failed: ${res.status} ${res.statusText}${
            detail ? " | " + detail : ""
          }`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      const categories = Array.isArray(data?.categories) ? data.categories : [];
      setFavoriteCategories(categories);
      return { ok: true, categories };
    } catch (e) {
      setFavoriteCategoriesLoadError(e);
      setFavoriteCategories([]);
      return { ok: false, categories: null, error: e };
    } finally {
      setFavoriteCategoriesLoading(false);
    }
  }, [
    authUserId,
    apiFetch,
    setFavoriteCategoriesLoading,
    setFavoriteCategoriesLoadError,
    setFavoriteCategories,
  ]);

  const loadLibraryFromApi = useCallback(
    async ({ limit = 50, cursor = null, categoryId = null } = {}) => {
      if (!authUserId) return;

      try {
        const qs = new URLSearchParams();
        qs.set("limit", String(limit));
        if (cursor) qs.set("cursor", cursor);
        if (categoryId) qs.set("category_id", String(categoryId));

        const res = await apiFetch(`/api/library?${qs.toString()}`);
        if (!res) throw new Error("[library] response is null");
        if (!res.ok) {
          let detail = "";
          try {
            detail = await res.text();
          } catch {}
          throw new Error(
            `[library] GET /api/library failed: ${res.status} ${res.statusText}${
              detail ? ` | ${detail}` : ""
            }`
          );
        }

        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        const items = Array.isArray(data?.items) ? data.items : [];
        const nextCursor = data?.nextCursor ?? null;

        setLibraryItems(items);
        setLibraryCursor(nextCursor);

        return { items, nextCursor };
      } catch (e) {
        return { items: null, nextCursor: null, error: e };
      }
    },
    [authUserId, apiFetch, setLibraryItems, setLibraryCursor]
  );

  // -----------------------------
  // API: upsert / add / remove / update sense status
  // -----------------------------
  const postLibraryUpsertViaApi = useCallback(
    async (payload) => {
      if (!authUserId) return;

      const safePayload = payload || {};
      const actionHeadword = (safePayload?.headword || "").toString().trim();
      const actionCanonicalPos = (safePayload?.canonicalPos || "").toString().trim();
      const actionSenseIndex = Number.isInteger(safePayload?.senseIndex)
        ? safePayload.senseIndex
        : null;

      const res = await apiFetch(`/api/library`, {
        method: "POST",
        body: JSON.stringify(safePayload),
      });

      if (!res) throw new Error("[library] response is null");

      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[library] POST /api/library failed: ${res.status} ${res.statusText}${
            detail ? " | " + detail : ""
          }`
        );
      }

      let respJson = null;
      try {
        respJson = await res.clone().json();
      } catch {
        respJson = null;
      }

      if (typeof isLibraryDebugEnabled === "function" && isLibraryDebugEnabled()) {
        try {
          console.debug("[library][postLibraryUpsertViaApi][verify]", {
            payload: {
              headword: actionHeadword,
              canonicalPos: actionCanonicalPos,
              senseIndex: actionSenseIndex,
              familiarity: Number.isInteger(safePayload?.familiarity)
                ? safePayload.familiarity
                : null,
              isHidden: typeof safePayload?.isHidden === "boolean" ? safePayload.isHidden : null,
            },
            responseJson: respJson,
          });
        } catch {}
      }

      if (respJson?.error) {
        try {
          console.warn("[library][postLibraryUpsertViaApi][warn] res.ok but response.error exists", {
            error: respJson.error,
          });
        } catch {}
      }
    },
    [authUserId, apiFetch, isLibraryDebugEnabled]
  );

  const addFavoriteViaApi = useCallback(
    async ({
      headword,
      canonicalPos,
      senseIndex,
      headwordGloss,
      headwordGlossLang,
      familiarity,
      isHidden,
      categoryId,
      category_id,
    }) => {
      if (!authUserId) return;

      const safeGloss = typeof headwordGloss === "string" ? headwordGloss : "";
      const safeGlossLang =
        typeof headwordGlossLang === "string" && headwordGlossLang.trim()
          ? headwordGlossLang.trim()
          : uiLang;

      const rawCat = category_id ?? categoryId;
      const catNum = Number.parseInt(String(rawCat ?? ""), 10);
      const safeCategoryId = Number.isFinite(catNum) && catNum > 0 ? catNum : null;

      const payload = {
        headword,
        canonicalPos,
        ...(Number.isInteger(senseIndex) ? { senseIndex } : {}),
        headwordGloss: safeGloss,
        headwordGlossLang: safeGlossLang,
        ...(Number.isInteger(familiarity) ? { familiarity } : {}),
        ...(typeof isHidden === "boolean" ? { isHidden } : {}),
        ...(safeCategoryId != null ? { category_id: safeCategoryId } : {}),
      };

      const res = await apiFetch(`/api/library`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res) throw new Error("[library] response is null");
      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[library] POST /api/library failed: ${res.status} ${res.statusText}${
            detail ? " | " + detail : ""
          }`
        );
      }
    },
    [authUserId, apiFetch, uiLang]
  );

  const removeFavoriteViaApi = useCallback(
    async ({ headword, canonicalPos }) => {
      if (!authUserId) return;

      const res = await apiFetch(`/api/library`, {
        method: "DELETE",
        body: JSON.stringify({ headword, canonicalPos }),
      });

      if (!res) throw new Error("[library] response is null");
      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[library] DELETE /api/library failed: ${res.status} ${res.statusText}${
            detail ? ` | ${detail}` : ""
          }`
        );
      }
    },
    [authUserId, apiFetch]
  );

  const updateSenseStatusViaApi = useCallback(
    async ({ headword, canonicalPos, senseIndex, familiarity, isHidden }) => {
      if (!authUserId) return;
      if (!headword) return;

      const payload = {
        headword,
        canonicalPos,
        ...(Number.isInteger(senseIndex) ? { senseIndex } : {}),
        ...(Number.isInteger(familiarity) ? { familiarity } : {}),
        ...(typeof isHidden === "boolean" ? { isHidden } : {}),
      };

      await postLibraryUpsertViaApi(payload);

      const after = await loadLibraryFromApi({ limit: 50 });

      // 寫入驗證（保守 warn）
      try {
        const afterItems = after?.items || null;
        const match = Array.isArray(afterItems)
          ? afterItems.find((x) => {
              return (
                x &&
                x.headword === headword &&
                x.canonicalPos === canonicalPos &&
                Number(x.senseIndex) === Number(senseIndex)
              );
            })
          : null;

        const wantedF = Number.isInteger(familiarity) ? familiarity : null;
        const wantedH = typeof isHidden === "boolean" ? isHidden : null;

        const gotF =
          match && Object.prototype.hasOwnProperty.call(match, "familiarity")
            ? match.familiarity ?? null
            : null;
        const gotH =
          match && Object.prototype.hasOwnProperty.call(match, "isHidden")
            ? match.isHidden ?? null
            : null;

        const mismatch = !match || gotF !== wantedF || gotH !== wantedH;
        if (mismatch) {
          console.warn("[library][verify] write seems NOT reflected in list result", {
            headword,
            canonicalPos,
            senseIndex,
            wanted: { familiarity: wantedF, isHidden: wantedH },
            got: match ? { familiarity: gotF, isHidden: gotH } : null,
          });
        }
      } catch (e) {
        console.warn("[library][verify] verification error", e);
      }
    },
    [authUserId, postLibraryUpsertViaApi, loadLibraryFromApi]
  );

  const handleUpdateSenseStatus = useCallback(
    (payload) => {
      if (!authUserId) return;
      if (USE_API_LIBRARY) {
        updateSenseStatusViaApi(payload);
        return;
      }
      try {
        console.log("[library][handleUpdateSenseStatus][legacy][noop]", payload);
      } catch {}
    },
    [authUserId, USE_API_LIBRARY, updateSenseStatusViaApi]
  );

  // -----------------------------
  // API: toggle favorite (multi-sense + category)
  // -----------------------------
  const toggleFavoriteViaApi = useCallback(
    async (entry, options = null) => {
      if (!authUserId) return;
      const { headword, canonicalPos } = getFavoriteKey(entry);
      if (!headword) return;

      const exists = Array.isArray(libraryItems)
        ? libraryItems.some((x) => {
            return (
              (x?.headword || "").trim() === headword &&
              ((x?.canonical_pos ?? x?.canonicalPos) || "").trim() === canonicalPos
            );
          })
        : false;

      const pickDefaultCategoryIdForAdd = () => {
        try {
          const optRaw =
            options && typeof options === "object"
              ? options.category_id ?? options.categoryId
              : null;
          if (optRaw !== null && typeof optRaw !== "undefined") return optRaw;

          if (selectedFavoriteCategoryId) return selectedFavoriteCategoryId;

          if (Array.isArray(favoriteCategories) && favoriteCategories.length > 0) {
            const prefer = favoriteCategories.find((c) => (c?.name || "") === "我的最愛1");
            if (prefer && (prefer?.id ?? null) !== null) return prefer.id;
          }
        } catch {}
        return null;
      };

      const rawCat = pickDefaultCategoryIdForAdd();
      const catNum = Number.parseInt(String(rawCat ?? ""), 10);
      const safeCategoryId = Number.isFinite(catNum) && catNum > 0 ? catNum : null;

      try {
        if (exists) {
          await removeFavoriteViaApi({ headword, canonicalPos });
        } else {
          const payloads = buildFavoritePayloadsFromEntry(entry, { headword, canonicalPos });

          if (Array.isArray(payloads) && payloads.length > 0) {
            for (const p of payloads) {
              await addFavoriteViaApi({
                ...p,
                ...(safeCategoryId != null ? { category_id: safeCategoryId } : {}),
              });
            }
          } else {
            await addFavoriteViaApi({
              headword,
              canonicalPos,
              senseIndex: 0,
              headwordGloss: "",
              headwordGlossLang: uiLang,
              ...(safeCategoryId != null ? { category_id: safeCategoryId } : {}),
            });
          }
        }

        await loadLibraryFromApi({ limit: 50 });
      } catch (e) {
        // no-op：維持原本 App.jsx 的保守行為（避免 throw 影響 UI）
      }
    },
    [
      authUserId,
      uiLang,
      libraryItems,
      selectedFavoriteCategoryId,
      favoriteCategories,
      getFavoriteKey,
      buildFavoritePayloadsFromEntry,
      addFavoriteViaApi,
      removeFavoriteViaApi,
      loadLibraryFromApi,
    ]
  );

  const handleToggleFavorite = useCallback(
    (entry, options = null) => {
      if (!authUserId) return;
      if (USE_API_LIBRARY) {
        toggleFavoriteViaApi(entry, options);
        return;
      }
      // legacy toggleFavorite 留在 App.jsx，不在這裡做（避免雙寫）
    },
    [authUserId, USE_API_LIBRARY, toggleFavoriteViaApi]
  );

  // -----------------------------
  // category select (2 variants)
  // -----------------------------
  const handleSelectFavoriteCategory = useCallback(
    async (categoryId) => {
      if (!USE_API_LIBRARY) return;
      if (!authUserId) return;

      const nextId = categoryId ? String(categoryId) : null;

      try {
        if (nextId) window.localStorage.setItem(FAVORITES_CATEGORY_KEY, nextId);
        else window.localStorage.removeItem(FAVORITES_CATEGORY_KEY);
      } catch {}

      setSelectedFavoriteCategoryId(nextId);

      try {
        setLibraryCursor(null);
      } catch {}

      if (nextId) {
        await loadLibraryFromApi({ limit: 50, cursor: null, categoryId: nextId });
      } else {
        await loadLibraryFromApi({ limit: 50, cursor: null });
      }
    },
    [
      USE_API_LIBRARY,
      authUserId,
      FAVORITES_CATEGORY_KEY,
      setSelectedFavoriteCategoryId,
      setLibraryCursor,
      loadLibraryFromApi,
    ]
  );

  const handleSelectFavoriteCategoryForAdd = useCallback(
    (categoryId) => {
      if (!USE_API_LIBRARY) return;
      if (!authUserId) return;

      const nextId = categoryId ? String(categoryId) : null;

      try {
        if (nextId) window.localStorage.setItem(FAVORITES_CATEGORY_KEY, nextId);
        else window.localStorage.removeItem(FAVORITES_CATEGORY_KEY);
      } catch {}

      setSelectedFavoriteCategoryId(nextId);
    },
    [USE_API_LIBRARY, authUserId, FAVORITES_CATEGORY_KEY, setSelectedFavoriteCategoryId]
  );

  // -----------------------------
  // effects (搬自 App.jsx)
  // -----------------------------
  // (1) 登入後先載入分類，讓 ResultPanel 下拉有 options
  useEffect(() => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;

    if (favoriteCategoriesLoading) return;
    if (Array.isArray(favoriteCategories) && favoriteCategories.length > 0) return;

    loadFavoriteCategoriesFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [USE_API_LIBRARY, authUserId]);

  // (2) 打開彈窗時：載入分類 + 決定預設分類 + 載入 library list
  useEffect(() => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;
    if (!showLibraryModal) return;

    let cancelled = false;

    (async () => {
      const catRes = await loadFavoriteCategoriesFromApi();
      if (cancelled) return;

      const cats = Array.isArray(catRes?.categories) ? catRes.categories : [];

      let nextSelectedId = selectedFavoriteCategoryId;

      if (!nextSelectedId) {
        const prefer = cats.find((c) => (c?.name || "") === "我的最愛1");
        if (prefer && (prefer?.id ?? null) !== null) nextSelectedId = String(prefer.id);
        else if (cats[0] && (cats[0]?.id ?? null) !== null) nextSelectedId = String(cats[0].id);
        else nextSelectedId = null;
      } else {
        const hit = cats.some((c) => String(c?.id ?? "") === String(nextSelectedId));
        if (!hit) {
          if (cats[0] && (cats[0]?.id ?? null) !== null) nextSelectedId = String(cats[0].id);
          else nextSelectedId = null;
        }
      }

      try {
        if (nextSelectedId) {
          setSelectedFavoriteCategoryId(String(nextSelectedId));
          window.localStorage.setItem(FAVORITES_CATEGORY_KEY, String(nextSelectedId));
        } else {
          setSelectedFavoriteCategoryId(null);
          window.localStorage.removeItem(FAVORITES_CATEGORY_KEY);
        }
      } catch {}

      try {
        setLibraryCursor(null);
      } catch {}

      if (nextSelectedId) {
        await loadLibraryFromApi({ limit: 50, cursor: null, categoryId: nextSelectedId });
      } else {
        await loadLibraryFromApi({ limit: 50, cursor: null });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [USE_API_LIBRARY, authUserId, showLibraryModal]);

  // -----------------------------
  // UI helpers
  // -----------------------------
  const isFavorited = useCallback(
    (entry) => {
      const headword = (entry?.headword || "").trim();
      const canonicalPos = (entry?.canonicalPos || "").trim();
      if (!headword) return false;

      const headwordKey = normalizeFavoriteTextLower(headword);
      const canonicalPosKey = normalizeFavoriteTextLower(canonicalPos);

      return Array.isArray(libraryItems)
        ? libraryItems.some((x) => {
            const xHeadwordRaw = (x?.headword || "").trim();
            const xPosRaw = ((x?.canonical_pos ?? x?.canonicalPos) || "").trim();

            return (
              normalizeFavoriteTextLower(xHeadwordRaw) === headwordKey &&
              normalizeFavoriteTextLower(xPosRaw
