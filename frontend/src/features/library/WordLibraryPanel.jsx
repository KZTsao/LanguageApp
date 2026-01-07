// frontend/src/features/library/WordLibraryPanel.jsx
/**
 * WordLibraryPanel.jsx
 * 單字庫面板（Word Library Panel）
 *
 * ✅ 核心設計原則（已定案）
 * - 收藏是「字級」（德文單字）
 * - DB 存的是「義項級」（一筆一 sense，為未來測驗保留）
 * - UI 合併呈現：同 headword + canonical_pos 合併成一張卡，卡內列出 ①②…義項
 *
 * ✅ 既有異動紀錄（保留）
 * ✅ 本次異動（2026/01/03）
 * - UI｜義項熟悉度（讚/倒讚）按鈕：移除外匡（不顯示邊框/底色/外圈）
 *
 * ✅ 本次異動（2025/12/19）
 * - B｜單字庫 UI（合併呈現）
 *   1) 將 libraryItems(raw rows) -> groupedItems
 *   2) group key：headword + "::" + canonicalPos
 *   3) group 內依 sense_index ASC 排序，顯示 ①②… + headword_gloss（空顯示 —）
 *   4) 顯示義項狀態 icon：👍(familiarity=1) / 👎(familiarity=-1) / 🚫(is_excluded=true)
 *
 * ✅ 本次異動（2025/12/19）
 * - UI 密度調整 + 修正重疊來源（不改收藏流程、不改後端）
 *   1) 移除「日期資訊」顯示（保留原碼但不渲染：deprecated）
 *   2) 字卡變薄：降低 padding / minHeight / 區塊間距，讓同畫面可顯示更多字卡
 *   3) 修正 DOM 重疊主因：避免 <button> 內再巢狀 <button>
 *      - 外層字卡維持 <button>（符合你退回的版型）
 *      - 內層星星控制改為 <span role="button">（避免瀏覽器自動修正 DOM 造成視覺錯位）
 *
 * ✅ 本次異動（2025/12/23）
 * - F｜灰色外框不再是 button：只讓 headword「字」可點擊回查詢
 *   1) 將單張卡片外層從 <button class="wl-item"> 改成 <div class="wl-item">
 *   2) headword 改成無樣式 <button>，onClick 觸發 onReview(g.headword)
 *   3) 這樣即便 FavoriteStar 內部是 <button> 也不會再觸發巢狀 button 的瀏覽器自動修正
 *
 * ✅ 本次異動（2025/12/23）
 * - G｜文案調整：移除上方註釋 + headword 下方改顯示合併釋義（單行＋序號）
 *
 * ✅ 本次異動（2025/12/24）
 * - I｜修正「我的最愛」無法取消：onToggleFavorite 參數型態修正（不改收藏流程/後端）
 *
 * ✅ 本次異動（2025/12/25）
 * - J｜修正「星星點了沒反應」：FavoriteStar 內層 button 可能阻擋事件冒泡
 *
 * ✅ 本次異動（2025/12/25）
 * - M｜星星改為「單一 button 包含星星＋文字」：收藏/取消收藏（由狀態切換）
 *
 * ✅ 本次異動（2025/12/29）
 * - N｜修正單字庫義項序號顯示：自動判斷 sense_index 基底（0-based / 1-based）
 *
 * ✅ 本次異動（2025/12/31）
 * - O｜導入「義項狀態 UI v0」（最小可操作）
 *
 * ✅ 本次異動（2025/12/31）
 * - P｜義項狀態 icon 改版（與收藏按鈕風格一致，但不使用星星語意）
 *
 * ✅ 本次異動（2026/01/02）
 * - 修正 HTML 巢狀 <button> 警告（hydration error 風險）
 *
 * ✅ 本次異動（2026/01/02）
 * - R｜收藏切換安全包裝（避免「異常結束但資料未動」）
 *
 * ✅ 本次異動（2026/01/03）
 * - S｜義項狀態 UI 即時更新 + 顏色對齊收藏星星
 *
 * ✅ 本次異動（2026/01/03）
 * - T｜版型微調（WordLibraryPanel）
 *
 * ✅ 本次異動（2026/01/03）
 * - U｜icon 風格統一（亮/暗版）
 *
 * ✅ 本次異動（2026/01/03）
 * - V｜義項狀態 icon 顏色與倒讚造型修正（亮/暗版一致）
 *
 * ✅ 本次異動（2026/01/03）
 * - W｜👍 icon 風格統一：改為與 👎 同系列的拇指造型（只動 SVG path，不動任何互動/狀態邏輯）
 *
 * ✅ 本次異動（2026/01/03）
 * - X｜CSS/邏輯去重：把重複 selector 合併成單一權威版本
 *   1) 重複 selector 保留為 DEPRECATED 註解（不刪除，避免回溯困難）
 *   2) 實際生效 CSS 集中在「FINAL AUTHORITY」區塊（只剩一份）
 *   3) familiarity 切換邏輯集中到單一 helper，舊 function 保留為 wrapper（避免改動呼叫點）
 *
 * ※ 重要：不改收藏流程 / 不改後端 / 不改 API 行為
 * ※ 重要：保留舊渲染（deprecated）以利回溯，不移除既有 function，不合併 useEffect（本檔無 useEffect）
  * 
 * ✅ 本次異動（2026/01/03）
 * - Y｜熟悉度二元化（👍/👎 同時顯示、只能擇一；不再提供「－」按鈕）
 *   1) UI：兩顆按鈕永遠存在，點擊只會設定為 1 或 -1（不回到 0）
 *   2) 移除：🚫「排除/禁止出現」按鈕與互動（舊碼保留為 DEPRECATED、不渲染）
 *   3) 狀態：muted 透明度更淡（讓選中狀態更突出）

 * ✅ 本次異動（2026/01/04）
 * - Z｜多國：hover 提示字串改為只讀 uiText（本檔不允許自建多國 fallback）
 *   1) WordLibraryPanel 只會從 uiText[uiLang].app.libraryPanel 取字串
 *   2) 若 uiText 未注入或 key 缺漏：顯示空字串（避免 runtime error），但不在本檔自行翻譯
 *   3) 保留舊 fallback 內容為 DEPRECATED 註解（不參與 runtime），方便回溯
 * 
 * 
*/

