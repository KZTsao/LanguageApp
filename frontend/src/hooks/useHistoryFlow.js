// frontend/src/hooks/useHistoryFlow.js
/**
 * useHistoryFlow
 * - 目的：把 App.jsx 內「查詢歷史（history）」相關邏輯抽離，縮小 App.jsx 體積與心智負擔
 * - 原則：只搬移（extract），不改行為、不改資料結構、不改 UI
 *
 * 內容包含：
 * 1) 初始化/寫回 localStorage（HISTORY_KEY + HISTORY_LIMIT）
 * 2) 回放 history item（applyHistoryItemToUI）
 * 3) 命中歷史（findHistoryHitIndex / replayHistoryHit）
 * 4) 歷史導覽（Prev/Next）與清除當下回放（clearCurrentHistoryItem）
 *
 * 注意：
 * - 2026-01-05 規格：歷史導覽只回放 resultSnapshot，不回寫輸入框（syncInput:false）
 */

import { useEffect, useMemo, useState } from "react";

export function useHistoryFlow({
  HISTORY_KEY,
  HISTORY_LIMIT = 30,
  isSearchDebugEnabled = false,
  setText,
  setResult,
}) {
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ✅ 取得下一個 index（避免超界）
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  // ✅ 初始化查詢歷史（分桶）
  useEffect(() => {
    try {
      const scoped = window.localStorage.getItem(HISTORY_KEY);
      if (scoped) {
        const parsed = JSON.parse(scoped);
        if (Array.isArray(parsed)) {
          const next = parsed.slice(0, HISTORY_LIMIT);
          setHistory(next);

          // ✅ Production 排查：記錄 snapshot 覆蓋率（不影響任何業務邏輯）
          const withSnapshot = next.filter((x) => !!x?.resultSnapshot).length;
          const count = next.length;
          const snapshotCoverage = count > 0 ? withSnapshot / count : 0;
          if (isSearchDebugEnabled) {
            // eslint-disable-next-line no-console
            console.log("[HISTORY][init] count=", count, "snapshotCoverage=", snapshotCoverage);
          }
        }
      } else {
        if (isSearchDebugEnabled) {
          // eslint-disable-next-line no-console
          console.log("[HISTORY][init] empty");
        }
      }
    } catch (e) {
      if (isSearchDebugEnabled) {
        // eslint-disable-next-line no-console
        console.log("[HISTORY][init] parse error");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [HISTORY_KEY]);

  // ✅ 寫回查詢歷史（只寫 scoped key）
  useEffect(() => {
    try {
      window.localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(Array.isArray(history) ? history.slice(0, HISTORY_LIMIT) : [])
      );

      // ✅ Production 排查：寫回時同步更新 snapshot 覆蓋率（不影響任何業務邏輯）
      const sliced = Array.isArray(history) ? history.slice(0, HISTORY_LIMIT) : [];
      const withSnapshot = sliced.filter((x) => !!x?.resultSnapshot).length;
      const count = sliced.length;
      const snapshotCoverage = count > 0 ? withSnapshot / count : 0;
      if (isSearchDebugEnabled) {
        // eslint-disable-next-line no-console
        console.log("[HISTORY][save] count=", count, "snapshotCoverage=", snapshotCoverage);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, HISTORY_KEY]);

  /**
   * 功能：從 history item 回放結果（不重新訪問）
   * - 若該筆缺少 resultSnapshot（舊資料），則清空 result（避免顯示上一筆結果造成誤會）
   * - 注意：此函式只做 UI 狀態同步，不做任何 network 行為
   */
  const applyHistoryItemToUI = (item, options = {}) => {
    if (!item) return;

    const syncInput =
      typeof options?.syncInput === "boolean" ? options.syncInput : true;

    // 1) 同步輸入框（預設 true；歷史導覽時會傳 false）
    if (syncInput && typeof setText === "function") {
      if (typeof item?.text === "string") {
        setText(item.text);
      }
    }

    // 2) 同步字卡結果（真正翻頁的關鍵）
    if (item?.resultSnapshot) {
      if (typeof setResult === "function") setResult(item.resultSnapshot);
    } else {
      if (typeof setResult === "function") setResult(null);
    }

    if (isSearchDebugEnabled) {
      // eslint-disable-next-line no-console
      console.log("[HISTORY][apply] source=", options?.source || "unknown");
    }
  };

  /**
   * 用於「比對」命中歷史：只做小寫與 trim，不動中間字元
   * - 注意：這裡的 normalize 僅用於「比對」，不影響任何上游 UI 狀態
   */
  const normalizeForHistoryCompare = (v) => {
    const s = typeof v === "string" ? v : "";
    return s.trim().toLowerCase();
  };

  const findHistoryHitIndex = (q) => {
    const query = normalizeForHistoryCompare(q);
    if (!query) return -1;
    if (!Array.isArray(history) || history.length === 0) return -1;

    for (let i = 0; i < history.length; i += 1) {
      const item = history[i];
      const a = normalizeForHistoryCompare(item?.text);
      const b = normalizeForHistoryCompare(item?.headword);
      if (a && a === query) return i;
      if (b && b === query) return i;
    }
    return -1;
  };

  const replayHistoryHit = (hitIndex, q, source = "history-hit") => {
    if (!Array.isArray(history) || history.length === 0) return false;
    if (hitIndex < 0 || hitIndex >= history.length) return false;

    const hitItem = history[hitIndex];

    // 命中歷史：允許同步輸入框
    applyHistoryItemToUI(hitItem, { syncInput: true, source });

    // 把命中那筆移到最前面（視為最新）
    setHistory((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const cur = prev[hitIndex];
      const rest = prev.filter((_, i) => i !== hitIndex);
      return [cur, ...rest].slice(0, HISTORY_LIMIT);
    });

    setHistoryIndex(-1);

    if (isSearchDebugEnabled) {
      // eslint-disable-next-line no-console
      console.log("[HISTORY][hit] q=", q, "hitIndex=", hitIndex);
    }

    return true;
  };

  // ✅ 歷史上一頁/下一頁
  const goPrevHistory = () => {
    if (!history.length) return;
    const nextIndex = clamp(historyIndex + 1, 0, history.length - 1);
    setHistoryIndex(nextIndex);
    const item = history[nextIndex];
    applyHistoryItemToUI(item, { syncInput: false, source: "history-nav-prev" });
  };

  const goNextHistory = () => {
    if (!history.length) return;
    const nextIndex = clamp(historyIndex - 1, -1, history.length - 1);
    setHistoryIndex(nextIndex);
    if (nextIndex === -1) return;
    const item = history[nextIndex];
    applyHistoryItemToUI(item, { syncInput: false, source: "history-nav-next" });
  };

  const canPrevHistory = useMemo(
    () => history.length > 0 && historyIndex < history.length - 1,
    [history.length, historyIndex]
  );
  const canNextHistory = useMemo(
    () => history.length > 0 && historyIndex > -1,
    [history.length, historyIndex]
  );

  const clearCurrentHistoryItem = () => {
    if (!Array.isArray(history) || history.length === 0) return;
    if (historyIndex < 0) return;
    if (historyIndex >= history.length) return;

    setHistory((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      const idx = historyIndex;
      if (idx < 0 || idx >= prev.length) return prev;

      const next = prev.filter((_, i) => i !== idx);

      if (next.length === 0) {
        setHistoryIndex(-1);
        if (typeof setResult === "function") setResult(null);
      } else {
        const newIndex = clamp(idx, 0, next.length - 1);
        setHistoryIndex(newIndex);
        const item = next[newIndex];
        applyHistoryItemToUI(item, { syncInput: false, source: "history-clear" });
      }

      return next.slice(0, HISTORY_LIMIT);
    });
  };

  return {
    history,
    setHistory,
    historyIndex,
    setHistoryIndex,

    findHistoryHitIndex,
    replayHistoryHit,
    applyHistoryItemToUI,

    canPrevHistory,
    canNextHistory,
    goPrevHistory,
    goNextHistory,

    clearCurrentHistoryItem,
  };
}
