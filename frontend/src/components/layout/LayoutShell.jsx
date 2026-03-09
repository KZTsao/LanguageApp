// START PATH: frontend/src/components/layout/LayoutShell.jsx
// BEGIN FILE: frontend/src/components/layout/LayoutShell.jsx
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
import SupportAdminPage from "../../pages/SupportAdminPage";
// frontend/src/components/layout/LayoutShell.jsx

// frontend/src/components/layout/LayoutShell.jsx
const strokeWidth = 1.2;
const BalanceScaleIcon = ({ size = 30, className }) => (
  <svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  aria-hidden="true"
  className={className}
  xmlns="http://www.w3.org/2000/svg"
>
  <g transform="translate(12 12) scale(1.15) translate(-12 -12)">
    <path d="M12 4v14" stroke="#F2992E" strokeWidth={strokeWidth} strokeLinecap="round" />
    <path d="M6 7h12" stroke="#F2992E" strokeWidth={strokeWidth} strokeLinecap="round" />
    <path d="M7 7l-2.5 4.5h5L7 7z" stroke="#F2992E" strokeWidth={strokeWidth} strokeLinejoin="round" />
    <path d="M17 7l-2.5 4.5h5L17 7z" stroke="#F2992E" strokeWidth={strokeWidth} strokeLinejoin="round" />
    <path d="M9 20h6" stroke="#F2992E" strokeWidth={strokeWidth} strokeLinecap="round" />
  </g>
</svg>

);


