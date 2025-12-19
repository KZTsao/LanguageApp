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
  uiLang = "zh-TW",
}) {
  const canToggle = typeof onToggleFavorite === "function" && !favoriteDisabled;

  // ✅ 多國集中在 uiText（沒注入時提供 fallback，避免 runtime error）
  const t =
    (uiText &&
      uiText[uiLang] &&
      uiText[uiLang].app &&
      uiText[uiLang].app.libraryPanel) ||
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
    };

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
      `}</style>

      {/* Header（只保留一層：外層標題即可） */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
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
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            flexShrink: 0,
          }}
        >
          {libraryItems.length > 0 ? `${libraryItems.length} ${t.countSuffix}` : ""}
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
            gap: 10, // ✅ 更有呼吸感
            maxHeight: "calc(72vh - 32px)",
            overflowY: "auto",
            overscrollBehavior: "contain",
            paddingRight: 2,
            paddingTop: 0,
            paddingBottom: 0,
          }}
        >
          {libraryItems.map((it, idx) => (
            <button
              key={`${it.headword}__${it.canonicalPos}__${it.createdAt || idx}`}
              type="button"
              onClick={() => onReview(it.headword)}
              className="wl-item"
              style={{
                textAlign: "left",
                padding: "18px 18px", // ✅ 變大
                borderRadius: 18, // ✅ 更高級
                minHeight: 88, // ✅ 不會被壓扁
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.10)",
                cursor: "pointer",
              }}
              title="點選以原型回到查詢頁複習"
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
                      fontSize: 18, // ✅ 變大
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
                      padding: "4px 8px", // ✅ 變厚
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
                    {it.canonicalPos || ""}
                  </div>

                  {/* ⭐ 星星可點：取消收藏（不觸發 onReview） */}
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
                      padding: "10px 12px", // ✅ 變大
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
                </div>
              </div>

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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// frontend/src/features/library/WordLibraryPanel.jsx
