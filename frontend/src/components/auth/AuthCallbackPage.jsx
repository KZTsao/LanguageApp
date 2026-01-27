// PATH: frontend/src/components/auth/AuthCallbackPage.jsx
/**
 * AuthCallbackPage (no react-router)
 *
 * 用途：
 * - 接 Supabase Auth callback（Email 驗證、OAuth、Reset password）
 * - 解析 URL 中的 token，讓 session 落地（AuthProvider 會接手）
 * - 依情境導回首頁或 reset-password
 *
 * 說明：
 * - 專案目前未安裝 react-router-dom
 * - 此檔僅使用 window.location，不依賴 router
 */

import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabaseClient";

export default function AuthCallbackPage() {
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error) {
          setError(error.message || "Auth callback failed");
          return;
        }

        let type = null;
        try {
          const url = new URL(window.location.href);
          type = url.searchParams.get("type");
        } catch {
          // ignore
        }

        if (type === "recovery") {
          window.location.replace("/reset-password");
          return;
        }

        window.location.replace("/");
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || String(e));
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Signing you in…</h2>
      <p>請稍候，正在完成登入流程</p>
      {error && (
        <div style={{ marginTop: 12, color: "red" }}>
          Auth error: {error}
        </div>
      )}
    </div>
  );
}
// END PATH: frontend/src/components/auth/AuthCallbackPage.jsx
