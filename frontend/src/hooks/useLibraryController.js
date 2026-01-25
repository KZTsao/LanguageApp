// frontend/src/hooks/useLibraryController.js
import { useEffect, useRef, useState } from "react";

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
  // [FAV_FLOW] 統一觀測（低噪音摘要 log）
  // - 目的：觀察「收藏/取消收藏」在 UI → hook → API → DB 的卡點
  // - 規則：所有摘要 log 都用同一前綴 + flowId，方便 grep
  // ============================
  const makeFavFlowId = () => {
    try {
      const rand = Math.random().toString(36).slice(2, 8);
      return `fav_${Date.now().toString(36)}_${rand}`;
    } catch (e) {
      return `fav_${Date.now()}`;
    }
  };

  const favFlowLog = (payload) => {
    try {
      const p = payload || {};
      console.log("[FAV_FLOW]", {
        flowId: p.flowId || "",
        stage: p.stage || "",
        set: p.set || "",
        category: p.category ?? null,
        wordKey: p.wordKey || "",
        action: p.action || "",
      });
    } catch (e) {
      // no-op
    }
  };

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

  // ============================
  // [FAV_TXN] pending lock + optimistic + rollback
  // - 交易鎖是 controller 的唯一真相：UI 只讀 isFavoritePending(wordKey)
  // - 目的：避免重複點擊、先亮燈(optimistic)、失敗可 rollback
  // ============================
  const pendingFavMapRef = useRef(new Map());

  // wordKey 以「你現有收藏判斷粒度」為準（headword + canonicalPos）
  // NOTE: 若未來要做到 senseIndex 粒度，再擴充即可。
  const buildFavoriteWordKey = (entryOrKey) => {
    if (typeof entryOrKey === "string") return entryOrKey;
    const { headwordKey, canonicalPosKey } = getFavoriteKey(entryOrKey);
    return `${headwordKey}::${canonicalPosKey}`;
  };

  // 2026-01-16: expose wordKey builder for UI (read-only)
  const getFavoriteWordKey = (entryOrKey) => buildFavoriteWordKey(entryOrKey);


  // UI disable 用：給 wordKey 或 entry 都可
  const isFavoritePending = (entryOrKey) => {
    try {
      const k = buildFavoriteWordKey(entryOrKey);
      return pendingFavMapRef.current.has(k);
    } catch {
      return false;
    }
  };

  // optimistic：直接改 libraryItems（你目前 isFavorited() 是用 libraryItems.some 判斷存在與否）
  // existsBefore：一定要用「進 txn 前」的判斷（避免 optimistic 後污染 exists 判斷）
  const optimisticToggleFavoriteInList = (entry, { existsBefore }) => {
    const headword = (entry?.headword || "").trim();
    const canonicalPos = (entry?.canonicalPos || "").trim();
    if (!headword) return;

    setLibraryItems((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const matchIndex = list.findIndex((x) => {
        const xHead = (x?.headword || "").trim();
        const xPos = ((x?.canonical_pos ?? x?.canonicalPos) || "").trim();
        return (
          normalizeFavoriteTextLower(xHead) === normalizeFavoriteTextLower(headword) &&
          normalizeFavoriteTextLower(xPos) === normalizeFavoriteTextLower(canonicalPos)
        );
      });

      // 如果 txn 前就存在 → optimistic remove（✅ word-level：同 headword + canonicalPos 的所有 sense 全部移除）
      if (existsBefore) {
        if (matchIndex < 0) return list;
        return list.filter((x) => {
          const xHead = (x?.headword || "").trim();
          const xPos = ((x?.canonical_pos ?? x?.canonicalPos) || "").trim();
          const sameHead =
            normalizeFavoriteTextLower(xHead) === normalizeFavoriteTextLower(headword);
          const samePos =
            normalizeFavoriteTextLower(xPos) === normalizeFavoriteTextLower(canonicalPos);
          return !(sameHead && samePos);
        });
      }

      // txn 前不存在 → optimistic add
      if (matchIndex >= 0) return list;

      // minimal item：維持你既有欄位命名習慣，避免 UI/其他流程抓不到
      const minimal = {
        headword,
        canonicalPos,
        canonical_pos: canonicalPos,
        senseIndex: Number.isInteger(entry?.senseIndex) ? entry.senseIndex : 0,
        createdAt: new Date().toISOString(),
        userId: authUserId,
      };

      return [minimal, ...list];
    });
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
  // Favorites categories：saving lock（本任務新增）
  // - 只鎖「分類 CRUD」請求，避免 Modal 連點/交疊交易
  // ============================
  const [isFavoriteCategoriesSaving, setIsFavoriteCategoriesSaving] = useState(false);

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
  };



  // ============================
  // API：favorites categories CRUD（本任務新增）
  // - 成功後統一 reload：loadFavoriteCategoriesFromApi()
  // - 不做 optimistic，降低回滾成本
  // ============================

  const normalizeCategoryName = (v) => String(v || "").trim();

  const readErrorTextFromResponse = async (res) => {
    try {
      const ct = res && res.headers ? res.headers.get("content-type") : "";
      if (ct && ct.includes("application/json")) {
        const j = await res.clone().json();
        const msg = j && (j.error || j.message || j.detail);
        return msg ? String(msg) : "";
      }
    } catch {}

    try {
      const t = await res.text();
      return t ? String(t) : "";
    } catch {}

    return "";
  };

  const createFavoriteCategoryViaApi = async (name) => {
    if (!authUserId) return { ok: false, error: new Error("not logged in") };

    const nextName = normalizeCategoryName(name);
    if (!nextName) return { ok: false, error: new Error("name is empty") };

    if (isFavoriteCategoriesSaving) return { ok: false, error: new Error("categories saving") };

    setIsFavoriteCategoriesSaving(true);

    try {
      const res = await apiFetch(`/api/library/favorites/categories`, {
        method: "POST",
        body: JSON.stringify({ name: nextName }),
      });

      if (!res) throw new Error("[favorites] create category response is null");

      if (res.status === 401 || res.status === 403) {
        const err = new Error(`[favorites] create category unauthorized: ${res.status}`);
        return { ok: false, error: err, unauthorized: true, status: res.status };
      }

      if (res.status === 409) {
        const detail = await readErrorTextFromResponse(res);
        const err = new Error(detail || "duplicate category name");
        return { ok: false, error: err, conflict: true, status: 409 };
      }

      if (!res.ok) {
        const detail = await readErrorTextFromResponse(res);
        throw new Error(
          `[favorites] POST /api/library/favorites/categories failed: ${res.status} ${res.statusText}${
            detail ? " | " + detail : ""
          }`
        );
      }

      await loadFavoriteCategoriesFromApi();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    } finally {
      setIsFavoriteCategoriesSaving(false);
    }
  };

  const renameFavoriteCategoryViaApi = async (id, name) => {
    if (!authUserId) return { ok: false, error: new Error("not logged in") };

    const catIdNum = Number.parseInt(String(id ?? ""), 10);
    if (!Number.isFinite(catIdNum) || catIdNum <= 0) return { ok: false, error: new Error("invalid id") };

    const nextName = normalizeCategoryName(name);
    if (!nextName) return { ok: false, error: new Error("name is empty") };

    if (isFavoriteCategoriesSaving) return { ok: false, error: new Error("categories saving") };

    setIsFavoriteCategoriesSaving(true);

    try {
      const res = await apiFetch(`/api/library/favorites/categories/${catIdNum}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName }),
      });

      if (!res) throw new Error("[favorites] rename category response is null");

      if (res.status === 401 || res.status === 403) {
        const err = new Error(`[favorites] rename category unauthorized: ${res.status}`);
        return { ok: false, error: err, unauthorized: true, status: res.status };
      }

      if (res.status === 404) {
        const detail = await readErrorTextFromResponse(res);
        const err = new Error(detail || "category not found");
        return { ok: false, error: err, notFound: true, status: 404 };
      }

      if (res.status === 409) {
        const detail = await readErrorTextFromResponse(res);
        const err = new Error(detail || "duplicate category name");
        return { ok: false, error: err, conflict: true, status: 409 };
      }

      if (!res.ok) {
        const detail = await readErrorTextFromResponse(res);
        throw new Error(
          `[favorites] PATCH /api/library/favorites/categories/:id failed: ${res.status} ${res.statusText}${
            detail ? " | " + detail : ""
          }`
        );
      }

      await loadFavoriteCategoriesFromApi();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    } finally {
      setIsFavoriteCategoriesSaving(false);
    }
  };

  const reorderFavoriteCategoriesViaApi = async (ids) => {
    if (!authUserId) return { ok: false, error: new Error("not logged in") };

    const arr = Array.isArray(ids) ? ids : null;
    if (!arr || arr.length === 0) return { ok: false, error: new Error("ids is empty") };

    const parsed = [];
    const seen = new Set();

    for (const x of arr) {
      const n = Number.parseInt(String(x ?? ""), 10);
      if (!Number.isFinite(n) || n <= 0) return { ok: false, error: new Error("invalid id in ids") };
      if (seen.has(String(n))) return { ok: false, error: new Error("duplicate ids") };
      seen.add(String(n));
      parsed.push(n);
    }

    if (isFavoriteCategoriesSaving) return { ok: false, error: new Error("categories saving") };

    setIsFavoriteCategoriesSaving(true);

    try {
      const res = await apiFetch(`/api/library/favorites/categories/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ ids: parsed }),
      });

      if (!res) throw new Error("[favorites] reorder categories response is null");

      if (res.status === 401 || res.status === 403) {
        const err = new Error(`[favorites] reorder categories unauthorized: ${res.status}`);
        return { ok: false, error: err, unauthorized: true, status: res.status };
      }

      if (!res.ok) {
        const detail = await readErrorTextFromResponse(res);
        throw new Error(
          `[favorites] PATCH /api/library/favorites/categories/reorder failed: ${res.status} ${res.statusText}${
            detail ? " | " + detail : ""
          }`
        );
      }

      await loadFavoriteCategoriesFromApi();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    } finally {
      setIsFavoriteCategoriesSaving(false);
    }
  };

  const archiveFavoriteCategoryViaApi = async (id) => {
    if (!authUserId) return { ok: false, error: new Error("not logged in") };

    const catIdNum = Number.parseInt(String(id ?? ""), 10);
    if (!Number.isFinite(catIdNum) || catIdNum <= 0) return { ok: false, error: new Error("invalid id") };

    if (isFavoriteCategoriesSaving) return { ok: false, error: new Error("categories saving") };

    setIsFavoriteCategoriesSaving(true);

    try {
      const res = await apiFetch(`/api/library/favorites/categories/${catIdNum}/archive`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });

      if (!res) throw new Error("[favorites] archive category response is null");

      if (res.status === 401 || res.status === 403) {
        const err = new Error(`[favorites] archive category unauthorized: ${res.status}`);
        return { ok: false, error: err, unauthorized: true, status: res.status };
      }

      if (res.status === 404) {
        const detail = await readErrorTextFromResponse(res);
        const err = new Error(detail || "category not found");
        return { ok: false, error: err, notFound: true, status: 404 };
      }

      if (!res.ok) {
        const detail = await readErrorTextFromResponse(res);
        throw new Error(
          `[favorites] PATCH /api/library/favorites/categories/:id/archive failed: ${res.status} ${res.statusText}${
            detail ? " | " + detail : ""
          }`
        );
      }

      await loadFavoriteCategoriesFromApi();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    } finally {
      setIsFavoriteCategoriesSaving(false);
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
      if (categoryId != null && String(categoryId).trim() !== "") qs.set("category_id", String(categoryId));

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
      typeof headwordGlossLang === "string" && headwordGlossLang.trim() ? headwordGlossLang.trim() : uiLang;

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

  // ✅ 新增：removeFavoriteViaApi 支援 flowId/setCode（不破壞既有呼叫）
  const removeFavoriteViaApi = async ({
    headword,
    canonicalPos,
    categoryId,
    category_id,

    // ✅ 新增（可選）：追蹤用
    flowId,
    setCode,
  }) => {
    if (!authUserId) return;

    // ✅ 分類收藏：取消收藏必須帶 category_id（只刪目前分類的 link）
    const rawCat = category_id ?? categoryId ?? selectedFavoriteCategoryId;
    const catNum = Number.parseInt(String(rawCat ?? ""), 10);
    const safeCategoryId = Number.isFinite(catNum) && catNum > 0 ? catNum : null;

    if (safeCategoryId == null) {
      throw new Error("[favorite] removeFavoriteViaApi requires category_id (selectedFavoriteCategoryId is null)");
    }

    const _flowId = flowId || makeFavFlowId();
    const _set = String(setCode || "favorites");
    const _wordKey = `${headword}::${canonicalPos}`;

    // ✅ 觀測點：DELETE 前
    favFlowLog({
      flowId: _flowId,
      stage: "removeFavoriteViaApi:before",
      set: _set,
      category: safeCategoryId,
      wordKey: _wordKey,
      action: "DELETE /api/library",
    });

    const res = await apiFetch(`/api/library`, {
      method: "DELETE",
      body: JSON.stringify({
        headword,
        canonicalPos,
        category_id: safeCategoryId,

        // ✅ 後端若有要接 flowId，可直接用
        flowId: _flowId,
      }),
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

    // ✅ 觀測點：DELETE 後
    favFlowLog({
      flowId: _flowId,
      stage: "removeFavoriteViaApi:after",
      set: _set,
      category: safeCategoryId,
      wordKey: _wordKey,
      action: "DELETE ok",
    });
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

    const after = await loadLibraryFromApi({ limit: 50, cursor: null, categoryId: selectedFavoriteCategoryId });

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

      const gotF = match && Object.prototype.hasOwnProperty.call(match, "familiarity") ? match.familiarity ?? null : null;
      const gotH = match && Object.prototype.hasOwnProperty.call(match, "isHidden") ? match.isHidden ?? null : null;

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

  // ✅ 新增：toggleFavoriteViaApi 加入 [FAV_FLOW] 觀測點
  // ✅ 重要：此函式「不再吞錯誤」— 失敗必須 throw，讓外層 txn 做 rollback
  // ✅ 可選：options.forceAction = 'add' | 'remove' 以避免 optimistic 後 exists 判斷被污染
  // ✅ 可選：options.skipReload = true 讓外層統一負責 reload
  const toggleFavoriteViaApi = async (entry, options = null) => {
    if (!authUserId) return;
    const { headword, canonicalPos } = getFavoriteKey(entry);
    if (!headword) return;

    const opt = options && typeof options === "object" ? options : {};

    // ====== flow/meta ======
    const flowId = opt.flowId || makeFavFlowId();
    const setCode = opt.set_code ?? opt.setCode ?? "favorites";

    const wordKey = `${headword}::${canonicalPos}`;

    const pickDefaultCategoryIdForAdd = () => {
      try {
        const optRaw = opt.category_id ?? opt.categoryId;
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

    // ====== decide add/remove ======
    const forceAction = typeof opt.forceAction === "string" ? opt.forceAction : null;

    const existsNow = libraryItems.some((x) => {
      return (
        (x?.headword || "").trim() === headword &&
        (((x?.canonical_pos ?? x?.canonicalPos) || "").trim() === canonicalPos)
      );
    });

    const willRemove = forceAction ? forceAction === "remove" : existsNow;

    // ✅ 觀測點：toggle 決策（低噪音一行）
    favFlowLog({
      flowId,
      stage: "toggleFavoriteViaApi:decide",
      set: String(setCode || "favorites"),
      category: safeCategoryId,
      wordKey,
      action: willRemove ? "will-remove" : "will-add",
    });

    try {
      if (willRemove) {
        // ✅ 觀測點：remove 前
        favFlowLog({
          flowId,
          stage: "toggleFavoriteViaApi:before-remove",
          set: String(setCode || "favorites"),
          category: safeCategoryId,
          wordKey,
          action: "call removeFavoriteViaApi",
        });

        await removeFavoriteViaApi({
          headword,
          canonicalPos,
          ...(safeCategoryId != null ? { category_id: safeCategoryId } : {}),
          flowId,
          setCode,
        });

        // ✅ 觀測點：remove 後
        favFlowLog({
          flowId,
          stage: "toggleFavoriteViaApi:after-remove",
          set: String(setCode || "favorites"),
          category: safeCategoryId,
          wordKey,
          action: "removeFavoriteViaApi returned",
        });
      } else {
        // ✅ 觀測點：add 前
        favFlowLog({
          flowId,
          stage: "toggleFavoriteViaApi:before-add",
          set: String(setCode || "favorites"),
          category: safeCategoryId,
          wordKey,
          action: "plan addFavoriteViaApi",
        });

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
                headwordGlossPreview: typeof p?.headwordGloss === "string" ? p.headwordGloss.slice(0, 60) : "",
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

        // ✅ 觀測點：add 後
        favFlowLog({
          flowId,
          stage: "toggleFavoriteViaApi:after-add",
          set: String(setCode || "favorites"),
          category: safeCategoryId,
          wordKey,
          action: "addFavoriteViaApi finished",
        });
      }

      // ✅ reload：預設仍保留舊行為（DB 為唯一真相）；外層 txn 若要統一 reload，可 options.skipReload=true
      if (!opt.skipReload) {
        favFlowLog({
          flowId,
          stage: "toggleFavoriteViaApi:reload:before",
          set: String(setCode || "favorites"),
          category: safeCategoryId,
          wordKey,
          action: "loadLibraryFromApi",
        });

        await loadLibraryFromApi({ limit: 50, cursor: null, categoryId: selectedFavoriteCategoryId });

        favFlowLog({
          flowId,
          stage: "toggleFavoriteViaApi:reload:after",
          set: String(setCode || "favorites"),
          category: safeCategoryId,
          wordKey,
          action: "loadLibraryFromApi done",
        });
      }

      return { ok: true };
    } catch (e) {
      // ✅ 觀測點：api_failed（外層 txn 會 rollback）
      try {
        favFlowLog({
          flowId,
          stage: "toggleFavoriteViaApi:api_failed",
          set: String(setCode || "favorites"),
          category: safeCategoryId,
          wordKey,
          action: String(e?.message || e || "error"),
        });
      } catch {}

      // ✅ 重要：不能吞錯誤
      throw e;
    }
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

      return (
        normalizeFavoriteTextLower(xHeadwordRaw) === headwordKey &&
        normalizeFavoriteTextLower(xPosRaw) === canonicalPosKey
      );
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

  // ✅ handleToggleFavorite：唯一交易入口（pending lock + optimistic + rollback）
  // - UI：點擊後立刻變燈號 + disable（由 isFavoritePending 提供）
  // - 成功：reload 校正 DB 真相
  // - 失敗：rollback 回 snapshot，並把錯誤 throw 出去（外層可 toast）
  const handleToggleFavorite = async (entry, options = null) => {
    if (!authUserId) return;

    if (!USE_API_LIBRARY) {
      toggleFavoriteLegacy(entry);
      return;
    }

    const flowId = makeFavFlowId();
    const setCode =
      (options && typeof options === "object" ? options.set_code ?? options.setCode : null) || "favorites";

    const wordKey = buildFavoriteWordKey(entry);

    // ✅ 防重複點：pending lock
    if (pendingFavMapRef.current.has(wordKey)) {
      favFlowLog({
        flowId,
        stage: "toggle_txn:blocked_by_pending",
        set: String(setCode || "favorites"),
        category: selectedFavoriteCategoryId ?? null,
        wordKey,
        action: "return (duplicate click)",
      });
      return;
    }

    const snapshot = Array.isArray(libraryItems) ? libraryItems : [];

    // existsBefore 取「進入交易前」的判斷，避免 optimistic 後被污染
    const existsBefore = isFavorited(entry);

    // ✅ optimistic 立刻更新 UI（UX：先變色）
    favFlowLog({
      flowId,
      stage: "optimistic_applied",
      set: String(setCode || "favorites"),
      category: selectedFavoriteCategoryId ?? null,
      wordKey,
      action: existsBefore ? "optimistic_remove" : "optimistic_add",
    });

    optimisticToggleFavoriteInList(entry, { existsBefore });

    // ✅ 存 snapshot（rollback 用）+ lock（UX：再 disable）
    pendingFavMapRef.current.set(wordKey, { flowId, snapshot });

    try {
      // ✅ API（失敗要 throw）
      await toggleFavoriteViaApi(entry, {
        ...(options && typeof options === "object" ? options : {}),
        flowId,
        setCode,
        forceAction: existsBefore ? "remove" : "add",
        skipReload: true,
      });

      favFlowLog({
        flowId,
        stage: "api_ok",
        set: String(setCode || "favorites"),
        category: selectedFavoriteCategoryId ?? null,
        wordKey,
        action: "toggleFavoriteViaApi ok",
      });

      // ✅ reload（DB 為唯一真相）
      try {
        await loadLibraryFromApi({ limit: 50, cursor: null, categoryId: selectedFavoriteCategoryId });
        favFlowLog({
          flowId,
          stage: "reloaded_ok",
          set: String(setCode || "favorites"),
          category: selectedFavoriteCategoryId ?? null,
          wordKey,
          action: "loadLibraryFromApi ok",
        });
      } catch (eReload) {
        favFlowLog({
          flowId,
          stage: "reloaded_failed",
          set: String(setCode || "favorites"),
          category: selectedFavoriteCategoryId ?? null,
          wordKey,
          action: String(eReload?.message || eReload || "reload error"),
        });
        throw eReload;
      }
    } catch (e) {
      // ✅ rollback
      try {
        const snap = pendingFavMapRef.current.get(wordKey)?.snapshot || snapshot;
        setLibraryItems(snap);
      } catch {}

      favFlowLog({
        flowId,
        stage: "rollback_applied",
        set: String(setCode || "favorites"),
        category: selectedFavoriteCategoryId ?? null,
        wordKey,
        action: String(e?.message || e || "error"),
      });

      // ✅ 重要：讓外層知道失敗
      throw e;
    } finally {
      pendingFavMapRef.current.delete(wordKey);
    }
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
    isFavoritePending,
    handleToggleFavorite,
    handleUpdateSenseStatus,
    openLibraryModal,
    closeLibraryModal,
    handleLibraryReview,
    handleSelectFavoriteCategory,
    handleSelectFavoriteCategoryForAdd,

    // favorites categories CRUD (DB-backed)
    isFavoriteCategoriesSaving,
    createFavoriteCategoryViaApi,
    renameFavoriteCategoryViaApi,
    reorderFavoriteCategoriesViaApi,
    archiveFavoriteCategoryViaApi,

    // wordKey helper
    getFavoriteWordKey,
  };
}

// frontend/src/hooks/useLibraryController.js
