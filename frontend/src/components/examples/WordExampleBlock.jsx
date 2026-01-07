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
 */

import React, { useCallback, useState, useMemo } from "react";
import { callTTS } from "../../utils/ttsClient";

// ✅ i18n：共用文字統一由 uiText 處理（逐步補齊 key；未補齊則 fallback 到既有 hardcode，避免功能中斷）
import uiText from "../../uiText";

import ExampleList from "./ExampleList";
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
}) {

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

  // ✅ 新增：多重參考（前端保存，per wordKey；不進 DB）
  const wordKey = useMemo(() => {
    const w = (d?.word || d?.baseForm || "").toString();
    const si = typeof senseIndex === "number" ? senseIndex : String(senseIndex || "");
    const lang = (explainLang || "").toString();
    return `${w}::${si}::${lang}`;
  }, [d, senseIndex, explainLang]);

  const [multiRefEnabledByWordKey, setMultiRefEnabledByWordKey] = useState({});
  const [refsByWordKey, setRefsByWordKey] = useState({});
  const [dirtyByWordKey, setDirtyByWordKey] = useState({});
  const [refInputByWordKey, setRefInputByWordKey] = useState({});

  // ✅ Phase 2-UX（Step A-5）：ref 輸入錯誤狀態（UI 檢核用；不影響資料流）
  const [refErrorByWordKey, setRefErrorByWordKey] = useState({});

  const multiRefEnabled = !!multiRefEnabledByWordKey[wordKey];
  const refs = Array.isArray(refsByWordKey[wordKey]) ? refsByWordKey[wordKey] : [];
  const dirty = !!dirtyByWordKey[wordKey];
  const refInput = typeof refInputByWordKey[wordKey] === "string" ? refInputByWordKey[wordKey] : "";

  // ✅ UI 檢核訊息
  const refError = typeof refErrorByWordKey[wordKey] === "string" ? refErrorByWordKey[wordKey] : "";

  const isZh = explainLang?.startsWith("zh");
  const isEn = explainLang?.startsWith("en");
  const isJa = explainLang?.startsWith("ja");

  // =========================
  // i18n：共用文字統一由 uiText 處理
  // - 原則：優先讀 uiText；未補齊 key 時 fallback 回既有 hardcode（避免中斷）
  // - 下一階段：補齊 uiText[uiLang].wordCard.exampleBlock.* 對應 key
  // =========================
  const __ui = (uiText && uiLang && uiText[uiLang]) || (uiText && uiText["zh-TW"]) || {};
  const __uiFallback = (uiText && uiText["zh-TW"]) || {};
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
  // - 取字順序：uiText[uiLang] -> uiText["zh-TW"] -> hardFallback（最後保底，避免空字串造成 UI 斷裂）
  // - key 規則：
  //   - wordCard.* 直接用 "refreshExamplesTooltipLabel"
  //   - exampleBlock.* 用 "exampleBlock.multiRefLabel"（映射到 wordCard.exampleBlock.multiRefLabel）
  const __t = useCallback(
    (key, hardFallback) => {
      if (typeof key !== "string" || !key) return hardFallback || "";

      const parts = key.split(".");
      const k0 = parts[0];
      const k1 = parts[1];

      let v = "";

      // exampleBlock.*
      if (k0 === "exampleBlock" && k1) {
        v =
          (__tExampleBlock && __tExampleBlock[k1]) ||
          (__tExampleBlockFallback && __tExampleBlockFallback[k1]) ||
          "";
      } else {
        // wordCard.*
        v =
          (__tWordCard && __tWordCard[key]) ||
          (__tWordCardFallback && __tWordCardFallback[key]) ||
          "";
      }

      if (typeof v === "string" && v.trim()) return v;
      return hardFallback || "";
    },
    [__tWordCard, __tExampleBlock, __tWordCardFallback, __tExampleBlockFallback]
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
      : "新增參考（名詞/動詞/文法）..."
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
      : "參考已變更，按重新產生才會套用"
  );

  // ✅ 新增：toggle button 旁的短說明（亮暗版也可讀）
  const tMultiRefHint = __pickText(
    __tExampleBlock.multiRefHint,
    isEn
      ? "Use multiple refs for examples"
      : isJa
      ? "複数の参照で例文を生成"
      : "使用多個參考點產生例句"
  );

  // ✅ Phase 2-UX（Step A-5）：ref 不合理輸入提示
  const tRefInvalidHint = __pickText(
    __tExampleBlock.refInvalidHint,
    isEn
      ? "Invalid reference (e.g., 'xxx' / '...' / '…')."
      : isJa
      ? "不正な参照です（例：'xxx' / '...' / '…'）。"
      : "不合理的參考（例如：xxx / ... / …），已阻擋加入"
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
      : "有參考未被使用，請再重新產生"
  );
  */

  // ✅ 現行 i18n：只透過 uiText 取字（uiLang -> zh-TW -> hardFallback）
  const tRefreshTooltip = __t(
    "refreshExamplesTooltipLabel",
    refreshExamplesTooltipLabel || "重新產生例句"
  );

  const tMultiRefLabel = __t("exampleBlock.multiRefLabel", "多重參考");

  const tRefPlaceholder = __t(
    "exampleBlock.refPlaceholder",
    "新增參考（名詞/動詞/文法）..."
  );

  const tAddRefBtn = __t("exampleBlock.addRefBtn", "加入");

  const tDirtyHint = __t(
    "exampleBlock.refsDirtyHint",
    "參考已變更，按重新產生才會套用"
  );

  // ✅ 新增：toggle button 旁的短說明（亮暗版也可讀）
  const tMultiRefHint = __t(
    "exampleBlock.multiRefHint",
    "使用多個參考點產生例句"
  );

  // ✅ Phase 2-UX（Step A-5）：ref 不合理輸入提示
  const tRefInvalidHint = __t(
    "exampleBlock.refInvalidHint",
    "不合理的參考（例如：xxx / ... / …），已阻擋加入"
  );

  // ✅ refs badge 狀態提示文字（used/missing）
  const tRefStatusUsed = __t("exampleBlock.refStatusUsed", "已使用");
  const tRefStatusMissing = __t("exampleBlock.refStatusMissing", "缺少");

  // ✅ missing refs 提示
  const tMissingRefsHint = __t(
    "exampleBlock.missingRefsHint",
    "有參考未被使用，請再重新產生"
  );

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
    multiRefEnabled,
    refs,
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

  const effectiveExampleTranslation =
    generatedTranslation || exampleTranslation || "";

  async function handleSpeak(sentence) {
    try {
      if (!sentence) return;
      const audioBase64 = await callTTS(sentence, "de-DE");
      const audio = new Audio(audioBase64);
      audio.play();
    } catch (err) {
      console.error("[TTS 播放失敗]", err);
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

  const handleAddRef = useCallback(() => {
    // ✅ Phase 2-UX（Step A-5）：先做 UI 檢核，擋掉 placeholder refs（xxx/.../…）
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
        const __dbgFlag = (import.meta && import.meta.env && import.meta.env.VITE_DEBUG_EXAMPLES_REFS) || "";
        if (__dbgFlag === "1") {
          console.warn("[WordExampleBlock][ref-validate] blocked", { wordKey, text });
        }
      } catch (e) {}

      return;
    }

    // ✅ 通過檢核：清掉錯誤
    setRefErrorByWordKey((prev) => ({
      ...prev,
      [wordKey]: "",
    }));

    setRefsByWordKey((prev) => {
      const cur = Array.isArray(prev[wordKey]) ? prev[wordKey] : [];

      // ✅ 去重（同 key 不重複加入）：不改資料結構，只在 UI prevent duplication
      // - 注意：不刪除舊邏輯，只是避免 UI 重複輸入造成混亂
      const existed = cur.some((r) => (r?.key || r?.displayText || "") === text);
      if (existed) return prev;

      const next = cur.concat([
        {
          kind: "custom",
          key: text,
          displayText: text,
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
  }, [
    refInput,
    wordKey,
    normalizeRefText,
    isPlaceholderRefText,
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
  const refControls = useMemo(() => {
    if (!multiRefEnabled) return null;

    return (
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

        {/* refs badges + 狀態 */}
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

        {/* missing 提示 */}
        {showRefStatus && safeMissingRefs.length > 0 && (
          <span style={{ fontSize: 12, opacity: 0.85 }}>
            {/* DEPRECATED 2026/01/06: hardcoded i18n moved to uiText */}
            {/* {isEn
              ? "Some references were not used. Please regenerate."
              : isJa
              ? "一部の参照が使用されていません。再生成してください。"
              : "有參考未被使用，請再重新產生"} */}
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
    );
  }, [
    multiRefEnabled,
    refInput,
    tRefPlaceholder,
    wordKey,
    handleAddRef,
    refInputStyle,
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
  ]);

  const injectedPlural =
    typeof (d?.plural || d?.pluralForm || d?.nounPlural || d?.pluralBaseForm) ===
    "string"
      ? (d.plural || d.pluralForm || d.nounPlural || d.pluralBaseForm).trim()
      : "";

  return (
    <div style={{ marginTop: 20 }}>
      {d && (d.baseForm || d.word) && (
        <WordPosInfo
          partOfSpeech={d.partOfSpeech}
          baseForm={d.baseForm || d.word}
          gender={d.gender}
          uiLabels={{}}
          extraInfo={{ plural: injectedPlural, dictionary: d }}
          type={d.type}
          uiLang={uiLang}
          onSelectForm={setSelectedForm}
          onWordClick={onWordClick}
        />
      )}

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
                {/* DEPRECATED 2026/01/06: hardcoded i18n moved to uiText */}
                {/* {isEn
                  ? "Some references were not used. Please regenerate."
                  : isJa
                  ? "一部の参照が使用されていません。再生成してください。"
                  : "有參考未被使用，請再重新產生"} */}
                {tMissingRefsHint}
              </span>
            )}

            {dirty && (
              <span style={{ fontSize: 12, opacity: 0.85 }}>
                {tDirtyHint}
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
        conversationPrevLabel={conversationPrevLabel}
        conversationNextLabel={conversationNextLabel}
        conversationPlayLabel={conversationPlayLabel}
        conversationCloseLabel={conversationCloseLabel}
        conversationLoadingLabel={conversationLoadingLabel}

        // ✅ Phase 2-UX（Step A-1）：轉傳到 ExampleSentence（例句標題列）用的 multiRef toggle props
        // - 這裡只提供資料/事件，不改現有 UI；ExampleSentence 若尚未接，這些 props 也不會影響任何行為
        multiRefEnabled={multiRefEnabled}
        onToggleMultiRef={onToggleMultiRefForExampleHeader}
        multiRefToggleLabel={tMultiRefLabel}
        multiRefToggleHint={tMultiRefHint}

        // ✅ Phase 2-UX（Step A-2）：refs 控制區塊插槽（ExampleSentence 下方）
        refControls={refControls}
      />
    </div>
  );
}
// frontend/src/components/examples/WordExampleBlock.jsx
