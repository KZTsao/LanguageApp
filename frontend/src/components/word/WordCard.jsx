// frontend/src/components/word/WordCard.jsx

/**
 * 文件說明：
 * - 本元件負責渲染「單字卡（WordCard）」：包含標題（WordHeader）、複數列、定義、例句、備註等區塊
 * - 收藏（⭐）屬於 App 層狀態：WordCard 只負責組出「收藏 entry（headword + canonicalPos）」並往上回拋
 *
 * 異動紀錄（僅追加，不可刪除）：
 * - 2025-12-17：
 *   1) 修正收藏（⭐）點擊無反應：原本 FavoriteStar 直接呼叫 onToggleFavorite，未帶 entry，導致上層 handleToggleFavorite(entry) 收到 undefined 直接 return
 *   2) 新增 favoriteInitStatus（Production 排查用）：提供目前 WordCard 收藏 entry 組裝結果與最後一次點擊紀錄
 *   3) 保留既有收藏 props 與渲染結構，不改動其他未提及邏輯
 * - 2025-12-18：
 *   4) 新增防呆：canonicalPos 為空或 unknown（不分大小寫）時，收藏按鈕直接 disable，且不呼叫 onToggleFavorite
 *      目的：避免 canonical_pos=unknown 這類資料異常寫入 DB，污染單字庫
 * - 2025-12-26：
 *   5) 修正名詞顯示大小寫：Nomen 若 headword 字首為小寫英文字母，顯示時自動轉大寫（例：blume → Blume）
 * - 2025-12-26：
 *   6) Phase 1：收藏 entry 追加 senseIndex/headwordGloss/headwordGlossLang（供 DB 寫入釋義快照）
 * - 2025-12-26：
 *   7) 補：回傳整檔避免行數缺漏（無邏輯變更）
 * - 2025-12-26：
 *   8) 新增 runtime console：追 gloss 取值路徑（render / click / picker）
 * - 2025-12-26：
 *   9) 新增 runtime console（cand1~cand4）：直接列出「收藏當下」可能的 senses 路徑來源，用於定位 gloss 真正存放位置
 * - 2025-12-29：
 *   10) 修正收藏 gloss 來源：當上游未提供 senses[]，但提供 definition[] / definition_de_translation[] / definition_de[]（array 多釋義）時，
 *       依 senseIndex 取對應項目作為 headwordGloss，避免 headword_gloss 空字串造成收藏釋義缺失
 *       並加入 runtime console（Production 排查）觀察 array 命中情況
 * - 2025-12-29：
 *   11) 收藏改為「一次存全部釋義」：在 favorite entry 新增 headwordSenses[]（來源以 dictionary.senses 為主；不足時用 array 欄位補齊）
 *       - 每筆至少包含：senseIndex, gloss, glossLang（其餘欄位保留原樣供後端擴充）
 *       - 保留舊欄位 senseIndex/headwordGloss/headwordGlossLang 以維持相容
 *       - 新增 runtime console：headwordSensesLen / sample0（Production 排查）
 * - 2026-01-05：
 *   12) Step 3（多詞性顯示資料流）：將 dictionary.posOptions 往下傳到 WordHeader（只傳遞，不做互動切換）
 *       - 新增 posOptionsFromDict 正規化（支援 posOptions / pos_options）
 *       - render runtime console 補印 posOptionsLen / preview（Production 排查）
 * - 2026-01-06：
 *   13) Step 4-1（多詞性切換：先打通點擊事件，不做 re-query）
 *       - 新增 onSelectPosKey（可選）prop：由上層接住 posKey 以便後續觸發 re-query
 *       - WordHeader 增加 activePosKey / onSelectPosKey 傳遞：讓 posOptions 從「純文字」變成「可點 pills」
 *       - 未提供 onSelectPosKey 時，仍注入一個 fallback handler（只 console），確保 UI 可點與事件可驗證
 * - 2026-01-09：
 *   14) Phase X（問題回報入口）：新增低調「問題回報」入口（多國 uiText）
 *       - 先提供分類下拉 + submit console.log（後續再串後端 needs_refresh / issue 記錄）
 * - 2026-01-09：
 *   15) Phase X（問題回報入口位置調整）：將入口移到「收藏 ⭐ 上方」，並改為小視窗 popover 呈現（不在釋義區塊右上角）
 * - 2026-01-12：
 *   16) Task 1（Entry 狀態：Header 可被置換）— Step A（僅接上層 state，不改例句邏輯）
 *      - 新增 entryHeaderOverrideByEntryKey（純 UI state）：用 entryKey(text+pos+senseIndex) 分流記住 header override
 *      - 提供 handleEntrySurfaceChange(surface, meta)：供下游（WordExampleBlock/WordPosInfoNoun）回拋選取的 surface 或 clear(null)
 *      - 將 entryHeaderOverride 與 onEntrySurfaceChange prop 傳入 WordExampleBlock（下游尚未導入時不影響既有行為）
 *
 * - 2026-01-13：
 *   17) Task 1（ResultPanel 收藏分類下拉搬移）— Step B（WordCard 接 slot）
 *      - 新增 favoriteCategorySelectNode（ReactNode）prop：由上層傳入收藏分類下拉 JSX
 *      - 將下拉渲染在收藏 ⭐ 的正上方（同一個右側垂直欄位）
 *      - 不改資料流：select 的 value/onChange 仍由上層控制；WordCard 只負責擺放位置
 *
 * - 2026-01-16：
 *   18) B( UI ) Step 1：收藏 pending → 單字粒度 disable（不做交易邏輯）
 *      - 新增 favoriteWordKey / isFavoritePending（可選）props：由上層（ResultPanel/Controller）提供
 *      - WordCard 僅負責：pending 時 disabled + 擋 onClick（不打 API、不 reload、不 rollback、不 optimistic）
 *
 * - 2026-01-16：
 *   19) B(UI) Step 2：本地瞬間反向燈號（不改上層 state/prop 結構）
 *      - 新增 optimisticFavoriteActive（僅 UI override）：按下星號先立即反向顯示
 *      - 上層 favoriteActive 更新後，自動清除 override（回歸真實狀態）
 *
 * - 2026-01-17：
 *   20) 歷史紀錄清除 UI 調整：將「點擊清除該筆記錄」改為 WordCard 右上角 close（×）icon
 *      - 新增 canClearHistory / onClearHistoryItem（可選）props
 *      - WordCard 僅負責顯示與點擊回呼，不自行操作 history state
 */

import { useEffect, useMemo, useState } from "react";
import WordHeader from "./header/WordHeader";
import WordHeaderMainLinePlural from "./header/WordHeaderMainLinePlural";
import WordDefinitionBlock from "./definition/WordDefinitionBlock";
import WordExampleBlock from "../examples/WordExampleBlock";
import {
  genderColors,
  defaultPosLocalNameMap,
  normalizePos,
} from "../../utils/wordCardConfig";
import FavoriteStar from "../common/FavoriteStar";
import uiText from "../../uiText";

