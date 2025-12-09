-- 簡單示範：記錄使用者查詢的歷史
-- 你之後如果不用 DB，這份就先當參考

CREATE TABLE IF NOT EXISTS lookups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,         -- 'word' 或 'sentence'
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
