// ===== FILE: frontend/src/App.jsx =====
// ===== FILE: frontend/src/App.jsx =====
// PATH: frontend/src/App.jsx
// frontend/src/App.jsx
/**
 * 文件說明：
 * - 本檔為 App 的主入口，負責「狀態與邏輯」；畫面交給 LayoutShell / SearchBox / ResultPanel 等元件。
 * - 本輪（Phase 4）採用「並存模式」：保留 localStorage legacy 邏輯，新增 DB API 路徑並以 wrapper 路由切換。
 *
 * 異動紀錄（僅追加，不可刪除）：
 * - 2025-12-17：Phase 4（並存模式）
 *   1) 新增 /api/library API 路徑的載入與收藏操作（GET/POST/DELETE）
 *   2) 新增 libraryInitStatus（Production 排查用）
 *   3) 保留既有 localStorage 收藏 function（僅加註 DEPRECATED，行為不移除）
 *   4) UI 綁定改指向 handleToggleFavorite（wrapper），避免直接呼叫 legacy toggleFavorite
 * - 2025-12-17：Phase 4 修正（Analyze 404）
 *   1) handleAnalyze 改呼叫既有後端路由 POST /api/analyze（避免誤打 /api/dictionary/analyze 造成 404）
 *   2) 新增 analyzeInitStatus（Production 排查用）
 * - 2025-12-17：Phase 4 修正（apiFetch Response 解析）
 *   1) handleAnalyze / loadLibraryFromApi / addFavoriteViaApi / removeFavoriteViaApi：補上 res.json() 解析
 *      避免把原生 Response 物件塞進 state 導致 render 取值噴錯（白畫面）
 *   2) 新增 readApiJson / assertApiOk（Production 排查用）：統一記錄 lastError 與回應內容片段
 * - 2025-12-17：Phase 4 清理（僅針對本對話窗新增且無效的排查碼）
 *   1) 移除 libraryInitStatus / analyzeInitStatus 與 create*InitStatus（避免檔案膨脹且未解決星星變色）
 *   2) 移除 assertApiOk / readApiJson，改回各 API 呼叫處就地做 res.ok 檢查與 res.json() 解析
 * - 2025-12-18：Phase 4 修正（查詢歷史導覽：前一頁/後一頁 UI 恢復）
 *   1) App.jsx 補回 ResultPanel 所需 props：historyIndex/historyLength/canPrev/canNext/onPrev/onNext
 *   2) 新增 historyNavInitStatus（Production 排查用），記錄歷史初始化狀態與筆數
 * - 2025-12-18：Phase 4 修正（查詢歷史導覽：前一頁/後一頁「真的翻結果」）
 *   1) history 每筆新增 resultSnapshot（完整查詢結果 JSON），寫入 localStorage（HISTORY_KEY）以便翻頁不重打 API
 *   2) goPrevHistory/goNextHistory 在切換 text 同步 setResult(resultSnapshot)，讓字卡跟著換
 *   3) 新增 historySnapshotInitStatus（Production 排查用）：記錄快照覆蓋率與是否有舊資料缺 snapshot
 * - 2025-12-18：Phase 4 修正（點擊德文字觸發新查詢）
 *   1) App.jsx 新增 handleWordClick（點字 → setText + 直接以該字觸發 analyze）
 *   2) ResultPanel 補回 onWordClick={handleWordClick} 接線，避免下游收到非 function
 *   3) 新增 wordClickInitStatus（Production 排查用）：記錄是否曾觸發、最後點擊字串與時間
 * - 2026-01-06：
 *   1) ✅ 詞性切換（pos switch）：handleAnalyzeByText 支援 options（targetPosKey/queryMode）
 *   2) ✅ App 接線：新增 handleSelectPosKey，接收 ResultPanel/WordCard 的詞性點擊事件並重新查詢
 *
 * - 2025-12-18：Phase 4 UI 調整（單字庫改彈窗，不再換 view）
 *   1) 移除 view === "library" 的換頁顯示，改用 showLibraryModal 彈窗顯示
 *   2) 單字庫入口改放到 ResultPanel 歷史導覽列最右側（字典 icon），風格比照導覽按鈕
 *   3) 修正 WordLibraryPanel props 對不上造成不顯示：改用 libraryItems/onReview/onToggleFavorite/favoriteDisabled
 * - 2025-12-18：Phase 4 調整（查詢歷史改為保留 30 筆 + 清除當下回放紀錄）
 *   1) HISTORY_LIMIT = 30，統一套用在「載入 / 寫回 / push」的 slice
 *   2) 新增 clearCurrentHistoryItem（僅刪除當下回放那筆，不打 API）
 *   3) 新增 historyClearInitStatus（Production 排查用）：記錄最後一次清除的 index 與時間
 * - 2025-12-18：Phase 4 UI 調整（清除當下回放紀錄移到箭頭旁邊）
 *   1) 移除 App.jsx 內的「點擊清除該筆紀錄」顯示區塊
 *   2) 改由 ResultPanel 在歷史導覽列（箭頭旁）顯示清除入口
 * - 2025-12-26：Phase 1（補寫入釋義）
 *   1) addFavoriteViaApi 支援 senseIndex/headwordGloss/headwordGlossLang，POST /api/library 時一併送出
 *   2) toggleFavoriteViaApi 新增收藏時，若 entry 帶上述欄位則透傳
 * - 2025-12-26：Phase 1 修正（補寫入釋義：payload keys）
 *   1) addFavoriteViaApi 永遠帶 headwordGloss/headwordGlossLang（即使 gloss 為空字串也送出 key，利於後端 log 追查）
 *   2) toggleFavoriteViaApi 增加保守 fallback 取 gloss（僅從 entry 既有欄位挑第一個非空字串，不生成新資料）
 *   3) 加入少量 console：觀察前端送出 payload 的 runtime 狀態
 * - 2025-12-26：Phase 1 擴充（多釋義：一次寫入多筆 senseIndex）
 *   1) toggleFavoriteViaApi：若 entry.senses 為陣列且長度 > 0，則逐一 upsert (senseIndex 0..n-1)
 *   2) 追加 console：觀察本次新增將送出幾筆 sense payload、每筆 gloss 長度
 * - 2025-12-29：Phase 1 修正（多釋義 payload 來源唯一化：支援 headwordSenses）
 *   1) buildFavoritePayloadsFromEntry：除了 entry.senses，也接受 entry.headwordSenses（WordCard 封裝的全釋義快照）
 *   2) toggleFavoriteViaApi 的 plan console 補印 headwordSenses 狀態，避免誤判只會送單筆
 * - 2026-01-01：Phase 1 擴充（義項狀態：familiarity/isHidden 沿用 POST /api/library）
 *   1) 新增 postLibraryUpsertViaApi（共用底層 upsert，不強制帶 gloss keys）
 *   2) addFavoriteViaApi 擴充支援 familiarity/isHidden（收藏當下可一併寫入狀態）
 *   3) 新增 updateSenseStatusViaApi/handleUpdateSenseStatus，供單字庫義項狀態 UI 直接寫 DB
 *   4) WordLibraryPanel 透過 onUpdateSenseStatus 接線（避免 UI disabled）
 * - 2026-01-03：Phase 1 修正（DB 寫入驗證與可控除錯）
 *   1) postLibraryUpsertViaApi：補上回應 JSON 解析與基本 sanity check（避免前端自以為 ok 但 DB 未寫入）
 *   2) 新增 libraryWriteInitStatus（Production 排查用）：記錄最近一次 upsert 的回應摘要與時間
 *   3) 新增可控 debug 開關（localStorage.DEBUG 包含 'library' 時才印出詳細回應）
 *
 * - 2026-01-04：Phase X（隨堂考入口：從單字庫彈窗進入）
 *   1) 單字庫彈窗 Header 左側新增「🧪 測驗」按鈕（入口更顯眼、可達）
 *   2) 點擊後：先 closeLibraryModal() 再 setView("test")，避免 UI 疊層造成誤判
 *   3) 加入少量 console 以便 Production 排查（確認入口點擊路徑是否有觸發）
 * - 2026-01-05：Phase X 修正（SearchBox/點字查詢：送後端前先做前處理）
 *   1) 新增 normalizeSearchQuery（去除頭尾常見標點/括號/引號 + trim，不動中間），避免 sehr. 要點多次才查
 *   2) handleWordClick/handleAnalyzeByText/handleAnalyze/handleLibraryReview 統一套用 normalizeSearchQuery（確保點字一次到位）
 *   3) 嚴格不以 text 變動觸發查詢，避免切換歷史紀錄造成重新查詢
 *   4) 新增 searchNormalizeInitStatus + 可控 debug（localStorage.DEBUG 包含 'search' 才印 log），供 Production 排查
 *
 * - 2026-01-05：Phase X 修正（查詢命中歷史：不重打 /api/analyze）
 *   1) handleAnalyze/handleAnalyzeByText：送出 API 前先比對 history（text/headword）
 *   2) 命中則直接 applyHistoryItemToUI（回放 resultSnapshot），並把該筆移到最前面（視為最新查詢）
 *   3) 追加少量可控 console（localStorage.DEBUG 包含 'search' 才印），供 Production 排查
 *
 * - 2026-01-05：Phase X 修正（歷史切換不影響 SearchBox）
 *   1) applyHistoryItemToUI 新增 options.syncInput（預設 true）
 *   2) goPrevHistory/goNextHistory 以 syncInput:false 回放 resultSnapshot，不回寫輸入框
 *   3) 保留既有 setText 行為（僅限非歷史導覽路徑），避免影響點字查詢/命中歷史回放
 *
 * - 2026-01-05：Phase 1｜Visit（訪問紀錄：前端最小導入）
 *   1) 新增 postVisitViaApi（POST /api/visit）與 visitInitStatus（Production 排查用）
 *   2) 新增 useEffect：登入成功（authUserId 有值）後在「同一個 user / 同一個 tab」只打一次 visit（避免狂加）
 *   3) 新增可控 debug：localStorage.DEBUG 包含 'visit' 才印 log
 * - 2026-01-06：App.jsx 刪減（使用者允許行數減少）
 *   1) 移除未被讀取的 Production 排查用 initStatus state（僅 set、不參與任何業務邏輯）
 *   2) 移除未被使用的 libraryCursor state（cursor 尚未在本檔參與任何流程）
 *   3) 移除已註解且無引用的 legacyPayload 殘留註解
 * - 2026-01-12：Task 3（新增收藏可選分類：category_id 接線修正）
 *   1) handleToggleFavorite / toggleFavoriteViaApi 支援第二參數 options（含 category_id）
 *   2) addFavoriteViaApi payload 支援 category_id（僅在有效整數時送出；否則省略走後端預設）
 *   3) fallback：未指定分類時，優先用 selectedFavoriteCategoryId；再嘗試 name===「我的最愛1」；最後不帶 category_id
 *
 * - 2026-01-14：拆分（useLibraryController）
 *   1) 將「單字庫/收藏/分類/彈窗/DB API/legacy localStorage」整包抽到 hooks/useLibraryController.js
 *   2) App.jsx 保留狀態與接線（減少檔案大小、降低讀檔壓力）
 * - 2026-01-16：B(UI) 接線（pending/wordKey）
 *   1) App.jsx 轉傳 controller 的 isFavoritePending/getFavoriteWordKey → AppShellView → ResultPanel/WordCard
 *   2) UI 層只負責 disable/阻擋點擊；交易/optimistic/rollback 都在 controller
 */

// App 只管狀態與邏輯，畫面交給 LayoutShell / SearchBox / ResultPanel

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import SupportAdminPage from "./pages/SupportAdminPage";
import uiText from "./uiText";
import WordCard from "./components/word/WordCard";
import GrammarCard from "./components/grammar/GrammarCard";
import { useAuth } from "./context/AuthProvider";
import AppShellView from "./components/layout/AppShellView";
import { getSnapshot, upsertSnapshot } from "./app/snapshotStore"; // Task 4C-fix

// =========================
// [normal] trace helper (dev)
// - Enable: VITE_DEBUG_NORMALIZE_TRACE=1
// =========================
const __NTRACE_ON =
  (typeof import.meta !== "undefined" &&
    import.meta?.env?.VITE_DEBUG_NORMALIZE_TRACE === "1") ||
  (typeof window !== "undefined" &&
    window?.localStorage?.getItem("DEBUG_NORMALIZE_TRACE") === "1");

function __nlog(event, payload) {
  if (!__NTRACE_ON) return;
  try {
    console.info("[normal]", "App", event, payload || {});
  } catch (e) {}
}

// ✅ 新增：統一帶 Authorization
import { apiFetch } from "./utils/apiClient";

// ✅ Email/Password auth（Supabase）
import { supabase } from "./utils/supabaseClient";

// ============================================================
// Snapshot helpers (Task 4C) — only upsert when next snapshot is "more complete"
// - prevents less-complete data from overwriting better snapshots
// - safe no-op if refKey missing or upsertSnapshot throws
// ============================================================
const scoreSnapshotCompleteness = (snap) => {
  try {
    const d = snap && typeof snap === "object" ? snap.dictionary : null;
    if (!d || typeof d !== "object") return 0;

    const hasExamples = Array.isArray(d.examples) && d.examples.length > 0;
    const hasExampleTr = typeof d.exampleTranslation === "string" && d.exampleTranslation.trim() !== "";
    const hasDefinition =
      typeof d.definition === "string"
        ? d.definition.trim() !== ""
        : typeof d.gloss === "string"
          ? d.gloss.trim() !== ""
          : false;
    const hasSenses = Array.isArray(snap?.senses) && snap.senses.length > 0;

    return (hasExamples ? 2 : 0) + (hasExampleTr ? 2 : 0) + (hasDefinition ? 1 : 0) + (hasSenses ? 1 : 0);
  } catch {
    return 0;
  }
};

