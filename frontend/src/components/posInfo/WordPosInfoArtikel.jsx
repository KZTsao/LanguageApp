// frontend/src/components/posInfo/WordPosInfoArtikel.jsx
//
// Artikel（冠詞）
// - 定冠詞 der/die/das + 變格
// - 不定冠詞 ein/eine + 變格（無複數）
// - 目標：避免「詞性卡空白」，提供可直接學習的格表 + 單一重點 + 例句 + 迷你練習

import React, { useMemo, useState } from "react";
import uiText from "../../uiText";
import { playTTS } from "../../utils/ttsClient";

import {
  getPossibleFeaturesByForm,
  isFormCompatible,
} from "../../utils/declension/declensionEngine";

const CASE_KEYS = ["N", "A", "D", "G"];

const COLS = [
  { key: "m", label: "M" },
  { key: "f", label: "F" },
  { key: "n", label: "N" },
  { key: "p", label: "P" },
];

const COL_TITLES = {
  m: "Maskulin",
  f: "Feminin",
  n: "Neutrum",
  p: "Plural",
};

const DEF_ART = {
  N: { m: "der", f: "die", n: "das", p: "die" },
  A: { m: "den", f: "die", n: "das", p: "die" },
  D: { m: "dem", f: "der", n: "dem", p: "den" },
  G: { m: "des", f: "der", n: "des", p: "der" },
};

// ein-系列：可用於 ein / kein / mein / dein / sein / ihr / unser / euer / Ihr
// - stem：不含結尾變格的字幹（例：ein / kein / mein）
// - plural：是否有複數（ein 沒有）
function buildEinFamilyTable(stem, { plural = true } = {}) {
  const P = plural ? "" : null;

  const mk = (base, ending) => {
    if (base == null) return "—";
    return `${base}${ending}`;
  };

  // endings（ein-words）
  const end = {
    N: { m: "", f: "e", n: "", p: "e" },
    A: { m: "en", f: "e", n: "", p: "e" },
    D: { m: "em", f: "er", n: "em", p: "en" },
    G: { m: "es", f: "er", n: "es", p: "er" },
  };

  const base = { m: stem, f: stem, n: stem, p: plural ? stem : null };

  const table = {};
  for (const c of CASE_KEYS) {
    table[c] = {
      m: mk(base.m, end[c].m),
      f: mk(base.f, end[c].f),
      n: mk(base.n, end[c].n),
      p: mk(base.p, end[c].p),
    };
  }
  return table;
}

// 不定冠詞：無複數
const INDEF_ART = buildEinFamilyTable("ein", { plural: false });

// kein：有複數
const KEIN_ART = buildEinFamilyTable("kein", { plural: true });

// 物主冠詞：ein-系列（有複數）
const POSS_SERIES = [
  { key: "mein", label: "mein" },
  { key: "dein", label: "dein" },
  { key: "sein", label: "sein" },
  { key: "ihr", label: "ihr" },
  { key: "unser", label: "unser" },
  { key: "euer", label: "euer" }, // 簡化：不處理 euer→eur 的縮合（先以學習一致性為主）
  { key: "Ihr", label: "Ihr" },
];

const POSS_TABLES = Object.fromEntries(
  POSS_SERIES.map((s) => [s.key, buildEinFamilyTable(s.key, { plural: true })])
);

// dieser：der-words（跟定冠詞一樣的結尾模式）
const DIESER_ART = {
  N: { m: "dieser", f: "diese", n: "dieses", p: "diese" },
  A: { m: "diesen", f: "diese", n: "dieses", p: "diese" },
  D: { m: "diesem", f: "dieser", n: "diesem", p: "diesen" },
  G: { m: "dieses", f: "dieser", n: "dieses", p: "dieser" },
};

function makeSetFromTable(table) {
  return new Set(
    Object.values(table)
      .flatMap((row) => Object.values(row))
      .filter((x) => x && x !== "—")
      .map((x) => x.toLowerCase())
  );
}

const DEF_SET = makeSetFromTable(DEF_ART);
const INDEF_SET = makeSetFromTable(INDEF_ART);
const KEIN_SET = makeSetFromTable(KEIN_ART);
const DIESER_SET = makeSetFromTable(DIESER_ART);

