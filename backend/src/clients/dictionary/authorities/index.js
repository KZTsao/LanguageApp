// backend/src/clients/dictionary/authorities/index.js
/**
 * Authority registry (plugin hub)
 *
 * dictionaryLookup.js will do:
 *   require("./dictionary/authorities")
 * which resolves to this index.js (folder module).
 *
 * Add/Remove providers here without touching dictionaryLookup.js.
 */
module.exports = {
  // Parsing providers (can be enabled via DICT_AUTHORITIES="dwds,wiktionary")
  dwds: require("./dwdsAuthority"),
  wiktionary: require("./wiktionaryAuthority"),

  // Reserved: kept for completeness; authorityLookup() will skip "llm"
  llm: require("./llmAuthority"),
};
// backend/src/clients/dictionary/authorities/index.js
