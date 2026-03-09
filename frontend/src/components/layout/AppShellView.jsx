// frontend/src/components/layout/AppShellView.jsx
import React from "react";

import LayoutShell from "./LayoutShell";
import SearchBox from "../search/SearchBox";
import ResultPanel from "../result/ResultPanel";
import WordLibraryPanel from "../../features/library/WordLibraryPanel";
import LibraryAddPage from "../../features/library/LibraryAddPage";
import TestModePanel from "../../features/testMode/TestModePanel";
import LoginHeader from "../LoginHeader";
// ✅ 2026-01-24：Support Widget（即時客服）掛載（僅 UI 掛載，不介入既有流程）
import SupportWidget from "../support/SupportWidget";


// ✅ 2026-01-25：Support Admin 入口（僅管理者 email 可見）
// - 需求：不用改上游傳參也能工作，因此從 localStorage (Supabase session) 取 email
// - 若取不到 email：不顯示入口（避免誤曝露）
function __getSupabaseEmailFromLocalStorage() {
  try {
    if (typeof window === "undefined") return null;
    if (!window.localStorage) return null;
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      // Supabase Auth 常見 key：sb-<projectRef>-auth-token
      if (!k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const j = JSON.parse(raw);
      const email = j?.user?.email || j?.currentSession?.user?.email;
      if (email) return String(email);
    }
    return null;
  } catch (e) {
    return null;
  }
}

