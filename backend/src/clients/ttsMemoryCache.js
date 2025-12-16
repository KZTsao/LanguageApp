// backend/src/clients/ttsMemoryCache.js

const crypto = require("crypto");

// LRU + TTL in-memory cache for TTS
const MAX_ITEMS = 1000;                 // 最多存 1000 句
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

class TtsMemoryCache {
  constructor(maxItems = MAX_ITEMS, ttlMs = TTL_MS) {
    this.maxItems = maxItems;
    this.ttlMs = ttlMs;
    this.map = new Map(); // key -> { audioBase64, createdAt, lastHit }
  }

  // 產生 cache key（供外部使用時也可以直接用）
  static makeKey(text, lang, voiceId) {
    const raw = `${text}|${lang}|${voiceId || ""}`;
    return crypto.createHash("sha1").update(raw).digest("hex");
  }

  _isExpired(entry) {
    if (!entry) return true;
    const now = Date.now();
    return now - entry.createdAt > this.ttlMs;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;

    if (this._isExpired(entry)) {
      // 過期就刪掉
      this.map.delete(key);
      return null;
    }

    // 更新 LRU 的使用時間
    entry.lastHit = Date.now();
    // Map 沒有自動排序，簡單做法：先刪再 set 一次，讓這個 key 排到後面
    this.map.delete(key);
    this.map.set(key, entry);

    return entry.audioBase64;
  }

  set(key, audioBase64) {
    const now = Date.now();

    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxItems) {
      // 刪掉最舊（LRU）的那一個
      const oldestKey = this._findOldestKey();
      if (oldestKey) {
        this.map.delete(oldestKey);
      }
    }

    this.map.set(key, {
      audioBase64,
      createdAt: now,
      lastHit: now,
    });
  }

  _findOldestKey() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.map.entries()) {
      const t = entry.lastHit || entry.createdAt || 0;
      if (t < oldestTime) {
        oldestTime = t;
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}

const ttsMemoryCache = new TtsMemoryCache();

module.exports = {
  ttsMemoryCache,
  makeTtsCacheKey: TtsMemoryCache.makeKey,
};
