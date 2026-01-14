// frontend/src/hooks/useLibraryController.js
import { useEffect } from "react";

/**
 * useLibraryController
 * - 將「收藏/單字庫/分類/彈窗/DB API/legacy localStorage」從 App.jsx 抽出
 * - App.jsx 只保留接線 + state
 */
export function useLibraryController({
  // flags / env
  USE_API_LIBRARY,

  // auth / lang
  authUserId,
  uiLang,

  // api
  apiFetch,

  // debug
  isLibraryDebugEnabled,

  // keys
  WORDS_KEY,
  WORDS_KEY_LEGACY,
  UILANG_KEY,
  UILANG_KEY_LEGACY,
  THEME_KEY,
  THEME_KEY_LEGACY,
  LASTTEXT_KEY,
  LASTTEXT_KEY_LEGACY,
  FAVORITES_CATEGORY_KEY,

  // state
  showLibraryModal,
  libraryItems,
  favoriteCategories,
  favoriteCategoriesLoading,
  selectedFavoriteCategoryId,

  // setters
  setLibraryItems,
  setLibraryCursor,
  setFavoriteCategories,
  setFavoriteCategoriesLoading,
  setFavoriteCategoriesLoadError,
  setSelectedFavoriteCategoryId,
  setShowLibraryModal,

  // helpers
  normalizeSearchQuery,
  handleAnalyzeByText,
}) {
  // ============================
  // Legacy migration：WORDS / UILANG / THEME / LASTTEXT
  // ============================
  useEffect(() => {
    try {
      const scopedText = window.localStorage.getItem(WORDS_KEY);
      const legacyText = window.localStorage.getItem(WORDS_KEY_LEGACY);
      if (!scopedText && legacyText) {
        window.localStorage.setItem(WORDS_KEY, legacyText);
      }
    } catch {}

    try {
      const legacyLang = window.localStorage.getItem(UILANG_KEY_LEGACY);
      const scopedLang = window.localStorage.getItem(UILANG_KEY);
      if (!scopedLang && legacyLang) window.localStorage.setItem(UILANG_KEY, legacyLang);
    } catch {}

    try {
      const legacyTheme = window.localStorage.getItem(THEME_KEY_LEGACY);
      const scopedTheme = window.localStorage.getItem(THEME_KEY);
      if (!scopedTheme && legacyTheme) window.localStorage.setItem(THEME_KEY, legacyTheme);
    } catch {}

    try {
      const legacyLast = window.localStorage.getItem(LASTTEXT_KEY_LEGACY);
      const scopedLast = window.localStorage.getItem(LASTTEXT_KEY);
      if (!scopedLast && legacyLast) window.localStorage.setItem(LASTTEXT_KEY, legacyLast);
    } catch {}

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WORDS_KEY, UILANG_KEY, THEME_KEY, LASTTEXT_KEY]);

  // ============================
  // 任務2：userId 變更時，同步讀取 localStorage（每個 userId 各自記住）
  // ============================
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_CATEGORY_KEY);
      const v = raw === null || typeof raw === "undefined" ? "" : String(raw).trim();
      setSelectedFavoriteCategoryId(v ? v : null);
    } catch (e) {
      setSelectedFavoriteCategoryId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [FAVORITES_CATEGORY_KEY]);

  // ============================
  // legacy localStorage：單字庫讀寫（僅 USE_API_LIBRARY=false 時用）
  // ============================
  const readWordLibraryRaw = () => {
    try {
      const scopedText = window.localStorage.getItem(WORDS_KEY);
      if (scopedText) return JSON.parse(scopedText);

      const legacyText = window.localStorage.getItem(WORDS_KEY_LEGACY);
      if (legacyText) {
        const parsed = JSON.parse(legacyText);
        try {
          window.localStorage.setItem(WORDS_KEY, legacyText);
        } catch {}
        return parsed;
      }

      return null;
    } catch {
      return null;
    }
  };

  const normalizeWordLibrary = (raw) => {
    if (!raw) return [];
    let list = [];
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === "object") list = Object.values(raw);
    else return [];

    const cleaned = list
      .map((x) => {
        if (!x || typeof x !== "object") return null;
        const headword = (x.headword || x.word || x.text || "").trim();
        const canonicalPos = (x.canonicalPos || x.pos || x.canonical_pos || x.canonicalPOS || "").trim();
        if (!headword) return null;

        return {
          headword,
          canonicalPos,
          createdAt: x.createdAt || x.created_at || x.time || "",
          userId: x.userId || x.user_id || "",
        };
      })
      .filter(Boolean);

    const seen = new Set();
    const uniq = [];
    for (const it of cleaned) {
      const key = `${it.headword}::${it.canonicalPos}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(it);
    }
    return uniq;
  };

  const writeWordLibraryRaw = (raw) => {
    try {
      window.localStorage.setItem(WORDS_KEY, JSON.stringify(raw));
    } catch {}
  };

  const loadLibraryLegacy = () => {
    if (USE_API_LIBRARY) return;
    const raw = readWordLibraryRaw();
    const list = normalizeWordLibrary(raw);
    const sanitized = list.map((x) => ({ ...x, userId: authUserId }));
    setLibraryItems(sanitized);
  };

  useEffect(() => {
    loadLibraryLegacy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WORDS_KEY]);

  // ============================
  // normalize helpers（收藏比對）
  // ============================
  const normalizeFavoriteText = (v) => {
    return (v || "").toString().trim();
  };

  const normalizeFavoriteTextLower = (v) => {
    return normalizeFavoriteText(v).toLocaleLowerCase("de-DE");
  };

  const getFavoriteKey = (entry) => {
    const headword = (entry?.headword || "").trim();
    const canonicalPos = (entry?.canonicalPos || "").trim();
    const headwordKey = normalizeFavoriteTextLower(headword);
    const canonicalPosKey = normalizeFavoriteTextLower(canonicalPos);
    return { headword, canonicalPos, headwordKey, canonicalPosKey };
  };

  const pickFirstNonEmptyString = (candidates) => {
    if (!Array.isArray(candidates)) return "";
    for (const v of candidates) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };

  const getGlossSnapshotFromEntry = (entry) => {
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

    const sense0Gloss = senses && senses[0] && typeof senses[0]?.gloss === "string" ? senses[0].gloss : "";

    return pickFirstNonEmptyString([
      entry?.headwordGloss,
      entry?.headword_gloss,
      entry?.gloss,
      entry?.meaning,
      entry?.definition,
      senseGloss,
      sense0Gloss,
    ]);
  };

  const buildFavoritePayloadsFromEntry = (entry, { headword, canonicalPos }) => {
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
      const payloads = senses.map((s, idx) => {
        const senseGloss = s && typeof s?.gloss === "string" && s.gloss.trim() ? s.gloss : "";

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

      return payloads;
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
  };

  // ============================
  // API：favorites categories
  // ============================
  const loadFavoriteCategoriesFromApi = async () => {
    if (!authUserId) return { ok: false, categories: null, error: new Error("not logged in") };

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
          `[favorites] GET /api/library/favorites/categories failed: ${res.status} ${res.statusText}${detail ? " | " + detail : ""}`
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
  };

  // ============================
  // API：library list / upsert / delete
  // ============================
  const loadLibraryFromApi = async ({ limit = 50, cursor = null, categoryId = null } = {}) => {
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
          `[library] GET /api/library failed: ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ""}`
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
  };

  const postLibraryUpsertViaApi = async (payload) => {
    if (!authUserId) return;

    const safePayload = payload || {};
    const actionHeadword = (safePayload?.headword || "").toString().trim();
    const actionCanonicalPos = (safePayload?.canonicalPos || "").toString().trim();
    const actionSenseIndex = Number.isInteger(safePayload?.senseIndex) ? safePayload.senseIndex : null;

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
        `[library] POST /api/library failed: ${res.status} ${res.statusText}${detail ? " | " + detail : ""}`
      );
    }

    let respJson = null;
    try {
      respJson = await res.clone().json();
    } catch {
      respJson = null;
    }

    if (isLibraryDebugEnabled && isLibraryDebugEnabled()) {
      try {
        console.debug("[library][postLibraryUpsertViaApi][verify]", {
          payload: {
            headword: actionHeadword,
            canonicalPos: actionCanonicalPos,
            senseIndex: actionSenseIndex,
            familiarity: Number.isInteger(safePayload?.familiarity) ? safePayload.familiarity : null,
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
  };

  const addFavoriteViaApi = async ({
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

    try {
      console.log("[favorite][addFavoriteViaApi][payload]", {
        headword,
        canonicalPos,
        senseIndex: Number.isInteger(senseIndex) ? senseIndex : null,
        headwordGlossLen: typeof safeGloss === "string" ? safeGloss.length : -1,
        headwordGlossPreview: typeof safeGloss === "string" ? safeGloss.slice(0, 60) : "",
        headwordGlossLang: safeGlossLang,
      });
    } catch {}

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
        `[library] POST /api/library failed: ${res.status} ${res.statusText}${detail ? " | " + detail : ""}`
      );
    }
  };

  const removeFavoriteViaApi = async ({ headword, canonicalPos }) => {
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
        `[library] DELETE /api/library failed: ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ""}`
      );
    }
  };

  const updateSenseStatusViaApi = async ({ headword, canonicalPos, senseIndex, familiarity, isHidden }) => {
    if (!authUserId) return;
    if (!headword) return;

    const payload = {
      headword,
      canonicalPos,
      ...(Number.isInteger(senseIndex) ? { senseIndex } : {}),
      ...(Number.isInteger(familiarity) ? { familiarity } : {}),
      ...(typeof isHidden === "boolean" ? { isHidden } : {}),
    };

    try {
      console.log("[library][updateSenseStatusViaApi][payload]", {
        headword,
        canonicalPos,
        senseIndex: Number.isInteger(senseIndex) ? senseIndex : null,
        familiarity: Number.isInteger(familiarity) ? familiarity : null,
        isHidden: typeof isHidden === "boolean" ? isHidden : null,
      });
    } catch {}

    await postLibraryUpsertViaApi(payload);

    const after = await loadLibraryFromApi({ limit: 50 });

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
        match && Object.prototype.hasOwnProperty.call(match, "familiarity") ? match.familiarity ?? null : null;
      const gotH =
        match && Object.prototype.hasOwnProperty.call(match, "isHidden") ? match.isHidden ?? null : null;

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
  };

  // ============================
  // UI wrappers
  // ============================
  const handleUpdateSenseStatus = (payload) => {
    if (!authUserId) return;
    if (USE_API_LIBRARY) {
      updateSenseStatusViaApi(payload);
      return;
    }

    try {
      console.log("[library][handleUpdateSenseStatus][legacy][noop]", payload);
    } catch {}
  };

  const toggleFavoriteViaApi = async (entry, options = null) => {
    if (!authUserId) return;
    const { headword, canonicalPos } = getFavoriteKey(entry);
    if (!headword) return;

    const exists = libraryItems.some((x) => {
      return (
        (x?.headword || "").trim() === headword &&
        ((x?.canonical_pos ?? x?.canonicalPos) || "").trim() === canonicalPos
      );
    });

    const pickDefaultCategoryIdForAdd = () => {
      try {
        const optRaw =
          options && typeof options === "object" ? options.category_id ?? options.categoryId : null;
        if (optRaw !== null && typeof optRaw !== "undefined") return optRaw;

        if (selectedFavoriteCategoryId) return selectedFavoriteCategoryId;

        if (Array.isArray(favoriteCategories) && favoriteCategories.length > 0) {
          const prefer = favoriteCategories.find((c) => (c?.name || "") === "我的最愛1");
          if (prefer && (prefer?.id ?? null) !== null) return prefer.id;
        }
      } catch (e) {}
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

        try {
          console.log("[favorite][toggleFavoriteViaApi][multi-sense][plan]", {
            headword,
            canonicalPos,
            payloadCount: Array.isArray(payloads) ? payloads.length : 0,
            hasSensesArray: Array.isArray(entry?.senses),
            sensesLen: Array.isArray(entry?.senses) ? entry.senses.length : 0,
            hasHeadwordSensesArray: Array.isArray(entry?.headwordSenses),
            headwordSensesLen: Array.isArray(entry?.headwordSenses) ? entry.headwordSenses.length : 0,
          });
        } catch {}

        if (Array.isArray(payloads) && payloads.length > 0) {
          for (const p of payloads) {
            try {
              console.log("[favorite][toggleFavoriteViaApi][multi-sense][one]", {
                headword: p?.headword,
                canonicalPos: p?.canonicalPos,
                senseIndex: Number.isInteger(p?.senseIndex) ? p.senseIndex : null,
                headwordGlossLen: typeof p?.headwordGloss === "string" ? p.headwordGloss.length : -1,
                headwordGlossPreview:
                  typeof p?.headwordGloss === "string" ? p.headwordGloss.slice(0, 60) : "",
                headwordGlossLang: p?.headwordGlossLang,
              });
            } catch {}

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
    } catch (e) {}
  };

  // ✅ isFavorited：WordCard 顯示用
  const isFavorited = (entry) => {
    const headword = (entry?.headword || "").trim();
    const canonicalPos = (entry?.canonicalPos || "").trim();
    if (!headword) return false;

    const headwordKey = normalizeFavoriteTextLower(headword);
    const canonicalPosKey = normalizeFavoriteTextLower(canonicalPos);

    return libraryItems.some((x) => {
      const xHeadwordRaw = (x?.headword || "").trim();
      const xPosRaw = ((x?.canonical_pos ?? x?.canonicalPos) || "").trim();

      return normalizeFavoriteTextLower(xHeadwordRaw) === headwordKey && normalizeFavoriteTextLower(xPosRaw) === canonicalPosKey;
    });
  };

  // ✅ toggleFavorite：legacy localStorage（保留）
  // DEPRECATED (2025-12-17): Phase 4 啟用 USE_API_LIBRARY 時，UI 應改呼叫 handleToggleFavorite（wrapper），避免直接走 localStorage
  const toggleFavoriteLegacy = (entry) => {
    if (!authUserId) return;

    const headword = (entry?.headword || "").trim();
    const canonicalPos = (entry?.canonicalPos || "").trim();
    if (!headword) return;

    setLibraryItems((prev) => {
      const existsIndex = prev.findIndex((x) => {
        return (x?.headword || "").trim() === headword && ((x?.canonical_pos ?? x?.canonicalPos) || "").trim() === canonicalPos;
      });

      let next = [];
      if (existsIndex >= 0) {
        next = prev.filter((_, i) => i !== existsIndex);
      } else {
        next = [{ headword, canonicalPos, createdAt: new Date().toISOString(), userId: authUserId }, ...prev];
      }

      writeWordLibraryRaw(next);
      return next;
    });
  };

  const handleToggleFavorite = (entry, options = null) => {
    if (!authUserId) return;
    if (USE_API_LIBRARY) {
      toggleFavoriteViaApi(entry, options);
      return;
    }
    toggleFavoriteLegacy(entry);
  };

  // ============================
  // Category selection
  // ============================
  const handleSelectFavoriteCategory = async (categoryId) => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;

    const nextId = categoryId ? String(categoryId) : null;

    try {
      if (nextId) window.localStorage.setItem(FAVORITES_CATEGORY_KEY, nextId);
      else window.localStorage.removeItem(FAVORITES_CATEGORY_KEY);
    } catch (e) {}

    setSelectedFavoriteCategoryId(nextId);

    try {
      setLibraryCursor(null);
    } catch (e) {}

    if (nextId) {
      await loadLibraryFromApi({ limit: 50, cursor: null, categoryId: nextId });
    } else {
      await loadLibraryFromApi({ limit: 50, cursor: null });
    }
  };

  const handleSelectFavoriteCategoryForAdd = (categoryId) => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;

    const nextId = categoryId ? String(categoryId) : null;

    try {
      if (nextId) window.localStorage.setItem(FAVORITES_CATEGORY_KEY, nextId);
      else window.localStorage.removeItem(FAVORITES_CATEGORY_KEY);
    } catch (e) {}

    setSelectedFavoriteCategoryId(nextId);
  };

  // ✅ 任務 3：ResultPanel 下拉一進查字結果就能用（登入後先載入一次分類）
  useEffect(() => {
    if (!USE_API_LIBRARY) return;
    if (!authUserId) return;

    if (favoriteCategoriesLoading) return;
    if (Array.isArray(favoriteCategories) && favoriteCategories.length > 0) return;

    loadFavoriteCategoriesFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [USE_API_LIBRARY, authUserId]);

  // ✅ Phase 4：彈窗打開時載入單字庫 + 分類 + 預設分類策略
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
      } catch (e) {}

      try {
        setLibraryCursor(null);
      } catch (e) {}

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

  // ============================
  // Modal open/close/review
  // ============================
  const openLibraryModal = () => {
    if (!authUserId) return;
    setShowLibraryModal(true);
  };

  const closeLibraryModal = () => {
    setShowLibraryModal(false);
  };

  const handleLibraryReview = (headword) => {
    const hw = normalizeSearchQuery(headword, "handleLibraryReview");
    if (!hw) return;
    // 由 App.jsx 既有流程負責 setText + analyze（這裡只做最小接線）
    // App.jsx 已在 normalizeSearchQuery/handleAnalyzeByText 中有完整規則
    closeLibraryModal();
    handleAnalyzeByText(hw);
  };

  return {
    // exposed
    isFavorited,
    handleToggleFavorite,
    handleUpdateSenseStatus,
    openLibraryModal,
    closeLibraryModal,
    handleLibraryReview,
    handleSelectFavoriteCategory,
    handleSelectFavoriteCategoryForAdd,
  };
}
