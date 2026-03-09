// frontend/src/components/posInfo/WordPosInfoPronomen.jsx
//
// Pronomen (代名詞)
// - Personalpronomen：ich → ich / mich / mir / meiner
// - Possessivartikel：mein- → mein / meine / meinem / meinen / meiner / meines ...
// - Special:
//   - ihr: can be Personalpronomen OR Possessivartikel → use pills to switch
//   - Sie/sie: ambiguous → use selector to switch meaning
// -----------------------------------------------------

import React, { useMemo, useState } from "react";
import uiText from "../../uiText";

const __PRON_LOG_PREFIX__ = "[代名詞]";
function __pronLog__(...args) {
  // eslint-disable-next-line no-console
  console.debug(__PRON_LOG_PREFIX__, ...args);
}

const PERSONAL_PRONOUNS = {
  ich: { N: "ich", A: "mich", D: "mir", G: "meiner" },
  du: { N: "du", A: "dich", D: "dir", G: "deiner" },
  er: { N: "er", A: "ihn", D: "ihm", G: "seiner" },
  sie: { N: "sie", A: "sie", D: "ihr", G: "ihrer" }, // she (default)
  es: { N: "es", A: "es", D: "ihm", G: "seiner" },
  wir: { N: "wir", A: "uns", D: "uns", G: "unser" },
  ihr: { N: "ihr", A: "euch", D: "euch", G: "euer" },
  Sie: { N: "Sie", A: "Sie", D: "Ihnen", G: "Ihrer" }, // polite
  man: { N: "man", A: "einen", D: "einem", G: "eines" },
};

const SIE_VARIANTS = {
  polite: { labelKey: "siePolite", forms: PERSONAL_PRONOUNS.Sie },
  she: { labelKey: "sieShe", forms: { N: "sie", A: "sie", D: "ihr", G: "ihrer" } },
  they: { labelKey: "sieThey", forms: { N: "sie", A: "sie", D: "ihnen", G: "ihrer" } },
};

function normalizeKey(s) {
  return (s || "").trim();
}

function detectPossessiveStem(baseForm) {
  const w = normalizeKey(baseForm).toLowerCase();

  // 常見所有格（以字幹判斷）
  // NOTE: "ihr" 同時可能是 Personal 或 Possessiv；由上層 UI 分流。
  const stems = ["mein", "dein", "sein", "ihr", "unser", "euer", "ihr"];
  for (const st of stems) {
    if (w === st) return st;
    if (w.startsWith(st)) return st;
  }
  return null;
}

function buildPossessiveEinDecl(stemRaw) {
  // Possessivartikel 跟 ein- 變格一致
  // euer- 有特殊：euer → eur-（多數格）
  const stem = (stemRaw || "").toLowerCase();
  const base = stem === "euer" ? "eur" : stem;

  return {
    N: { m: base, f: base + "e", n: base, p: base + "e" },
    A: { m: base + "en", f: base + "e", n: base, p: base + "e" },
    D: { m: base + "em", f: base + "er", n: base + "em", p: base + "en" },
    G: { m: base + "es", f: base + "er", n: base + "es", p: base + "er" },
  };
}

function formatTemplate(s, vars) {
  try {
    let out = String(s || "");
    for (const [k, v] of Object.entries(vars || {})) {
      out = out.replaceAll(`{${k}}`, String(v ?? ""));
    }
    return out;
  } catch {
    return String(s || "");
  }
}

