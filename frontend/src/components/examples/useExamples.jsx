// frontend/src/components/examples/useExamples.jsx
/**
 * 📌 檔案說明（useExamples Hook）
 * - 用途：管理 examples / exampleTranslation 狀態，並提供 refreshExamples() 取得（或重新產生）例句
 *
 * ✅ Root Cause（已由 DevTools call stack 確認）
 * - 切換 history 時，上層 setResult(resultSnapshot) 造成 d 物件引用變動
 * - 本檔第二個 useEffect（依賴 d/senseIndex/explainLang）無條件 refreshExamples()
 * - 因此 history replay 也會重打 /api/dictionary/examples
 *
 * ✅ 本次異動（2026/01/05）
 * - 修正：加入「history replay guard」：若 d 已含 examples/example，跳過自動 refresh，避免切換歷史重查
 * - 新增：Production 排查初始化狀態（預設關閉），可觀察 auto-refresh 是否被 guard 擋下
 *
 * ✅ 本次異動（2026/01/05 - MultiRef payload）
 * - 新增：支援從外部傳入 multiRefEnabled / refs（可選）
 * - 新增：refreshExamples() payload 夾帶 multiRef / refs
 * - 新增：使用 ref 保存最新 multiRefEnabled/refs，避免 refs 變動造成 refreshExamples useCallback 依賴變動
 *         進而連動 auto-refresh useEffect（維持「切換歷史不查詢」的核心規則）
 *
 * ✅ 本次異動（2026/01/05 - Phase 2-3 used/missing refs 接線）
 * - 新增：接後端回傳 usedRefs / missingRefs（向後相容）
 * - 新增：同步 d.usedRefs / d.missingRefs（若存在）到 hook state，支援 history snapshot 回放
 * - 新增：refreshExamples() 後將 data.usedRefs/data.missingRefs 存入 state 並 return 給 UI render
 *
 * ✅ 本次異動（2026/01/11 - Phase X-0 surfaceForms 導入管線）
 * - 新增：buildEffectiveRefs()（預設 passthrough，不改 refs）
 * - 新增：refreshExamples() 送出前將 refs 轉為 effectiveRefs（passthrough）
 *
 * ✅ 本次異動（2026/01/11 - Phase X-1 noun surfaceForms）
 * - 新增：名詞在 UI 選 caseOpt + articleType=def 時，僅對 kind==="entry" 補 surfaceForms
 * - 原則：
 *   - kind==="custom"（手動新增 badge）永遠不動，避免干擾手動 refs 機制
 *   - surfaceForms 用「加法」：[key, `${article} ${key}`]，避免命中判定過嚴
 *
 * ⚠️ 開發規範備註
 * - 不刪除既有 function
 * - 不合併 useEffect
 * - 不重排區塊
 * - 行數只增不減
 *
 * 功能初始化狀態（Production 排查）
 * - USE_EXAMPLES_PROD_DIAG.enabled = false（預設關閉）
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../../utils/apiClient";

/**
 * ✅ Production 排查開關（預設關閉）
 * - enabled: true 時才輸出 console
 * - 注意：不影響任何業務邏輯
 */
const USE_EXAMPLES_PROD_DIAG = {
  enabled: false,
  tag: "[useExamples]",
};

/**
 * 中文功能說明：
 * - diagLog：統一控管 debug log（Production 預設關閉）
 */
function diagLog(...args) {
  if (!USE_EXAMPLES_PROD_DIAG.enabled) return;
  // eslint-disable-next-line no-console
  console.log(USE_EXAMPLES_PROD_DIAG.tag, ...args);
}

/**
 * ✅ Phase X-1：Noun（Definite article）→ surfaceForms helper
 * 中文功能說明：
 * - 目前僅支援 articleType="def" 的四格基本冠詞（不處理複數變化、genitiv -s/-es 等詞尾）
 * - 性別接受值：m/f/n/pl（也容忍 "masc" "fem" "neut" "plural" 之類字首）
 */
function normalizeGender(g) {
  const s = String(g || "").toLowerCase().trim();
  if (!s) return "";
  if (s === "m" || s.startsWith("m")) return "m";
  if (s === "f" || s.startsWith("f")) return "f";
  if (s === "n" || s.startsWith("n")) return "n";
  if (s === "pl" || s.startsWith("pl") || s.startsWith("p")) return "pl";
  return "";
}

