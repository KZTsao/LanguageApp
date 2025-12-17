// frontend/src/supabaseClient.js
/**
 * 文件說明：
 * - supabaseClient：建立 Supabase client 單例（避免 HMR / reload 重複建立造成 Multiple GoTrueClient instances）
 * - 本檔新增 Production 排查用初始化狀態與一次性 log（不洩漏 key）
 *
 * 異動紀錄：
 * - 2025-12-17：加入 Production 排查初始化狀態（__PROD_DIAG__）與一次性 init log（hasUrl/hasAnonKey/urlPreview）
 * - （保留舊的異動紀錄：原本無）
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ 這個 key 你也可以改成更獨特的名稱，但全專案要一致
const GLOBAL_KEY = "__LANGAPP_SUPABASE__";

// ✅ 功能初始化狀態（Production 排查）
// - 用於確認 production env 是否正確注入（不洩漏敏感資訊）
const __PROD_DIAG__ = (globalThis.__LANGAPP_SUPABASE_DIAG__ =
  globalThis.__LANGAPP_SUPABASE_DIAG__ || {
    initedAt: new Date().toISOString(),
    hasLoggedInit: false,
    hasUrl: null,
    hasAnonKey: null,
    urlPreview: null,
    createdClient: null,
  });

// ✅ Production 排查用 log（一次性，避免洗版）
const prodInitLogOnce = () => {
  if (!import.meta?.env?.PROD) return;
  if (__PROD_DIAG__.hasLoggedInit) return;

  __PROD_DIAG__.hasLoggedInit = true;
  __PROD_DIAG__.hasUrl = !!SUPABASE_URL;
  __PROD_DIAG__.hasAnonKey = !!SUPABASE_ANON_KEY;
  __PROD_DIAG__.urlPreview = SUPABASE_URL ? SUPABASE_URL.slice(0, 30) + "…" : null;

  console.log("[Supabase][Prod] init", {
    hasUrl: __PROD_DIAG__.hasUrl,
    hasAnonKey: __PROD_DIAG__.hasAnonKey,
    urlPreview: __PROD_DIAG__.urlPreview,
  });
};

// ✅ 跨 HMR / reload 的單例：避免重複 createClient → Multiple GoTrueClient instances
if (!globalThis[GLOBAL_KEY]) {
  prodInitLogOnce();

  globalThis[GLOBAL_KEY] = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  __PROD_DIAG__.createdClient = true;
} else {
  __PROD_DIAG__.createdClient = false;
}

export const supabase = globalThis[GLOBAL_KEY];
// frontend/src/supabaseClient.js
