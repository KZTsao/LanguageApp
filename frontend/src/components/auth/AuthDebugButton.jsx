import { supabase } from "../../utils/supabaseClient";

export default function AuthDebugButton() {
  const testAuth = async () => {
    try {
      // 取得目前使用者 token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.warn("❌ 尚未登入，沒有 access token");
        return;
      }

      // 呼叫後端的 auth-test
      const res = await fetch("http://localhost:4000/api/auth-test", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      console.log("🔍 Auth 測試結果：", json);
    } catch (err) {
      console.error("Auth 測試錯誤：", err);
    }
  };

  return (
    <button
      onClick={testAuth}
      style={{
        padding: "4px 8px",
        fontSize: 10,
        borderRadius: 6,
        border: "1px solid var(--border-subtle)",
        background: "var(--card-bg)",
        color: "var(--text-main)",
      }}
    >
      測試 Auth
    </button>
  );
}
