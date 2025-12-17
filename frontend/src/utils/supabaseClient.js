// frontend/src/utils/supabaseClient.js
/**
 * 文件說明：
 * - utils/supabaseClient：Supabase Client 的統一出口（re-export）
 * - 原則：❗不要在這裡 createClient，避免多實例導致 Auth 行為異常
 * - 本次異動重點：加入 Production 排查用初始化狀態（globalThis）與可控 log（不影響既有邏輯）
 *
 * 異動紀錄：
 * - 2025/12/17：新增文件說明、異動紀錄、初始化狀態（Production 排查）、可控 log（localStorage "__LANGAPP_AUTH_DEBUG__"）
 * - （保留舊的異動紀錄：原本無）
 */

// ❗不要在這裡 createClient
// ❗統一使用 src/supabaseClient.js 的唯一實例

/**
 * 功能說明（Production 排查）：debug 開關
 * - 預設關閉，避免 production 洗版
 * - 需要排查時：在瀏覽器 Console 執行
 *   localStorage.setItem("__LANGAPP_AUTH_DEBUG__", "1"); location.reload();
 */
function shouldAuthLog() {
    try {
      return localStorage.getItem("__LANGAPP_AUTH_DEBUG__") === "1";
    } catch {
      return false;
    }
  }
  
  /**
   * 功能說明（Production 排查）：初始化狀態
   * - 掛在 globalThis 方便 production 直接查看：
   *   globalThis.__LANGAPP_SUPABASE_EXPORT_DIAG__
   */
  function ensureDiag() {
    try {
      if (!globalThis.__LANGAPP_SUPABASE_EXPORT_DIAG__) {
        globalThis.__LANGAPP_SUPABASE_EXPORT_DIAG__ = {
          tag: "LANGAPP_SUPABASE_EXPORT_DIAG",
          createdAt: new Date().toISOString(),
          last: null,
        };
      }
    } catch {
      // ignore
    }
  }
  
  /**
   * 功能說明（Production 排查）：更新初始化狀態（不影響任何既有流程）
   */
  function setDiag(patch) {
    try {
      ensureDiag();
      globalThis.__LANGAPP_SUPABASE_EXPORT_DIAG__ = {
        ...globalThis.__LANGAPP_SUPABASE_EXPORT_DIAG__,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      // ignore
    }
  }
  
  /**
   * 功能說明（Production 排查）：單次 log（避免每次 import 都刷 log）
   */
  function logOnce(key, payload) {
    try {
      if (!shouldAuthLog()) return;
      if (!globalThis.__LANGAPP_SUPABASE_EXPORT_LOG_ONCE__) {
        globalThis.__LANGAPP_SUPABASE_EXPORT_LOG_ONCE__ = {};
      }
      if (globalThis.__LANGAPP_SUPABASE_EXPORT_LOG_ONCE__[key]) return;
      globalThis.__LANGAPP_SUPABASE_EXPORT_LOG_ONCE__[key] = true;
      console.log(`[SupabaseExport][DebugOnce] ${key}`, payload);
    } catch {
      // ignore
    }
  }
  
  // ✅ Production 排查：記錄本檔載入一次（僅觀測，不影響任何既有流程）
  setDiag({
    last: {
      type: "module-loaded",
      href: typeof window !== "undefined" ? window.location.href : "",
    },
  });
  logOnce("module-loaded", {
    href: typeof window !== "undefined" ? window.location.href : "",
    origin: typeof window !== "undefined" ? window.location.origin : "",
  });
  
  export { supabase } from "../supabaseClient";
  // frontend/src/utils/supabaseClient.js
  