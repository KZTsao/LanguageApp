// frontend/src/components/layout/LayoutShell.jsx
/**
 * 文件說明（LayoutShell）
 * - 目的：提供全站外層版面（置中容器 + Header 區），並把「語言切換 / 亮暗切換」的 UI 事件
 *   正確回傳給上層（App.jsx）管理的狀態（uiLang / theme）。
 * - 其他：保留既有 UI 結構與資料抓取（usage/debug key/menu），不改動行為。
 *
 * 異動紀錄（請保留舊紀錄）
 * - 2025/12/18：加入「單字庫入口」導覽按鈕（最小插入）
 *   1) 接收 App.jsx 傳入的 view / onViewChange（不改既有 theme/uiLang 流程）
 *   2) Header 左側新增「🔎 查詢」「⭐ 單字庫」切換（只觸發 onViewChange，不自行持有 view 狀態）
 *   3) 加入 Production 排查用初始化狀態（window.__layoutShellDebug.nav）
 * - 2025/12/18：dbg（Groq key varName）從帳號左上方移到「整個畫面最右下方」固定顯示（最小插入）
 *
 * - 2026/01/06：使用量顯示改為 /api/usage/me（DB 聚合），LLM 只顯示 completion_tokens（最小插入）
 * - 2026/01/06：修正 /api/usage/me 回傳欄位對齊（byKindReal）避免 UI 顯示 0（最小插入）
 *
 * - 2026/01/07：修正 Vercel 環境 usage API 404（最小插入）
 *   1) fetchUsageSummary 內改用 apiFetch（統一走 VITE_API_BASE_URL / fallback base）
 *   2) 加入 Production 排查用初始化狀態（window.__layoutShellDebug.usageApi）
 *   3) 適當加入 console 觀察 runtime（僅顯示可公開資訊，不含 token/secret）
 *
 * 既有修改重點（保留原說明，不改業務邏輯）：
 *   1) props 介面對齊 App.jsx：使用 onThemeChange / onUiLangChange（原本 LayoutShell 用錯名字）
 *   2) 亮暗切換採全站等級：App.jsx 已負責將 theme 寫入 localStorage 並套用 <html>.classList.dark
 */

import { useEffect, useMemo, useRef, useState } from "react";
import LoginButton from "../auth/LoginButton";
import { useAuth } from "../../context/AuthProvider";
import { apiFetch } from "../../utils/apiClient";
import uiText from "../../uiText";

