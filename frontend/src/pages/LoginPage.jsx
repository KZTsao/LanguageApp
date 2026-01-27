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

function getOrigin() {
  try {
    if (typeof window === "undefined") return "";
    return window.location.origin || "";
  } catch {
    return "";
  }
}

const MODE = {
  SIGN_IN: "sign_in",
  SIGN_UP: "sign_up",
  FORGOT: "forgot",
};

export default function LoginPage() {
  const origin = useMemo(() => getOrigin(), []);
  const [mode, setMode] = useState(MODE.SIGN_IN);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const ui = useMemo(() => {
    const cardStyle = {
      width: "min(520px, calc(100vw - 40px))",
      borderRadius: 18,
      border: "1px solid var(--border-subtle)",
      background: "var(--card-bg)",
      boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
      padding: 18,
    };

    const titleStyle = {
      fontSize: 18,
      fontWeight: 800,
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
      padding: "6px 12px",
      borderRadius: 999,
      border: active ? "1px solid var(--border-subtle)" : "1px solid var(--border-soft)",
      background: active ? "var(--bg-soft)" : "transparent",
      color: "var(--text-main)",
      fontSize: 12,
      cursor: "pointer",
    });

    const inputStyle = {
      width: "100%",
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
      borderRadius: 12,
      border: "1px solid var(--border-subtle)",
      background: "var(--bg-soft)",
      color: "var(--text-main)",
      padding: "10px 12px",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
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

    return { cardStyle, titleStyle, subStyle, segWrap, segBtn, inputStyle, labelStyle, primaryBtn, linkBtn };
  }, []);

  const resetMsg = () => {
    setError("");
    setInfo("");
  };

  const validateEmail = () => {
    const v = String(email || "").trim();
    if (!v) return "請輸入 Email";
    // 最小檢查，不做過度嚴格
    if (!v.includes("@")) return "Email 格式看起來不正確";
    return "";
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
        setError("請輸入密碼");
        return;
      }
      if (mode === MODE.SIGN_UP && String(password || "").length < 6) {
        setError("密碼至少 6 碼");
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

        setInfo("登入成功，正在回到首頁…");
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

        setInfo("已送出註冊，請到信箱完成驗證（驗證後會回到此站）");
        return;
      }

      if (mode === MODE.FORGOT) {
        const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
          redirectTo: emailRedirectTo,
        });
        if (error) throw error;

        setInfo("已寄出重設密碼信，請到信箱點連結回到本站設定新密碼");
        return;
      }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const pageWrap = {
    minHeight: "calc(100vh - 80px)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "22px 14px",
  };

  const blockGap = { marginTop: 12 };

  const renderNickname = mode === MODE.SIGN_UP;

  const mainTitle =
    mode === MODE.SIGN_IN ? "Email 登入" : mode === MODE.SIGN_UP ? "Email 註冊" : "忘記密碼";

  const submitText =
    mode === MODE.SIGN_IN ? (loading ? "登入中…" : "登入") : mode === MODE.SIGN_UP ? (loading ? "送出中…" : "註冊並寄驗證信") : loading ? "送出中…" : "寄重設密碼信";

  return (
    <div style={pageWrap}>
      <div style={ui.cardStyle}>
        <h2 style={ui.titleStyle}>{mainTitle}</h2>
        <p style={ui.subStyle}>
          Google 登入照舊可用；Email 流程用於沒有 Google 帳號或想分開管理的使用者
        </p>

        <div style={ui.segWrap}>
          <button
            type="button"
            style={ui.segBtn(mode === MODE.SIGN_IN)}
            onClick={() => {
              resetMsg();
              setMode(MODE.SIGN_IN);
            }}
          >
            登入
          </button>
          <button
            type="button"
            style={ui.segBtn(mode === MODE.SIGN_UP)}
            onClick={() => {
              resetMsg();
              setMode(MODE.SIGN_UP);
            }}
          >
            註冊
          </button>
          <button
            type="button"
            style={ui.segBtn(mode === MODE.FORGOT)}
            onClick={() => {
              resetMsg();
              setMode(MODE.FORGOT);
            }}
          >
            忘記密碼
          </button>
        </div>

        <div style={blockGap}>
          <div style={ui.labelStyle}>Email</div>
          <input
            style={ui.inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
          />
        </div>

        {mode !== MODE.FORGOT && (
          <div style={blockGap}>
            <div style={ui.labelStyle}>密碼</div>
            <input
              style={ui.inputStyle}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === MODE.SIGN_UP ? "至少 6 碼" : ""}
              type="password"
              autoComplete={mode === MODE.SIGN_UP ? "new-password" : "current-password"}
            />
          </div>
        )}

        {renderNickname && (
          <div style={blockGap}>
            <div style={ui.labelStyle}>暱稱（選填）</div>
            <input
              style={ui.inputStyle}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="顯示在右上角，例如：Barbie"
              autoComplete="nickname"
            />
          </div>
        )}

        <div style={{ ...blockGap, marginTop: 16 }}>
          <button type="button" style={ui.primaryBtn} onClick={handleSubmit} disabled={loading}>
            {submitText}
          </button>
        </div>

        {(error || info) && (
          <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}>
            {error && <div style={{ color: "#c0392b" }}>⚠️ {error}</div>}
            {info && <div style={{ color: "var(--text-muted)" }}>✅ {info}</div>}
          </div>
        )}

        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            style={ui.linkBtn}
            onClick={() => {
              resetMsg();
              try {
                if (typeof window !== "undefined") window.location.assign("/");
              } catch {
                // ignore
              }
            }}
          >
            回首頁
          </button>

          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            回跳：{origin ? `${origin}/auth/callback` : "（未知 origin）"}
          </div>
        </div>
      </div>
    </div>
  );
}
// END PATH: frontend/src/pages/LoginPage.jsx
