// frontend/src/components/posInfo/WordPosInfoVerb.jsx
//
// 動詞（Verb）資訊區塊
// - 顯示：動詞類型 / 助動詞 / 常見搭配
// - 下拉選單切換時態（Präsens / Präteritum / Perfekt）
// - 3x2 格子顯示 ich / du / er_sie_es / wir / ihr / sie_Sie
// - 多國語系：從 uiText[currentLang].verbCard 讀取 labels（缺就顯示 "-"）
//
// ⭐ Step A-1（本次修正）
// - 後端可能誤標 separable=false（例如 "sich vorbereiten"），但 baseForm 可偵測到前綴
// - 改用 effectiveSeparable = separable || detectedPrefix 來拆前綴判斷
//
// ⭐ Step B-1（本次修正）
//
// ⭐ Step B-2（本輪變更：只改「同字根」規則）
// - 同字根只在「可分離動詞」時顯示
// - 同字根過濾掉人格變化/變位形式，只保留「原形/詞條」
//
// ⭐ Step C-1（本輪變更：新增「不規則」拆分標籤 + 多國語系）
// - 支援 extraInfo.irregularType / extraInfo.irregular{type} / extraInfo.irregular=true
// - 只新增 badge 顯示，不影響 conjugation / TTS 行為
//
// ⭐ Step D-1（本輪變更：反身動詞去重）
// - LLM 有時會在 conjugation raw 內已帶反身代名詞（例如 "wasche mich"）
// - 前端原本又會再 inject 一次 → 造成 "mich mich"
// - 修正：只有 raw 尚未包含該 pronoun 時才補上

// ⭐ Step E-1（本輪變更：動詞格子點選同步例句 headword）
//
// ✅ 2026-01-26 Patch Note:
// - Verb：格子點選時，surface 會包含「主詞 + 詞形」(例如：ich kümmere mich)
// - 走 WordPosInfo.handleSpeakForm 統一路徑：TTS + onEntrySurfaceChange 同步例句 header
// - 不會自動重新造句（造句仍由使用者手動點按鈕）
//
// - 點選任一動詞格子（含自動定位 queryWord 命中後的手動點選）
//   會播放 TTS + focus（既有行為）
// - 另外呼叫 onHeadwordChange(form) 讓例句區 headword 跟著切換
// -----------------------------------------------------

import React, { useEffect, useMemo, useRef, useState } from "react";
import uiText from "../../uiText";
import { playTTS } from "../../utils/ttsClient";

