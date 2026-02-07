const logger = {
  info: (...args) => {
    try { console.log("[INFO]", ...args); } catch (e) {}
  },
  warn: (...args) => {
    try { console.warn("[WARN]", ...args); } catch (e) {}
  },
  error: (...args) => {
    try { console.error("[ERROR]", ...args); } catch (e) {}
  },
};

module.exports = { logger };