const PersonOutlineIcon = ({ size = 18, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="translate(12 12) scale(1.15) translate(-12 -12)">
      <circle cx="12" cy="8.2" r="3.2" stroke="#F2992E" strokeWidth={strokeWidth} />
      <path
        d="M5.2 20c.9-3.7 4-5.8 6.8-5.8S17.9 16.3 18.8 20"
        stroke="#F2992E"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </g>
  </svg>
);

const SupportAdminIcon = ({ size = 30, className }) => (
  <svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  aria-hidden="true"
  className={className}
  xmlns="http://www.w3.org/2000/svg"
>
  <g transform="translate(12 12) scale(1.15) translate(-12 -12)">
    {/* shield outline */}
    <path
      d="M12 3.5
         l6 2
         v5.2
         c0 4.1-2.6 6.6-6 8
         c-3.4-1.4-6-3.9-6-8
         V5.5
         l6-2z"
      stroke="#F2992E"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />

    {/* inner badge */}
    <path
      d="M12 7.5v6"
      stroke="#F2992E"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <circle
      cx="12"
      cy="15.2"
      r="0.9"
      fill="#F2992E"
    />
  </g>
</svg>


);


import LoginPage from "../../pages/LoginPage";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../context/AuthProvider";
import { apiFetch } from "../../utils/apiClient";
import uiText from "../../uiText";
// ===== [20260202 support] console logger =====
const __SUPPORT_TRACE_ON =
  typeof import.meta !== "undefined" &&
  import.meta?.env?.VITE_DEBUG_SUPPORT_ADMIN === "1";
function __supportTrace(...args) {
  if (!__SUPPORT_TRACE_ON) return;
  try { console.log("[20260202 support]", ...args); } catch (_) {}
}
// ===== end logger =====

// ✅ Proof trace（不影響正式執行）：.env -> VITE_AUTH_PROOF=1
const AUTH_PROOF = import.meta.env.VITE_AUTH_PROOF === "1";
const proof = (...args) => {
  if (AUTH_PROOF) console.log("[***A]", ...args);
};


// ✅ Debug trace（不影響正式執行）：開關用 .env -> VITE_AUTH_TRACE=1
const AUTH_TRACE = import.meta.env.VITE_AUTH_TRACE === "1";
const trace = (...args) => {
  if (AUTH_TRACE) console.log("[AUTH-TRACE]", ...args);
};


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
  } catch (e) {
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
    } catch (e) {}

    // 2) localStorage（臨時測試）
    try {
      const w = typeof window !== "undefined" ? window : null;
      if (!raw && w && w.localStorage) {
        const v = w.localStorage.getItem("SUPPORT_ADMIN_EMAILS");
        if (v) raw = String(v);
      }
    } catch (e) {}

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
    } catch (e) {}

    return String(raw)
      .split(new RegExp("[,;\n\r\t\s]+", "g"))
      .map((s) => String(s || "").trim().toLowerCase())
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function isSupportAdminEmail(email) {
  try {
    const e = String(email || "").trim().toLowerCase();
    if (!e) return false;
    const allow = getSupportAdminAllowlist();
    if (!allow.length) return false;
    return allow.includes(e);
  } catch (e) {
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
  const { user, profile, signOut, isSupportAdmin, authReady } = useAuth();
  // ✅ Proof: LayoutShell render + auth-token key scan（不影響邏輯）
  try {
    const keys = []; // ✅ Legacy localStorage scan disabled (single token outlet)
    const hit = null; // disabled
    proof('LayoutShell:render', { hasUser: !!user, userId: user?.id, isSupportAdmin, authReady, authTokenKeyHit: hit || null });
    proof('LayoutShell:shield', { willShow: !!authReady && !!isSupportAdmin });
  } catch (e) {
    proof('LayoutShell:render:error', { message: e?.message || String(e) });
  }

  // ✅ 時間序觀測：LayoutShell 往往會早於 Auth 初始化完成
  trace("LayoutShell:render", { hasUser: !!user, userId: user?.id, isSupportAdmin });
  trace("shield:check", { isSupportAdmin, willShow: !!authReady && !!isSupportAdmin });


  // ✅ Debug: 追蹤 isSupportAdmin 是否「突然變動」導致盾牌消失
  useEffect(() => {
    proof('usage:effect', { hasUser: !!user, isSupportAdmin });

    
    trace("LayoutShell:isSupportAdminChanged", { isSupportAdmin, userId: user?.id });
    proof('LayoutShell:isSupportAdminChanged', { isSupportAdmin, userId: user?.id });
    console.log("[LayoutShell] isSupportAdmin changed", {
      isSupportAdmin,
      userId: user?.id,
    });
  }, [isSupportAdmin, user?.id]);

// ✅ 2026/01/26: uiText 以 import 方式導入（比照其他檔案）
  // - 避免依賴 window.uiText（dev/prod/SSR 都可能是 undefined）
  // - uiText 本身是「純資料」模組，直接 import 即可

  // ============================================================
  // ✅ 2026/01/25 Step 1 — Terms Modal（全域視窗 + scroll）
  // 觸發：window.dispatchEvent(new CustomEvent("open-terms"))
  // ============================================================
  const [__isTermsOpen, __setIsTermsOpen] = useState(false);
  // ✅ 2026/01/26 Step 2 — Terms Modal (STATE-ONLY, no window/event)
  // 規則：不刪除既有 Terms 相關 legacy state，但本 modal 開關只使用 __termsOpenStateOnly
  const [__termsOpenStateOnly, __setTermsOpenStateOnly] = useState(false);

  // ✅ 2026/02/02 — Support Admin Modal (STATE-ONLY, no route)
  const [supportAdminOpen, setSupportAdminOpen] = useState(false);
// ✅ 2026/01/26 Step 2 — Minimal MD-lite renderer (force title/heading styles)
  // - 支援：# / ## / 一般段落（以換行切段）
  // - 目的：標題樣式不受 pre-wrap/外層 fontSize 影響
  
    const __renderMdLite = (raw = "") => {
    try {
      const lines = String(raw || "").split(/\n/);
      const out = [];

      // headingLevel:
      // 0 = before any heading
      // 1 = inside H1 section (# ...)
      // 2 = inside H2 section (## ...)
      let headingLevel = 0;

      // sectionOpen: after "1. 帳戶" (section title) we indent body differently
      let sectionOpen = false;

      const isBlank = (s) => !s || !String(s).trim();
      const isH1 = (s) => String(s || "").startsWith("# ");
      const isH2 = (s) => String(s || "").startsWith("## ");
      const isBullet = (s) => /^\s*-\s+/.test(String(s || ""));
      const isNumbered = (s) => /^\d+\.\s+/.test(String(s || ""));

      // Heuristic: "section title" looks like "1. 帳戶" (short, no punctuation / no markdown bold)
      const isSectionTitle = (s) => {
        return true;
      };

      // Indent rules you asked:
      // #  -> no indent
      // ## -> indent 1
      // body paragraphs -> indent 2 (under section)
      // numbered clauses -> a bit more than paragraph
      // bullets -> a bit more than numbered
      const INDENT = {
        h2: 16,          // "## ..."
        sectionTitle: 16, // "1. 帳戶"
        p: 24,           // normal paragraph inside section
        num: 34,         // "1. ..." clause (more than p)
        bullet: 44,      // "- ..." inside a numbered clause
      };

      for (let i = 0; i < lines.length; i++) {
        const lineRaw = lines[i];
        const line = String(lineRaw || "");

        if (isBlank(line)) {
          out.push(<div key={"sp-" + i} style={{ height: 8 }} />);
          continue;
        }

        // H1
        if (isH1(line)) {
          headingLevel = 1;
          sectionOpen = false;
          out.push(
            <div
              key={"h1-" + i}
              style={{
                fontSize: 22,
                fontWeight: 900,
                
              }}
            >
              {line.replace(/^#\s+/, "")}
            </div>
          );
          continue;
        }

        // H2
        if (isH2(line)) {
          headingLevel = 2;
          sectionOpen = false;
          out.push(
            <div
              key={"h2-" + i}
              style={{
                fontSize: 18,
                fontWeight: 800,
                margin: "0px 0 6px 6px",
              }}
            >
              {line.replace(/^##\s+/, "")}
            </div>
          );
          continue;
        }

        // Section title like "1. 帳戶"
        if (isSectionTitle(line)) {
          sectionOpen = true;
          out.push(
            <div
              key={"sec-" + i}
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                margin: "0px 0 6px 21px",
              }}
            >
              {line}
            </div>
          );
          continue;
        }

        const numbered = isNumbered(line);
        const bullet = isBullet(line);

        // Under a section: indent body
        // Outside section: keep left align (avoid sudden shifts for intro text)
        const marginLeft = sectionOpen
          ? bullet
            ? INDENT.bullet
            : numbered
            ? INDENT.num
            : INDENT.p
          : 0;

        out.push(
          <div
            key={"p-" + i}
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              margin: "4px 0",
              marginLeft,
            }}
          >
            {line}
          </div>
        );
      }

      return out;
    } catch (e) {
      return <div style={{ fontSize: 13, lineHeight: 1.7 }}>{String(raw || "")}</div>;
    }
  };



  const [__termsText, __setTermsText] = useState("");
  const [__termsLoadErr, __setTermsLoadErr] = useState("");

  const __loadTermsMd = async (__lang) => {
    try {
      __setTermsLoadErr("");
      const lang = (__lang || "en").toString();
      const res = await fetch(`/terms/terms.${lang}.md`);
      if (!res.ok) throw new Error(String(res.status));
      const txt = await res.text();
      __setTermsText(txt || "");
    } catch (e) {
      // fallback to en
      try {
        const res2 = await fetch(`/terms/terms.en.md`);
        if (!res2.ok) throw new Error(String(res2.status));
        const txt2 = await res2.text();
        __setTermsText(txt2 || "");
      } catch (e) {
        __setTermsText("");
        __setTermsLoadErr("Failed to load Terms.");
      }
    }
  };

  useEffect(() => {
    const __onOpen = () => {
      __setIsTermsOpen(true);
      try {
        __loadTermsMd(uiLang || "en");
      } catch (e) {}
    };
    window.addEventListener("open-terms", __onOpen);
    return () => window.removeEventListener("open-terms", __onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
  }, [__isTermsOpen]);
  const __renderTermsModal = () => {
    if (!__termsOpenStateOnly) return null; // state-only
    return (
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => {
          if (e && e.target && e.target === e.currentTarget) {
            __setTermsOpenStateOnly(false);
          }
        }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 760,
            maxHeight: "85vh",
            background: "var(--card-bg)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "2px 28px 2px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 1.2 }}>

            </div>
            <button
              type="button"
              onClick={() => __setTermsOpenStateOnly(false)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 6,
                lineHeight: 1,
                color: "var(--text-muted)",
                fontSize: 16,
                fontWeight: 900,
              }}
              aria-label={(uiText?.[uiLang]?.common?.close || uiText?.en?.common?.close) || "Close"}
              title={(uiText?.[uiLang]?.common?.close || uiText?.en?.common?.close) || "Close"}
            >
              ×
            </button>
          </div>

          <div
            style={{
              padding: "20px 28px 24px",
              maxHeight: "calc(85vh - 52px)",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            {__termsLoadErr ? (
              <div style={{ color: "var(--text-muted)" }}>{__termsLoadErr}</div>
            ) : __termsText ? (
              <div>{__renderMdLite(__termsText)}</div>
            ) : (
              <div style={{ color: "var(--text-muted)" }}>{(uiText?.[uiLang]?.common?.loading || uiText?.en?.common?.loading) || "Loading…"} </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  const renderSupportAdminModal = () => {
    if (!supportAdminOpen) return null;
    return (
      <div
        role="dialog"
        aria-modal="true"
        
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
        }}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "min(1200px, 96vw)",
            height: "min(900px, 92vh)",
            background: "var(--card-bg)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {((uiText?.[uiLang]?.support?.adminTitle || uiText?.en?.support?.adminTitle) || "Support Admin")}
            </div>
            <button
              type="button"
              onClick={() => setSupportAdminOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 6,
                lineHeight: 1,
                color: "var(--text-muted)",
                fontSize: 18,
                fontWeight: 900,
              }}
              aria-label={(uiText?.[uiLang]?.common?.close || uiText?.en?.common?.close) || "Close"}
              title={(uiText?.[uiLang]?.common?.close || uiText?.en?.common?.close) || "Close"}
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <SupportAdminPage onClose={() => setSupportAdminOpen(false)} />
          </div>
        </div>
      </div>
    );
  };



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
    } catch (e) {
      return Boolean(interactionDisabled);
    }
  })();

  /** 模組：選單開關（右上角頭像選單） */
  const [menuOpen, setMenuOpen] = useState(false);
  /** 模組：登入彈窗（未登入入口 icon） */
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const menuWrapRef = useRef(null);

  function __clearAuthLocalStorage() {
    try {
      if (typeof window === "undefined") return;
      const ls = window.localStorage;
      if (!ls) return;

      // Supabase v2 default: sb-<project>-auth-token
      const keys = Object.keys(ls);
      for (const k of keys) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
          try { ls.removeItem(k); } catch {}
        }
      }

      // common fallbacks (safe no-op if absent)
      try { ls.removeItem("supabase.auth.token"); } catch {}
      try { ls.removeItem("sb-auth-token"); } catch {}
      try { ls.removeItem("access_token"); } catch {}
      try { ls.removeItem("token"); } catch {}
    } catch {}
  }

  function __renderLoginModal() {
    if (!loginModalOpen) return null;

    return (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          zIndex: 9999,
        }}
        onMouseDown={(e) => {
          // 點擊遮罩關閉（只在遮罩本身）
          if (e.target === e.currentTarget) setLoginModalOpen(false);
        }}
      >
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setLoginModalOpen(false)}
            aria-label="Close"
            style={{
              position: "absolute",
              right: 10,
              top: 10,
              width: 34,
              height: 34,
              borderRadius: 999,
              border: "1px solid var(--border-subtle)",
              background: "var(--card-bg)",
              color: "var(--text-main)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: "34px",
              textAlign: "center",
            }}
          >
            ✕
          </button>

          <LoginPage embedded />
        </div>
      </div>
    );
  }


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
    trace("usage:effect", { hasUser: !!user, isSupportAdmin });

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

  /** 模組：導向 Lemon Checkout（external_id 已由後端用 token 取得 profiles.id） */
  const [__billingBusy, setBillingBusy] = useState(false);
  const startCheckout = async (interval) => {
    if (__billingBusy) return;
    setBillingBusy(true);
    try {
      const token = getAccessTokenFromLocalStorage();
      if (!token) {
        alert(
          (uiText?.[uiLang]?.layout?.upgradeLoginRequired || uiText?.en?.layout?.upgradeLoginRequired) ||
            "Please sign in to upgrade"
        );
        return;
      }

      const r = await apiFetch("/api/billing/checkout-url", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ interval }),
      });

      if (!r.ok) {
        const t = await r.text().catch(() => "");
        console.warn("[LayoutShell] billing checkout-url failed:", r.status, t);
        alert(
          (uiText?.[uiLang]?.layout?.checkoutUrlFailed || uiText?.en?.layout?.checkoutUrlFailed) ||
            "Failed to get checkout link. Please try again."
        );
        return;
      }

      const data = await r.json().catch(() => null);
      const url = data?.url;
      if (!url) {
        alert(
          (uiText?.[uiLang]?.layout?.checkoutUrlMissing || uiText?.en?.layout?.checkoutUrlMissing) ||
            "Failed to get checkout link (no URL)."
        );
        return;
      }

      window.location.href = url;
    } catch (e) {
      console.warn("[LayoutShell] startCheckout failed:", e);
      alert(
        (uiText?.[uiLang]?.layout?.checkoutUrlFailed || uiText?.en?.layout?.checkoutUrlFailed) ||
          "Failed to get checkout link. Please try again."
      );
    } finally {
      setBillingBusy(false);
    }
  };

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
      proof('usage:fetch:start');

      trace("usage:fetch:start");

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
    } catch (e) {
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
        } catch (e) {
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
        } catch (e) {
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
      } catch (e) {
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
        } catch (e) {
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
      } catch (e) {
        // 靜默
      }
    }
  }

  /** 模組：開站/登入狀態變化就抓一次 usage */
  useEffect(() => {
    // ⛔ authReady=false：不發送任何需要權限的請求（避免 refresh restore 窗口 401 / 狀態誤判）
    if (!authReady) return;

    if (!user?.id) {
      setGroqKeyDebug(null);
    }

    fetchUsageSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, showDebugKey, authReady]);

  /** 模組：核心：每次前端真的呼叫 API 成功就更新 usage（無輪詢） */
  useEffect(() => {
    const onUsageUpdated = () => {
      fetchUsageSummary();
    };
    window.addEventListener("usage-updated", onUsageUpdated);
    return () => window.removeEventListener("usage-updated", onUsageUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, showDebugKey, authReady]);

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
            {/* 模組：左上 Logo + 語言選擇 + TOS（Logo 與語言匡不同 div，但同一高度對齊） */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  height: 30,
                  display: "inline-flex",
                  alignItems: "center",
                  flex: "0 0 auto",
                }}
              >
                <img
                  src="/logo.png"
                  alt="soLang"
                  style={{
                    width: 40,
                    height: 40,
                    display: "block",
                    objectFit: "contain",
                  }}
                />
              </div>

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
                  padding: "6px 6px 6px 6px",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                }}
              >
                🌐 :
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

              <span
                aria-hidden="true"
                style={{
                  width: 1,
                  height: 24,
                  background: "var(--border-subtle)",
                }}
              />

              <button
                type="button"
                disabled={__interactionDisabled}
                onClick={() => {
                  __setTermsOpenStateOnly(true);
                  try {
                    __loadTermsMd(uiLang || "en");
                  } catch (e) {}
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "6px 10px",
                  cursor: __interactionDisabled ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: __interactionDisabled ? 0.55 : 1,
                }}
                title={(uiText?.[uiLang]?.layout?.termsOfService || uiText?.en?.layout?.termsOfService) || "Terms of Service"}
                aria-label={(uiText?.[uiLang]?.layout?.termsOfService || uiText?.en?.layout?.termsOfService) || "Terms of Service"}
              >
                <BalanceScaleIcon size={18} />
              </button>
              </div>
            </div>


            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                title="登入 / 註冊"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--card-bg)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                <PersonOutlineIcon size={18} />
              </button>
            </div>
          </div>

          {children}

          {__renderTermsModal()}
          {__renderLoginModal()}
          {renderSupportAdminModal()}
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
          {/* 模組：左上 Logo + 語言選擇 + TOS（Logo 與語言匡不同 div，但同一高度對齊） */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                height: 30,
                display: "inline-flex",
                alignItems: "center",
                flex: "0 0 auto",
              }}
            >
              <img
                src="/logo.png"
                alt="soLang"
                style={{
                  width: 28,
                  height: 28,
                  display: "block",
                  objectFit: "contain",
                }}
              />
            </div>

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
                  padding: "6px 6px 6px 6px",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                }}
              >
                🌐 :
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

              <span
                aria-hidden="true"
                style={{
                  width: 1,
                  height: 24,
                  background: "var(--border-subtle)",
                }}
              />

              <button
                type="button"
                disabled={__interactionDisabled}
                onClick={() => {
                  __setTermsOpenStateOnly(true);
                  try {
                    __loadTermsMd(uiLang || "en");
                  } catch (e) {}
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "6px 10px",
                  cursor: __interactionDisabled ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: __interactionDisabled ? 0.55 : 1,
                }}
                title={(uiText?.[uiLang]?.layout?.termsOfService || uiText?.en?.layout?.termsOfService) || "Terms of Service"}
                aria-label={(uiText?.[uiLang]?.layout?.termsOfService || uiText?.en?.layout?.termsOfService) || "Terms of Service"}
              >
                <BalanceScaleIcon size={18} />
              </button>
            </div>

          </div>

          <div
            key={user.id}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >

            {/* ✅ 2026/01/25：Support Admin 入口（AuthProvider.isSupportAdmin 單一真相） */}
            {authReady && isSupportAdmin ? (
              <button
                type="button"
                onClick={(e) => {
                  if (__interactionDisabled) return;
                  setSupportAdminOpen(true);
                }}
                disabled={__interactionDisabled}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: __interactionDisabled ? "not-allowed" : "pointer",
                }}
                title="客服管理"
                aria-label="客服管理"
              >
                <span style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--border-subtle)", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--card-bg)" }}>
                  <SupportAdminIcon size={20} />
                </span>
              </button>
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
                  <span style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-subtle)", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff" }}><PersonOutlineIcon size={18} /></span>
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
                      {(uiText?.[uiLang]?.usage?.today || uiText?.en?.usage?.today) || "Today"}: LLM{" "}
                      {usage.today.byKind.llm || 0} · TTS{" "}
                      {usage.today.byKind.tts || 0}
                      <br />
                      {(uiText?.[uiLang]?.usage?.month || uiText?.en?.usage?.month) || "Month"}: LLM{" "}
                      {usage.month.byKind.llm || 0} · TTS{" "}
                      {usage.month.byKind.tts || 0}
                    </div>
                  )}
                  {/* 模組：訂閱方案 */}
                  <div style={{ marginTop: 8 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 6,
                      }}
                    >
                      {(uiText?.[uiLang]?.layout?.planLabel || uiText?.en?.layout?.planLabel || "Plan: ")}
                      {planText}
                    </div>

                    {profile?.plan === "free" ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          disabled={__billingBusy}
                          onClick={() => startCheckout("month")}
                          style={{
                            flex: 1,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--border-subtle)",
                            background: "var(--card-bg)",
                            color: "var(--text-main)",
                            fontSize: 12,
                            cursor: "pointer",
                            textAlign: "center",
                            opacity: __billingBusy ? 0.6 : 1,
                          }}
                        >
                          {(uiText?.[uiLang]?.layout?.upgradeMonthly || uiText?.en?.layout?.upgradeMonthly) ||
                            "Upgrade (monthly)"}
                        </button>

                        <button
                          type="button"
                          disabled={__billingBusy}
                          onClick={() => startCheckout("year")}
                          style={{
                            flex: 1,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--border-subtle)",
                            background: "var(--card-bg)",
                            color: "var(--text-main)",
                            fontSize: 12,
                            cursor: "pointer",
                            textAlign: "center",
                            opacity: __billingBusy ? 0.6 : 1,
                          }}
                        >
                          {(uiText?.[uiLang]?.layout?.upgradeYearly || uiText?.en?.layout?.upgradeYearly) ||
                            "Upgrade (yearly)"}
                        </button>
                      </div>
                    ) : null}
                  </div>



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
                      } finally {
                        // ✅ 確保 session / localStorage 都清乾淨，避免「登出後又自動回登入」的假登出
                        try { await supabase.auth.signOut(); } catch {}
                        __clearAuthLocalStorage();
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
          </div>
          
        </div>

        {children}

        {__renderTermsModal()}
          {__renderLoginModal()}
          {renderSupportAdminModal()}

        {/* ====== 2026/02/01 新增：Footer - {uiText[uiLang]?.layout?.termsOfService || 'Terms of Service'}（最小插入，不影響既有邏輯） ====== */}
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
                    {/* DEPRECATED (2026/01/25): Terms link moved into ResultPanel (AI disclaimer area) */}
          {false && (
          <button
                      type="button"
                      onClick={() => {
                        try {
                          window.dispatchEvent(new CustomEvent("open-terms"));
                        } catch (e) {}
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      {uiText[uiLang]?.layout?.termsOfService || 'Terms of Service'}
                    </button>
          )}

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
// END FILE: frontend/src/components/layout/LayoutShell.jsx

// END PATH: frontend/src/components/layout/LayoutShell.jsx