function __parseAdminAllowlist() {
  // 前端 allowlist（測試期先用環境變數；若未設，預設不顯示）
  // ✅ 修正：避免在某些 runtime（devtools/非 module 解析）下看到 import.meta 為 undefined 而誤判
  // 優先序：window.__SUPPORT_ADMIN_EMAILS → localStorage → Vite env
  try {
    let raw = "";

    // 1) window 注入（可用於臨時測試）
    try {
      if (typeof window !== "undefined" && window.__SUPPORT_ADMIN_EMAILS) {
        raw = String(window.__SUPPORT_ADMIN_EMAILS || "");
      }
    } catch {}

    // 2) localStorage（可用於臨時測試）
    try {
      if (!raw && typeof window !== "undefined" && window.localStorage) {
        const v = window.localStorage.getItem("SUPPORT_ADMIN_EMAILS");
        if (v) raw = String(v);
      }
    } catch {}

    // 3) Vite env（正式）
    try {
      if (!raw) {
        const __hasImportMeta = (() => {
          try {
            return typeof import.meta !== "undefined";
          } catch (e) {
            return false;
          }
        })();
        if (__hasImportMeta && import.meta && import.meta.env) {
          raw = String(import.meta.env.VITE_SUPPORT_ADMIN_EMAILS || "");
        }
      }
    } catch {}

    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}


function __isSupportAdminEmail(email) {
  try {
    if (!email) return false;
    const allow = __parseAdminAllowlist();
    if (!allow.length) return false;
    return allow.includes(String(email));
  } catch (e) {
    return false;
  }
}

/**
 * AppShellView
 * - 只負責「畫面組裝 / view switch / library modal」
 * - 不持有業務狀態：所有 state / handler 由 App.jsx 傳入
 *
 * 異動紀錄（只追加，不刪除）：
 * - 2026-01-16：
 *   ✅ B(UI) 接線：將 controller 提供的 pending/key 工具轉傳到 UI 元件
 *   - ResultPanel: isFavoritePending / getFavoriteWordKey
 *   - WordLibraryPanel: isFavoritePending / getFavoriteWordKey
 *   （UI 只負責 disable/阻擋點擊，不負責交易邏輯）
 *
 * - 2026-01-17：
 *   ✅ Task 0-1：History Prev/Next label only
 *   - 只補傳 history 到 ResultPanel（不改 flow，不新增 state）
 *
 * - 2026-01-18：
 *   ✅ Task C：分類 CRUD handlers 接線（往下傳到 WordLibraryPanel）
 *   - isCategoriesSaving：不得用 !authUserId 推導（未登入≠saving）
 *   - CRUD handlers：onCreateCategory/onRenameCategory/onReorderCategories/onArchiveCategory
 *   - categoriesErrorText：分類 CRUD 失敗提示文字（由上游決定）
 *
 * - 2026-01-18：
 *   ✅ Task C：canEditFromUpstream 接線（往下傳到 WordLibraryPanel）
 *   - canEdit：由上游明確決定（預設用 !!authUserId）
 *   - authUserId：也一併往下傳（讓下游可自行推導）
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

  // ✅ /library/add
  libraryAddTargetCategoryId,
  onOpenLibraryAddPage,
  onCloseLibraryAddPage,

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
  onExpandSentence,

  // ✅ 2026-01-19：Task A（ResultPanel 導覽列雙路）
  // - App 端 setNavContext(...) 後，必須一路透傳到 ResultPanel
  navContext,
  favoriteCategories,
  favoriteCategoriesLoading,
  selectedFavoriteCategoryId,
  onSelectFavoriteCategoryForAdd,
  canClearHistory,
  onClearHistoryItem,
  clearHistoryLabel,
  onResumeLearning,
  resumeLearningLabel,
  onSelectPosKey,
  onExamplesResolved,
  examplesAutoRefreshEnabled,

  // library modal
  showLibraryModal,
  closeLibraryModal,
  handleLibraryReview,
  onUpdateSenseStatus,
  favoriteDisabled,
  onSelectFavoriteCategory,

  // ✅ 2026-01-16：B(UI) pending/key 由 App/controller 注入（AppShellView 只轉傳）
  // - isFavoritePending(wordKey)
  // - getFavoriteWordKey(meta)
  isFavoritePending,
  getFavoriteWordKey,

  // ✅ 2026-01-18：Task C（分類管理 CRUD / saving / error）由上游注入，AppShellView 只轉傳
  // - isCategoriesSaving：嚴格代表「分類 API 寫入中」
  // - categoriesErrorText：失敗提示文字（上游決定）
  // - CRUD handlers：create/rename/reorder/archive
  isCategoriesSaving,
  categoriesErrorText,
  onCreateCategory,
  onRenameCategory,
  onReorderCategories,
  onArchiveCategory,
}) {
  return (
    <>
    {/* ===== [DEBUG] MODE BADGE (toggle: localStorage.SO_DEBUG_BADGE) ===== */}
    {typeof window !== "undefined" && localStorage.getItem("SO_DEBUG_BADGE") && (
      <div
        style={{
          position: "fixed",
          top: 8,
          right: 8,
          zIndex: 9999,
          padding: "6px 8px",
          background: "#111",
          color: "#0f0",
          fontSize: 12,
          borderRadius: 6,
          fontFamily: "monospace",
          lineHeight: 1.35,
          maxWidth: 320,
          wordBreak: "break-word",
        }}
      >
        <div>mode: {mode}</div>
        <div>view: {view}</div>
        <div>historyIndex: {historyIndex}</div>
        <div>title: {learningContext?.title || "-"}</div>
      </div>
    )}
    {/* ===== END [DEBUG] BADGE ===== */}
    <LayoutShell
      uiLang={uiLang}
      onUiLangChange={setUiLang}
      theme={theme}
      onThemeChange={setTheme}
      rightHeader={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* ✅ 2026-01-25：管理者入口（僅 allowlist email 可見） */}
          {(() => {
            const __email = __getSupabaseEmailFromLocalStorage();
            const __isAdmin = __isSupportAdminEmail(__email);
            if (!__isAdmin) return null;
            return (
              <a
                href="/support-admin"
                style={{
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 10,
                  border: "1px solid var(--accent, var(--accent-orange))",
                  background: "transparent",
                  color: "var(--accent, var(--accent-orange))",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                }}
                title="客服管理"
                aria-label="客服管理"
              >
                客服管理
              </a>
            );
          })()}
          <LoginHeader uiText={currentUiText} />
        </div>
      }
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
      ) : view === "libraryAdd" ? (
        <LibraryAddPage
          uiText={currentUiText}
          t={t}
          uiLang={uiLang}
          targetCategoryId={libraryAddTargetCategoryId}
          favoriteCategories={favoriteCategories}
          favoriteCategoriesLoading={favoriteCategoriesLoading}
          onClose={onCloseLibraryAddPage}
          // best-effort: after import commit, open library modal
          onOpenLibrary={onOpenLibrary}
          onSelectFavoriteCategory={onSelectFavoriteCategory}
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
            theme={theme}
            // ✅ Task 0-1：History Prev/Next label only（資料來源唯一：useHistoryFlow 的 history[]）
            // - 上游未傳 history 時：ResultPanel 端會自動不啟用 label，但不影響既有 UI
            history={history}
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
            onExpandSentence={onExpandSentence}
            // ✅ 任務 3：新增收藏時可選分類（ResultPanel 下拉）
            favoriteCategories={favoriteCategories}
            favoriteCategoriesLoading={favoriteCategoriesLoading}
            selectedFavoriteCategoryId={selectedFavoriteCategoryId}
            onSelectFavoriteCategory={onSelectFavoriteCategoryForAdd}
            // ✅ 清除當下回放紀錄：移到 ResultPanel 箭頭旁邊
            canClearHistory={canClearHistory}
            onClearHistoryItem={onClearHistoryItem}
            clearHistoryLabel={clearHistoryLabel}
            onResumeLearning={onResumeLearning}
            resumeLearningLabel={resumeLearningLabel}
            // ✅ 詞性切換：由 ResultPanel → App
            onSelectPosKey={onSelectPosKey}
            onSelectPosKeyFromApp={onSelectPosKey}
            // ✅ 2026-01-16：B(UI) pending/key 接線（ResultPanel → WordCard）
            isFavoritePending={isFavoritePending}
            getFavoriteWordKey={getFavoriteWordKey}

            // ✅ 2026-01-19：Task A（ResultPanel 導覽列雙路）
            navContext={navContext}
            examplesAutoRefreshEnabled={examplesAutoRefreshEnabled}
            onExamplesResolved={onExamplesResolved}
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
                    // ✅ /library/add（學習本匯入頁）
                    onOpenLibraryAddPage={onOpenLibraryAddPage}
                    // ✅ 2026-01-16：B(UI) pending/key 接線（Library list 星號）
                    isFavoritePending={isFavoritePending}
                    getFavoriteWordKey={getFavoriteWordKey}
                    // ✅ 2026-01-18：Task C（分類 CRUD 接線）
                    // - 未登入≠saving，因此不允許用 !authUserId 推導
                    isCategoriesSaving={isCategoriesSaving}
                    categoriesErrorText={categoriesErrorText}
                    onCreateCategory={onCreateCategory}
                    onRenameCategory={onRenameCategory}
                    onReorderCategories={onReorderCategories}
                    onArchiveCategory={onArchiveCategory}
                    // ✅ 2026-01-18：Task C（canEditFromUpstream / authUserId 接線）
                    authUserId={authUserId}
                    canEdit={!!authUserId}
                    onEnterLearning={onEnterLearning}
                    onExamplesResolved={onExamplesResolved}
                    examplesAutoRefreshEnabled={examplesAutoRefreshEnabled}
                    // ✅ 2026-02-24：登入成功後若無任何學習本 → 自動彈出新增小視窗
                    autoPromptCreateCategory={true}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    
          {/* ✅ 2026-01-24：全站客服 SupportWidget（右下角浮動，不影響既有 view flow） */}
          <SupportWidget authUserId={authUserId} uiLang={uiLang} />

    </LayoutShell>
    </>
  );
}
// frontend/src/components/layout/AppShellView.jsx