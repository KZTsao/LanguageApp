// backend/src/i18n/index.js
const path = require("path");
const fs = require("fs");

function normalizeLang(lang) {
  const x0 = String(lang || "").trim();
  if (!x0) return "en";
  const raw = x0.toLowerCase();

  if (raw === "english") return "en";
  if (raw === "german" || raw === "deutsch") return "de";
  if (raw === "arabic" || raw === "العربية") return "ar";
  if (raw === "traditional chinese" || raw.includes("繁體")) return "zh-TW";
  if (raw === "simplified chinese" || raw.includes("简体")) return "zh-CN";

  if (raw.startsWith("zh-cn")) return "zh-CN";
  if (raw.startsWith("zh")) return "zh-TW";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("ar")) return "ar";

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

function t(key, lang) {
  const l = normalizeLang(lang);
  const baseDir = path.join(__dirname, "ui");
  const p1 = path.join(baseDir, `common.${l}.json`);
  const p2 = path.join(baseDir, "common.en.json");
  const d = _readJsonSafe(p1) || _readJsonSafe(p2) || {};
  return _get(d, key) || "";
}

// 🔧 FIX: 強制 fallback + debug
function promptPack(name, lang) {
  const l = normalizeLang(lang);
  const baseDir = path.join(__dirname, "prompts");
  const p1 = path.join(baseDir, `${name}.${l}.json`);
  const p2 = path.join(baseDir, `${name}.en.json`);

  const d1 = _readJsonSafe(p1);
  const d2 = _readJsonSafe(p2);

  if (!d1 && !d2) {
    console.warn("[i18n] promptPack missing both lang & en", { name, lang: l, p1, p2 });
  }

  return d1 || d2 || {};
}

module.exports = { normalizeLang, t, promptPack };
