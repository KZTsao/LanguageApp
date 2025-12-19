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
 * 🔎 Production 排查：功能初始化狀態
 * - 會寫入 window.__wlPanelInit（僅首次，避免污染）
 *
 * ※ 重要：不改收藏流程 / 不改後端 / 不改 API 行為
 * ※ 重要：保留舊渲染（deprecated）以利回溯，不移除既有 function，不合併 useEffect（本檔無 useEffect）
 */

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
}) {
  const canToggle = typeof onToggleFavorite === "function" && !favoriteDisabled;

  // ✅ effectiveLang：不在參數列寫死，但仍提供安全 fallback（避免 runtime error）
  const effectiveLang = uiLang || "zh-TW";

  // ✅ 多國集中在 uiText（沒注入時提供 fallback，避免 runtime error）
  const t =
    (uiText &&
      uiText[effectiveLang] &&
      uiText[effectiveLang].app &&
      uiText[effectiveLang].app.libraryPanel) ||
    (uiText &&
      uiText["zh-TW"] &&
      uiText["zh-TW"].app &&
      uiText["zh-TW"].app.libraryPanel) || {
      subtitle: "只顯示原型（Lemma），不包含變化形",
      countSuffix: "筆",
      emptyLine1: "尚未收藏任何單字",
      emptyLine2: "請到查詢頁點擊星號加入收藏",
      cancelFavoriteTitle: "取消收藏",
      cannotOperateTitle: "未登入時不可操作收藏",
      lemmaLabel: "原型（Lemma）",
      ariaFavorite: "我的最愛",
      // ✅ 新增：避免外層沒提供 uiText 時，本檔仍可運作
      reviewTitle: "點選以原型回到查詢頁複習",
      senseStatusTitle: "義項狀態（僅顯示；操作於後續 D 版接入）",
    };

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

    // ✅ 找不到 mapping → 顯示原始資料（通常是 "Nomen"/"Adverb" 或 "Noun"/"Adverb"）
    return p;
  }

  // =========================
  // ✅ B｜單字庫 UI（合併呈現）
  // - libraryItems(raw rows) -> groupedItems
  // - group key：headword + "::" + canonicalPos
  // - group 內依 sense_index ASC 排序
  // =========================

  /**
   * 取得 row 欄位（兼容 snake_case / camelCase）
   * ※ 只在本檔做 fallback，避免牽動其他檔案
   */
  function pickRowField(row, camelKey, snakeKey) {
    if (!row) return undefined;
    if (row[camelKey] !== undefined && row[camelKey] !== null) return row[camelKey];
    if (row[snakeKey] !== undefined && row[snakeKey] !== null) return row[snakeKey];
    return undefined;
  }

  /** sense_index：排序 + 顯示 ①②… */
  function getSenseIndex(row) {
    const v = pickRowField(row, "senseIndex", "sense_index");
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /** headword_gloss：空則顯示 — */
  function getGloss(row) {
    const v = pickRowField(row, "headwordGloss", "headword_gloss");
    return typeof v === "string" ? v : "";
  }

  /** familiarity：-1 / 0 / 1 */
  function getFamiliarity(row) {
    const v = pickRowField(row, "familiarity", "familiarity");
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** is_excluded：true/false */
  function getIsExcluded(row) {
    const v = pickRowField(row, "isExcluded", "is_excluded");
    return !!v;
  }

  /** ①②③…（不足時回退為 (index+1)） */
  function formatCircledNumber(idx0) {
    const circled = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];
    return circled[idx0] || `${idx0 + 1}.`;
  }

  /**
   * 分組：同 headword + canonicalPos 合併
   * - 以 array 回傳，供 render 使用
   */
  function buildGroupedItems(rows) {
    const map = new Map();

    (rows || []).forEach((row, i) => {
      const headword = row?.headword || "";
      const canonicalPos = row?.canonicalPos || row?.canonical_pos || ""; // 兼容 snake_case
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

      // ✅ 防呆：避免極端情況 row 為 null 導致整組掛掉
      if (!headword && row && i === 0) {
        // no-op
      }
    });

    const grouped = Array.from(map.values());

    // ✅ 排序：群組排序（先 headword 再 canonicalPos）
    grouped.sort((a, b) => {
      const ah = (a.headword || "").localeCompare(b.headword || "");
      if (ah !== 0) return ah;
      return (a.canonicalPos || "").localeCompare(b.canonicalPos || "");
    });

    // ✅ 義項排序：sense_index ASC（沒有 sense_index 放最後）
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

  // ✅ groupedItems：UI 合併呈現用
  const groupedItems = buildGroupedItems(libraryItems);

  // =========================
  // ✅ Production 排查：初始化狀態（只寫一次）
  // =========================
  try {
    if (typeof window !== "undefined" && !window.__wlPanelInit) {
      window.__wlPanelInit = {
        at: new Date().toISOString(),
        version: "2025-12-19_B_grouped-ui",
        uiLang: effectiveLang, // ✅ 不再直接用 uiLang（可能為 undefined）
        hasUiText: !!uiText,
        rawCount: Array.isArray(libraryItems) ? libraryItems.length : -1,
        groupedCount: Array.isArray(groupedItems) ? groupedItems.length : -1,
        canToggle,
      };
    }
  } catch (e) {
    // no-op：避免任何環境差異造成 runtime error
  }

  /**
   * ⭐ 星星控制（避免巢狀 button）
   * - 外層字卡是 <button>
   * - 內層星星不能再用 <button>，否則瀏覽器會自動修正 DOM，造成視覺錯位/重疊
   * - 用 <span role="button"> 保留可點、可阻止冒泡
   */
  function handleStarClick(e, headword, canonicalPos) {
    if (!e) return;
    e.preventDefault();
    e.stopPropagation();
    if (!canToggle) return;
    onToggleFavorite(headword, canonicalPos);
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

        /* ✅ 義項清單：行距與排版（密度調整） */
        .wl-senseRow {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.3;
        }
        .wl-senseIdx {
          flex: 0 0 auto;
          font-size: 12px;
          opacity: 0.82;
          padding-top: 1px;
        }
        .wl-senseGloss {
          flex: 1 1 auto;
          font-size: 12px;
          opacity: 0.84;
          word-break: break-word;
        }
        .wl-senseStatus {
          flex: 0 0 auto;
          font-size: 12px;
          opacity: 0.9;
          display: inline-flex;
          gap: 6px;
          align-items: center;
        }
      `}</style>

      {/* Header（只保留一層：外層標題即可） */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10, // ✅ 密度調整：更緊湊
        }}
      >
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
          {/* ✅ UI 合併後，以「字級卡片數」為準 */}
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
            gap: 8, // ✅ 密度調整：間距更小
            maxHeight: "calc(72vh - 32px)",
            overflowY: "auto",
            overscrollBehavior: "contain",
            paddingRight: 2,
            paddingTop: 0,
            paddingBottom: 0,
          }}
        >
          {/* ✅ 新版：groupedItems（合併呈現：一張卡 + 多個義項） */}
          {groupedItems.map((g, gidx) => {
            const posDisplay = getPosDisplayName(g.canonicalPos || "");
            return (
              <button
                key={`${g.headword}__${g.canonicalPos}__group__${gidx}`}
                type="button"
                onClick={() => onReview(g.headword)}
                className="wl-item"
                style={{
                  textAlign: "left",
                  padding: "12px 14px", // ✅ 變薄（原 18px 18px）
                  borderRadius: 16,
                  minHeight: 64, // ✅ 變薄（原 88）
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
                    gap: 10, // ✅ 更緊湊
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 16, // ✅ 小一點（原 18）
                        fontWeight: 850,
                        letterSpacing: 0.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {g.headword}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.62, marginTop: 4 }}>
                      {t.lemmaLabel}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8, // ✅ 更緊湊
                      flexShrink: 0,
                    }}
                  >
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

                    {/* ⭐ 星星（字級）：取消收藏（刪除該 headword + canonicalPos 的所有 rows）
                        ✅ 改用 span(role=button) 避免 <button> 內巢狀 <button> */}
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
                        padding: "8px 10px", // ✅ 變薄（原 10px 12px）
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
                        onClick={() => {}}
                        size={16}
                        ariaLabel={t.ariaFavorite}
                      />
                    </span>
                  </div>
                </div>

                {/* ✅ 義項清單（依 sense_index ASC） */}
                <div
                  style={{
                    marginTop: 8, // ✅ 變薄
                    paddingTop: 8, // ✅ 變薄
                    borderTop: "1px solid rgba(255,255,255,0.10)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6, // ✅ 變薄
                  }}
                >
                  {g.rows.map((row, ridx) => {
                    const senseIndex = getSenseIndex(row);
                    const gloss = getGloss(row);
                    const familiarity = getFamiliarity(row);
                    const isExcluded = getIsExcluded(row);

                    // ✅ 顯示序號：優先用 sense_index（從 0/1 皆可），沒有就用 ridx
                    const idx0 =
                      senseIndex === null
                        ? ridx
                        : senseIndex >= 1
                        ? senseIndex - 1
                        : senseIndex;

                    return (
                      <div key={`sense__${ridx}`} className="wl-senseRow">
                        <div className="wl-senseIdx">{formatCircledNumber(idx0)}</div>
                        <div className="wl-senseGloss">{gloss ? gloss : "—"}</div>
                        <div className="wl-senseStatus" title={t.senseStatusTitle}>
                          {familiarity === 1 ? <span>👍</span> : null}
                          {familiarity === -1 ? <span>👎</span> : null}
                          {isExcluded ? <span>🚫</span> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ✅ 日期：你已要求不需要（保留原碼但不渲染） */}
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
                          (g.rows && g.rows[0] && (g.rows[0].createdAt || g.rows[0].created_at)) ||
                          "";
                        return firstCreatedAt
                          ? new Date(firstCreatedAt)
                              .toISOString()
                              .slice(0, 10)
                              .replaceAll("-", "/")
                          : "";
                      })()}
                    </span>
                  </div>
                )}
              </button>
            );
          })}

          {/* ============================================================
             DEPRECATED（保留舊渲染邏輯，避免退版時難回溯）
             - 舊版：libraryItems.map(row -> 一張卡
             - 目前已改為 groupedItems.map(group -> 一張卡 + 義項清單
             - 不移除，只停用（false && ...）
             ============================================================ */}
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
                    <div style={{ fontSize: 13, opacity: 0.62, marginTop: 6 }}>
                      {t.lemmaLabel}
                    </div>
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

                    {/* ⭐ 旧版星星按鈕（保留不渲染） */}
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
                          onClick={() => {}}
                          size={18}
                          ariaLabel={t.ariaFavorite}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {/* ✅ 日期：你已要求不需要（保留原碼但不渲染） */}
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
                        ? new Date(it.createdAt)
                            .toISOString()
                            .slice(0, 10)
                            .replaceAll("-", "/")
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
