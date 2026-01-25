// backend/src/clients/dictionary/authorities/llmAuthority.js
/**
 * LLM authority plugin (Groq).
 * Current main pipeline in dictionaryLookup.js already handles LLM fallback.
 * This plugin is provided to keep the architecture plugin-ready.
 *
 * If you later want DICT_AUTHORITIES to fully drive all sources (dwds -> llm),
 * you can refactor lookupWord() to call this plugin as the last step.
 */
module.exports = {
  name: 'llm',
  async lookup() {
    // Not used by authorityLookup (llm is ignored there).
    return null;
  },
};
// backend/src/clients/dictionary/authorities/llmAuthority.js
