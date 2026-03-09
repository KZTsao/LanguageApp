// PATH: frontend/src/pages/LoginPage.jsx
/**
 * LoginPage (A1: 獨立 /login 頁)
 *
 * 目標：提供 Email 登入 / 註冊（含暱稱選填）/ 忘記密碼（寄信）
 * 風格：盡量沿用既有 App 的 CSS vars（button / card / border / text）避免突兀
 *
 * 注意：
 * - 不在此檔管理全域 auth state（session/user 仍由 AuthProvider 負責）
 * - 此頁只呼叫 supabase.auth.*，成功後導回首頁或提示去收信
 */

import { useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import uiText from "../uiText";

function getOrigin() {
  try {
    if (typeof window === "undefined") return "";
    return window.location.origin || "";
  } catch {
    return "";
  }
}

function getUiLangSafe() {
  try {
    if (typeof window === "undefined") return "zh-TW";
    const legacy = window?.localStorage?.getItem("langapp_ui_lang_v1");
    if (legacy) return legacy;

    const ls = window?.localStorage;
    if (ls && typeof ls.length === "number") {
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && String(k).includes("langapp_ui_lang_v1")) {
          const v = ls.getItem(k);
          if (v) return v;
        }
      }
    }
  } catch {}
  return "zh-TW";
}

const MODE = {
  SIGN_IN: "sign_in",
  SIGN_UP: "sign_up",
  FORGOT: "forgot",
};

