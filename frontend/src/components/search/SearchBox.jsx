// frontend/src/components/search/SearchBox.jsx
/**
 * ------------------------------------------------------------
 * SearchBox.jsx
 * ------------------------------------------------------------
 * 文件說明：
 * - 本元件負責：搜尋框輸入 + 觸發查詢（Analyze）
 *
 * 本次需求：
 * - 在送到後端（onAnalyze）之前，先對輸入做前處理
 *   1) trim
 *   2) 移除結尾多餘特殊符號（例如 sehr. 的 .）
 *
 * ✅ 重要：先退回穩定版策略
 * - 不做「監聽 text 自動查詢」（避免 history / 外部 setText 造成反覆分析）
 * - 只在使用者手動觸發（Enter / Button）時才 normalize + 查詢
 *
 * 本次修正重點（避免「查詢不斷觸發」）：
 * - Auto analyze 僅以 text 變動為主，避免把 onAnalyze/onTextChange 放進 useEffect deps
 * - 使用 refs 保存最新 callback，避免 parent re-render 造成 effect 反覆重跑
 * - 加入 loading guard + lastAutoAnalyzedTextRef + cooldown，避免 loop
 *
 * ✅ 2026/01/05（Phase X）新增：同字命中歷史時「仍可按/仍可 Enter」
 * - SearchBox 不再 early-return 阻擋 onAnalyze（避免體感被鎖住）
 * - 命中歷史的「不打 API / 切換到歷史結果」交由 App.jsx 的 handleAnalyze 決定（它才有 history state）
 * - SearchBox 只負責：normalize + 觸發 onAnalyze（事件一定要送出去）
 *
 * 開發規範：
 * - 異動日期與異動說明：見下方異動紀錄
 * - 保留舊異動紀錄：若未來新增，請往下加，不要刪
 * - 功能初始化狀態（Production 排查）
 *
 * 異動紀錄（請保留舊紀錄，新增往下加）：
 * - 2026/01/05：新增「送後端前 normalize（移除結尾多餘標點）」
 * - 2026/01/05：新增「外部點選文字時：normalize 後自動觸發 analyze 一次到位」
 * - 2026/01/05：修正「避免 auto analyze loop：ref callbacks + loading guard + cooldown」
 * - 2026/01/05：退回穩定行為：關閉 auto analyze（避免 history / 外部 setText 造成全部重查）
 * - 2026/01/05：新增「手動查詢：同一字/命中歷史不再重訪 API」
 * - 2026/01/05：修正「同字命中歷史仍可按/Enter：SearchBox 不阻擋 onAnalyze，交由 App.jsx 決策」
 * ------------------------------------------------------------
 */

import React, { useEffect, useRef } from "react";
import ExamIcon from "../icons/ExamIcon";

// ============================================================
// Task 1（UI）：全域模式切換按鈕（Search / Learning）
// - 需求：兩個按鈕風格一致；亮版線條白；背景同主色調
// - 注意：SearchBox 本身不改 mode，只呼叫 onEnterSearch/onEnterLearning
// - 2026/01/13：新增（MVP）
// ============================================================

const MODE_BTN_SIZE = 34; // 兩顆按鈕一致大小
const MODE_ICON_SIZE = 19; // 兩個 icon 一致大小（視覺略放大） // 兩個 icon 一致大小

function SearchModeIcon({ size = MODE_ICON_SIZE, ariaLabel = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={ariaLabel || undefined}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20L16.6 16.6" />
    </svg>
  );
}

function LearningModeIcon({ size = MODE_ICON_SIZE, ariaLabel = "" }) {
  // ✅ 依使用者指示：直接參考既有的 ExamIcon（ResultPanel 同款）
  // - 不自行發明新的 SVG
  // - 顏色由外層 button 的 color（currentColor）控制
  return <ExamIcon size={size} color="currentColor" title="" ariaLabel={ariaLabel} />;
  /*
  DEPRECATED (2026/01/13):
  - 原本的 LearningModeIcon（自製 SVG）已停用。
  - 依使用者指示改為直接使用 ExamIcon，確保與 ResultPanel/單字庫入口 icon 同風格。
  - 以下保留舊 SVG 供日後比對（勿刪）。

<svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={ariaLabel || undefined}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20L16.6 16.6" />
    </svg>
*/
}

