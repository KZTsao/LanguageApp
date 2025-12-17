// backend/src/db/supabaseAdmin.js

/**
 * 文件說明：
 * Supabase Admin Client（Service Role）
 * - 僅後端可用，避免 key 外洩
 *
 * 異動日期：2025-12-17
 * 異動說明：
 * 1) 符合檔案規範：第一行/最後一行註解路徑、文件說明、異動日期/說明
 * 2) 模組化：環境檢查、建立 client 拆小
 * 3) 加入「初始化狀態」：可在 Production 快速判斷 env 是否齊全、client 是否已建立
 */

const { createClient } = require("@supabase/supabase-js");

/** =========================
 * 初始化狀態（Production 排查用）
 * ========================= */
const INIT_STATUS = {
  module: "supabaseAdmin",
  createdAt: new Date().toISOString(),
  env: {
    hasSupabaseUrl: false,
    hasServiceRoleKey: false,
  },
  client: {
    isReady: false,
    lastError: null,
  },
};

/** 功能：讀取 env（缺值就丟錯，避免 silent fail） */
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

/** 功能：更新初始化狀態（不記錄敏感值，只記錄存在性） */
function refreshEnvStatus() {
  INIT_STATUS.env.hasSupabaseUrl = Boolean(process.env.SUPABASE_URL);
  INIT_STATUS.env.hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** 功能：建立 Supabase Admin Client（service role） */
function createSupabaseAdminClient() {
  refreshEnvStatus();

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return client;
}

/**
 * 功能：取得 supabaseAdmin（lazy init）
 * - 避免 require 時就直接爆炸，讓錯誤更可控、更好定位
 */
let _client = null;

function getSupabaseAdmin() {
  if (_client) return _client;

  try {
    _client = createSupabaseAdminClient();
    INIT_STATUS.client.isReady = true;
    INIT_STATUS.client.lastError = null;
    return _client;
  } catch (e) {
    INIT_STATUS.client.isReady = false;
    INIT_STATUS.client.lastError = String(e && e.message ? e.message : e);
    throw e;
  }
}

/** 提供狀態給上層（僅非敏感資訊） */
function getSupabaseAdminInitStatus() {
  refreshEnvStatus();
  return { ...INIT_STATUS };
}

module.exports = {
  getSupabaseAdmin,
  getSupabaseAdminInitStatus,
};

// backend/src/db/supabaseAdmin.js
