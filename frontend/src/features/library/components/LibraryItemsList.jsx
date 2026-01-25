// frontend/src/features/library/components/LibraryItemsList.jsx
/**
 * LibraryItemsList.jsx
 * - 清單渲染（favorites / system items）
 * - item click -> onReview
 * - sense status UI（原本就在 WordLibraryPanel）
 *
 * 異動紀錄（只追加，不刪除）：
 * - 2026-01-16：
 *   ✅ B(UI) Step：列表星號支援 pending → disabled（單字粒度）
 *   - 新增 props：isFavoritePending / getFavoriteWordKey
 *   - UI 只負責「阻擋點擊 + disabled 呈現」，不做交易邏輯、不做 optimistic flip
 */

import React from "react";
import FavoriteStar from "../../../components/common/FavoriteStar";

/** 原檔中的 icon 元件（保留原樣） */
function SenseIconThumbUp({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 22H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h4v12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 10l3-7a2 2 0 0 1 2-1h1a2 2 0 0 1 2 2v6h3.3a2 2 0 0 1 1.95 2.45l-1.2 6A2 2 0 0 1 20.1 22H9V10Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SenseIconThumbDown({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 2h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4V2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M15 14l-3 7a2 2 0 0 1-2 1H9a2 2 0 0 1-2-2v-6H3.7a2 2 0 0 1-1.95-2.45l1.2-6A2 2 0 0 1 3.9 2H15v12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LibraryItemsList({
  // mode
  isFavoritesSet,
  selectedSetCode,

  // data
  favoritesItems,
  systemItems,
  systemLoading,
  systemError,

  // i18n
  uiText,
  effectiveLang,
  t,

  // actions
  onReview,
  canToggle,
  onToggleFavorite,
  canUpdateSenseStatus,
  onUpdateSenseStatus,

  // ✅ 2026-01-16：B(UI) pending 狀態（由 controller/App 提供）
  // - isFavoritePending(wordKey)：判斷該 wordKey 是否 pending
  // - getFavoriteWordKey(meta)：由上層決定 wordKey 規則（確保跨面板一致）
  // 本檔只負責「阻擋點擊 + disabled 呈現」，不做交易邏輯、不做 optimistic
  isFavoritePending,
  getFavoriteWordKey,

  // optional
  reload,
}) {
  // ✅ S｜義項狀態 UI 即時更新（前端覆蓋層，避免後端成功但 UI 未刷新）
  const [senseUiOverrides, setSenseUiOverrides] = React.useState(() => ({}));

  // ✅ S｜中文功能說明：產生義項 key（穩定且可讀）
  function getSenseKey(headword, canonicalPos, senseIndex) {
    const idx = senseIndex === null || typeof senseIndex === "undefined" ? 0 : senseIndex;
    return `${headword}__${canonicalPos}__${idx}`;
  }

  function getSenseOverride(headword, canonicalPos, senseIndex) {
    const key = getSenseKey(headword, canonicalPos, senseIndex);
    return (senseUiOverrides && senseUiOverrides[key]) || null;
  }

  function setSenseOverride(headword, canonicalPos, senseIndex, patch) {
    const key = getSenseKey(headword, canonicalPos, senseIndex);
    setSenseUiOverrides((prev) => ({
      ...(prev || {}),
      [key]: {
        ...((prev && prev[key]) || {}),
        ...(patch || {}),
      },
    }));
  }

  // ✅ Production 排查：初始化狀態補充（不覆寫既有 window.__wlPanelInit）
  try {
    if (typeof window !== "undefined" && window.__wlPanelInit) {
      window.__wlPanelInit.senseUiOverridesReady = true;
    }
  } catch (e) {
    // no-op
  }

  // ✅ 詞性顯示名稱：使用 uiText.wordCard.posLocalNameMap（若無則回傳原始 canonicalPos）
  function getPosDisplayName(posRaw) {
    const p = typeof posRaw === "string" ? posRaw : "";

    const map1 =
      (uiText &&
        uiText[effectiveLang] &&
        uiText[effectiveLang].wordCard &&
        uiText[effectiveLang].wordCard.posLocalNameMap) ||
      null;

    const map2 =
      (uiText && uiText["zh-TW"] && uiText["zh-TW"].wordCard && uiText["zh-TW"].wordCard.posLocalNameMap) ||
      null;

    if (map1 && map1[p]) return map1[p];
    if (map2 && map2[p]) return map2[p];

    return p;
  }

  // =========================
  // ✅ B｜單字庫 UI（合併呈現）
  // =========================
  function pickRowField(row, camelKey, snakeKey) {
    if (!row) return undefined;
    if (row[camelKey] !== undefined && row[camelKey] !== null) return row[camelKey];
    if (row[snakeKey] !== undefined && row[snakeKey] !== null) return row[snakeKey];
    return undefined;
  }

  function getSenseIndex(row) {
    const v = pickRowField(row, "senseIndex", "sense_index");
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function getGloss(row) {
    const v = pickRowField(row, "headwordGloss", "headword_gloss");
    return typeof v === "string" ? v : "";
  }

  function getFamiliarity(row) {
    const v = pickRowField(row, "familiarity", "familiarity");
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function getIsExcluded(row) {
    const v = pickRowField(row, "isHidden", "is_hidden");
    return !!v;
  }

  function buildGroupedItems(rows) {
    const map = new Map();
    (rows || []).forEach((r) => {
      const headword = pickRowField(r, "headword", "headword") || "";
      const canonicalPos = pickRowField(r, "canonicalPos", "canonical_pos") || "";
      const key = `${headword}__${canonicalPos}`;

      if (!map.has(key)) {
        map.set(key, {
          headword,
          canonicalPos,
          rows: [],
        });
      }
      map.get(key).rows.push(r);
    });

    const grouped = Array.from(map.values());

    grouped.forEach((g) => {
      g.rows.sort((r1, r2) => {
        const s1 = getSenseIndex(r1);
        const s2 = getSenseIndex(r2);
        const a1 = s1 === null ? 999999 : s1;
        const a2 = s2 === null ? 999999 : s2;
        return a1 - a2;
      });
    });

    return grouped;
  }

  const activeLibraryItems = isFavoritesSet ? favoritesItems || [] : [];
  const groupedItems = buildGroupedItems(activeLibraryItems);

  // ✅ 2026/01/10：system set 的「殼清單」顯示用 helper
  function getSetItemLabel(item) {
    if (!item) return "";
    const v =
      pickRowField(item, "label", "label") ||
      pickRowField(item, "headword", "headword") ||
      pickRowField(item, "text", "text") ||
      "";
    return typeof v === "string" ? v : String(v || "");
  }

  function getSetItemLearningMark(item) {
    const v = pickRowField(item, "learningMark", "learning_mark");
    return typeof v === "string" ? v : "";
  }

  function getSetItemLearningMarkTitle(mark, _t) {
    if (!mark) return "";
    if (_t && _t.learningMarkTitleMap && _t.learningMarkTitleMap[mark]) return _t.learningMarkTitleMap[mark];
    return String(mark);
  }

  function safeToggleFavorite(entry, meta) {
    // ✅ 本檔只負責 UI 事件轉交，不做 API
    try {
      if (typeof window !== "undefined") {
        if (!window.__wlFavToggleLog) {
          window.__wlFavToggleLog = { count: 0, last: null };
        }
      }
    } catch (e) {
      // no-op
    }

    try {
      const w = typeof window !== "undefined" ? window : null;
      if (w && w.__wlFavToggleLog && w.__wlFavToggleLog.count < 12) {
        w.__wlFavToggleLog.count += 1;
        w.__wlFavToggleLog.last = { at: new Date().toISOString(), entry, meta };
        console.debug("[WordLibraryPanel] toggleFavorite click", {
          canToggle,
          entry,
          meta,
          hasOnToggleFavorite: typeof onToggleFavorite === "function",
        });
      }
    } catch (e) {
      // no-op
    }

    if (typeof onToggleFavorite !== "function") return;

    try {
      const ret = onToggleFavorite(entry);

      if (ret && typeof ret.then === "function" && typeof ret.catch === "function") {
        ret.catch((err) => {
          try {
            console.error("[WordLibraryPanel] onToggleFavorite rejected", err, { entry, meta });
          } catch (e) {
            // no-op
          }
        });
      }
    } catch (err) {
      try {
        console.error("[WordLibraryPanel] onToggleFavorite threw", err, { entry, meta });
      } catch (e) {
        // no-op
      }
    }
  }

  function handleStarClick(e, headword, canonicalPos) {
    // ✅ 2026-01-16：B(UI) pending → disable（單字粒度）
    // 中文功能說明：
    // - pending 狀態由 controller 提供（isFavoritePending + getFavoriteWordKey）
    // - UI 只負責「阻擋點擊 / disabled 呈現」，不做交易邏輯
    const wordKey = resolveFavoriteWordKeyForLibraryGroup({ headword, canonicalPos });
    const pending = !!(wordKey && typeof isFavoritePending === "function" ? isFavoritePending(wordKey) : false);
    if (pending) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (!e) {
      if (!canToggle) return;
      safeToggleFavorite({ headword, canonicalPos }, { source: "handleStarClick_noEvent" });
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (!canToggle) return;

    safeToggleFavorite({ headword, canonicalPos }, { source: "handleStarClick" });
  }

  // ✅ 2026-01-16：B(UI) wordKey resolve（Library list）
  // 中文功能說明：
  // - 不在 UI 內硬編 wordKey 規則，避免與 controller 不一致
  // - 優先嘗試「通用 shape」（entry + idx），與 ResultPanel 的呼叫方式相容
  // - 若上層採不同參數 shape，仍可在 getFavoriteWordKey 內自行兼容
  function resolveFavoriteWordKeyForLibraryGroup({ headword, canonicalPos }) {
    if (typeof getFavoriteWordKey !== "function") return null;
    const entry = { headword: headword || "", canonicalPos: canonicalPos || "" };

    try {
      // 1) 常見：getFavoriteWordKey({ entry, idx })
      const k1 = getFavoriteWordKey({ entry, idx: 0, item: null, source: "libraryList" });
      if (typeof k1 === "string" && k1.trim()) return k1;
    } catch (err) {
      // ignore
    }

    try {
      // 2) fallback：getFavoriteWordKey({ headword, canonicalPos })
      const k2 = getFavoriteWordKey({ headword: entry.headword, canonicalPos: entry.canonicalPos, source: "libraryList" });
      if (typeof k2 === "string" && k2.trim()) return k2;
    } catch (err) {
      // ignore
    }

    return null;
  }

  function handleHeadwordClick(e, headword) {
    if (!e) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof onReview === "function") onReview(headword);
  }

  function getFavButtonText(isFavorited) {
    if (isFavorited) return t.cancelFavoriteTitle;
    return t.favoriteTitle || t.cancelFavoriteTitle;
  }

  // =========================
  // ✅ O｜義項狀態 UI v0：事件發射（由外層接 API）
  // =========================
  function handleUpdateSenseStatus(e, payload) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!canUpdateSenseStatus) {
      try {
        if (typeof window !== "undefined" && window.__wlPanelInit && !window.__wlPanelInit.__statusNoHandlerLogged) {
          window.__wlPanelInit.__statusNoHandlerLogged = true;
          console.log("[WordLibraryPanel][senseStatus] onUpdateSenseStatus missing → display-only mode");
        }
      } catch (err) {
        // no-op
      }
      return;
    }

    try {
      if (typeof window !== "undefined" && payload && payload._sampleLog) {
        console.log("[WordLibraryPanel][senseStatus] update", payload);
      }
    } catch (err) {
      // no-op
    }

    let __prevSenseOverride = null;
    let __didApplySenseOverride = false;

    try {
      if (payload && payload.headword && payload.canonicalPos) {
        const __senseIndex =
          typeof payload.senseIndex === "undefined" || payload.senseIndex === null ? 0 : payload.senseIndex;
        __prevSenseOverride = getSenseOverride(payload.headword, payload.canonicalPos, __senseIndex);

        const __patch = {};
        if (Object.prototype.hasOwnProperty.call(payload, "familiarity")) __patch.familiarity = payload.familiarity;
        if (Object.prototype.hasOwnProperty.call(payload, "isHidden")) __patch.isHidden = payload.isHidden;

        if (Object.keys(__patch).length > 0) {
          setSenseOverride(payload.headword, payload.canonicalPos, __senseIndex, __patch);
          __didApplySenseOverride = true;
        }
      }
    } catch (err) {
      // no-op
    }

    let ret = null;

    try {
      if (typeof onUpdateSenseStatus === "function") ret = onUpdateSenseStatus(payload);
    } catch (err) {
      try {
        console.error("[WordLibraryPanel][senseStatus] onUpdateSenseStatus threw", err, payload);
      } catch (e) {
        // no-op
      }
    }

    // ✅ failure rollback（UI 層最小需求：不要卡住、不要停在錯誤狀態）
    // 注意：這裡是 sense status 的 UI 覆蓋層，不是 favorite 的 optimistic
    if (ret && typeof ret.then === "function" && typeof ret.catch === "function") {
      ret.catch((err) => {
        try {
          console.error("[WordLibraryPanel][senseStatus] onUpdateSenseStatus rejected", err, payload);
        } catch (e) {
          // no-op
        }

        try {
          if (__didApplySenseOverride && payload && payload.headword && payload.canonicalPos) {
            const __senseIndex =
              typeof payload.senseIndex === "undefined" || payload.senseIndex === null ? 0 : payload.senseIndex;
            if (__prevSenseOverride) {
              setSenseOverride(payload.headword, payload.canonicalPos, __senseIndex, __prevSenseOverride);
            } else {
              // delete override
              const k = getSenseKey(payload.headword, payload.canonicalPos, __senseIndex);
              setSenseUiOverrides((prev) => {
                const next = { ...(prev || {}) };
                delete next[k];
                return next;
              });
            }
          }
        } catch (e) {
          // no-op
        }
      });
    }
  }

  // -------------------------
  // ✅ system set UI
  // -------------------------
  function handleSetItemClick(e, label) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (typeof onReview === "function") onReview(label);
  }

  // ✅ system sets
  if (!isFavoritesSet) {
    if (systemLoading) {
      return (
        <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.65, padding: "10px 2px" }}>
          {t.loadingText}
        </div>
      );
    }

    if (systemError) {
      return (
        <div style={{ opacity: 0.85, fontSize: 13, lineHeight: 1.65, padding: "10px 2px" }}>
          {t.errorLine1}
          <br />
          {t.errorLine2}
        </div>
      );
    }

    if (!systemItems || systemItems.length === 0) {
      return (
        <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.65, padding: "10px 2px" }}>
          {t.emptySetLine1}
          <br />
          {t.emptySetLine2}
        </div>
      );
    }

    return (
      <div
        className="wl-list"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: "calc(72vh - 32px)",
          overflowY: "auto",
          overscrollBehavior: "contain",
          paddingRight: 2,
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        {(systemItems || []).map((it, idx) => {
          const label = getSetItemLabel(it);
          const typeLabel = pickRowField(it, "itemType", "item_type") || "";

          const learnMark = getSetItemLearningMark(it);
          const learnMarkTitle = getSetItemLearningMarkTitle(learnMark, t);

          return (
            <div
              key={`setItem__${selectedSetCode || "set"}__${label || idx}__${idx}`}
              className="wl-setItemRow"
              title={t.setItemRowTitle || ""}
              onClick={(e) => handleSetItemClick(e, label)}
              style={{ cursor: "pointer" }}
            >
              <div className="wl-setItemLabel" title={label || ""} style={{ minWidth: 0 }}>
                {label}
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                {learnMark ? (
                  <div className="wl-setItemLearnMark" title={learnMarkTitle} aria-label={learnMarkTitle}>
                    {learnMark}
                  </div>
                ) : (
                  <div className="wl-setItemLearnMark" style={{ opacity: 0.0 }} aria-hidden="true">
                    _
                  </div>
                )}

                {typeLabel ? (
                  <div className="wl-setItemBadge" title={String(typeLabel)}>
                    {String(typeLabel)}
                  </div>
                ) : (
                  <div className="wl-setItemBadge" style={{ opacity: 0.0 }}>
                    _
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // favorites
  if (!activeLibraryItems || activeLibraryItems.length === 0) {
    return (
      <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.65, padding: "10px 2px" }}>
        {t.emptyLine1}
        <br />
        {t.emptyLine2}
      </div>
    );
  }

  // =========================
  // ✅ helpers for favorites list rendering
  // =========================
  function inferSenseIndexBaseForGroup(rows) {
    // base for numbering (kept from original behavior)
    let min = null;
    (rows || []).forEach((r) => {
      const s = getSenseIndex(r);
      if (typeof s === "number" && Number.isFinite(s)) {
        if (min === null || s < min) min = s;
      }
    });
    return min === null ? 0 : min;
  }

  function getDisplayIdx0ForSenseRow(groupRows, senseIndex, ridx) {
    const base = inferSenseIndexBaseForGroup(groupRows);
    const s = typeof senseIndex === "number" && Number.isFinite(senseIndex) ? senseIndex : ridx;
    const idx0 = s - base + 1;
    return idx0 <= 0 ? ridx + 1 : idx0;
  }

  function formatCircledNumber(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return "①";
    const map = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];
    if (x >= 1 && x <= map.length) return map[x - 1];
    return String(x);
  }

  function buildMergedGlossLineWithIndex(rows) {
    const base = inferSenseIndexBaseForGroup(rows);
    const parts = [];
    (rows || []).forEach((r, ridx) => {
      const s = getSenseIndex(r);
      const idx0 = getDisplayIdx0ForSenseRow(rows, s, ridx);
      const g = getGloss(r);
      if (!g) return;
      parts.push(`${formatCircledNumber(idx0)} ${g}`);
    });
    if (parts.length === 0) return "";
    return parts.join(" / ");
  }

  return (
    <div
      className="wl-list"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxHeight: "calc(72vh - 32px)",
        overflowY: "auto",
        overscrollBehavior: "contain",
        paddingRight: 2,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      {groupedItems.map((g, gidx) => {
        const posDisplay = getPosDisplayName(g.canonicalPos || "");
        const mergedGloss = buildMergedGlossLineWithIndex(g.rows);
        const glossLineText = mergedGloss ? mergedGloss : t.glossEmpty;

        const isFavorited = true;
        const favText = getFavButtonText(isFavorited);

        // ✅ 2026-01-16：B(UI) pending → disable（單字粒度）
        // - 同一 wordKey 在交易中：本列表星號必須鎖住（disabled + 擋事件）
        const favoriteWordKey = resolveFavoriteWordKeyForLibraryGroup({
          headword: g.headword,
          canonicalPos: g.canonicalPos,
        });
        const isPendingThisWord = !!(
          favoriteWordKey && typeof isFavoritePending === "function" ? isFavoritePending(favoriteWordKey) : false
        );
        const canToggleEffective = !!canToggle && !isPendingThisWord;

        const favAria = canToggleEffective ? favText : t.cannotOperateTitle;

        return (
          <div
            key={`${g.headword}__${g.canonicalPos}__group__${gidx}`}
            className="wl-item"
            style={{
              textAlign: "left",
              padding: "1px 14px",
              borderRadius: 16,
              minHeight: "auto",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.10)",
              cursor: "default",
            }}
            title=""
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div className="wl-headwordLine">
                  <button
                    type="button"
                    className="wl-headwordBtn"
                    onClick={(e) => handleHeadwordClick(e, g.headword)}
                    title={t.headwordButtonTitle || t.reviewTitle}
                    style={{
                      fontSize: 20,
                      fontWeight: 850,
                      letterSpacing: 0.2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {g.headword}
                  </button>

                  <span className="wl-posInline" title={g.canonicalPos || ""}>
                    {posDisplay || ""}
                  </span>
                </div>

                {false && <div style={{ fontSize: 12, opacity: 0.62, marginTop: 4 }}>{t.lemmaLabel}</div>}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div
                  role="button"
                  className="wl-favBtn"
                  aria-disabled={!canToggleEffective}
                  data-disabled={!canToggleEffective ? "1" : "0"}
                  data-pending={isPendingThisWord ? "1" : "0"}
                  tabIndex={canToggleEffective ? 0 : -1}
                  aria-label={favAria}
                  onClick={(e) => {
                    if (!canToggleEffective) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    handleStarClick(e, g.headword, g.canonicalPos);
                  }}
                  onKeyDown={(e) => {
                    if (!canToggleEffective) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleStarClick(e, g.headword, g.canonicalPos);
                    }
                  }}
                >
                  <span className="wl-favText">{favText}</span>

                  <FavoriteStar
                    active={isFavorited}
                    disabled={!canToggleEffective}
                    onClick={(e) => handleStarClick(e, g.headword, g.canonicalPos)}
                    size={16}
                    ariaLabel={t.ariaFavorite}
                    title={undefined}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 1,
                paddingTop: 1,
                borderTop: "1px solid rgba(255,255,255,0.10)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
              title={glossLineText || ""}
            >
              {g.rows.map((row, ridx) => {
                const senseIndex = getSenseIndex(row);
                const gloss = getGloss(row);
                const familiarity = getFamiliarity(row);
                const isExcluded = getIsExcluded(row);

                const __override = getSenseOverride(g.headword, g.canonicalPos, senseIndex === null ? 0 : senseIndex);
                const familiarityEffective =
                  __override && Object.prototype.hasOwnProperty.call(__override, "familiarity")
                    ? __override.familiarity
                    : familiarity;
                const isExcludedEffective =
                  __override && Object.prototype.hasOwnProperty.call(__override, "isHidden")
                    ? !!__override.isHidden
                    : isExcluded;

                const idx0 = getDisplayIdx0ForSenseRow(g.rows, senseIndex, ridx);

                try {
                  if (typeof window !== "undefined" && gidx < 3 && ridx < 4) {
                    console.log("[WordLibraryPanel][senseNo]", {
                      headword: g.headword,
                      canonicalPos: g.canonicalPos,
                      senseIndexBase: inferSenseIndexBaseForGroup(g.rows),
                      ridx,
                      senseIndex,
                      idx0,
                      numLabel: formatCircledNumber(idx0),
                      glossPreview: (getGloss(row) || "").slice(0, 20),
                    });
                  }
                } catch (e) {
                  // no-op
                }

                const sampleLog = typeof window !== "undefined" && gidx < 2 && ridx < 2;

                return (
                  <div key={`sense__${ridx}`} className="wl-senseRow">
                    <div className="wl-senseIdx">{formatCircledNumber(idx0)}</div>
                    <div className="wl-senseGloss">{gloss ? gloss : t.glossEmpty || "—"}</div>

                    <div className="wl-senseStatus" title={canUpdateSenseStatus ? t.senseStatusTitle : t.senseStatusDisabledTitle}>
                      <button
                        type="button"
                        data-kind="familiarity-up"
                        className={`wl-senseActionBtn ${familiarityEffective === 1 ? "wl-senseActionBtn--active" : "wl-senseActionBtn--muted"}`}
                        disabled={!canUpdateSenseStatus}
                        aria-label={t.senseLikeTitle}
                        title={t.senseLikeTitle}
                        onClick={(e) =>
                          handleUpdateSenseStatus(e, {
                            headword: g.headword,
                            canonicalPos: g.canonicalPos,
                            senseIndex: senseIndex === null ? 0 : senseIndex,
                            familiarity: 1,
                            _sampleLog: sampleLog,
                          })
                        }
                      >
                        <SenseIconThumbUp size={16} />
                      </button>

                      <button
                        type="button"
                        data-kind="familiarity-down"
                        className={`wl-senseActionBtn ${familiarityEffective === -1 ? "wl-senseActionBtn--active" : "wl-senseActionBtn--muted"}`}
                        disabled={!canUpdateSenseStatus}
                        aria-label={t.senseDislikeTitle}
                        title={t.senseDislikeTitle}
                        onClick={(e) =>
                          handleUpdateSenseStatus(e, {
                            headword: g.headword,
                            canonicalPos: g.canonicalPos,
                            senseIndex: senseIndex === null ? 0 : senseIndex,
                            familiarity: -1,
                            _sampleLog: sampleLog,
                          })
                        }
                      >
                        <SenseIconThumbDown size={16} />
                      </button>

                      <button
                        type="button"
                        data-kind="exclude"
                        className={`wl-senseActionBtn ${
                          isExcludedEffective ? "wl-senseActionBtn--active" : "wl-senseActionBtn--muted"
                        }`}
                        disabled={!canUpdateSenseStatus}
                        aria-label={t.senseExcludeTitle}
                        title={t.senseExcludeTitle}
                        onClick={(e) =>
                          handleUpdateSenseStatus(e, {
                            headword: g.headword,
                            canonicalPos: g.canonicalPos,
                            senseIndex: senseIndex === null ? 0 : senseIndex,
                            isHidden: !isExcludedEffective,
                            _sampleLog: sampleLog,
                          })
                        }
                      >
                        {isExcludedEffective ? "🚫" : "○"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// frontend/src/features/library/components/LibraryItemsList.jsx