export default function LoginPage({ embedded = false } = {}) {
  const origin = useMemo(() => getOrigin(), []);
  const [mode, setMode] = useState(MODE.SIGN_IN);

  const [uiLang, setUiLang] = useState(() => getUiLangSafe());
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [nickname, setNickname] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const t = (path, fallback) => {
    const dict = uiText?.[uiLang] || uiText?.en || uiText?.["zh-TW"] || {};
    const fallbackDict = uiText?.en || uiText?.["zh-TW"] || {};
    const pick = (obj) =>
      String(path || "")
        .split(".")
        .reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), obj);

    return pick(dict) ?? pick(fallbackDict) ?? fallback;
  };

  const ui = useMemo(() => {
    const cardStyle = {
      width: "min(520px, calc(100vw - 40px))",
      maxWidth: "100%",
      boxSizing: "border-box",
      borderRadius: 18,
      border: "1px solid var(--border-subtle)",
      background: "var(--card-bg)",
      boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
      padding: 18,
      overflow: "hidden",
    };

    const titleStyle = {
      fontSize: 18,
      fontWeight: 900,
      color: "var(--text-main)",
      margin: 0,
    };

    const subStyle = {
      fontSize: 12,
      color: "var(--text-muted)",
      marginTop: 6,
      marginBottom: 0,
      lineHeight: 1.5,
    };

    const segWrap = {
      display: "flex",
      gap: 8,
      marginTop: 14,
      marginBottom: 14,
      flexWrap: "wrap",
    };

    const segBtn = (active) => ({
      padding: "7px 12px",
      borderRadius: 999,
      border: active ? "1px solid var(--accent, var(--border-subtle))" : "1px solid var(--border-soft)",
      background: active ? "var(--accent-soft, var(--bg-soft))" : "transparent",
      color: active ? "var(--accent, var(--text-main))" : "var(--text-main)",
      fontSize: 12,
      fontWeight: 800,
      cursor: "pointer",
    });

    const inputStyle = {
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      borderRadius: 999,
      border: "1px solid var(--border-subtle)",
      background: "var(--bg-soft)",
      color: "var(--text-main)",
      padding: "10px 12px",
      fontSize: 13,
      outline: "none",
    };

    const labelStyle = {
      fontSize: 12,
      color: "var(--text-muted)",
      marginBottom: 6,
    };

    const primaryBtn = {
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      borderRadius: 12,
      border: "1px solid var(--accent, #0369a1)",
      background: "var(--accent, #0369a1)",
      color: "#fff",
      padding: "10px 12px",
      fontSize: 13,
      fontWeight: 900,
      cursor: "pointer",
      boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
      opacity: 1,
    };

    const secondaryBtn = {
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      borderRadius: 12,
      border: "1px solid var(--border-subtle)",
      background: "var(--card-bg)",
      color: "var(--text-main)",
      padding: "10px 12px",
      fontSize: 13,
      fontWeight: 900,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    };

    const linkBtn = {
      border: "none",
      background: "transparent",
      color: "var(--text-muted)",
      fontSize: 12,
      cursor: "pointer",
      padding: 0,
      textDecoration: "underline",
      textUnderlineOffset: 3,
    };

    const selectStyle = {
      borderRadius: 999,
      border: "1px solid var(--border-subtle)",
      background: "var(--bg-soft)",
      color: "var(--text-main)",
      padding: "6px 10px",
      fontSize: 12,
      outline: "none",
      maxWidth: "100%",
      boxSizing: "border-box",
    };

    return { cardStyle, titleStyle, subStyle, segWrap, segBtn, inputStyle, labelStyle, primaryBtn, secondaryBtn, linkBtn, selectStyle };
  }, []);

  const resetMsg = () => {
    setError("");
    setInfo("");
  };

  const validateEmail = () => {
    const v = String(email || "").trim();
    if (!v) return t("loginPage.errors.emailRequired", "請輸入 Email");
    // 最小檢查，不做過度嚴格
    if (!v.includes("@")) return t("loginPage.errors.emailInvalid", "Email 格式看起來不正確");
    return "";
  };

  const handleGoogleSignIn = async () => {
    resetMsg();
    setLoading(true);
    try {
      const redirectTo = origin ? `${origin}/auth/callback` : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) throw error;
      
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    resetMsg();

    const emailErr = validateEmail();
    if (emailErr) {
      setError(emailErr);
      return;
    }

    if (mode !== MODE.FORGOT) {
      if (!String(password || "").trim()) {
        setError(t("loginPage.errors.passwordRequired", "請輸入密碼"));
        return;
      }
      if (mode === MODE.SIGN_UP && String(password || "").length < 6) {
        setError(t("loginPage.errors.passwordTooShort", "密碼至少 6 碼"));
        return;
      }
    }

    if (mode === MODE.SIGN_UP) {
      if (!String(password2 || "").trim()) {
        setError(t("loginPage.errors.passwordConfirmRequired", "請再輸入一次密碼"));
        return;
      }
      if (String(password2) !== String(password)) {
        setError(t("loginPage.errors.passwordMismatch", "兩次密碼不一致"));
        return;
      }
    }

    setLoading(true);
    try {
      const emailRedirectTo = origin ? `${origin}/auth/callback` : undefined;

      if (mode === MODE.SIGN_IN) {
        const { error } = await supabase.auth.signInWithPassword({
          email: String(email).trim(),
          password: String(password),
        });
        if (error) throw error;

        setInfo(t("loginPage.info.signInOk", "登入成功，正在回到首頁…"));
        try {
          if (typeof window !== "undefined") window.location.assign("/");
        } catch {
          // ignore
        }
        return;
      }

      if (mode === MODE.SIGN_UP) {
        const nn = String(nickname || "").trim();

        const { error } = await supabase.auth.signUp({
          email: String(email).trim(),
          password: String(password),
          options: {
            emailRedirectTo,
            // ✅ 暱稱選填：有填才寫入 user_metadata.full_name
            data: nn ? { full_name: nn } : undefined,
          },
        });
        if (error) throw error;

        setInfo(t("loginPage.info.signUpSent", "已送出註冊，請到信箱完成驗證（驗證後會回到此站）"));
        return;
      }

      if (mode === MODE.FORGOT) {
        const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
          redirectTo: emailRedirectTo,
        });
        if (error) throw error;

        setInfo(t("loginPage.info.resetSent", "已寄出重設密碼信，請到信箱點連結回到本站設定新密碼"));
        return;
      }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const pageWrap = embedded
    ? {
        width: "100%",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 0,
      }
    : {
        minHeight: "calc(100vh - 80px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "22px 14px",
      };

  const blockGap = { marginTop: 12 };
  const renderNickname = mode === MODE.SIGN_UP;

  const submitText =
    mode === MODE.SIGN_IN
      ? loading
        ? t("loginPage.buttons.signingIn", "登入中…")
        : t("loginPage.buttons.signIn", "登入")
      : mode === MODE.SIGN_UP
      ? loading
        ? t("loginPage.buttons.submitting", "送出中…")
        : t("loginPage.buttons.signUp", "註冊並寄驗證信")
      : loading
      ? t("loginPage.buttons.submitting", "送出中…")
      : t("loginPage.buttons.sendReset", "寄重設密碼信");

  const availableLangs = useMemo(() => {
    const preferred = ["zh-TW", "de", "en", "fr", "zh-CN"];
    const keys = Object.keys(uiText || {});
    const has = (k) => keys.includes(k);
    const list = preferred.filter((k) => has(k));
    // 若 uiText 沒有 fr，但外層選單有，仍可顯示（文案會 fallback）
    if (!list.includes("fr")) list.splice(3, 0, "fr");
    return Array.from(new Set(list));
  }, []);

  const langLabel = (k) => {
    switch (k) {
      case "zh-TW":
        return "繁體中文";
      case "zh-CN":
        return "簡體中文";
      case "en":
        return "English";
      case "de":
        return "Deutsch";
      case "fr":
        return "Français";
      default:
        return k;
    }
  };

  const handleChangeLang = (arg) => {
    const v = typeof arg === "string" ? arg : String(arg?.target?.value || "zh-TW");
    setUiLang(v);
    setLangMenuOpen(false);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem("langapp_ui_lang_v1", v);
    } catch {
      // ignore
    }
  };

  return (
    <div style={pageWrap} onMouseDown={() => setLangMenuOpen(false)}>
      <div style={ui.cardStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 12, flexWrap: "wrap" }}>
          
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setLangMenuOpen((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: "var(--card-bg)",
                color: "var(--text-main)",
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                lineHeight: 1.2,
              }}
              aria-label="Language"
            >
              <span aria-hidden="true">🌐</span>
              <span>{langLabel(uiLang)}</span>
              <span aria-hidden="true" style={{ marginLeft: 2 }}>▾</span>
            </button>

            {langMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "calc(100% + 8px)",
                  minWidth: 180,
                  borderRadius: 12,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--card-bg)",
                  boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
                  padding: 6,
                  zIndex: 50,
                }}
              >
                {availableLangs.map((k) => {
                  const active = k === uiLang;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleChangeLang(k)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 10px",
                        borderRadius: 10,
                        border: "none",
                        background: active ? "rgba(59,130,246,0.16)" : "transparent",
                        color: "var(--text-main)",
                        fontSize: 14,
                        fontWeight: active ? 900 : 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{langLabel(k)}</span>
                      {active ? <span aria-hidden="true">✓</span> : <span />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              ...ui.secondaryBtn,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {t("loginPage.buttons.googleSignIn", "使用 Google 登入")}
          </button>

          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
              marginBottom: 2,
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            <div style={{ height: 1, flex: 1, background: "var(--border-subtle)" }} />
            {t("loginPage.labels.orEmail", "或使用 Email")}
            <div style={{ height: 1, flex: 1, background: "var(--border-subtle)" }} />
          </div>
        </div>

        <div style={ui.segWrap}>
          <button
            type="button"
            style={ui.segBtn(mode === MODE.SIGN_IN)}
            onClick={() => {
              resetMsg();
              setMode(MODE.SIGN_IN);
            }}
          >
            {t("loginPage.tabs.signIn", "登入")}
          </button>
          <button
            type="button"
            style={ui.segBtn(mode === MODE.SIGN_UP)}
            onClick={() => {
              resetMsg();
              setMode(MODE.SIGN_UP);
            }}
          >
            {t("loginPage.tabs.signUp", "註冊")}
          </button>
          <button
            type="button"
            style={ui.segBtn(mode === MODE.FORGOT)}
            onClick={() => {
              resetMsg();
              setMode(MODE.FORGOT);
            }}
          >
            {t("loginPage.tabs.forgot", "忘記密碼")}
          </button>
        </div>

        <div style={blockGap}>
          <div style={ui.labelStyle}>{t("loginPage.labels.email", "Email")}</div>
          <input
            style={ui.inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("loginPage.placeholders.email", "name@example.com")}
            autoComplete="email"
          />
        </div>

        {mode !== MODE.FORGOT && (
          <div style={blockGap}>
            <div style={ui.labelStyle}>{t("loginPage.labels.password", "密碼")}</div>
            <input
              style={ui.inputStyle}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === MODE.SIGN_UP ? t("loginPage.placeholders.passwordSignUp", "至少 6 碼") : ""}
              type="password"
              autoComplete={mode === MODE.SIGN_UP ? "new-password" : "current-password"}
            />
          </div>
        )}

        {mode === MODE.SIGN_UP && (
          <div style={blockGap}>
            <div style={ui.labelStyle}>{t("loginPage.labels.passwordConfirm", "確認密碼")}</div>
            <input
              style={ui.inputStyle}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder={t("loginPage.placeholders.passwordConfirm", "再輸入一次密碼")}
              type="password"
              autoComplete="new-password"
            />
          </div>
        )}

        {renderNickname && (
          <div style={blockGap}>
            <div style={ui.labelStyle}>{t("loginPage.labels.nicknameOptional", "暱稱（選填）")}</div>
            <input
              style={ui.inputStyle}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("loginPage.placeholders.nickname", "顯示在右上角，例如：Barbie")}
              autoComplete="nickname"
            />
          </div>
        )}

        <div style={{ ...blockGap, marginTop: 16 }}>
          <button
            type="button"
            style={{
              ...ui.primaryBtn,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.85 : 1,
            }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {submitText}
          </button>
        </div>

        {(error || info) && (
          <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}>
            {error && <div style={{ color: "#c0392b" }}>⚠️ {error}</div>}
            {info && <div style={{ color: "var(--text-muted)" }}>✅ {info}</div>}
          </div>
        )}

      </div>
    </div>
  );
}
// END PATH: frontend/src/pages/LoginPage.jsx
