// frontend/src/features/testMode/TestModePanel.jsx

import React from "react";
import FavoriteStar from "../../components/common/FavoriteStar";

export default function TestModePanel({
  libraryCount,
  testCard,
  testMetaLoading,
  brief,
  pron,
  isFavorited,
  onToggleFavorite,
  onPickNext,
  onReview,
}) {
  const favDisabled = !testCard || !testCard.headword || !testCard.canonicalPos;

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
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800 }}>測試模式</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {libraryCount > 0 ? `收藏 ${libraryCount} 筆` : "尚未收藏"}
        </div>
      </div>

      {(!testCard || !testCard.headword) ? (
        <div style={{ opacity: 0.75, fontSize: 13, lineHeight: 1.6 }}>
          目前沒有可抽的收藏單字
          <br />
          先到查詢頁把星星點亮，再回來這裡
        </div>
      ) : (
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
            padding: 14,
          }}
        >
          {/* headword + ⭐ 我的最愛（比照 WordCard） */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                lineHeight: 1.1,
              }}
            >
              {testCard.headword}
            </div>

            <FavoriteStar
              active={!!isFavorited}
              disabled={favDisabled}
              onClick={onToggleFavorite}
              size={16}
              ariaLabel="加入我的最愛"
            />
          </div>

          {/* 詞性 · 簡譯 · 發音 */}
          <div
            style={{
              fontSize: 13,
              opacity: 0.75,
              lineHeight: 1.5,
            }}
          >
            {(testCard.canonicalPos || "—") +
              " · " +
              (brief || (testMetaLoading ? "…" : "—")) +
              " · " +
              (pron || (testMetaLoading ? "…" : "—"))}
          </div>

          {/* 操作 */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={onPickNext}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
              }}
              title="隨機換一張（從收藏中抽）"
            >
              換一張
            </button>

            <button
              type="button"
              onClick={onReview}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
              }}
              title="回到查詢頁複習這個字"
            >
              去複習
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