function getDefiniteArticleForNoun({ caseOpt, gender }) {
  const c = String(caseOpt || "").toLowerCase().trim();
  const g = normalizeGender(gender);

  // 支援：nominativ/akkusativ/dativ/genitiv（也容忍縮寫 nom/akk/dat/gen）
  const cc =
    c === "nom" ? "nominativ"
    : c === "akk" ? "akkusativ"
    : c === "dat" ? "dativ"
    : c === "gen" ? "genitiv"
    : c;

  if (!cc || !g) return "";

  if (cc === "nominativ") {
    if (g === "m") return "der";
    if (g === "f") return "die";
    if (g === "n") return "das";
    if (g === "pl") return "die";
  }

  if (cc === "akkusativ") {
    if (g === "m") return "den";
    if (g === "f") return "die";
    if (g === "n") return "das";
    if (g === "pl") return "die";
  }

  if (cc === "dativ") {
    if (g === "m") return "dem";
    if (g === "f") return "der";
    if (g === "n") return "dem";
    if (g === "pl") return "den";
  }

  if (cc === "genitiv") {
    if (g === "m") return "des";
    if (g === "f") return "der";
    if (g === "n") return "des";
    if (g === "pl") return "der";
  }

  return "";
}

/**
 * ✅ Phase X-0/X-1：surfaceForms 導入管線
 * 中文功能說明：
 * - buildEffectiveRefs：把 UI 當下的 refs 轉成「這次 refresh 要送出的 refs」
 * - 原則：
 *   - kind==="custom"（手動新增 badge）永遠不動，避免干擾手動 refs 機制
 *   - 目前僅導入：Noun + articleType="def" + caseOpt 有值 → 對 entry refs 補 surfaceForms
 */
function buildEffectiveRefs(rawRefs, ctx) {
  if (!Array.isArray(rawRefs)) return [];

  const pos = String(ctx?.partOfSpeech || "").toLowerCase().trim();
  const caseOpt = ctx?.caseOpt;
  const articleType = String(ctx?.articleType || "").toLowerCase().trim();
  const gender = ctx?.gender;

  // 目前只處理名詞（noun / substantiv）
  const isNoun =
    pos === "noun" ||
    pos === "substantiv" ||
    pos === "nomen" ||
    pos === "n";

  // 目前只處理 definite article（def）
  const isDef = articleType === "def";

  const article = isNoun && isDef && caseOpt
    ? getDefiniteArticleForNoun({ caseOpt, gender })
    : "";

  // 沒有可用冠詞 → passthrough（不改）
  if (!article) return rawRefs;

  return rawRefs.map((ref) => {
    if (!ref) return ref;

    // ✅ 手動 badge 完全不動
    if (ref.kind === "custom") return ref;

    // ✅ 只針對 entry refs
    if (ref.kind !== "entry") return ref;

    const key = typeof ref.key === "string" ? ref.key.trim() : "";
    if (!key) return ref;

    const phrase = `${article} ${key}`.trim();

    // ✅ surfaceForms 用「加法」，避免命中判定過嚴
    const nextSurfaceForms = [key, phrase];

    // 若原本已經有 surfaceForms，保守合併（不覆蓋）
    const existing = Array.isArray(ref.surfaceForms) ? ref.surfaceForms : [];
    const merged = [...existing, ...nextSurfaceForms]
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());

    // 去重（保持順序）
    const dedup = [];
    for (const s of merged) {
      if (!dedup.includes(s)) dedup.push(s);
    }

    return {
      ...ref,
      surfaceForms: dedup,
    };
  });
}

