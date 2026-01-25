// frontend/src/app/snapshotStore.js
/**
 * SnapshotStore
 * - 單一 Snapshot Store（Single Source of Truth）
 * - memory: Map(refKey -> { snapshot, updatedAt })
 * - optional localStorage LRU
 *
 * 本檔只提供基礎設施，不主動影響任何現有流程
 */

const STORAGE_KEY = "snapshot_store_v1";
const DEFAULT_LRU_LIMIT = 30;

// =========================
// In-memory store
// =========================
const snapshotStoreRef = {
  current: new Map(), // refKey -> { snapshot, updatedAt }
};

// =========================
// LRU helpers (localStorage)
// =========================
function loadPersisted() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePersisted(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// =========================
// Public API
// =========================

/**
 * getSnapshot
 * - 先查 memory
 * - 再查 localStorage（命中則回填 memory）
 */
export function getSnapshot(refKey) {
  if (!refKey) return null;

  const mem = snapshotStoreRef.current.get(refKey);
  if (mem && mem.snapshot) return mem.snapshot;

  const persisted = loadPersisted();
  const hit = persisted.find((x) => x.refKey === refKey);
  if (hit && hit.snapshot) {
    snapshotStoreRef.current.set(refKey, {
      snapshot: hit.snapshot,
      updatedAt: hit.updatedAt || Date.now(),
    });
    return hit.snapshot;
  }

  return null;
}

/**
 * upsertSnapshot
 * - 寫入 memory
 * - 同步寫入 localStorage（LRU）
 */
export function upsertSnapshot(refKey, snapshot, opts = {}) {
  if (!refKey || !snapshot) return;

  const now = Date.now();

  // memory
  snapshotStoreRef.current.set(refKey, {
    snapshot,
    updatedAt: now,
  });

  // localStorage (LRU)
  const persisted = loadPersisted().filter((x) => x.refKey !== refKey);
  persisted.unshift({
    refKey,
    snapshot,
    updatedAt: now,
    source: opts.source || "unknown",
  });

  savePersisted(persisted.slice(0, DEFAULT_LRU_LIMIT));
}

/**
 * upsertIfImproved
 * - 僅在 snapshot「變得更完整」時才寫入
 * - Task 4C-0：目前只判斷 examples / exampleTranslation
 */

// ⚠️ DEPRECATED (kept for backward reference):
// 早期版本的 capture-on-improve 實作，已由下方「Task 4C-0」完整版本取代。
// 為避免 Identifier redeclare（ESM），此函式改名保留，不再被 App.jsx 正式使用。

export function upsertIfImprovedLegacy(
  refKey,
  prevSnapshot,
  nextSnapshot,
  opts = {}
) {
  if (!refKey || !nextSnapshot) return;

  const prevDict = prevSnapshot?.dictionary || {};
  const nextDict = nextSnapshot?.dictionary || {};

  let improved = false;

  // 1️⃣ examples：從無到有，或數量增加
  const prevExamples = Array.isArray(prevDict.examples)
    ? prevDict.examples.length
    : 0;
  const nextExamples = Array.isArray(nextDict.examples)
    ? nextDict.examples.length
    : 0;

  if (nextExamples > prevExamples) {
    improved = true;
  }

  // 2️⃣ exampleTranslation：從無到有 / 變成非空字串
  const prevTrans =
    typeof prevDict.exampleTranslation === "string"
      ? prevDict.exampleTranslation.trim()
      : "";
  const nextTrans =
    typeof nextDict.exampleTranslation === "string"
      ? nextDict.exampleTranslation.trim()
      : "";

  if (!prevTrans && nextTrans) {
    improved = true;
  }

  if (!improved) return;

  upsertSnapshot(refKey, nextSnapshot, {
    source: opts.source || "improved",
  });
}

/**
 * touch
 * - 只更新 LRU 順序，不改 snapshot
 */
/**
 * ✅ Task 4C-0 — Snapshot 更新一致化（capture-on-improve）
 * 中文功能說明：
 * - 只要 nextSnap 的 dictionary 內容「更完整」，才回寫 SnapshotStore
 * - 目前判斷欄位（最小版）：
 *   1) dictionary.examples：從無到有 / 數量增加
 *   2) dictionary.exampleTranslation：從空到有（trim 後非空字串）
 *
 * - 目的：避免「較不完整的結果」覆蓋掉既有更完整的 snapshot
 * - 用法：upsertIfImproved(refKey, prevSnap, nextSnap, { source })
 *   - prevSnap 可傳 null；若不傳會自動 getSnapshot(refKey)
 */
export function upsertIfImproved(refKey, prevSnap, nextSnap, meta) {
  if (!refKey || !nextSnap) return false;

  // 若呼叫方沒提供 prevSnap，這裡才讀一次 store（保持低風險）
  const prev = prevSnap || getSnapshot(refKey) || null;

  const prevDict =
    prev && typeof prev === "object" && prev.dictionary && typeof prev.dictionary === "object"
      ? prev.dictionary
      : null;

  const nextDict =
    nextSnap && typeof nextSnap === "object" && nextSnap.dictionary && typeof nextSnap.dictionary === "object"
      ? nextSnap.dictionary
      : null;

  const prevExamplesLen = (() => {
    if (!prevDict) return 0;
    if (Array.isArray(prevDict.examples)) return prevDict.examples.length;
    if (typeof prevDict.example === "string" && prevDict.example.trim()) return 1;
    return 0;
  })();

  const nextExamplesLen = (() => {
    if (!nextDict) return 0;
    if (Array.isArray(nextDict.examples)) return nextDict.examples.length;
    if (typeof nextDict.example === "string" && nextDict.example.trim()) return 1;
    return 0;
  })();

  const prevTran = (() => {
    if (!prevDict) return "";
    if (typeof prevDict.exampleTranslation === "string") return prevDict.exampleTranslation.trim();
    return "";
  })();

  const nextTran = (() => {
    if (!nextDict) return "";
    if (typeof nextDict.exampleTranslation === "string") return nextDict.exampleTranslation.trim();
    return "";
  })();

  const improved =
    // 例句：從無 → 有、或數量增加
    (prevExamplesLen === 0 && nextExamplesLen > 0) ||
    nextExamplesLen > prevExamplesLen ||
    // 翻譯：從空 → 有
    (!prevTran && !!nextTran);

  if (!improved) return false;

  // ✅ 命中 improved 才 upsert，避免無謂寫入
  upsertSnapshot(refKey, nextSnap, meta);
  return true;
}
export function touch(refKey) {
  if (!refKey) return;

  const persisted = loadPersisted();
  const idx = persisted.findIndex((x) => x.refKey === refKey);
  if (idx === -1) return;

  const item = persisted[idx];
  const next = [
    { ...item, updatedAt: Date.now() },
    ...persisted.filter((_, i) => i !== idx),
  ];

  savePersisted(next.slice(0, DEFAULT_LRU_LIMIT));
}

/**
 * prune
 * - 修剪 localStorage LRU
 */
export function prune(limit = DEFAULT_LRU_LIMIT) {
  const persisted = loadPersisted();
  if (persisted.length <= limit) return;
  savePersisted(persisted.slice(0, limit));
}

/**
 * （可選）debug helper
 */
export function _debugDump() {
  return {
    memorySize: snapshotStoreRef.current.size,
    persisted: loadPersisted(),
  };
}

// END FILE: frontend/src/app/snapshotStore.js