const upsertIfImproved = (refKey, prevSnap, nextSnap, meta) => {
  try {
    if (!refKey) return false;

    const prevScore = scoreSnapshotCompleteness(prevSnap);
    const nextScore = scoreSnapshotCompleteness(nextSnap);

    if (!prevSnap || nextScore >= prevScore) {
      upsertSnapshot(refKey, nextSnap, meta);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// ✅ 新增：右上角登入/登出改由 LoginHeader 自己負責（它內部用 useAuth）
import { useHistoryFlow } from "./hooks/useHistoryFlow";
import { useAppState } from "./app/useAppState";

// ✅ 拆出：單字庫/收藏 controller
import { useLibraryController } from "./hooks/useLibraryController";
import { findFavoritesSnapshot, upsertFavoritesSnapshot } from "./app/favoritesSnapshotStorage";
// ===== [20260202 support] console logger =====
const __SUPPORT_TRACE_ON =
  typeof import.meta !== "undefined" &&
  import.meta?.env?.VITE_DEBUG_SUPPORT_ADMIN === "1";
function __supportTrace(...args) {
  if (!__SUPPORT_TRACE_ON) return;
  try { console.log("[20260202 support]", ...args); } catch (_) {}
}
// ===== end logger =====

// ============================================================
// Email/Password Auth Pages (minimal, no extra files)
// - /login            : Email 登入 / 註冊 / 忘記密碼
// - /auth/callback     : Email 驗證 / OAuth / Recovery callback（解析 URL token）
// - /reset-password    : 重設密碼（Recovery flow）
// ============================================================
const __authBoxStyle = {
  maxWidth: 520,
  margin: "32px auto",
  padding: 20,
  borderRadius: 16,
  border: "1px solid var(--border-subtle)",
  background: "var(--card-bg)",
  color: "var(--text-main)",
};

const __inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border-subtle)",
  background: "var(--bg)",
  color: "var(--text-main)",
  fontSize: 14,
};

const __btnStyle = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border-subtle)",
  background: "var(--bg-soft)",
  color: "var(--text-main)",
  fontSize: 14,
  cursor: "pointer",
};

function __safeReplace(url) {
  try {
    window.location.replace(url);
  } catch {
    window.location.href = url;
  }
}

function AuthCallbackLite() {
  const [status, setStatus] = useState("Signing you in…");
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // 1) 讓 supabase-js 解析 URL token（query/hash）並落地 session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (cancelled) return;
        if (error) {
          setErr(error?.message || "Auth callback failed");
          return;
        }

        // 2) Recovery flow：Supabase 會帶 type=recovery
        const sp = new URLSearchParams(String(window.location.search || ""));
        const type = sp.get("type");

        if (type === "recovery") {
          setStatus("Redirecting to reset password…");
          __safeReplace("/reset-password");
          return;
        }

        // 3) Email 驗證 / OAuth
        // - session 可能為 null（例如 Email 驗證流程視設定而定），此處不強制判斷
        setStatus(session ? "Done. Redirecting…" : "Almost done. Redirecting…");
        __safeReplace("/");
      } catch (e) {
        if (cancelled) return;
        setErr(e?.message || String(e));
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={__authBoxStyle}>
        <h2 style={{ margin: "0 0 8px" }}>{status}</h2>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>請稍候，正在完成登入流程</p>
        {err && (
          <div style={{ marginTop: 12, color: "#ef4444", whiteSpace: "pre-wrap" }}>
            Auth error: {err}
          </div>
        )}
      </div>
    </div>
  );
}

