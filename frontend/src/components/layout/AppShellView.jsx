// frontend/src/components/layout/AppShellView.jsx
import React from "react";

import LayoutShell from "./LayoutShell";
import SearchBox from "../search/SearchBox";
import ResultPanel from "../result/ResultPanel";
import WordLibraryPanel from "../../features/library/WordLibraryPanel";
import TestModePanel from "../../features/testMode/TestModePanel";
import LoginHeader from "../LoginHeader";

/**
 * AppShellView
 * - 只負責「畫面組裝 / view switch / library modal」
 * - 不持有業務狀態：所有 state / handler 由 App.jsx 傳入
 */
export default function AppShellView({
  // core
  uiLang,
  setUiLang,
  theme,
  setTheme,
  currentUiText,
  uiText,
  t,
  loading,
  view,
  setView,

  // auth & layout
  authUserId,
  history,
  historyIndex,
  onPrevHistory,
  onNextHistory,

  // test mode
  apiBase,
  isFavorited,
  onToggleFavorite,
  libraryItems,
  testCard,
  setTestCard,
  testMetaMap,
  setTestMetaMap,
  testMetaLoading,
  setTestMetaLoading,

  // search box
  text,
  onTextChange,
  onAnalyze,
  onEnterSearch,
  onEnterLearning,
  onOpenLibrary,

  // result panel
  result,
  showRaw,
  onToggleRaw,
  mode,
  learningContext,
  WordCard,
  GrammarCard,
  historyLength,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onWordClick,
  favoriteCategories,
  favoriteCategoriesLoading,
  selectedFavoriteCategoryId,
  onSelectFavoriteCategoryForAdd,
  canClearHistory,
  onClearHistoryItem,
  clearHistoryLabel,
  onSelectPosKey,

  // library modal
  showLibraryModal,
  closeLibraryModal,
  handleLibraryReview,
  onUpdateSenseStatus,
  favoriteDisabled,
  onSelectFavoriteCategory,
}) {
  return (
    <LayoutShell
      uiLang={uiLang}
      onUiLangChange={setUiLang}
      theme={theme}
      onThemeChange={setTheme}
      rightHeader={<LoginHeader uiText={currentUiText} />}
      view={view}
      onViewChange={setView}
      uiText={currentUiText}
      t={t}
      loading={loading}
      history={history}
      historyIndex={historyIndex}
      onPrevHistory={onPrevHistory}
      onNextHistory={onNextHistory}
      canFavorite={!!authUserId}
    >
      {view === "test" ? (
        <TestModePanel
          uiText={currentUiText}
          apiBase={apiBase}
          userId={authUserId}
          uiLang={uiLang}
          isFavorited={isFavorited}
          onToggleFavorite={onToggleFavorite}
          libraryItems={libraryItems}
          testCard={testCard}
          setTestCard={setTestCard}
          testMetaMap={testMetaMap}
          setTestMetaMap={setTestMetaMap}
          testMetaLoading={testMetaLoading}
          setTestMetaLoading={setTestMetaLoading}
        />
      ) : (
        <>
          <SearchBox
            text={text}
            onTextChange={onTextChange}
            onAnalyze={onAnalyze}
            loading={loading}
            uiLang={uiLang}
            onUiLangChange={setUiLang}
            uiText={currentUiText}
            // ✅ Task 1：預留模式切換入口（本任務先接線，不在 SearchBox 內 render 按鈕）
            onEnterSearch={onEnterSearch}
            onEnterLearning={onEnterLearning}
            onOpenLibrary={onOpenLibrary}
          />

          <ResultPanel
            result={result}
            loading={loading}
            showRaw={showRaw}
            onToggleRaw={onToggleRaw}
            uiText={currentUiText}
            uiLang={uiLang}
            // ✅ Task 1：全域模式（查詢 / 學習）
            mode={mode}
            learningContext={learningContext}
            WordCard={WordCard}
            GrammarCard={GrammarCard}
            isFavorited={isFavorited}
            onToggleFavorite={onToggleFavorite}
            canFavorite={!!authUserId}
            historyIndex={historyIndex}
            historyLength={historyLength}
            canPrev={canPrev}
            canNext={canNext}
            onPrev={onPrev}
            onNext={onNext}
            onWordClick={onWordClick}
            // ✅ 任務 3：新增收藏時可選分類（ResultPanel 下拉）
            favoriteCategories={favoriteCategories}
            favoriteCategoriesLoading={favoriteCategoriesLoading}
            selectedFavoriteCategoryId={selectedFavoriteCategoryId}
            onSelectFavoriteCategory={onSelectFavoriteCategoryForAdd}
            // ✅ 清除當下回放紀錄：移到 ResultPanel 箭頭旁邊
            canClearHistory={canClearHistory}
            onClearHistoryItem={onClearHistoryItem}
            clearHistoryLabel={clearHistoryLabel}
            // ✅ 詞性切換：由 ResultPanel → App
            onSelectPosKey={onSelectPosKey}
            onSelectPosKeyFromApp={onSelectPosKey}
          />

          {/* ✅ 單字庫彈窗（不換 view） */}
          {showLibraryModal && (
            <div
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                // 點遮罩關閉
                if (e.target === e.currentTarget) closeLibraryModal();
              }}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                zIndex: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 720,
                  borderRadius: 16,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--card-bg)",
                  color: "var(--text-main)",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                  overflow: "hidden",
                }}
              >
                {/* Header（極簡） */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 12px",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {/* ✅ 2026-01-04：隨堂考入口（從單字庫彈窗直接進入測試模式） */}
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          console.log("[library->test] enter test mode");
                        } catch {}

                        closeLibraryModal();
                        setView("test");
                      }}
                      style={{
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 10,
                        border: "1px solid var(--accent)",
                        background: "transparent",
                        color: "var(--accent)",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.04) inset",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      title="測驗（隨堂考）"
                      aria-label="測驗（隨堂考）"
                    >
                      <span aria-hidden="true">🧪</span>
                      <span>測驗</span>
                    </button>

                    <div style={{ fontSize: 14, fontWeight: 800 }}>
                      {t("app.topbar.library")}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeLibraryModal}
                    aria-label="Close"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--card-bg)",
                      color: "var(--text-main)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ padding: 8 }}>
                  <WordLibraryPanel
                    libraryItems={libraryItems}
                    onReview={handleLibraryReview}
                    onToggleFavorite={onToggleFavorite}
                    onUpdateSenseStatus={onUpdateSenseStatus}
                    favoriteDisabled={favoriteDisabled}
                    uiText={uiText}
                    uiLang={uiLang}
                    // ✅ 任務 2：收藏分類（下拉）
                    favoriteCategories={favoriteCategories}
                    favoriteCategoriesLoading={favoriteCategoriesLoading}
                    selectedFavoriteCategoryId={selectedFavoriteCategoryId}
                    onSelectFavoriteCategory={onSelectFavoriteCategory}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </LayoutShell>
  );
}
