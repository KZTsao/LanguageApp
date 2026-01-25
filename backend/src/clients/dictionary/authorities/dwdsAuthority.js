// backend/src/clients/dictionary/authorities/dwdsAuthority.js
/**
 * DWDS authority plugin (placeholder).
 * TODO: implement actual DWDS lookup here.
 */
module.exports = {
  name: 'dwds',
  async lookup(word, explainLang, options = {}) {
    // Parsing work intentionally paused; treat as miss for now.
    if (process.env.DEBUG_DICT_AUTHORITY === '1') {
      // eslint-disable-next-line no-console
      console.log('[dictionary][authority] dwds disabled (treat as miss):', { word, explainLang });
    }
    return null;
  },
};
// backend/src/clients/dictionary/authorities/dwdsAuthority.js
