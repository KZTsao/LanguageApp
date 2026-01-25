// frontend/src/app/favoritesSnapshotStorage.js
// Favorites Snapshot localStorage manager (LRU, LIMIT = 30)
// 僅負責 snapshot 內容，不含任何 UI / index / navContext 狀態

const FAVORITES_SNAPSHOT_KEY = "favorites_snapshots_v1";
const FAVORITE_LIMIT = 30;

/**
 * 讀取所有 snapshots
 * @returns {Array<{refKey: string, resultSnapshot: object, updatedAt: string}>}
 */
export function loadFavoritesSnapshots() {
  try {
    const raw = localStorage.getItem(FAVORITES_SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    // 任何錯誤都吞掉，避免影響主流程
    return [];
  }
}

/**
 * 依 refKey 查找 snapshot
 * @param {string} refKey
 * @returns {object | null}
 */
export function findFavoritesSnapshot(refKey) {
  if (!refKey) return null;
  const list = loadFavoritesSnapshots();
  const found = list.find((item) => item.refKey === refKey);
  return found ? found.resultSnapshot : null;
}

/**
 * upsert snapshot（LRU）
 * - 已存在：覆寫 snapshot、更新時間、移至最前
 * - 不存在：插入最前
 * - 超過上限：裁掉最舊
 *
 * @param {string} refKey
 * @param {object} resultSnapshot
 */
export function upsertFavoritesSnapshot(refKey, resultSnapshot) {
  if (!refKey || !resultSnapshot) return;

  try {
    const list = loadFavoritesSnapshots();
    const now = new Date().toISOString();

    const next = [
      {
        refKey,
        resultSnapshot,
        updatedAt: now,
      },
      ...list.filter((item) => item.refKey !== refKey),
    ];

    const trimmed =
      next.length > FAVORITE_LIMIT
        ? next.slice(0, FAVORITE_LIMIT)
        : next;

    localStorage.setItem(
      FAVORITES_SNAPSHOT_KEY,
      JSON.stringify(trimmed)
    );
  } catch (err) {
    // 嚴禁 throw，避免中斷 UI
  }
}

/**
 * （除錯用）清空 snapshot
 */
export function clearFavoritesSnapshots() {
  try {
    localStorage.removeItem(FAVORITES_SNAPSHOT_KEY);
  } catch (err) {
    // ignore
  }
}