export default function WordPosInfoPronomen({
  baseForm,
  labels = {},
  uiLang,
  onSelectForm,
}) {
  if (!baseForm) {
    __pronLog__("render: baseForm empty -> return null", { baseForm, uiLang, labels });
    return null;
  }

  const base = normalizeKey(baseForm);
  const baseLower = base.toLowerCase();

  __pronLog__("render", {
    baseForm,
    base,
    uiLang,
    labels,
  });

  // ✅ i18n: always use upstream uiLang; fallback only if lang root missing
  const currentLang = uiLang && uiText?.[uiLang] ? uiLang : uiText?.["zh-TW"] ? "zh-TW" : "en";
  const wc = uiText?.[currentLang]?.wordCard || {};
  const t = wc?.posInfoPronoun || {};

  __pronLog__("uiText resolved objects", {
    uiLang,
    currentLang,
    wordCardKeys: Object.keys(wc || {}),
    posInfoPronounKeys: Object.keys(t || {}),
  });

  const {
    // 外部可覆寫（但預設都走 uiText）
    title: _titleIgnored, // title labels removed from UI (per requirement)
    nom = base,
    akk = base,
    dat = base,
    gen = null,
  } = labels;

  __pronLog__("labels resolved", {
    nom,
    akk,
    dat,
    gen,
  });

  const dash = t?.dash || "—";

  const personalDefault =
    PERSONAL_PRONOUNS[base] || PERSONAL_PRONOUNS[baseLower] || null;

  // Special: Sie/sie variants
  const isSieFamily = baseLower === "sie";
  const [sieVariant, setSieVariant] = useState("polite");
  const sieForms = isSieFamily ? SIE_VARIANTS[sieVariant]?.forms || personalDefault : null;
  const personal = isSieFamily ? sieForms : personalDefault;

  // Possessive
  const possStem = detectPossessiveStem(base);
  const poss = possStem ? buildPossessiveEinDecl(possStem) : null;

  const hasPersonal = !!personal || !!gen;
  const personalForms = personal || {
    N: nom,
    A: akk,
    D: dat,
    G: gen || dash,
  };

  __pronLog__("detected forms", {
    personalHit: !!personal,
    isSieFamily,
    sieVariant,
    personal,
    possStem,
    possHit: !!poss,
  });

  // Case labels follow WordPosInfoNoun (wordCard.caseNom/caseAkk/caseDat/caseGen)
  const labelNom = wc?.caseNom || "N";
  const labelAkk = wc?.caseAkk || "A";
  const labelDat = wc?.caseDat || "D";
  const labelGen = wc?.caseGen || "G";

  const cN = t?.caseN || "N";
  const cA = t?.caseA || "A";
  const cD = t?.caseD || "D";
  const cG = t?.caseG || "G";

  const gM = t?.genderM || "";
  const gF = t?.genderF || "";
  const gN = t?.genderN || "";
  const gP = t?.genderPl || "";

  const possessiveTitle = possStem
    ? formatTemplate(t?.possessiveTitleTemplate || "", { stem: `${possStem}-` })
    : "";

  // Special: ihr pill switch (personal vs possessive)
  const isIhrAmbiguous = baseLower === "ihr" && !!personalDefault && !!poss;
  const [ihrMode, setIhrMode] = useState("personal");

  const willRenderPersonal = hasPersonal && (!isIhrAmbiguous || ihrMode === "personal");
  const willRenderPossessive = !!poss && (!isIhrAmbiguous || ihrMode === "possessive");

  const willRenderFallback = !hasPersonal && !poss;

  __pronLog__("render flags", {
    hasPersonal,
    willRenderPersonal,
    willRenderPossessive,
    willRenderFallback,
    personalForms,
  });

  const [selectedKey, setSelectedKey] = useState(null);

  const personalRows = useMemo(
    () => [
      { key: "N", label: labelNom, value: personalForms.N },
      { key: "A", label: labelAkk, value: personalForms.A },
      { key: "D", label: labelDat, value: personalForms.D },
      { key: "G", label: labelGen, value: personalForms.G },
    ],
    [labelNom, labelAkk, labelDat, labelGen, personalForms]
  );

  function handlePick(surface, metaKey, meta) {
    // ✅ Pronoun meaning hint (for example generation)
    const s = (surface || "").toString().trim();
    if (!s || s === dash) return;
    setSelectedKey(metaKey || null);
    const baseHintKey = (() => {
      if (isIhrAmbiguous) {
        return ihrMode === "personal" ? "PERSONAL_PRONOUN_2PL" : "POSSESSIVE_DET_2PL";
      }
      if (isSieFamily) {
        if (sieVariant === "polite") return "FORMAL_YOU";
        if (sieVariant === "she") return "SHE";
        if (sieVariant === "they") return "THEY";
      }
      return "";
    })();

    const pronMeta = {
      ...(meta && typeof meta === "object" ? meta : null),
      ...(baseHintKey ? { headwordHintKey: baseHintKey } : null),
      ...(isIhrAmbiguous ? { ihrMode } : null),
      ...(isSieFamily ? { sieVariant } : null),
    };

    if (typeof onSelectForm === "function") {
      onSelectForm({
        pos: "Pronomen",
        surface: s,
        baseForm: base,
        // ✅ Pronomen card uses MALE voice to match other parts of the app
        // (does not change global TTS prefs; only this click)
        tts: { gender: "MALE" },
        pronoun: Object.keys(pronMeta).length ? pronMeta : undefined,
      });
    }
  }

  const cellBtnStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    background: "transparent",
    border: "none",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
    textAlign: "left",
  };

  // Simple pill style (inline to avoid touching global CSS)
  const pillRowStyle = {
    display: "flex",
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  };

  const pillBtn = (active) => ({
    border: `1px solid ${active ? "var(--border-strong)" : "var(--border-subtle)"}`,
    background: active ? "var(--bg-subtle, #f3f3f3)" : "transparent",
    borderRadius: 4, // square-ish corners (方角)
    padding: "3px 8px", // tight padding
    fontSize: 13,
    cursor: "pointer",
    color: "inherit",
    fontWeight: active ? 700 : 500,
  });

  // Sie meaning selector (inline)
  const sieSelectLabel = t?.sieMenuLabel || "Sie";

  const renderSieInlineSelect = () => {
    if (!isSieFamily) return null;

    const label = (key) => {
      const lk = SIE_VARIANTS[key]?.labelKey;
      return (lk && t?.[lk]) || lk || key;
    };

    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{baseForm}</span>
        <select
          value={sieVariant}
          onChange={(e) => {
            const v = (e?.target?.value || "").toString();
            if (!v) return;
            setSieVariant(v);
            setSelectedKey(null);
          }}
          style={{
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "inherit",
            borderRadius: 4,
            padding: "2px 6px",
            fontSize: 13,
            lineHeight: "18px",
            height: 24,
          }}
          aria-label={sieSelectLabel}
        >
          {Object.keys(SIE_VARIANTS).map((k) => (
            <option key={k} value={k}>
              {label(k)}
            </option>
          ))}
        </select>
      </span>
    );
  };


  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      {/* Special: ihr pill split (personal vs possessive) */}
      {isIhrAmbiguous && (
        <div style={pillRowStyle}>
          <button
            type="button"
            style={pillBtn(ihrMode === "personal")}
            onClick={() => {
              setIhrMode("personal");
              setSelectedKey(null);
            }}
            aria-pressed={ihrMode === "personal"}
          >
            {t?.pillPersonal || "Personal"}
          </button>
          <button
            type="button"
            style={pillBtn(ihrMode === "possessive")}
            onClick={() => {
              setIhrMode("possessive");
              setSelectedKey(null);
            }}
            aria-pressed={ihrMode === "possessive"}
          >
            {t?.pillPossessive || "Possessive"}
          </button>
        </div>
      )}

      {/* Special: Sie meaning selector */}
      {isSieFamily && (
        <div style={{ marginBottom: 8 }}>{renderSieInlineSelect()}</div>
      )}

      {/* Personalpronomen */}
      {willRenderPersonal && (
        <div style={{ marginBottom: willRenderPossessive ? 10 : 0 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(170px, max-content) minmax(0, 1fr)",
              columnGap: 10,
              rowGap: 6,
              fontSize: 14,
              alignItems: "baseline",
            }}
          >
            {personalRows.map((r) => (
              <React.Fragment key={r.key}>
                <div style={{ color: "var(--text-muted)" }}>{r.label}</div>
                <button
                  type="button"
                  style={{
                    ...cellBtnStyle,
                    fontWeight: selectedKey === r.key ? 700 : 400,
                  }}
                  onClick={() =>
                    handlePick(r.value, r.key, {
                      card: "personal",
                      case: r.key,
                      sieVariant: isSieFamily ? sieVariant : undefined,
                    })
                  }
                  aria-pressed={selectedKey === r.key}
                >
                  {r.value}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Possessivartikel */}
      {willRenderPossessive && (
        <div>
          {/* (labels removed; keep only table) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "78px repeat(4, minmax(0, 1fr))",
              gap: 6,
              fontSize: 14,
              alignItems: "center",
            }}
          >
            <div />
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{gM}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{gF}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{gN}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{gP}</div>

            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{cN}</div>
            {[
              { g: "m", v: poss.N.m },
              { g: "f", v: poss.N.f },
              { g: "n", v: poss.N.n },
              { g: "p", v: poss.N.p },
            ].map((x) => (
              <button
                key={`N-${x.g}`}
                type="button"
                style={{
                  ...cellBtnStyle,
                  fontWeight: selectedKey === `N-${x.g}` ? 700 : 400,
                }}
                onClick={() =>
                  handlePick(x.v, `N-${x.g}`, {
                    card: "possessive",
                    case: "N",
                    gender: x.g,
                    stem: possStem,
                    title: possessiveTitle || undefined,
                  })
                }
                aria-pressed={selectedKey === `N-${x.g}`}
              >
                {x.v}
              </button>
            ))}

            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{cA}</div>
            {[
              { g: "m", v: poss.A.m },
              { g: "f", v: poss.A.f },
              { g: "n", v: poss.A.n },
              { g: "p", v: poss.A.p },
            ].map((x) => (
              <button
                key={`A-${x.g}`}
                type="button"
                style={{
                  ...cellBtnStyle,
                  fontWeight: selectedKey === `A-${x.g}` ? 700 : 400,
                }}
                onClick={() =>
                  handlePick(x.v, `A-${x.g}`, {
                    card: "possessive",
                    case: "A",
                    gender: x.g,
                    stem: possStem,
                    title: possessiveTitle || undefined,
                  })
                }
                aria-pressed={selectedKey === `A-${x.g}`}
              >
                {x.v}
              </button>
            ))}

            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{cD}</div>
            {[
              { g: "m", v: poss.D.m },
              { g: "f", v: poss.D.f },
              { g: "n", v: poss.D.n },
              { g: "p", v: poss.D.p },
            ].map((x) => (
              <button
                key={`D-${x.g}`}
                type="button"
                style={{
                  ...cellBtnStyle,
                  fontWeight: selectedKey === `D-${x.g}` ? 700 : 400,
                }}
                onClick={() =>
                  handlePick(x.v, `D-${x.g}`, {
                    card: "possessive",
                    case: "D",
                    gender: x.g,
                    stem: possStem,
                    title: possessiveTitle || undefined,
                  })
                }
                aria-pressed={selectedKey === `D-${x.g}`}
              >
                {x.v}
              </button>
            ))}

            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{cG}</div>
            {[
              { g: "m", v: poss.G.m },
              { g: "f", v: poss.G.f },
              { g: "n", v: poss.G.n },
              { g: "p", v: poss.G.p },
            ].map((x) => (
              <button
                key={`G-${x.g}`}
                type="button"
                style={{
                  ...cellBtnStyle,
                  fontWeight: selectedKey === `G-${x.g}` ? 700 : 400,
                }}
                onClick={() =>
                  handlePick(x.v, `G-${x.g}`, {
                    card: "possessive",
                    case: "G",
                    gender: x.g,
                    stem: possStem,
                    title: possessiveTitle || undefined,
                  })
                }
                aria-pressed={selectedKey === `G-${x.g}`}
              >
                {x.v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* fallback: 舊版三格（保底顯示） */}
      {willRenderFallback && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(170px, max-content) minmax(0, 1fr)",
            columnGap: 10,
            rowGap: 6,
            fontSize: 14,
            alignItems: "baseline",
          }}
        >
          <div style={{ color: "var(--text-muted)" }}>{labelNom}</div>
          <div>{nom}</div>
          <div style={{ color: "var(--text-muted)" }}>{labelAkk}</div>
          <div>{akk}</div>
          <div style={{ color: "var(--text-muted)" }}>{labelDat}</div>
          <div>{dat}</div>
        </div>
      )}
    </div>
  );
}