export default function useExamples({
  d,
  senseIndex,
  caseOpt,
  articleType,
  explainLang,

  // ✅ 新增（可選）：多重參考（不破壞既有呼叫）
  multiRefEnabled,
  refs,
}) {
  const [examples, setExamples] = useState(
    d && Array.isArray(d.examples)
      ? d.examples
      : d && d.example
      ? [d.example]
      : []
  );

  const [exampleTranslation, setExampleTranslation] = useState(
    d && typeof d.exampleTranslation === "string"
      ? d.exampleTranslation
      : ""
  );

  const [loading, setLoading] = useState(false);

  // =========================
  // Phase 2-3：usedRefs / missingRefs（向後相容）
  // =========================
  /**
   * 中文功能說明：
   * - usedRefs：LLM/後端回報「實際用到的 refs key」
   * - missingRefs：後端後驗（或 LLM 回報）「未用到的 refs key」
   * - 注意：若後端未回傳（舊版），一律回到空陣列，保持向後相容
   */
  const [usedRefs, setUsedRefs] = useState(
    d && Array.isArray(d.usedRefs) ? d.usedRefs : []
  );

  const [missingRefs, setMissingRefs] = useState(
    d && Array.isArray(d.missingRefs) ? d.missingRefs : []
  );

  /**
   * 中文功能說明：
   * - multiRefPayloadRef：保存最新 multiRefEnabled / refs
   * - 目的：refreshExamples 不把 refs 直接納入 useCallback deps
   *         避免 refs 變動 -> refreshExamples 引用變動 -> 連動 auto-refresh useEffect
   * - 原則：只允許「使用者手動 refresh」才發 request；切換歷史不應因 refs state 改變而偷查詢
   */
  const multiRefPayloadRef = useRef({
    multiRefEnabled: false,
    refs: [],
  });

  /**
   * 中文功能說明：
   * - 同步外部傳入的 multiRefEnabled/refs 到 ref（不影響既有流程）
   * - 注意：這個 useEffect 不呼叫 refreshExamples，不會造成 API 查詢
   */
  useEffect(() => {
    multiRefPayloadRef.current = {
      multiRefEnabled: !!multiRefEnabled,
      refs: Array.isArray(refs) ? refs : [],
    };

    // ✅ Production 排查：refs 同步狀態（預設關閉）
    diagLog("multiRef:sync", {
      word: d?.word,
      senseIndex,
      explainLang,
      multiRefEnabled: !!multiRefEnabled,
      refsCount: Array.isArray(refs) ? refs.length : 0,
    });
  }, [multiRefEnabled, refs, d, senseIndex, explainLang]);

  /**
   * 中文功能說明：
   * - lastAutoRefreshDecisionRef：紀錄最後一次「自動 refresh」的決策（僅供排查）
   * - 目的：確認切換 history 時，是否被 guard 擋下（或仍自動重查）
   */
  const lastAutoRefreshDecisionRef = useRef({
    at: null,
    action: "init", // init | skipped | fetched
    reason: "",
    word: "",
    senseIndex: null,
    explainLang: "",
  });

  useEffect(() => {
    if (!d) {
      setExamples([]);
      setExampleTranslation("");

      // ✅ Phase 2-3：同步清空（避免殘留上一筆）
      setUsedRefs([]);
      setMissingRefs([]);

      return;
    }

    if (Array.isArray(d.examples) && d.examples.length > 0) {
      setExamples(d.examples);
    } else if (typeof d.example === "string" && d.example.trim()) {
      setExamples([d.example]);
    } else {
      setExamples([]);
    }

    if (
      typeof d.exampleTranslation === "string" &&
      d.exampleTranslation.trim()
    ) {
      setExampleTranslation(d.exampleTranslation.trim());
    } else {
      setExampleTranslation("");
    }

    // ✅ Phase 2-3：若 d 本身帶有 usedRefs/missingRefs（例如 history snapshot），同步進 state
    if (Array.isArray(d.usedRefs)) {
      setUsedRefs(d.usedRefs);
    } else {
      setUsedRefs([]);
    }

    if (Array.isArray(d.missingRefs)) {
      setMissingRefs(d.missingRefs);
    } else {
      setMissingRefs([]);
    }

    // ✅ Production 排查：同步狀態來源
    diagLog("sync-from-d", {
      word: d?.word,
      hasExamples: Array.isArray(d?.examples) && d.examples.length > 0,
      hasExample: typeof d?.example === "string" && d.example.trim().length > 0,
      hasUsedRefs: Array.isArray(d?.usedRefs),
      hasMissingRefs: Array.isArray(d?.missingRefs),
      senseIndex,
      explainLang,
    });
  }, [d]);

  const refreshExamples = useCallback(async () => {
    if (!d || !d.word) return;

    setLoading(true);

    try {
      // ✅ 取得最新 multiRef payload（不依賴 deps）
      const multiRefPayload = multiRefPayloadRef.current || {
        multiRefEnabled: false,
        refs: [],
      };

      // ✅ Phase X-0/X-1：建立 effective refs（Noun + Definite article 時補 surfaceForms）
      const effectiveRefs = buildEffectiveRefs(
        Array.isArray(multiRefPayload.refs) ? multiRefPayload.refs : [],
        {
          word: d.word,
          baseForm: d.baseForm,
          partOfSpeech: d.partOfSpeech,
          gender: d.gender,
          senseIndex,
          explainLang,
          caseOpt,
          articleType,
        }
      );

      const resp = await apiFetch("/api/dictionary/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: d.word,
          baseForm: d.baseForm,
          partOfSpeech: d.partOfSpeech,
          gender: d.gender,
          senseIndex,

          definitionDe: d.definition_de,
          definition: d.definition,
          definitionDeList: d.definition_de_list || [],
          definitionLangList: d.definition_list || [],

          explainLang,

          options: {
            polarity: "pos",
            case: caseOpt || undefined,
            articleType: articleType || undefined,
          },

          // ✅ 新增：多重參考 payload（後端可忽略，不影響舊邏輯）
          multiRef: !!multiRefPayload.multiRefEnabled,
          refs: Array.isArray(effectiveRefs) ? effectiveRefs : [],

          // ⚠️ 既有行為保留（不可刪）
          _ts: Date.now(),
        }),
      });

      const data = await resp.json();

      if (data && Array.isArray(data.examples)) {
        setExamples(
          data.examples.filter(
            (s) => typeof s === "string" && s.trim().length > 0
          )
        );

        if (
          typeof data.exampleTranslation === "string" &&
          data.exampleTranslation.trim()
        ) {
          setExampleTranslation(data.exampleTranslation.trim());
        }
      }

      // =========================
      // ✅ Phase 2-3：接後端回傳 usedRefs / missingRefs（向後相容）
      // =========================
      /**
       * 中文功能說明：
       * - 後端 schema（Phase 2-1/2-2）應回傳 usedRefs（必有）與 missingRefs（可能空）
       * - 為避免舊版後端未回傳，這裡做保守回退到 []
       * - 注意：此段不改查詢規則，只是把 response 內容存起來供 UI 顯示
       */
      const nextUsedRefs = Array.isArray(data?.usedRefs) ? data.usedRefs : [];
      const nextMissingRefs = Array.isArray(data?.missingRefs) ? data.missingRefs : [];

      setUsedRefs(nextUsedRefs);
      setMissingRefs(nextMissingRefs);

      // ✅ Production 排查：這次確實有打到後端
      diagLog("refreshExamples:fetched", {
        word: d?.word,
        senseIndex,
        explainLang,
        returnedCount: Array.isArray(data?.examples) ? data.examples.length : 0,
        multiRef: !!multiRefPayload.multiRefEnabled,
        refsCount: Array.isArray(multiRefPayload.refs)
          ? multiRefPayload.refs.length
          : 0,
        usedRefsCount: nextUsedRefs.length,
        missingRefsCount: nextMissingRefs.length,
      });
    } catch (err) {
      console.error("useExamples refresh error:", err);
    }

    setLoading(false);
  }, [d, senseIndex, caseOpt, articleType, explainLang]);

  useEffect(() => {
    if (!d || !d.word) return;

    /**
     * ✅ 修正點（單一修改點）：history replay guard
     * - 若 d 已含 examples/example，代表這次 d 可能來自 history snapshot 回放
     * - 此時不應自動 refreshExamples()，避免切換歷史時重查例句
     *
     * 不影響：
     * - 初次沒有例句時仍會自動補齊
     * - 手動 refresh（UI 呼叫 refreshExamples）仍會打 API
     */
    const hasExamplesFromD =
      Array.isArray(d.examples) && d.examples.length > 0;

    const hasSingleExampleFromD =
      typeof d.example === "string" && d.example.trim().length > 0;

    if (hasExamplesFromD || hasSingleExampleFromD) {
      lastAutoRefreshDecisionRef.current = {
        at: Date.now(),
        action: "skipped",
        reason: hasExamplesFromD
          ? "auto-refresh skipped: d.examples exists (likely history replay/snapshot)"
          : "auto-refresh skipped: d.example exists (likely history replay/snapshot)",
        word: d.word,
        senseIndex,
        explainLang,
      };

      diagLog("auto-refresh:skipped", lastAutoRefreshDecisionRef.current);
      return;
    }

    lastAutoRefreshDecisionRef.current = {
      at: Date.now(),
      action: "fetched",
      reason: "auto-refresh: no examples on d, fetching from backend",
      word: d.word,
      senseIndex,
      explainLang,
    };

    diagLog("auto-refresh:start", lastAutoRefreshDecisionRef.current);

    // ✅ 原本行為保留，只是多了 guard
    refreshExamples();
  }, [d, senseIndex, explainLang, refreshExamples]);

  return {
    examples,
    exampleTranslation,
    loading,
    refreshExamples,

    // ✅ Phase 2-3：提供給 UI 顯示（WordExampleBlock 會用到）
    usedRefs,
    missingRefs,

    // ✅ Production 排查：外部若想讀取（可選）
    _prodDiag: {
      lastAutoRefreshDecisionRef,
    },
  };
}
// frontend/src/components/examples/useExamples.jsx
