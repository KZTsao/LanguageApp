// frontend/src/components/SearchBox.jsx
// 單行 input + 字體放大（18px）

function SearchBox({
  text,
  onChangeText,
  onKeyDown,
  onSubmit,
  loading,
  t,
}) {
  return (
    <>
      {/* 單行輸入框 */}
      <input
        type="text"
        value={text}
        onChange={(e) => onChangeText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t.placeholder}
        style={{
          width: "100%",
          padding: "10px 12px",
          height: "48px",    // ★ 微調高度讓大字更舒適
          borderRadius: 10,
          border: "1px solid var(--border-subtle)",
          background: "var(--input-bg)",
          color: "var(--text-main)",
          marginBottom: 12,
          fontSize: "18px",  // ★ 字體放大
          lineHeight: "24px",
          fontWeight: 500,   // ★ 看起來更清楚（可改回 400）
        }}
      />

      {/* 查詢按鈕 */}
      <button
        onClick={onSubmit}
        disabled={loading}
        style={{
          padding: "10px 20px",
          borderRadius: 10,
          border: "none",
          fontWeight: 600,
          cursor: "pointer",
          background: loading ? "var(--border-subtle)" : "var(--accent)",
          color: "var(--button-text)",
        }}
      >
        {loading ? t.loading : t.submit}
      </button>
    </>
  );
}

export default SearchBox;