export default function WordPosInfoVerb({
  baseForm,
  queryWord,
  labels = {},
  extraInfo = {},
  onSelectForm,
  onWordClick, // ✅ 外層若有傳，就用它重新查詢
  uiLang,
}) {
  if (!baseForm) return null;

  // ✅ 折疊（deprecated）
  // 2026-01-24：由上層「詞性補充」區塊統一管理收合，本元件不再提供內部收合 UI
  // - 保留 state 與既有邏輯（避免誤刪既有紀錄/後續 merge 衝突）
  const [isOpen, setIsOpen] = useState(true);

  // ✅ 第三人稱下拉（er / sie / es）
  const [thirdPerson, setThirdPerson] = useState("er");
  // ✅ sie/Sie 下拉
  const [siePerson, setSiePerson] = useState("sie");

  // 讀目前 UI 語言（缺就維持 zh-TW，但文字仍只吃 uiText；uiText 也缺就顯示 "-"）
  let currentLang = "zh-TW";
  if (uiLang && uiText[uiLang]) currentLang = uiLang;

  // ❗嚴格模式：不 fallback 到 zh-TW
  const verbUi = uiText[currentLang]?.verbCard || {};
  const colon = verbUi.colon || "-";

  // 自動 labels，允許後續 props.labels 覆蓋
  const autoLabels = {
    posLabel: verbUi.posLabel || "-",
    title: verbUi.title || "-",

    subtypeLabel: verbUi.subtypeLabel || "-",
    subtypeFullVerb: verbUi.subtypeFullVerb || "-",
    subtypeModal: verbUi.subtypeModal || "-",
    subtypeAux: verbUi.subtypeAux || "-",

    auxiliaryLabel: verbUi.auxiliaryLabel || "-",
    valenzLabel: verbUi.valenzLabel || "-",

    // ✅ 不規則（多國語系 key）
    irregularLabel: verbUi.irregularLabel || "-",
    irregularStrongLabel: verbUi.irregularStrongLabel || "-",
    irregularMixedLabel: verbUi.irregularMixedLabel || "-",
    irregularSuppletiveLabel: verbUi.irregularSuppletiveLabel || "-",

    tenseSelectLabel: verbUi.tenseSelectLabel || "-",
    praesensLabel: verbUi.praesensLabel || "-",
    praeteritumLabel: verbUi.praeteritumLabel || "-",
    perfektLabel: verbUi.perfektLabel || "-",

    ichLabel: verbUi.ichLabel || "-",
    duLabel: verbUi.duLabel || "-",
    erSieEsLabel: verbUi.erSieEsLabel || "-",
    wirLabel: verbUi.wirLabel || "-",
    ihrLabel: verbUi.ihrLabel || "-",
    sieSieLabel: verbUi.sieSieLabel || "-",

    noFormText: verbUi.noFormText || "-",

    // ✅ 推薦字區塊（多國語系 key）
    recTitle: verbUi.recTitle || "-",
    recSynLabel: verbUi.recSynLabel || "-",
    recAntLabel: verbUi.recAntLabel || "-",
    recRootLabel: verbUi.recRootLabel || "-",

    // ✅ Debug（也走多國；缺就顯示 "-"）
    debugMissingRecs: verbUi.debugMissingRecs || "-",
  };

  const mergedLabels = {
    ...autoLabels,
    ...(labels || {}),
  };

  const {
    posLabel,
    title,
    subtypeLabel,
    subtypeFullVerb,
    subtypeModal,
    subtypeAux,
    auxiliaryLabel,
    valenzLabel,

    irregularLabel,
    irregularStrongLabel,
    irregularMixedLabel,
    irregularSuppletiveLabel,

    tenseSelectLabel,
    praesensLabel,
    praeteritumLabel,
    perfektLabel,
    ichLabel,
    duLabel,
    erSieEsLabel,
    wirLabel,
    ihrLabel,
    sieSieLabel,
    noFormText,

    recTitle,
    recSynLabel,
    recAntLabel,
    recRootLabel,

    debugMissingRecs,
  } = mergedLabels;

  const {
    verbSubtype = "",
    separable = false,
    reflexive = false,
    auxiliary = "",
    conjugation = {},
    valenz = [],
    recommendations = {}, // ✅ 後端 analyzeWord 回來的 recommendations

    // ✅ 不規則（新增支援）
    irregularType,
    irregular,
  } = extraInfo || {};

  // ✅ Reflexive flag:
  // - Trust dictionary if present
  // - Otherwise allow upstream query hints / headword-based hard rule (sich + Verb)
  const __queryHintsReflexive =

    extraInfo?.query?.hints?.reflexive === true ||
    extraInfo?.hints?.reflexive === true ||
    extraInfo?.queryHints?.reflexive === true;
const __headwordLike =
  (typeof extraInfo?.headword === "string" && extraInfo.headword.trim()) ||
  (typeof extraInfo?.rawInput === "string" && extraInfo.rawInput.trim()) ||
  (typeof extraInfo?.normalizedQuery === "string" && extraInfo.normalizedQuery.trim()) ||
  "";

const __looksLikeReflexiveLemma = (s) => String(s || "").trim().toLowerCase().startsWith("sich ");

const effectiveReflexive =
  reflexive === true ||
  __queryHintsReflexive === true ||
  __looksLikeReflexiveLemma(__headwordLike) ||
  __looksLikeReflexiveLemma(queryWord);

  console.debug("[reflexive] WordPosInfoVerb flags", {
    queryWord,
    baseForm,
    dictReflexive: reflexive === true,
    queryHintsReflexive: __queryHintsReflexive === true,
  });

  // 🔎 deeper debug: scan multiple possible hint paths on extraInfo (no logic change)
  const __reflexiveCandidates = (() => {
    const root = extraInfo && typeof extraInfo === "object" ? extraInfo : {};
    const paths = [
      "query.hints.reflexive",
      "queryHints.reflexive",
      "hints.reflexive",
      "meta.hints.reflexive",
      "analysis.query.hints.reflexive",
      "analyze.query.hints.reflexive",
      "payload.query.hints.reflexive",
      "raw.query.hints.reflexive",
      "result.query.hints.reflexive",
    ];
    const out = {};
    for (const p of paths) {
      try {
        const parts = p.split(".");
        let cur = root;
        for (const k of parts) cur = cur && typeof cur === "object" ? cur[k] : undefined;
        out[p] = cur;
      } catch {
        out[p] = undefined;
      }
    }
    return out;
  })();

  console.debug("[reflexive] WordPosInfoVerb extraInfo candidates", {
    queryWord,
    baseForm,
    candidates: __reflexiveCandidates,
    extraInfoKeys: extraInfo && typeof extraInfo === "object" ? Object.keys(extraInfo) : null,
    extraInfoQueryKeys:
      extraInfo?.query && typeof extraInfo.query === "object" ? Object.keys(extraInfo.query) : null,
  });


  // ✅ 不規則解析（只做 badge 顯示，不影響其他行為）
  const irregularResolvedType = (() => {
    // 1) irregularType: "strong" | "mixed" | "suppletive"
    if (typeof irregularType === "string" && irregularType.trim()) {
      return irregularType.trim();
    }

    // 2) irregular: { type }
    if (irregular && typeof irregular === "object") {
      const t = irregular.type;
      if (typeof t === "string" && t.trim()) return t.trim();
      if (irregular.enabled === true) return "irregular";
    }

    // 3) irregular: true
    if (irregular === true) return "irregular";

    return "";
  })();

  const irregularTypeText = (() => {
    switch (irregularResolvedType) {
      case "strong":
        return irregularStrongLabel;
      case "mixed":
        return irregularMixedLabel;
      case "suppletive":
        return irregularSuppletiveLabel;
      case "irregular":
        return "";
      default:
        return "";
    }
  })();

  const irregularBadgeText = (() => {
    if (!irregularResolvedType) return "";
    if (!irregularTypeText) return irregularLabel; // 只有 true 不分型
    return `${irregularLabel}${colon}${irregularTypeText}`; // 拆分型
  })();

  // 時態下拉選單
  const [tense, setTense] = useState("praesens");

  // 被選取的格子（給外框用）：{ tense, personKey } | null
  const [selectedCell, setSelectedCell] = useState(null);

  // ✅ focus pulse：只用來做 0.2s 動畫，不影響邏輯
  const pulseRef = useRef({ key: null, ts: 0 });

  // ✅ 用來觸發 0.2s 後 re-render（讓「其他格子變暗」自動恢復）
  const [pulseTick, setPulseTick] = useState(0);
  const pulseTimerRef = useRef(null);

  // ✅ cell refs：用 key 記住每格 DOM，方便 scrollIntoView
  const cellRefs = useRef({}); // { [key: string]: HTMLDivElement | null }

  // ✅ Disable auto-scroll on cell selection (keep selection highlight only)
  // - User request: switching verb cells should NOT trigger scrolling animation
  const DISABLE_CELL_AUTO_SCROLL = true;

  // ✅ 被選取單字特效持續時間
  const PULSE_DURATION_MS = 1000; // 想要多久就改這裡

  function getCellKey(t, personKey) {
    return `${t}:${personKey}`;
  }

  // ✅ When selected cell changes: keep highlight (auto-scroll disabled)
  useEffect(() => {
    if (!selectedCell) return;
    if (!isOpen) return;
    if (DISABLE_CELL_AUTO_SCROLL) return;


    const key = getCellKey(selectedCell.tense, selectedCell.personKey);
    const el = cellRefs.current ? cellRefs.current[key] : null;
    if (!el) return;

    // 等 DOM paint 完再滑，避免 setTense 造成的 DOM 尚未更新
    requestAnimationFrame(() => {
      try {
        el.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      } catch (e) {
        // fallback（少數環境不支援 options）
        try {
          el.scrollIntoView(true);
        } catch (e2) {}
      }
    });
  }, [selectedCell, isOpen, tense]);

  // ✅ pulse 狀態：當 pulseRef 更新時，立刻 re-render 一次，並在 220ms 後再 re-render（讓 dim 自動恢復）
  function triggerPulseRerender() {
    try {
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    } catch (e) {}

    setPulseTick(Date.now());

    pulseTimerRef.current = setTimeout(() => {
      setPulseTick(Date.now());
    }, PULSE_DURATION_MS + 20);
  }

  useEffect(() => {
    return () => {
      try {
        if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      } catch (e) {}
    };
  }, []);

  // ✅ MVP：自動匡選「使用者查到的詞形」（queryWord）
  // - 只在 queryWord 改變時自動定位一次
  // - 規則：在 conjugation 的各時態/人稱中找完全相等；若是 Perfekt 片語，也允許比對最後一個 token（例如 "genommen"）
  useEffect(() => {
    const q = (queryWord || "").trim().toLowerCase();
    if (!q) return;
    if (!conjugation || typeof conjugation !== "object") return;

    const tensesToScan = ["praesens", "praeteritum", "perfekt"];
    for (const t of tensesToScan) {
      const table = conjugation[t];
      if (!table || typeof table !== "object") continue;

      for (const personKey of Object.keys(table)) {
        const raw = table[personKey];
        if (typeof raw !== "string") continue;

        const v = raw.trim().toLowerCase();
        if (!v) continue;

        const lastToken = v.split(/\s+/).pop() || "";
        if (v === q || lastToken === q) {
          setTense(t);
          setSelectedCell({ tense: t, personKey });
          pulseRef.current = {
            key: `${t}:${personKey}`,
            ts: Date.now(),
          };
          triggerPulseRerender(); // ✅ 讓 0.2s dim/pulse 真正生效
          return;
        }
      }
    }
  }, [queryWord, conjugation]);

  const forms =
    conjugation && conjugation[tense] && typeof conjugation[tense] === "object"
      ? conjugation[tense]
      : {};

  const subtypeText = (() => {
    switch (verbSubtype) {
      case "vollverb":
        return subtypeFullVerb;
      case "modal":
        return subtypeModal;
      case "hilfsverb":
        return subtypeAux;
      default:
        return "";
    }
  })();

  // helper 判斷是否選取
  function isSelected(personKey) {
    if (!selectedCell) return false;
    return selectedCell.tense === tense && selectedCell.personKey === personKey;
  }

  // ✅ pulse active：0.2s 內啟用 dim
  const isPulseActive =
    !!pulseRef.current.key && Date.now() - pulseRef.current.ts < PULSE_DURATION_MS;

  // ✅ 下拉共同樣式：小、無外匡、無原生箭頭、底線提示、與動詞更靠近
  const subjectSelectStyle = {
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1,

    border: "none",
    outline: "none",
    boxShadow: "none",
    background: "transparent",
    color: "var(--text-muted)",

    padding: 0,
    height: 18,

    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",

    // ✅ 底線提示：可切換主詞
    borderBottom: "1px solid var(--text-muted)",

    cursor: "pointer",

    // ✅ 讓主詞更貼近後面動詞（不改 ConjugationCell 的 gap）
    marginRight: -3,
  };

  // -----------------------------
  // Step A：反身 + 可分 的合併呈現（顯示 UI 已移除，但邏輯保留）
  // -----------------------------

  const reflexivePronounMap = {
    ich: "mich",
    du: "dich",
    er_sie_es: "sich",
    wir: "uns",
    ihr: "euch",
    sie_Sie: "sich",
  };

  console.debug("[reflexive] reflexivePronounMap", {
    effectiveReflexive,
    dictReflexive: reflexive === true,
    queryHintsReflexive: __queryHintsReflexive === true,
    reflexivePronounMap,
  });


  // ✅ Step D：反身動詞去重 helper（避免 "mich mich"）
  function normalizeTokenForMatch(s) {
    // 只做最小化：去頭尾標點，保留德文字母
    return String(s || "")
      .trim()
      .replace(/^[^\p{L}]+/gu, "")
      .replace(/[^\p{L}]+$/gu, "")
      .toLowerCase();
  }

  function hasStandaloneToken(text, token) {
    const t = String(token || "").trim().toLowerCase();
    if (!t) return false;

    const parts = String(text || "").split(/\s+/).filter(Boolean);
    for (const p of parts) {
      if (normalizeTokenForMatch(p) === t) return true;
    }
    return false;
  }

  // 常見可分前綴（簡化版）
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
    // 若 lemma 本身已含空白（例如 "sich vorbereiten"），先取最後一段
    const last = w.split(/\s+/).slice(-1)[0] || w;

    // 最長匹配優先
    const sorted = [...separablePrefixes].sort((a, b) => b.length - a.length);
    for (const p of sorted) {
      if (last.startsWith(p) && last.length > p.length + 1) return p;
    }
    return "";
  }

  // ✅ 改：不管後端 separable true/false 都做偵測（容錯）
  const detectedPrefix = useMemo(() => detectSeparablePrefix(baseForm), [
    baseForm,
    separablePrefixes,
  ]);

  // ✅ 改：有效可分判斷（後端誤標時也能補救）
  const effectiveSeparable = separable === true && !!detectedPrefix;

  const valenzText =
    Array.isArray(valenz) && valenz.length > 0
      ? valenz
          .map((v) => {
            const p = v?.prep || "";
            const k = v?.kasus || "";
            const n = v?.note || "";
            if (p && k) return `${p} + ${k}`;
            if (p) return p;
            if (k) return k;
            if (n) return n;
            return "";
          })
          .filter(Boolean)
          .join("；")
      : "";

  function splitSeparableFiniteForm(raw, prefix) {
    const s = (raw || "").trim();
    if (!s || !prefix) return { core: s, suffix: "" };

    const prefixLower = String(prefix || "").trim().toLowerCase();
    if (!prefixLower) return { core: s, suffix: "" };

    // ✅ Case 1（最常見）：前綴已經在句尾（可分離動詞有限式）
    // e.g. "bringe das Kind weg", "bereitest dich vor"
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1] || "";
      if (String(last).toLowerCase() === prefixLower) {
        const core = parts.slice(0, -1).join(" ").trim();
        if (core) return { core, suffix: last }; // suffix 用 last（保留原大小寫）
      }
    }

    // ✅ Case 2（fallback/legacy）：前綴黏在開頭
    // e.g. "wegbringe"（某些來源會不正常回這種）
    const lower = s.toLowerCase();
    if (!lower.startsWith(prefixLower)) return { core: s, suffix: "" };

    const core = s.slice(String(prefix).length).trim();
    if (!core) return { core: s, suffix: "" };

    return { core, suffix: prefix };
  }

  function injectReflexivePerfekt(raw, personKey) {
    const s = (raw || "").trim();
    if (!s) return s;

    const pron = reflexivePronounMap[personKey] || "";
    if (!pron) return s;

    // ✅ Step D：如果 raw 內已經有該 pronoun，就不要再 inject（避免 "habe mich mich ..."）
    if (hasStandaloneToken(s, pron)) return s;

    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return `${s} ${pron}`.trim();

    const aux = parts[0];
    const rest = parts.slice(1).join(" ");
    return `${aux} ${pron} ${rest}`.trim();
  }

  function buildDisplayForm(personKey, rawValue) {
    const raw = (rawValue || "").trim();
    if (!raw) return "";

    const needsReflexive =
      effectiveReflexive === true ||
      /^\s*sich\s+/i.test(String(queryWord || "")) ||
      /^\s*sich\s+/i.test(String(baseForm || ""));

    const needsSeparable =
      effectiveSeparable === true &&
      detectedPrefix &&
      (tense === "praesens" || tense === "praeteritum");

    if (tense === "perfekt") {
      if (!needsReflexive) return raw;
      return injectReflexivePerfekt(raw, personKey);
    }

    let core = raw;
    let suffix = "";
    if (needsSeparable) {
      const splitted = splitSeparableFiniteForm(raw, detectedPrefix);
      core = (splitted.core || "").trim();
      suffix = (splitted.suffix || "").trim();
    }

    const pron = needsReflexive ? reflexivePronounMap[personKey] || "" : "";

    // ✅ Step D：反身動詞去重
    // - 如果 raw/core 裡已經有 mich/dich/sich/uns/euch，就不要再 append
    const shouldAppendPron = (() => {
      if (!pron) return false;
      // core already has pron → don't append
      if (hasStandaloneToken(core, pron)) return false;
      // suffix 若也是 pron（理論上不會）→ don't append
      if (hasStandaloneToken(suffix, pron)) return false;
      // raw already has pron → don't append（保守）
      if (hasStandaloneToken(raw, pron)) return false;
      return true;
    })();

    const chunks = [core];
    if (shouldAppendPron) chunks.push(pron);
    if (suffix) chunks.push(suffix);

    return chunks.filter(Boolean).join(" ").trim();
  }

  function handleCellClick(personKey, rawValue) {
    const displayed = buildDisplayForm(personKey, rawValue);
    const trimmed = (displayed || "").trim();
    if (!trimmed) return;

    const next = { tense, personKey };
    setSelectedCell(next);

    // ✅ 手動點選也做 0.2s focus（你要的效果）
    pulseRef.current = {
      key: `${tense}:${personKey}`,
      ts: Date.now(),
    };
    triggerPulseRerender();

    // ✅ Step E（方案A）：把「主詞 + 動詞詞形」透過 onSelectForm 往上回拋
    // - 上層 WordPosInfo.handleSpeakForm 會：
    //   1) 播放 TTS（de-DE）
    //   2) 透過 onEntrySurfaceChange 同步例句 header 的 headword override
    //
    // ⚠️ 注意：這裡只改 header/headword，不會自動重新造句（造句仍由使用者手動點按鈕觸發）
    const subjectMap = {
      ich: ichLabel,
      du: duLabel,
      er_sie_es: thirdPerson,
      wir: wirLabel,
      ihr: ihrLabel,
      sie_Sie: siePerson,
    };
    const subjectText = (subjectMap[personKey] || "").trim();
    const surfaceWithSubject = subjectText ? `${subjectText} ${trimmed}` : trimmed;

    if (typeof onSelectForm === "function") {
      onSelectForm({
        pos: "Verb",
        baseForm,
        tense,
        personKey,
        surface: surfaceWithSubject, // ✅ 例句 header 要顯示這個（含主詞）
        form: trimmed, // ✅ 保留純詞形（不含主詞），給上游如果要用
        verbSubtype: verbSubtype || "",
        separable: !!effectiveSeparable,
        reflexive: !!effectiveReflexive,
      });
      return; // ✅ 交給上層 handleSpeakForm 播放 TTS + 同步 header
    }

    // ✅ fallback：若外層沒有傳 onSelectForm，就在這裡直接播放 TTS（避免點了沒反應）
    try {
      const spokenText = surfaceWithSubject;
      playTTS(spokenText, "de-DE");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[WordPosInfoVerb] playTTS failed:", e);
    }
  }

  // raw forms
  const ichRaw = forms.ich || "";
  const duRaw = forms.du || "";
  const erSieEsRaw = forms.er_sie_es || "";
  const wirRaw = forms.wir || "";
  const ihrRaw = forms.ihr || "";
  const sieSieRaw = forms.sie_Sie || "";

  // display forms
  const ichDisplay = buildDisplayForm("ich", ichRaw);
  const duDisplay = buildDisplayForm("du", duRaw);
  const erSieEsDisplay = buildDisplayForm("er_sie_es", erSieEsRaw);
  const wirDisplay = buildDisplayForm("wir", wirRaw);
  const ihrDisplay = buildDisplayForm("ihr", ihrRaw);
  const sieSieDisplay = buildDisplayForm("sie_Sie", sieSieRaw);

  // ✅ DEPRECATED: recommendations UI moved to WordPosInfo.jsx
  const headerText = `${posLabel}｜${title}`;

  const ARROW_SIZE = 30;
  const HEADER_FONT_SIZE = 12;
  const HEADER_PADDING_Y = 7;
  const HEADER_PADDING_X = 10;

  const OuterBoxStyle = {
    marginTop: 8,
    border: "1px solid var(--border-subtle)",
    borderRadius: 0,
    background: "transparent",
    overflow: "hidden",
  };

  const HeaderRow = (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { /* deprecated: internal collapse removed */ }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          /* deprecated: internal collapse removed */
          e.preventDefault();
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: `${HEADER_PADDING_Y}px ${HEADER_PADDING_X}px`,
        borderBottom: "1px solid var(--border-subtle)",
        background: "transparent",
        borderRadius: 0,
        cursor: "pointer",
        userSelect: "none",
        outline: "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 18,
          display: "none",
          textAlign: "center",
          fontSize: ARROW_SIZE,
          lineHeight: 1,
          color: "var(--text-main)",
          opacity: 0.85,
        }}
      >
        {""}
      </span>

      <div
        style={{
          fontSize: HEADER_FONT_SIZE,
          fontWeight: 700,
          color: "var(--text-main)",
        }}
      >
        {headerText}
      </div>
    </div>
  );

  // ✅ deprecated: internal collapse removed (kept for history), always render expanded
  if (false && !isOpen) {
    return (
      <div style={OuterBoxStyle}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => { /* deprecated: internal collapse removed */ }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              /* deprecated: internal collapse removed */
              e.preventDefault();
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: `${HEADER_PADDING_Y}px ${HEADER_PADDING_X}px`,
            borderBottom: "none",
            background: "transparent",
            cursor: "pointer",
            userSelect: "none",
            outline: "none",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 18,
              display: "none",
          display: "none",
              textAlign: "center",
              fontSize: ARROW_SIZE,
              lineHeight: 1,
              color: "var(--text-main)",
              opacity: 0.85,
            }}
          >
            {""}
          </span>

          <div
            style={{
              fontSize: HEADER_FONT_SIZE,
              fontWeight: 700,
              color: "var(--text-main)",
            }}
          >
            {headerText}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={OuterBoxStyle}>
      {HeaderRow}

      <div
        style={{
          padding: 10,
          borderRadius: 0,
          backgroundColor: "var(--bg-card)",
          border: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-main)",
            }}
          >
            <span>
              {tenseSelectLabel}
              {colon}
            </span>
            <select
              value={tense}
              onChange={(e) => setTense(e.target.value)}
              style={{
                fontSize: 13,
                padding: "2px 6px",
                borderRadius: 0,
                border: "1px solid var(--border-subtle)",
                background: "transparent",
                color: "var(--text-main)",
              }}
            >
              <option value="praesens">{praesensLabel}</option>
              <option value="praeteritum">{praeteritumLabel}</option>
              <option value="perfekt">{perfektLabel}</option>
            </select>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              justifyContent: "flex-end",
              fontSize: 11,
            }}
          >
            {auxiliary && (
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 0,
                  backgroundColor: "var(--bg-soft)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                }}
              >
                {auxiliaryLabel}
                {colon}
                {auxiliary}
              </span>
            )}

            {/* ✅ 多國一致性：不顯示「不規則」badge（邏輯仍保留） */}
            {false && irregularBadgeText && (
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 0,
                  backgroundColor: "var(--bg-soft)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                }}
              >
                {irregularBadgeText}
              </span>
            )}

            {/* ✅ 若未來要顯示 subtype（目前原檔沒顯示，保留計算結果不動） */}
            {false && subtypeText && (
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 0,
                  backgroundColor: "var(--bg-soft)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                }}
              >
                {subtypeLabel}
                {colon}
                {subtypeText}
              </span>
            )}
          </div>
        </div>

        {valenzText && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            <strong>
              {valenzLabel}
              {colon}
            </strong>
            <span>{valenzText}</span>
          </div>
        )}

        <div
          style={{
            padding: 8,
            borderRadius: 0,
            backgroundColor: "var(--bg-soft)",
            border: "1px solid var(--border-subtle)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            columnGap: 8,
            rowGap: 4,
          }}
        >
          <ConjugationCell
            label={ichLabel}
            value={ichDisplay || noFormText}
            hasValue={!!ichDisplay}
            isSelected={isSelected("ich")}
            onClick={() => handleCellClick("ich", ichRaw)}
            cellRef={(el) => {
              cellRefs.current[getCellKey(tense, "ich")] = el;
            }}
            isPulse={
              pulseRef.current.key === getCellKey(tense, "ich") &&
              Date.now() - pulseRef.current.ts < 200
            }
            isPulseActive={isPulseActive}
          />
          <ConjugationCell
            label={duLabel}
            value={duDisplay || noFormText}
            hasValue={!!duDisplay}
            isSelected={isSelected("du")}
            onClick={() => handleCellClick("du", duRaw)}
            cellRef={(el) => {
              cellRefs.current[getCellKey(tense, "du")] = el;
            }}
            isPulse={
              pulseRef.current.key === getCellKey(tense, "du") &&
              Date.now() - pulseRef.current.ts < 200
            }
            isPulseActive={isPulseActive}
          />

          <ConjugationCell
            label={
              <select
                value={thirdPerson}
                onChange={(e) => setThirdPerson(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={subjectSelectStyle}
                aria-label={erSieEsLabel}
              >
                <option value="er">er</option>
                <option value="sie">sie</option>
                <option value="es">es</option>
              </select>
            }
            value={erSieEsDisplay || noFormText}
            hasValue={!!erSieEsDisplay}
            isSelected={isSelected("er_sie_es")}
            onClick={() => handleCellClick("er_sie_es", erSieEsRaw)}
            cellRef={(el) => {
              cellRefs.current[getCellKey(tense, "er_sie_es")] = el;
            }}
            isPulse={
              pulseRef.current.key === getCellKey(tense, "er_sie_es") &&
              Date.now() - pulseRef.current.ts < 200
            }
            isPulseActive={isPulseActive}
          />

          <ConjugationCell
            label={wirLabel}
            value={wirDisplay || noFormText}
            hasValue={!!wirDisplay}
            isSelected={isSelected("wir")}
            onClick={() => handleCellClick("wir", wirRaw)}
            cellRef={(el) => {
              cellRefs.current[getCellKey(tense, "wir")] = el;
            }}
            isPulse={
              pulseRef.current.key === getCellKey(tense, "wir") &&
              Date.now() - pulseRef.current.ts < 200
            }
            isPulseActive={isPulseActive}
          />

          <ConjugationCell
            label={ihrLabel}
            value={ihrDisplay || noFormText}
            hasValue={!!ihrDisplay}
            isSelected={isSelected("ihr")}
            onClick={() => handleCellClick("ihr", ihrRaw)}
            cellRef={(el) => {
              cellRefs.current[getCellKey(tense, "ihr")] = el;
            }}
            isPulse={
              pulseRef.current.key === getCellKey(tense, "ihr") &&
              Date.now() - pulseRef.current.ts < 200
            }
            isPulseActive={isPulseActive}
          />

          <ConjugationCell
            label={
              <select
                value={siePerson}
                onChange={(e) => setSiePerson(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={subjectSelectStyle}
                aria-label={sieSieLabel}
              >
                <option value="sie">sie</option>
                <option value="Sie">Sie</option>
              </select>
            }
            value={sieSieDisplay || noFormText}
            hasValue={!!sieSieDisplay}
            isSelected={isSelected("sie_Sie")}
            onClick={() => handleCellClick("sie_Sie", sieSieRaw)}
            cellRef={(el) => {
              cellRefs.current[getCellKey(tense, "sie_Sie")] = el;
            }}
            isPulse={
              pulseRef.current.key === getCellKey(tense, "sie_Sie") &&
              Date.now() - pulseRef.current.ts < 200
            }
            isPulseActive={isPulseActive}
          />
        </div>

        {/* ✅ DEPRECATED: recommendations UI moved to WordPosInfo.jsx */}
      </div>
    </div>
  );
}

function RecRow({ label, items, onClick }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 6,
      }}
    >
      <div
        style={{
          width: 56,
          fontSize: 12,
          color: "var(--text-muted)",
          paddingTop: 2,
        }}
      >
        {label}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((w) => (
          <button
            key={String(w)}
            type="button"
            onClick={() => onClick && onClick(w)}
            style={{
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-main)",
              borderRadius: 0,
              padding: "3px 8px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {String(w)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ✅ 注意：這裡補上 isPulse / isPulseActive，否則你原檔會用到未定義變數
function ConjugationCell({
  label,
  value,
  hasValue,
  isSelected,
  onClick,
  cellRef,
  isPulse,
  isPulseActive,
}) {
  const baseStyle = {
    borderRadius: 0,
    padding: "6px 8px",
    backgroundColor: "transparent",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    boxSizing: "border-box",
    transition:
      "background-color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
    fontWeight: 700,
  };

  const finalOpacity = (() => {
    // 沒有內容：維持原本偏淡
    if (!hasValue) return 0.55;

    // pulse 期間：非選取格子退暗
    if (isPulseActive) {
      if (isSelected) return 1;
      if (isPulse) return 1;
      return 0.45;
    }

    // 平常：正常顯示
    return 1;
  })();

  const finalStyle = {
    ...baseStyle,
    border: isSelected ? "2px solid var(--accent)" : "1px solid transparent",
    backgroundColor: isSelected ? "var(--bg-elevated)" : "transparent",
    cursor: hasValue ? "pointer" : "default",
    opacity: finalOpacity,
  };

  return (
    <div
      ref={cellRef}
      style={finalStyle}
      className={`${isPulse ? "cell-pulse" : ""}`}
      onClick={hasValue ? onClick : undefined}
    >
      <span
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: 14,
          color: "var(--text-main)",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}
// frontend/src/components/posInfo/WordPosInfoVerb.jsx
