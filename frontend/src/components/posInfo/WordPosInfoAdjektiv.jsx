// frontend/src/components/WordPosInfoAdjektiv.jsx
//
// =====================================================
// 文件說明（請保留）
// -----------------------------------------------------
// 形容詞（Adjektiv）變化資訊區塊（比照 WordPosInfoVerb 風格）
// - 折疊卡片（Header + Arrow）
// - 顯示：原級 / 比較級 / 最高級
// - 顯示：弱 / 混合 / 強 變化各一例
// - 多國語系：從 uiText[currentLang].adjektivCard（或 adjectiveCard）讀取 labels
//
// ⚠️ 本檔案的多國語系規則（嚴格模式）
// - 元件內禁止「特定語言 fallback」（例如 zh-TW / de / en）
// - uiLang 不存在或 uiText 無對應 key → 一律顯示 "-"（不自行猜測）
// - 禁止寫死示例名詞（例如 Mann）
//
// -----------------------------------------------------
// 異動紀錄（必須保留舊紀錄）
// - 2026-01-04：
//   1) 套用嚴格多國語系：移除元件內 zh-TW 預設語言與中文硬寫死 fallback（保留舊碼但標 deprecated）
//   2) 移除示例名詞 Mann（改為由 uiText 提供 nounPlaceholder；若缺則顯示 "-"）
//   3) 加入 Production 排查用初始化狀態與 console 觀測（低頻、不影響功能）
// - 2026-01-05：
//   1) 修正 strict 模式下「部分未套到字串」：加入 uiLang 正規化（先 exact，再 base language，如 en-US→en）
//   2) 加入 langResolve console.debug，便於 runtime 追查 uiLang 實際值與命中結果
// =====================================================

import React, { useMemo, useState } from "react";
import uiText from "../../uiText";