function SearchBox({
  text,
  onTextChange,
  onAnalyze,
  loading,
  uiLang,
  onUiLangChange,
  uiText,

  // Task 1：全域模式（由 App.jsx 傳入）
  appMode, // "search" | "learning"
  learningContext, // { title, ... }（MVP）
  onEnterSearch,
  onEnterLearning,
  // ✅ 2026/01/13：將 ResultPanel 單字庫入口移到 SearchBox（學習按鈕）
  onOpenLibrary,
}) {
  // ============================================================
  // 功能初始化狀態（Production 排查）
  // ============================================================
  const SEARCHBOX_RUNTIME_STATE = {
    version: "2026-01-05",
    debugFlag: "__LANGAPP_DEBUG__",
    feature: {
      normalizeBeforeAnalyze: true,

      // ✅ 退回穩定版：先關掉「監聽 text 自動查詢」
      // （避免 history / 外部 setText 造成反覆分析或全部重查）
      externalClickAutoAnalyze: false,

      removeTrailingPunctuation: true,
      preventAutoAnalyzeLoop: true,
      cooldownMs: 600,

      // ✅ Phase X：允許同字/命中歷史時仍觸發 onAnalyze（交由 App.jsx 決策）
      allowTriggerAnalyzeEvenIfHistoryHit: true,
      allowTriggerAnalyzeEvenIfSameAsLast: true,
    },
  };

  // ============================================================
  // Debug 控制：Production 預設不噴 log，只有手動開旗標才顯示
  // window.__LANGAPP_DEBUG__ = true
  // ============================================================
  const SEARCHBOX_DEBUG =
    typeof window !== "undefined" && window.__LANGAPP_DEBUG__ === true;

  const debugLog = (...args) => {
    if (!SEARCHBOX_DEBUG) return;
    // eslint-disable-next-line no-console
    console.log("[SearchBox]", ...args);
  };

  // ============================================================
  // refs：避免 useEffect 因 callback identity 變動而反覆觸發
  // ============================================================
  const onAnalyzeRef = useRef(onAnalyze);
  const onTextChangeRef = useRef(onTextChange);

  useEffect(() => {
    onAnalyzeRef.current = onAnalyze;
  }, [onAnalyze]);

  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  }, [onTextChange]);

  // ============================================================
  // refs：auto analyze 防 loop（目前 externalClickAutoAnalyze=false，這段不會觸發自動查）
  // ============================================================
  const isFirstMountRef = useRef(true);
  const internalUpdateRef = useRef(false); // SearchBox 自己造成的 text 更新
  const pendingAutoAnalyzeRef = useRef(null); // 等 text 更新完成後要自動查的 cleaned text
  const lastAutoAnalyzedTextRef = useRef(null); // 避免同一字重複觸發
  const lastAutoAnalyzeAtRef = useRef(0); // cooldown
  const autoAnalyzeTimerRef = useRef(null);

  // ============================================================
  // refs：手動查詢（Enter / Button）避免同一字重複訪問 API
  // - 先做到「同一個 cleanedText 不要重複打 onAnalyze」
  // - 若 localStorage 的歷史紀錄中已存在該 headword，也先跳過 onAnalyze（避免重查）
  // ============================================================
  const lastManualAnalyzedTextRef = useRef(null);

  // 安全展開 uiText，避免 undefined
  const safeText = uiText || {};

  const placeholder =
    safeText.placeholder ||
    "Gib ein Wort oder einen Satz ein / 請輸入單字 oder 句子";

  // 統一處理「查詢」按鈕多國語系
  const getDefaultAnalyzeLabel = (lang) => {
    switch (lang) {
      case "zh-TW":
        return "查詢";
      case "de":
        return "Nachschlagen";
      case "en":
        return "Search";
      case "ja":
        return "検索";
      case "es":
        return "Buscar";
      default:
        return "Search";
    }
  };

  const analyzeLabel =
    // 先吃你在 uiText 給的字串
    safeText.analyzeButtonLabel ||
    safeText.searchButtonLabel ||
    safeText.buttonLabel ||
    // 再用 uiLang 當 fallback
    getDefaultAnalyzeLabel(uiLang);

  const inputLabel = safeText.inputLabel || "";

  // ============================================================
  // Task 1（UI）：模式按鈕狀態（高光/灰階）
  // ============================================================
  const resolvedMode = appMode === "learning" ? "learning" : "search";

  const canEnterSearch = typeof onEnterSearch === "function";
  const canEnterLearning = typeof onEnterLearning === "function";

  const modeBtnBaseStyle = {
    width: MODE_BTN_SIZE,
    height: MODE_BTN_SIZE,
    borderRadius: 999,
    border: "1px solid var(--border-subtle)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
    padding: 0,
    cursor: "pointer",
    userSelect: "none",
    flex: "0 0 auto",
  };

  const getModeBtnStyle = (isActive) => {
    // ✅ 規範：兩顆按鈕同一套規則
    // - active：背景 var(--accent)；icon 線條白（color=#fff）
    // - inactive：背景透明；icon 灰階（color=var(--text-muted)）
    if (isActive) {
      return {
        ...modeBtnBaseStyle,
        background: "var(--accent)",
        color: "#fff",
        boxShadow: "rgba(0,0,0,0.10) 0px 6px 16px",
      };
    }
    return {
      ...modeBtnBaseStyle,
      background: "var(--accent)",
      color: "#fff",
    };
  };

  const learningTitle =
    learningContext && typeof learningContext.title === "string"
      ? learningContext.title
      : "";
  // 目前下方不要再顯示 UI Language，只保留這個值，不用
  const langLabel = safeText.langLabel || "UI Language";

  // ============================================================
  // 送後端前的輸入前處理（最小規則版本）
  // - trim 頭尾空白
  // - 移除「結尾」多餘標點符號（例如 sehr. / gut!!! / Haus,）
  // ============================================================
  function normalizeSearchText(raw) {
    if (raw === null || raw === undefined) return "";
    const trimmed = String(raw).trim();

    // 只移除「結尾」的常見標點，避免破壞中間符號（例如 E-Mail / nicht-so）
    const cleaned = trimmed.replace(/[.,!?;:…]+$/g, "");

    return cleaned;
  }

  // ============================================================
  // 歷史命中判斷（localStorage）
  // - 目前歷史紀錄是存在 localStorage（你先前提到的狀態）
  // - 這裡先做到：若命中歷史，就不再打 onAnalyze（避免重查）
  // - 不依賴單一 key（避免你之後調整 key 名稱就壞掉）
  // ============================================================
  function isHeadwordInLocalStorageHistory(headword) {
    try {
      if (typeof window === "undefined") return false;
      if (!headword) return false;

      const target = String(headword).trim();
      if (!target) return false;

      const candidateKeys = [
        "history",
        "searchHistory",
        "lookupHistory",
        "wordHistory",
        "LANGAPP_HISTORY",
        "LANGUAGEAPP_HISTORY",
        "__LANGAPP_HISTORY__",
      ];

      const matchInParsed = (parsed) => {
        if (!parsed) return false;

        // 常見：[{ headword: "...", ... }, ...]
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (!item) continue;
            if (typeof item === "string") {
              if (item.trim() === target) return true;
              continue;
            }
            if (typeof item === "object") {
              const hw =
                item.headword ||
                item.word ||
                item.query ||
                item.text ||
                item.key ||
                item.value;
              if (hw && String(hw).trim() === target) return true;
            }
          }
          return false;
        }

        // 常見：{ [headword]: {...} }
        if (typeof parsed === "object") {
          if (Object.prototype.hasOwnProperty.call(parsed, target)) return true;

          // 或：{ items: [...] }
          if (Array.isArray(parsed.items)) {
            return matchInParsed(parsed.items);
          }
        }

        return false;
      };

      // 1) 先試候選 key（效能最好）
      for (const k of candidateKeys) {
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (matchInParsed(parsed)) return true;
        } catch (e) {
          // 不是 JSON：當作純字串比對
          if (String(raw).trim() === target) return true;
        }
      }

      // 2) 保守掃描所有 localStorage key（只比對 JSON 基本形狀）
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k) continue;

        const raw = window.localStorage.getItem(k);
        if (!raw) continue;

        // 快速過濾：太短的不太可能是 history（但仍保守）
        if (raw.length < 2) continue;

        try {
          const parsed = JSON.parse(raw);
          if (matchInParsed(parsed)) return true;
        } catch (e) {
          // ignore
        }
      }

      return false;
    } catch (err) {
      return false;
    }
  }

  // ============================================================
  // Auto analyze（目前已關閉）
  // ============================================================
  useEffect(() => {
    if (!SEARCHBOX_RUNTIME_STATE.feature.externalClickAutoAnalyze) {
      debugLog("autoAnalyze disabled (stable mode)", {
        runtime: SEARCHBOX_RUNTIME_STATE,
      });
      return;
    }

    // 首次 mount 不自動查，避免一開頁就打 API
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      debugLog("mount", { text, runtime: SEARCHBOX_RUNTIME_STATE });
      return;
    }

    // loading 時，不要再排新的 auto analyze（避免連續觸發）
    if (loading) {
      debugLog("skip autoAnalyze because loading=true", {
        text,
        runtime: SEARCHBOX_RUNTIME_STATE,
      });
      return;
    }

    const originalText = text;
    const cleanedText = normalizeSearchText(originalText);

    // 1) 若是 SearchBox 自己 set 的 text（例如 normalize 的結果），這一輪先吃掉旗標
    if (internalUpdateRef.current) {
      internalUpdateRef.current = false;

      // 若這次正好達成 pendingAutoAnalyzeRef（text 已更新成 cleaned），才觸發一次
      if (
        pendingAutoAnalyzeRef.current &&
        text === pendingAutoAnalyzeRef.current
      ) {
        const now = Date.now();
        const isSameText = lastAutoAnalyzedTextRef.current === text;
        const inCooldown =
          now - lastAutoAnalyzeAtRef.current <
          SEARCHBOX_RUNTIME_STATE.feature.cooldownMs;

        debugLog("internal update arrived", {
          text,
          pending: pendingAutoAnalyzeRef.current,
          isSameText,
          inCooldown,
        });

        if (!isSameText && !inCooldown) {
          lastAutoAnalyzedTextRef.current = text;
          lastAutoAnalyzeAtRef.current = now;

          // 清掉舊 timer，避免重複排程
          if (autoAnalyzeTimerRef.current) {
            clearTimeout(autoAnalyzeTimerRef.current);
            autoAnalyzeTimerRef.current = null;
          }

          autoAnalyzeTimerRef.current = setTimeout(() => {
            try {
              debugLog("autoAnalyze(after normalize setText)", {
                text,
                runtime: SEARCHBOX_RUNTIME_STATE,
              });
              onAnalyzeRef.current();
            } catch (err) {
              debugLog("onAnalyze failed", err);
            }
          }, 0);
        }

        pendingAutoAnalyzeRef.current = null;
      }

      return;
    }

    // 2) 走到這裡：視為外部點選/外部 setText
    debugLog("external text change detected", {
      originalText,
      cleanedText,
      runtime: SEARCHBOX_RUNTIME_STATE,
    });

    // 2-1) 需要 normalize：先更新輸入框，並標記下一輪要 auto analyze
    if (cleanedText !== originalText) {
      pendingAutoAnalyzeRef.current = cleanedText;
      internalUpdateRef.current = true;

      try {
        onTextChangeRef.current(cleanedText);
      } catch (err) {
        debugLog("onTextChange failed", err);
      }
      return;
    }

    // 2-2) 已乾淨：直接 auto analyze 一次（但要防重複/冷卻）
    {
      const now = Date.now();
      const isSameText = lastAutoAnalyzedTextRef.current === cleanedText;
      const inCooldown =
        now - lastAutoAnalyzeAtRef.current <
        SEARCHBOX_RUNTIME_STATE.feature.cooldownMs;

      debugLog("autoAnalyze check(external clean text)", {
        cleanedText,
        isSameText,
        inCooldown,
      });

      if (cleanedText && !isSameText && !inCooldown) {
        lastAutoAnalyzedTextRef.current = cleanedText;
        lastAutoAnalyzeAtRef.current = now;

        if (autoAnalyzeTimerRef.current) {
          clearTimeout(autoAnalyzeTimerRef.current);
          autoAnalyzeTimerRef.current = null;
        }

        autoAnalyzeTimerRef.current = setTimeout(() => {
          try {
            debugLog("autoAnalyze(external clean text)", {
              text: cleanedText,
              runtime: SEARCHBOX_RUNTIME_STATE,
            });
            onAnalyzeRef.current();
          } catch (err) {
            debugLog("onAnalyze failed", err);
          }
        }, 0);
      }
    }
  }, [text, loading]);

  // ============================================================
  // 手動查詢：Enter / Button
  // - ✅ 只在這裡做 normalize + 查詢（穩定行為）
  // - ✅ Phase X：即使命中歷史/同字，也要允許觸發 onAnalyze（讓 App.jsx 切換到歷史結果）
  // ============================================================
  const triggerAnalyzeWithPreprocess = (source) => {
    const originalText = text;
    const cleanedText = normalizeSearchText(originalText);

    debugLog("triggerAnalyzeWithPreprocess", {
      source,
      originalText,
      cleanedText,
      runtime: SEARCHBOX_RUNTIME_STATE,
    });

    // loading 時，手動也不做第二次（避免重複 API）
    if (loading) {
      debugLog("skip manual analyze because loading=true", {
        source,
        runtime: SEARCHBOX_RUNTIME_STATE,
      });
      return;
    }

    // 空字串不查
    if (!cleanedText) {
      debugLog("skip manual analyze because cleanedText is empty", {
        source,
        originalText,
        runtime: SEARCHBOX_RUNTIME_STATE,
      });
      return;
    }

    // ✅ Phase X：記錄是否命中 localStorage history（只用來 debug/觀察）
    const hitLocalHistory = isHeadwordInLocalStorageHistory(cleanedText);
    if (hitLocalHistory) {
      debugLog("manual analyze detected localStorage history hit (do NOT block)", {
        source,
        cleanedText,
        runtime: SEARCHBOX_RUNTIME_STATE,
      });
    }

    // 1) 同一字（同一 cleanedText）不重複打 API
    // ⚠️ Root cause：以前這裡會 return → 造成「按了/Enter 沒反應」。
    // ✅ Phase X：不在 SearchBox 阻擋，改為仍觸發 onAnalyze，交由 App.jsx 決策（命中 history 則回放，不打 API）。
    if (lastManualAnalyzedTextRef.current === cleanedText) {
      debugLog(
        "same as lastManualAnalyzedTextRef (do NOT block in SearchBox)",
        {
          source,
          cleanedText,
          runtime: SEARCHBOX_RUNTIME_STATE,
        }
      );

      // DEPRECATED (2026-01-05): 不再 return 阻擋
      // return;
    }

    // 2) 若 localStorage 歷史已存在這個 headword，就先不要再訪問 API
    // ⚠️ Root cause：以前這裡會 return → 造成「按了/Enter 沒反應」。
    // ✅ Phase X：不在 SearchBox return，仍要送出 onAnalyze 事件，讓 App.jsx 去切換到 history（並且不打 API）。
    if (hitLocalHistory) {
      // DEPRECATED (2026-01-05): 不再用 SearchBox early-return 阻擋 onAnalyze
      // lastManualAnalyzedTextRef.current = cleanedText;
      // return;

      // 仍更新 ref（純記錄，不阻擋）
      lastManualAnalyzedTextRef.current = cleanedText;

      // 若當下 input 還沒 normalize（例如 "Haus."），仍把 input 更新成乾淨版本
      if (cleanedText !== originalText) {
        internalUpdateRef.current = true;
        try {
          onTextChangeRef.current(cleanedText);
        } catch (err) {
          debugLog("onTextChange failed", err);
        }
      }

      // ✅ 核心：繼續往下走，確保 onAnalyze 會被呼叫
    }

    if (cleanedText !== originalText) {
      internalUpdateRef.current = true;

      try {
        onTextChangeRef.current(cleanedText);
      } catch (err) {
        debugLog("onTextChange failed", err);
      }

      // ✅ 手動查詢：不靠 auto-analyze，這裡直接觸發一次
      try {
        lastManualAnalyzedTextRef.current = cleanedText;

        debugLog("manual analyze -> onAnalyze (after normalize)", {
          source,
          cleanedText,
          hitLocalHistory,
          runtime: SEARCHBOX_RUNTIME_STATE,
        });

        onAnalyzeRef.current();
      } catch (err) {
        debugLog("onAnalyze failed", err);
      }

      return;
    }

    try {
      lastManualAnalyzedTextRef.current = cleanedText;

      debugLog("manual analyze -> onAnalyze", {
        source,
        cleanedText,
        hitLocalHistory,
        runtime: SEARCHBOX_RUNTIME_STATE,
      });

      onAnalyzeRef.current();
    } catch (err) {
      debugLog("onAnalyze failed", err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      triggerAnalyzeWithPreprocess("enter");
    }
  };

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 12,
        borderRadius: 16,
        border: "1px solid var(--border-subtle)",
        background: "var(--card-bg)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {inputLabel && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {inputLabel}
        </div>
      )}


      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => {
            internalUpdateRef.current = true;
            onTextChangeRef.current(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 999,
            border: "1px solid var(--border-subtle)",
            background: "var(--input-bg)",
            color: "var(--text-main)",
            outline: "none",
          }}
        />

        {/* Task 1：模式切換（Search / Learning） */}
        {(canEnterSearch || canEnterLearning) && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {canEnterSearch && (
              <button
                type="button"
                onClick={() => {
                  // ✅ 2026/01/13：查詢功能改到放大鏡（使用者要求）
                  // - 點放大鏡：先切回 search mode（若有提供 handler）
                  // - 再觸發一次手動查詢（與右側查詢按鈕同邏輯）
                  if (typeof onEnterSearch === "function") onEnterSearch();
                  triggerAnalyzeWithPreprocess("searchIcon");
                }}
                aria-label="Enter search mode"
                title="Search"
                style={getModeBtnStyle(resolvedMode === "search")}
              >
                <SearchModeIcon ariaLabel="Search" />
              </button>
            )}

            {canEnterLearning && (
              <button
                type="button"
                onClick={() => {
                  if (typeof onEnterLearning === "function") {
                    onEnterLearning(learningTitle ? { title: learningTitle } : undefined);
                  }
                  // ✅ 2026/01/13：學習按鈕同時作為「單字庫入口」（從 ResultPanel 搬移）
                  if (typeof onOpenLibrary === "function") {
                    onOpenLibrary();
                  }
                }}
                aria-label="Enter learning mode"
                title={learningTitle ? `Learning: ${learningTitle}` : "Learning"}
                style={getModeBtnStyle(resolvedMode === "learning")}
              >
                <LearningModeIcon ariaLabel="Learning" />
              </button>
            )}
          </div>
        )}

        {/*
          DEPRECATED (2026/01/13):
          - 使用者確認放大鏡可完全取代「查詢」按鈕後，移除右側查詢按鈕。
          - 後續查詢入口：放大鏡按鈕（search icon）與 Enter 鍵。
          - 為避免 UI/行為回退，保留原按鈕 JSX 供日後回溯（勿刪）。
        */}
        {false && (
          <button
            onClick={() => triggerAnalyzeWithPreprocess("button")}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              cursor: loading ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Loading..." : analyzeLabel}
          </button>
        )}
      </div>


      {/* 原本這裡有 UI 語言切換，下方查詢匡不再顯示 UI Language */}
    </div>
  );
}

export default SearchBox;

// frontend/src/components/search/SearchBox.jsx
