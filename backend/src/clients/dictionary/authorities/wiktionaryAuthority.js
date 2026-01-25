// backend/src/clients/dictionary/authorities/wiktionaryAuthority.js
/**
 * Wiktionary authority plugin (paused/disabled).
 * Reason: parsing is unstable; we isolate it here and keep it OFF by default.
 */
module.exports = {
  name: 'wiktionary',
  async lookup(word, explainLang, options = {}) {
    if (process.env.DEBUG_DICT_AUTHORITY === '1') {
      // eslint-disable-next-line no-console
      console.log('[dictionary][authority] wiktionary paused (treat as miss):', { word, explainLang });
    }
    return null;
  },
};
// backend/src/clients/dictionary/authorities/wiktionaryAuthority.js