export default function WordPosInfoAdjektiv({ baseForm, labels = {}, uiLang, extraInfo, onSelectForm }) {
  if (!baseForm) return null;

  // ✅ 折疊（比照 WordPosInfoVerb / WordPosInfoNoun）
  const [isOpen, setIsOpen] = useState(true);

  // =========================
  // [形容詞優化] Declension UI state
  // - mode: mixed | strong | weak
  // - kase: nom | acc | dat | gen
  // =========================
  const [declMode, setDeclMode] = useState("weak");
  const [declCase, setDeclCase] = useState("nom");
  const [declGender, setDeclGender] = useState("m");
  const [selectedDeclKey, setSelectedDeclKey] = useState("");
  const [selectedDegreeKey, setSelectedDegreeKey] = useState("");

  // ✅ declinable: whether adjective is typically inflected (used to gate declension endings)
  const __declinable = extraInfo?.declinable !== false;

  const __DECL_ENDINGS__ = useMemo(() => {
  // M/F/N/P endings (P = Plural)
  // Note: This is a compact reference for UI purposes, not a full grammar engine.
  const strong = {
    nom: { m: "er", f: "e", n: "es", p: "e" },
    acc: { m: "en", f: "e", n: "es", p: "e" },
    dat: { m: "em", f: "er", n: "em", p: "en" },
    gen: { m: "en", f: "er", n: "en", p: "er" },
  };

  const mixed = {
    nom: { m: "er", f: "e", n: "es", p: "en" },
    acc: { m: "en", f: "e", n: "es", p: "en" },
    dat: { m: "en", f: "en", n: "en", p: "en" },
    gen: { m: "en", f: "en", n: "en", p: "en" },
  };

  const weak = {
    nom: { m: "e", f: "e", n: "e", p: "en" },
    acc: { m: "en", f: "e", n: "e", p: "en" },
    dat: { m: "en", f: "en", n: "en", p: "en" },
    gen: { m: "en", f: "en", n: "en", p: "en" },
  };

  return { strong, mixed, weak };
}, []);


  const __declEnding = (mode, kase, gender) => {
    if (!__declinable) return "";
    const tbl = __DECL_ENDINGS__?.[mode] || __DECL_ENDINGS__.mixed;
    return tbl?.[kase]?.[gender] || "";
  };

  const __declArticle = (mode, gender) => {
    if (mode === "weak") {
      return { m: "der", f: "die", n: "das", p: "die" }[gender] || "der";
    }
    if (mode === "mixed") {
      return { m: "ein", f: "eine", n: "ein", p: "keine" }[gender] || "ein";
    }
    // strong
    return "";
  };

  const __declClick = (gender) => {
  const ending = __declEnding(declMode, declCase, gender);
  const adjectiveSurface = `${baseForm}${ending}`;
  const article = __declArticle(declMode, gender);
  const examplePhrase = article ? `${article} ${adjectiveSurface}` : adjectiveSurface;

  const key = `${declMode}:${declCase}:${gender}:${adjectiveSurface}`;
  setSelectedDeclKey(key);
  // ✅ 互斥：詞尾變化與程度同時間只能有一個被框選
  setSelectedDegreeKey("");

  console.info("[形容詞優化][declension][click]", {
    declMode,
    declCase,
    gender,
    adjectiveSurface,
    examplePhrase,
  });

  // 若上層有接 onSelectForm（走 WordPosInfo.handleSpeakForm），可同時發音 + 更新 headword badge
  // ※保持行為：送出的是「形容詞本體」(不含冠詞)，避免影響既有邏輯
  onSelectForm?.({
    pos: "Adjektiv",
    baseForm,
    surface: adjectiveSurface,
    form: adjectiveSurface,
    source: `declension:${declMode}:${declCase}:${gender}`,
  });
};

  const __declCaseLabel = (kase) => {
    const m = adjUi?.declCases || {};
    if (kase === "nom") return m.nom || "Nominativ";
    if (kase === "acc") return m.acc || "Akkusativ";
    if (kase === "dat") return m.dat || "Dativ";
    if (kase === "gen") return m.gen || "Genitiv";
    return kase;
  };

  const __degreeClick = (kind, surface) => {
    if (!surface || surface === "-") return;
    setSelectedDegreeKey(kind);
    // ✅ 互斥：詞尾變化與程度同時間只能有一個被框選
    setSelectedDeclKey("");
    console.info("[形容詞優化][degree][click]", { kind, surface });

    onSelectForm?.({
      pos: "Adjektiv",
      baseForm,
      surface,
      form: surface,
      source: `degree:${kind}`,
    });
  };


  // =====================================================
  // ✅ 功能初始化狀態（Production 排查）
  // -----------------------------------------------------
  // - 目的：讓你在 runtime 可以快速確認這個元件到底吃到什麼語言/label
  // - 注意：僅 console.debug（低噪音），不會阻塞、也不會改資料流
  // =====================================================
  const __INIT_STATE__ = useMemo(() => {
    return {
      component: "WordPosInfoAdjektiv",
      uiLangReceived: uiLang || null,
      hasUiTextLang: !!(uiLang && uiText && uiText[uiLang]),
      labelsPropKeys: labels ? Object.keys(labels) : [],
      baseForm,
      ts: Date.now(),
    };
  }, [uiLang, labels, baseForm]);

  // ✅ 適度加入 console 能觀察 runtime 狀態（只在首次渲染/語言變更時）
  //   你如果覺得太吵，可以之後改成條件式（例如 window.__DEBUG_POSINFO__）
  //   目前先用 debug，避免 production console.error / warn 噪音
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug("[posInfo][adjektiv] init", __INIT_STATE__);
  }, [__INIT_STATE__]);

  // =====================================================
  // ✅ 多國語系：嚴格模式（不允許特定語言 fallback）
  // -----------------------------------------------------
  // 舊邏輯（deprecated）：
  //   - 會預設 currentLang = "zh-TW"
  //   - 會在 labels 缺時 fallback 到中文硬寫死字串
  //
  // 新邏輯（strict）：
  //   - 只接受 uiLang 且 uiText[uiLang] 存在才算有效語言
  //   - 不自行 fallback 到任何語言
  //   - 缺字串一律 "-"
  //
  // 2026-01-05 補充：
  //   - uiLang 可能是帶地區碼（例如 en-US / de-DE）
  //   - 允許「通用正規化」：先 exact，再 base language（en-US→en）
  //   - 仍然是 strict：只有 uiText 確實存在該 key 才採用
  // =====================================================

  // -------------------------
  // ❌ deprecated：舊的語言 fallback（保留原碼，禁止刪除）
  // -------------------------
  // 讀目前 UI 語言（缺就維持 zh-TW，但文字仍只吃 uiText；uiText 也缺就顯示 "-"）
  // let currentLang = "zh-TW";
  // if (uiLang && uiText[uiLang]) currentLang = uiLang;

  // =====================================================
  // ✅ strict：uiLang 正規化（插入）
  // -----------------------------------------------------
  // - 目的：處理 uiLang = "en-US" 但 uiText 只有 "en" 的情況
  // - 規則：先 exact，再 base language；不寫死任何國家碼
  // =====================================================
  const __LANG_RESOLVE__ = useMemo(() => {
    const raw = uiLang || "";
    const norm = String(raw).replace(/_/g, "-").trim(); // 通用：en_US → en-US
    const candidates = [];

    if (norm) candidates.push(norm);

    // 若有地區碼（xx-YY / xx-YY-ZZ...），嘗試 base language（xx）
    if (norm.includes("-")) {
      const base = norm.split("-")[0];
      if (base) candidates.push(base);
    }

    // 去重
    const uniq = Array.from(new Set(candidates));

    // strict：只要 uiText 有該 key 才算命中
    const picked = uniq.find((k) => !!(k && uiText && uiText[k])) || "";

    return {
      raw,
      norm,
      candidates: uniq,
      picked,
      hasPicked: !!picked,
      hasUiTextPicked: !!(picked && uiText && uiText[picked]),
    };
  }, [uiLang]);

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug("[posInfo][adjektiv] langResolve", __LANG_RESOLVE__);
  }, [__LANG_RESOLVE__]);

  // -------------------------
  // ✅ strict：新語言決策（局部替換）
  // -------------------------
  // 先吃 __LANG_RESOLVE__.picked（可能是 exact 或 base），沒有就維持空字串 → 後續顯示 "-"
  let currentLang = "";
  if (__LANG_RESOLVE__ && __LANG_RESOLVE__.picked) {
    currentLang = __LANG_RESOLVE__.picked;
  } else {
    currentLang = ""; // 嚴格模式：沒有就空，後續統一顯示 "-"
  }

  // -------------------------
  // ❌ deprecated：2026-01-04 的 strict 寫法（保留原碼，禁止刪除）
  // -------------------------
  // let currentLang = "";
  // if (uiLang && uiText && uiText[uiLang]) {
  //   currentLang = uiLang;
  // } else {
  //   currentLang = ""; // 嚴格模式：沒有就空，後續統一顯示 "-"
  // }

  // ❗嚴格模式：不 fallback 到 zh-TW（Verb 同款做法）
  //    形容詞卡片的 key 先用 adjektivCard；若你 uiText 裡叫 adjectiveCard 也能吃到
  const adjUi =
    (currentLang &&
      (uiText[currentLang]?.adjektivCard || uiText[currentLang]?.adjectiveCard)) ||
    {};
  const colon = adjUi.colon || "-";

  // =====================================================
  // ✅ Labels：嚴格模式（不允許中文硬寫死 fallback）
  // -----------------------------------------------------
  // - 缺就 "-"
  // - labels prop 仍允許覆蓋（但請由上層做多國，不要在這裡塞固定中文）
  // =====================================================

  // -------------------------
  // ❌ deprecated：舊的 labels fallback（保留原碼，禁止刪除）
  // -------------------------
  // 自動 labels，允許後續 props.labels 覆蓋
  const autoLabels_deprecated = useMemo(() => {
    return {
      posLabel: adjUi.posLabel || "-",
      title: adjUi.title || "形容詞變化",

      degreeTitle: adjUi.degreeTitle || "-",
      positiveLabel: adjUi.positiveLabel || "原級",
      comparativeLabel: adjUi.comparativeLabel || "比較級",
      superlativeLabel: adjUi.superlativeLabel || "最高級",

      declTitle: adjUi.declTitle || "-",
      declWeakLabel: adjUi.declWeakLabel || "弱變化（definite）",
      declMixedLabel: adjUi.declMixedLabel || "混合變化（indefinite）",
      declStrongLabel: adjUi.declStrongLabel || "強變化（no article）",

      hintText: adjUi.hintText || "", // 可選：你若 uiText 有放提示，就顯示；沒有就不顯示
    };
  }, [adjUi]);

  // -------------------------
  // ✅ strict：新 labels（插入）
  // -------------------------
  const autoLabels_strict = useMemo(() => {
    return {
      posLabel: adjUi.posLabel || "-",
      title: adjUi.title || "-",

      degreeTitle: adjUi.degreeTitle || "-",
      positiveLabel: adjUi.positiveLabel || "-",
      comparativeLabel: adjUi.comparativeLabel || "-",
      superlativeLabel: adjUi.superlativeLabel || "-",

      declTitle: adjUi.declTitle || "-",
      declWeakLabel: adjUi.declWeakLabel || "-",
      declMixedLabel: adjUi.declMixedLabel || "-",
      declStrongLabel: adjUi.declStrongLabel || "-",

      hintText: adjUi.hintText || "",
    };
  }, [adjUi]);

  // =====================================================
  // ✅ 合併 labels：以 strict 為主（局部替換）
  // -----------------------------------------------------
  // 舊：autoLabels_deprecated
  // 新：autoLabels_strict
  // =====================================================
  const mergedLabels = {
    ...autoLabels_strict,
    ...(labels || {}),
  };

  const {
    posLabel,
    title,

    degreeTitle,
    positiveLabel,
    comparativeLabel,
    superlativeLabel,

    declTitle,
    declWeakLabel,
    declMixedLabel,
    declStrongLabel,

    hintText,
  } = mergedLabels;

  // =====================================================
  // ✅ forms：移除寫死 Mann（嚴格模式）
  // -----------------------------------------------------
  // 舊：declWeak/declMixed/declStrong 寫死 Mann
  // 新：
  //   - nounPlaceholder 從 uiText 取得（必須是多國文字，不可在此硬寫）
  //   - 若 uiText 未提供 → "-"（嚴格模式）
  //
  // 注意：這裡示例句仍是「範例」用途，不是完整變化引擎
  // =====================================================

  // ✅ 從 uiText 取 placeholder（例如：德文可放 "Nomen"，英文 "noun"，中文 "名詞"）
  const nounPlaceholder = adjUi.nounPlaceholder || "-";

  // ✅ 預設 forms（保持你原本邏輯，但用 useMemo 避免每次 render 重新拼字）
  const forms = useMemo(() => {
    const cmp = extraInfo?.comparison || null;
    return {
      positive: cmp?.positive || baseForm,
      comparative: cmp?.comparative || (baseForm + "er"),
      superlative: cmp?.superlative || ("am " + baseForm + "sten"),

      // declWeak: `der ${baseForm}e Mann`,
      // declMixed: `ein ${baseForm}er Mann`,
      // declStrong: `${baseForm}er Mann`,

      // -------------------------
      // ✅ strict：新示例（移除 Mann；nounPlaceholder 由 uiText 決定）
      // -------------------------
      declWeak: `der ${baseForm}e ${nounPlaceholder}`,
      declMixed: `ein ${baseForm}er ${nounPlaceholder}`,
      declStrong: `${baseForm}er ${nounPlaceholder}`,
    };
  }, [baseForm, nounPlaceholder]);

  // ✅ Degree visibility: if not comparable, do NOT render comparative/superlative rows
  // - Prefer backend flags/values (extraInfo.comparability / extraInfo.comparison)
  const __cmp = extraInfo?.comparison || null;
  const __notComparable = extraInfo?.comparability === "not_comparable";
  const __showComparative = !__notComparable && !!__cmp?.comparative;
  const __showSuperlative = !__notComparable && !!__cmp?.superlative;

  // ✅ Header 文字：嚴格模式（缺字串一律 "-"）
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

  // ✅ 2026-01-24：由上層「詞性補充」區塊統一管理收合，本元件不再提供內部收合 UI
  // - 保留舊收合邏輯（deprecated）避免誤刪既有紀錄，但永不進入
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
     

      <div
        style={{
          padding: 10,
          borderRadius: 0,
          backgroundColor: "var(--bg-card)",
          border: "none",
        }}
      >
        

        {/* ✅ 區塊標題（比照 Verb 的 RecTitle / 小標） */}
        <SectionTitle text={degreeTitle} className="posinfo-subtle-title posinfo-subtle-title--low" />

        <div
          style={{
            padding: 8,
            borderRadius: 0,
            backgroundColor: "var(--bg-soft)",
            border: "1px solid var(--border-subtle)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            display: "grid",
            gridTemplateColumns: "1fr",
            rowGap: 6,
          }}
        >
          <DegreeRow
            k={positiveLabel}
            colon={colon}
            v={forms.positive || "-"}
            selected={selectedDegreeKey === "positive"}
            onClick={() => __degreeClick("positive", forms.positive || "-")}
          />
          {__showComparative && (
                      <DegreeRow
                        k={comparativeLabel}
                        colon={colon}
                        v={forms.comparative || "-"}
                        selected={selectedDegreeKey === "comparative"}
                        onClick={() => __degreeClick("comparative", forms.comparative || "-")}
                      />
          )}
          {__showSuperlative && (
                      <DegreeRow
                        k={superlativeLabel}
                        colon={colon}
                        v={forms.superlative || "-"}
                        selected={selectedDegreeKey === "superlative"}
                        onClick={() => __degreeClick("superlative", forms.superlative || "-")}
                      />
          )}
        </div>

        {__notComparable && (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              opacity: 0.55,
              color: "var(--text-muted)",
            }}
          >
            {adjUi?.degreeNotComparableHint || "-"}
          </div>
        )}
        <div style={{ height: 10 }} />
        <SectionTitle text={declTitle} />
        {!__declinable && (
          <div
            style={{
              marginTop: 4,
              marginBottom: 6,
              fontSize: 12,
              opacity: 0.55,
              color: "var(--text-muted)",
            }}
          >
            {adjUi?.declNotDeclinableHint || "-"}
          </div>
        )}

        {/* [形容詞優化] 模式/格位：同一個 div，皆用選單 */}