function WordCard({
  data,
  labels = {},
  uiLang,
  theme,
  onWordClick,
  onSpeak,

  // ✅ 2026-01-20：Task F2（Favorites/Learning examples 快取回寫）— 上下游接線
  // 中文功能說明：
  // - mode / learningContext：用於判斷是否為 favorites learning replay，並關閉 auto-refresh
  // - onExamplesResolved：例句補齊成功後回寫 favoritesResultCache（由 App.jsx 提供）
  // - examplesAutoRefreshEnabled：上游已計算好的 flag（favorites learning 時為 false）
  mode,
  learningContext,
  onExamplesResolved,
  examplesAutoRefreshEnabled,

  // ✅ 2026-01-17：歷史紀錄清除（UI 入口搬到 WordCard 右上角 close icon）
  // - canClearHistory：是否顯示 close icon（由上層決定）
  // - onClearHistoryItem：點擊後回呼（由上層處理清除邏輯）
  canClearHistory,
  onClearHistoryItem,

  // ✅ 收藏統一由 App.jsx 管理：WordCard 不再碰 auth/localStorage
  favoriteActive,
  favoriteDisabled = false,
  onToggleFavorite,

  // ✅ 2026-01-16：B(UI) pending 鎖（由上層傳入；WordCard 只負責 disable/阻擋點擊）
  // - favoriteWordKey：上層已決定的 wordKey（同字在不同面板要一致）
  // - isFavoritePending(wordKey)：回傳該 wordKey 是否 pending
  favoriteWordKey,
  isFavoritePending,

  // ✅ 2026-01-13：Task 1（收藏分類下拉搬移）— 從 ResultPanel 傳入的下拉 UI slot
  // 中文功能說明：
  // - WordCard 不負責下拉的資料流，只負責把它擺在「收藏 ⭐ 上方」
  // - 下拉的 value/onChange 仍由上層（ResultPanel/App）控制
  favoriteCategorySelectNode,

  // ✅ 2026-01-06：Step 4-1（多詞性切換：先打通點擊事件）
  // 中文功能說明：
  // - onSelectPosKey：由上層接住 posKey（例如 "Adverb" / "Adjektiv"），後續 Step 4-2 再做 re-query
  // - 這一步只要求能點、能印 console、能把 posKey 往上回拋
  onSelectPosKey,
}) {
  if (!data) return null;
  const d = data.dictionary || {};

  const [senseIndex, setSenseIndex] = useState(0);

  // ✅ 2026-01-16：B(UI) Step 2：本地瞬間反向燈號（override）
  // - null：不 override，完全跟隨上層 favoriteActive
  // - boolean：暫時覆蓋 UI 顯示（按下星號立刻反向）
  const [optimisticFavoriteActive, setOptimisticFavoriteActive] = useState(null);

  // ✅ 上層 favoriteActive 一旦更新（代表 reload/交易完成或狀態已對齊），立刻清除 override
  useEffect(() => {
    setOptimisticFavoriteActive(null);
  }, [favoriteActive]);

  // ✅ 2026-01-16：B(UI) pending 計算（WordCard 不自行生成 wordKey；只吃上層提供）
  const favPending = useMemo(() => {
    try {
      if (!favoriteWordKey) return false;
      if (typeof isFavoritePending !== "function") return false;
      return !!isFavoritePending(favoriteWordKey);
    } catch (e) {
      return false;
    }
  }, [favoriteWordKey, isFavoritePending]);

  // ✅ 2026-01-09：Phase X（問題回報入口）
  // 中文功能說明：
  // - 需求：入口放在「收藏 ⭐ 的上面」，點擊後用小視窗（popover）呈現
  // - 目前階段：前端先打通入口（展開下拉分類 + 送出先 console.log），避免一次串太多導致難以除錯
  // - 後續階段：再串後端 API，將 dict_entries.needs_refresh 設為 true 並記錄 issue 分類
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [reportIssueCategory, setReportIssueCategory] = useState(
    "definition_wrong"
  );
  const [reportIssueLastAt, setReportIssueLastAt] = useState(null);

  /**
   * 功能：建立收藏初始化狀態（Production 排查用）
   * - ready：是否已成功組出可用的 favoriteEntry
   * - lastAction / lastClickAt / lastEntry：協助定位「點了沒反應」或 entry 組裝錯誤
   */
  const createFavoriteInitStatus = () => ({
    module: "frontend/src/components/word/WordCard.jsx::favorite",
    createdAt: new Date().toISOString(),
    ready: false,
    lastAction: null,
    lastClickAt: null,
    lastError: null,
    lastEntry: null,
  });

  // ✅ 收藏初始化狀態（Production 排查用）
  const [favoriteInitStatus, setFavoriteInitStatus] = useState(() =>
    createFavoriteInitStatus()
  );

  // ✅ WordCard 統一注入多國文字（唯一來源 uiText.js）
  const DEFAULT_LANG = "zh-TW";
  const lang = uiLang && uiText[uiLang] ? uiLang : DEFAULT_LANG;
  const wordUi = uiText[lang]?.wordCard || uiText[DEFAULT_LANG]?.wordCard || {};
  const verbUi = uiText[lang]?.verbCard || uiText[DEFAULT_LANG]?.verbCard || {};

  // ✅ 2026-01-12：問題回報入口只對「已登入」使用者顯示（UI gating）
  // 中文功能說明：
  // - 後端已要求 Authorization；這裡避免未登入仍看得到入口造成困惑
  // - 僅用於「顯示/不顯示」，不負責 auth 管理與寫入
  const reportIssueAuthed = useMemo(() => {
    try {
      if (typeof window === "undefined") return false;
      const ls = window && window.localStorage ? window.localStorage : null;
      if (!ls) return false;
      const key = Object.keys(ls).find((k) => String(k).includes("auth-token"));
      if (!key) return false;
      const raw = ls.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const token =
        (parsed && parsed.access_token) ||
        (parsed && parsed.currentSession && parsed.currentSession.access_token) ||
        (parsed && parsed.session && parsed.session.access_token) ||
        "";
      return !!token;
    } catch (e) {
      return false;
    }
  }, []);


// ✅ 2026-02-07：允許外部（例如 ResultPanel 導覽列）觸發「問題回報」開啟/關閉
// - 使用 window CustomEvent：soLang:toggleReportIssue
// - 未登入：直接忽略（避免 UI 困惑）
useEffect(() => {
  try {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (!reportIssueAuthed) return;
      setReportIssueOpen((v) => !v);
      setReportIssueLastAt(new Date().toISOString());
    };
    window.addEventListener("soLang:toggleReportIssue", handler);
    return () => window.removeEventListener("soLang:toggleReportIssue", handler);
  } catch (e) {
    // ignore
  }
}, [reportIssueAuthed]);

  // ✅ 2026-01-09：Phase X（問題回報）— 多國文字 + 分類清單
  const reportIssueLabel = wordUi.reportIssueLabel || wordUi.reportIssue || "-";
  const reportIssueHint = wordUi.reportIssueHint || "-";
  const reportIssueCategoryLabel = wordUi.reportIssueCategoryLabel || "-";
  const reportIssueCancelLabel = wordUi.reportIssueCancelLabel || "-";
  const reportIssueSubmitLabel = wordUi.reportIssueSubmitLabel || "-";
  const reportIssueCloseLabel = wordUi.reportIssueCloseLabel || "-";

  // ✅ 2026-01-09：Phase X（問題回報）— popover 額外文字（可選）
  const reportIssueTitle =
    wordUi.reportIssueTitle || wordUi.reportIssueDialogTitle || "-";

  const reportIssueCategories = useMemo(
    () => [
      {
        key: "definition_wrong",
        label: wordUi.reportIssueCatDefinitionWrong || "-",
      },
      {
        key: "pos_wrong",
        label: wordUi.reportIssueCatPosWrong || "-",
      },
      {
        key: "forms_wrong",
        label: wordUi.reportIssueCatFormsWrong || "-",
      },
      {
        key: "other",
        label: wordUi.reportIssueCatOther || "-",
      },
    ],
    [wordUi]
  );

  // ✅ 2026-01-12：Phase X（問題回報）— 提供 Definition 行尾端 icon 使用的開啟/提交 handler
  // 中文功能說明：
  // - WordDefinitionBlock 只負責 render 🚩 icon，點擊後呼叫 onOpenReportIssue
  // - Popover 與送出 API 仍由 WordCard 管理（避免下游重複造輪子）
  const handleOpenReportIssue = () => {
    try {
      setReportIssueOpen(true);
      setReportIssueLastAt(new Date().toISOString());
      console.log("[WordCard][reportIssue] open(fromDefinition)", {
        headword,
        canonicalPos,
        senseIndex,
      });
    } catch (e) {}
  };

  const {
    labelPlural = wordUi.labelPlural || "-",
    labelRoot = wordUi.labelRoot || "-",
    labelDefinition = wordUi.labelDefinition || "-",
    sectionExample = wordUi.sectionExample || "-",
    sectionExampleTranslation = wordUi.sectionExampleTranslation || "-",
    sectionNotes = wordUi.sectionNotes || "-",

    grammarOptionsLabel = wordUi.grammarOptionsLabel || "-",
    grammarToggleLabel = wordUi.grammarToggleLabel || "-",
    grammarCaseLabel = wordUi.grammarCaseLabel || "-",
    grammarCaseNomLabel = wordUi.grammarCaseNomLabel || "-",
    grammarCaseAkkLabel = wordUi.grammarCaseAkkLabel || "-",
    grammarCaseDatLabel = wordUi.grammarCaseDatLabel || "-",
    grammarCaseGenLabel = wordUi.grammarCaseGenLabel || "-",
    grammarArticleLabel = wordUi.grammarArticleLabel || "-",
    grammarArticleDefLabel = wordUi.grammarArticleDefLabel || "-",
    grammarArticleIndefLabel = wordUi.grammarArticleIndefLabel || "-",
    grammarArticleNoneLabel = wordUi.grammarArticleNoneLabel || "-",
    refreshExamplesTooltipLabel = wordUi.refreshExamplesTooltipLabel || "-",

    posLocalNameMap: externalPosLocalNameMap,
  } = labels;

  const posLocalNameMap =
    externalPosLocalNameMap ||
    wordUi.posLocalNameMap ||
    defaultPosLocalNameMap;

  const rawPos = d.partOfSpeech || "";
  const canonicalPos = normalizePos(rawPos);

  // ✅ 2026-01-12：Task 1（Entry 狀態：Header 可被置換）— Step A（先建立上游 state 與分流 key）
  // 中文功能說明：
  // - 本任務只影響「例句區 header（headword badge）」顯示文字，不動 refs、不打 API、不觸發造句。
  // - override 需「分 entry」保存：同一張卡切 sense（senseIndex）視為不同 entry，各自記住 override。
  // - entryKey 目前用 text + canonicalPos + senseIndex 組合（WordCard 這層可取得且足夠穩定）。
  const entryKeyForHeaderOverride = useMemo(() => {
    const t = typeof data?.text === "string" ? data.text.trim() : "";
    const p =
      typeof canonicalPos === "string"
        ? canonicalPos.trim()
        : String(canonicalPos || "").trim();
    const si = Number.isInteger(senseIndex) ? senseIndex : 0;
    return `${t}__${p}__${si}`;
  }, [data?.text, canonicalPos, senseIndex]);

  // 以 entryKey 分流保存 header override（純 UI 暫態；不寫 DB）
  const [entryHeaderOverrideByEntryKey, setEntryHeaderOverrideByEntryKey] =
    useState(() => ({}));

  // 目前 entry 的 override 值（空字串代表 fallback 到原本 headword）
  const entryHeaderOverride = useMemo(() => {
    try {
      const m = entryHeaderOverrideByEntryKey || {};
      const v =
        m && Object.prototype.hasOwnProperty.call(m, entryKeyForHeaderOverride)
          ? m[entryKeyForHeaderOverride]
          : "";
      return typeof v === "string" ? v : "";
    } catch (e) {
      return "";
    }
  }, [entryHeaderOverrideByEntryKey, entryKeyForHeaderOverride]);

  // 下游回拋：surface 有值 → 覆蓋；null/空字串 → clear（回預設 headword）
  const handleEntrySurfaceChange = (surface, meta) => {
    const s = typeof surface === "string" ? surface.trim() : "";
    setEntryHeaderOverrideByEntryKey((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      const next = { ...base };
      if (s) {
        next[entryKeyForHeaderOverride] = s;
      } else {
        if (
          Object.prototype.hasOwnProperty.call(next, entryKeyForHeaderOverride)
        ) {
          delete next[entryKeyForHeaderOverride];
        }
      }
      return next;
    });

    // ✅ runtime log（排查用）：確認 cell 點擊是否有回拋 surface 與 entryKey 分流是否正確
    try {
      console.log("[WordCard][entryHeaderOverride] change", {
        entryKey: entryKeyForHeaderOverride,
        surface: s || null,
        meta: meta || null,
      });
    } catch (e) {}
  };

  // ✅ 新增：canonicalPos 異常判斷（避免 unknown 寫入 DB）
  const canonicalPosInvalid =
    !canonicalPos || String(canonicalPos).toLowerCase() === "unknown";

  let posDisplay = "";
  if (canonicalPos) {
    const local = posLocalNameMap[canonicalPos];
    posDisplay = `${canonicalPos}${local ? `（${local}）` : ""}`;
  }

  // ✅ Step 3：多詞性清單（只傳遞到 WordHeader；不在 WordCard 做切換）
  // 中文功能說明：
  // - 後端 analyze 可能回 dictionary.posOptions（array）
  // - 為了相容命名差異，支援 posOptions / pos_options
  // - 這裡只做正規化，不做任何業務邏輯決策
  const posOptionsFromDict = (() => {
    const a =
      Array.isArray(d.posOptions)
        ? d.posOptions
        : Array.isArray(d.pos_options)
        ? d.pos_options
        : null;
    if (!Array.isArray(a)) return [];
    return a
      .map((x) => (x == null ? "" : String(x)))
      .map((s) => s.trim())
      .filter(Boolean);
  })();

  // ✅ 2026-01-06：Step 4-1（目前選中的 posKey）
  // 中文功能說明：
  // - 用於 WordHeader pills 的 active 標示
  // - 相容命名差異：posKey / pos_key
  const activePosKeyFromDict = (() => {
    const k =
      (typeof d.posKey === "string" && d.posKey.trim()) ||
      (typeof d.pos_key === "string" && d.pos_key.trim()) ||
      "";
    return k ? k.trim() : "";
  })();

  // ✅ 2026-01-06：Step 4-1（切換詞性點擊 handler：只打通事件，不做 re-query）
  // 中文功能說明：
  // - 若上層有傳 onSelectPosKey：把 posKey 往上回拋（Step 4-2 再處理 re-query）
  // - 若上層沒傳：fallback 只印 console（確保 pills 可點、可驗證）
  const handleSelectPosKey = (posKey) => {
    console.log("[WordCard][posSwitch] onSelectPosKey", {
      clickedPosKey: posKey,
      activePosKey: activePosKeyFromDict || null,
      word: typeof data?.text === "string" ? data.text : "",
      hasUpstreamHandler: typeof onSelectPosKey === "function",
    });

    try {
      if (typeof onSelectPosKey === "function") {
        onSelectPosKey(posKey);
      }
    } catch (e) {
      console.warn("[WordCard][posSwitch] upstream onSelectPosKey failed", e);
    }
  };

  const exampleTranslation =
    typeof (d.exampleTranslation || d.example_translation) === "string"
      ? d.exampleTranslation || d.example_translation
      : "";

  const explainLang = uiLang || data.explainLang || "zh-TW";

  // ✅ 顯示用 headword：只對名詞（Nomen）優先用原型（baseForm/lemma）
  // 其他詞性（Verb/Adjektiv...）維持 user 輸入的樣子
  const inputText = data.text;

  // ✅ phrase：若後端提供 normalized/canonical/headword，優先作為顯示 headword（不影響 word/sentence）
  const isPhrase = data?.kind === "phrase" || data?.mode === "phrase" || data?.queryMode === "phrase";
  const canonicalFromResult = (
    (typeof data?.headword === "string" && data.headword.trim()) ||
    (typeof data?.query?.canonical === "string" && data.query.canonical.trim()) ||
    (typeof data?.normalizedQuery === "string" && data.normalizedQuery.trim()) ||
    ""
  ).trim();

  const lemmaFromDict =
    (typeof d.baseForm === "string" && d.baseForm.trim()) ||
    (typeof d.base_form === "string" && d.base_form.trim()) ||
    (typeof d.lemma === "string" && d.lemma.trim()) ||
    (typeof d.headword === "string" && d.headword.trim()) ||
    "";

  // ✅ 改動點：只保留名詞使用 lemma/baseForm
  // const shouldPreferLemma = canonicalPos === "Nomen";
  // 20260109 改回一律優先 lemma/baseForm
  const shouldPreferLemma = true;

  // ✅ 先得到原始 headword（可能是小寫）
  const headwordRaw = (
    (isPhrase && canonicalFromResult) ||
    (shouldPreferLemma && lemmaFromDict) ||
    (typeof d.word === "string" && d.word.trim()) ||
    (typeof inputText === "string" && inputText.trim()) ||
    ""
  ).trim();

  /**
   * 功能：名詞顯示大小寫修正（僅針對 Nomen）
   * - 若字首為 a-z，轉為大寫
   * - 若字首已是大寫或非英文字母，保持原樣
   */
  const headword = (() => {
    if (canonicalPos !== "Nomen") return headwordRaw;
    if (!headwordRaw) return headwordRaw;
    const first = headwordRaw.charAt(0);
    if (first >= "a" && first <= "z") {
      return first.toUpperCase() + headwordRaw.slice(1);
    }
    return headwordRaw;
  })();

  // ✅ 本輪單一目標：名詞用原型顯示時，冠詞也要跟著原型
  const escapeRegExp = (s) =>
    String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // ✅ 1) 先吃後端若已提供的「原型冠詞」欄位（多種命名都支援）
  const baseGenderFromDict =
    (typeof d.baseGender === "string" && d.baseGender.trim()) ||
    (typeof d.base_gender === "string" && d.base_gender.trim()) ||
    (typeof d.lemmaGender === "string" && d.lemmaGender.trim()) ||
    (typeof d.lemma_gender === "string" && d.lemma_gender.trim()) ||
    (typeof d.headwordGender === "string" && d.headwordGender.trim()) ||
    (typeof d.headword_gender === "string" && d.headword_gender.trim()) ||
    "";

  // ✅ 2) 其次才用 definition 文字去抓 der/die/das + headword
  const inferBaseArticle = () => {
    if (canonicalPos !== "Nomen") return "";
    if (!headword) return "";

    const sources = [];

    const pushIfString = (v) => {
      if (typeof v === "string" && v.trim()) sources.push(v);
    };
    const pushIfArray = (v) => {
      if (!Array.isArray(v)) return;
      for (const it of v) pushIfString(it);
    };

    pushIfString(d.definition_de);
    pushIfString(d.definitionDe);
    pushIfString(d.definition);
    pushIfString(d.definition_de_short);
    pushIfString(d.definition_de_long);
    pushIfString(d.definition_de_text);
    pushIfString(d.definition_de_plain);
    pushIfArray(d.definition_de_list);
    pushIfArray(d.definition_list);

    const hw = headword.trim();
    const re = new RegExp(`\\b(der|die|das)\\s+${escapeRegExp(hw)}\\b`, "i");

    for (const s of sources) {
      const m = String(s).match(re);
      if (m && m[1]) return String(m[1]).toLowerCase();
    }
    return "";
  };

  const inputTrim = (typeof inputText === "string" ? inputText : "").trim();
  const usedLemmaForDisplay = canonicalPos === "Nomen" && !!lemmaFromDict;
  const headwordDiffersFromInput =
    !!inputTrim &&
    !!headword &&
    inputTrim.toLowerCase() !== headword.toLowerCase();

  const inferredBaseArticle =
    usedLemmaForDisplay && headwordDiffersFromInput ? inferBaseArticle() : "";

  // ✅ 最終顯示冠詞決策：
  const displayArticle = (() => {
    if (canonicalPos !== "Nomen") return d.gender || "";
    if (usedLemmaForDisplay && headwordDiffersFromInput) {
      return (
        (baseGenderFromDict ? baseGenderFromDict.trim().toLowerCase() : "") ||
        inferredBaseArticle ||
        (d.gender || "")
      );
    }
    return d.gender || "";
  })();

  const headerSpeakText = `${displayArticle ? displayArticle + " " : ""}${headword}`.trim();

  const articleColor = genderColors[displayArticle || ""] || "var(--text-main)";
  const pluralArticleColor = genderColors["die_plural"] || "var(--text-main)";

  const isVerb = canonicalPos === "Verb";

  const separablePrefixes = useMemo(
    () => [
      "ab",
      "an",
      "auf",
      "aus",
      "bei",
      "ein",
      "fest",
      "fort",
      "her",
      "hin",
      "los",
      "mit",
      "nach",
      "nieder",
      "vor",
      "weg",
      "weiter",
      "zu",
      "zurück",
      "zusammen",
    ],
    []
  );

  function detectSeparablePrefix(lemma) {
    if (!lemma || typeof lemma !== "string") return "";
    const w = lemma.trim().toLowerCase();
    const last = w.split(/\s+/).slice(-1)[0] || w;

    const sorted = [...separablePrefixes].sort((a, b) => b.length - a.length);
    for (const p of sorted) {
      if (last.startsWith(p) && last.length > p.length + 1) return p;
    }
    return "";
  }

  /** 模組：從 localStorage 取得 supabase access token（不引入新 client） */
  function getAccessTokenFromLocalStorage() {
    try {
      const key = Object.keys(localStorage).find((k) =>
        k.includes("auth-token")
      );
      if (!key) return "";
      const raw = JSON.parse(localStorage.getItem(key));
      return raw?.access_token || raw?.currentSession?.access_token || "";
    } catch {
      return "";
    }
  }
  const detectedPrefix = useMemo(() => {
    const lemma =
      (typeof d.baseForm === "string" && d.baseForm.trim()) ||
      (typeof d.word === "string" && d.word.trim()) ||
      (typeof headword === "string" && headword.trim()) ||
      "";
    return detectSeparablePrefix(lemma);
  }, [d.baseForm, d.word, headword]);

  const isSeparable =
    isVerb &&
    (d.separable === true ||
      d.separable === "true" ||
      d.separable === 1);

