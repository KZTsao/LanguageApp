// frontend/src/utils/wordCardRender.js
// 放「與畫面無關」但會被 WordCard 使用的文字處理工具
// 不含 JSX，純邏輯，方便之後做單元測試或重用

/**
 * 將 definition（可能是字串或陣列）正規化成「陣列」：
 * - "" / null / undefined → []
 * - "城堡；鎖" → ["城堡", "鎖"]
 * - ["城堡", "鎖"] → ["城堡", "鎖"]（去頭尾空白，移除空字串）
 */
export function normalizeDefinitionList(definition) {
  if (!definition) return [];

  // 已經是陣列
  if (Array.isArray(definition)) {
    return definition
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((s) => s.length > 0);
  }

  // 是單一字串
  if (typeof definition === "string") {
    const raw = definition.trim();
    if (!raw) return [];

    // 以常見分隔符號切分：； ; ／ / 、 等
    const parts = raw
      .split(/[；;／/、]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // 如果切完沒有東西，就當作一個條目
    return parts.length > 0 ? parts : [raw];
  }

  return [];
}

/**
 * 將 definition_de 正規化成陣列
 * - 允許字串或陣列
 * - 會去頭尾空白 + 移除空字串
 */
export function normalizeDefinitionDe(definitionDe) {
  if (!definitionDe) return [];

  if (Array.isArray(definitionDe)) {
    return definitionDe
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((s) => s.length > 0);
  }

  if (typeof definitionDe === "string") {
    const raw = definitionDe.trim();
    if (!raw) return [];
    return [raw];
  }

  return [];
}

/**
 * 將 definition_de_translation 正規化成陣列
 * - 允許字串或陣列
 * - 會去頭尾空白 + 移除空字串
 */
export function normalizeDefinitionDeTranslation(definitionDeTranslation) {
  if (!definitionDeTranslation) return [];

  if (Array.isArray(definitionDeTranslation)) {
    return definitionDeTranslation
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((s) => s.length > 0);
  }

  if (typeof definitionDeTranslation === "string") {
    const raw = definitionDeTranslation.trim();
    if (!raw) return [];
    return [raw];
  }

  return [];
}

/**
 * 將一段德文拆成 token（保留空白與標點）：
 * - "Die Hunde, die…" → ["Die", " ", "Hunde", ",", " ", "die", "…"]
 * WordCard 可以依據這個結果去渲染：
 * - 如果是德文字（含 ÄÖÜäöüß），可以做點擊查詢
 * - 其他直接原樣顯示
 */
export function splitTextTokens(text) {
  if (!text) return [];

  // 保留空白與標點作為分隔 token
  return String(text).split(/(\s+|[.,!?;:"()«»„“”])/);
}

/**
 * 判斷一個 token 是否「看起來像德文字」（含德文字母）
 * - 用於 WordCard 決定哪些 token 需要加上 onClick / cursor pointer
 */
export function isLikelyGermanWord(token) {
  if (!token) return false;
  const s = String(token);
  // 至少一個 a-z / A-Z / 德文變音字母 / ß
  return /[A-Za-zÄÖÜäöüß]/.test(s);
}
