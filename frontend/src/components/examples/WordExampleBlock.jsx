// FILE: frontend/src/components/examples/WordExampleBlock.jsx
// frontend/src/components/examples/WordExampleBlock.jsx
// FILE: frontend/src/components/examples/WordExampleBlock.jsx
// frontend/src/components/examples/WordExampleBlock.jsx
/**
 * 文件說明
 * - 用途：顯示單字例句區塊（ExampleList + Multi-ref UI）
 * - 特性：
 *   - Phase 1：只有手動 Refresh 才會打 /api/dictionary/examples
 *   - Phase 2-3：顯示 refs 使用狀態（used / missing），不影響查詢規則
 *   - Phase 2-UX：multiRef toggle 放在「例句」標題旁；refs 控制區塊下移到例句區塊內（ExampleSentence 下方）
 *
 * 異動紀錄
 * - 2026-01-05：Phase 2-3：refs badge 顯示 used/missing 狀態；missingRefs 非空顯示提示
 * - 2026-01-05：Phase 2-3 修正：showRefStatus 不再被 dirty gate 擋住（dirty 僅顯示提示、不影響狀態顯示）；新增可控 debug log（Production 排查）
 * - 2026-01-06：UI 重做：多重參考改為 toggle button（亮/暗皆清楚可見）；新增參考 input/加入按鈕風格對齊 chip（不改任何查詢規則/資料流）
 * - 2026-01-06：Phase 2-UX（Step A-1）：將 multiRef toggle 狀態/事件轉傳給 ExampleList（供 ExampleSentence 在「例句旁」呈現），不改現有 UI/查詢規則
 * - 2026-01-06：Phase 2-UX（Step A-2）：refs 控制區塊改以 refControls slot 下移到 ExampleSentence 下方（保留舊位置但隱藏，標記 deprecated）
 * - 2026-01-06：Phase 2-UX（Step A-3）：Multi-ref / refs badges / Add 按鈕 pill 視覺對齊「詞性 pills」風格（避免藍框/綠底突兀；亮暗版皆可辨識）
 * - 2026-01-06：Phase 2-UX（Step A-4）：refs 狀態不顯示勾勾/警告 icon，改用 badge 變色（邊框/文字/淡底）呈現 used/missing；刪除 ✕ icon 再縮小
 * - 2026-01-06：Phase 2-UX（Step A-5）：阻擋不合理 refs（例如 xxx / ... / …）：
 *   - UI 輸入檢核：禁止加入 placeholder refs，避免污染 LLM 生成
 *   - 保留既有資料流與查詢規則（仍需手動 refresh 才會打 API）
 * - 2026-01-06：i18n：共用文字統一由 uiText 處理（未補齊 key 先 fallback 到既有 hardcode，避免功能中斷）
 * - 2026-01-06：i18n 修正：移除 isEn/isJa/zh ternary fallback，強制只透過 uiText 取字（uiLang -> zh-TW -> hardFallback）
 * - 2026-01-07：Phase 2-UX（Step A-6）：例句標題顯示 headword（銳角外方匡）：WordExampleBlock 往下傳 headword 給 ExampleList（預設 not available）
 * - 2026-01-10：Phase 2-UX（Step A-2.1）：將 refControls 拆為兩個 slot（refBadgesInline / refActionInline），供後續放到不同 div（不改資料流/查詢規則）
 * - 2026-01-11：Phase 2-UX（Step B-0 定位/Focus）：
 *   - popup 改為貼近「新增」按鈕，並上緣貼齊 + clamp 避免被截
 *   - popup 出現後 input 自動 focus
 */

