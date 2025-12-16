// frontend/src/components/layout/LayoutShell.jsx
// 負責：外層版面、主題切換、語言切換（Sprache）

import { useEffect, useMemo, useRef, useState } from "react";
import LoginButton from "../auth/LoginButton";
import { useAuth } from "../../context/AuthProvider";

function hashToHue(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

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

function getUsagePillStyle() {
  return {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-muted)",
    opacity: 0.7,
    lineHeight: "12px",
    letterSpacing: 0.2,
    userSelect: "none",
    whiteSpace: "nowrap",
  };
}

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

// 選單內顯示用（比頭像旁邊更容易看見，但仍然淡）
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

// 從 localStorage 取得 supabase access token（不引入新 client）
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

function LayoutShell({ theme, onToggleTheme, uiLang, onChangeUiLang, children }) {
  const { user, profile, signOut } = useAuth();

  // UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef(null);

  // usage state（未登入/已登入都看得到）
  const [usage, setUsage] = useState(null);

  // debug: groq key var（只有指定帳號看得到）
  const [groqKeyDebug, setGroqKeyDebug] = useState(null);

  const showDebugKey = "1"
    //String(import.meta?.env?.VITE_SHOW_DEBUG_KEY || "").trim() === "1";

  // ✅ 讓你在 Console 不用 import.meta 也能看 showDebugKey / key 狀態
  useEffect(() => {
    window.__layoutShellDebug = window.__layoutShellDebug || {};
    window.__layoutShellDebug.showDebugKey = showDebugKey;
    window.__layoutShellDebug.userId = user?.id || null;
  }, [showDebugKey, user?.id]);

  const planText = useMemo(() => {
    const p = (profile?.plan || "free").toString().trim();
    return `${p}plan`.toLowerCase();
  }, [profile?.plan]);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [user?.id]);

  // ✅ 對齊後端：GET /admin/usage?days=7
  async function fetchUsageSummary() {
    const token = getAccessTokenFromLocalStorage();

    try {
      const r = await fetch("/admin/usage?days=7", {
        headers: token ? { Authorization: "Bearer " + token } : undefined,
      });
      if (!r.ok) return;

      const data = await r.json();

      // usage：所有人都可看
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

      // debug key：只有 canView=true 才能看到 currentKeyVar（且你只要變數名，不要實際值）
      const dbg = data?.__debug?.groq;

      // ✅ console 之外，直接放到 window 讓你看（不需要改 build / 不需要 import.meta）
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
    } catch {
      // 靜默
    }
  }

  // 開站就抓一次（未登入也抓 usage；登入後才可能拿到 debug key）
  useEffect(() => {
    if (!user?.id) {
      setGroqKeyDebug(null);
    }

    fetchUsageSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, showDebugKey]);

  // ✅ 核心：每次前端「真的呼叫 API 成功」就更新一次 usage（無輪詢）
  // apiClient.js 會在 resp.ok 時 dispatch：window.dispatchEvent(new Event("usage-updated"))
  useEffect(() => {
    const onUsageUpdated = () => {
      fetchUsageSummary();
    };
    window.addEventListener("usage-updated", onUsageUpdated);
    return () => window.removeEventListener("usage-updated", onUsageUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, showDebugKey]);

  const usageText = usage
    ? `Usage · Today LLM ${usage.today.byKind.llm || 0} · TTS ${
        usage.today.byKind.tts || 0
      } · Month LLM ${usage.month.byKind.llm || 0} · TTS ${
        usage.month.byKind.tts || 0
      }`
    : "";

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
            {/* ★ 語言選擇：同一個匡（pill） */}
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
                value={uiLang}
                onChange={(e) => onChangeUiLang(e.target.value)}
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
                onClick={onToggleTheme}
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
          {/* ★ 語言選擇：同一個匡（pill） */}
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
              value={uiLang}
              onChange={(e) => onChangeUiLang(e.target.value)}
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

          <div
            key={user.id}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
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

              {/* ✅ 淡淡顯示目前 key 變數名（不顯示實際值） */}
              {debugKeyText ? (
                <span style={getDebugKeyPillStyle()}>{debugKeyText}</span>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  const next = !menuOpen;
                  setMenuOpen(next);
                  // 打開選單就立刻刷新一次（更像「即時」）
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

                  {/* ✅ 也放在選單內，確保你真的看得到（仍只顯示變數名） */}
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
              onClick={onToggleTheme}
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

export default LayoutShell;
// frontend/src/components/layout/LayoutShell.jsx