const POSS_SETS = Object.fromEntries(
  Object.entries(POSS_TABLES).map(([k, t]) => [k, makeSetFromTable(t)])
);

function normalizeWord(x) {
  return (x || "").trim();
}


function detectType(word) {
  const w = normalizeWord(word).toLowerCase();
  if (!w) return { type: "def", labelZh: "定冠詞" };

  if (INDEF_SET.has(w)) return { type: "indef", labelZh: "不定冠詞" };
  if (KEIN_SET.has(w)) return { type: "kein", labelZh: "否定冠詞" };
  if (DIESER_SET.has(w)) return { type: "dieser", labelZh: "指示冠詞" };

  for (const [k, set] of Object.entries(POSS_SETS)) {
    if (set.has(w)) return { type: k, labelZh: "物主冠詞" };
  }

  if (DEF_SET.has(w)) return { type: "def", labelZh: "定冠詞" };
  return { type: "def", labelZh: "冠詞" };
}

function defaultSelectionBySurface(surface, table, seriesKey) {
  const s = normalizeWord(surface).toLowerCase();

  // 只對 def/indef 用 declension engine 反查（可處理 den 這種歧義）
  const type =
    seriesKey === "indef" ? "indef_article" : seriesKey === "def" ? "def_article" : null;

  if (type) {
    const possibilities = getPossibleFeaturesByForm(type, s);
    if (possibilities?.length) {
      for (const caseKey of CASE_KEYS) {
        for (const col of COLS) {
          const features = {
            caseKey,
            genderKey: col.key,
            numberKey: col.key === "p" ? "P" : "S",
          };
          if (isFormCompatible(type, s, features)) {
            const v = table?.[caseKey]?.[col.key];
            if (v && v !== "—") return { caseKey, colKey: col.key };
          }
        }
      }
    }
  }

  // fallback：表格直接掃
  for (const caseKey of CASE_KEYS) {
    for (const col of COLS) {
      const v = table?.[caseKey]?.[col.key];
      if (v && v !== "—" && v.toLowerCase() === s) return { caseKey, colKey: col.key };
    }
  }

  return { caseKey: "N", colKey: "m" };
}

function getLearningPointZh(caseKey, colKey, typeLabelZh) {
  const genderZh =
    colKey === "m" ? "陽性" : colKey === "f" ? "陰性" : colKey === "n" ? "中性" : "複數";
  const caseZh =
    caseKey === "N"
      ? "主格（主詞）"
      : caseKey === "A"
        ? "賓格（受詞）"
        : caseKey === "D"
          ? "與格（間接受詞）"
          : "屬格（所有/關係）";

  if (caseKey === "G") {
    return `${typeLabelZh}：${genderZh}的${caseZh}常見搭配「des + 名詞(s/es)」。`;
  }
  return `${typeLabelZh}：${genderZh}的${caseZh}。`;
}

function getMiniRulesZh(caseKey) {
  if (caseKey === "A") {
    return [
      "很多動詞的直接受詞用 Akkusativ（例：sehen / kaufen / finden）",
      "問句：Wen/Was ...? 常對應 Akkusativ",
      "遇到雙受詞句型：人常 Dativ、物常 Akkusativ（例：Ich gebe dem Mann den Ball）",
    ];
  }
  if (caseKey === "D") {
    return [
      "常見介系詞：mit / nach / bei / zu / von → Dativ",
      "問句：Wem ...? 常對應 Dativ",
      "雙受詞句型：給『誰』通常是 Dativ",
    ];
  }
  if (caseKey === "G") {
    return [
      "Genitiv 常表示『…的』關係",
      "常見介系詞：wegen / trotz / während（口語偶爾用 Dativ）",
      "陽/中性名詞常加 -(e)s（例：des Mannes / des Kindes）",
    ];
  }
  return [
    "主格多用在句子的主詞位置",
    "問句：Wer/Was ...? 常對應 Nominativ",
    "最常見句型：Der Mann ist hier.",
  ];
}