const __looksLikeReflexiveLemma = (s) => String(s || "").trim().toLowerCase().startsWith("sich ");

const isReflexive =
  isVerb &&
  (d.reflexive === true ||
    d.reflexive === "true" ||
    d.reflexive === 1 ||
    // ✅ hard fallback: if headword/input starts with "sich ", treat as reflexive verb
    __looksLikeReflexiveLemma(headwordRaw) ||
    __looksLikeReflexiveLemma(inputText) ||
    __looksLikeReflexiveLemma(data?.rawInput) ||
    __looksLikeReflexiveLemma(data?.query?.raw) ||
    __looksLikeReflexiveLemma(data?.query?.normalizedQuery));

  // ★ 新增：不規則動詞（來自後端 normalized.irregular）
  const irregularInfo = d.irregular || null;
  const isIrregular = isVerb && irregularInfo && irregularInfo.enabled === true;

  // ✅ 一律吃 uiText；缺 key 就顯示 "-"
  const phraseBadgeText = verbUi.phraseLabel || "-";
  const separableBadgeText = verbUi.separableLabel || "-";
  const reflexiveBadgeText = verbUi.reflexiveLabel || "-";

  const irregularPrefix = verbUi.irregularPrefix || "-";
  const irregularTypeLabelMap = {
    strong: verbUi.irregularStrong || "-",
    mixed: verbUi.irregularMixed || "-",
    suppletive: verbUi.irregularSuppletive || "-",
  };

  const irregularBadgeText = isIrregular
    ? `${irregularPrefix} ${
        irregularTypeLabelMap[irregularInfo.type] || irregularInfo.type || "-"
      }`.trim()
    : "";

  const verbSubtypeRaw =
    (typeof d.verbSubtype === "string" && d.verbSubtype.trim()) ||
    (typeof d.verb_subtype === "string" && d.verb_subtype.trim()) ||
    "";

  const verbSubtypeBadgeText = (() => {
    if (!isVerb) return "";
    switch (verbSubtypeRaw) {
      case "vollverb":
        return verbUi.subtypeFullVerb || "-";
      case "modal":
        return verbUi.subtypeModal || "-";
      case "hilfsverb":
        return verbUi.subtypeAux || "-";
      default:
        return "";
    }
  })();

  const plural =
    typeof (d.plural || d.pluralForm || d.nounPlural || d.pluralBaseForm) ===
    "string"
      ? (d.plural || d.pluralForm || d.nounPlural || d.pluralBaseForm).trim()
      : "";

  const nounType = d.type || "common_noun";
  const shouldShowGrammar =
    nounType === "common_noun" && canonicalPos === "Nomen";

  // ✅ 收藏 UI：完全由 App props 決定
  // ✅ 新增：canonicalPosInvalid 時直接 disable（避免 unknown 寫入 DB）
  // ✅ 2026-01-16：favPending 時也要 disable（同字交易中不可再點）
  const favDisabled =
    !!favoriteDisabled ||
    canonicalPosInvalid ||
    favPending ||
    typeof onToggleFavorite !== "function";

  /**
   * 功能：嘗試從 dictionary 結構中抓出「釋義快照」（用於收藏時寫入 DB）
   */
  const normalizeLangKey = (v) => String(v || "").trim();

  const pickByLang = (obj, langKey) => {
    if (!obj || typeof obj !== "object") return "";
    const k = normalizeLangKey(langKey);
    if (k && typeof obj[k] === "string" && obj[k].trim()) return obj[k].trim();

    const lk = k.toLowerCase();
    const candidates = [];
    if (lk.startsWith("zh")) {
      candidates.push(
        "zh-TW",
        "zh-tw",
        "zh-CN",
        "zh-cn",
        "zh",
        "zh_Hant",
        "zh-Hant",
        "zh_Hans",
        "zh-Hans"
      );
    } else if (lk.startsWith("en")) {
      candidates.push("en", "en-US", "en-GB", "en-us", "en-gb");
    } else if (lk.startsWith("de")) {
      candidates.push("de", "de-DE", "de-AT", "de-CH", "de-de", "de-at", "de-ch");
    } else if (k) {
      candidates.push(k);
    }

    for (const c of candidates) {
      if (typeof obj[c] === "string" && obj[c].trim()) return obj[c].trim();
    }
    return "";
  };

  const pickStringField = (o, keys = []) => {
    if (!o || typeof o !== "object") return "";
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v && typeof v === "object") {
        const byLang = pickByLang(v, explainLang);
        if (byLang) return byLang;
      }
    }
    return "";
  };

  const pickGlossFromSense = (sense) => {
    if (!sense) return "";
    if (typeof sense === "string") return sense.trim();

    const keys = [
      "headwordGloss",
      "gloss",
      "meaning",
      "translation",
      "definition",
      "definitionText",
      "def",
      "explain",
      "explanation",
    ];

    const v1 = pickStringField(sense, keys);
    if (v1) return v1;

    const glossObj = sense.gloss;
    if (glossObj && typeof glossObj === "object") {
      const byLang = pickByLang(glossObj, explainLang);
      if (byLang) return byLang;

      const nestedText =
        (typeof glossObj.text === "string" && glossObj.text.trim()) ||
        (typeof glossObj.value === "string" && glossObj.value.trim()) ||
        "";
      if (nestedText) return nestedText.trim();
    }

    return "";
  };

  /**
   * 功能：從「array 型多釋義欄位」依 index 取出 gloss（收藏用）
   * - 上游常見：definition[] / definition_de_translation[] / definition_de[]
   * - 取值優先序：
   *   1) definition[idx]
   *   2) definition_de_translation[idx]
   *   3) definition_de[idx]
   */
  const pickGlossFromFlatArrays = (dictObj, idx) => {
    const d0 = dictObj || {};
    const i0 = Number.isInteger(idx) ? idx : 0;

    const pickAt = (arr) => {
      if (!Array.isArray(arr)) return "";
      const v = arr[i0];
      return typeof v === "string" && v.trim() ? v.trim() : "";
    };

    const a1 = pickAt(d0.definition);
    if (a1) return a1;

    const a2 = pickAt(d0.definition_de_translation);
    if (a2) return a2;

    const a3 = pickAt(d0.definition_de);
    if (a3) return a3;

    return "";
  };

  const pickHeadwordGlossSnapshot = (dictObj, rootObj, idx) => {
    const d0 = dictObj || {};
    const r0 = rootObj || {};
    const i0 = Number.isInteger(idx) ? idx : 0;

    const arrays = [
      d0.senses,
      d0.definitions,
      d0.meanings,
      d0.items,
      d0.entries,
      r0.senses,
      r0.definitions,
      r0.meanings,
      r0.items,
      r0.entries,
      r0?.dictionary?.senses,
      r0?.dictionary?.definitions,
      r0?.dictionary?.meanings,
    ].filter(Array.isArray);

    // ✅ runtime log：有哪些 array 來源
    try {
      console.log("[WordCard][gloss][arrays]", {
        senseIndex: i0,
        explainLang,
        dict_has_senses: Array.isArray(d0.senses),
        dict_has_definitions: Array.isArray(d0.definitions),
        dict_has_meanings: Array.isArray(d0.meanings),
        dict_has_items: Array.isArray(d0.items),
        dict_has_entries: Array.isArray(d0.entries),
        root_has_senses: Array.isArray(r0.senses),
        root_dict_has_senses: Array.isArray(r0?.dictionary?.senses),
        // ✅ 2025-12-29：補印上游 array 多釋義欄位狀態
        dict_has_definition_array: Array.isArray(d0.definition),
        dict_has_definition_de_translation_array: Array.isArray(
          d0.definition_de_translation
        ),
        dict_has_definition_de_array: Array.isArray(d0.definition_de),
        arraysCount: arrays.length,
      });
    } catch (e) {}

    for (const arr of arrays) {
      const sense = arr[i0];

      // ✅ runtime log：本次取到的 sense 型態與 keys
      try {
        console.log("[WordCard][gloss][sense]", {
          senseIndex: i0,
          senseType: typeof sense,
          isArray: Array.isArray(sense),
          keys: sense && typeof sense === "object" ? Object.keys(sense) : null,
          preview:
            typeof sense === "string"
              ? sense.slice(0, 120)
              : sense && typeof sense === "object"
              ? JSON.stringify(sense).slice(0, 180)
              : null,
        });
      } catch (e) {}

      const g = pickGlossFromSense(sense);
      if (g) {
        try {
          console.log("[WordCard][gloss][hit]", {
            senseIndex: i0,
            glossLen: String(g || "").length,
            glossPreview: String(g || "").slice(0, 120),
          });
        } catch (e) {}
        return g;
      }
    }

    // ✅ 2025-12-29：若沒有 senses/meanings/definitions，改吃上游 array 型多釋義欄位
    const gFromArrays = pickGlossFromFlatArrays(d0, i0);
    if (gFromArrays) {
      try {
        console.log("[WordCard][gloss][flatArrayHit][dict]", {
          senseIndex: i0,
          glossLen: String(gFromArrays || "").length,
          glossPreview: String(gFromArrays || "").slice(0, 120),
        });
      } catch (e) {}
      return gFromArrays;
    }

    const flat = pickStringField(d0, [
      "headwordGloss",
      "gloss",
      "meaning",
      "translation",
      "definition",
      "definitionText",
      "def",
      "explain",
      "explanation",
    ]);
    if (flat) {
      try {
        console.log("[WordCard][gloss][flatHit][dict]", {
          glossLen: String(flat || "").length,
          glossPreview: String(flat || "").slice(0, 120),
        });
      } catch (e) {}
      return flat;
    }

    const flatRoot = pickStringField(r0, [
      "headwordGloss",
      "gloss",
      "meaning",
      "translation",
      "definition",
      "definitionText",
      "def",
      "explain",
      "explanation",
    ]);
    if (flatRoot) {
      try {
        console.log("[WordCard][gloss][flatHit][root]", {
          glossLen: String(flatRoot || "").length,
          glossPreview: String(flatRoot || "").slice(0, 120),
        });
      } catch (e) {}
      return flatRoot;
    }

    const lastTry = pickStringField(d0, [
      "definition_zh",
      "definition_zh_tw",
      "definitionZh",
      "definitionZhTW",
      "definition_zh_cn",
      "translation_zh",
      "translation_zh_tw",
      "translationZh",
      "meaning_zh",
      "meaningZh",
    ]);
    if (lastTry) {
      try {
        console.log("[WordCard][gloss][lastTryHit][dict]", {
          glossLen: String(lastTry || "").length,
          glossPreview: String(lastTry || "").slice(0, 120),
        });
      } catch (e) {}
      return lastTry;
    }

    const lastTryRoot = pickStringField(r0, [
      "definition_zh",
      "definition_zh_tw",
      "definitionZh",
      "definitionZhTW",
      "definition_zh_cn",
      "translation_zh",
      "translation_zh_tw",
      "translationZh",
      "meaning_zh",
      "meaningZh",
    ]);
    if (lastTryRoot) {
      try {
        console.log("[WordCard][gloss][lastTryHit][root]", {
          glossLen: String(lastTryRoot || "").length,
          glossPreview: String(lastTryRoot || "").slice(0, 120),
        });
      } catch (e) {}
      return lastTryRoot;
    }

    try {
      console.log("[WordCard][gloss][miss]", {
        senseIndex: i0,
        explainLang,
        dictKeys: Object.keys(d0 || {}).slice(0, 80),
        rootKeys: Object.keys(r0 || {}).slice(0, 80),
      });
    } catch (e) {}

    return "";
  };

  /**
   * 功能：建立「全部釋義」快照（收藏一次存下所有 senses）
   * - 優先使用 analyze 階段封裝好的 dictionary.senses[]
   * - 若 senses 不存在，嘗試用 definition[] / definition_de_translation[] / definition_de[] 補齊
   * - 回傳格式：[{ senseIndex, gloss, glossLang, ...raw }]
   *   - raw：保留原始 sense 物件其他欄位（若是物件）
   *   - gloss/glossLang：保證至少為字串（可能為空字串）
   */
  const buildHeadwordSensesSnapshot = (dictObj, rootObj, langKey) => {
    const d0 = dictObj || {};
    const r0 = rootObj || {};
    const l0 = normalizeLangKey(langKey || explainLang || uiLang || "");

    const safeArrayMaxLen = (...arrs) => {
      let m = 0;
      for (const a of arrs) {
        if (Array.isArray(a) && a.length > m) m = a.length;
      }
      return m;
    };

    const sensesArr = Array.isArray(d0.senses) ? d0.senses : null;

    // ✅ 1) 優先：dict.senses
    if (sensesArr && sensesArr.length > 0) {
      const mapped = sensesArr.map((s, idx) => {
        const base =
          s && typeof s === "object" && !Array.isArray(s) ? { ...s } : {};
        const g = pickGlossFromSense(s) || "";
        const gl =
          pickStringField(s, ["glossLang"]) ||
          pickStringField(base, ["glossLang"]) ||
          l0 ||
          "";

        return {
          ...base,
          senseIndex: Number.isInteger(idx) ? idx : 0,
          gloss: typeof g === "string" ? g : String(g || ""),
          glossLang: typeof gl === "string" ? gl : String(gl || ""),
        };
      });

      return mapped;
    }

    // ✅ 2) fallback：用 array 欄位補齊（避免完全沒有 headwordSenses）
    // ⚠️ 這是備援路徑：當 analyze 尚未封裝 senses 時才會走到
    const maxLen = safeArrayMaxLen(
      d0.definition,
      d0.definition_de_translation,
      d0.definition_de
    );
    if (maxLen > 0) {
      const mapped = [];
      for (let i = 0; i < maxLen; i += 1) {
        const g = pickGlossFromFlatArrays(d0, i) || "";
        mapped.push({
          senseIndex: i,
          gloss: typeof g === "string" ? g : String(g || ""),
          glossLang: l0 || "",
          _source: "flat_arrays_fallback",
        });
      }
      return mapped;
    }

    // ✅ 3) 最後：完全沒有資料
    return [];
  };

  /**
   * 功能：組裝收藏 entry（只存原型）
   */
  const buildFavoriteEntry = () => {
    const hw = (headword || lemmaFromDict || inputText || "").trim();
    const pos = (canonicalPos || "").trim();

    const gloss = pickHeadwordGlossSnapshot(d, data, senseIndex);
    const glossLang = normalizeLangKey(explainLang || uiLang || "");

    // ✅ 2025-12-29：一次存下所有釋義（headwordSenses）
    const headwordSenses = buildHeadwordSensesSnapshot(d, data, explainLang);

    const entry = {
      headword: hw,
      canonicalPos: pos,
      senseIndex: Number.isInteger(senseIndex) ? senseIndex : 0,
      headwordGloss: gloss || "",
      headwordGlossLang: glossLang || "",

      // ✅ 2025-12-29：全部釋義快照（收藏一次存下來）
      headwordSenses: Array.isArray(headwordSenses) ? headwordSenses : [],
    };

    // ✅ runtime log：實際要送上層的 entry
    try {
      console.log("[WordCard][favorite][entry]", {
        headword: entry.headword,
        canonicalPos: entry.canonicalPos,
        senseIndex: entry.senseIndex,
        headwordGlossLen: String(entry.headwordGloss || "").length,
        headwordGlossPreview: String(entry.headwordGloss || "").slice(0, 120),
        headwordGlossLang: entry.headwordGlossLang,
        headwordSensesLen: Array.isArray(entry.headwordSenses)
          ? entry.headwordSenses.length
          : 0,
        headwordSensesSample0:
          Array.isArray(entry.headwordSenses) && entry.headwordSenses[0]
            ? {
                senseIndex: entry.headwordSenses[0].senseIndex,
                glossPreview: String(entry.headwordSenses[0].gloss || "").slice(
                  0,
                  80
                ),
                glossLang: String(entry.headwordSenses[0].glossLang || "").slice(
                  0,
                  20
                ),
              }
            : null,
      });
    } catch (e) {}

    return entry;
  };

  /**
   * 功能：收藏點擊 handler（確保一定帶 entry 給上層）
   */
  const handleFavoriteClick = () => {
    // ✅ 2026-01-16：B(UI) pending 時 UI 必須擋住（即使某些情況下 disabled 沒生效也不應觸發）
    if (favPending) {
      try {
        console.log("[WordCard][fav] blocked_by_pending", {
          favoriteWordKey: favoriteWordKey || null,
        });
      } catch (e) {}
      return;
    }

    // ✅ 2026-01-16：B(UI) Step 2：不符合送出條件就不要先反向燈號（避免 UI 假動作）
    if (favDisabled || canonicalPosInvalid) {
      try {
        console.log("[WordCard][fav] blocked_by_disabled_or_invalid", {
          favDisabled: !!favDisabled,
          canonicalPosInvalid: !!canonicalPosInvalid,
        });
      } catch (e) {}
      return;
    }

    if (typeof onToggleFavorite !== "function") {
      try {
        console.log("[WordCard][fav] blocked_no_handler", {});
      } catch (e) {}
      return;
    }

    // ✅ 2026-01-16：B(UI) Step 2：先立刻反向燈號（純 UI override，不動上層 state 結構）
    setOptimisticFavoriteActive((prev) => {
      const base = prev == null ? !!favoriteActive : !!prev;
      return !base;
    });

    console.log("[WordCard][fav] clicked");
    const entry = buildFavoriteEntry();

    // ✅ Phase 1：收藏當下直接列出常見 senses 路徑（定位 gloss 真正來源）
    try {
      console.log(
        "[WordCard][fav][debug] headword=",
        headword,
        "pos=",
        canonicalPos,
        "senseIndex=",
        senseIndex
      );
      console.log("[WordCard][fav][debug] data.keys=", Object.keys(data || {}));
      console.log(
        "[WordCard][fav][debug] dict.keys=",
        Object.keys((data && data.dictionary) || {})
      );
      console.log(
        "[WordCard][fav] has d.senses?",
        Array.isArray((data?.dictionary || {})?.senses)
      );
      console.log(
        "[WordCard][fav] data.dictionary keys",
        Object.keys(data?.dictionary || {})
      );

      const d0 = (data && data.dictionary) || {};
      const sIdx = Number.isInteger(senseIndex) ? senseIndex : 0;

      const cand1 = d0?.senses?.[sIdx];
      const cand2 = data?.senses?.[sIdx];
      const cand3 = data?.result?.senses?.[sIdx];
      const cand4 = data?.dictionary?.result?.senses?.[sIdx];

      console.log("[WordCard][fav][debug] cand1(dict.senses[idx])=", cand1);
      console.log("[WordCard][fav][debug] cand2(data.senses[idx])=", cand2);
      console.log("[WordCard][fav][debug] cand3(data.result.senses[idx])=", cand3);
      console.log(
        "[WordCard][fav][debug] cand4(data.dictionary.result.senses[idx])=",
        cand4
      );

      // 額外：把 cand* 的 keys 印出來（避免物件太大看不到）
      const safeKeys = (o) => (o && typeof o === "object" ? Object.keys(o) : null);
      console.log("[WordCard][fav][debug] cand1.keys=", safeKeys(cand1));
      console.log("[WordCard][fav][debug] cand2.keys=", safeKeys(cand2));
      console.log("[WordCard][fav][debug] cand3.keys=", safeKeys(cand3));
      console.log("[WordCard][fav][debug] cand4.keys=", safeKeys(cand4));

      // ✅ 2025-12-29：補印 array 型多釋義欄位（上游 Schloss 會在這裡）
      console.log(
        "[WordCard][fav][debug] dict.definition[idx]=",
        Array.isArray(d0?.definition) ? d0.definition[sIdx] : undefined
      );
      console.log(
        "[WordCard][fav][debug] dict.definition_de_translation[idx]=",
        Array.isArray(d0?.definition_de_translation)
          ? d0.definition_de_translation[sIdx]
          : undefined
      );
      console.log(
        "[WordCard][fav][debug] dict.definition_de[idx]=",
        Array.isArray(d0?.definition_de) ? d0.definition_de[sIdx] : undefined
      );
    } catch (e) {}

    setFavoriteInitStatus((s) => ({
      ...s,
      lastAction: "handleFavoriteClick",
      lastClickAt: new Date().toISOString(),
      lastError: null,
      lastEntry: entry,
      ready: !!entry?.headword,
    }));

    if (canonicalPosInvalid) {
      setFavoriteInitStatus((s) => ({
        ...s,
        lastError: "canonicalPos is invalid (empty or unknown)",
      }));
      // ✅ 若後面被擋住，回復 override（避免 UI 停在假狀態）
      setOptimisticFavoriteActive(null);
      return;
    }

    if (typeof onToggleFavorite !== "function") {
      setFavoriteInitStatus((s) => ({
        ...s,
        lastError: "onToggleFavorite is not a function",
      }));
      setOptimisticFavoriteActive(null);
      return;
    }

    if (!entry?.headword) {
      setFavoriteInitStatus((s) => ({
        ...s,
        lastError: "favorite entry headword is empty",
      }));
      setOptimisticFavoriteActive(null);
      return;
    }

    onToggleFavorite(entry);
  };

  const token = getAccessTokenFromLocalStorage();
  // =========================
  // Phase X：回報問題（Report Issue）
  // - 只負責送出 API request，讓 Network 可觀測
  // - 後端是否已接線、是否寫入 DB：交由後端實作（前端不阻擋 UI）
  // =========================
  const sendReportIssue = async (payload) => {
    try {
      const res = await fetch("/api/dictionary/reportIssue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload || {}),
      });

      // ✅ 不阻擋 UI：僅做可觀測 log（避免影響使用者操作）
      const ok = !!res && res.ok;
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      console.log("[WordCard][reportIssue] api_result", {
        ok,
        status: res ? res.status : null,
        data,
      });

      return { ok, status: res ? res.status : null, data };
    } catch (e) {
      console.error("[WordCard][reportIssue] api_error", e);
      return { ok: false, status: null, data: null, error: String(e) };
    }
  };

  // ✅ runtime log：render 時快速看 dict 結構是否含 senses 類
  try {
    console.log("[WordCard][render][dictShape]", {
      text: typeof data?.text === "string" ? data.text : "",
      canonicalPos,
      senseIndex,
      explainLang,
      dictKeys: Object.keys(d || {}).slice(0, 80),
      has_senses: Array.isArray(d?.senses),
      has_definitions: Array.isArray(d?.definitions),
      has_meanings: Array.isArray(d?.meanings),
      has_entries: Array.isArray(d?.entries),
      has_items: Array.isArray(d?.items),
      root_has_senses: Array.isArray(data?.senses),
      root_dict_has_senses: Array.isArray(data?.dictionary?.senses),
      // ✅ 2025-12-29：補印 array 型多釋義欄位存在與否（Production 排查）
      has_definition_array: Array.isArray(d?.definition),
      has_definition_de_translation_array: Array.isArray(
        d?.definition_de_translation
      ),
      has_definition_de_array: Array.isArray(d?.definition_de),

      // ✅ 2026-01-05：posOptions（多詞性）存在與否（Production 排查）
      posOptionsLen: Array.isArray(posOptionsFromDict)
        ? posOptionsFromDict.length
        : 0,
      posOptionsPreview: Array.isArray(posOptionsFromDict)
        ? posOptionsFromDict.slice(0, 6)
        : [],

      // ✅ 2026-01-06：Step 4-1 activePosKey（Production 排查）
      activePosKey: activePosKeyFromDict || null,

      // ✅ 2026-01-16：B(UI) pending 狀態（Production 排查）
      favoriteWordKey: favoriteWordKey || null,
      favPending: !!favPending,

      // ✅ 2026-01-16：B(UI) Step 2：本地 override（Production 排查）
      optimisticFavoriteActive:
        optimisticFavoriteActive == null ? null : !!optimisticFavoriteActive,
    });
  } catch (e) {}

  return (
    <div
      style={{
        position: "relative",
        background: "var(--card-bg)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
      }}
    >
      {/* ✅ 2026-01-17：歷史紀錄清除（close icon 置於 WordCard 右上角） */}
      {canClearHistory && typeof onClearHistoryItem === "function" ? (
        <button
          type="button"
          onClick={(e) => {
            try {
              e.preventDefault();
              e.stopPropagation();
            } catch (err) {}
            onClearHistoryItem();
          }}
          aria-label="Clear this history item"
          title="Clear"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            // ✅ 2026-01-17（需求調整）：不要圓圈外框，只顯示 X（保留透明點擊熱區）
            width: 24,
            height: 24,
            borderRadius: 0,
            border: "none",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            lineHeight: "24px",
            fontSize: 18,
            padding: 0,
            display: "flex",
            alignItems: "center",
            opacity: 0.25, 
            justifyContent: "center",
            zIndex: 5,
          }}
        >
          ×
        </button>
      ) : null}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WordHeader
            article={shouldShowGrammar ? displayArticle : ""}
            headword={headword}
            articleColor={articleColor}
            headerSpeakText={headerSpeakText}
            posDisplay={posDisplay}
            onWordClick={onWordClick}
            onSpeak={onSpeak}
            // ✅ 2026-01-05：Step 3（多詞性顯示資料流）— 只傳遞，不在此處切換
            posOptions={posOptionsFromDict}
            // ✅ 2026-01-06：Step 4-1（多詞性切換）— 先打通事件（可點 pills）
            // - activePosKey：目前選中的詞性 key（用於 UI 標示）
            // - onSelectPosKey：點擊回呼（若上層沒傳，WordCard 仍會 fallback 印 console）
            activePosKey={activePosKeyFromDict}
            onSelectPosKey={handleSelectPosKey}
            uiLang={uiLang}
          />
        </div>

        {/* ✅ 2026-01-09：Phase X（問題回報入口）— 移到收藏 ⭐ 上方，並用 popover 呈現 */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          {/* ✅ 2026-01-13：Task 1（收藏分類下拉搬移）— 下拉放在收藏 ⭐ 上方 */}
          {!!favoriteCategorySelectNode && (
            <div
              data-ref="wordCardFavoriteCategorySlot"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              {favoriteCategorySelectNode}
            </div>
          )}

          {reportIssueAuthed ? (
            <>
              {/* ✅ 2026-01-13：移除 WordCard 文字問題回報入口（保留 DefinitionBlock 🚩觸發 + popover） */}

              {reportIssueOpen ? (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    transform: "translateY(18px)",
                    zIndex: 50,
                    width: 260,
                    borderRadius: 14,
                    border: "1px solid var(--border-subtle)",
                    background: "var(--card-bg)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-main)",
                        fontWeight: 600,
                      }}
                    >
                      {reportIssueTitle}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReportIssueOpen(false);
                        console.log("[WordCard][reportIssue] close(x)", {
                          headword,
                          canonicalPos,
                          senseIndex,
                          reportIssueCategory,
                          reportIssueLastAt,
                        });
                      }}
                      style={{
                        fontSize: 12,
                        width: 24,
                        height: 24,
                        lineHeight: "24px",
                        borderRadius: 999,
                        border: "1px solid var(--border-subtle)",
                        background: "transparent",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                      }}
                      aria-label={reportIssueCloseLabel}
                      title={reportIssueCloseLabel}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {reportIssueCategoryLabel}
                    </div>

                    <select
                      value={reportIssueCategory}
                      onChange={(e) => setReportIssueCategory(e.target.value)}
                      style={{
                        fontSize: 12,
                        padding: "6px 10px",
                        borderRadius: 12,
                        border: "1px solid var(--border-subtle)",
                        background: "var(--card-bg)",
                        color: "var(--text-main)",
                        width: "100%",
                      }}
                    >
                      {reportIssueCategories.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 8,
                        marginTop: 4,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setReportIssueOpen(false);
                          console.log("[WordCard][reportIssue] cancel", {
                            headword,
                            canonicalPos,
                            senseIndex,
                            reportIssueCategory,
                            reportIssueLastAt,
                          });
                        }}
                        style={{
                          fontSize: 12,
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: "1px solid var(--border-subtle)",
                          background: "transparent",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {reportIssueCancelLabel}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          // ✅ 目前先 console.log（保留），並同步送出 API 讓 Network 可觀測
                          const __reportPayload = {
                            headword,
                            canonicalPos,
                            senseIndex,
                            reportIssueCategory,
                            reportIssueLastAt,
                            // 先把當下的釋義快照帶上，方便後端比對（可選）
                            definition_de:
                              typeof d?.definition_de === "string"
                                ? d.definition_de
                                : "",
                            definition_de_translation:
                              typeof d?.definition_de_translation === "string"
                                ? d.definition_de_translation
                                : "",
                            definition:
                              typeof d?.definition === "string"
                                ? d.definition
                                : "",
                          };

                          console.log("[WordCard][reportIssue] submit", __reportPayload);

                          // fire-and-forget：不阻擋 UI（只要 Network 有 request 即可）
                          try {
                            void sendReportIssue(__reportPayload);
                          } catch (e) {
                            // ignore
                          }
                          setReportIssueOpen(false);
                        }}
                        style={{
                          fontSize: 12,
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: "1px solid var(--border-subtle)",
                          background: "var(--accent-soft, #e0f2fe)",
                          color: "var(--accent, #0369a1)",
                          cursor: "pointer",
                        }}
                      >
                        {reportIssueSubmitLabel}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {/* ⭐ 我的最愛（App 管） */}
          <FavoriteStar
            active={
              optimisticFavoriteActive == null
                ? !!favoriteActive
                : !!optimisticFavoriteActive
            }
            disabled={favDisabled}
            onClick={handleFavoriteClick}
            size={16}
            ariaLabel="-"
          />
        </div>
      </div>

      {(data.mode === "phrase" ||
        isSeparable ||
        isReflexive ||
        isIrregular ||
        !!verbSubtypeBadgeText) && (
        <div
          style={{
            marginTop: 6,
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {data.mode === "phrase" && <div style={badgeStyle}>{phraseBadgeText}</div>}
          {isSeparable && <div style={badgeStyle}>{separableBadgeText}</div>}
          {isReflexive && <div style={badgeStyle}>{reflexiveBadgeText}</div>}
          {verbSubtypeBadgeText && <div style={badgeStyle}>{verbSubtypeBadgeText}</div>}
          {isIrregular && <div style={badgeStyle}>{irregularBadgeText}</div>}
        </div>
      )}

      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right, transparent, var(--border-subtle), transparent)",
          marginBottom: 10,
        }}
      />

      {shouldShowGrammar && plural ? (
        <WordHeaderMainLinePlural
          plural={plural}
          labelPlural={labelPlural}
          pluralArticleColor={pluralArticleColor}
          handleSpeak={onSpeak}
          onWordClick={onWordClick}
        />
      ) : null}

      {/* ✅ 2026-01-09：DEPRECATED 釋義右上角入口（已移到收藏上方 popover)
          - 保留原碼以利回溯；不再渲染（避免 UI 重複）
          - 若未來想改回釋義區也可復用
      */}
      {false ? (
        <div style={{ position: "relative" }}>
          <div
            role="button"
            tabIndex={0}
            title={reportIssueHint}
            onClick={() => {
              setReportIssueOpen((v) => !v);
              setReportIssueLastAt(new Date().toISOString());
              console.log("[WordCard][reportIssue] toggle(deprecated)", {
                headword,
                canonicalPos,
                senseIndex,
                opened: !reportIssueOpen,
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setReportIssueOpen((v) => !v);
                setReportIssueLastAt(new Date().toISOString());
                console.log("[WordCard][reportIssue] toggle(key)(deprecated)", {
                  headword,
                  canonicalPos,
                  senseIndex,
                  opened: !reportIssueOpen,
                });
              }
            }}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              fontSize: 12,
              color: "var(--text-muted)",
              cursor: "pointer",
              userSelect: "none",
              padding: "2px 0",
              opacity: 0.85,
            }}
          >
            {reportIssueLabel}
          </div>
        </div>
      ) : null}

      <WordDefinitionBlock
        d={d}
        labelDefinition={labelDefinition}
        senseIndex={senseIndex}
        onSenseChange={setSenseIndex}
        onWordClick={onWordClick}
        onSpeak={onSpeak}
        shouldShowGrammar={shouldShowGrammar}
        // ✅ 2026-01-12：Phase X（問題回報入口）— Definition 行尾端 🚩 icon（未登入不顯示）
        canReportIssue={reportIssueAuthed}
        reportIssueHint={reportIssueHint}
        onOpenReportIssue={handleOpenReportIssue}
        setReportIssueOpen={setReportIssueOpen}
      />

      <WordExampleBlock
        d={d}
        // ✅ plumbing: pass query hints for POS info (reflexive etc.)
        query={data?.query}
        queryHints={data?.query?.hints}
        headword={headwordRaw}
        rawInput={data?.rawInput || inputText}
        normalizedQuery={data?.query?.normalizedQuery}
        senseIndex={senseIndex}
        // ✅ 2026-01-20：Task F2（Favorites/Learning examples 快取回寫）— 往下傳遞導覽狀態與回寫 callback
        // - WordExampleBlock/useExamples 會用 mode+learningContext 判斷是否關閉 auto-refresh
        // - 手動補齊成功後，透過 onExamplesResolved 回寫 favoritesResultCache（App.jsx）
        mode={mode}
        learningContext={learningContext}
        onExamplesResolved={onExamplesResolved}
        examplesAutoRefreshEnabled={examplesAutoRefreshEnabled}
        // ✅ 2026-01-12：Task 1（Entry 狀態：Header 可被置換）— 上游提供 header override（僅顯示用途）
        entryHeaderOverride={entryHeaderOverride}
        onEntrySurfaceChange={handleEntrySurfaceChange}
        entryHeaderOverrideEntryKey={entryKeyForHeaderOverride}
        sectionExample={sectionExample}
        sectionExampleTranslation={sectionExampleTranslation}
        exampleTranslation={exampleTranslation}
        explainLang={explainLang}
        onWordClick={onWordClick}
        onSpeak={onSpeak}
        uiLang={uiLang}
        theme={theme}
        grammarOptionsLabel={grammarOptionsLabel}
        grammarToggleLabel={grammarToggleLabel}
        grammarCaseLabel={grammarCaseLabel}
        grammarCaseNomLabel={grammarCaseNomLabel}
        grammarCaseAkkLabel={grammarCaseAkkLabel}
        grammarCaseDatLabel={grammarCaseDatLabel}
        grammarCaseGenLabel={grammarCaseGenLabel}
        grammarArticleLabel={grammarArticleLabel}
        grammarArticleDefLabel={grammarArticleDefLabel}
        grammarArticleIndefLabel={grammarArticleIndefLabel}
        grammarArticleNoneLabel={grammarArticleNoneLabel}
        refreshExamplesTooltipLabel={refreshExamplesTooltipLabel}
        shouldShowGrammar={shouldShowGrammar}
      />

      {d.notes && (
        <div style={{ marginTop: 14, fontSize: 13 }}>
          <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>
            {sectionNotes}
          </div>
          <div>{d.notes}</div>
        </div>
      )}
    </div>
  );
}

// 共用 badge 樣式（避免重複）
const badgeStyle = {
  display: "inline-flex",
  width: "fit-content",
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: 12,
  background: "var(--accent-soft, #e0f2fe)",
  color: "var(--accent, #0369a1)",
  border: "1px solid var(--border-subtle)",
};

export default WordCard;
// frontend/src/components/word/WordCard.jsx