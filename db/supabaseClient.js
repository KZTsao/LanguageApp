// db/supabaseClient.js
// 專案共用的 Supabase Client（Node 環境用）

const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const dotenv = require("dotenv");

// 這裡的 __dirname 在 /db 資料夾
// 我們的 .env 在 /backend/.env
const envPath = path.resolve(__dirname, "../backend/.env");
dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "[supabase] SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 未設定，請確認 backend/.env"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

module.exports = { supabase };
