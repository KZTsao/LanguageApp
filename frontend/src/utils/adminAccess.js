// START PATH: frontend/src/utils/adminAccess.js
// frontend/src/utils/adminAccess.js

/**
 * Admin access helper (single source of truth)
 * - reads VITE_SUPPORT_ADMIN_EMAILS from Vite env
 * - used by UserHeader / Admin pages
 */

function safeReadAdminEmailsEnv() {
  try {
    const v = import.meta?.env?.VITE_SUPPORT_ADMIN_EMAILS;
    if (typeof v === "string") return v;
  } catch {}
  try {
    const w = typeof window !== "undefined" ? window : null;
    const v2 = w && w.__ENV__ ? w.__ENV__.VITE_SUPPORT_ADMIN_EMAILS : null;
    if (typeof v2 === "string") return v2;
  } catch {}
  return "";
}

function parseEmails(raw) {
  try {
    const s = String(raw || "");
    if (!s.trim()) return [];
    return s
      .split(/[,;\n\r\t\s]+/g)
      .map((x) => String(x || "").trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Get allowlist (lowercased) */
export function getSupportAdminEmailList() {
  return parseEmails(safeReadAdminEmailsEnv());
}

/** Check if email is in allowlist */
export function isSupportAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  const list = getSupportAdminEmailList();
  if (!list.length) return false; // fail-closed
  return list.includes(e);
}

// END PATH: frontend/src/utils/adminAccess.js