<div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
      {adjUi?.declCaseTitle || "格位"}
    </div>
    <select
      value={declCase}
      onChange={(e) => {
        const to = e.target.value;
        console.info("[形容詞優化][declension][case]", { from: declCase, to });
        setDeclCase(to);
      }}
      style={{
        fontSize: 12,
        padding: "4px 8px",
        border: "1px solid var(--border-subtle)",
        background: "transparent",
      }}
    >
      <option value="nom">{__declCaseLabel("nom")}</option>
      <option value="acc">{__declCaseLabel("acc")}</option>
      <option value="dat">{__declCaseLabel("dat")}</option>
      <option value="gen">{__declCaseLabel("gen")}</option>
    </select>
  </div>

  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
      {adjUi?.declModeTitle || adjUi?.declTitle || "變化"}
    </div>
    <select
      value={declMode}
      onChange={(e) => {
        const to = e.target.value;
        console.info("[形容詞優化][declension][mode]", { from: declMode, to });
        setDeclMode(to);
      }}
      style={{
        fontSize: 12,
        padding: "4px 8px",
        border: "1px solid var(--border-subtle)",
        background: "transparent",
      }}
    >
      <option value="weak">{declWeakLabel}</option>
      <option value="mixed">{declMixedLabel}</option>
      <option value="strong">{declStrongLabel}</option>
    </select>
  </div>
