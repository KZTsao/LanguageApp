// frontend/src/features/library/WordLibraryPanel.jsx
import React from "react";
import FavoriteStar from "../../components/common/FavoriteStar";

export default function WordLibraryPanel({
  libraryItems,
  onReview,

  // ✅ 由 App.jsx 注入：單字庫內可直接取消收藏
  onToggleFavorite,
  favoriteDisabled = false,
}) {
  const canToggle = typeof onToggleFavorite === "function" && !favoriteDisabled;

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        padding: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>單字庫</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
            只顯示原型（Lemma），不包含變化形
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {libraryItems.length > 0 ? `${libraryItems.length} 筆` : ""}
        </div>
      </div>

      {libraryItems.length === 0 ? (
        <div style={{ opacity: 0.75, fontSize: 13, lineHeight: 1.6 }}>
          尚未收藏任何單字
          <br />
          請到查詢頁點擊星號加入收藏
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {libraryItems.map((it, idx) => (
            <button
              key={`${it.headword}__${it.canonicalPos}__${it.createdAt || idx}`}
              type="button"
              onClick={() => onReview(it.headword)}
              style={{
                textAlign: "left",
                padding: "10px 10px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
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
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>
                    {it.headword}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                    原型（Lemma）
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
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
                    title={canToggle ? "取消收藏" : "未登入時不可操作收藏"}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      margin: 0,
                      cursor: canToggle ? "pointer" : "not-allowed",
                      opacity: canToggle ? 1 : 0.45,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <FavoriteStar
                      active={true}
                      disabled={!canToggle}
                      onClick={() => {}}
                      size={16}
                      ariaLabel="我的最愛"
                    />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
                {it.createdAt
                  ? new Date(it.createdAt)
                      .toISOString()
                      .slice(0, 10)
                      .replaceAll("-", "/")
                  : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// frontend/src/features/library/WordLibraryPanel.jsx