function EmailAuthPageLite() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // 已登入就導回首頁（避免重複登入）
  useEffect(() => {
    if (loading) return;
    if (user) __safeReplace("/");
  }, [user, loading]);

  const doSignIn = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMsg("登入成功，正在導回首頁…");
      __safeReplace("/");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const doSignUp = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (!email || !password) throw new Error("請輸入 Email 與密碼");
      if (password.length < 6) throw new Error("密碼至少 6 碼（Supabase 預設）");
      if (password !== password2) throw new Error("兩次密碼不一致");

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Email 驗證信 / 註冊後導回的入口（由本檔的 /auth/callback 接）
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;

      // 若 Supabase 有開「Email confirmations」，此時多半不會立刻有 session
      setMsg("已送出驗證信，請到信箱點擊連結完成驗證後再登入");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const doForgot = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (!email) throw new Error("請先輸入 Email");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) throw error;
      setMsg("已寄出重設密碼信，請到信箱點擊連結繼續");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "signin" ? "Email 登入" : mode === "signup" ? "Email 註冊" : "忘記密碼";

  return (
    <div style={{ padding: 24 }}>
      <div style={__authBoxStyle}>
        <h2 style={{ margin: "0 0 12px" }}>{title}</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            style={{ ...__btnStyle, opacity: mode === "signin" ? 1 : 0.7 }}
            onClick={() => {
              setMode("signin");
              setErr("");
              setMsg("");
            }}
            disabled={busy}
          >
            登入
          </button>
          <button
            style={{ ...__btnStyle, opacity: mode === "signup" ? 1 : 0.7 }}
            onClick={() => {
              setMode("signup");
              setErr("");
              setMsg("");
            }}
            disabled={busy}
          >
            註冊
          </button>
          <button
            style={{ ...__btnStyle, opacity: mode === "forgot" ? 1 : 0.7 }}
            onClick={() => {
              setMode("forgot");
              setErr("");
              setMsg("");
            }}
            disabled={busy}
          >
            忘記密碼
          </button>
          <button style={{ ...__btnStyle, marginLeft: "auto" }} onClick={() => __safeReplace("/")}
            disabled={busy}
          >
            回首頁
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Email</div>
            <input
              style={__inputStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>密碼</div>
              <input
                style={__inputStyle}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 碼"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
          )}

          {mode === "signup" && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>再次輸入密碼</div>
              <input
                style={__inputStyle}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                type="password"
                autoComplete="new-password"
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            {mode === "signin" && (
              <button style={__btnStyle} disabled={busy} onClick={doSignIn}>
                {busy ? "登入中…" : "登入"}
              </button>
            )}
            {mode === "signup" && (
              <button style={__btnStyle} disabled={busy} onClick={doSignUp}>
                {busy ? "送出中…" : "註冊並寄驗證信"}
              </button>
            )}
            {mode === "forgot" && (
              <button style={__btnStyle} disabled={busy} onClick={doForgot}>
                {busy ? "送出中…" : "寄重設密碼信"}
              </button>
            )}
          </div>

          {msg && <div style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>{msg}</div>}
          {err && (
            <div style={{ color: "#ef4444", whiteSpace: "pre-wrap" }}>
              {err}
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            <div>• Email 驗證信與重設密碼信由 Supabase Auth 寄送</div>
            <div>• 若你在 Supabase 後台有開啟 Email confirmations：註冊後必須先驗證才能登入</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordPageLite() {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const doReset = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (!p1 || p1.length < 6) throw new Error("密碼至少 6 碼");
      if (p1 !== p2) throw new Error("兩次密碼不一致");
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw error;
      setMsg("密碼已更新，正在導回首頁…");
      __safeReplace("/");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={__authBoxStyle}>
        <h2 style={{ margin: "0 0 12px" }}>重設密碼</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>新密碼</div>
            <input
              style={__inputStyle}
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>再次輸入新密碼</div>
            <input
              style={__inputStyle}
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={__btnStyle} disabled={busy} onClick={doReset}>
              {busy ? "更新中…" : "更新密碼"}
            </button>
            <button style={__btnStyle} disabled={busy} onClick={() => __safeReplace("/")}>回首頁</button>
          </div>
          {msg && <div style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>{msg}</div>}
          {err && (
            <div style={{ color: "#ef4444", whiteSpace: "pre-wrap" }}>
              {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppInner() {
  // ✅ 取得登入 userId（未登入 = guest bucket）
  const { user } = useAuth();
  const authUserId = user && user.id ? user.id : "";


// 🧭 Debug flags (safe no-op in prod)
// - enable by: localStorage.DEBUG_APP = "1"  (or add ?debug=1)
const __APP_DEBUG =
  typeof window !== "undefined" &&
  (String(window.location.search || "").includes("debug=1") ||
    String(window.localStorage?.getItem("DEBUG_APP") || "") === "1");

useEffect(() => {
  if (!__APP_DEBUG) return;

  // Optional breakpoint:
  // localStorage.DEBUG_BREAK_APP = "1"
  if (String(window.localStorage?.getItem("DEBUG_BREAK_APP") || "") === "1") {
    debugger; // eslint-disable-line no-debugger
  }

  const payload = {
    tag: "AppInnerMounted",
    at: new Date().toISOString(),
    path: String(window.location.pathname || ""),
    hash: String(window.location.hash || ""),
    readyState: typeof document !== "undefined" ? document.readyState : "(no-document)",
    hasAuthUser: Boolean(user && user.id),
    authUserId: user && user.id ? String(user.id) : "",
  };

  window.__APP_INIT__ = payload;
  console.log("[APP_INIT]", payload);
}, []); // run once
  // ✅ 2026-01-26：Support Admin routing（最小侵入、避免依賴 router / import.meta）
  // - 只用 window.location（不使用 import.meta，避免「Cannot use import.meta outside a module」）
  // - 同時支援：/support-admin、/support-admin/、以及 hash #/support-admin（保守）
  const __isSupportAdminPath = (() => {
    try {
      const w = typeof window !== "undefined" ? window : null;
      if (!w || !w.location) return false;

      const path = String(w.location.pathname || "").replace(/\/+$/g, "");
      const hash = String(w.location.hash || "");

      if (path.endsWith("/support-admin")) return true;
      if (hash === "#/support-admin" || hash === "#/support-admin/") return true;

      return false;
    } catch {
      return false;
    }
  })();

  if (__isSupportAdminPath) {
    return <SupportAdminPage />;
  }

  // ✅ 2026-01-26：Email/Password Auth routing（最小侵入、避免依賴 Router）
  // - /login：Email 登入/註冊/忘記密碼
  // - /auth/callback：Supabase email verify / OAuth / recovery callback
  // - /reset-password：重設密碼
  const __authPath = (() => {
    try {
      const w = typeof window !== "undefined" ? window : null;
      if (!w || !w.location) return "";
      return String(w.location.pathname || "").replace(/\/+$/g, "");
    } catch {
      return "";
    }
  })();

  if (__authPath.endsWith("/auth/callback")) return <AuthCallbackLite />;
  if (__authPath.endsWith("/reset-password")) return <ResetPasswordPageLite />;
  if (__authPath.endsWith("/login") || __authPath.endsWith("/auth")) return <EmailAuthPageLite />;


  // ✅ Step 1：集中 state（不含 effect）
  const { keys, helpers, state, actions } = useAppState({
    authUserId,
    defaultUiLang: "zh-TW",
  });

  const {
    text,
    // ✅ Task 5
    displayText,
    queryText,
    lastNormalizedQuery,
    result,
    uiLang,
    loading,
    showRaw,
    view,
    showLibraryModal,
    mode,
    learningContext,
    // ✅ 2026-01-19：Task A（ResultPanel 導覽列雙路）
    // - App 端已 setNavContext(...)，但必須把 navContext 往下傳到 ResultPanel 才能生效
    navContext,
    libraryItems,
    libraryCursor,
    favoriteCategories,
    favoriteCategoriesLoading,
    favoriteCategoriesLoadError,
    selectedFavoriteCategoryId,
    testCard,
    testMetaMap,
    testMetaLoading,
  } = state;

  const {
    setText,
    setResult,
    setUiLang,
    setLoading,
    setShowRaw,
    setView,
    setShowLibraryModal,
    setMode,
    setLearningContext,
    enterSearchMode,
    enterLearningMode,
    updateLearningContext,
    // navContext（Task 1）
    setNavContext,
    setLibraryItems,
    setLibraryCursor,
    setFavoriteCategories,
    setFavoriteCategoriesLoading,
    setFavoriteCategoriesLoadError,
    setSelectedFavoriteCategoryId,
    setTestCard,
    setTestMetaMap,
    setTestMetaLoading,
  } = actions;

  const {
    safeWriteLocalStorageText,
    safeWriteLocalStorageJson,
    // ✅ moved from App.jsx → useAppState helpers
    isLibraryDebugEnabled,
    isSearchDebugEnabled,
    isVisitDebugEnabled,
    isExamplesDebugEnabled,
    normalizeSearchQuery,
    // ✅ Task 5
    buildQueryForSubmit,
    applyAnalyzeResult,
  } = helpers;

  const {
    // scoped
    WORDS_KEY,
    UILANG_KEY,
    THEME_KEY,
    LASTTEXT_KEY,
    HISTORY_KEY,
    FAVORITES_CATEGORY_KEY,
    // legacy
    WORDS_KEY_LEGACY,
    UILANG_KEY_LEGACY,
    THEME_KEY_LEGACY,
    LASTTEXT_KEY_LEGACY,
    // mode
    APP_MODE_KEY,
    LEARNING_CONTEXT_KEY,
    // bucket
    userBucket,
  } = keys;

  const API_BASE =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000"
      : "https://languageapp-8j45.onrender.com";

  // ✅ Phase 4（並存模式）開關：true = 單字庫收藏走 DB（/api/library）；false = 使用 legacy localStorage
  const USE_API_LIBRARY = true;

  // ✅ view 切換：search / test（library 改彈窗，不再佔 view）

  // ============================================================
  // Task E — Favorites 瀏覽快取（cache-first，僅快取預設詞性；pos switch 仍重打 /api/analyze）
  // - App 常駐：獨立於 history（history 仍是 localStorage snapshot）
  // - key：normalizeSearchQuery(headword)（本檔 normalizeSearchQuery 回傳 string）
  // - value：/api/analyze 的完整 resultSnapshot（必須能完整重現 ResultPanel UI）
  // - 限制：
  //   1) 只快取 favorites replay（intent="learning-replay" && noHistory=true）
  //   2) 只快取預設詞性（!options.targetPosKey）
  // ============================================================
  const favoritesResultCacheRef = useRef(new Map());

  /**
   * 功能：同一個 user / 同一個 tab 只送一次 visit（避免狂加）
   * - 規則：
   *   1) authUserId 變成有值（登入完成）才送
   *   2) 同一個 userId 在同一個 tab 只送一次
   * - 注意：這是前端節流；真正是否要「每次刷新都算一次」後續可再調整策略
   */
  const visitOnceRef = useRef({ userId: "", done: false });

  /**
   * 功能：POST /api/visit（最小）
   * - 目的：更新 profiles.visit_count / last_visit_at
   * - 注意：apiFetch 會自動帶 Authorization（你已統一在 apiClient 做）
   */
  const postVisitViaApi = async ({ reason = "" } = {}) => {
    if (!authUserId) return;

    // ✅ 可控 debug
    if (isVisitDebugEnabled()) {
      try {
        console.debug("[visit][postVisitViaApi] start", {
          reason: reason || "",
          userId: authUserId,
        });
      } catch {}
    }

    try {
      const res = await apiFetch(`/api/visit`, { method: "POST" });
      if (!res) throw new Error("[visit] response is null");

      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[visit] POST /api/visit failed: ${res.status} ${res.statusText}${detail ? " | " + detail : ""}`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (isVisitDebugEnabled()) {
        try {
          console.debug("[visit][postVisitViaApi] ok", {
            mode: data?.mode || "",
            visit_count: data?.visit_count,
            last_visit_at: data?.last_visit_at,
          });
        } catch {}
      }
    } catch (e) {
      if (isVisitDebugEnabled()) {
        try {
          console.warn("[visit][postVisitViaApi] failed", e);
        } catch {}
      }
    }
  };

  /**
   * Phase 1｜Visit：登入後送出一次（同 user / 同 tab 只一次）
   * - 注意：不合併既有 useEffect；僅新增一個最小 useEffect
   */
  useEffect(() => {
    if (!authUserId) return;

    // 同一個 userId 在同一個 tab 已送出就不再送
    if (
      visitOnceRef.current &&
      visitOnceRef.current.userId === authUserId &&
      visitOnceRef.current.done
    ) {
      return;
    }

    // 標記為已送（先標記，避免重複觸發造成多次）
    visitOnceRef.current = { userId: authUserId, done: true };

    // 送出 visit（最小：不阻斷 UI）
    postVisitViaApi({ reason: "authUserId-ready" });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  // 查詢歷史：存最近 10 筆
  // ✅ 2025-12-18：本輪需求改為保留 30 筆（統一套用在所有 slice）
  const HISTORY_LIMIT = 100;

  // ✅ 查詢歷史（已拆出 useHistoryFlow，避免 App.jsx 過大）
  const {
    history,
    setHistory,
    historyIndex,
    setHistoryIndex,
    canPrevHistory,
    canNextHistory,
    goPrevHistory,
    goNextHistory,
    clearCurrentHistoryItem,
    findHistoryHitIndex,
    replayHistoryHit,
    applyHistoryItemToUI,
  } = useHistoryFlow({
    HISTORY_KEY,
    HISTORY_LIMIT,
    isSearchDebugEnabled,
    setText,
    setResult,
  });

  // ============================================================
  // Fix: Maximum update depth exceeded（Task 2 navContext + unstable handlers）
  // - 原因：goPrevHistory/goNextHistory 可能是每次 render 都變的新 function
  //         Task 2 useEffect 依賴它們 → 每 render 都 setNavContext → 造成無限更新
  // - 解法：用 ref 持有最新 handlers，並提供 stable wrapper function 給 navContext
  //         （維持既有行為，但避免 useEffect 依賴變動函式）
  // ============================================================
  const historyNavHandlersRef = useRef({ goPrevHistory: null, goNextHistory: null });
  useEffect(() => {
    historyNavHandlersRef.current = { goPrevHistory, goNextHistory };
  }, [goPrevHistory, goNextHistory]);

  const stableGoPrevHistory = useCallback(() => {
    const fn = historyNavHandlersRef.current?.goPrevHistory;
    if (typeof fn === "function") fn();
  }, []);

  const stableGoNextHistory = useCallback(() => {
    const fn = historyNavHandlersRef.current?.goNextHistory;
    if (typeof fn === "function") fn();
  }, []);

  // ============================================================
  // Task 2 — 將 History 導覽接入 navContext（Search 模式）
  // - 只在 mode="search" 時更新（避免覆蓋 learning/favorites）
  // - historyIndex === -1 代表 live：index 固定 -1、currentLabel 固定空字串
  // - canPrev/canNext/goPrev/goNext 必須沿用 useHistoryFlow 輸出（不可重算）
  // - label 欄位固定：historyItem.headword（禁止 UI fallback chain）
  // ============================================================
  useEffect(() => {
    // ============================================================
    // Task C — 從學習本（Favorites/Learning）返回時，導覽來源保持學習本，不回落 History
    // 核心規則：Learning/Favorites 的 navContext 優先權 > History navContext
    // - 只要在 learning/favorites：History 不得覆蓋 navContext
    // - 即使 historyIndex 有變動，也必須忽略
    // ============================================================
      // Task 4B-0: (deprecated) snapshotStore favorites replay guard moved to handleAnalyzeByText(...)
      // - 此 useEffect 只處理 history/navContext 初始化，這裡不做任何 early return（避免誤攔截）

    // ✅ mode !== "search"：不碰 navContext（避免覆蓋其他模式來源）
    if (mode !== "search") return;

    // ✅ 安全：history 必須是 array
    const items = Array.isArray(history) ? history : [];

    // ✅ label 取值規則：固定欄位 headword（禁止 UI 自行猜）
    const getLabel = (item) => {
      try {
        const v = item && typeof item === "object" ? item.headword : "";
        return typeof v === "string" ? v : "";
      } catch {
        return "";
      }
    };

    // ✅ index 規則：live 仍保留 -1（避免誤把 live 當成 history[0]）
    const idx = typeof historyIndex === "number" ? historyIndex : -1;

    const prevTargetIndex = idx + 1;
    const nextTargetIndex = idx - 1;

    const prevLabel = prevTargetIndex >= 0 && prevTargetIndex < items.length ? getLabel(items[prevTargetIndex]) : "";
    const nextLabel = nextTargetIndex >= 0 && nextTargetIndex < items.length ? getLabel(items[nextTargetIndex]) : "";

    const currentLabel = idx >= 0 && idx < items.length ? getLabel(items[idx]) : "";

    // ✅ history 空/無效時的 safety（依 spec）
    const safeItems = items.length ? items : [];
    const safeIndex = safeItems.length ? idx : -1;

    setNavContext({
      source: "history",
      items: safeItems,
      total: safeItems.length,

      // index: live 時維持 -1；history 空時也固定 -1
      index: safeIndex,

      // labels：以「按下後會去到的那筆」為準（Task 4 才會讀）
      currentLabel: idx === -1 ? "" : currentLabel,
      prevLabel,
      nextLabel,

      // canPrev/canNext：直接沿用 flow（不可重算，避免不一致）
      canPrev: !!canPrevHistory,
      canNext: !!canNextHistory,

      // 行為：封裝既有 goPrevHistory/goNextHistory
      goPrev: stableGoPrevHistory,
      goNext: stableGoNextHistory,
    });
  }, [
    mode,
    learningContext?.sourceType,
    history,
    historyIndex,
    canPrevHistory,
    canNextHistory,
    stableGoPrevHistory,
    stableGoNextHistory,
    setNavContext,
  ]);

  // ============================================================
  // 深淺色主題（分桶，但初始仍可用 legacy 當 fallback）
  const [theme, setTheme] = useState(() => "light");
  // ============================================================
  // Init Gate — 初始化完成前，禁止任何互動入口
  // - hydrationDone：scoped/legacy localStorage 值已套用
  // - favoritesReady：登入狀態下，等待收藏分類載入完成（避免學習本 init mismatch）
  // ============================================================
  const [hydrationDone, setHydrationDone] = useState(false);

  const appReady = useMemo(() => {
    const baseReady = !!hydrationDone;
    const favoritesReady = !authUserId ? true : !favoriteCategoriesLoading;
    return baseReady && favoritesReady;
  }, [hydrationDone, authUserId, favoriteCategoriesLoading]);

  // ✅ 提供給下游元件（就算中間沒傳 prop，也能用 global 讀取）
  useEffect(() => {
    try {
      window.__LANGAPP_INTERACTION_ENABLED__ = !!appReady;
    } catch {}
  }, [appReady]);

  // ✅ uiText 取用（嚴格：缺字顯示 —）
  const currentUiText = useMemo(() => {
    return uiText[uiLang] || uiText["zh-TW"] || {};
  }, [uiLang]);

  const t = useMemo(() => {
    const getByPath = (obj, path) => {
      const parts = String(path || "").split(".");
      let cur = obj;
      for (const p of parts) {
        if (!cur || typeof cur !== "object") return undefined;
        cur = cur[p];
      }
      return cur;
    };
    return (path) => {
      const v = getByPath(currentUiText, path);
      return typeof v === "string" && v.trim() ? v : "—";
    };
  }, [currentUiText]);

  // ✅ 初始化：語言/主題/最後查詢（分桶），並保留 legacy fallback
  useEffect(() => {
    try {
      const scopedLang = window.localStorage.getItem(UILANG_KEY);
      const legacyLang = window.localStorage.getItem(UILANG_KEY_LEGACY);
      if (scopedLang) setUiLang(scopedLang);
      else if (legacyLang) setUiLang(legacyLang);

            // ✅ 強制亮色：不讀取/不切換 dark，並清除 legacy dark 設定，避免暗版出現
      setTheme("light");
      try {
        window.localStorage.setItem(THEME_KEY, "light");
      } catch {}
      try {
        window.localStorage.removeItem(THEME_KEY_LEGACY);
      } catch {}
      try {
        document.documentElement.classList.remove("dark");
      } catch {}


      const scopedLast = window.localStorage.getItem(LASTTEXT_KEY);
      const legacyLast = window.localStorage.getItem(LASTTEXT_KEY_LEGACY);
      if (scopedLast) setText(scopedLast);
      else if (legacyLast) setText(legacyLast);
    } catch {}

    // ✅ Init Gate：標記 hydration 完成（必須在 try/catch 之外，避免例外中斷）
    try {
      setHydrationDone(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [UILANG_KEY, THEME_KEY, LASTTEXT_KEY]);

  // ✅ 寫回：語言/主題/最後查詢（只寫 scoped key，避免不同 bucket 汙染）
  useEffect(() => {
    try {
      window.localStorage.setItem(UILANG_KEY, uiLang);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiLang, UILANG_KEY]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, THEME_KEY]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LASTTEXT_KEY, text);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, LASTTEXT_KEY]);


  // ============================================================
  // Query Preflight Normalize (LLM) — Task QN-0
  // 需求：查詢字先用 LLM 前置處理 → 回填查詢框 → 提示拼錯/不存在（紅字由下游 UI 決定如何 render）
  // - fail-open：normalize 掛了就照舊走原字
  // ============================================================
  const [queryHint, setQueryHint] = useState(null);

  const clearQueryHint = useCallback(() => {
    try {
      setQueryHint(null);
    } catch {}
  }, []);

  const preflightNormalizeQuery = useCallback(
    async (raw) => {
      const text0 = (raw ?? "").toString().trim();
      if (!text0) return { finalText: text0, hint: null };

      try {
        const res = await apiFetch("/api/query/normalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text0, uiLang: uiLang || "zh" }),
        });

        // apiFetch 可能直接回傳 json，也可能回傳 Response（依你專案的 apiClient 實作）
        const data = res && typeof res.json === "function" ? await res.json() : res;

        const finalText = String(
          data?.finalText ?? data?.normalized ?? data?.text ?? text0
        ).trim();

        // hint payload (UI): { type: "error" | "info", message, original, normalized }
        let hint = null;
        if (finalText && finalText !== text0) {
          hint = {
            type: "info",
            message: `已自動修正為：${finalText}`,
            original: text0,
            normalized: finalText,
          };
        } else if (data?.status === "not_found" || data?.status === "not_german") {
          hint = {
            type: "error",
            message: data?.message || "找不到這個字，可能拼錯或不是德文",
            original: text0,
            normalized: finalText || text0,
          };
        }

        return { finalText, hint };
      } catch {
        // fail-open
        return { finalText: text0, hint: null };
      }
    },
    [uiLang]
  );

  // ✅ handleTextChange：輸入時同步更新 text，並重置 index
  const handleTextChange = (v) => {
    setText(v);
    setHistoryIndex(-1);
    // 使用者開始輸入 → 清掉提示（避免紅字一直掛著）
    clearQueryHint();
  };

  /**
   * 功能：Analyze（字典）- 以指定文字觸發查詢（供點字觸發使用）
   * - 注意：保留既有 handleAnalyze() 不改其介面（避免影響 SearchBox 既有呼叫）
   */
  const handleAnalyzeByText = async (rawText, options = {}) => {
    // ============================================================
    // Preflight normalize (LLM) — may update the actual query text BEFORE analyze
    // - Only for direct user query / SearchBox by default
    // - fail-open: if anything fails, continue with original rawText
    // ============================================================
    let __rawText0 = (rawText ?? "").toString();
    let __rawText = __rawText0;

    // options.preflightNormalize === false → skip
    const __intent = options && typeof options.intent === "string" ? options.intent : "";
    const __shouldPreflight =
      options?.preflightNormalize !== false &&
      (__intent === "user-search" || __intent === "searchbox" || __intent === "" || __intent === "manual");

    // ✅ Task 5：若外部已提供「實際查詢字」（normalizedQuery），則直接用它，並跳過 preflight
    const __qOverride =
      options && typeof options.queryTextOverride === "string"
        ? options.queryTextOverride.trim()
        : "";
    if (__qOverride) {
      __rawText = __qOverride;
    }

    if (__shouldPreflight && !__qOverride) {
      const { finalText, hint } = await preflightNormalizeQuery(__rawText0);
      if (hint) {
        try {
          // ✅ 統一 queryHint 欄位：SearchBox 以 queryHint.text render
          const __h = hint && typeof hint === "object" ? hint : null;
          const __hint2 = __h ? ({ ...__h, text: (typeof __h.text === "string" && __h.text) ? __h.text : (typeof __h.message === "string" ? __h.message : "") }) : __h;
          setQueryHint(__hint2);
        } catch {}
      }
      if (finalText && typeof finalText === "string" && finalText.trim() && finalText.trim() !== __rawText0.trim()) {
        __rawText = finalText;
        // ⚠️ QN-0：不要覆寫使用者輸入（raw input 必須保留）
        // - 仍用 finalText 作為本次 analyze 的實際查詢字
        // - UI 若要提示更正，請使用 queryHint（下游決定如何顯示）
        // try {
        //   setText(finalText);
        // } catch {}
      }
    }
    const USE_SNAPSHOTSTORE_REPLAY_ONLY = true; // Task 4B-0：replay 唯一來源（避免舊 favoritesSnapshotStorage 誤判）

    // === [Favorites Snapshot Replay] ===
    // Task 1/2：
    // - 在 favorites-learning 狀態下，先嘗試用「可更新的 favorites snapshot」回放（命中就不打 API）
    // - 其餘模式完全不動
    try {
      if (mode === "learning" && learningContext?.sourceType === "favorites") {
        const __qForSnapshot = normalizeSearchQuery(__rawText, "favoritesSnapshotReplay");
        if (__qForSnapshot) {

          // Task 4B-0: SnapshotStore guard（命中才 early return；未命中完全走舊邏輯）
          // refKey 規則：
          // - 優先：headword::canonicalPos
          // - 若 canonicalPos 不可得：headword::__any（由 analyze 成功出口同步寫 alias）
          //
          // ⚠️ 重要：
          // - 這段必須在 handleAnalyzeByText(...) 的同一個 scope 內計算 refKey
          // - 不可依賴其他 useEffect 或外部 try block 的 refKey（避免 ReferenceError / 錯 key）
          try {
            const __lc =
              learningContext && typeof learningContext === "object"
                ? learningContext
                : null;

            const __items = Array.isArray(__lc?.items) ? __lc.items : [];
            const __idxRaw =
              typeof __lc?.index === "number" && Number.isFinite(__lc.index)
                ? __lc.index
                : -1;

            const __idx = __idxRaw >= 0 && __idxRaw < __items.length ? __idxRaw : -1;
            const __item = __idx >= 0 ? __items[__idx] : null;

            // 1) 先從 learning item 取 canonicalPos（若有）
            let __posForSnapshot = String(
              (__item &&
                (__item.canonicalPos ||
                  __item.canonical_pos ||
                  __item.pos ||
                  __item.partOfSpeech ||
                  __item.canonicalPOS)) ||
                ""
            ).trim();

            const __headForSnapshot = String(__qForSnapshot || "").trim();

            // 2) 若 item 沒有 pos：允許用「舊 favoritesSnapshotStorage」只做 pos hint（不做 replay source）
            //    目的：提升 snapshotStore 命中率，但不讓驗收被舊快取誤導
            if (!__posForSnapshot) {
              try {
                const __hintKey = normalizeSearchQuery(__headForSnapshot, "favoritesCache");
                // 2-1) 先從 memory cache 找（不觸發任何 return）
                const __memHint =
                  __hintKey && favoritesResultCacheRef.current
                    ? favoritesResultCacheRef.current.get(__hintKey)
                    : null;
                const __memPos = String(
                  (__memHint?.dictionary?.canonicalPos ||
                    __memHint?.dictionary?.canonical_pos ||
                    __memHint?.dictionary?.partOfSpeech ||
                    __memHint?.dictionary?.posKey ||
                    "") ||
                    ""
                ).trim();
                if (__memPos) __posForSnapshot = __memPos;
              } catch {}
            }

            if (!__posForSnapshot) {
              try {
                const __hintKey = normalizeSearchQuery(__headForSnapshot, "favoritesCache");
                const __legacyHint = __hintKey ? findFavoritesSnapshot(__hintKey) : null;
                const __legacyPos = String(
                  (__legacyHint?.dictionary?.canonicalPos ||
                    __legacyHint?.dictionary?.canonical_pos ||
                    __legacyHint?.dictionary?.partOfSpeech ||
                    __legacyHint?.dictionary?.posKey ||
                    "") ||
                    ""
                ).trim();
                if (__legacyPos) __posForSnapshot = __legacyPos;
              } catch {}
            }

            // 3) SnapshotStore 嘗試：若沒 pos → 用 __any alias
            const __refKeyAny = __headForSnapshot ? `${__headForSnapshot}::__any` : "";
            const __refKeyPos =
              __headForSnapshot && __posForSnapshot
                ? `${__headForSnapshot}::${__posForSnapshot}`
                : "";

            let snap = null;
            let __usedRefKey = "";
            if (__refKeyPos) {
              snap = getSnapshot(__refKeyPos);
              __usedRefKey = __refKeyPos;
            } else if (__refKeyAny) {
              snap = getSnapshot(__refKeyAny);
              __usedRefKey = __refKeyAny;
            }

            // dev-only debug：favorites replay hit/miss（僅觀察 SnapshotStore）
            try {
              if (import.meta?.env?.DEV) {
                console.debug("[snapshotStore][favorites-replay]", {
                  refKey: __usedRefKey,
                  hit: !!snap,
                  hasPos: !!__posForSnapshot,
                });
              }
            } catch {}

            if (snap) {
              setResult(snap);
              return;
            }
          } catch {
            // swallow snapshot errors（must never break old logic）
            try {
              if (import.meta?.env?.DEV) {
                console.debug("[snapshotStore][favorites-replay]", {
                  refKey: "",
                  hit: false,
                  error: true,
                });
              }
            } catch {}
          }

          // legacy favoritesSnapshotStorage replay（僅在允許 legacy replay 時啟用；不影響 SnapshotStore）
          if (!USE_SNAPSHOTSTORE_REPLAY_ONLY) {
            const __snapKey = normalizeSearchQuery(__qForSnapshot, "favoritesCache");
            const __snapshot = findFavoritesSnapshot(__snapKey);
            if (__snapshot) {
              setResult(__snapshot);
              return;
            }
          }
        }
      }
    } catch (e) {
      // swallow snapshot errors
    }
    // === [End Favorites Snapshot Replay] ===

    const q = normalizeSearchQuery(__rawText, "handleAnalyzeByText");
    if (!q) return;

    // ============================================================
    // Task B — Favorites/Learning replay：允許「只更新結果，不污染 history」
    // - options.noHistory=true：
    //   1) 不使用 history-hit 回放（避免 reorder history）
    //   2) 不寫入 history / 不改 historyIndex
    // - 注意：noHistory 只影響前端狀態，不動 DB、不新增 API
    // ============================================================
    const noHistory = !!(options && options.noHistory);

    // ============================================================
    // Task D — intent：主動新查詢時強制切回 Search/History
    // - 目的：在 Favorites/Learning 狀態下，使用者點字觸發「主動新查詢」時，
    //         UI 必須回到 search/history pipeline（避免仍卡在 favorites 導覽）。
    // - 規則（前端）：
    //   1) intent ∈ {"user-search", "searchbox"} && noHistory !== true
    //      → 若當下 mode !== "search"，先 enterSearchMode() 再查詢。
    //   2) replay（noHistory=true）一律不切 mode。
    // ============================================================
    const intent = (options && typeof options === "object" ? options.intent : "")
      ? String(options.intent).trim()
      : "";

    if (!noHistory && (intent === "user-search" || intent === "searchbox")) {
      if (mode !== "search") {
        try {
          enterSearchMode();
        } catch {}
      }
    }

    /**
     * ✅ 2026-01-06：詞性切換必須「強制重查」
     * 中文功能說明：
     * - 背景：既有 Phase X 有「命中 history 就回放、不打 API」的優化
     * - 但詞性切換（targetPosKey）同一個 q 需要打 API 才會回不同詞性結果
     * - 因此：只要 options.targetPosKey 存在 → 跳過 history 命中回放，直接打 /api/analyze
     */
    const hasTargetPosKey =
      options && typeof options?.targetPosKey === "string" && options.targetPosKey.trim();

    // ✅ 可控 runtime 觀察（你現在排查用）：確認是否被 history-hit 擋掉
    try {
      console.log("[App][posSwitch][handleAnalyzeByText] precheck", {
        q,
        hasTargetPosKey: !!hasTargetPosKey,
        targetPosKey: hasTargetPosKey ? options.targetPosKey : "",
      });
    } catch {}

    // ✅ Phase X：若命中 history，直接回放（不重打 /api/analyze）
    // ⚠️ 但詞性切換必須重查，所以 hasTargetPosKey=true 時跳過
    // ✅ Phase X：若命中 history，直接回放（不重打 /api/analyze）
    // ⚠️ 但：
    // - 詞性切換必須重查（hasTargetPosKey=true）
    // - Task B replay 必須 noHistory（不依賴 history / 不 reorder history）
    if (!hasTargetPosKey && !noHistory) {
      const hitIndex = findHistoryHitIndex(q);
      if (hitIndex !== -1) {
        const replayed = replayHistoryHit(hitIndex, q, "handleAnalyzeByText");
        if (replayed) return;
      }
    }

    setLoading(true);
    try {
      // ✅ 後端只需要它認得的 options；noHistory/source 屬於前端控制旗標，不應透傳
      const apiOptions = options && typeof options === "object" ? { ...options } : {};
      if (apiOptions && typeof apiOptions === "object") {
        delete apiOptions.noHistory;
        delete apiOptions.source;
        delete apiOptions.intent;
        delete apiOptions.queryTextOverride;
      }

      const res = await apiFetch(`/api/analyze`, {
        method: "POST",
        body: JSON.stringify({ text: q, rawText: __rawText0, uiLang, explainLang: uiLang, ...(apiOptions || {}) }),
      });

      if (!res) throw new Error("[analyze] response is null");
      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[analyze] POST /api/analyze failed: ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ""}`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      // ✅ Task F2：確保 snapshot 內含 examples（Array），避免 favorites replay/回放時被判定為無例句
      const __dict = (data && typeof data === "object" && data.dictionary && typeof data.dictionary === "object") ? data.dictionary : {};
      const __examples = Array.isArray(__dict.examples) ? __dict.examples : [];
      const dataWithExamples = (data && typeof data === "object") ? ({
        ...data,
        dictionary: {
          ...__dict,
          examples: __examples,
        },
      }) : data;

      __nlog("api:analyze:res", { kind: dataWithExamples?.kind || dataWithExamples?.mode, normalizedQuery: dataWithExamples?.normalizedQuery, rawInput: import.meta?.env?.VITE_DEBUG_NORMALIZE_TRACE_TEXT === "1" ? dataWithExamples?.rawInput : undefined });
      setResult(dataWithExamples);

      // ✅ Task 5：更新 display/query（只依賴後端 rawInput/normalizedQuery）
      try {
        if (typeof applyAnalyzeResult === "function") {
          applyAnalyzeResult(dataWithExamples, { rawTextSent: __rawText0, qSent: q });
        }
      } catch {}

      // Task 4B-0: SnapshotStore sidecar write（不改流程、不 return）
      // refKey 規則：headword + canonicalPos（以 :: 串接）
      try {
        const __hw = String(
          (dataWithExamples && dataWithExamples.dictionary && (dataWithExamples.dictionary.baseForm || dataWithExamples.dictionary.word)) ||
          q ||
          ""
        ).trim();
        const __pos = String(
          (dataWithExamples && dataWithExamples.dictionary && (dataWithExamples.dictionary.canonicalPos || dataWithExamples.dictionary.partOfSpeech)) ||
          ""
        ).trim();

        const refKey = (__hw && __pos) ? `${__hw}::${__pos}` : "";
        if (refKey) {
          upsertSnapshot(refKey, dataWithExamples, { source: "analyze" });
          // ✅ Task 4B-0：alias（headword::__any）— 當 favorites item 缺 canonicalPos 時仍可命中
          try {
            const __aliasKey = __hw ? `${__hw}::__any` : "";
            if (__aliasKey) {
              upsertSnapshot(__aliasKey, dataWithExamples, { source: "analyze" });
              // dev-only debug：確認 alias 寫入
              try {
                if (import.meta?.env?.DEV) {
                  console.debug("[snapshotStore][analyze-alias]", { refKey: __aliasKey, source: "analyze" });
                }
              } catch {}
            }
          } catch {}

          // ✅ Task 4B-1 harden: 另外以「learningContext item 的 pos」寫一份 key（提升 Refresh 後命中率）
          // - 不改 replay 邏輯，只增加寫入 key
          try {
            if (mode === "learning" && learningContext?.sourceType === "favorites") {
              const __qForSnapshot2 = normalizeSearchQuery(__rawText, "favoritesSnapshotReplay");
              const __lc2 =
                learningContext && typeof learningContext === "object" ? learningContext : null;
              const __items2 = Array.isArray(__lc2?.items) ? __lc2.items : [];
              const __idxRaw2 =
                typeof __lc2?.index === "number" && Number.isFinite(__lc2.index)
                  ? __lc2.index
                  : -1;
              const __idx2 =
                __idxRaw2 >= 0 && __idxRaw2 < __items2.length ? __idxRaw2 : -1;
              const __item2 = __idx2 >= 0 ? __items2[__idx2] : null;

              const __posFromItem2 = String(
                (__item2 &&
                  (__item2.canonicalPos ||
                    __item2.canonical_pos ||
                    __item2.pos ||
                    __item2.partOfSpeech ||
                    __item2.canonicalPOS)) ||
                  ""
              ).trim();

              const __head2 = String(__qForSnapshot2 || "").trim();
              const __lcKey2 =
                __head2 && __posFromItem2
                  ? `${__head2}::${__posFromItem2}`
                  : __head2
                    ? `${__head2}::__any`
                    : "";

              if (__lcKey2 && __lcKey2 !== refKey) {
                upsertSnapshot(__lcKey2, dataWithExamples, { source: "analyze" });
                try {
                  if (import.meta?.env?.DEV) {
                    console.debug("[snapshotStore][analyze-lc-key]", {
                      refKey: __lcKey2,
                      source: "analyze",
                    });
                  }
                } catch {}
              }
            }
          } catch {}

          if (import.meta?.env?.DEV) {
            try { console.debug("[snapshotStore][analyze]", { refKey, source: "analyze" }); } catch {}
          }
        }
      } catch {
        // no-op (must never break analyze flow)
      }


      // ============================================================
      // Task E — Favorites 瀏覽快取：只寫入 favorites replay 的「預設詞性」結果
      // 寫入條件：
      // - intent === "learning-replay"
      // - noHistory === true
      // - !options.targetPosKey（預設詞性）
      // - q 存在
      // 注意：
      // - 嚴禁把一般 search 結果塞進 cache（避免汙染）
      // ============================================================
      try {
        const shouldWriteFavoritesCache =
          noHistory &&
          intent === "learning-replay" &&
          !hasTargetPosKey &&
          typeof q === "string" &&
          q.trim();

        if (shouldWriteFavoritesCache) {
          // ✅ Task F2：favorites cacheKey 與 replay 讀取必須一致（normalizeSearchQuery(..., "favoritesCache")）
          const __favoritesCacheKey = normalizeSearchQuery(q, "favoritesCache");

          // ✅ Task F2：favoritesResultCache 的 snapshot 必須帶 examples（Array）
          // - 例句補齊後會回寫到 snapshot.dictionary.examples
          // - 這裡先保底，避免 cachedSnapshot 被判定為『無例句』
          const __safeSnapshot = (() => {
            try {
              const dd = data && typeof data === "object" ? data : null;
              const dict = dd && dd.dictionary && typeof dd.dictionary === "object" ? dd.dictionary : {};
              const ex = Array.isArray(dict.examples) ? dict.examples : [];
              return {
                ...(dd || {}),
                dictionary: {
                  ...(dict || {}),
                  examples: ex,
                },
              };
            } catch {
              return data;
            }
          })();

          // ✅ 使用一致 key 寫入 favorites cache（不可用原始 q 以免 miss）
          favoritesResultCacheRef.current.set(__favoritesCacheKey, __safeSnapshot);
          // ✅ Task 2：favorites snapshot 是快取但不是凍結；把最新結果寫回可更新 snapshot（LRU/LIMIT 由 storage 控制）
          try {
            upsertFavoritesSnapshot(__favoritesCacheKey, __safeSnapshot);
          } catch {}


          // ✅ 可控 debug（避免噪音）：只有開 DEBUG=search 才印
          if (isSearchDebugEnabled()) {
            try {
              console.debug("[favorites][cache] write", {
                key: __favoritesCacheKey,
                size: favoritesResultCacheRef.current.size,
              });
            } catch {}
          }
        }
      } catch {}

      // ✅ Task B：noHistory 時只更新結果，不寫入 history
      if (noHistory) return;

      const headword = (data?.dictionary?.baseForm || data?.dictionary?.word || q).trim();
      const canonicalPos = (data?.dictionary?.canonicalPos || data?.dictionary?.partOfSpeech || "").trim();

      // ✅ Phase 1+：analyze 後同步帶上 user_words / dict 相關欄位（僅紀錄，不生成新資料）
      // - 目的：讓後續收藏/寫 DB 時能直接沿用這次 analyze 的欄位（避免 UI/DB 不一致）
      const senseIndexRaw = data?.dictionary?.senseIndex ?? data?.dictionary?.sense_index ?? 0;
      const senseIndex = Number.isInteger(senseIndexRaw)
        ? senseIndexRaw
        : Number.isFinite(Number(senseIndexRaw))
        ? Number(senseIndexRaw)
        : 0;

      const headwordGloss = (() => {
        try {
          const v =
            data?.dictionary?.headwordGloss ??
            data?.dictionary?.headword_gloss ??
            data?.dictionary?.gloss ??
            "";
          return typeof v === "string" ? v : "";
        } catch {
          return "";
        }
      })();

      const headwordGlossLang = (() => {
        try {
          const v =
            data?.dictionary?.headwordGlossLang ??
            data?.dictionary?.headword_gloss_lang ??
            "";
          return typeof v === "string" ? v : "";
        } catch {
          return "";
        }
      })();

      const key = `${headword}::${canonicalPos}`;
      setHistory((prev) => {
        const next = prev.filter((x) => (x?.key || "") !== key);
        return [
          {
            key,
            text: q,
            headword,
            canonicalPos,
            senseIndex,
            headwordGloss,
            headwordGlossLang,
            createdAt: new Date().toISOString(),
            resultSnapshot: data,
          },
          ...next,
        ].slice(0, HISTORY_LIMIT);
      });
      setHistoryIndex(0);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 功能：詞性切換（Adjektiv / Adverb ...）
   * 中文功能說明：
   * - 由 WordCard → ResultPanel 回拋 clickedPosKey，App 再觸發 /api/analyze 並帶 targetPosKey
   * - 目的：同一個字可在不同詞性間切換，並且視為不同歷史紀錄（key 由後端 canonicalPos 決定）
   *
   * 功能初始化狀態（Production 排查）：
   * - 若 clickedPosKey 缺失：直接 return，不拋錯
   * - 若點擊的詞性等於目前 activePosKey：不重查（避免重複查詢）
   */
  const handleSelectPosKey = async (payload) => {
    try {
      const clickedPosKey = (payload?.clickedPosKey || payload?.posKey || "").toString().trim();
      const word = (payload?.word || payload?.text || payload?.headword || "").toString().trim();

      const activePosKey =
        (payload?.activePosKey ||
          result?.dictionary?.posKey ||
          result?.dictionary?.canonicalPos ||
          result?.dictionary?.partOfSpeech ||
          "")
          .toString()
          .trim();

      // ✅ 需求：點擊一定要生效（不能只 console），因此：
      // - 若命中 history snapshot：直接 setResult/setHistoryIndex（即時 UI 變化）
      // - 若未命中：一定要重新打 /api/analyze（帶 targetPosKey）以觸發重新分析/例句
      //   （handleAnalyzeByText 已內建：targetPosKey 會跳過 history-hit 回放 → 強制打 API）
      try {
        console.log("[App][posSwitch] handleSelectPosKey", {
          clickedPosKey,
          activePosKey,
          word,
          hasClickedPosKey: !!clickedPosKey,
          hasWord: !!word,
        });
      } catch {}

      if (!clickedPosKey || !word) return;
      if (clickedPosKey === activePosKey) return;

      // ✅ 先嘗試命中既有 history（同字不同 POS 的快照）
      const hitIndex = history.findIndex((h) => {
        const t = (h?.text || "").toString().trim();
        if (t !== word) return false;
        const posKey = (h?.resultSnapshot?.dictionary?.posKey || "").toString().trim();
        const canonicalPos = (h?.resultSnapshot?.dictionary?.canonicalPos || "").toString().trim();
        const partOfSpeech = (h?.resultSnapshot?.dictionary?.partOfSpeech || "").toString().trim();
        return posKey === clickedPosKey || canonicalPos === clickedPosKey || partOfSpeech === clickedPosKey;
      });

      if (hitIndex >= 0) {
        const snapshot = history[hitIndex]?.resultSnapshot;
        if (snapshot) {
          setHistoryIndex(hitIndex);
          setResult(snapshot);
          return;
        }
      }

      // ✅ 必須重查：帶 targetPosKey 觸發後端用指定詞性重新分析/產生例句
      await handleAnalyzeByText(word, { targetPosKey: clickedPosKey, queryMode: "pos_switch" });
      return;
    } catch (err) {
      console.warn("[App][posSwitch] handleSelectPosKey error", err);
    }
  };

  // ✅ 查詢：Analyze（字典）
  const handleAnalyze = async () => {
    
    __nlog("handleAnalyze:start", { displayTextLen: (displayText||text||"").toString().length, queryTextLen: (queryText||"").toString().length, displayText: import.meta?.env?.VITE_DEBUG_NORMALIZE_TRACE_TEXT === "1" ? (displayText||"") : undefined, queryText: import.meta?.env?.VITE_DEBUG_NORMALIZE_TRACE_TEXT === "1" ? (queryText||"") : undefined });
// ✅ Task 5：實際送出的查詢字必須走 normalizedQuery（queryText）優先，且 trim；括號不污染查詢
    const __hasBuild = typeof buildQueryForSubmit === "function";
    const { q: __q0, rawText: __rawText0 } = __hasBuild
      ? buildQueryForSubmit()
      : { q: normalizeSearchQuery(text, "handleAnalyze"), rawText: (text || "").toString() };
    __nlog("handleAnalyze:query", { q: (__q0||"").toString().trim(), rawText: import.meta?.env?.VITE_DEBUG_NORMALIZE_TRACE_TEXT === "1" ? __rawText0 : undefined });
    const q = (__q0 || "").toString().trim();
    if (!q) return;

    // ============================================================
    // Task D — intent：SearchBox 主動查詢
    // - 統一走 handleAnalyzeByText（含：必要時切回 search/history + history-hit 回放 + 寫入 history）
    // - 保留下方既有 legacy 實作（避免誤刪；但此處 return 後不會再執行）
    // ============================================================
    return await handleAnalyzeByText(__rawText0, { intent: "searchbox", queryTextOverride: q });

    // ✅ Phase X：若命中 history，直接回放（不重打 /api/analyze）
    const hitIndex = findHistoryHitIndex(q);
    if (hitIndex !== -1) {
      const replayed = replayHistoryHit(hitIndex, q, "handleAnalyze");
      if (replayed) return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(`/api/analyze`, {
        method: "POST",
        body: JSON.stringify({ text: q, uiLang, explainLang: uiLang }),
      });

      if (!res) throw new Error("[analyze] response is null");
      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[analyze] POST /api/analyze failed: ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ""}`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      setResult(data);

      const headword = (data?.dictionary?.baseForm || data?.dictionary?.word || q).trim();
      const canonicalPos = (data?.dictionary?.canonicalPos || data?.dictionary?.partOfSpeech || "").trim();

      // ✅ Phase 1+：analyze 後同步帶上 user_words / dict 相關欄位（僅紀錄，不生成新資料）
      // - 目的：讓後續收藏/寫 DB 時能直接沿用這次 analyze 的欄位（避免 UI/DB 不一致）
      const senseIndexRaw = data?.dictionary?.senseIndex ?? data?.dictionary?.sense_index ?? 0;
      const senseIndex = Number.isInteger(senseIndexRaw)
        ? senseIndexRaw
        : Number.isFinite(Number(senseIndexRaw))
        ? Number(senseIndexRaw)
        : 0;

      const headwordGloss = (() => {
        try {
          const v =
            data?.dictionary?.headwordGloss ??
            data?.dictionary?.headword_gloss ??
            data?.dictionary?.gloss ??
            "";
          return typeof v === "string" ? v : "";
        } catch {
          return "";
        }
      })();

      const headwordGlossLang = (() => {
        try {
          const v =
            data?.dictionary?.headwordGlossLang ??
            data?.dictionary?.headword_gloss_lang ??
            "";
          return typeof v === "string" ? v : "";
        } catch {
          return "";
        }
      })();

      const key = `${headword}::${canonicalPos}`;
      setHistory((prev) => {
        const next = prev.filter((x) => (x?.key || "") !== key);
        return [
          {
            key,
            text: q,
            headword,
            canonicalPos,
            senseIndex,
            headwordGloss,
            headwordGlossLang,
            createdAt: new Date().toISOString(),
            resultSnapshot: data,
          },
          ...next,
        ].slice(0, HISTORY_LIMIT);
      });
      setHistoryIndex(0);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 功能：點擊字卡/例句中的德文字 → 觸發新查詢
   * - 注意：library 改彈窗後，不再需要切回 view=search 才看得到結果
   */
  const handleWordClick = (rawWord) => {
    const q = normalizeSearchQuery(rawWord, "handleWordClick");
    if (!q) return;

    setText(q);
    setHistoryIndex(-1);
    handleAnalyzeByText(q, { intent: "user-search" });
  };

  // ✅ 單字庫/收藏 controller（已拆出）
  const {
    isFavorited,
    handleToggleFavorite,
    handleUpdateSenseStatus,
    openLibraryModal,
    closeLibraryModal,
    handleLibraryReview,
    handleSelectFavoriteCategory,
    handleSelectFavoriteCategoryForAdd,
    // ✅ 2026-01-17：favorites categories CRUD（管理分類 modal 串接）
    createFavoriteCategoryViaApi,
    renameFavoriteCategoryViaApi,
    reorderFavoriteCategoriesViaApi,
    archiveFavoriteCategoryViaApi,
    isFavoriteCategoriesSaving,
    favoriteCategoriesSavingError,
    // ✅ 2026-01-16：B(UI) pending/key（UI 禁止連點用；UI 不做交易邏輯）
    isFavoritePending,
    getFavoriteWordKey,
  } = useLibraryController({
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
  });
  // ============================================================
  // 2026-01-14：Task 2-1｜切換分類時主畫面星號即時連動（後端分類狀態 API）
  // - 星號亮暗以「分類內是否存在 link」為準（不得用全域收藏）
  // - 觸發：分類切換 / 查詢新單字 / 點星號收藏或取消後
  // - API：GET /api/library/favorites/category-status
  // ============================================================

  const [favoriteInSelectedCategory, setFavoriteInSelectedCategory] = useState(false);
  const [favoriteCategoryStatusLoading, setFavoriteCategoryStatusLoading] = useState(false);

  // ✅ 避免 race：只採用最後一次請求的結果
  const favoriteCategoryStatusReqSeqRef = useRef(0);

  // ✅ 從目前查詢結果推導「要查分類狀態」所需 key
  const currentCategoryStatusKey = useMemo(() => {
    const hw = (
      result?.dictionary?.baseForm ||
      result?.dictionary?.word ||
      result?.dictionary?.headword ||
      ""
    )
      .toString()
      .trim();

    const pos = (
      result?.dictionary?.canonicalPos ||
      result?.dictionary?.canonical_pos ||
      result?.dictionary?.partOfSpeech ||
      result?.dictionary?.posKey ||
      ""
    )
      .toString()
      .trim();

    const siRaw =
      result?.dictionary?.senseIndex ??
      result?.dictionary?.sense_index ??
      0;

    const si = Number.isInteger(siRaw)
      ? siRaw
      : Number.isFinite(Number(siRaw))
      ? Number(siRaw)
      : 0;

    if (!hw || !pos) return null;

    return {
      headword: hw,
      canonical_pos: pos,
      sense_index: si,
    };
  }, [result]);

  const fetchFavoriteCategoryStatus = async ({ reason = "" } = {}) => {
    // 未登入 / 未啟用 API：保守顯示暗
    if (!USE_API_LIBRARY || !authUserId) {
      setFavoriteInSelectedCategory(false);
      return { ok: false, inCategory: false, skipped: true };
    }

    const cidRaw = selectedFavoriteCategoryId;
    const cidNum = Number.parseInt(String(cidRaw ?? ""), 10);
    const category_id = Number.isFinite(cidNum) && cidNum > 0 ? cidNum : null;

    // 沒選分類或沒有當前字卡：保守顯示暗
    if (!category_id || !currentCategoryStatusKey) {
      setFavoriteInSelectedCategory(false);
      return { ok: true, inCategory: false, skipped: true };
    }

    const seq = (favoriteCategoryStatusReqSeqRef.current || 0) + 1;
    favoriteCategoryStatusReqSeqRef.current = seq;

    setFavoriteCategoryStatusLoading(true);

    try {
      const qs = new URLSearchParams();
      qs.set("headword", String(currentCategoryStatusKey.headword));
      qs.set("canonical_pos", String(currentCategoryStatusKey.canonical_pos));
      qs.set("sense_index", String(currentCategoryStatusKey.sense_index));
      qs.set("category_id", String(category_id));

      const res = await apiFetch(`/api/library/favorites/category-status?${qs.toString()}`, {
        method: "GET",
      });

      if (!res) throw new Error("[favorites][category-status] response is null");

      if (res.status === 401 || res.status === 403) {
        // token / session 問題：保守顯示暗
        if (favoriteCategoryStatusReqSeqRef.current === seq) {
          setFavoriteInSelectedCategory(false);
        }
        return { ok: false, inCategory: false, unauthorized: true };
      }

      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {}
        throw new Error(
          `[favorites][category-status] GET failed: ${res.status} ${res.statusText}${detail ? " | " + detail : ""}`
        );
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      const inCategory = !!data?.inCategory;

      if (favoriteCategoryStatusReqSeqRef.current === seq) {
        setFavoriteInSelectedCategory(inCategory);
      }

      if (isLibraryDebugEnabled()) {
        try {
          console.debug("[favorites][category-status] ok", {
            reason: reason || "",
            key: currentCategoryStatusKey,
            category_id,
            inCategory,
          });
        } catch {}
      }

      return { ok: true, inCategory };
    } catch (e) {
      if (favoriteCategoryStatusReqSeqRef.current === seq) {
        // 失敗：保守顯示暗，避免誤亮
        setFavoriteInSelectedCategory(false);
      }

      if (isLibraryDebugEnabled()) {
        try {
          console.warn("[favorites][category-status] failed", e);
        } catch {}
      }

      return { ok: false, inCategory: false, error: e };
    } finally {
      if (favoriteCategoryStatusReqSeqRef.current === seq) {
        setFavoriteCategoryStatusLoading(false);
      }
    }
  };

  // ✅ 觸發 1：分類切換
  useEffect(() => {
    fetchFavoriteCategoryStatus({ reason: "category-changed" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFavoriteCategoryId]);

  // ✅ 觸發 2：顯示新單字（查詢結果變更）
  useEffect(() => {
    fetchFavoriteCategoryStatus({ reason: "result-changed" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentCategoryStatusKey?.headword,
    currentCategoryStatusKey?.canonical_pos,
    currentCategoryStatusKey?.sense_index,
  ]);

  // ✅ ResultPanel/WordCard 會呼叫 isFavorited(entry)：這裡改為「分類狀態優先」，避免依賴 libraryItems 是否剛好載入到
  const isFavoritedForUI = (entry) => {
    // 若 entry = 當前畫面顯示的字卡，就直接回 Task 2-1 的 inCategory
    try {
      const eHeadword = (
        entry?.headword ||
        entry?.baseForm ||
        entry?.word ||
        entry?.lemma ||
        entry?.text ||
        ""
      )
        .toString()
        .trim();

      const ePos = (
        entry?.canonical_pos ||
        entry?.canonicalPos ||
        entry?.canonicalPOS ||
        entry?.partOfSpeech ||
        entry?.posKey ||
        ""
      )
        .toString()
        .trim();

      const eSiRaw = entry?.sense_index ?? entry?.senseIndex ?? 0;
      const eSi = Number.isInteger(eSiRaw)
        ? eSiRaw
        : Number.isFinite(Number(eSiRaw))
        ? Number(eSiRaw)
        : 0;

      if (
        currentCategoryStatusKey &&
        eHeadword &&
        ePos &&
        eHeadword === currentCategoryStatusKey.headword &&
        ePos === currentCategoryStatusKey.canonical_pos &&
        eSi === currentCategoryStatusKey.sense_index
      ) {
        return !!favoriteInSelectedCategory;
      }
    } catch {
      // fallthrough
    }

    // fallback：維持既有 controller 的判斷（例如 Test mode / Library modal）
    if (typeof isFavorited === "function") return !!isFavorited(entry);
    return false;
  };

  // ✅ 點星號後：先走既有 toggle，再拉一次 category-status 對齊（避免只靠 optimistic）
  const handleToggleFavoriteForUI = (entry, options = {}) => {
  // ✅ 2026-01-14：取消收藏（unfavorite）必須帶 category_id（links-first）
  // - 若呼叫端沒帶，就用目前選到的分類 selectedFavoriteCategoryId
  const fallbackCategoryIdRaw = selectedFavoriteCategoryId;
  const fallbackCategoryId = Number.isInteger(fallbackCategoryIdRaw)
    ? fallbackCategoryIdRaw
    : Number.isFinite(Number(fallbackCategoryIdRaw))
    ? Number(fallbackCategoryIdRaw)
    : 0;

  const nextOptions =
    options && typeof options === "object"
      ? {
          ...options,
          ...(options.category_id || options.categoryId
            ? {}
            : fallbackCategoryId > 0
            ? { category_id: fallbackCategoryId }
            : {}),
        }
      : fallbackCategoryId > 0
      ? { category_id: fallbackCategoryId }
      : {};

  if (typeof handleToggleFavorite === "function") {
    handleToggleFavorite(entry, nextOptions);
  }

  // 只有在「當前畫面有分類選擇」才需要刷新狀態
  try {
    window.setTimeout(() => {
      fetchFavoriteCategoryStatus({ reason: "after-toggle" });
    }, 200);
  } catch {}
};



  // ============================================================
  // Task 3 — Favorites Learning：goPrev/goNext 需要讀『最新 learningContext』
  // - 用 ref 避免 navContext.goPrev/goNext 閉包拿到舊 index
  // ============================================================
  const learningContextRef = useRef(null);
  useEffect(() => {
    learningContextRef.current = learningContext;
  }, [learningContext]);

  // ============================================================
  // Task B — Favorites/Learning：取得 item 的查詢 headword（唯一規則，禁止 UI fallback chain）
  // - 規則：只認 item.headword（string），其他欄位一律不採用
  // - 原因：replay 的資料來源必須穩定，避免 UI/後端欄位不一致導致「翻頁不翻結果」
  // ============================================================
  const getItemHeadword = (item) => {
    try {
      const v = item && typeof item === "object" ? item.headword : "";
      return typeof v === "string" ? v.trim() : "";
    } catch {
      return "";
    }
  };

  // ============================================================
  // Task B — Favorites/Learning：index 改變 → replay current item（必須換結果內容）
  // - 觸發：mode="learning" && sourceType="favorites" && index 變動
  // - 動作：handleAnalyzeByText(headword, { noHistory:true })
  // - Guard：lastReplayedHeadwordRef（避免相同 headword 重覆觸發造成 loop）
  // ============================================================
  const lastReplayedHeadwordRef = useRef("");
  useEffect(() => {
    if (mode !== "learning") return;
    if (!learningContext || learningContext.sourceType !== "favorites") return;

    // 僅以 index 作為切換觸發；items 透過 ref 讀取最新（避免 deps 放 items 造成不穩定）
    const lc = learningContextRef.current || learningContext;
    const items = Array.isArray(lc?.items) ? lc.items : [];
    if (items.length <= 0) return;

    const rawIndex = typeof lc?.index === "number" && Number.isFinite(lc.index) ? lc.index : -1;
    if (rawIndex < 0) return;
    const index = rawIndex >= items.length ? items.length - 1 : rawIndex;

    const item = items[index];
    const headword = getItemHeadword(item);
    if (!headword) return;

    // guard：同一個 headword 不重播（避免某些 setState 觸發 effect 重入）
    if (lastReplayedHeadwordRef.current === headword) return;
    lastReplayedHeadwordRef.current = headword;

    // ============================================================
    // Task E — Favorites replay：cache-first（僅預設詞性）
    // - cache hit：直接 setResult(snapshot)，不打 /api/analyze
    // - cache miss：沿用既有 handleAnalyzeByText（noHistory=true）
    // - 注意：pos switch（有 targetPosKey）不走此路徑（handleSelectPosKey 會帶 targetPosKey）
    // ============================================================
    try {
      const cacheKey = normalizeSearchQuery(headword, "favoritesCache");

      if (
        typeof cacheKey === "string" &&
        cacheKey.trim() &&
        favoritesResultCacheRef.current &&
        favoritesResultCacheRef.current.has(cacheKey)
      ) {
        const cached = favoritesResultCacheRef.current.get(cacheKey);
        if (cached) {
          setResult(cached);

          // ✅ 可控 debug（避免噪音）：只有開 DEBUG=search 才印
          if (isSearchDebugEnabled()) {
            try {
              console.debug("[favorites][cache] hit", {
                key: cacheKey,
                size: favoritesResultCacheRef.current.size,
              });
            } catch {}
          }

          return;
        }
      }
    } catch {}

    // ✅ cache miss：只更新結果，不污染 history、不切 mode
    handleAnalyzeByText(headword, {
      noHistory: true,
      intent: "learning-replay",
      source: "learning-favorites-replay",
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, learningContext?.sourceType, learningContext?.index]);
  // ============================================================
  // Task 3 — Favorites Learning → navContext 映射（Learning 模式）
  // 條件：mode === "learning" && learningContext?.sourceType === "favorites"
  // - Favorites 順序固定：prev=index-1, next=index+1（方向鎖死）
  // - label 固定欄位：item.headword（禁止 UI fallback chain）
  // - goPrev/goNext 只能改 learningContext.index（禁止動 historyIndex）
  // ============================================================
  useEffect(() => {
    const lc = learningContext;

    // 只在 learning + favorites 時接管 navContext
    if (mode !== "learning") return;
    if (!lc || lc.sourceType !== "favorites") return;

    const items = Array.isArray(lc.items) ? lc.items : [];
    const total = items.length;

    // safety：沒有 items 就先清空（避免 UI 誤判）
    if (total <= 0) {
      setNavContext({
        source: "favorites",
        items: [],
        total: 0,
        index: -1,
        currentLabel: "",
        prevLabel: "",
        nextLabel: "",
        canPrev: false,
        canNext: false,
        goPrev: () => {},
        goNext: () => {},
      });
      return;
    }

    // clamp index
    const rawIndex =
      typeof lc.index === "number" && Number.isFinite(lc.index) ? lc.index : 0;
    const index = rawIndex < 0 ? 0 : rawIndex >= total ? total - 1 : rawIndex;

    const getLabelByIndex = (i) => {
      if (i < 0 || i >= total) return "";
      const it = items[i];
      return typeof it?.headword === "string" ? it.headword : "";
    };

    const prevTargetIndex = index - 1;
    const nextTargetIndex = index + 1;

    const canPrev = index > 0;
    const canNext = index < total - 1;

    // ✅ 用 ref 讀最新 learningContext，避免閉包拿到舊 index
    const goPrev = () => {
      const cur = learningContextRef.current;
      if (!cur || cur.sourceType !== "favorites") return;

      const curItems = Array.isArray(cur.items) ? cur.items : [];
      const curTotal = curItems.length;
      const curIndex =
        typeof cur.index === "number" && Number.isFinite(cur.index) ? cur.index : 0;

      if (curTotal <= 0) return;
      if (curIndex <= 0) return;

      updateLearningContext({ index: curIndex - 1 });
    };

    const goNext = () => {
      const cur = learningContextRef.current;
      if (!cur || cur.sourceType !== "favorites") return;

      const curItems = Array.isArray(cur.items) ? cur.items : [];
      const curTotal = curItems.length;
      const curIndex =
        typeof cur.index === "number" && Number.isFinite(cur.index) ? cur.index : 0;

      if (curTotal <= 0) return;
      if (curIndex >= curTotal - 1) return;

      updateLearningContext({ index: curIndex + 1 });
    };

    setNavContext({
      source: "favorites",
      items,
      total,
      index,
      currentLabel: getLabelByIndex(index),
      prevLabel: getLabelByIndex(prevTargetIndex),
      nextLabel: getLabelByIndex(nextTargetIndex),
      canPrev,
      canNext,
      goPrev,
      goNext,
    });
  }, [mode, learningContext, setNavContext, updateLearningContext]);

  const canClearHistory = historyIndex >= 0 && historyIndex < history.length;

  

  // ============================================================
  // Task F2 — Favorites/Learning：例句補齊後回寫 favoritesResultCache（持久顯示）
  // - 只在 mode=learning 且 learningContext.sourceType=favorites 啟用
  // - examples 必須寫回 favoritesResultCacheRef.current 的 result snapshot（dictionary.examples）
  // - cacheKey 必須與 favorites replay 讀取一致（normalizeSearchQuery(headword, "favoritesCache")）
  // ============================================================
  const isFavoritesLearning =
    mode === "learning" &&
    learningContext &&
    learningContext.sourceType === "favorites";

  // ✅ 2026/01/20（需求變更）：取消 favorites-learning 不自動打 /api/dictionary/examples
  // - 需求：學習本連到 ResultPanel，希望「直接自動產生例句 + 翻譯」
  // - 決策：favorites-learning 一律啟用 auto-refresh（避免回到學習狀態時漏翻譯）
  // - 注意：若日後要控 token，可在 useExamples 端加「只補缺翻譯」的 guard（本檔先不改下游）
  //
  // ===== 舊邏輯（deprecated）：只有「目前沒有例句」才允許自動產生 =====
  // ✅ 只在「學習本/我的最愛」且「目前這張卡沒有例句」時才允許自動產生
  // - 目的：學習本進 ResultPanel 時能自動補齊一次
  // - 避免：已有例句或 Prev/Next 重播時重複打例句 API
  const hasExamplesNow__deprecated =
    Array.isArray(result?.dictionary?.examples)
      ? result.dictionary.examples.length > 0
      : false;

  const examplesAutoRefreshEnabled__deprecated =
    isFavoritesLearning ? !hasExamplesNow__deprecated : true;

  // ✅ 新邏輯：favorites-learning 一律開啟（上游接線永遠傳 boolean，避免 undefined）
  const examplesAutoRefreshEnabled = isFavoritesLearning ? true : true;

  // ✅ 可控 debug（避免噪音）：DEBUG 包含 examples 才印
  if (isExamplesDebugEnabled()) {
    try {
      console.debug("[examples][autoRefresh] computed", {
        mode: mode || "not available",
        sourceType: learningContext?.sourceType || "not available",
        isFavoritesLearning: !!isFavoritesLearning,
        hasExamplesNow__deprecated: !!hasExamplesNow__deprecated,
        examplesAutoRefreshEnabled__deprecated: !!examplesAutoRefreshEnabled__deprecated,
        examplesAutoRefreshEnabled: !!examplesAutoRefreshEnabled,
      });
    } catch {}
  }


  const handleFavoritesExamplesResolved = (examplesArray, meta) => {
  // === FIX: ensure updatedResult is used consistently ===
    // Task 4C-fix: single write-back to SnapshotStore (no loop)
    try {
      if (result) {
        // ✅ 規則：只在 examples 成功補齊後回寫（此 handler 只在成功時被呼叫）
        const prev = result && typeof result === "object" ? result : null;
        if (!prev) return;

        const prevDict =
          prev.dictionary && typeof prev.dictionary === "object"
            ? prev.dictionary
            : {};

        const nextExamples = Array.isArray(examplesArray) ? examplesArray : [];

        const nextExampleTranslation =
          typeof meta?.exampleTranslation === "string"
            ? meta.exampleTranslation.trim()
            : "";

        const updatedResult = {
          ...prev,
          dictionary: {
            ...prevDict,
            example: nextExamples,
            examples: nextExamples,
            ...(nextExampleTranslation ? { exampleTranslation: nextExampleTranslation } : {}),
          },
        };

        // ✅ Task 4C-0：同頁即時補齊 result（避免 d.exampleTranslation 仍空而導致重打）
        try {
          // 同步 header 欄位（僅在有 meta 時覆蓋；避免因後續重播仍看到舊 headword）
          if (meta && meta.displayHeadword) {
            updatedResult.dictionary.headword = meta.displayHeadword;
          }
          if (meta && meta.article !== undefined) {
            updatedResult.dictionary.article = meta.article;
          }

          setResult(updatedResult);
        } catch {}

        // ✅ Task 4C-A: 同步回寫 history snapshot（避免切換時回放舊資料）
        try {
          if (typeof historyIndex === "number" && historyIndex >= 0 && Array.isArray(history)) {
            setHistory((prevHistory) => {
              if (!Array.isArray(prevHistory) || !prevHistory[historyIndex]) return prevHistory;
              const nextHistory = prevHistory.slice();
              nextHistory[historyIndex] = {
                ...prevHistory[historyIndex],
                resultSnapshot: updatedResult,
              };
              return nextHistory;
            });
          }
        } catch {}



        // ✅ refKey：優先使用 meta.refKey；否則用 headword::canonicalPos；最後用 headword::__any
        let refKey = "";
        try {
          if (typeof meta?.refKey === "string" && meta.refKey.trim()) {
            refKey = meta.refKey.trim();
          } else {
            const hw = String(
              prevDict?.baseForm || prevDict?.word || prevDict?.headword || ""
            ).trim();
            const pos = String(
              prevDict?.canonicalPos || prevDict?.canonical_pos || prevDict?.partOfSpeech || ""
            ).trim();

            if (hw && pos) refKey = `${hw}::${pos}`;
            else if (hw) refKey = `${hw}::__any`;
          }
        } catch {
          refKey = "";
        }

        if (refKey) {
          // ✅ 4C：只在「更完整」時才回寫（避免無謂寫入 / 避免較差資料覆蓋）
          try {
            upsertIfImproved(refKey, getSnapshot(refKey), updatedResult, {
              source: "examples-resolved",
            });
          } catch {}

          // ✅ alias：headword::__any（避免 favorites item 缺 canonicalPos 時 miss）
          try {
            const hwAlias = String(
              prevDict?.baseForm || prevDict?.word || prevDict?.headword || ""
            ).trim();
            const aliasKey = hwAlias ? `${hwAlias}::__any` : "";
            if (aliasKey) {
              upsertIfImproved(aliasKey, getSnapshot(aliasKey), updatedResult, {
                source: "examples-resolved",
              });
            }
          } catch {}

          // ✅ harden：同一份 updatedResult 也寫入「其他可能的 headword 變體」（提升命中率）
          // - 常見情境：查詢字形是變格/變位（例如：des Berges），但 dictionary.baseForm 是 Berg
          try {
            const pos2 = String(
              prevDict?.canonicalPos || prevDict?.canonical_pos || prevDict?.partOfSpeech || ""
            ).trim();

            const hwVariants = [
              String(prevDict?.word || "").trim(),
              String(prevDict?.baseForm || "").trim(),
              String(prevDict?.headword || "").trim(),
            ].filter((x, i, arr) => x && arr.indexOf(x) === i);

            hwVariants.forEach((hwv) => {
              const k = pos2 ? `${hwv}::${pos2}` : `${hwv}::__any`;
              if (!k) return;
              try {
                upsertIfImproved(k, getSnapshot(k), updatedResult, {
                  source: "examples-resolved",
                });
              } catch {}
            });
          } catch {}

          // ✅ Task 4B-1 harden: 用 learningContext item 的 pos 再寫一次 key（提升 Refresh 後命中率）
          // - 不改 replay / analyze / history，只增加寫入 key
          try {
            if (mode === "learning" && learningContext?.sourceType === "favorites") {
              const __hw3 = String(
                prevDict?.baseForm || prevDict?.word || prevDict?.headword || ""
              ).trim();
              const __q3 = normalizeSearchQuery(__hw3, "favoritesSnapshotReplay");
              const __lc3 =
                learningContext && typeof learningContext === "object" ? learningContext : null;
              const __items3 = Array.isArray(__lc3?.items) ? __lc3.items : [];
              const __idxRaw3 =
                typeof __lc3?.index === "number" && Number.isFinite(__lc3.index)
                  ? __lc3.index
                  : -1;
              const __idx3 =
                __idxRaw3 >= 0 && __idxRaw3 < __items3.length ? __idxRaw3 : -1;
              const __item3 = __idx3 >= 0 ? __items3[__idx3] : null;

              const __posFromItem3 = String(
                (__item3 &&
                  (__item3.canonicalPos ||
                    __item3.canonical_pos ||
                    __item3.pos ||
                    __item3.partOfSpeech ||
                    __item3.canonicalPOS)) ||
                  ""
              ).trim();

              const __head3 = String(__q3 || "").trim();
              const __lcKey3 =
                __head3 && __posFromItem3
                  ? `${__head3}::${__posFromItem3}`
                  : __head3
                    ? `${__head3}::__any`
                    : "";

              if (__lcKey3 && __lcKey3 !== refKey) {
                upsertSnapshot(__lcKey3, updatedResult, { source: "examples-resolved" });
                try {
                  if (import.meta?.env?.DEV) {
                    console.debug("[snapshotStore][examples-resolved-lc-key]", {
                      refKey: __lcKey3,
                      source: "examples-resolved",
                    });
                  }
                } catch {}
              }
            }
          } catch {}


          // dev-only debug：examples-resolved
          try {
            if (import.meta?.env?.DEV) {
              console.debug("[snapshotStore][examples-resolved]", {
                refKey,
                source: "examples-resolved",
                hasExamples: Array.isArray(nextExamples) && nextExamples.length > 0,
                hasExampleTranslation: !!nextExampleTranslation,
              });
            }
          } catch {}
        }
      }
    } catch {}

    try {
      if (!(mode === "learning" && learningContext && learningContext.sourceType === "favorites")) {
        return;
      }

      // ✅ headword 取得方式與 favorites replay 一致（優先用 learningContext 當下 item.headword）
      const lc = learningContext;
      const items = Array.isArray(lc?.items) ? lc.items : [];
      const idx =
        typeof lc?.index === "number" && Number.isFinite(lc.index) ? lc.index : -1;
      const item = idx >= 0 && idx < items.length ? items[idx] : null;

      const headword =
        (item && getItemHeadword(item)) ||
        (result?.dictionary?.baseForm || result?.dictionary?.word || "") ||
        "";

      const cacheKey = normalizeSearchQuery(headword, "favoritesCache");
      if (!cacheKey || !cacheKey.trim()) return;

      const nextExamples = Array.isArray(examplesArray) ? examplesArray : [];

      // ✅ Task 3：翻譯來源以 meta.exampleTranslation 為主，並且必須回寫到 dictionary.exampleTranslation
      const nextExampleTranslation =
        typeof meta?.exampleTranslation === "string"
          ? meta.exampleTranslation.trim()
          : "";

      // ============================================================
      // Task 2 — Favorites Snapshot「可更新」
      // - 例句/翻譯補齊完成後：更新同一筆 favorites snapshot（replay 是快取但不是凍結）
      // - 只允許 favorites-learning；History/Search 不得回寫（由上方 gate 保證）
      // - 只要有新增就算（例句由空→有、翻譯補齊、例句數量增加）
      // ============================================================
      const hasTranslation = (ex) => {
        try {
          if (!ex || typeof ex !== "object") return false;
          if (typeof ex.translation === "string" && ex.translation.trim()) return true;
          if (typeof ex.translationText === "string" && ex.translationText.trim()) return true;
          if (typeof ex.zh === "string" && ex.zh.trim()) return true;
          if (typeof ex.zhTw === "string" && ex.zhTw.trim()) return true;
          if (typeof ex.explain === "string" && ex.explain.trim()) return true;
          if (Array.isArray(ex.translations) && ex.translations.length > 0) return true;
          return false;
        } catch {
          return false;
        }
      };

      const prevStored = (() => {
        try {
          const s = findFavoritesSnapshot(cacheKey);
          return s && typeof s === "object" ? s : null;
        } catch {
          return null;
        }
      })();

      const prevInMem = (() => {
        try {
          const s = favoritesResultCacheRef.current?.get(cacheKey);
          return s && typeof s === "object" ? s : null;
        } catch {
          return null;
        }
      })();

      const prevSnap = prevInMem || prevStored;

      const prevExampleTranslation =
        typeof prevSnap?.dictionary?.exampleTranslation === "string"
          ? prevSnap.dictionary.exampleTranslation.trim()
          : "";

      const prevExamples = Array.isArray(prevSnap?.dictionary?.examples)
        ? prevSnap.dictionary.examples
        : [];

      const prevTranslatedCount = prevExamples.filter(hasTranslation).length;
      const nextTranslatedCount = nextExamples.filter(hasTranslation).length;

      const improved =
        (prevExamples.length === 0 && nextExamples.length > 0) ||
        nextExamples.length > prevExamples.length ||
        nextTranslatedCount > prevTranslatedCount ||
        (!!nextExampleTranslation && !prevExampleTranslation);

      // 1) 回寫 favorites cache snapshot（memory + persisted snapshot）
      if (improved) {
        try {
          const base = prevSnap || (result && typeof result === "object" ? result : null);
          if (base) {
            const dict =
              base.dictionary && typeof base.dictionary === "object" ? base.dictionary : {};
            const updatedSnapshot = {
              ...base,
              dictionary: {
                ...dict,
                examples: nextExamples,
                // ✅ Task 3：回寫例句翻譯（必須落在 dictionary.exampleTranslation）
                ...(nextExampleTranslation
                  ? { exampleTranslation: nextExampleTranslation }
                  : {}),
              },
            };

            // memory map（Task E cache）
            try {
              favoritesResultCacheRef.current?.set(cacheKey, updatedSnapshot);
            } catch {}

            // persisted snapshot（Task 1/2 replay source）
            try {
              upsertFavoritesSnapshot(cacheKey, updatedSnapshot);
            } catch {}
          }
        } catch {}
      }

      // 2) 同步更新當前畫面（避免只更新 cache，UI 還拿舊 result）
      try {
        setResult((prev) => {
          const p = prev && typeof prev === "object" ? prev : null;
          if (!p) return prev;
          const pd =
            p.dictionary && typeof p.dictionary === "object" ? p.dictionary : {};
          return {
            ...p,
            dictionary: {
              ...pd,
              examples: nextExamples,
              // ✅ Task 3：同步回寫 dictionary.exampleTranslation（避免只更新 cache，畫面仍顯示空翻譯）
              ...(nextExampleTranslation
                ? { exampleTranslation: nextExampleTranslation }
                : {}),
            },
          };
        });
      } catch {}

      // ✅ 例句翻譯排查（runtime）：是否有帶 translation 欄位
      if (isExamplesDebugEnabled()) {
        try {
          const sample =
            Array.isArray(nextExamples) && nextExamples.length ? nextExamples[0] : null;
          const sampleHasTranslation = hasTranslation(sample);
          console.debug("[examples][resolved] translation-check", {
            key: cacheKey || "not available",
            count: nextExamples.length,
            sampleHasTranslation,
            improved,
            prevCount: prevExamples.length,
            prevTranslatedCount,
            nextTranslatedCount,
          });
        } catch {}
      }

      // ✅ 可控 debug
      if (isSearchDebugEnabled()) {
        try {
          console.debug("[favorites][examples] resolved->cache", {
            key: cacheKey,
            count: nextExamples.length,
            improved,
            meta: meta || null,
          });
        } catch {}
      }
    } catch {}
  };


  // ============================================================
  // Task F2 — Favorites/Learning：examples 補齊後回寫 favorites cache
  // ============================================================
  const examplesAutoRefreshEnabled__legacyF2 = !(
    mode === "learning" &&
    learningContext &&
    learningContext.sourceType === "favorites"
  );

  const handleFavoritesExamplesResolved__legacyF2 = (examplesArray, meta) => {
    // Legacy-F2：保留舊的 favorites cache 寫入路徑，但修正成「不依賴未宣告變數」且可安全更新當前畫面
    try {
      if (!(mode === "learning" && learningContext && learningContext.sourceType === "favorites")) return;

      const items = Array.isArray(learningContext.items) ? learningContext.items : [];
      const idx =
        typeof learningContext.index === "number" && Number.isFinite(learningContext.index)
          ? learningContext.index
          : -1;
      if (idx < 0 || idx >= items.length) return;

      const item = items[idx];
      const headword = getItemHeadword(item);
      const cacheKey = normalizeSearchQuery(headword, "favoritesCache");
      if (!cacheKey || !favoritesResultCacheRef.current) return;

      const prevSnap = favoritesResultCacheRef.current.get(cacheKey);
      if (!prevSnap || typeof prevSnap !== "object") return;

      const prevDict =
        prevSnap.dictionary && typeof prevSnap.dictionary === "object" ? prevSnap.dictionary : {};
      const nextExamples = Array.isArray(examplesArray) ? examplesArray : [];

      const nextSnap = {
        ...prevSnap,
        dictionary: {
          ...prevDict,
          examples: nextExamples,
        },
      };
      favoritesResultCacheRef.current.set(cacheKey, nextSnap);

      // ✅ 同步更新當前畫面（僅在同一個 headword 時覆蓋）
      setResult((curr) => {
        const currObj = curr && typeof curr === "object" ? curr : null;
        if (!currObj) return curr;

        const currDict =
          currObj.dictionary && typeof currObj.dictionary === "object" ? currObj.dictionary : {};
        const currHead = (currDict.baseForm || currDict.lemma || currDict.word || "").toString();
        const normalizedCurrHead = normalizeSearchQuery(currHead, "favoritesCache");
        if (normalizedCurrHead !== cacheKey) return curr;

        const nextDict = {
          ...currDict,
          examples: nextExamples,
        };

        // header 同步（避免 UI title 仍是舊字）
        if (meta && meta.displayHeadword) nextDict.headword = meta.displayHeadword;
        if (meta && meta.article !== undefined) nextDict.article = meta.article;

        return {
          ...currObj,
          dictionary: nextDict,
        };
      });
    } catch {}
  };

  // ============================================================
  // Init Gate (UI) — 初始化未完成前，所有「使用者觸發」入口直接 no-op
  // ============================================================
  const setUiLangSafe = useCallback(
    (next) => {
      if (!appReady) return;
      setUiLang(next);
    },
    [appReady]
  );

    const setThemeSafe = useCallback(
    (_next) => {
      if (!appReady) return;
      // ✅ 強制亮色：忽略下游切換請求
      setTheme("light");
      try {
        document.documentElement.classList.remove("dark");
      } catch {}
    },
    [appReady]
  );

  const setViewSafe = useCallback(
    (next) => {
      if (!appReady) return;
      setView(next);
    },
    [appReady]
  );

  const goPrevHistorySafe = useCallback(() => {
    if (!appReady) return;
    goPrevHistory();
  }, [appReady, goPrevHistory]);

  const goNextHistorySafe = useCallback(() => {
    if (!appReady) return;
    goNextHistory();
  }, [appReady, goNextHistory]);

  const toggleFavoriteSafe = useCallback(
    (...args) => {
      if (!appReady) return;
      return handleToggleFavoriteForUI?.(...args);
    },
    [appReady, handleToggleFavoriteForUI]
  );
  console.log("[INIT_GATE]", { /* 把 if 用到的每個變數都列出來 */ });

  return (
    <div style={{ position: "relative" }}>
      {!appReady && (
        <div
          className="app-init-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "transparent",
            // ✅ init gating：只擋互動，不要整頁霧面/白幕
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: theme === "dark" ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(0,0,0,0.10)",
              background: theme === "dark" ? "rgba(20,20,20,0.85)" : "rgba(255,255,255,0.92)",
              boxShadow: theme === "dark" ? "0 10px 30px rgba(0,0,0,0.55)" : "0 10px 30px rgba(0,0,0,0.15)",
              color: theme === "dark" ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.78)",
              fontSize: 14,
              letterSpacing: "0.2px",
            }}
          >
            初始化中…
          </div>
        </div>
      )}

      <AppShellView
      // core
      uiLang={uiLang}
      setUiLang={setUiLangSafe}
      theme={theme}
      setTheme={setThemeSafe}
      currentUiText={currentUiText}
      uiText={uiText}
      t={t}
      loading={loading}
      view={view}
      setView={setViewSafe}
      authUserId={authUserId}
      apiBase={API_BASE}
      interactionEnabled={appReady}
      // layout
      history={history}
      historyIndex={historyIndex}
      onPrevHistory={goPrevHistorySafe}
      onNextHistory={goNextHistorySafe}
      // test mode
      isFavorited={isFavoritedForUI}
      onToggleFavorite={toggleFavoriteSafe}
      libraryItems={libraryItems}
      testCard={testCard}
      setTestCard={setTestCard}
      testMetaMap={testMetaMap}
      setTestMetaMap={setTestMetaMap}
      testMetaLoading={testMetaLoading}
      setTestMetaLoading={setTestMetaLoading}
      // search box
      text={displayText || text}
      onTextChange={handleTextChange}
      queryHint={lastNormalizedQuery ? { text: lastNormalizedQuery, reason: "normalizedQuery", type: "info" } : queryHint}
      onClearQueryHint={clearQueryHint}
      onAnalyze={handleAnalyze}
      onEnterSearch={enterSearchMode}
      onEnterLearning={enterLearningMode}
      onOpenLibrary={openLibraryModal}
      // result panel
      result={result}
      showRaw={showRaw}
      onToggleRaw={() => setShowRaw((p) => !p)}
      mode={mode}
      learningContext={learningContext}
      // ✅ Task F2：examples 補齊完成後回寫 favorites cache（由下游 useExamples 觸發）
      onExamplesResolved={handleFavoritesExamplesResolved}
  // === FIX: ensure updatedResult is used consistently ===
      // ✅ Task F2：Favorites learning replay 預設關閉 auto-refresh，只允許手動補齊
      examplesAutoRefreshEnabled={examplesAutoRefreshEnabled}
      WordCard={WordCard}
      GrammarCard={GrammarCard}
      historyLength={history.length}
      canPrev={canPrevHistory}
      canNext={canNextHistory}
      onPrev={goPrevHistory}
      onNext={goNextHistory}
      onWordClick={handleWordClick}
      favoriteCategories={favoriteCategories}
      favoriteCategoriesLoading={favoriteCategoriesLoading}
      selectedFavoriteCategoryId={selectedFavoriteCategoryId}
      onSelectFavoriteCategoryForAdd={handleSelectFavoriteCategoryForAdd}
      canClearHistory={canClearHistory}
      onClearHistoryItem={clearCurrentHistoryItem}
      clearHistoryLabel={t("app.history.clearThis")}
      onSelectPosKey={handleSelectPosKey}
      // library modal
      showLibraryModal={showLibraryModal}
      closeLibraryModal={closeLibraryModal}
      handleLibraryReview={handleLibraryReview}
      onUpdateSenseStatus={handleUpdateSenseStatus}
      favoriteDisabled={!authUserId}
      onSelectFavoriteCategory={handleSelectFavoriteCategory}
      // ✅ 2026-01-17：favorites categories CRUD（管理分類 modal 串接）
      // ✅ 2026-01-18：Task C（分類 CRUD 接線：新 prop 命名，供 AppShellView/WordLibraryPanel 使用）
      // - 注意：保留舊 prop（onCreateFavoriteCategory...）不移除；新舊並存
      isCategoriesSaving={isFavoriteCategoriesSaving}
      categoriesErrorText={favoriteCategoriesSavingError}
      onCreateCategory={createFavoriteCategoryViaApi}
      onRenameCategory={renameFavoriteCategoryViaApi}
      onReorderCategories={reorderFavoriteCategoriesViaApi}
      onArchiveCategory={archiveFavoriteCategoryViaApi}
      onCreateFavoriteCategory={createFavoriteCategoryViaApi}
      onRenameFavoriteCategory={renameFavoriteCategoryViaApi}
      onReorderFavoriteCategories={reorderFavoriteCategoriesViaApi}
      onArchiveFavoriteCategory={archiveFavoriteCategoryViaApi}
      isFavoriteCategoriesSaving={isFavoriteCategoriesSaving}
      favoriteCategoriesSavingError={favoriteCategoriesSavingError}
      // ✅ 2026-01-16：B(UI) pending/key 接線（ResultPanel/Library list 的星號 disable）
      isFavoritePending={isFavoritePending}
      getFavoriteWordKey={getFavoriteWordKey}

      // ✅ 2026-01-19：Task A（ResultPanel 導覽列雙路）
      // - App 端已 setNavContext(...)，但此前未往下傳，ResultPanel 看不到
      navContext={navContext}
    />
    </div>
  );
}

export default AppInner;

// frontend/src/App.jsx
// END PATH: frontend/src/App.jsx
// ===== END FILE: frontend/src/App.jsx =====
// ===== END FILE: frontend/src/App.jsx =====