// frontend/src/features/library/WordLibraryPanel.jsx

import React from "react";
import FavoriteStar from "../../components/common/FavoriteStar";

export default function WordLibraryPanel({
  libraryItems,
  onReview,

  // ✅ 由 App.jsx 注入：單字庫內可直接取消收藏
  onToggleFavorite,
  favoriteDisabled = false,

  // ✅ 多國：由外層注入（不強制）
  uiText,
  // uiLang = "zh-TW", // ✅ 允許本次異動註解：避免「參數層」寫死預設語系
  uiLang,

  // ✅ O｜新增：義項狀態更新（由外層接 API：POST /api/library）
  // - 若外層未注入：本檔維持「只顯示」不影響既有流程
  onUpdateSenseStatus,
}) {
  const canToggle = typeof onToggleFavorite === "function" && !favoriteDisabled;

  // ✅ O｜狀態更新能力（由外層注入）
  const canUpdateSenseStatus = typeof onUpdateSenseStatus === "function";

  // ✅ S｜義項狀態 UI 即時更新（前端覆蓋層，避免後端成功但 UI 未刷新）
  const [senseUiOverrides, setSenseUiOverrides] = React.useState(() => ({}));

  // ✅ S｜中文功能說明：產生義項 key（穩定且可讀）
  function getSenseKey(headword, canonicalPos, senseIndex) {
    const idx = senseIndex === null || typeof senseIndex === "undefined" ? 0 : senseIndex;
    return `${headword}__${canonicalPos}__${idx}`;
  }

  // ✅ S｜中文功能說明：讀取覆蓋層（若無則回傳 null）
  function getSenseOverride(headword, canonicalPos, senseIndex) {
    const key = getSenseKey(headword, canonicalPos, senseIndex);
    return (senseUiOverrides && senseUiOverrides[key]) || null;
  }

  // ✅ S｜中文功能說明：寫入覆蓋層（保留其它 key）
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

  // ✅ S｜Production 排查：初始化狀態補充（不覆寫既有 window.__wlPanelInit）
  try {
    if (typeof window !== "undefined" && window.__wlPanelInit) {
      window.__wlPanelInit.senseUiOverridesReady = true;
    }
  } catch (e) {
    // no-op
  }

  // ✅ effectiveLang：不在參數列寫死，但仍提供安全 fallback（避免 runtime error）
  const effectiveLang = uiLang || "zh-TW";

  // ✅ 多國集中在 uiText（WordLibraryPanel 不可自建多國；只能讀 uiText）
//
// ⚠️ 注意：
// - 本檔「不得內建字串對照表」當作多國系統
// - 若 uiText 未注入 / key 缺漏：允許回傳空字串或 undefined，但不得在本檔自行翻譯
// - 保留舊 fallback 內容為 DEPRECATED 註解（不參與 runtime），避免你回溯時找不到歷史脈絡
//
// ✅ Production 排查：初始化狀態（不覆寫既有 window.__wlPanelInit）
try {
  if (typeof window !== "undefined") {
    if (!window.__wlPanelInit) window.__wlPanelInit = {};
    if (!window.__wlPanelInit.i18n) window.__wlPanelInit.i18n = {};
    window.__wlPanelInit.i18n.wordLibraryPanelTextReady = true;
    window.__wlPanelInit.i18n.wordLibraryPanelLang = effectiveLang;
  }
} catch (e) {
  // no-op
}

// ✅ 中文功能說明：從 uiText 取出 libraryPanel 區塊（只讀，不自建）
function getLibraryPanelTextFromUiText(_uiText, _lang) {
  const lang = _lang || "zh-TW";
  const obj =
    (_uiText && _uiText[lang] && _uiText[lang].app && _uiText[lang].app.libraryPanel) ||
    (_uiText &&
      _uiText["zh-TW"] &&
      _uiText["zh-TW"].app &&
      _uiText["zh-TW"].app.libraryPanel) ||
    null;
  return obj;
}

// ✅ 最終文字來源（只能來自 uiText；缺漏時回傳空物件避免 runtime error）
const t = getLibraryPanelTextFromUiText(uiText, effectiveLang) || {};

// ------------------------------------------------------------------
// ❌ DEPRECATED：本檔內建多國 fallback（禁止使用）
// - 保留「舊內容」僅供回溯，不參與 runtime
// ------------------------------------------------------------------
//
// const __DEPRECATED_LOCAL_I18N_FALLBACK_DO_NOT_USE = {
//   subtitle: "只顯示原型（Lemma），不包含變化形",
//   countSuffix: "筆",
//   emptyLine1: "尚未收藏任何單字",
//   emptyLine2: "請到查詢頁點擊星號加入收藏",
//   cancelFavoriteTitle: "取消收藏",
//   cannotOperateTitle: "未登入時不可操作收藏",
//   lemmaLabel: "原型（Lemma）",
//   ariaFavorite: "我的最愛",
//   reviewTitle: "點選以原型回到查詢頁複習",
//   senseStatusTitle: "義項狀態（可點擊；需外層接入 onUpdateSenseStatus）",
//   glossEmpty: "—",
//   headwordButtonTitle: "點此回到查詢頁複習",
//   favoriteTitle: "收藏",
//   senseLikeTitle: "標記為熟悉（👍）",
//   senseDislikeTitle: "標記為不熟（👎）",
//   senseHideTitle: "切換隱藏（🚫）",
//   senseStatusDisabledTitle: "尚未接入狀態更新（僅顯示）",
// };
//
// ------------------------------------------------------------------

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
      (uiText &&
        uiText["zh-TW"] &&
        uiText["zh-TW"].wordCard &&
        uiText["zh-TW"].wordCard.posLocalNameMap) ||
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
    const v1 = pickRowField(row, "isExcluded", "is_excluded");
    if (v1 !== undefined && v1 !== null) return !!v1;

    const v2 = pickRowField(row, "isHidden", "is_hidden");
    if (v2 !== undefined && v2 !== null) return !!v2;

    return false;
  }

  function formatCircledNumber(idx0) {
    const circled = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];
    return circled[idx0] || `${idx0 + 1}`;
  }

  function inferSenseIndexBaseForGroup(rows) {
    const list = Array.isArray(rows) ? rows : [];
    let has0 = false;
    let has1 = false;
    for (let i = 0; i < list.length; i++) {
      const si = getSenseIndex(list[i]);
      if (si === 0) has0 = true;
      if (si === 1) has1 = true;
    }
    if (has0) return "zero";
    if (!has0 && has1) return "one";
    return "zero";
  }

  function getDisplayIdx0ForSenseRow(groupRows, senseIndex, ridx) {
    if (senseIndex === null || senseIndex === undefined) return ridx;
    const base = inferSenseIndexBaseForGroup(groupRows);
    if (base === "one") {
      const v = Number(senseIndex) - 1;
      return Number.isFinite(v) && v >= 0 ? v : ridx;
    }
    const v = Number(senseIndex);
    return Number.isFinite(v) && v >= 0 ? v : ridx;
  }

  function buildMergedGlossLineWithIndex(rows) {
    const seen = new Set();
    const list = [];

    (rows || []).forEach((r) => {
      const raw = getGloss(r);
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) return;
      if (seen.has(s)) return;
      seen.add(s);
      list.push(s);
    });

    if (list.length === 0) return "";

    const parts = list.map((text, idx0) => {
      const n = formatCircledNumber(idx0);
      return `${n}${text}`;
    });

    return parts.join(" ");
  }

  function buildGroupedItems(rows) {
    const map = new Map();

    (rows || []).forEach((row, i) => {
      const headword = row?.headword || "";
      const canonicalPos = row?.canonicalPos || row?.canonical_pos || "";
      const key = `${headword}::${canonicalPos}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          headword,
          canonicalPos,
          rows: [],
        });
      }
      map.get(key).rows.push(row);

      if (!headword && row && i === 0) {
        // no-op
      }
    });

    const grouped = Array.from(map.values());

    grouped.sort((a, b) => {
      const ah = (a.headword || "").localeCompare(b.headword || "");
      if (ah !== 0) return ah;
      return (a.canonicalPos || "").localeCompare(b.canonicalPos || "");
    });

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

  const groupedItems = buildGroupedItems(libraryItems);

  // =========================
  // ✅ Production 排查：初始化狀態（只寫一次）
  // =========================
  try {
    if (typeof window !== "undefined" && !window.__wlPanelInit) {
      window.__wlPanelInit = {
        at: new Date().toISOString(),
        version: "2025-12-19_B_grouped-ui",
        patch: "2025-12-23_F_card-not-button_headword-clickable",
        uiLang: effectiveLang,
        hasUiText: !!uiText,
        rawCount: Array.isArray(libraryItems) ? libraryItems.length : -1,
        groupedCount: Array.isArray(groupedItems) ? groupedItems.length : -1,
        senseIndexDisplayPatch: "2025-12-29_N_sense-index-base",
        canToggle,
        canUpdateSenseStatus,
        iconThemePatchV: "2026-01-03_V_icon-theme-fix",
        cssDedupPatchX: "2026-01-03_X_css-dedup-final-authority",
      };
    }
  } catch (e) {
    // no-op
  }

  // =========================
  // ✅ R｜收藏切換：安全包裝 + 最小 runtime log（Production 排查）
  // =========================
  function safeToggleFavorite(entry, meta) {
    try {
      if (typeof window !== "undefined" && !window.__wlFavToggleLog) {
        window.__wlFavToggleLog = { count: 0, last: null };
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
            console.error("[WordLibraryPanel] onToggleFavorite rejected", err, {
              entry,
              meta,
            });
          } catch (e) {
            // no-op
          }
        });
      }
    } catch (err) {
      try {
        console.error("[WordLibraryPanel] onToggleFavorite threw", err, {
          entry,
          meta,
        });
      } catch (e) {
        // no-op
      }
    }
  }

  function handleStarClick(e, headword, canonicalPos) {
    if (!e) {
      if (!canToggle) return;
      safeToggleFavorite({ headword, canonicalPos }, { source: "handleStarClick_noEvent" });
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (!canToggle) return;

    safeToggleFavorite({ headword, canonicalPos }, { source: "handleStarClick" });

    // DEPRECATED（保留舊呼叫方式，避免回溯困難；勿刪）
    // onToggleFavorite(headword, canonicalPos);
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
        if (
          typeof window !== "undefined" &&
          window.__wlPanelInit &&
          !window.__wlPanelInit.__statusNoHandlerLogged
        ) {
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
        if (Object.prototype.hasOwnProperty.call(payload, "familiarity")) {
          __patch.familiarity = payload.familiarity;
        }
        if (Object.prototype.hasOwnProperty.call(payload, "isHidden")) {
          __patch.isHidden = payload.isHidden;
        }

        if (Object.keys(__patch).length > 0) {
          setSenseOverride(payload.headword, payload.canonicalPos, __senseIndex, __patch);
          __didApplySenseOverride = true;
        }
      }
    } catch (err) {
      // no-op
    }

    try {
      const _maybePromise = onUpdateSenseStatus(payload);
      if (_maybePromise && typeof _maybePromise.then === "function" && typeof _maybePromise.catch === "function") {
        _maybePromise.catch((err) => {
          try {
            if (__didApplySenseOverride && payload && payload.headword && payload.canonicalPos) {
              const __senseIndex =
                typeof payload.senseIndex === "undefined" || payload.senseIndex === null ? 0 : payload.senseIndex;
              setSenseOverride(payload.headword, payload.canonicalPos, __senseIndex, __prevSenseOverride || {});
            }
          } catch (e) {
            // no-op
          }
          throw err;
        });
      }
      return _maybePromise;
    } catch (err) {
      try {
        if (__didApplySenseOverride && payload && payload.headword && payload.canonicalPos) {
          const __senseIndex =
            typeof payload.senseIndex === "undefined" || payload.senseIndex === null ? 0 : payload.senseIndex;
          setSenseOverride(payload.headword, payload.canonicalPos, __senseIndex, __prevSenseOverride || {});
        }
      } catch (e) {
        // no-op
      }
      throw err;
    }

    // DEPRECATED：舊行為（直接呼叫外層，不做 UI 覆蓋）—保留註解方便回溯
    // onUpdateSenseStatus(payload);
  }

  // =========================
  // ✅ X｜邏輯去重：familiarity 切換統一 helper（舊 function 保留 wrapper）
  // =========================

  /**
   * ✅ X｜中文功能說明（邏輯合併成一份）
   * - mode="toggleTarget"：原 nextFamiliarity(current,target) 行為（同值再點回 0）
   * - mode="cycle"：原 nextFamiliarityCycle(current) 行為（1→0→-1→循環）
   */
  function computeNextFamiliarity(current, mode, target) {
    const c = Number(current);
    const cur = Number.isFinite(c) ? c : 0;

    if (mode === "toggleTarget") {
      const t = Number(target);
      const tar = Number.isFinite(t) ? t : 0;
      if (cur === tar) return 0;
      return tar;
    }

    // mode === "cycle"（預設）
    if (cur === 1) return 0;
    if (cur === 0) return -1;
    return 1;
  }

  /**
   * ✅ DEPRECATED wrapper：保留舊介面（不改呼叫點）
   * - 目標值相同再點 → 回 0
   */
  function nextFamiliarity(current, target) {
    return computeNextFamiliarity(current, "toggleTarget", target);
  }

  /**
   * ✅ P｜DEPRECATED wrapper：保留舊介面（不改呼叫點）
   * - 👍 (1) → － (0) → 👎 (-1) → 循環
   */
  function nextFamiliarityCycle(current) {
    return computeNextFamiliarity(current, "cycle");
  }

  // =========================
  // ✅ P｜義項狀態 icon（SVG 線條風格）
  // =========================
  function SenseIconBase({ children, size = 16, title }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {children}
      </svg>
    );
  }

  function SenseIconThumbUp({ size = 16 }) {
    return (
      <SenseIconBase size={size}>
        <path d="M14 9V5a3 3 0 0 0-3-3L7 11v11h10.28a2 2 0 0 0 1.96-1.57l1.5-7A2 2 0 0 0 19.78 11H14z" />
        <path d="M7 22H4V11h3v11z" />
      </SenseIconBase>
    );
  }

  function SenseIconThumbDown({ size = 16 }) {
    return (
      <SenseIconBase size={size}>
        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V4H6.72a2 2 0 0 0-1.96 1.57L3 14v1h7z" />
        <path d="M22 14V6a2 2 0 0 0-2-2h-2v10h2a2 2 0 0 0 2-2z" />
      </SenseIconBase>
    );
  }

  function SenseIconMinus({ size = 16 }) {
    return (
      <SenseIconBase size={size}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8.2 12h7.6" />
      </SenseIconBase>
    );
  }

  function SenseIconBan({ size = 16, active }) {
    return (
      <SenseIconBase size={size}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8.2 8.2l7.6 7.6" />
      </SenseIconBase>
    );
  }

  function SenseIconExam({ size = 16 }) {
    return (
      <SenseIconBase size={size}>
        <path d="M12 3.2l6.6 6.6-4.2 4.2L12 21.2 9.6 14 5.4 9.8 12 3.2z" />
        <path d="M12 12.4v5.2" />
        <circle cx="12" cy="11.2" r="1.05" />
        <path d="M10.1 15.2h3.8" />
      </SenseIconBase>
    );
  }

  function SenseFamiliarityIcon({ value }) {
    if (value === 1) return <SenseIconThumbUp size={16} />;
    if (value === -1) return <SenseIconThumbDown size={16} />;
    return <SenseIconMinus size={16} />;
  }

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        padding: 14,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.02) 100%)",
        boxShadow:
          "0 10px 28px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.04) inset",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* ✅ Local styles (scrollbar / hover / focus) */}
      <style>{`
        /* ============================================================
           ✅ X｜CSS 去重策略（重要）
           - 本檔先前有多段重複 selector（例如 .wl-senseActionBtn / --muted / --active / .wl-senseStatus / .wl-posInline 等）
           - 造成「後段覆蓋前段」與「!important 最終保險層」互相打架，debug 很痛苦
           - 這裡改為：只保留一份 FINAL AUTHORITY（最後生效），其他重複段落不再存在（保留為註解）
           - 目標：功能/視覺維持現況（以原檔最後那層 !important 行為為準）
           ============================================================ */

        .wl-list {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.22) transparent;
        }
        .wl-list::-webkit-scrollbar {
          width: 10px;
        }
        .wl-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .wl-list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.16);
          border: 3px solid transparent;
          background-clip: content-box;
          border-radius: 999px;
        }
        .wl-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.24);
          border: 3px solid transparent;
          background-clip: content-box;
          border-radius: 999px;
        }

        .wl-item {
          transition: transform 120ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .wl-item:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.18);
          box-shadow: 0 10px 22px rgba(0,0,0,0.20);
          transform: translateY(-1px);
        }
        .wl-item:active {
          transform: translateY(0px);
          box-shadow: 0 6px 14px rgba(0,0,0,0.18);
        }
        /* DEPRECATED：wl-item 由 button 改為 div，focus-visible 先保留（不刪） */
        .wl-item:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.16), 0 10px 22px rgba(0,0,0,0.20);
        }

        .wl-starBtn {
          transition: transform 120ms ease, opacity 160ms ease;
          display: inline-flex;
        }
        .wl-starBtn:hover {
          transform: scale(1.06);
        }
        .wl-starBtn:active {
          transform: scale(0.98);
        }
        .wl-starBtn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.14);
          border-radius: 10px;
        }

        /* ✅ M｜單一收藏按鈕（星星 + 文字） */
        .wl-favBtn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: 1px solid rgba(255,255,255,0.04);
          background: rgba(255,255,255,0.01);
          padding: 8px 10px;
          margin: 0;
          border-radius: 12px;
          user-select: none;
          transition: transform 80ms ease, opacity 80ms ease, background 100ms ease, border-color 100ms ease;
          min-width: var(--wl-rightActionWidth, 64px);
          justify-content: flex-end;
        }
        .wl-favBtn:hover {
          transform: scale(1.04);
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.16);
        }
        .wl-favBtn:active {
          transform: scale(0.98);
        }
        .wl-favBtn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.14);
        }
        .wl-favBtn[disabled] {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .wl-favText {
          font-size: 12px;
          opacity: 0;
          transform: translateY(1px);
          transition: opacity 60ms ease, transform 60ms ease;
          white-space: nowrap;
        }
        .wl-favBtn:hover .wl-favText {
          opacity: 0.92;
          transform: translateY(0px);
        }

        .wl-headwordBtn {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          cursor: pointer;
          font: inherit;
          color: inherit;
          text-align: left;
          display: inline-block;
          max-width: 100%;
        }
        /* DEPRECATED 2026/01/03: stray '}' caused CSS parsing issues; kept as comment to avoid line shift */

        /* ✅ 2026/01/03：headword + pos 併排容器 */
        .wl-headwordLine {
          display: flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
        }

        /* ✅ 義項清單：行距與排版（密度調整） */
        .wl-senseRow {
          display: flex;
          align-items: center;
          gap: 8px;
          line-height: 1.08;
        }
        .wl-senseIdx {
          flex: 0 0 auto;
          font-size: 12px;
          opacity: 0.82;
          padding-top: 0px;
        }
        .wl-senseGloss {
          flex: 1 1 auto;
          font-size: 16px;
          opacity: 0.86;
          word-break: break-word;
          line-height: 0; /* ✅ 保持現況（你目前視覺就是靠它） */
        }

        /* ✅ O｜狀態按鈕（最小、無樣式） */
        .wl-senseStatusBtn {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          cursor: pointer;
          font: inherit;
          color: inherit;
          line-height: 1;
          opacity: 0.9;
        }
        .wl-senseStatusBtn[disabled] {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .wl-senseStatusBtn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.12);
          border-radius: 8px;
        }

        /* ============================================================
           ✅ FINAL AUTHORITY（唯一生效版本）
           - 下方是去重後的 .wl-posInline / .wl-senseStatus / .wl-senseActionBtn 全套規則
           - 你原檔中重複出現的 selector（以及中間的 theme 覆蓋/保險層）已合併到這裡
           - 行為以原檔「最後 !important 保險層」為準 → 目前 muted 會非常淡（opacity 0.1）
           ============================================================ */

        /* ✅ 詞性 badge：合併後只留一份（含 light/dark 容錯） */
        .wl-posInline {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          padding: 2px 6px;
          border-radius: 999px;
          max-width: 140px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          /* ✅ 以你現有最終覆蓋為準（保留 !important 行為） */
          font-size: 11px !important;
          opacity: 0.78 !important;

          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.72);
        }
        :root[data-theme="light"] .wl-posInline,
        body[data-theme="light"] .wl-posInline,
        body.light .wl-posInline,
        .light .wl-posInline,
        .theme-light .wl-posInline,
        .t-light .wl-posInline {
          color: rgba(0,0,0,0.58) !important;
          border-color: rgba(0,0,0,0.12) !important;
          background: rgba(0,0,0,0.04) !important;
        }
        :root[data-theme="dark"] .wl-posInline,
        body[data-theme="dark"] .wl-posInline,
        body.dark .wl-posInline,
        .dark .wl-posInline,
        .theme-dark .wl-posInline,
        .t-dark .wl-posInline {
          color: rgba(255,255,255,0.72) !important;
          border-color: rgba(255,255,255,0.10) !important;
          background: rgba(255,255,255,0.03) !important;
        }

        /* ✅ 狀態區：合併後只留一份（你原本有兩次 gap/對齊設定） */
        .wl-senseStatus {
          flex: 0 0 auto;
          font-size: 12px;
          opacity: 0.9;
          display: inline-flex;
          align-items: center;

          /* ✅ 以你原本後段設定為準（更緊 + 右側對齊槽位） */
          gap: 3px;
          min-width: var(--wl-rightActionWidth, 64px);
          justify-content: flex-end;
        }

        /* ✅ icon 顏色一律吃 currentColor（合併重複 .wl-senseActionBtn svg 規則） */
        .wl-senseActionBtn svg {
          display: block;
          color: inherit;
          stroke: currentColor !important;
          fill: none !important;
        }

        /* ✅ 義項狀態按鈕：合併後只留一份（含 theme + prefers-color-scheme + 最終保險） */
        .wl-senseActionBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 5px 6px;
          margin: 0;
          border-radius: 12px;
          user-select: none;
          transition: transform 80ms ease, opacity 80ms ease, background 100ms ease, border-color 100ms ease;

          border: 1px solid rgba(255,255,255,0.04);
          background: rgba(255,255,255,0.01);

          /* ✅ 最終保險：用全域文字色變數（你原檔最後層行為） */
          color: var(--text-main, var(--text-color, rgba(255,255,255,0.92))) !important;
        }
        .wl-senseActionBtn:hover {
          transform: scale(1.04);
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.16);
        }
        .wl-senseActionBtn:active {
          transform: scale(0.98);
        }
        .wl-senseActionBtn[disabled] {
          cursor: not-allowed;
          opacity: 0.45;
        }

        /* ✅ 狀態：active/muted（合併重複定義，並以最終保險層行為為準） */
        .wl-senseActionBtn--active {
          opacity: 1;
        }
        .wl-senseActionBtn--muted {
          color: inherit !important;
          opacity: 0.1; /* ✅ 你目前的最終效果：muted 很淡 */
        }

        /* ✅ active：非 exclude 才吃 accent；exclude 維持中性（你原檔最終保險層） */
        .wl-senseActionBtn--active:not([data-kind="exclude"]) {
          color: var(--accent) !important;
          opacity: 1;
        }
        .wl-senseActionBtn--active[data-kind="exclude"] {
          color: var(--text-main, var(--text-color, rgba(255,255,255,0.92))) !important;
          opacity: 1;
        }

        /* ✅ prefers-color-scheme fallback（合併後保留，以避免 theme selector 沒命中） */
        @media (prefers-color-scheme: light) {
          .wl-senseActionBtn {
            color: var(--text-main, var(--text-color, rgba(0,0,0,0.82))) !important;
            border-color: rgba(0,0,0,0.10);
            background: rgba(0,0,0,0.03);
          }
          .wl-senseActionBtn:hover {
            background: rgba(0,0,0,0.06);
            border-color: rgba(0,0,0,0.16);
          }
          .wl-senseActionBtn--muted {
            opacity: 0.1;
          }
          .wl-senseActionBtn--active:not([data-kind="exclude"]) {
            color: var(--accent) !important;
            opacity: 1;
          }
          .wl-senseActionBtn--active[data-kind="exclude"] {
            color: var(--text-main, var(--text-color, rgba(0,0,0,0.82))) !important;
            opacity: 1;
          }
        }

        @media (prefers-color-scheme: dark) {
          .wl-senseActionBtn--active[data-kind="exclude"] {
            color: var(--text-main, var(--text-color, rgba(255,255,255,0.92))) !important;
            opacity: 1;
          }
        }


        /* ✅ 2026/01/03：未選到（muted）再淡一點，讓「已選到」更突出
           - 說明：兩顆按鈕同時顯示時，未選狀態用較低 opacity 表現
           - 注意：只調整透明度，不改 stroke / fill，避免亮暗版跑色
        */
        .wl-senseActionBtn--muted {
          opacity: 0.28 !important;
        }

        /* ✅ 2026/01/03：去除「muted 用 opacity」造成的合成層閃爍（最小侵入：只做最後覆蓋）
           - 問題：muted/active 切換時 opacity 變化，搭配 :active / hover / transition，容易出現一幀閃爍
           - 解法：muted 不再用 opacity 來淡化，而是用 color / border / background 的 alpha 來淡化；opacity 固定 1
           - 注意：這是「最終覆蓋層」，不移除上方舊規則（避免行數減少 + 方便回溯）
        */
        .wl-senseActionBtn--muted {
          opacity: 1 !important; /* ✅ 關鍵：避免 opacity transition/合成層閃爍 */
        }
        .wl-senseActionBtn--muted svg {
          stroke-opacity: 0.28 !important; /* ✅ 線條更淡，但不動整顆 opacity */
        }

        /* ✅ 亮/暗版分開指定 muted 的顏色（用 alpha 淡化） */
        :root[data-theme="light"] .wl-senseActionBtn--muted,
        body[data-theme="light"] .wl-senseActionBtn--muted,
        body.light .wl-senseActionBtn--muted,
        .light .wl-senseActionBtn--muted,
        .theme-light .wl-senseActionBtn--muted,
        .t-light .wl-senseActionBtn--muted {
          color: rgba(0,0,0,0.38) !important;
          border-color: rgba(0,0,0,0.08) !important;
          background: rgba(0,0,0,0.00) !important;
        }
        :root[data-theme="dark"] .wl-senseActionBtn--muted,
        body[data-theme="dark"] .wl-senseActionBtn--muted,
        body.dark .wl-senseActionBtn--muted,
        .dark .wl-senseActionBtn--muted,
        .theme-dark .wl-senseActionBtn--muted,
        .t-dark .wl-senseActionBtn--muted {
          color: rgba(255,255,255,0.38) !important;
          border-color: rgba(255,255,255,0.10) !important;
          background: rgba(255,255,255,0.00) !important;
        }

        /* ✅ prefers-color-scheme fallback：theme selector 沒命中時仍維持不閃爍 */
        @media (prefers-color-scheme: light) {
          .wl-senseActionBtn--muted {
            opacity: 1 !important;
            color: rgba(0,0,0,0.38) !important;
            border-color: rgba(0,0,0,0.08) !important;
            background: rgba(0,0,0,0.00) !important;
          }
          .wl-senseActionBtn--muted svg {
            stroke-opacity: 0.28 !important;
          }
        }
        @media (prefers-color-scheme: dark) {
          .wl-senseActionBtn--muted {
            opacity: 1 !important;
            color: rgba(255,255,255,0.38) !important;
            border-color: rgba(255,255,255,0.10) !important;
            background: rgba(255,255,255,0.00) !important;
          }
          .wl-senseActionBtn--muted svg {
            stroke-opacity: 0.28 !important;
          }
        }


        /* ✅ headword 下方單行釋義摘要 */
        .wl-glossLine {
          font-size: 12px;
          opacity: 0.74;
          margin-top: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ============================================================
           DEPRECATED（CSS 舊重複段落）：
           - 已被合併到 FINAL AUTHORITY，上線行為不再受它們影響
           - 如果你要回溯，從 Git 歷史看即可；這裡不再保留重複 selector（避免繼續打架）
           ============================================================ */
      

        /* ✅ 2026/01/03：依需求「讚 / 倒讚」不要外匡（不顯示圓框/邊框/底色）
           - 說明：wl-senseActionBtn 原本是「icon button」樣式，含 border/background
           - 需求：讚/倒讚只保留圖示本體 + 顏色（active accent / muted 透明）
           - 作法：用 !important 在 style 末段覆蓋，避免被前面規則與 theme 覆寫
        */
        .wl-senseActionBtn {
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          /* ✅ 保留點擊手感（不改 layout） */
        }
        .wl-senseActionBtn:hover {
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .wl-senseActionBtn:active {
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .wl-senseActionBtn:focus-visible {
          /* ✅ 依需求不顯示外匡；若要恢復可改回 box-shadow */
          outline: none !important;
          box-shadow: none !important;
        }

`}</style>

      {/* Header（只保留一層：外層標題即可） */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        {false && (
          <div
            style={{
              fontSize: 13,
              opacity: 0.68,
              lineHeight: 1.15,
              paddingTop: 0,
            }}
          >
            {t.subtitle}
          </div>
        )}

        <div
          style={{
            fontSize: 12,
            opacity: 0.7,
            padding: "5px 9px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            flexShrink: 0,
          }}
        >
          {groupedItems.length > 0 ? `${groupedItems.length} ${t.countSuffix}` : ""}
        </div>
      </div>

      {libraryItems.length === 0 ? (
        <div
          style={{
            opacity: 0.78,
            fontSize: 13,
            lineHeight: 1.65,
            padding: "10px 2px",
          }}
        >
          {t.emptyLine1}
          <br />
          {t.emptyLine2}
        </div>
      ) : (
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
            const favAria = canToggle ? favText : t.cannotOperateTitle;

            return (
              <div
                key={`${g.headword}__${g.canonicalPos}__group__${gidx}`}
                className="wl-item"
                style={{
                  textAlign: "left",
                  padding: "6px 14px",
                  borderRadius: 16,
                  minHeight: "auto",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.10)",
                  cursor: "default",
                }}
                title=""
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="wl-headwordLine">
                      <button
                        type="button"
                        className="wl-headwordBtn"
                        onClick={(e) => handleHeadwordClick(e, g.headword)}
                        title={t.headwordButtonTitle || t.reviewTitle}
                        style={{
                          fontSize: 16,
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

                    {false && (
                      <div style={{ fontSize: 12, opacity: 0.62, marginTop: 4 }}>
                        {t.lemmaLabel}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    {false && (
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.72,
                          padding: "3px 7px",
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.03)",
                          maxWidth: 140,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={g.canonicalPos || ""}
                      >
                        {posDisplay || ""}
                      </div>
                    )}

                    <div
                      role="button"
                      className="wl-favBtn"
                      aria-disabled={!canToggle}
                      data-disabled={!canToggle ? "1" : "0"}
                      tabIndex={canToggle ? 0 : -1}
                      aria-label={favAria}
                      onClick={(e) => {
                        if (!canToggle) {
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }
                        handleStarClick(e, g.headword, g.canonicalPos);
                      }}
                      onKeyDown={(e) => {
                        if (!canToggle) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleStarClick(e, g.headword, g.canonicalPos);
                        }
                      }}
                      style={{}}
                    >
                      <span className="wl-favText">{favText}</span>

                      <FavoriteStar
                        active={isFavorited}
                        disabled={!canToggle}
                        onClick={(e) => handleStarClick(e, g.headword, g.canonicalPos)}
                        size={16}
                        ariaLabel={t.ariaFavorite}
                        title={undefined}
                      />
                    </div>

                    {false && (
                      <span
                        role="button"
                        aria-label={t.ariaFavorite}
                        title={canToggle ? t.cancelFavoriteTitle : t.cannotOperateTitle}
                        tabIndex={-1}
                        onClick={(e) => handleStarClick(e, g.headword, g.canonicalPos)}
                        className="wl-starBtn"
                        style={{
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.03)",
                          padding: "8px 10px",
                          margin: 0,
                          cursor: canToggle ? "pointer" : "not-allowed",
                          opacity: canToggle ? 1 : 0.45,
                          alignItems: "center",
                          borderRadius: 12,
                          userSelect: "none",
                        }}
                      >
                        <FavoriteStar
                          active={true}
                          disabled={!canToggle}
                          onClick={(e) => handleStarClick(e, g.headword, g.canonicalPos)}
                          size={16}
                          ariaLabel={t.ariaFavorite}
                        />
                      </span>
                    )}
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
                >
                  {g.rows.map((row, ridx) => {
                    const senseIndex = getSenseIndex(row);
                    const gloss = getGloss(row);
                    const familiarity = getFamiliarity(row);
                    const isExcluded = getIsExcluded(row);

                    const __override = getSenseOverride(
                      g.headword,
                      g.canonicalPos,
                      senseIndex === null ? 0 : senseIndex
                    );
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
                        <div className="wl-senseGloss">{gloss ? gloss : (t.glossEmpty || "—")}</div>

                        <div
                          className="wl-senseStatus"
                          title={canUpdateSenseStatus ? t.senseStatusTitle : t.senseStatusDisabledTitle}
                        >


                          {/* ✅ 2026/01/03：方案 A｜二元熟悉度（永遠顯示 👍 / 👎，只能選一個狀態；不再提供「－」按鈕） */}

                          <button

                            type="button"

                            data-kind="familiarity-up"

                            className={`wl-senseActionBtn ${familiarityEffective === 1 ? "wl-senseActionBtn--active" : "wl-senseActionBtn--muted"}`}

                            disabled={!canUpdateSenseStatus}

                            aria-label={t.senseLikeTitle}

                            // DEPRECATED 2026/01/04: hardcoded zh aria-label removed: "標記為熟悉（👍）" 

                            title={t.senseLikeTitle}

                            // DEPRECATED 2026/01/04: hardcoded zh title removed: "標記為熟悉（👍）" 

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

                            // DEPRECATED 2026/01/04: hardcoded zh aria-label removed: "標記為不熟悉（👎）" 

                            title={t.senseDislikeTitle}

                            // DEPRECATED 2026/01/04: hardcoded zh title removed: "標記為不熟悉（👎）" 

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


                          {/* DEPRECATED 2026/01/03：舊版（三態循環熟悉度 + 🚫 排除/測驗）先保留原碼供對照，但不再渲染 */}

                          {false && (

                            <>

                          <button
                            type="button"
                            data-kind="familiarity"
                            className={`wl-senseActionBtn ${
                              familiarityEffective === 1 || familiarityEffective === -1
                                ? "wl-senseActionBtn--active"
                                : "wl-senseActionBtn--muted"
                            }`}
                            disabled={!canUpdateSenseStatus}
                            aria-label="切換熟悉度（👍 → － → 👎）"
                            title="切換熟悉度（👍 → － → 👎）"
                            onClick={(e) =>
                              handleUpdateSenseStatus(e, {
                                headword: g.headword,
                                canonicalPos: g.canonicalPos,
                                senseIndex: senseIndex === null ? 0 : senseIndex,
                                familiarity: nextFamiliarityCycle(familiarityEffective),
                                _sampleLog: sampleLog,
                              })
                            }
                          >
                            <SenseFamiliarityIcon value={familiarityEffective} />
                          </button>

                          <button
                            type="button"
                            data-kind="exclude"
                            className={`wl-senseActionBtn ${
                              isExcludedEffective ? "wl-senseActionBtn--active" : "wl-senseActionBtn--muted"
                            }`}
                            disabled={!canUpdateSenseStatus}
                            aria-label={t.senseHideTitle}
                            title={t.senseHideTitle}
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
                            {isExcludedEffective ? (
                              <SenseIconBan size={16} active={true} />
                            ) : (
                              <SenseIconExam size={16} />
                            )}
                          </button>

                            </>

                          )}


                          {false && (
                            <>
                              <button
                                type="button"
                                className="wl-senseStatusBtn"
                                disabled={!canUpdateSenseStatus}
                                aria-label={t.senseLikeTitle}
                                title={t.senseLikeTitle}
                                onClick={(e) =>
                                  handleUpdateSenseStatus(e, {
                                    headword: g.headword,
                                    canonicalPos: g.canonicalPos,
                                    senseIndex: senseIndex === null ? 0 : senseIndex,
                                    familiarity: nextFamiliarity(familiarity, 1),
                                    _sampleLog: sampleLog,
                                  })
                                }
                              >
                                {familiarity === 1 ? <span>👍</span> : <span style={{ opacity: 0.55 }}>👍</span>}
                              </button>

                              <button
                                type="button"
                                className="wl-senseStatusBtn"
                                disabled={!canUpdateSenseStatus}
                                aria-label={t.senseDislikeTitle}
                                title={t.senseDislikeTitle}
                                onClick={(e) =>
                                  handleUpdateSenseStatus(e, {
                                    headword: g.headword,
                                    canonicalPos: g.canonicalPos,
                                    senseIndex: senseIndex === null ? 0 : senseIndex,
                                    familiarity: nextFamiliarity(familiarity, -1),
                                    _sampleLog: sampleLog,
                                  })
                                }
                              >
                                {familiarity === -1 ? <span>👎</span> : <span style={{ opacity: 0.55 }}>👎</span>}
                              </button>

                              <button
                                type="button"
                                className="wl-senseStatusBtn"
                                disabled={!canUpdateSenseStatus}
                                aria-label={t.senseHideTitle}
                                title={t.senseHideTitle}
                                onClick={(e) =>
                                  handleUpdateSenseStatus(e, {
                                    headword: g.headword,
                                    canonicalPos: g.canonicalPos,
                                    senseIndex: senseIndex === null ? 0 : senseIndex,
                                    isHidden: !isExcluded,
                                    _sampleLog: sampleLog,
                                  })
                                }
                              >
                                {isExcluded ? <span>🚫</span> : <span style={{ opacity: 0.55 }}>🚫</span>}
                              </button>
                            </>
                          )}

                          {false && (
                            <>
                              {familiarity === 1 ? <span>👍</span> : null}
                              {familiarity === -1 ? <span>👎</span> : null}
                              {isExcluded ? <span>🚫</span> : null}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {false && (
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.62,
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.20)",
                        display: "inline-block",
                      }}
                    />
                    <span>
                      {(() => {
                        const firstCreatedAt =
                          (g.rows && g.rows[0] && (g.rows[0].createdAt || g.rows[0].created_at)) || "";
                        return firstCreatedAt
                          ? new Date(firstCreatedAt).toISOString().slice(0, 10).replaceAll("-", "/")
                          : "";
                      })()}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {false &&
            libraryItems.map((it, idx) => (
              <button
                key={`${it.headword}__${it.canonicalPos}__${it.createdAt || idx}`}
                type="button"
                onClick={() => onReview(it.headword)}
                className="wl-item"
                style={{
                  textAlign: "left",
                  padding: "18px 18px",
                  borderRadius: 18,
                  minHeight: 88,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.10)",
                  cursor: "pointer",
                }}
                title={t.reviewTitle}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 850,
                        letterSpacing: 0.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.headword}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.62, marginTop: 6 }}>{t.lemmaLabel}</div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.72,
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.03)",
                        maxWidth: 160,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={it.canonicalPos || ""}
                    >
                      {getPosDisplayName(it.canonicalPos || "") || ""}
                    </div>

                    {false && (
                      <button
                        type="button"
                        disabled={!canToggle}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!canToggle) return;
                          onToggleFavorite(it.headword, it.canonicalPos);
                        }}
                        title={canToggle ? t.cancelFavoriteTitle : t.cannotOperateTitle}
                        className="wl-starBtn"
                        style={{
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.03)",
                          padding: "10px 12px",
                          margin: 0,
                          cursor: canToggle ? "pointer" : "not-allowed",
                          opacity: canToggle ? 1 : 0.45,
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: 14,
                        }}
                      >
                        <FavoriteStar
                          active={true}
                          disabled={!canToggle}
                          onClick={(e) => handleStarClick(e, it.headword, it.canonicalPos)}
                          size={18}
                          ariaLabel={t.ariaFavorite}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {false && (
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.62,
                      marginTop: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.20)",
                        display: "inline-block",
                      }}
                    />
                    <span>
                      {it.createdAt
                        ? new Date(it.createdAt).toISOString().slice(0, 10).replaceAll("-", "/")
                        : ""}
                    </span>
                  </div>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
// frontend/src/features/library/WordLibraryPanel.jsx
