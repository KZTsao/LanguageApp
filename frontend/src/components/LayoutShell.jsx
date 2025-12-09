// frontend/src/components/LayoutShell.jsx
// 負責：外層版面、主題切換、語言切換（Sprache）

function LayoutShell({ theme, onToggleTheme, uiLang, onChangeUiLang, t, children }) {
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
        {/* 選單列 */}
        <div
          style={{
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
              🌐 Sprache:
            </span>

            <select
              value={uiLang}
              onChange={(e) => onChangeUiLang(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                background: "var(--card-bg)",
                color: "var(--text-main)",
              }}
            >
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
              <option value="zh-CN">简体中文</option>
            </select>
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

        {/* 內文區 */}
        {children}
      </div>
    </div>
  );
}

export default LayoutShell;
