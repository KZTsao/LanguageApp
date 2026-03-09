// backend/src/i18n/index.js
// Centralized backend i18n: normalizeLang + prompt/ui loaders
const path = require("path");
const fs = require("fs");

function normalizeLang(lang) {
  const x0 = String(lang || "").trim();
  if (!x0) return "en";

  // Accept both BCP-47 codes and common UI labels
  const raw = x0.toLowerCase();

  // Common UI labels
  if (raw === "english") return "en";
  if (raw === "german" || raw === "deutsch") return "de";
  if (raw === "arabic" || raw === "العربية") return "ar";
  if (raw === "traditional chinese" || raw === "繁體中文" || raw === "繁体中文" || raw === "中文(繁體)" || raw === "中文（繁體）") return "zh-TW";
  if (raw === "simplified chinese" || raw === "简体中文" || raw === "中文(简体)" || raw === "中文（简体）") return "zh-CN";

  // BCP-47 / locale codes
  if (raw.startsWith("zh-cn")) return "zh-CN";
  if (raw.startsWith("zh")) return "zh-TW";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("ar")) return "ar";

  // default: primary language subtag (e.g. fr-FR -> fr)
  const base = raw.split("-")[0];
  return base || "en";
}

function _readJsonSafe(absPath) {
  try {
    if (!fs.existsSync(absPath)) return null;
    const raw = fs.readFileSync(absPath, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function _get(obj, key) {
  if (!obj || typeof obj !== "object") return "";
  const parts = String(key || "").split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return "";
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : "";
}

// UI text (backend user-facing strings) — optional
function t(key, lang) {
  const l = normalizeLang(lang);
  const baseDir = path.join(__dirname, "ui");
  const p1 = path.join(baseDir, `common.${l}.json`);
  const p2 = path.join(baseDir, "common.en.json");
  const d = _readJsonSafe(p1) || _readJsonSafe(p2) || {};
  return _get(d, key) || "";
}

// Prompt packs
function promptPack(name, lang) {
  const l = normalizeLang(lang);
  const baseDir = path.join(__dirname, "prompts");
  const p1 = path.join(baseDir, `${name}.${l}.json`);
  const p2 = path.join(baseDir, `${name}.en.json`);
  const d = _readJsonSafe(p1) || _readJsonSafe(p2);
  return d || null;
}

module.exports = { normalizeLang, t, promptPack };