</div>

{/* [形容詞優化] 性別：三個同時出現（可點選） */}
{/* [形容詞優化] 詞尾變化：僅圈選「冠詞＋形容詞」 */}
<div
  style={{
    padding: 8,
    borderRadius: 0,
    backgroundColor: "var(--bg-soft)",
    border: "1px solid var(--border-subtle)",
    fontSize: 13,
    fontFamily: "var(--font-sans)",
    display: "grid",
    gridTemplateColumns: "1fr",
    rowGap: 8,
  }}
>
    {[
    { g: "m", label: adjUi?.genderM || "M" },
    { g: "f", label: adjUi?.genderF || "F" },
    { g: "n", label: adjUi?.genderN || "N" },
    { g: "p", label: adjUi?.genderP || "P" },
  ]
    .filter((x) => !!x.g)
    .map(({ g, label }) => (
      <DeclRow
        key={g}
        gender={g}
        genderLabel={label}
        article={__declArticle(declMode, g)}
        baseForm={baseForm}
        ending={__declEnding(declMode, declCase, g)}
        nounPlaceholder={nounPlaceholder}
        selectedKey={selectedDeclKey}
        buildKey={(adjectiveSurface) => `${declMode}:${declCase}:${g}:${adjectiveSurface}`}
        onClick={() => {
          setDeclGender(g);
          __declClick(g);
        }}
      />
    ))}
