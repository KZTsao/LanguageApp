// frontend/src/components/WordPosInfoAdverb.jsx
//
// 副詞（Adverb）
// - 優先使用後端/LLM 回傳的 comparison（如: gern → lieber → am liebsten）
// - 若缺值才使用規則型 fallback（baseForm + er / am baseForm + sten）
// - ✅ 2026-02-07：比照形容詞（Adjektiv）程度可選取：
//   - 點擊程度列：框選值本體（posinfo-de-outline）
//   - 走 onSelectForm → WordPosInfo.handleSpeakForm：TTS + 例句 header/headword 連動
// -----------------------------------------------------

import React, { useMemo, useState } from "react";

export default function WordPosInfoAdverb({
  baseForm,
  comparison = null,
  notes = "",
  labels = {},
  uiLang, // keep signature aligned with other POS cards (not required here)
  extraInfo, // dictionary object (best-effort)
  onSelectForm,
}) {
  if (!baseForm) return null;

  const [selectedDegreeKey, setSelectedDegreeKey] = useState("");

  const {
    title = "副詞變化",
    // labels 仍保留向下相容（舊呼叫端可繼續傳 labels）
    positive: labelPositive,
    comparative: labelComparative,
    superlative: labelSuperlative,
  } = labels;

  // ✅ comparison 來源：prop > extraInfo > empty
  const cmp = useMemo(() => {
    const fromProp = comparison && typeof comparison === "object" ? comparison : null;
    const fromExtra =
      extraInfo && typeof extraInfo === "object"
        ? (extraInfo.comparison ||
            extraInfo.comparisons ||
            extraInfo.degree ||
            extraInfo.degrees ||
            null)
        : null;

    const picked = fromProp || fromExtra || {};
    return picked && typeof picked === "object" ? picked : {};
  }, [comparison, extraInfo]);

  // ✅ 先吃 comparison（來自後端/LLM），再吃 labels，再 fallback 規則型
  const positive = (cmp.positive || cmp.pos || cmp.base || "").toString().trim() || (labelPositive || baseForm);
  const comparative =
    (cmp.comparative || cmp.comp || "").toString().trim() ||
    (labelComparative || (baseForm + "er"));
  const superlative =
    (cmp.superlative || cmp.sup || "").toString().trim() ||
    (labelSuperlative || ("am " + baseForm + "sten"));

  // 若三格都空（理論上不該），避免顯示錯誤推導
  const hasAny =
    Boolean(positive && String(positive).trim()) ||
    Boolean(comparative && String(comparative).trim()) ||
    Boolean(superlative && String(superlative).trim());

  if (!hasAny) return null;

  const __degreeClick = (kind, surface) => {
    const s = (surface || "").toString().trim();
    if (!s || s === "-") return;
    setSelectedDegreeKey(kind);

    // ✅ 比照形容詞：回拋 form → 上游處理 TTS + 例句 header/headword
    onSelectForm?.({
      pos: "Adverb",
      baseForm,
      surface: s,
      form: s,
      degreeKey: kind,
      source: `degree:${kind}`,
    });
  };

  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
        {title}
      </div>

      <div style={{ display: "grid", rowGap: 6, fontSize: 14 }}>
        <DegreeRow
          k="基本型"
          colon="："
          v={positive}
          selected={selectedDegreeKey === "positive"}
          onClick={() => __degreeClick("positive", positive)}
        />
        <DegreeRow
          k="比較級"
          colon="："
          v={comparative}
          selected={selectedDegreeKey === "comparative"}
          onClick={() => __degreeClick("comparative", comparative)}
        />
        <DegreeRow
          k="最高級"
          colon="："
          v={superlative}
          selected={selectedDegreeKey === "superlative"}
          onClick={() => __degreeClick("superlative", superlative)}
        />

        {notes ? (
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
            {notes}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DegreeRow({ k, colon, v, selected, onClick }) {
  // ✅ 比照形容詞：僅圈選「值」本體（posinfo-de-outline）
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
