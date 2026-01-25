// FILE: frontend/src/components/examples/pronReplayStore.js
// ============================================================
// Phase 2.1 — Pronunciation Replay Store (frontend-only)
// - 只保存「最後一次錄音」（key -> { url, blob, createdAt, meta })
// - 覆蓋時會自動 revoke 舊 URL
// - 給 ExampleSentence / WordExampleBlock 之間做「錄音 blob 回傳」的橋接
// ============================================================

const __store = new Map();

/**
 * @param {string} key - 建議格式：`${headword}::${sentence}`
 * @param {Blob} blob
 * @param {object} meta
 * @returns {{ key: string, url: string, blob: Blob, createdAt: number, meta: object } | null}
 */
export function upsertLastPronRecording(key, blob, meta = {}) {
  if (!key || !blob) return null;

  // 只保留最後一次：先清空所有（避免 store 膨脹）
  for (const [k, v] of __store.entries()) {
    try {
      if (v && v.url) URL.revokeObjectURL(v.url);
    } catch (e) {}
    __store.delete(k);
  }

  const url = URL.createObjectURL(blob);
  const rec = {
    key,
    url,
    blob,
    createdAt: Date.now(),
    meta: meta && typeof meta === "object" ? meta : {},
  };
  __store.set(key, rec);
  return rec;
}

/**
 * @param {string} key
 * @returns {{ key: string, url: string, blob: Blob, createdAt: number, meta: object } | null}
 */
export function getLastPronRecording(key) {
  if (!key) return null;
  return __store.get(key) || null;
}

/**
 * 清掉指定 key（或全部）
 * @param {string=} key
 */
export function clearLastPronRecording(key) {
  if (!key) {
    for (const [k, v] of __store.entries()) {
      try {
        if (v && v.url) URL.revokeObjectURL(v.url);
      } catch (e) {}
      __store.delete(k);
    }
    return;
  }
  const v = __store.get(key);
  if (v && v.url) {
    try {
      URL.revokeObjectURL(v.url);
    } catch (e) {}
  }
  __store.delete(key);
}

// END FILE: frontend/src/components/examples/pronReplayStore.js