import React, { useCallback, useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { callTTS } from "../../utils/ttsClient";

// ✅ i18n：共用文字統一由 uiText 處理（逐步補齊 key；未補齊則 fallback 到既有 hardcode，避免功能中斷）
import uiText from "../../uiText";

import ExampleList from "./ExampleList";
import { upsertLastPronRecording } from "./pronReplayStore";
import useExamples from "./useExamples";
import WordPosInfo from "../posInfo/WordPosInfo";

export default function WordExampleBlock({
  d,
  senseIndex,
  sectionExample,
  sectionExampleTranslation,
  exampleTranslation,
  explainLang,
  onWordClick,
  uiLang,

  // ✅ plumbing: query hints (e.g. reflexive) from upstream analyze result
  query,
  queryHints,

  // ✅ plumbing: headword/raw input for lexicographic guards (e.g. sich + Verb)
  headword,
  rawInput,
  normalizedQuery,

  // ✅ Task 1：Entry Header 可被置換（只影響例句 header 顯示）
  // - 來源：上游容器（WordCard / 同層容器）或其他上游 state
  // - 注意：僅用於 UI 顯示，不影響 refs、不觸發造句
  entryHeaderOverride,
  // ✅ 2026-01-12 Task 1：名詞格/數選取後，往上回拋用（只影響 header 顯示）
  // - WordPosInfo.jsx 會呼叫此 callback（若有提供）
  onEntrySurfaceChange,


  // 以下保留舊 props，不使用，但不能刪（避免上層報錯）
  grammarOptionsLabel,
  grammarCaseLabel,
  grammarArticleLabel,
  grammarCaseNomLabel,
  grammarCaseAkkLabel,
  grammarCaseDatLabel,
  grammarCaseGenLabel,
  grammarArticleDefLabel,
  grammarArticleIndefLabel,
  grammarArticleNoneLabel,
  refreshExamplesTooltipLabel,
  grammarToggleLabel,

  conversationTitleLabel,
  conversationToggleTooltipLabel,
  conversationTurnLabel,
  conversationPrevLabel,
  conversationNextLabel,
  conversationPlayLabel,
  conversationCloseLabel,
  conversationLoadingLabel,

  // ✅ Task F2：Favorites/Learning 例句回寫快取（可選）
  // - 上游（App → ResultPanel → WordCard）注入
  // - 若未提供：不影響既有行為
  onExamplesResolved,
  // ✅ Task F2：例句 auto-refresh 開關（上游可注入；favorites-learning 會強制開啟）
  examplesAutoRefreshEnabled,

  // ✅ Task F2：提供 mode/learningContext 以便關閉 favorites replay auto-refresh
  // - 若上游未傳：fallback 不會影響既有 search/history 行為
  mode,
  learningContext,
}) {

  // [***A][SentTypeTrace] debug switch (Vite env)
  // - enable by setting: VITE_DEBUG_SENTENCE_TYPE_TRACE=1
  const __DBG_SENTTYPE_TRACE =
    (import.meta && import.meta.env && import.meta.env.VITE_DEBUG_SENTENCE_TYPE_TRACE) === "1";

  const __stNow = () => {
    try { return new Date().toISOString(); } catch (e) { return ""; }
  };

  const __stLog = (stage, payload) => {
    if (!__DBG_SENTTYPE_TRACE) return;
    try {
      console.log(`[***A][SentTypeTrace][WordExampleBlock] ${__stNow()} ${stage}`, payload || {});
    } catch (e) {}
  };


  // =========================
  // 初始化狀態（Production 排查）
  // =========================
  const __initState = useMemo(
    () => ({
      component: "WordExampleBlock",
      phase: "2-3",
      timestamp: new Date().toISOString(),
    }),
    []
  );

  // ✅ 方案 M：保留接線（不顯示 debug UI）
  const [selectedForm, setSelectedForm] = useState(null);

  // ✅ 2026-01-24：POS 補充資訊收合狀態（全域）
  // 中文功能說明：
  // - 需求：瀏覽不同單字時，維持「收/合」狀態一致
  // - 做法：用 localStorage + window 變數（同分頁立即生效）
  // - 不影響查詢 / 快取 / 例句產生，只是 UI 展示
  const POSINFO_COLLAPSE_KEY = "langapp::ui::posinfo_collapsed_v1";
  // ✅ 2026-02-07：建議字收合狀態（全域）
  // - 與 POS 補充同規格：localStorage + window 快取
  const RECS_COLLAPSE_KEY = "langapp::ui::recs_collapsed_v1";

  // ✅ 共用：讀取 boolean 狀態（localStorage + window cache）
  const __readUiCollapsed = (storageKey, windowKey, fallback = false) => {
    try {
      if (typeof window !== "undefined" && windowKey && window[windowKey] != null) {
        return !!window[windowKey];
      }
    } catch (e) {}
    try {
      const v = window.localStorage.getItem(storageKey);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch (e) {}
    return !!fallback;
  };

  // ✅ 共用：寫入 boolean 狀態（localStorage + window cache）
  const __writeUiCollapsed = (storageKey, windowKey, value) => {
    try {
      if (typeof window !== "undefined" && windowKey) {
        window[windowKey] = !!value;
      }
    } catch (e) {}
    try {
      window.localStorage.setItem(storageKey, value ? "1" : "0");
    } catch (e) {}
  };

  const [posInfoCollapsed, setPosInfoCollapsed] = useState(() =>
    __readUiCollapsed(POSINFO_COLLAPSE_KEY, "__langappPosInfoCollapsed", false)
  );

  // ✅ 2026-02-07：建議字收合狀態（全域）
  // - 需求：查詢/瀏覽/學習切換時不重置（與 POS 補充同規格）
  const [recsCollapsed, setRecsCollapsed] = useState(() =>
    __readUiCollapsed(RECS_COLLAPSE_KEY, "__langappRecsCollapsed", false)
  );

  useEffect(() => {
    __writeUiCollapsed(POSINFO_COLLAPSE_KEY, "__langappPosInfoCollapsed", posInfoCollapsed);
  }, [posInfoCollapsed]);

  useEffect(() => {
    __writeUiCollapsed(RECS_COLLAPSE_KEY, "__langappRecsCollapsed", recsCollapsed);
  }, [recsCollapsed]);

  // ✅ Phase 2-UX（Step A-6）：例句標題顯示 headword（銳角外方匡）
  // 中文功能說明：
  // - 將 headword 往下傳給 ExampleList -> ExampleSentence 使用
  // - 來源優先順序：d.word -> d.baseForm -> not available
  // - 注意：只負責傳遞與可觀測性，不改任何例句/翻譯/查詢流程
  const headwordForExampleTitle = useMemo(() => {
  // ✅ Task 1：Header 可被置換（Entry 狀態）
  // - 優先順序：
  //   1) entryHeaderOverride（上游顯式覆蓋）
  //   2) selectedForm（POS 卡 onSelectForm 接線：Verb 多為 string；Noun 表可能是 { surface }）
  //   3) 原本 headword（d.word / d.baseForm）
  // - 注意：只影響例句 header 顯示，不改 refs、不觸發 refreshExamples
  const override1 =
    typeof entryHeaderOverride === "string" ? entryHeaderOverride.trim() : "";
  const override2 =
    typeof selectedForm === "string"
      ? selectedForm.trim()
      : selectedForm && typeof selectedForm === "object" && typeof selectedForm.surface === "string"
        ? selectedForm.surface.trim()
        : ""; // ✅ Verb: WordPosInfoVerb 會回拋 string；Noun 表等可能回拋 { surface }

  const hw = (d?.word || d?.baseForm || "").toString().trim();
  return override1 || override2 || hw || "not available";
}, [d, entryHeaderOverride, selectedForm]);


  // ✅ 新增：多重參考（前端保存，per wordKey；不進 DB）
  const wordKey = useMemo(() => {
    const w = (d?.word || d?.baseForm || "").toString();
    const si = typeof senseIndex === "number" ? senseIndex : String(senseIndex || "");
    const lang = (explainLang || "").toString();
    return `${w}::${si}::${lang}`;
  }, [d, senseIndex, explainLang]);

  __stLog("wordKey", { wordKey, hasWordKey: !!wordKey });

  const [multiRefEnabledByWordKey, setMultiRefEnabledByWordKey] = useState({});
  const [refsByWordKey, setRefsByWordKey] = useState({});
  const [dirtyByWordKey, setDirtyByWordKey] = useState({});
  const [refInputByWordKey, setRefInputByWordKey] = useState({});

  // ✅ 2026-01-27：sentenceType（句型骨架）— per wordKey（不進 DB）
  // - 只影響 examples options，預設 default（維持既有行為）
  const [sentenceTypeByWordKey, setSentenceTypeByWordKey] = useState({});
  // ✅ 2026-01-30：sentenceType 變更不自動重打例句（避免浪費 LLM）
  // - 變更句型只標記 dirty，需手動點「重新產生例句」才會打 API
  const [sentenceTypeDirtyByWordKey, setSentenceTypeDirtyByWordKey] = useState({});

  // =========================
  // Phase 2-UX（Step B-0）：新增參考小視窗開關（Production 排查）
  // 中文功能說明：
  // - 目標：不要「一開 multiRef toggle 就直接跳出輸入視窗」
  // - 改為：toggle ON → 顯示「新增」按鈕；點新增才打開小視窗
  // - 關閉方式：
  //   - 點擊視窗外側（backdrop）
  //   - ESC
  //   - 加入成功（handleAddRef 成功後自動關閉）
  // - 注意：只改 UI 互動，不改 refs 資料結構/查詢規則
  // =========================
  const [addRefPopupOpenByWordKey, setAddRefPopupOpenByWordKey] = useState({});

  // ✅ popup container ref（僅用於 runtime 觀測，不做強耦合）
  const addRefPopupContainerRef = useRef(null);

  // ✅ P0（定位用）：refs flow 一次性 log guard（避免 console 洗版）
  // - 只用於釐清「katze 進入 refs 的路徑」：rawInput -> lookup -> final ref object -> badge render
  const __p0RefFlowLogOnce = useRef({ addConfirm: {}, badgeRender: {} });

  // ✅ Step B-0（popup 定位）：以「新增」按鈕為 anchor，讓小視窗出現在按鈕附近且上緣貼齊
  // 中文功能說明：
  // - 需求：popup 不要永遠貼右邊；改為貼近「新增」按鈕出現（上緣對齊），並避免被視窗邊界截斷
  // - 作法：在「新增」按鈕綁定 ref，popup 開啟時用 getBoundingClientRect() 取座標，計算 top/left 並做 clamp
  // - 注意：只改 UI 定位，不改 refs 資料流/查詢規則
  const addRefButtonAnchorRef = useRef(null);
  const [addRefPopupPosByWordKey, setAddRefPopupPosByWordKey] = useState({});

  // ✅ Step B-0（Focus）：popup input ref，popup 開啟後自動 focus
  // 中文功能說明：
  // - 需求：方框出現後，游標要自動進去 input
  // - 作法：input 綁 ref；popup open 後用 requestAnimationFrame/timeout 等待 DOM 就緒再 focus
  // - 注意：只影響 UI，不改資料流
  const addRefInputRef = useRef(null);

  // ✅ Phase 2-UX（Step A-5）：ref 輸入錯誤狀態（UI 檢核用；不影響資料流）
  const [refErrorByWordKey, setRefErrorByWordKey] = useState({});
  // ✅ Phase 2-UX（Step A-5-1）：ref 檢核中狀態（避免重複點擊、顯示 loading）
  const [refValidateBusyByWordKey, setRefValidateBusyByWordKey] = useState({});

  const multiRefEnabled = !!multiRefEnabledByWordKey[wordKey];
  const refs = Array.isArray(refsByWordKey[wordKey]) ? refsByWordKey[wordKey] : [];
  const dirty = !!dirtyByWordKey[wordKey];
  const refInput = typeof refInputByWordKey[wordKey] === "string" ? refInputByWordKey[wordKey] : "";

  const sentenceTypeRaw = typeof sentenceTypeByWordKey[wordKey] === "string" ? sentenceTypeByWordKey[wordKey] : "";
  const sentenceTypeDirty = !!sentenceTypeDirtyByWordKey[wordKey];
  const sentenceType = (sentenceTypeRaw && sentenceTypeRaw.trim()) ? sentenceTypeRaw.trim() : "default";
  __stLog("sentenceType", { wordKey, sentenceTypeRaw, sentenceTypeRawType: typeof sentenceTypeRaw, sentenceType, sentenceTypeType: typeof sentenceType });

  // ✅ UI 檢核訊息
  const refError = typeof refErrorByWordKey[wordKey] === "string" ? refErrorByWordKey[wordKey] : "";

  // ✅ Phase 2-UX（Step B-0）：小視窗是否打開
  const isAddRefPopupOpen = !!addRefPopupOpenByWordKey[wordKey];

  // ✅ Step B-0（popup 定位）：取得目前 wordKey 的 popup 座標（預設 0,0）
  const addRefPopupPos = useMemo(() => {
    const p = addRefPopupPosByWordKey[wordKey];
    if (!p || typeof p !== "object") return { top: 0, left: 0 };
    const top = typeof p.top === "number" ? p.top : 0;
    const left = typeof p.left === "number" ? p.left : 0;
    return { top, left };
  }, [addRefPopupPosByWordKey, wordKey]);

  // ✅ Phase 2-UX（Step B-0）：ESC 關閉小視窗（Production 排查）
  useEffect(() => {
    if (!isAddRefPopupOpen) return;

    const onKeyDown = (e) => {
      if (e && e.key === "Escape") {
        setAddRefPopupOpenByWordKey((prev) => ({
          ...prev,
          [wordKey]: false,
        }));
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isAddRefPopupOpen, wordKey]);

  // ✅ Step B-0（popup 定位）：依「新增」按鈕位置決定 popup top/left（上緣貼齊）
  // - 使用 position: fixed，避免受容器影響
  // - 透過 clamp 避免右側/左側被截
  useLayoutEffect(() => {
    if (!isAddRefPopupOpen) return;

    const calcAndSet = () => {
      const el = addRefButtonAnchorRef.current;
      if (!el || typeof el.getBoundingClientRect !== "function") return;

      const r = el.getBoundingClientRect();
      const margin = 8;
      const popupMinWidth = 360; // 與 popup minWidth 對齊
      const vw = typeof window !== "undefined" ? window.innerWidth : 0;
      const vh = typeof window !== "undefined" ? window.innerHeight : 0;

      // ✅ 需求：上緣貼齊「新增」按鈕，上方至少留 margin
      let top = Math.max(margin, Math.round(r.top));

      // ✅ 預設：left 以按鈕左邊對齊（最貼近「新增」）
      let left = Math.round(r.left);

      // ✅ clamp：避免超出右側/左側（以 popupMinWidth 估算）
      if (vw > 0) {
        left = Math.max(margin, Math.min(left, vw - popupMinWidth - margin));
      } else {
        left = Math.max(margin, left);
      }

      // ✅ 垂直方向也做保底（避免完全看不到）
      if (vh > 0) {
        const approxPopupHeight = 120; // 粗估，避免完全看不到
        top = Math.max(margin, Math.min(top, vh - approxPopupHeight - margin));
      }

      setAddRefPopupPosByWordKey((prev) => ({
        ...prev,
        [wordKey]: { top, left },
      }));
    };

    calcAndSet();

    // ✅ 視窗尺寸變動時重算（避免縮放/旋轉被截）
    window.addEventListener("resize", calcAndSet);
    return () => window.removeEventListener("resize", calcAndSet);
  }, [isAddRefPopupOpen, wordKey]);

  // ✅ Step B-0（Focus）：popup 開啟後自動 focus input
  // - 用 requestAnimationFrame 確保 DOM 已插入
  // - 再加一層 setTimeout 0ms 當作保險（某些瀏覽器/渲染節奏）
  useEffect(() => {
    if (!isAddRefPopupOpen) return;

    let raf1 = 0;
    let raf2 = 0;
    let t1 = null;

    const tryFocus = () => {
      const el = addRefInputRef.current;
      if (!el || typeof el.focus !== "function") return;

      try {
        el.focus();
        // ✅ 讓游標到最後（符合「直接接著打」）
        if (typeof el.setSelectionRange === "function") {
          const len = (el.value || "").length;
          el.setSelectionRange(len, len);
        }
      } catch (e) {
        // ignore
      }
    };

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        tryFocus();
        t1 = window.setTimeout(() => {
          tryFocus();
        }, 0);
      });
    });

    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      if (t1) window.clearTimeout(t1);
    };
  }, [isAddRefPopupOpen]);

  const isZh = explainLang?.startsWith("zh");
  const isEn = explainLang?.startsWith("en");
  const isJa = explainLang?.startsWith("ja");

  // =========================
  // i18n：共用文字統一由 uiText 處理
  // - 原則：優先讀 uiText；未補齊 key 時 fallback 回既有 hardcode（避免中斷）
  // - 下一階段：補齊 uiText[uiLang].wordCard.exampleBlock.* 對應 key
  // =========================
  // NOTE 2026/01/24: 多國字串來源一律由 App.jsx 的 explainLang/uiLang 決定
  // - 這裡不再做 "zh-TW" 預設判斷，抓不到 key 時用 "----" 讓缺字可見
  const __ui = (uiText && uiLang && uiText[uiLang]) || {};
  const __uiFallback = {};
  const __tWordCard = (__ui && __ui.wordCard) || {};
  const __tExampleBlock = (__tWordCard && __tWordCard.exampleBlock) || {};
  const __tWordCardFallback = (__uiFallback && __uiFallback.wordCard) || {};
  const __tExampleBlockFallback =
    (__tWordCardFallback && __tWordCardFallback.exampleBlock) || {};
  const __pickText = useCallback((...arr) => {
    for (const it of arr) {
      if (typeof it === "string" && it.trim()) return it;
    }
    return "";
  }, []);

  // ✅ i18n（強制）：共用文字只透過 uiText 取用
  // 中文功能說明：
  // - 取字順序：uiText[uiLang] -> hardFallback（預設 "----"；刻意不再 fallback 到 zh-TW，方便抓缺字）
  // - key 規則：
  //   - wordCard.* 直接用 "refreshExamplesTooltipLabel"
  //   - exampleBlock.* 用 "exampleBlock.multiRefLabel"（映射到 wordCard.exampleBlock.multiRefLabel）
  // ✅ deep key resolver: 支援任意層級（例如 grammar.sentenceType.default.label）
  const __getDeep = useCallback((obj, pathParts) => {
    let cur = obj;
    for (const p of pathParts) {
      if (!cur || typeof cur !== "object") return "";
      cur = cur[p];
    }
    return cur;
  }, []);

  const __t = useCallback(
    (key, hardFallback) => {
      if (typeof key !== "string" || !key) return hardFallback || "----";

      // 1) exampleBlock.* -> wordCard.exampleBlock.*
      if (key.startsWith("exampleBlock.")) {
        const rest = key.slice("exampleBlock.".length).split(".");
        const v =
          __getDeep(__tExampleBlock, rest) ||
          __getDeep(__tExampleBlockFallback, rest) ||
          "";
        if (typeof v === "string" && v.trim()) return v;
        return hardFallback || "----";
      }

      // 2) wordCard.* -> wordCard.*
      if (key.startsWith("wordCard.")) {
        const rest = key.slice("wordCard.".length).split(".");
        const v =
          __getDeep(__tWordCard, rest) || __getDeep(__tWordCardFallback, rest) || "";
        if (typeof v === "string" && v.trim()) return v;
        return hardFallback || "----";
      }

      // 3) 其他任意深度 key（例如 grammar.sentenceType.default.label）
      const deepParts = key.split(".");
      const vDeep = __getDeep(__ui, deepParts) || __getDeep(__uiFallback, deepParts) || "";
      if (typeof vDeep === "string" && vDeep.trim()) return vDeep;

      // 4) 向後相容：舊版 flat key（例如 wordCard["refreshExamplesTooltipLabel"]）
      const vFlat =
        (__tWordCard && __tWordCard[key]) ||
        (__tWordCardFallback && __tWordCardFallback[key]) ||
        "";
      if (typeof vFlat === "string" && vFlat.trim()) return vFlat;

      return hardFallback || "----";
    },
    [
      __ui,
      __uiFallback,
      __tWordCard,
      __tExampleBlock,
      __tWordCardFallback,
      __tExampleBlockFallback,
      __getDeep,
    ]
  );

  // DEPRECATED 2026/01/06: 舊 i18n fallback（isEn/isJa/zh hardcode）改為「只透過 uiText」取字
  // - 保留原碼避免回溯困難；此段不再被使用
  /*
  const tRefreshTooltip = __pickText(
    refreshExamplesTooltipLabel,
    __tWordCard.refreshExamplesTooltipLabel,
    __tExampleBlock.refreshExamplesTooltipLabel,
    isEn ? "Regenerate examples" : isJa ? "例文を再生成" : "重新產生例句"
  );

  const tMultiRefLabel = __pickText(
    __tExampleBlock.multiRefLabel,
    isEn ? "Multi-ref" : isJa ? "複数参照" : "多重參考"
  );

  const tRefPlaceholder = __pickText(
    __tExampleBlock.refPlaceholder,
    isEn
      ? "Add reference (noun/verb/grammar)..."
      : isJa
      ? "参照を追加（名詞/動詞/文法）..."
      : "exampleBlock.refPlaceholder"
  );

  const tAddRefBtn = __pickText(
    __tExampleBlock.addRefBtn,
    isEn ? "Add" : isJa ? "追加" : "加入"
  );

  const tDirtyHint = __pickText(
    __tExampleBlock.refsDirtyHint,
    isEn
      ? "Refs changed — refresh to regenerate"
      : isJa
      ? "参照が変更されました。再生成してください"
      : "exampleBlock.refsDirtyHint"
  );

  // ✅ 新增：toggle button 旁的短說明（亮暗版也可讀）
  const tMultiRefHint = __pickText(
    __tExampleBlock.multiRefHint,
    isEn
      ? "Use multiple refs for examples"
      : isJa
      ? "複数の参照で例文を生成"
      : "exampleBlock.multiRefHint"
  );

  // ✅ Phase 2-UX（Step A-5）：ref 不合理輸入提示
  const tRefInvalidHint = __pickText(
    __tExampleBlock.refInvalidHint,
    isEn
      ? "Invalid reference (e.g., 'xxx' / '...' / '…')."
      : isJa
      ? "不正な参照です（例：'xxx' / '...' / '…'）。"
      : "exampleBlock.refInvalidHint"
  );

  // ✅ refs badge 狀態提示文字（used/missing）
  const tRefStatusUsed = __pickText(
    __tExampleBlock.refStatusUsed,
    isEn ? "used" : isJa ? "使用済み" : "已使用"
  );
  const tRefStatusMissing = __pickText(
    __tExampleBlock.refStatusMissing,
    isEn ? "missing" : isJa ? "不足" : "缺少"
  );

  // ✅ missing refs 提示（共用文字統一由 uiText；未補齊 key 先 fallback）
  const tMissingRefsHint = __pickText(
    __tExampleBlock.missingRefsHint,
    isEn
      ? "Some references were not used. Please regenerate."
      : isJa
      ? "一部の参照が使用されていません。再生成してください。"
      : "exampleBlock.missingRefsHint"
  );
  */

  // ✅ 現行 i18n：只透過 uiText 取字（uiLang -> zh-TW -> hardFallback）
  const tRefreshTooltip = __t(
    "refreshExamplesTooltipLabel",
    refreshExamplesTooltipLabel || "refreshExamplesTooltipLabel"
  );

  const tMultiRefLabel = __t("exampleBlock.multiRefLabel", "exampleBlock.multiRefLabel");

  const tRefPlaceholder = __t(
    "exampleBlock.refPlaceholder",
    "exampleBlock.refPlaceholder"
  );

  const tAddRefBtn = __t("exampleBlock.addRefBtn", "exampleBlock.addRefBtn");

  const tDirtyHint = __t(
    "exampleBlock.refsDirtyHint",
    "exampleBlock.refsDirtyHint"
  );

  // ✅ 新增：toggle button 旁的短說明（亮暗版也可讀）
  const tMultiRefHint = __t(
    "exampleBlock.multiRefHint",
    "exampleBlock.multiRefHint"
  );

  // ✅ Phase 2-UX（Step A-5）：ref 不合理輸入提示
  const tRefInvalidHint = __t(
    "exampleBlock.refInvalidHint",
    "exampleBlock.refInvalidHint"
  );

  // ✅ refs badge 狀態提示文字（used/missing）
  const tRefStatusUsed = __t("exampleBlock.refStatusUsed", "exampleBlock.refStatusUsed");
  const tRefStatusMissing = __t("exampleBlock.refStatusMissing", "exampleBlock.refStatusMissing");

  // ✅ missing refs 提示
  const tMissingRefsHint = __t(
    "exampleBlock.missingRefsHint",
    "exampleBlock.missingRefsHint"
  );

  // ✅ 2026-01-27：例句 header 旁「ⓘ」提示（參考形式說明）
  const tHeadwordRefHint = __t(
    "exampleBlock.headwordRefHint",
    "exampleBlock.headwordRefHint"
  );

  // ✅ sentenceType（UI 文案走 uiText；value 只進 options，不進 DB/snapshot）
  const tSentenceTypeLabel = __t("wordCard.exampleBlock.sentenceTypeLabel", "wordCard.exampleBlock.sentenceTypeLabel");
  // ✅ sentenceType dirty 提示（多國字串由 uiText 提供）
  const tSentenceTypeDirtyHint = __t(
    "wordCard.exampleBlock.sentenceTypeDirtyHint",
    "wordCard.exampleBlock.sentenceTypeDirtyHint"
  );
  const tSentenceTypeRegenerateBtn = __t(
    "wordCard.exampleBlock.sentenceTypeRegenerateBtn",
    "wordCard.exampleBlock.sentenceTypeRegenerateBtn"
  );
  const sentenceTypeOptions = [
    { value: "default", label: __t("wordCard.grammar.sentenceType.default.label", "wordCard.grammar.sentenceType.default.label") },
    { value: "question_yesno", label: __t("wordCard.grammar.sentenceType.question_yesno.label", "wordCard.grammar.sentenceType.question_yesno.label") },
    { value: "question_w", label: __t("wordCard.grammar.sentenceType.question_w.label", "wordCard.grammar.sentenceType.question_w.label") },
    { value: "imperative", label: __t("wordCard.grammar.sentenceType.imperative.label", "wordCard.grammar.sentenceType.imperative.label") },
    { value: "request_polite", label: __t("wordCard.grammar.sentenceType.request_polite.label", "wordCard.grammar.sentenceType.request_polite.label") },
    { value: "prohibition", label: __t("wordCard.grammar.sentenceType.prohibition.label", "wordCard.grammar.sentenceType.prohibition.label") },
    { value: "suggestion", label: __t("wordCard.grammar.sentenceType.suggestion.label", "wordCard.grammar.sentenceType.suggestion.label") },
    { value: "exclamation", label: __t("wordCard.grammar.sentenceType.exclamation.label", "wordCard.grammar.sentenceType.exclamation.label") },
  ];

  __stLog("sentenceTypeOptions", {
    count: Array.isArray(sentenceTypeOptions) ? sentenceTypeOptions.length : 0,
    sample: Array.isArray(sentenceTypeOptions) ? sentenceTypeOptions.slice(0, 3) : sentenceTypeOptions,
    sampleTypes: Array.isArray(sentenceTypeOptions)
      ? sentenceTypeOptions.slice(0, 3).map((o) => ({ valueType: typeof (o && o.value), labelType: typeof (o && o.label) }))
      : typeof sentenceTypeOptions,
  });


  // ============================================================
  // Task F2 — Favorites/Learning：auto-refresh 預設關閉（deprecated）
  // - 目標：Favorites 左右切換「不自動」打 /api/dictionary/examples
  // - 若該字沒有例句：僅顯示「無例句」狀態，讓使用者手動補齊
  // - 不影響：search/history 既有 auto-refresh 行為
  //
  // ✅ 2026/01/20（需求變更）：取消 favorites-learning 預設關閉 auto-refresh
  // - 需求：學習本連到 ResultPanel 時也要自動產生/補齊（含翻譯）
  // - 策略：favorites-learning 一律強制開啟；其他模式尊重上游注入（未注入則預設 true）
  // ============================================================
  const __examplesAutoRefreshEnabledDeprecated = !(
    mode === "learning" &&
    learningContext &&
    learningContext.sourceType === "favorites"
  );

  const __examplesAutoRefreshEnabledFromUpstream =
    typeof examplesAutoRefreshEnabled === "boolean"
      ? examplesAutoRefreshEnabled
      : true;

  const __examplesAutoRefreshEnabledEffective =
    mode === "learning" &&
    learningContext &&
    learningContext.sourceType === "favorites"
      ? true
      : __examplesAutoRefreshEnabledFromUpstream;

  // ============================================================
  // Task 3 — Examples Auto-Refresh（策略：切換/Replay 不重打、缺資料才補齊）
  // - favorites-learning：不要寫死 true，改成 needsRefresh gate
  // - 其他模式：維持上游注入（或預設 true）的行為
  // ============================================================
  const __isFavoritesLearning =
    mode === "learning" &&
    learningContext &&
    learningContext.sourceType === "favorites";

  const __hasExamplesFromDict =
    (Array.isArray(d?.examples) && d.examples.length > 0) ||
    (typeof d?.example === "string" && d.example.trim() !== "");

  const __hasTranslationFromDict =
    typeof d?.exampleTranslation === "string" && d.exampleTranslation.trim() !== "";

  const __needsAutoRefresh = !__hasExamplesFromDict || !__hasTranslationFromDict;

  const __examplesAutoRefreshEnabledEffective__task3 = __isFavoritesLearning
    ? __needsAutoRefresh
    : __examplesAutoRefreshEnabledFromUpstream;

  // ===== useExamples（不改查詢規則）=====
  const {
    examples,
    exampleTranslation: generatedTranslation,
    loading,
    refreshExamples,

    // ✅ Phase 2-3：新增取用（向後相容）
    usedRefs,
    missingRefs,
  } = useExamples({
    d,
    senseIndex,
    explainLang,
    // ✅ sentenceType：句型骨架（只透傳到 options）
    sentenceType,
    // ✅ Task F2：補齊完成回寫 favorites cache（若上游有注入）
    onExamplesResolved,
    // ✅ Task 3：favorites-learning 以 needsRefresh gate 決定是否開啟 auto-refresh
    // - 有例句+翻譯 → skip（不重打）
    // - 缺例句 or 缺翻譯 → 補齊一次
    examplesAutoRefreshEnabled: __examplesAutoRefreshEnabledEffective__task3,
    multiRefEnabled,
    refs,

    // ✅ 2026/01/14：例句 refresh 的 req.word 以例句標題 headword 為準（例如：des Berges）
    // - 目的：確保重新產生例句時，後端/LLM 看到的「目標字形」與 UI 顯示一致
    // - 注意：只影響 /api/dictionary/examples 的 word 欄位；baseForm 仍保留原本 d.baseForm
    exampleHeadword: headwordForExampleTitle,
    headwordOverride: headwordForExampleTitle,
  });

  const safeUsedRefs = Array.isArray(usedRefs) ? usedRefs : [];
  const safeMissingRefs = Array.isArray(missingRefs) ? missingRefs : [];

  // ✅ 是否顯示 refs 狀態
  // - 現況 root cause：dirty 可能永遠 true（refresh 不一定走 handleManualRefresh），導致狀態永遠不顯示
  // - 修正策略：狀態顯示應以「後端回傳事實」為準，dirty 僅用於提示「refs 已變更，需要 refresh 才會套用」
  // - ✅ 保留舊邏輯（deprecated），避免日後追查行為來源
  const showRefStatusDeprecated = multiRefEnabled && refs.length > 0 && !dirty; // deprecated: dirty gate 可能造成狀態永遠被擋住
  const showRefStatus = multiRefEnabled && refs.length > 0; // ✅ 修正版：不受 dirty 影響，狀態照後端回傳顯示

  // ✅ 可控 debug（Production 排查）
  // - 使用方式：Vite 環境變數 VITE_DEBUG_EXAMPLES_REFS=1
  // - 注意：若你在 debugger 看到 import.meta 不可用，通常是 sourcemap/打包情境差異；此段不影響功能，只在條件成立才 console
  try {
    const __dbgFlag = (import.meta && import.meta.env && import.meta.env.VITE_DEBUG_EXAMPLES_REFS) || "";
    if (__dbgFlag === "1") {
      console.log("[WordExampleBlock][refs-ui]", {
        __initState,
        wordKey,
        multiRefEnabled,
        refsCount: refs.length,
        refs,
        dirty,
        showRefStatusDeprecated,
        showRefStatus,
        usedRefs: safeUsedRefs,
        missingRefs: safeMissingRefs,
        refInput,
        refError,

        // ✅ Phase 2-UX（Step A-6）：例句標題 headword 觀測（Production 排查）
        headwordForExampleTitle,
        hasHeadwordForExampleTitle: headwordForExampleTitle !== "not available",
      });
    }
  } catch (e) {
    // 避免少數 runtime 對 import.meta 的限制造成中斷（僅 debug 用，不應影響主要流程）
  }

  // =========================
  // UI 樣式（最小插入，不影響資料流）
  // =========================

  // ✅ 統一 pill 視覺（對齊「詞性 pills」）
  // - 原先 Multi-ref 有藍框/綠底，與上方 pills 不一致，且亮暗版不穩定
  // - 這裡改為「中性 pill」：靠邊框/淡底/字重差異呈現 on/off
  // - 避免指定主題色（讓既有全站樣式/亮暗版更一致）
  const pillBaseStyle = useMemo(() => {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      borderRadius: 999,
      cursor: "pointer",
      userSelect: "none",
      color: "inherit",
      fontSize: 13,
      lineHeight: 1.2,
      whiteSpace: "nowrap",
    };
  }, []);

  // ✅ 多重參考 toggle button：OFF/ON 都要清楚可見（亮暗版可讀），並對齊詞性 pill 風格
  const multiRefToggleBtnStyle = useMemo(() => {
    const on = !!multiRefEnabled;
    return {
      ...pillBaseStyle,
      border: on ? "1px solid rgba(0, 0, 0, 0.38)" : "1px solid rgba(0, 0, 0, 0.18)",
      background: on ? "rgba(0, 0, 0, 0.06)" : "transparent",
      fontWeight: on ? 600 : 500,
    };
  }, [multiRefEnabled, pillBaseStyle]);

  // ✅ dot 保留（當作最小狀態提示），但改成中性、避免綠色突兀
  const multiRefToggleDotStyle = useMemo(() => {
    const on = !!multiRefEnabled;
    return {
      width: 10,
      height: 10,
      borderRadius: 999,
      display: "inline-block",
      border: on ? "1px solid rgba(0, 0, 0, 0.40)" : "1px solid rgba(0, 0, 0, 0.20)",
      background: on ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.18)",
    };
  }, [multiRefEnabled]);

  const multiRefHintStyle = useMemo(() => {
    return {
      fontSize: 13,
      opacity: 0.85,
      whiteSpace: "nowrap",
    };
  }, []);

  // ✅ 新增參考 input / button 風格對齊（避免方形 UI 突兀）
  const refInputStyle = useMemo(() => {
    return {
      minWidth: 260,
      padding: "2px 10px",
      borderRadius: 10,
      border: "1px solid rgba(0, 0, 0, 0.1)",
      background: "rgba(0, 0, 0, 0.03)",
      outline: "none",
      fontSize: 14,
    };
  }, []);

  // ✅ 加入按鈕：改成 pill 視覺（對齊詞性 pills）
  const addRefBtnStyle = useMemo(() => {
    return {
      ...pillBaseStyle,
      justifyContent: "center",
      border: "1px solid rgba(0, 0, 0, 0.18)",
      background: "transparent",
      fontWeight: 500,
      padding: "2px 12px",
    };
  }, [pillBaseStyle]);

  // ✅ Step B-0：新增按鈕（開啟小視窗用）
  // 中文功能說明：
  // - 視覺上與「加入」同系統，但文字是「新增」，避免與「加入」語意混淆
  // - 不額外加粗字體（使用者要求回原本字重）
  const addRefButtonStyle = useMemo(() => {
    return {
      ...pillBaseStyle,
      justifyContent: "center",
      border: "1px solid rgba(0, 0, 0, 0.18)",
      background: "transparent",
      fontWeight: 500,
      padding: "2px 12px",
    };
  }, [pillBaseStyle]);

  // ✅ refs badge：改成與詞性 pill 同系統（狀態用變色表達，不使用勾勾）
  const refBadgeBaseStyle = useMemo(() => {
    return {
      ...pillBaseStyle,
      padding: "2px 12px",
      border: "1px solid rgba(0, 0, 0, 0.18)",
      background: "transparent",
      fontWeight: 500,
      fontSize: 13,
    };
  }, [pillBaseStyle]);

  // ✅ 狀態色（中性、亮暗版都可辨；不使用主題色，僅用 alpha）
  // 中文功能說明：
  // - used：微深邊框 + 淡底 + 字色略深
  // - missing：邊框/淡底/字色偏警示（仍是低彩度），不放 icon
  const refBadgeStatusStyles = useMemo(() => {
    return {
      used: {
        border: "1px solid rgba(0, 0, 0, 0.26)",
        background: "rgba(0, 0, 0, 0.06)",
        color: "inherit",
        opacity: 0.98,
      },
      missing: {
        border: "1px solid rgba(160, 0, 0, 0.30)",
        background: "rgba(160, 0, 0, 0.06)",
        color: "rgba(160, 0, 0, 0.92)",
        opacity: 1,
      },
      idle: {
        border: "1px solid rgba(0, 0, 0, 0.18)",
        background: "transparent",
        color: "inherit",
        opacity: 0.92,
      },
    };
  }, []);

  // ✅ Phase 2-UX（Step A-5）：ref 輸入錯誤提示樣式（亮暗版皆可見）
  const refErrorStyle = useMemo(() => {
    return {
      fontSize: 12,
      color: "rgba(160, 0, 0, 0.92)",
      background: "rgba(160, 0, 0, 0.06)",
      border: "1px solid rgba(160, 0, 0, 0.22)",
      borderRadius: 10,
      padding: "6px 10px",
      opacity: 1,
      whiteSpace: "nowrap",
    };
  }, []);

  // =========================
  // Phase 2-UX（Step A-5）：ref 輸入檢核（只擋掉「明顯 placeholder」）
  // - 目的：避免像 xxx / ... / … 這種 ref 進入 refs，進而污染 LLM 生成
  // - 原則：盡量保守，只擋「高度可疑」的 placeholder；不做過度限制（避免誤擋正常單字）
  // - 注意：LLM prompt/輸出檢核（server side）應在後端另做，這裡先完成 UI 端擋下
  // =========================
  const normalizeRefText = useCallback((s) => {
    return (s || "")
      .toString()
      .trim()
      // ✅ 將多個空白收斂成單一空白，避免 "  Hund   Katze " 類
      .replace(/\s+/g, " ");
  }, []);

  // =========================
  // ✅ Phase 2-UX（Step A-5-2）：ref lemma 檢核 / 正規化
  // - 目的：badge 內只允許存「lemma」（例如 hund → Hund、schlafst → schlafen）
  // - 策略：
  //   A) 單字（無空白）：優先走 dictionary lookup；查不到就視為無效
  //   B) 多字詞（含空白）：允許先加入（因為字典可能不支援片語），但不做 lemma 正規化
  // - 注意：這裡只處理「ref badge 的輸入」，不要求例句一定要用 lemma 呈現
  const tryLookupLemma = useCallback(
    async (rawText) => {
      const t = (rawText || "").toString().trim();
      if (!t) return { ok: false, lemma: "", reason: "empty" };

      // ✅ 多字詞：先放行（後續可再設計 phrase-level 的驗證策略）
      if (t.includes(" ")) {
        return { ok: true, lemma: t, reason: "multi_word_passthrough" };
      }

      try {
        // ⚠️ endpoint 依你現有 backend route 實作：dictionaryRoute.js
        // - 這裡不假設回傳 schema，只做「保守型抽取」：
        //   baseForm / lemma / headword / word 任一存在即視為 lemma
        const resp = await fetch("/api/dictionary/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: t,
            explainLang,
            // cache-bust：避免 dev server/edge cache 造成舊資料
            __ts: Date.now(),
          }),
        });

        if (!resp.ok) {
          return { ok: false, lemma: "", reason: `http_${resp.status}` };
        }

        const data = await resp.json();

        // 保守抽取：盡量抓到「最像 lemma」的欄位
        const lemmaCandidate =
          (data && typeof data.baseForm === "string" && data.baseForm) ||
          (data && typeof data.lemma === "string" && data.lemma) ||
          (data && typeof data.headword === "string" && data.headword) ||
          (data && typeof data.word === "string" && data.word) ||
          "";

        if (!lemmaCandidate) {
          return { ok: false, lemma: "", reason: "no_lemma" };
        }

        return { ok: true, lemma: lemmaCandidate, reason: "lookup_ok" };
      } catch (e) {
        return { ok: false, lemma: "", reason: "fetch_error" };
      }
    },
    [explainLang]
  );

  const isPlaceholderRefText = useCallback((s) => {
    const t = normalizeRefText(s);
    const lower = t.toLowerCase();

    if (!t) return true; // 空字串：視為不可加入
    if (t.length < 2) return true; // 太短：大多是誤觸/噪音（保守擋掉）

    // ✅ 明顯 placeholder：xxx / xxxx / XXXXX
    if (/^x{2,}$/i.test(t)) return true;

    // ✅ 明顯 placeholder：... / … / ……（多個省略點/句點）
    if (/^\.+$/.test(t)) return true;
    if (/^…+$/.test(t)) return true;

    // ✅ 常見測試字：test（保守：只擋掉完全等於 test）
    if (lower === "test") return true;

    return false;
  }, [normalizeRefText]);

  // ============================================================
  // Task A — WordExampleBlock.jsx
  // - 目標：Favorites snapshot replay 時，必須吃得到 snapshot/result 內已存在的例句翻譯
  // - 規則：翻譯來源優先序 = generatedTranslation（即時補齊） > snapshot/result 內翻譯 > 空字串
  // - 注意：不改 useExamples 行為；不改 snapshot 結構；不影響 History/Search（僅在 favorites-learning 啟用掃描）
  // ============================================================


  // ✅ 嘗試從 snapshot/result 的例句資料中找出可用翻譯
  // - 由於 snapshot 可能把翻譯掛在 examples[] item（exampleTranslation / translation）
  //   而不是傳進 exampleTranslation prop，所以這裡做保守型掃描
  const __snapshotExampleTranslationCandidate = useMemo(() => {
    if (!__isFavoritesLearning) return "";
    if (!Array.isArray(examples)) return "";

    for (const ex of examples) {
      if (!ex || typeof ex !== "object") continue;
      const cand =
        (typeof ex.exampleTranslation === "string" && ex.exampleTranslation) ||
        (typeof ex.translation === "string" && ex.translation) ||
        "";
      const t = (cand || "").toString().trim();
      if (t) return t;
    }
    return "";
  }, [__isFavoritesLearning, examples]);

  // ✅ 有效翻譯（供下游 ExampleList / ExampleSentence 使用）
  const effectiveExampleTranslation =
    generatedTranslation ||
    (typeof exampleTranslation === "string" ? exampleTranslation : "") ||
    __snapshotExampleTranslationCandidate ||
    "";

  const hasExamples = Array.isArray(examples) && examples.length > 0;
  const hasTranslation =
    typeof effectiveExampleTranslation === "string" &&
    effectiveExampleTranslation.trim() !== "";

  const needsRefresh = !hasExamples || !hasTranslation;


  // ============================================================
  // Task 2 — Favorites Snapshot「可更新」：例句/翻譯補齊後回拋上游
  // - 目的：讓 App.jsx 能把最新補齊內容 upsert 回 favorites snapshot
  // - 技術約束：不新增 API、不改 DB schema、不影響 History/Search
  // - 注意：上游（App.jsx）仍會做 mode===learning && sourceType===favorites 的 gate
  // ============================================================
  const __lastExamplesResolvedRef = useRef({
    key: null,
    examplesLen: 0,
    exampleTranslation: "",
  });

  useEffect(() => {
    try {
      if (typeof onExamplesResolved !== "function") return;

      // ✅ 僅在 favorites-learning 時才允許「可更新」語意
      if (!(mode === "learning" && learningContext && learningContext.sourceType === "favorites")) {
        return;
      }

      const headwordForKey =
        (typeof d?.dictionary?.baseForm === "string" && d.dictionary.baseForm) ||
        (typeof d?.dictionary?.word === "string" && d.dictionary.word) ||
        "";

      // 這裡不做 normalize（由上游 handleFavoritesExamplesResolved 內部統一 normalize）
      const nowKey = String(headwordForKey || "");

      const prev = __lastExamplesResolvedRef.current || {
        key: null,
        examplesLen: 0,
        exampleTranslation: "",
      };

      const nextLen = Array.isArray(examples) ? examples.length : 0;
      const nextTran = typeof generatedTranslation === "string" ? generatedTranslation : "";

      const improved =
        // 例句：從空 → 有、或數量增加
        (prev.examplesLen === 0 && nextLen > 0) ||
        nextLen > prev.examplesLen ||
        // 翻譯：從空 → 有（不要求一次全齊）
        (!prev.exampleTranslation && !!nextTran);

      // ✅ 只要有新增/補齊就回拋一次（避免 render 連續回拋造成噪音）
      if (improved) {
        try {
          onExamplesResolved(examples, {
            exampleTranslation: nextTran,
            headword: nowKey,
            reason:
              (!prev.exampleTranslation && !!nextTran)
                ? "translation_filled"
                : (prev.examplesLen === 0 && nextLen > 0)
                  ? "examples_filled"
                  : "examples_grew",
          });
        } catch {
          // ignore
        }

        __lastExamplesResolvedRef.current = {
          key: nowKey,
          examplesLen: nextLen,
          exampleTranslation: nextTran,
        };
      } else if (prev.key !== nowKey) {
        // ✅ 換字時重置 tracking，避免字與字之間互相影響判斷
        __lastExamplesResolvedRef.current = {
          key: nowKey,
          examplesLen: nextLen,
          exampleTranslation: nextTran,
        };
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examples, generatedTranslation, onExamplesResolved, mode, learningContext, d]);



  // ============================================================
  // Phase 2.1 — Pronunciation audio handoff (store last recording)
  // - 目的：把 ExampleSentence 錄下來的 blob 交給上層保存（先不接評分 API）
  // - 策略：只保存「最後一次錄音」（會覆蓋），並在覆蓋時 revoke 舊 objectURL
  // - 注意：不新增 API、不改後端；不影響既有例句/翻譯/refresh 流程
  // ============================================================
  const handlePronunciationAudioReady = useCallback(
    (mainSentence, blob, meta) => {
      try {
        const hw = (headwordForExampleTitle || (d?.word || d?.baseForm || "")).toString().trim();
        const sent = (mainSentence || "").toString().trim();
        if (!hw || !sent || !blob) return;
        const key = `${hw}::${sent}`;
        upsertLastPronRecording(key, blob, {
          headword: hw,
          sentence: sent,
          ...(meta && typeof meta === "object" ? meta : {}),
        });
      } catch (e) {
        // 不影響主流程（僅保存用）
      }
    },
    [d, headwordForExampleTitle]
  );

  async function handleSpeak(sentence) {
    try {
      if (!sentence) return;
      const audioBase64 = await callTTS(sentence, "de-DE");
      const audio = new Audio(audioBase64);
      audio.play();
    } catch (err) {
      console.error("[TTS_PLAY_FAILED]", err);
    }
  }

  const handleManualRefresh = useCallback(async () => {
    await refreshExamples();
    setDirtyByWordKey((prev) => ({
      ...prev,
      [wordKey]: false,
    }));
  }, [refreshExamples, wordKey]);

  const handleToggleMultiRef = useCallback(
    (enabled) => {
      setMultiRefEnabledByWordKey((prev) => ({
        ...prev,
        [wordKey]: !!enabled,
      }));

      // ✅ Phase 2-UX（Step B-0）：關閉 toggle 時，同步關閉新增小視窗（避免殘留）
      if (!enabled) {
        setAddRefPopupOpenByWordKey((prev) => ({
          ...prev,
          [wordKey]: false,
        }));
      }

      setDirtyByWordKey((prev) => ({
        ...prev,
        [wordKey]: true,
      }));
    },
    [wordKey]
  );

  // ✅ 新增：button 觸發 toggle（保留原 checkbox 行為但不再用 checkbox 呈現）
  const handleToggleMultiRefButton = useCallback(() => {
    handleToggleMultiRef(!multiRefEnabled);
  }, [handleToggleMultiRef, multiRefEnabled]);

  // ✅ Phase 2-UX：提供給 ExampleSentence 的 onToggle（「在例句旁」點按會切換）
  // - 這裡不改任何查詢規則：multiRefEnabled 一變，依然只有手動 Refresh 才打 API
  const onToggleMultiRefForExampleHeader = useCallback(() => {
    handleToggleMultiRefButton();
  }, [handleToggleMultiRefButton]);

  // ✅ SentenceType（句型）切換：只改 state，並沿用既有「切換後直接重打例句」行為
  // - UI 位置由 ExampleSentence（例句 header）負責
  // - 這裡只提供回呼，不新增任何規則/白名單
  const handleSentenceTypeChange = useCallback(
    (nextValue) => {
      const v = String(nextValue || "");
      setSentenceTypeByWordKey((prev) => ({
        ...prev,
        [wordKey]: v,
      }));

      // ✅ 句型變更：不自動重打例句（避免浪費 LLM）
      // - 只標記 dirty，待使用者手動點「重新產生例句」
      setSentenceTypeDirtyByWordKey((prev) => ({
        ...prev,
        [wordKey]: true,
      }));
    },
    [wordKey]
  );

  const handleSentenceTypeRegenerate = useCallback(async () => {
    try {
      await refreshExamples();
    } finally {
      setSentenceTypeDirtyByWordKey((prev) => ({
        ...prev,
        [wordKey]: false,
      }));
    }
  }, [refreshExamples, wordKey]);



  const handleAddRef = useCallback(async () => {
    // ✅ Phase 2-UX（Step A-5）：先做 UI 檢核（空值 / placeholder）
    const textRaw = (refInput || "").toString();
    const text = normalizeRefText(textRaw);

    if (!text) {
      setRefErrorByWordKey((prev) => ({
        ...prev,
        [wordKey]: tRefInvalidHint,
      }));
      return;
    }

    if (isPlaceholderRefText(text)) {
      setRefErrorByWordKey((prev) => ({
        ...prev,
        [wordKey]: tRefInvalidHint,
      }));

      // ✅ 可控 debug：只有開 flag 才 log，避免 production 汙染
      try {
        const __dbgFlag =
          import.meta && import.meta.env && import.meta.env.VITE_DEBUG
            ? String(import.meta.env.VITE_DEBUG).toLowerCase() === "true"
            : false;
        if (__dbgFlag) {
          console.warn("[WordExampleBlock] ref rejected by placeholder check:", text);
        }
      } catch (_) {}

      return;
    }

    // ✅ Phase 2-UX（Step A-5-2）：lemma 檢核 / 正規化
    // - badge 內只存 lemma（單字），多字詞先放行（不做 lemma 正規化）
    setRefValidateBusyByWordKey((prev) => ({ ...prev, [wordKey]: true }));
    try {
      const res = await tryLookupLemma(text);
      if (!res?.ok || !res?.lemma) {
        setRefErrorByWordKey((prev) => ({
          ...prev,
          [wordKey]: tRefInvalidHint,
        }));
        return;
      }

      const lemmaText = normalizeRefText(res.lemma);
      if (!lemmaText) {
        setRefErrorByWordKey((prev) => ({
          ...prev,
          [wordKey]: tRefInvalidHint,
        }));
        return;
      }


      // ✅ P0（定位）：新增 confirm handler 的最終寫入值
      // - 只 log 一次/每個 wordKey，避免洗版
      try {
        const __once = __p0RefFlowLogOnce.current && __p0RefFlowLogOnce.current.addConfirm;
        if (__once && !__once[wordKey]) {
          __once[wordKey] = true;
          console.log("[P0][addRefConfirm]", {
            wordKey,
            rawInput: textRaw,
            normalizedInput: text,
            lookupResult: res,
            lemmaText,
            finalRef: { kind: "custom", key: lemmaText, displayText: lemmaText, pinned: true },
            typeofKey: typeof lemmaText,
            isSingleWord: !text.includes(" "),
          });
        }
      } catch (_) {}

setRefsByWordKey((prev) => {
      const cur = Array.isArray(prev[wordKey]) ? prev[wordKey] : [];

      // ✅ 去重（同 key 不重複加入）：不改資料結構，只在 UI prevent duplication
      // - 注意：不刪除舊邏輯，只是避免 UI 重複輸入造成混亂
      const existed = cur.some((r) => (r?.key || r?.displayText || "") === lemmaText);
      if (existed) return prev;

      const next = cur.concat([
        {
          kind: "custom",
          key: lemmaText,
          displayText: lemmaText,
          pinned: true,
        },
      ]);
      return {
        ...prev,
        [wordKey]: next,
      };
    });

    setRefInputByWordKey((prev) => ({
      ...prev,
      [wordKey]: "",
    }));

    setDirtyByWordKey((prev) => ({
      ...prev,
      [wordKey]: true,
    }));

    // ✅ Phase 2-UX（Step B-0）：加入成功後關閉小視窗（避免卡住）
    setAddRefPopupOpenByWordKey((prev) => ({
      ...prev,
      [wordKey]: false,
    }));
    } finally {
      setRefValidateBusyByWordKey((prev) => ({ ...prev, [wordKey]: false }));
    }
  }, [

    refInput,
    wordKey,
    normalizeRefText,
    isPlaceholderRefText,
    tryLookupLemma,
    tRefInvalidHint,
  
  ]);

  const handleRemoveRefAt = useCallback(
    (idx) => {
      setRefsByWordKey((prev) => {
        const cur = Array.isArray(prev[wordKey]) ? prev[wordKey] : [];
        const next = cur.filter((_, i) => i !== idx);
        return {
          ...prev,
          [wordKey]: next,
        };
      });

      setDirtyByWordKey((prev) => ({
        ...prev,
        [wordKey]: true,
      }));
    },
    [wordKey]
  );

  // =========================
  // Phase 2-UX（Step A-2）：refs 控制區塊下移（refControls slot）
  // - 目的：讓「新增參考/加入/refs badges/dirty/used&missing」出現在 ExampleSentence 下方（由 ExampleList 渲染）
  // - 注意：此區塊純 UI，不改查詢規則；仍需按 Refresh 才會真正打 API
  // =========================

  // ============================================================
  // ✅ NEW 2026/01/10: 拆分 refControls -> 兩個 slot
  // - refBadgesInline：只包含 refs badges（+Hund）
  // - refActionInline：只包含 新增按鈕 + popup + missing/dirty hints
  // - refControls（deprecated）保留：組合上述兩個 slot，保持現有 UI/行為
  // ============================================================

  const refBadgesInline = useMemo(() => {
    if (!multiRefEnabled) return null;

    // ✅ P0（定位）：badge render 前先看 refs 到底長什麼樣（key / displayText）
    // - 只 log 一次/每個 wordKey，避免洗版
    try {
      const __once = __p0RefFlowLogOnce.current && __p0RefFlowLogOnce.current.badgeRender;
      if (__once && !__once[wordKey]) {
        __once[wordKey] = true;
        console.log("[P0][badgeRender]", {
          wordKey,
          refs: (Array.isArray(refs) ? refs : []).map((r) => ({
            key: r?.key,
            displayText: r?.displayText,
            rawInput: r?.rawInput,
            kind: r?.kind,
            typeofKey: typeof r?.key,
          })),
        });
      }
    } catch (_) {}

    return (
      <>
        {/* ✅ Step B-0-1：refs badges 固定顯示（例句/lemma 旁邊） */}
        {refs.length > 0 && (
          <div
            data-ref="exampleRefBadgesInline"
            style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
          >
            {refs.map((r, idx) => {
              const key = r?.key || r?.displayText || "";
              const isUsed = safeUsedRefs.includes(key);
              const isMissing = safeMissingRefs.includes(key);

              // ✅ 狀態呈現策略（不放 ✅/⚠️，只用變色）
              // - showRefStatus=true 才反映 used/missing 的色彩狀態
              // - showRefStatus=false（尚未 refresh/尚未回傳）時，維持 idle 視覺
              let __st = refBadgeStatusStyles.idle;
              if (showRefStatus && isMissing) __st = refBadgeStatusStyles.missing;
              if (showRefStatus && !isMissing && isUsed) __st = refBadgeStatusStyles.used;

              const badgeStyle = {
                ...refBadgeBaseStyle,
                border: __st.border,
                background: __st.background,
                color: __st.color,
                opacity: __st.opacity,
              };

              return (
                <span
                  key={`inline-${key}-${idx}`}
                  style={badgeStyle}
                  title={showRefStatus ? (isMissing ? tRefStatusMissing : isUsed ? tRefStatusUsed : "") : ""}
                >
                  <span>{`+ ${key}`}</span>

                  <button
                    type="button"
                    onClick={() => handleRemoveRefAt(idx)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: 0,
                      lineHeight: 1,
                      opacity: 0.75,
                    }}
                    aria-label="remove-ref"
                    title="remove"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </>
    );
  }, [
    multiRefEnabled,
    wordKey,
    refs,
    safeUsedRefs,
    safeMissingRefs,
    showRefStatus,
    refBadgeBaseStyle,
    refBadgeStatusStyles,
    handleRemoveRefAt,
    tRefStatusUsed,
    tRefStatusMissing,
  ]);

  const refActionInline = useMemo(() => {
    if (!multiRefEnabled) return null;

    // ✅ Phase 2-UX（Step B-0-0）：DEPRECATED 開關（保留原本 popup 內 badges 的 render，預設不顯示）
    // - 需求變更：refs badges 改為固定顯示在 header（例句/lemma）旁邊，而不是放在 popup 內
    // - 保留舊碼：避免之後需要回復或比對；若要回復，將此值改為 true
    const __deprecatedShowBadgesInPopup = false;

    // ✅ DEPRECATED 2026/01/10: inline hints next to the action button removed (UI request)
    // - 保留原邏輯：若未來要恢復顯示，把這個開關改回 true
    const __deprecatedShowInlineActionHints = false;

    return (
      <>
        {/* ✅ Step B-0：新增按鈕（toggle ON 才出現） */}
        <button
          type="button"
          ref={addRefButtonAnchorRef}
          onClick={() => {
            setAddRefPopupOpenByWordKey((prev) => ({
              ...prev,
              [wordKey]: true,
            }));

            // ✅ 可控 debug：只在開 flag 才 log（Production 排查）
            try {
              const __dbgFlag =
                (import.meta && import.meta.env && import.meta.env.VITE_DEBUG_EXAMPLES_REFS) || "";
              if (__dbgFlag === "1") {
                console.log("[WordExampleBlock][addRefPopup] open", {
                  wordKey,
                });
              }
            } catch (e) {}
          }}
          style={addRefButtonStyle}
          // ✅ 多國：「新增」按鈕文案（fallback: 新增）
          // DEPRECATED 2026/01/10: old fallback "not available" kept below for reference
          // title={__t("exampleBlock.addRefButtonTooltip", "not available") || "not available"}
          // aria-label={__t("exampleBlock.addRefButtonAria", "not available") || "not available"}
          title={__t("exampleBlock.addRefButtonTooltip", "exampleBlock.addRefButtonTooltip") || ""}
          aria-label={__t("exampleBlock.addRefButtonAria", "exampleBlock.addRefButtonAria") || ""}
        >
          {/* DEPRECATED 2026/01/10: old fallback "not available" kept below for reference */}
          {/* {__t("exampleBlock.addRefButtonLabel", "not available") || "not available"} */}
          {__t("exampleBlock.addRefButtonLabel", "exampleBlock.addRefButtonLabel") || ""}
        </button>

        {/* ✅ Step B-0：小視窗（只有點「新增」才顯示） */}
        {isAddRefPopupOpen && (
          <>
            {/* backdrop：點擊外側關閉 */}
            <div
              data-ref="exampleRefBackdrop"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAddRefPopupOpenByWordKey((prev) => ({
                  ...prev,
                  [wordKey]: false,
                }));
              }}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9998,
                background: "rgba(0,0,0,0.001)",
              }}
            />

            {/* popup panel：依新增按鈕定位（上緣貼齊 + clamp 避免被截） */}
            <div
              data-ref="exampleRefPopup"
              style={{
                position: "fixed",
                top: addRefPopupPos.top,
                left: addRefPopupPos.left,
                zIndex: 9999,
                padding: 12,
                borderRadius: 12,
                minWidth: 360,
                maxWidth: "min(90vw, 720px)",
                background: "var(--panel-bg, rgba(255, 255, 255, 0.98))",
                border: "1px solid rgba(0,0,0,0.12)",
                boxShadow: "rgba(0,0,0,0.14) 0px 10px 28px",
                overflow: "visible",
              }}
              onMouseDown={(e) => {
                // ✅ 阻擋事件往上（避免外層 listener 誤判）
                e.stopPropagation();
              }}
            >
              <div
                style={{
                  marginTop: 2,
                  marginBottom: 2,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  ref={addRefInputRef}
                  data-ref="exampleRefPopupInput"
                  type="text"
                  value={refInput}
                  placeholder={tRefPlaceholder}
                  onChange={(e) => {
                    // ✅ Phase 2-UX（Step A-5）：輸入變更就清掉錯誤（避免卡住）
                    setRefErrorByWordKey((prev) => ({
                      ...prev,
                      [wordKey]: "",
                    }));

                    setRefInputByWordKey((prev) => ({
                      ...prev,
                      [wordKey]: e.target.value,
                    }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddRef();
                  }}
                  style={refInputStyle}
                />

                <button type="button" onClick={handleAddRef} style={addRefBtnStyle}>
                  {tAddRefBtn}
                </button>

                {/* ✅ Phase 2-UX（Step A-5）：ref 輸入錯誤提示（只在有錯誤時顯示） */}
                {!!refError && <span style={refErrorStyle}>{refError}</span>}

                {/* DEPRECATED 2026/01/09: refs badges in popup kept for rollback; now rendered inline next to header */}
                {/* refs badges + 狀態 */}
                {__deprecatedShowBadgesInPopup && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {refs.map((r, idx) => {
                      const key = r?.key || r?.displayText || "";
                      const isUsed = safeUsedRefs.includes(key);
                      const isMissing = safeMissingRefs.includes(key);

                      // ✅ 狀態呈現策略（不放 ✅/⚠️，只用變色）
                      // - showRefStatus=true 才反映 used/missing 的色彩狀態
                      // - showRefStatus=false（尚未 refresh/尚未回傳）時，維持 idle 視覺
                      let __st = refBadgeStatusStyles.idle;
                      if (showRefStatus && isMissing) __st = refBadgeStatusStyles.missing;
                      if (showRefStatus && !isMissing && isUsed) __st = refBadgeStatusStyles.used;

                      const badgeStyle = {
                        ...refBadgeBaseStyle,
                        border: __st.border,
                        background: __st.background,
                        color: __st.color,
                        opacity: __st.opacity,
                      };

                      return (
                        <span
                          key={`${key}-${idx}`}
                          style={badgeStyle}
                          title={showRefStatus ? (isMissing ? tRefStatusMissing : isUsed ? tRefStatusUsed : "") : ""}
                        >
                          <span>{key}</span>

                          <button
                            type="button"
                            onClick={() => handleRemoveRefAt(idx)}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: 11, // ✅ icon 更小
                              padding: 0,
                              lineHeight: 1,
                              opacity: 0.75,
                            }}
                            aria-label="remove-ref"
                            title="remove"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* missing 提示 */}
                {showRefStatus && safeMissingRefs.length > 0 && (
                  <span style={{ fontSize: 12, opacity: 0.85 }}>
                    {tMissingRefsHint}
                  </span>
                )}

                {/* dirty 提示 */}
                {dirty && (
                  <span style={{ fontSize: 12, opacity: 0.85 }}>
                    {tDirtyHint}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* ✅ missing refs 提示（popup 未開啟時也要顯示在 controls 區） */}
        {/* 中文說明：原本這些提示是在 refControls 容器內；拆 slot 後將其視為 action 區的一部分 */}
        {/* ✅ DEPRECATED 2026/01/10: inline hints removed (keep logic, default hidden) */}
        {__deprecatedShowInlineActionHints && showRefStatus && safeMissingRefs.length > 0 && (
          <span style={{ fontSize: 12, opacity: 0.85 }}>
            {tMissingRefsHint}
          </span>
        )}

        {__deprecatedShowInlineActionHints && dirty && (
          <span style={{ fontSize: 12, opacity: 0.85 }}>
            {tDirtyHint}
          </span>
        )}
      </>
    );
  }, [
    multiRefEnabled,
    isAddRefPopupOpen,
    refInput,
    tRefPlaceholder,
    wordKey,
    handleAddRef,
    refInputStyle,
    addRefButtonStyle,
    addRefBtnStyle,
    refs,
    safeUsedRefs,
    safeMissingRefs,
    showRefStatus,
    handleRemoveRefAt,
    isEn,
    isJa,
    tDirtyHint,
    setRefInputByWordKey,
    refBadgeBaseStyle,
    refBadgeStatusStyles,
    refError,
    refErrorStyle,
    setRefErrorByWordKey,
    tMissingRefsHint,
    tRefStatusUsed,
    tRefStatusMissing,
    dirty,
    __t,
    addRefPopupPos,

    // ✅ Step B-0（Focus）新增依賴：ref 本身不需要放依賴，但保留註解避免被誤刪
    // addRefInputRef,
  ]);

  const refControls = useMemo(() => {
    if (!multiRefEnabled) return null;

    // ✅ Phase 2-UX（Step B-0-0）：DEPRECATED 開關（保留原本 popup 內 badges 的 render，預設不顯示）
    // - 需求變更：refs badges 改為固定顯示在 header（例句/lemma）旁邊，而不是放在 popup 內
    // - 保留舊碼：避免之後需要回復或比對；若要回復，將此值改為 true
    const __deprecatedShowBadgesInPopup = false;

    return (
      <div
        // ✅ Phase 2-UX（Step B-0）：加入 container ref（Production 排查）
        ref={addRefPopupContainerRef}
        style={{
          position: "relative",
          marginTop: 2,
          marginBottom: 2,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between", // ✅ 左 badges / 右 action 分開
          width: "100%", // ✅ 讓 space-between 生效
        }}
      >
        {/* ✅ NEW 2026/01/10: refControls 現在只負責「組合 slot」以維持既有 UI/行為 */}
        {/* ✅ NEW 2026/01/10: 拆成左右兩個 div，讓 badges 與「新增」按鈕不要綁在同一個 div（UI 排版需求） */}
        <div
          data-ref="exampleRefInlineLeft"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            flex: "1 1 auto",
            minWidth: 220,
          }}
        >
          {refBadgesInline}
        </div>


        {/* ✅ 2026-01-10: exampleRefInlineRight（action 區）已準備改為「放到 toggle 之後」呈現
            - 目標：toggle 在左，action（確認/新增 popup）貼在右
            - 做法：refActionInline 會另外以 props 往下傳（refConfirm / refActionInline），由 ExampleSentence 的 toggle row 右側渲染
            - 這裡保留舊 render（deprecated）方便回溯，但預設不顯示，避免 UI 重複
        */}
        {(() => {
          // ✅ Phase 2-UX：Action（確認按鈕）已改由 ExampleSentence 的 toggle row（refConfirm slot）負責呈現
          // - 這裡保留舊邏輯作為回溯參考（deprecated），但預設關閉，避免『確認』出現在下一行（Example/badge 那行）
          // const __DEPRECATED_SHOW_ACTION_INLINE_IN_REFCONTROLS = !!multiRefEnabled; // deprecated
          const __DEPRECATED_SHOW_ACTION_INLINE_IN_REFCONTROLS = false;
          if (!__DEPRECATED_SHOW_ACTION_INLINE_IN_REFCONTROLS) return null;
          return (


        <div
          data-ref="exampleRefInlineRight"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            flex: "0 0 auto",
            justifyContent: "flex-end",
            position: "relative", // ✅ 讓 popup 以右側 action 區塊定位（避免跑到整行最右）
          }}
        >
          {refActionInline}
        </div>

          );
        })()}

        {/* DEPRECATED 2026/01/10: 下面這段是「拆分前的原始 JSX」，保留以便回溯（不再渲染） */}
        {/*
        {refs.length > 0 && (
          <div
            data-ref="exampleRefBadgesInline"
            style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
          >
            {refs.map((r, idx) => {
              const key = r?.key || r?.displayText || "";
              const isUsed = safeUsedRefs.includes(key);
              const isMissing = safeMissingRefs.includes(key);

              let __st = refBadgeStatusStyles.idle;
              if (showRefStatus && isMissing) __st = refBadgeStatusStyles.missing;
              if (showRefStatus && !isMissing && isUsed) __st = refBadgeStatusStyles.used;

              const badgeStyle = {
                ...refBadgeBaseStyle,
                border: __st.border,
                background: __st.background,
                color: __st.color,
                opacity: __st.opacity,
              };

              return (
                <span
                  key={`inline-${key}-${idx}`}
                  style={badgeStyle}
                  title={showRefStatus ? (isMissing ? tRefStatusMissing : isUsed ? tRefStatusUsed : "") : ""}
                >
                  <span>{`+ ${key}`}</span>

                  <button
                    type="button"
                    onClick={() => handleRemoveRefAt(idx)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: 0,
                      lineHeight: 1,
                      opacity: 0.75,
                    }}
                    aria-label="remove-ref"
                    title="remove"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setAddRefPopupOpenByWordKey((prev) => ({
              ...prev,
              [wordKey]: true,
            }));

            try {
              const __dbgFlag =
                (import.meta && import.meta.env && import.meta.env.VITE_DEBUG_EXAMPLES_REFS) || "";
              if (__dbgFlag === "1") {
                console.log("[WordExampleBlock][addRefPopup] open", {
                  wordKey,
                });
              }
            } catch (e) {}
          }}
          style={addRefButtonStyle}
          // ✅ 多國：確認按鈕（fallback 以中文顯示）
          title={__t("exampleBlock.addRefButtonTooltip", "exampleBlock.addRefButtonTooltip") || ""}
          aria-label={__t("exampleBlock.addRefButtonAria", "exampleBlock.addRefButtonAria") || ""}
        >
          {__t("exampleBlock.addRefButtonLabel", "exampleBlock.addRefButtonLabel") || ""}
        </button>

        {isAddRefPopupOpen && (
          <>
            <div
              data-ref="exampleRefBackdrop"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAddRefPopupOpenByWordKey((prev) => ({
                  ...prev,
                  [wordKey]: false,
                }));
              }}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9998,
                background: "rgba(0,0,0,0.001)",
              }}
            />

            <div
              data-ref="exampleRefPopup"
              style={{
                position: "absolute",
                top: -6,
                right: 0,
                zIndex: 9999,
                padding: 12,
                borderRadius: 12,
                minWidth: 360,
                maxWidth: 720,
                background: "var(--panel-bg, rgba(255, 255, 255, 0.98))",
                border: "1px solid rgba(0,0,0,0.12)",
                boxShadow: "rgba(0,0,0,0.14) 0px 10px 28px",
                overflow: "visible",
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
            >
              <div
                style={{
                  marginTop: 2,
                  marginBottom: 2,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="text"
                  value={refInput}
                  placeholder={tRefPlaceholder}
                  onChange={(e) => {
                    setRefErrorByWordKey((prev) => ({
                      ...prev,
                      [wordKey]: "",
                    }));

                    setRefInputByWordKey((prev) => ({
                      ...prev,
                      [wordKey]: e.target.value,
                    }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddRef();
                  }}
                  style={refInputStyle}
                />

                <button type="button" onClick={handleAddRef} style={addRefBtnStyle}>
                  {tAddRefBtn}
                </button>

                {!!refError && <span style={refErrorStyle}>{refError}</span>}

                {__deprecatedShowBadgesInPopup && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {refs.map((r, idx) => {
                      const key = r?.key || r?.displayText || "";
                      const isUsed = safeUsedRefs.includes(key);
                      const isMissing = safeMissingRefs.includes(key);

                      let __st = refBadgeStatusStyles.idle;
                      if (showRefStatus && isMissing) __st = refBadgeStatusStyles.missing;
                      if (showRefStatus && !isMissing && isUsed) __st = refBadgeStatusStyles.used;

                      const badgeStyle = {
                        ...refBadgeBaseStyle,
                        border: __st.border,
                        background: __st.background,
                        color: __st.color,
                        opacity: __st.opacity,
                      };

                      return (
                        <span
                          key={`${key}-${idx}`}
                          style={badgeStyle}
                          title={showRefStatus ? (isMissing ? tRefStatusMissing : isUsed ? tRefStatusUsed : "") : ""}
                        >
                          <span>{key}</span>

                          <button
                            type="button"
                            onClick={() => handleRemoveRefAt(idx)}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: 11,
                              padding: 0,
                              lineHeight: 1,
                              opacity: 0.75,
                            }}
                            aria-label="remove-ref"
                            title="remove"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {showRefStatus && safeMissingRefs.length > 0 && (
                  <span style={{ fontSize: 12, opacity: 0.85 }}>
                    {tMissingRefsHint}
                  </span>
                )}

                {dirty && (
                  <span style={{ fontSize: 12, opacity: 0.85 }}>
                    {tDirtyHint}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
        */}
      </div>
    );
  }, [
    multiRefEnabled,
    addRefPopupContainerRef,
    refBadgesInline,
    refActionInline,

    // 原依賴保留（不刪），避免你未來要回溯 old block 時找不到
    isAddRefPopupOpen,
    refInput,
    tRefPlaceholder,
    wordKey,
    handleAddRef,
    refInputStyle,
    addRefButtonStyle,
    addRefBtnStyle,
    refs,
    safeUsedRefs,
    safeMissingRefs,
    showRefStatus,
    handleRemoveRefAt,
    isEn,
    isJa,
    tDirtyHint,
    setRefInputByWordKey,
    refBadgeBaseStyle,
    refBadgeStatusStyles,
    refError,
    refErrorStyle,
    setRefErrorByWordKey,
    tMissingRefsHint,
    tRefStatusUsed,
    tRefStatusMissing,
    dirty,
    __t,
  ]);


  // =========================
  // Phase 2-UX（Step B-1）：toggle ON 才顯示「新增/refs 控制區」
  // 中文功能說明：
  // - 使用者選擇方案 2：只有 multiRefEnabled=true 時，才把 refControls/refBadgesInline/refActionInline 往下傳
  // - 目的：讓切換 toggle 能直接控制「新增」按鈕與 refs 控制區是否出現（不改查詢規則）
  // - 注意：此 gate 只影響 UI 顯示，不改 refs 資料、不改 refresh 規則
  // =========================
  const refControlsForExampleList = useMemo(() => {
    return multiRefEnabled ? refControls : null;
  }, [multiRefEnabled, refControls]);

  const refBadgesInlineForExampleList = useMemo(() => {
    return multiRefEnabled ? refBadgesInline : null;
  }, [multiRefEnabled, refBadgesInline]);

  const refActionInlineForExampleList = useMemo(() => {
    return multiRefEnabled ? refActionInline : null;
  }, [multiRefEnabled, refActionInline]);

  // ✅ NOTE 2026/01/10: ExampleSentence 的 toggle row 目前是用 refConfirm slot 來渲染「toggle 右側的按鈕」。
  // - 需求：toggle 右側要顯示「新增」(開啟 addRef popup)，因此這裡把 refActionInline（新增+popup）接到 refConfirm。
  const refConfirmForExampleList = useMemo(() => {
    return multiRefEnabled ? refActionInline : null;
  }, [multiRefEnabled, refActionInline]);

  const injectedPlural =
    typeof (d?.plural || d?.pluralForm || d?.nounPlural || d?.pluralBaseForm) ===
    "string"
      ? (d.plural || d.pluralForm || d.nounPlural || d.pluralBaseForm).trim()
      : "";

  return (
    <div style={{ marginTop: 20 }}>
{/* ===== Multi-ref 控制列 ===== */}
      {/* deprecated: Phase 2-UX（Step A-2）後，refs 控制區塊改由 refControls 下移到例句區塊內；
          這個區塊保留原碼避免回溯困難，但不再顯示（避免 UI 重複/突兀）。 */}
      <div style={{ marginTop: 8, marginBottom: 10, display: "none", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {/* ✅ 新 UI：toggle button（亮/暗皆可見） */}
        <button
          type="button"
          onClick={handleToggleMultiRefButton}
          aria-pressed={multiRefEnabled ? "true" : "false"}
          title={tMultiRefHint}
          style={multiRefToggleBtnStyle}
        >
          <span>{tMultiRefLabel}</span>
          <span style={multiRefToggleDotStyle} />
        </button>

        <span style={multiRefHintStyle}>{tMultiRefHint}</span>

        {/* ✅ 保留舊 checkbox（deprecated），避免回溯時找不到來源；同時不再顯示以免突兀 */}
        {/* deprecated: 原本 checkbox UI 風格不協調，改用 toggle button 呈現；行為仍由 handleToggleMultiRef 控制 */}
        <label style={{ display: "none", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={multiRefEnabled}
            onChange={(e) => handleToggleMultiRef(e.target.checked)}
          />
          <span>{tMultiRefLabel}</span>
        </label>

        {multiRefEnabled && (
          <>
            <input
              type="text"
              value={refInput}
              placeholder={tRefPlaceholder}
              onChange={(e) =>
                setRefInputByWordKey((prev) => ({
                  ...prev,
                  [wordKey]: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddRef();
              }}
              style={refInputStyle}
            />
            <button type="button" onClick={handleAddRef} style={addRefBtnStyle}>
              {tAddRefBtn}
            </button>

            {/* refs badges + 狀態（deprecated：不顯示 icon，保持一致） */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {refs.map((r, idx) => {
                const key = r?.key || r?.displayText || "";
                const isUsed = safeUsedRefs.includes(key);
                const isMissing = safeMissingRefs.includes(key);

                let __st = refBadgeStatusStyles.idle;
                if (showRefStatus && isMissing) __st = refBadgeStatusStyles.missing;
                if (showRefStatus && !isMissing && isUsed) __st = refBadgeStatusStyles.used;

                const badgeStyle = {
                  ...refBadgeBaseStyle,
                  border: __st.border,
                  background: __st.background,
                  color: __st.color,
                  opacity: __st.opacity,
                };

                return (
                  <span
                    key={`${key}-${idx}`}
                    style={badgeStyle}
                    title={showRefStatus ? (isMissing ? tRefStatusMissing : isUsed ? tRefStatusUsed : "") : ""}
                  >
                    <span>{key}</span>

                    <button
                      type="button"
                      onClick={() => handleRemoveRefAt(idx)}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 11,
                        padding: 0,
                        lineHeight: 1,
                        opacity: 0.75,
                      }}
                      aria-label="remove-ref"
                      title="remove"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>

            {/* missing 提示 */}
            {showRefStatus && safeMissingRefs.length > 0 && (
              <span style={{ fontSize: 12, opacity: 0.85 }}>
                {tMissingRefsHint}
              </span>
            )}

            {dirty && (
              <span style={{ fontSize: 12, opacity: 0.85 }}>
                {tDirtyHint}
              </span>
            )}

            {sentenceTypeDirty && (
              <span style={{ fontSize: 12, opacity: 0.85, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span>{tSentenceTypeDirtyHint}</span>
                <button
                  type="button"
                  onClick={handleSentenceTypeRegenerate}
                  style={{
                    border: "1px solid var(--border-subtle)",
                    background: "transparent",
                    color: "inherit",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {tSentenceTypeRegenerateBtn}
                </button>
              </span>
            )}
          </>
        )}
      </div>

      

      <ExampleList
        examples={Array.isArray(examples) ? examples : []}
        loading={loading}
        sectionExample={sectionExample}
        sectionExampleTranslation={sectionExampleTranslation}
        exampleTranslation={effectiveExampleTranslation}
        onSpeak={handleSpeak}
        onRefresh={handleManualRefresh}
        refreshTooltip={tRefreshTooltip}
        onWordClick={onWordClick}
        explainLang={explainLang}
        conversationTitle={conversationTitleLabel}
        conversationToggleTooltip={conversationToggleTooltipLabel}
        conversationTurnLabel={conversationTurnLabel}
        conversationNextLabel={conversationNextLabel}
        conversationPlayLabel={conversationPlayLabel}
        conversationCloseLabel={conversationCloseLabel}
        conversationLoadingLabel={conversationLoadingLabel}

        // ✅ Phase 2-UX（Step A-6）：例句標題顯示 headword（銳角外方匡）
        headword={headwordForExampleTitle}

        // ✅ 2026-01-27：參考形式提示（ⓘ hover）
        headwordRefHint={tHeadwordRefHint}

        // ✅ SentenceType（句型）— UI 移到 ExampleSentence header（headword badge 右側）
        sentenceTypeLabel={tSentenceTypeLabel}
        sentenceType={sentenceType}
        sentenceTypeOptions={sentenceTypeOptions}
        onSentenceTypeChange={handleSentenceTypeChange}
        sentenceTypeDirty={sentenceTypeDirty}
        sentenceTypeDirtyHint={tSentenceTypeDirtyHint}
        sentenceTypeRegenerateLabel={tSentenceTypeRegenerateBtn}
        onSentenceTypeRegenerate={handleSentenceTypeRegenerate}


        // ✅ Phase 2-UX（Step A-1）：轉傳到 ExampleSentence（例句標題列）用的 multiRef toggle props
        // - 這裡只提供資料/事件，不改現有 UI；ExampleSentence 若尚未接，這些 props 也不會影響任何行為
        multiRefEnabled={multiRefEnabled}
        onToggleMultiRef={onToggleMultiRefForExampleHeader}
        multiRefToggleLabel={tMultiRefLabel}
        multiRefToggleHint={tMultiRefHint}

        // ✅ Phase 2-UX（Step A-2）：refs 控制區塊插槽（ExampleSentence 下方）
        refControls={refControlsForExampleList}

        // ✅ 2026-01-10: 讓 action 區（確認/新增 popup）可移到 toggle 後方（由下游元件決定如何 render）
        // - 目前保持向後相容：refControls 仍存在（badges 為主）
        // - 新增兩個 slot：refBadgesInline / refActionInline
        // - 同時提供 refConfirm（與 ExampleSentence 的命名一致）
        refBadgesInline={refBadgesInlineForExampleList}
        refActionInline={refActionInlineForExampleList}
        refConfirm={refConfirmForExampleList}

        onPronunciationAudioReady={handlePronunciationAudioReady}

      />

      {/* ===== POS 補充資訊（放在例句下方 + 可收合） ===== */}
      {d && (d.baseForm || d.word) && (() => {
        // ✅ i18n：詞性補充標題（統一走 __t；抓不到就顯示 "----"）
        const __posInfoTitle = __t("posInfoTitle", "----");


        const __arrow = posInfoCollapsed ? "▶" : "▼";

        return (
          <div
            style={{
              marginTop: 14,
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-2)",
              color: "var(--text)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setPosInfoCollapsed((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 8,
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
              aria-expanded={!posInfoCollapsed}
            >
              <span style={{ fontWeight: 700, fontSize: 13, lineHeight: "16px" }}>
                {__arrow} {__posInfoTitle}
              </span>
            </button>

            {!posInfoCollapsed && (
              <div style={{ padding: "0 12px 12px 12px" }}>
                <WordPosInfo
                  partOfSpeech={d.partOfSpeech}
                  queryWord={d.word}
                  baseForm={d.baseForm || d.word}
                  gender={d.gender}
                  uiLabels={{}}
                  extraInfo={{ plural: injectedPlural, dictionary: d, query, queryHints, hints: queryHints, headword, rawInput, normalizedQuery }}
                  type={d.type}
                  uiLang={uiLang}
                  onSelectForm={setSelectedForm}
                  onEntrySurfaceChange={onEntrySurfaceChange}
                  onWordClick={onWordClick}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== 建議字（與「詞性補充」同層級 + 可收合 + localStorage 記憶） ===== */}
      {d && (d.baseForm || d.word) && (() => {
        const rec = (d && d.recommendations && typeof d.recommendations === "object") ? d.recommendations : {};
        const getArr = (v) => (Array.isArray(v) ? v : []);

        const groups = [
          { key: "sameWord", label: __t("exampleBlock.recs.sameWord", "同字"), items: getArr(rec.sameWord) },
          { key: "synonyms", label: __t("exampleBlock.recs.synonyms", "同義"), items: getArr(rec.synonyms) },
          { key: "antonyms", label: __t("exampleBlock.recs.antonyms", "反義"), items: getArr(rec.antonyms) },
          { key: "related", label: __t("exampleBlock.recs.related", "相關"), items: getArr(rec.related) },
          { key: "wordFamily", label: __t("exampleBlock.recs.wordFamily", "同詞根家族"), items: getArr(rec.wordFamily) },
          { key: "roots", label: __t("exampleBlock.recs.roots", "同詞根"), items: getArr(rec.roots) },
          { key: "collocations", label: __t("exampleBlock.recs.collocations", "常用搭配"), items: getArr(rec.collocations) },
        ].filter((g) => g.items.length > 0);

        // 沒任何建議字：不顯示此區塊（避免空卡片干擾）
        if (groups.length === 0) return null;

        const __recsTitle = __t("exampleBlock.recsTitle", "建議字");
        const __arrow = recsCollapsed ? "▶" : "▼";

        const onClickWord = (w) => {
          const word = (w || "").toString().trim();
          if (!word) return;
          try {
            if (typeof onWordClick === "function") {
              onWordClick(word);
              return;
            }
          } catch (e) {}
          try {
            window.dispatchEvent(new CustomEvent("wordSearch", { detail: { text: word, reason: "recommendations" } }));
          } catch (e) {}
        };

        const Chip = ({ text }) => (
          <button
            type="button"
            onClick={() => onClickWord(text)}
            style={{
              border: "1px solid var(--border-subtle)",
              background: "var(--surface)",
              color: "var(--text)",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 12,
              lineHeight: "14px",
              cursor: "pointer",
            }}
          >
            {text}
          </button>
        );

        return (
          <div
            style={{
              marginTop: 10,
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-2)",
              color: "var(--text)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setRecsCollapsed((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 8,
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
              aria-expanded={!recsCollapsed}
            >
              <span style={{ fontWeight: 700, fontSize: 13, lineHeight: "16px" }}>
                {__arrow} {__recsTitle}
              </span>
            </button>

            {!recsCollapsed && (
              <div style={{ padding: "0 12px 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                {groups.map((g) => (
                  <div key={g.key}>
                    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, marginBottom: 6 }}>
                      {g.label}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {g.items.map((it, idx) => (
                        <Chip key={`${g.key}-${idx}`} text={String(it)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
</div>
  );
}
// __pad_keep_linecount_1
// frontend/src/components/examples/WordExampleBlock.jsx
// END FILE: frontend/src/components/examples/WordExampleBlock.jsx
// __pad_keep_linecount_posinfo
// __pad_keep_linecount_posinfo

// frontend/src/components/examples/WordExampleBlock.jsx