/** 模組：將字串 seed 穩定映射到色相（供頭像底色使用） */
function hashToHue(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/** 模組：產生頭像樣式（依 email + theme 做顏色/明暗調整） */
function getAvatarStyle(seedEmail, theme) {
  const hue = hashToHue(seedEmail || "");
  const s = 68;
  const l = theme === "dark" ? 52 : 42;

  return {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    userSelect: "none",
    background: `hsl(${hue} ${s}% ${l}%)`,
    color: "white",
    border: "1px solid var(--border-subtle)",
  };
}

/** 模組：方案 pill（右上角頭像旁） */
function getPlanPillStyle() {
  return {
    fontSize: 9.5,
    fontWeight: 600,
    color: "var(--text-muted)",
    opacity: 0.65,
    lineHeight: "12px",
    letterSpacing: 0.3,
    userSelect: "none",
    alignSelf: "flex-end",
    marginBottom: 2,
  };
}

/** 模組：debug key pill（淡淡顯示 key var name） */
function getDebugKeyPillStyle() {
  return {
    fontSize: 9.5,
    fontWeight: 600,
    color: "var(--text-muted)",
    opacity: 0.25, // 淡淡的
    lineHeight: "12px",
    letterSpacing: 0.2,
    userSelect: "none",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  };
}

/** 模組：選單內顯示 debug key（比頭像旁邊更容易看見，但仍然淡） */
function getDebugKeyMenuStyle() {
  return {
    marginTop: 6,
    fontSize: 11,
    lineHeight: "15px",
    color: "var(--text-muted)",
    opacity: 0.75,
    userSelect: "none",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  };
}

/** 模組：dbg 固定顯示在整個畫面右下角（Production 排查） */
function getDebugKeyFloatingStyle() {
  return {
    position: "fixed",
    right: 10,
    bottom: 10,
    zIndex: 9999,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: "14px",
    letterSpacing: 0.2,
    padding: "6px 8px",
    borderRadius: 10,
    border: "1px solid var(--border-subtle)",
    background: "var(--card-bg)",
    color: "var(--text-muted)",
    opacity: 0.85,
    userSelect: "none",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
  };
}

/** 模組：從 localStorage 取得 supabase access token（不引入新 client） */
function getAccessTokenFromLocalStorage() {
  try {
    const key = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    if (!key) return "";
    const raw = JSON.parse(localStorage.getItem(key));
    return raw?.access_token || raw?.currentSession?.access_token || "";
  } catch {
    return "";
  }
}

/** 模組：Support Admin allowlist（前端顯示入口用；不影響後端權限） */
function getSupportAdminAllowlist() {
  // ✅ 避免 import.meta 在某些 runtime 解析下出現 undefined
  // 優先序：window.__SUPPORT_ADMIN_EMAILS → localStorage → Vite env
  try {
    let raw = "";

    // 1) window 注入（臨時測試）
    try {
      const w = typeof window !== "undefined" ? window : null;
      if (w && w.__SUPPORT_ADMIN_EMAILS) {
        raw = String(w.__SUPPORT_ADMIN_EMAILS || "");
      }
    } catch {}

    // 2) localStorage（臨時測試）
    try {
      const w = typeof window !== "undefined" ? window : null;
      if (!raw && w && w.localStorage) {
        const v = w.localStorage.getItem("SUPPORT_ADMIN_EMAILS");
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

function isSupportAdminEmail(email) {
  try {
    if (!email) return false;
    const allow = getSupportAdminAllowlist();
    if (!allow.length) return false;
    return allow.includes(String(email));
  } catch {
    return false;
  }
}

/** 模組：Header 導覽區外框（查詢 / 單字庫） */
function getNavPillWrapStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    border: "1px solid var(--border-subtle)",
    background: "var(--card-bg)",
    overflow: "hidden",
  };
}

/** 模組：Header 導覽按鈕樣式（active / inactive） */
function getNavButtonStyle(active) {
  return {
    padding: "6px 10px",
    border: "none",
    outline: "none",
    background: active ? "var(--accent-soft, #e0f2fe)" : "transparent",
    color: active ? "var(--accent, #0369a1)" : "var(--text-main)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  };
}

/**
 * LayoutShell（外層版面）
 * - 注意：App.jsx 會傳入 uiLang / onUiLangChange / theme / onThemeChange
 * - 本檔案只負責觸發事件，不自行持有「全站語言/主題」狀態
 */
function LayoutShell({
  theme,
  onThemeChange,
  uiLang,
  onUiLangChange,
  // ====== 2025/12/18 新增：接收 view / onViewChange（由 App.jsx 控制頁面狀態） ======
  view,
  onViewChange,
  interactionDisabled,
  children,
}) {
  const { user, profile, signOut } = useAuth();

  // ============================================================
  // Init Gating（2026/01/24）
  // - 上層 App.jsx 會在初始化期間設 window.__appInit.blockInteraction = true
  // - 本元件可接受 interactionDisabled prop（未接線也可用 window fallback）
  // - 目的：避免初始化中點擊任何 header 入口造成初始失敗
  // ============================================================
  const __interactionDisabled = (() => {
    try {
      const w = typeof window !== "undefined" ? window : null;
      const fromWin = Boolean(w?.__appInit?.blockInteraction);
      return Boolean(interactionDisabled || fromWin);
    } catch {
      return Boolean(interactionDisabled);
    }
  })();

  /** 模組：選單開關（右上角頭像選單） */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef(null);

  /** 模組：usage state（未登入/已登入都看得到） */
  const [usage, setUsage] = useState(null);

  /** 模組：debug: groq key var（只有指定帳號看得到） */
  const [groqKeyDebug, setGroqKeyDebug] = useState(null);

  /** 模組：Production 排查用初始化狀態（不影響業務邏輯） */
  const [navInit] = useState(() => {
    return {
      ts: Date.now(),
      enabled: true,
      note: "Header nav (search/library) wired via onViewChange",
    };
  });

  /** 模組：Production 排查用初始化狀態（usage API base / env）（不影響業務邏輯） */
  const [usageApiInit] = useState(() => {
    return {
      ts: Date.now(),
      enabled: true,
      note: "usage summary fetch uses apiFetch (base from VITE_API_BASE_URL or fallback)",
      viteHasApiBaseUrl: Boolean(import.meta?.env?.VITE_API_BASE_URL),
      nodeEnv: (import.meta?.env?.MODE || "not available").toString(),
    };
  });

  // 保留你的設定（目前固定顯示）
  const showDebugKey = "1";
  //String(import.meta?.env?.VITE_SHOW_DEBUG_KEY || "").trim() === "1";

  /** 模組：提供簡單的 debug 入口（避免在 console 使用 import.meta） */
  useEffect(() => {
    window.__layoutShellDebug = window.__layoutShellDebug || {};
    window.__layoutShellDebug.showDebugKey = showDebugKey;
    window.__layoutShellDebug.userId = user?.id || null;

    // ====== 2025/12/18 新增：導覽初始化狀態 ======
    window.__layoutShellDebug.nav = {
      init: navInit,
      view: typeof view === "string" ? view : null,
      canChangeView: typeof onViewChange === "function",
    };

    // ====== 2026/01/07 新增：usage API 初始化狀態（Production 排查） ======
    window.__layoutShellDebug.usageApi = {
      init: usageApiInit,
      hasApiFetch: typeof apiFetch === "function",
      // 注意：此處不輸出任何 token/secret
    };

    // ====== 2025/12/18 新增：dbg 顯示位置（Production 排查） ======
    window.__layoutShellDebug.dbg = window.__layoutShellDebug.dbg || {};
    window.__layoutShellDebug.dbg.position = "fixed-bottom-right";
  }, [showDebugKey, user?.id, navInit, view, onViewChange, usageApiInit]);

  /** 模組：plan 文字 */
  const planText = useMemo(() => {
    const p = (profile?.plan || "free").toString().trim();
    return `${p}plan`.toLowerCase();
  }, [profile?.plan]);

  /** 模組：點外面關閉選單 */
  useEffect(() => {
    function onDocClick(e) {
      if (!menuWrapRef.current) return;
      if (!menuWrapRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  /** 模組：切換帳號就關閉選單 */
  useEffect(() => {
    setMenuOpen(false);
  }, [user?.id]);

  /** 模組：usage 來源（優先 /api/usage/me；保留 /admin/usage?days=7 作為 debug/fallback） */
  async function fetchUsageSummary() {
    const token = getAccessTokenFromLocalStorage();

    // ====== 2026/01/07 新增：runtime 觀察（Production 排查） ======
    // - 不輸出 token / secret
    // - 僅輸出是否有 token、目前 host、是否有 VITE_API_BASE_URL
    try {
      console.info("[LayoutShell][usage] fetchUsageSummary start", {
        host: window?.location?.host || "not available",
        hasToken: Boolean(token),
        viteHasApiBaseUrl: Boolean(import.meta?.env?.VITE_API_BASE_URL),
        mode: (import.meta?.env?.MODE || "not available").toString(),
      });
    } catch {
      // 靜默
    }

    // ====== 2026/01/06 新增：優先用 /api/usage/me（DB 聚合） ======
    // 需求：UI 只呈現「使用者用量」
    // - LLM：只顯示 completion_tokens（等同 llm_tokens_out）
    // - TTS：以 chars 計
    let usedUsageMe = false;

    try {
      // ====== 2026/01/07 修正：統一走 apiFetch，避免 Vercel 相對路徑打到前端 domain 造成 404 ======
      const rMe = await apiFetch("/api/usage/me", {
        headers: token ? { Authorization: "Bearer " + token } : undefined,
      });

      if (rMe.ok) {
        const me = await rMe.json();

        // ====== 2026/01/06 修正：對齊目前 API 回傳（byKindReal） ======
        // 你現在 /api/usage/me 回傳長這樣：
        //   today.byKindReal.llm / tts
        //   month.byKindReal.llm / tts
        // 舊版（deprecated）：today.llmCompletionTokens / today.ttsChars ...
        const todayLLM_fromByKindReal = Number(
          me?.today?.byKindReal?.llm ?? 0
        );
        const todayTTS_fromByKindReal = Number(
          me?.today?.byKindReal?.tts ?? 0
        );

        const monthLLM_fromByKindReal = Number(
          me?.month?.byKindReal?.llm ?? 0
        );
        const monthTTS_fromByKindReal = Number(
          me?.month?.byKindReal?.tts ?? 0
        );

        // deprecated fallback：保留舊欄位讀法（避免你之後 API 又換回去）
        const todayLLM_fromDeprecated = Number(
          me?.today?.llmCompletionTokens || 0
        );
        const todayTTS_fromDeprecated = Number(me?.today?.ttsChars || 0);

        const monthLLM_fromDeprecated = Number(
          me?.month?.llmCompletionTokens || 0
        );
        const monthTTS_fromDeprecated = Number(me?.month?.ttsChars || 0);

        // 實際採用：byKindReal 優先，否則 fallback 到 deprecated
        const todayLLM =
          todayLLM_fromByKindReal || todayLLM_fromDeprecated || 0;
        const todayTTS =
          todayTTS_fromByKindReal || todayTTS_fromDeprecated || 0;

        const monthLLM =
          monthLLM_fromByKindReal || monthLLM_fromDeprecated || 0;
        const monthTTS =
          monthTTS_fromByKindReal || monthTTS_fromDeprecated || 0;

        setUsage({
          today: { byKind: { llm: todayLLM, tts: todayTTS } },
          month: { byKind: { llm: monthLLM, tts: monthTTS } },
        });

        usedUsageMe = true;

        // Production 排查：保留最近一次 usage/me
        window.__layoutShellDebug = window.__layoutShellDebug || {};
        window.__layoutShellDebug.lastUsageMe = me || null;
        window.__layoutShellDebug.lastUsageMeOk = true;

        // ====== 2026/01/06 新增：把採用的值也記一下，避免「API 有回，但 UI 還是 0」難追 ======
        window.__layoutShellDebug.lastUsageMePicked = {
          todayLLM,
          todayTTS,
          monthLLM,
          monthTTS,
          todayLLM_fromByKindReal,
          todayTTS_fromByKindReal,
          monthLLM_fromByKindReal,
          monthTTS_fromByKindReal,
          todayLLM_fromDeprecated,
          todayTTS_fromDeprecated,
          monthLLM_fromDeprecated,
          monthTTS_fromDeprecated,
        };

        // ====== 2026/01/07 新增：runtime 觀察（Production 排查） ======
        try {
          console.info("[LayoutShell][usage] /api/usage/me ok", {
            usedUsageMe: true,
            todayLLM,
            todayTTS,
            monthLLM,
            monthTTS,
          });
        } catch {
          // 靜默
        }
      } else {
        window.__layoutShellDebug = window.__layoutShellDebug || {};
        window.__layoutShellDebug.lastUsageMeOk = false;
        window.__layoutShellDebug.lastUsageMeStatus = rMe.status;

        // ====== 2026/01/07 新增：runtime 觀察（Production 排查） ======
        try {
          console.warn("[LayoutShell][usage] /api/usage/me not ok", {
            status: rMe.status,
          });
        } catch {
          // 靜默
        }
      }
    } catch (e) {
      window.__layoutShellDebug = window.__layoutShellDebug || {};
      window.__layoutShellDebug.lastUsageMeOk = false;
      window.__layoutShellDebug.lastUsageMeStatus = "fetch_failed";

      // ====== 2026/01/07 新增：runtime 觀察（Production 排查） ======
      try {
        console.warn("[LayoutShell][usage] /api/usage/me fetch failed", {
          msg: e?.message || "not available",
        });
      } catch {
        // 靜默
      }
    }

    // ====== 既有：/admin/usage?days=7（保留） ======
    // - 若 usedUsageMe=false：fallback 以舊資料填 usage（避免畫面空）
    // - 若 usedUsageMe=true：僅用來拿 debug key（不覆蓋 usage）
    try {
      // ====== 2026/01/07 修正：統一走 apiFetch，避免 Vercel 相對路徑打到前端 domain 造成 404 ======
      const r = await apiFetch("/admin/usage?days=7", {
        headers: token ? { Authorization: "Bearer " + token } : undefined,
      });
      if (!r.ok) return;

      const data = await r.json();

      // usage：只有在 usage/me 失敗時才用舊資料填（fallback）
      if (!usedUsageMe) {
        const todayLLM = Number(data?.today?.byKind?.llm || 0);
        const todayTTS = Number(data?.today?.byKind?.tts || 0);

        // 以 month.byKind 優先；若沒有再 fallback 到 monthEstimatedTokens*
        const monthLLM =
          Number(data?.month?.byKind?.llm ?? 0) ||
          Number(data?.monthEstimatedTokensLLM || 0);
        const monthTTS =
          Number(data?.month?.byKind?.tts ?? 0) ||
          Number(data?.monthEstimatedTokensTTS || 0);

        setUsage({
          today: { byKind: { llm: todayLLM, tts: todayTTS } },
          month: { byKind: { llm: monthLLM, tts: monthTTS } },
        });

        // ====== 2026/01/07 新增：runtime 觀察（Production 排查） ======
        try {
          console.info("[LayoutShell][usage] fallback /admin/usage applied", {
            usedUsageMe: false,
            todayLLM,
            todayTTS,
            monthLLM,
            monthTTS,
          });
        } catch {
          // 靜默
        }
      }

      // debug key：只有 canView=true 才能看到 currentKeyVar（且你只要變數名，不要實際值）
      const dbg = data?.__debug?.groq;

      window.__layoutShellDebug = window.__layoutShellDebug || {};
      window.__layoutShellDebug.lastGroq = dbg || null;

      if (
        showDebugKey &&
        user?.id && // ✅ 要登入才可能被 allowlist 授權
        dbg &&
        dbg.canView === true &&
        typeof dbg.currentKeyVar === "string" &&
        dbg.currentKeyVar.trim()
      ) {
        const next = {
          varName: dbg.currentKeyVar.trim(),
          index: Number.isFinite(dbg.index) ? dbg.index : null,
          total: Number.isFinite(dbg.total) ? dbg.total : null,
        };
        setGroqKeyDebug(next);
        window.__layoutShellDebug.groqKeyDebug = next;
      } else {
        setGroqKeyDebug(null);
        window.__layoutShellDebug.groqKeyDebug = null;
      }
    } catch (e) {
      // 靜默
      // ====== 2026/01/07 新增：runtime 觀察（Production 排查） ======
      try {
        console.warn("[LayoutShell][usage] /admin/usage fetch failed (silent)", {
          msg: e?.message || "not available",
        });
      } catch {
        // 靜默
      }
    }
  }

  /** 模組：開站/登入狀態變化就抓一次 usage */
  useEffect(() => {
    if (!user?.id) {
      setGroqKeyDebug(null);
    }

    fetchUsageSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, showDebugKey]);

  /** 模組：核心：每次前端真的呼叫 API 成功就更新 usage（無輪詢） */
  useEffect(() => {
    const onUsageUpdated = () => {
      fetchUsageSummary();
    };
    window.addEventListener("usage-updated", onUsageUpdated);
    return () => window.removeEventListener("usage-updated", onUsageUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, showDebugKey]);

  /** 模組：亮暗切換（只呼叫上層 onThemeChange；真正套用 <html>.dark 在 App.jsx） */
  const handleToggleTheme = () => {
    if (__interactionDisabled) return;
    const cur = theme === "dark" ? "dark" : "light";
    const next = cur === "dark" ? "light" : "dark";
    if (typeof onThemeChange === "function") onThemeChange(next);
  };

  /** 模組：語言切換（只回傳上層 onUiLangChange） */
  const handleUiLangChange = (nextLang) => {
    if (__interactionDisabled) return;
    if (typeof onUiLangChange === "function") onUiLangChange(nextLang);
  };

  /** 模組：頁面切換（只呼叫上層 onViewChange；不自行持有 view 狀態） */
  const handleGoSearch = () => {
    if (__interactionDisabled) return;
    if (typeof onViewChange === "function") onViewChange("search");
  };

  /** 模組：頁面切換（單字庫入口） */
  const handleGoLibrary = () => {
    if (__interactionDisabled) return;
    if (typeof onViewChange === "function") onViewChange("library");
  };

  // ====== 未登入 UI ======
  if (!user) {
    return (
      <div
        className={`app-root theme-${theme}`}
        style={{
          background: "var(--page-bg)",
          color: "var(--text-main)",
          display: "flex",
          justifyContent: "center",
          paddingTop: 24,
          paddingBottom: 40,
        }}
      >
        <div style={{ width: "100%", maxWidth: 720, padding: "0 16px" }}>
          <div
            style={{
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            {/* 模組：語言選擇（同一個匡 pill） */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: "var(--card-bg)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  padding: "6px 0px 6px 10px",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                }}
              >
                🌐 Muttersprache:
              </span>

              <select
                disabled={__interactionDisabled}
                value={uiLang}
                onChange={(e) => handleUiLangChange(e.target.value)}
                style={{
                  padding: "6px 10px 6px 0px",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--text-main)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <option value="zh-TW">繁體中文</option>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="zh-CN">简体中文</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <LoginButton uiLang={uiLang} />

              <button
                disabled={__interactionDisabled}
                onClick={handleToggleTheme}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--card-bg)",
                  color: "var(--text-main)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
              </button>
            </div>
          </div>

          {children}
        </div>
      </div>
    );
  }

  // ====== 已登入 UI ======
  const email = user.email || "";
  const avatarUrl =
    user.user_metadata?.picture || user.user_metadata?.avatar_url || "";
  const avatarLetter = (email.trim()[0] || "U").toUpperCase();

  const debugKeyText =
    showDebugKey && groqKeyDebug?.varName
      ? `Groq · ${groqKeyDebug.varName}${
          Number.isFinite(groqKeyDebug.index) &&
          Number.isFinite(groqKeyDebug.total)
            ? ` (${groqKeyDebug.index + 1}/${groqKeyDebug.total})`
            : ""
        }`
      : "";

  return (
    <div
      className={`app-root theme-${theme}`}
      style={{
        background: "var(--page-bg)",
        color: "var(--text-main)",
        display: "flex",
        justifyContent: "center",
        paddingTop: 24,
        paddingBottom: 40,
      }}
    >
      <div style={{ width: "100%", maxWidth: 720, padding: "0 16px" }}>
        <div
          style={{
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* 模組：語言選擇（同一個匡 pill） */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: "var(--card-bg)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  padding: "6px 0px 6px 10px",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                }}
              >
                🌐 Muttersprache:
              </span>

              <select
                disabled={__interactionDisabled}
                value={uiLang}
                onChange={(e) => handleUiLangChange(e.target.value)}
                style={{
                  padding: "6px 10px 6px 0px",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--text-main)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <option value="zh-TW">繁體中文</option>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="zh-CN">简体中文</option>
              </select>
            </div>
          </div>

          <div
            key={user.id}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >

            {/* ✅ 2026/01/25：Support Admin 入口（僅 allowlist email 可見） */}
            {isSupportAdminEmail(email) ? (
              <a
                href="/support-admin"
                onClick={(e) => {
                  if (__interactionDisabled) {
                    e.preventDefault();
                    return;
                  }
                }}
                style={{
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 10,
                  // ⬇️ 這行：改成淺灰框線（不要主題橘）
                  border: "1px solid var(--border-subtle, #ddd)",
                  // ⬇️ 這行：白底
                  background: "#fff",
                  // ⬇️ 這行：黑字
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  fontSize: 12,
                  // ⬇️ 這行：字重稍降，質感會好一點
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                }}
                
                title="客服管理"
                aria-label="客服管理"
              >
                客服管理
              </a>
            ) : null}

            <div
              ref={menuWrapRef}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              <span style={getPlanPillStyle()}>{planText}</span>

              {/* 模組：淡淡顯示目前 key 變數名（不顯示實際值） */}
              {/* deprecated（2025/12/18）：原本顯示在帳號左上方，需求改為固定顯示在整個畫面右下角 */}
              {debugKeyText ? (
                <span style={{ display: "none" }}>
                  <span style={getDebugKeyPillStyle()}>{debugKeyText}</span>
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  if (__interactionDisabled) return;
                  const next = !menuOpen;
                  setMenuOpen(next);
                  if (next) fetchUsageSummary();
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    referrerPolicy="no-referrer"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      border: "1px solid var(--border-subtle)",
                    }}
                  />
                ) : (
                  <span style={getAvatarStyle(email, theme)}>
                    {avatarLetter}
                  </span>
                )}
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: 36,
                    right: 0,
                    minWidth: 220,
                    borderRadius: 12,
                    border: "1px solid var(--border-subtle)",
                    background: "var(--card-bg)",
                    padding: 10,
                    zIndex: 50,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{email}</div>

                  {/* 模組：選單內也放一份 debug key（仍只顯示變數名） */}
                  {debugKeyText ? (
                    <div style={getDebugKeyMenuStyle()}>{debugKeyText}</div>
                  ) : null}

                  {usage && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        lineHeight: "15px",
                        color: "var(--text-muted)",
                      }}
                    >
                      Today: LLM {usage.today.byKind.llm || 0} · TTS{" "}
                      {usage.today.byKind.tts || 0}
                      <br />
                      Month: LLM {usage.month.byKind.llm || 0} · TTS{" "}
                      {usage.month.byKind.tts || 0}
                    </div>
                  )}

                  <div
                    style={{
                      height: 1,
                      background: "var(--border-subtle)",
                      margin: "8px 0",
                    }}
                  />

                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      try {
                        await signOut?.();
                      } catch (e) {
                        console.warn("[LayoutShell] signOut failed:", e);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--card-bg)",
                      color: "var(--text-main)",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    登出
                  </button>
                </div>
              )}
            </div>

            <button
              disabled={__interactionDisabled}
              onClick={handleToggleTheme}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: "var(--card-bg)",
                color: "var(--text-main)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
            </button>
          </div>
        </div>

        {children}

        {/* ====== 2026/02/01 新增：Footer - Terms of Service（最小插入，不影響既有邏輯） ====== */}
        <div
          style={{
            marginTop: 8,
            paddingTop: 0,
            borderTop: "none",
            textAlign: "left",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent("open-terms"));
              } catch {}
            }}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              color: "var(--text-muted)",
              cursor: "pointer",
              textDecoration: "none",
              fontWeight: 600,
              display: "block", 
              margin: "0 auto",
            }}
          >
            {uiText?.[uiLang]?.layout?.termsOfService || "Terms of Service"}
          </button>
        </div>
      </div>

      {/* ====== 2025/12/18 新增：dbg 固定顯示在整個畫面最右下方（Production 排查） ====== */}
      {debugKeyText ? (
        <div aria-hidden="true" style={getDebugKeyFloatingStyle()}>
          {debugKeyText}
        </div>
      ) : null}
    </div>
  );
}

export default LayoutShell;

// frontend/src/components/layout/LayoutShell.jsx