export default function WordPosInfoArtikel({ baseForm, queryWord, labels = {}, onSelectForm, uiLang }) {
  const surface = normalizeWord(queryWord || baseForm);
  const typeInfo = useMemo(() => detectType(surface), [surface]);

  // 系列：允許手動切換（der / ein）
  const [series, setSeries] = useState(typeInfo.type);
  React.useEffect(() => {
    setSeries(typeInfo.type);
  }, [typeInfo.type]);

  
const table = useMemo(() => {
  if (series === "def") return DEF_ART;
  if (series === "indef") return INDEF_ART;
  if (series === "kein") return KEIN_ART;
  if (series === "dieser") return DIESER_ART;
  if (POSS_TABLES[series]) return POSS_TABLES[series];
  return DEF_ART;
}, [series]);

  // 只接受上游 uiLang（存在且 uiText[uiLang] 有定義才算有效）
  let currentLang = "zh-TW";
  if (uiLang && uiText[uiLang]) currentLang = uiLang;
  const wordUi = uiText[currentLang]?.wordCard || {};
  const tArtikel = wordUi?.posInfoArtikel || {};
  const __tArtikel = (key, fb = "") => {
    try {
      const v = tArtikel?.[key];
      return typeof v === "undefined" || v === null ? fb : v;
    } catch (_) {
      return fb;
    }
  };

  const caseAbbr = {
    N: wordUi?.posInfoPronoun?.caseN || "—",
    A: wordUi?.posInfoPronoun?.caseA || "—",
    D: wordUi?.posInfoPronoun?.caseD || "—",
    G: wordUi?.posInfoPronoun?.caseG || "—",
  };
  const caseFull = {
    N: wordUi?.caseNom || "—",
    A: wordUi?.caseAkk || "—",
    D: wordUi?.caseDat || "—",
    G: wordUi?.caseGen || "—",
  };

  const initialSel = useMemo(() => defaultSelectionBySurface(surface, table, series), [surface, table, series]);

  const [activeCase, setActiveCase] = useState(initialSel.caseKey);
  const [activeCol, setActiveCol] = useState(initialSel.colKey);
React.useEffect(() => {
  const nextSel = defaultSelectionBySurface(surface, table, series);
  setActiveCase(nextSel.caseKey);
  setActiveCol(nextSel.colKey);
}, [surface, series]);

  const [expanded, setExpanded] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const cellW = isNarrow ? 58 : 64;

  
const declType =
  series === "indef" ? "indef_article" : series === "def" ? "def_article" : null;

  const findFirstClickableCol = (caseKey) => {
    for (const col of COLS) {
      const v = table?.[caseKey]?.[col.key];
      if (v && v !== "—") return col.key;
    }
    return "m";
  };

  const applySelection = (nextCase, nextCol) => {
    let c = nextCase;
    let col = nextCol;

    // A) 二次驗證：如果該 cell 不可用（例如不定冠詞複數），自動切到第一個可用 form
    const v = table?.[c]?.[col];
    if (!v || v === "—") col = findFirstClickableCol(c);

    setActiveCase(c);
    setActiveCol(col);

    const form = table?.[c]?.[col];
    if (form && form !== "—" && typeof onSelectForm === "function") {
      try {
        onSelectForm(form);
      } catch (_) {
        // ignore
      }
    }
  };

  // 修復：原本 JSX 內引用了 selectCell 但未定義
  const selectCell = (caseKey, colKey) => {
    const form = table?.[caseKey]?.[colKey];
    if (!form || form === "—") {
      // A) 不相容/不可用：自動切到第一個可用 cell
      applySelection(caseKey, findFirstClickableCol(caseKey));
      return;
    }


// 防守：只有 def/indef 才用 engine 做相容性檢查（含 den 歧義）
if (declType) {
  const features = {
    caseKey,
    genderKey: colKey,
    numberKey: colKey === "p" ? "P" : "S",
  };
  if (!isFormCompatible(declType, form.toLowerCase(), features)) {
    applySelection(caseKey, findFirstClickableCol(caseKey));
    return;
  }
}

    applySelection(caseKey, colKey);

    // ✅ 點選冠詞要播放聲音
    try {
      playTTS(form, "de-DE");
    } catch (_) {
      // ignore
    }
  };

  React.useEffect(() => {
    try {
      const mq = window.matchMedia && window.matchMedia("(max-width: 420px)");
      if (!mq) return;
      const apply = () => setIsNarrow(!!mq.matches);
      apply();
      if (mq.addEventListener) mq.addEventListener("change", apply);
      else mq.addListener(apply);
      return () => {
        try {
          if (mq.removeEventListener) mq.removeEventListener("change", apply);
          else mq.removeListener(apply);
        } catch (_) {}
      };
    } catch (_) {
      // ignore
    }
  }, []);

const uiTitle = labels?.title || __tArtikel("title", "冠詞（Artikel）");
const uiDesc = __tArtikel("desc", "標示名詞的「性別 + 格」");

const typeLabels = tArtikel?.typeLabels || {};
const genderLabels = tArtikel?.genderLabels || {};
const caseLabels = tArtikel?.caseLabels || {};
const miniRulesMap = tArtikel?.miniRules || {};
const colTitles = tArtikel?.colTitles || COL_TITLES;

const seriesTypeLabel =
  series === "def"
    ? (wordUi?.headerDefinite || typeLabels.def || "定冠詞")
    : series === "indef"
      ? (wordUi?.headerIndefinite || typeLabels.indef || "不定冠詞")
      : series === "kein"
        ? (wordUi?.headerNegation || "否定冠詞")
        : series === "dieser"
          ? (wordUi?.headerDemonstrative || "指示冠詞")
          : POSS_TABLES[series]
            ? (wordUi?.headerPossessive || "所有格")
            : (typeLabels.generic || "冠詞");

const point = useMemo(() => {
  const typeLabel = seriesTypeLabel;
  const genderLabel = genderLabels?.[activeCol] || colTitles?.[activeCol] || activeCol;
  const caseLabel = caseLabels?.[activeCase] || caseFull?.[activeCase] || activeCase;

  const useGenTpl =
    activeCase === "G" &&
    (activeCol === "m" || activeCol === "n") &&
    !!__tArtikel("learningPointGenTemplate", "");

  const tpl = useGenTpl
    ? __tArtikel("learningPointGenTemplate", "{typeLabel}：{genderLabel}的{caseLabel}常見搭配「des + 名詞(s/es)」。")
    : __tArtikel("learningPointTemplate", "{typeLabel}：{genderLabel}的{caseLabel}。");

  return String(tpl)
    .replaceAll("{typeLabel}", String(typeLabel))
    .replaceAll("{genderLabel}", String(genderLabel))
    .replaceAll("{caseLabel}", String(caseLabel));
}, [activeCase, activeCol, seriesTypeLabel, genderLabels, caseLabels, colTitles, caseFull]);

const rules = useMemo(() => {
  const r = miniRulesMap?.[activeCase];
  if (Array.isArray(r) && r.length) return r;
  return getMiniRulesZh(activeCase);
}, [activeCase, miniRulesMap]);

  const currentForm = table?.[activeCase]?.[activeCol] || "—";

  const isPossSeries = !!POSS_TABLES[series];
  const possValue = isPossSeries ? series : (POSS_SERIES[0]?.key || "mein");

  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{uiTitle}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {seriesTypeLabel}｜{uiDesc}
        </div>
      </div>



      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[{ key: "def", label: "der" }, { key: "indef", label: "ein" }, { key: "kein", label: "kein" }, { key: "dieser", label: "dieser" }].map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSeries(s.key)}
            aria-pressed={series === s.key}
            style={{
              border: "1px solid var(--border-subtle)",
              background: series === s.key ? "var(--surface-2)" : "transparent",
              color: series === s.key ? "var(--text)" : "var(--text-muted)",
              padding: "3px 8px",
              borderRadius: 0,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: series === s.key ? 700 : 500,
            }}
          >
            {s.label}
          </button>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{wordUi?.posInfoPronoun?.pillPossessive || wordUi?.headerPossessive || "物主"}</div>
          <select
            value={possValue}
            onChange={(e) => setSeries(e.target.value)}
            aria-label={wordUi?.headerPossessive || wordUi?.posInfoPronoun?.pillPossessive || "物主"}
            style={{
              border: "1px solid var(--border-subtle)",
              background: isPossSeries ? "var(--surface-2)" : "transparent",
              color: isPossSeries ? "var(--text)" : "var(--text-muted)",
              padding: "3px 8px",
              borderRadius: 0,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: isPossSeries ? 700 : 500,
              outline: "none",
            }}
          >
            {POSS_SERIES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {CASE_KEYS.map((k) => {
          const active = k === activeCase;
          return (
            <button
              key={k}
              type="button"
              onClick={() => applySelection(k, activeCol)}
              title={caseFull[k]}
              style={{
                border: `1px solid var(--border-subtle)`,
                background: active ? "var(--surface-2)" : "transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                padding: "3px 6px",
                borderRadius: 0,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: active ? 600 : 500,
              }}
              onMouseEnter={(e) => {
                try {
                  e.currentTarget.style.background = active ? "var(--surface-2)" : "var(--surface-2)";
                } catch (_) {}
              }}
              onMouseLeave={(e) => {
                try {
                  e.currentTarget.style.background = active ? "var(--surface-2)" : "transparent";
                } catch (_) {}
              }}
            >
              {caseAbbr[k]}
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 10,
          border: "1px solid var(--border-subtle)",
          borderRadius: 0,
          padding: isNarrow ? 6 : 8,
          overflowX: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "58px repeat(4, minmax(44px, 1fr))" : "70px repeat(4, minmax(56px, 1fr))",
            gap: 4,
            alignItems: "center",
            fontSize: 14,
          }}
        >
          {/* 左上角交錯欄位：展開/收合 */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? __tArtikel("collapseLabel", "收合") : __tArtikel("expandLabel", "展開")}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--text-muted)",
              padding: 0,
              height: 28,
              width: "100%",
              cursor: "pointer",
              fontSize: 10,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {expanded ? "▼" : "▶"}
          </button>
          {COLS.map((col) => (
            <div
              key={col.key}
              title={colTitles[col.key] || COL_TITLES[col.key]}
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                width: "100%",
                whiteSpace: "nowrap",
              }}
            >
              {col.label}
            </div>
          ))}

          {(expanded ? CASE_KEYS : CASE_KEYS.filter((k) => k === activeCase)).map((caseKey) => (
            <React.Fragment key={caseKey}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 12,
                  color: caseKey === activeCase ? "var(--text)" : "var(--text-muted)",
                  fontWeight: caseKey === activeCase ? 600 : 500,
                  whiteSpace: "nowrap",
                }}
              >
                <span title={caseFull[caseKey]}>{caseAbbr[caseKey]}</span>
              </div>

              {COLS.map((col) => {
                const v = table?.[caseKey]?.[col.key] || "—";
                const isActive = caseKey === activeCase && col.key === activeCol;
                const clickable = v !== "—";
                return (
                  <button
                    key={`${caseKey}_${col.key}`}
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && selectCell(caseKey, col.key)}
                    style={{
                      textAlign: "left",
                      border: `1px solid var(--border-subtle)`,
                      background: isActive ? "var(--accent-soft)" : "transparent",
                      color: clickable ? "var(--text)" : "var(--text-muted)",
                      padding: isNarrow ? "3px 6px" : "4px 6px",
                      borderRadius: 0,
                      cursor: clickable ? "pointer" : "not-allowed",
                      opacity: clickable ? 1 : 0.55,
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      width: "100%",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      if (isActive) return;
                      try {
                        e.currentTarget.style.background = "var(--surface-2)";
                      } catch (_) {}
                    }}
                    onMouseLeave={(e) => {
                      if (isActive) return;
                      try {
                        e.currentTarget.style.background = "transparent";
                      } catch (_) {}
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 14 }}>{point}</div>

      <div style={{ marginTop: 8 }}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
          {rules.slice(0, 3).map((r, idx) => (
            <li key={idx}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}