</div>

        {/* =====================================================
           ✅ Debug 區塊（Production 排查）
           - 不改 UI 結構，只補可觀察資訊（必要時你可手動打開 DevTools 看 init / langResolve log）
           ===================================================== */}
      </div>
    </div>
  );
}

function SectionTitle({ text, className }) {
  // 中文功能說明：區塊小標題；嚴格模式下 "-" 代表無字串，直接不顯示
  if (!text || text === "-") return null;

  return (
    <div
      style={{
        fontSize: 12,
        color: "var(--text-muted)",
        marginBottom: 6,
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  );
}

function KeyValueRow({ k, colon, v }) {
  // 中文功能說明：一列 Key: Value 顯示（比照 Verb 的密度）
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
          minWidth: 66,
        }}
      >
        {k}
        {colon}
      </div>

      <div
        style={{
          fontSize: 14,
          color: "var(--text-main)",
          fontWeight: 700,
          wordBreak: "break-word",
        }}
      >
        {v}
      </div>
    </div>
  );
}



function DegreeRow({ k, colon, v, selected, onClick }) {
  // [形容詞優化] 程度可選取：僅圈選「值」本體（比照詞尾圈選樣式）
  const isDisabled = !v || v === "-";

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      style={{
        display: "flex",
        gap: 6,
        alignItems: "baseline",
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: isDisabled ? "default" : "pointer",
        width: "100%",
        textAlign: "left",
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
          minWidth: 66,
        }}
      >
        {k}
        {colon}
      </div>

      <div
        style={{
          fontSize: 14,
          color: "var(--text-main)",
          fontWeight: 700,
          wordBreak: "break-word",
        }}
      >
        <span className={`posinfo-de-outline ${selected ? "posinfo-de-outline--selected" : ""}`}>{v}</span>
      </div>
    </button>
  );
}
function DeclRow({
  gender,
  genderLabel,
  article,
  baseForm,
  ending,
  nounPlaceholder,
  selectedKey,
  buildKey,
  onClick,
}) {
  // [形容詞優化] 單列：gender badge +（冠詞＋形容詞）圈選 + 名詞 placeholder
  const adjectiveSurface = `${baseForm}${ending || ""}`;
  const key = buildKey ? buildKey(adjectiveSurface) : "";
  const isSelected = !!(key && selectedKey && key === selectedKey);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        width: "100%",
        textAlign: "left",
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
      }}
    >
      <span className={`posinfo-gender-badge posinfo-gender-${gender}`} title={genderLabel}>
        {genderLabel}
      </span>

      {/* 文字顯示比照 DegreeRow：fontSize 14 / fontWeight 700 */}
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>
        <span className={`posinfo-de-outline ${isSelected ? "posinfo-de-outline--selected" : ""}`}>
          {article ? <span style={{ marginRight: 6 }}>{article}</span> : null}
          <span>
            {baseForm}
            <span style={{ fontWeight: 900 }}>{ending}</span>
          </span>
        </span>

        <span style={{ marginLeft: 8, fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>
          {nounPlaceholder === "-" ? "___" : "___"}
        </span>
      </div>
    </button>
  );
}
// frontend/src/components/WordPosInfoAdjektiv.jsx