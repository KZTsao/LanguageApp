import React from "react";

export default function NounCaseTable({
  CASE_KEYS,
  miniTableRows,

  resolvedCaseLabels,

  activeHeaderLabel,
  headerReference,

  activeTab,
  referenceDet,

  numberMode,
  baseArticleColor,

  selectedCell,

  isDetTypeAvailableInNumber,
  getNounForDisplay,
  getArticleForCell,

  onSelectCell,
}) {
  return (
    <div
      style={{
        padding: 8,
        borderRadius: 0,
        backgroundColor: "var(--bg-soft)",
        border: "1px solid var(--border-subtle)",
        fontSize: 13,
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) repeat(2, minmax(0, 1.35fr))",
          columnGap: 12,
          alignItems: "center",
          marginBottom: 4,
          fontWeight: 600,
          color: "var(--text-muted)",
        }}
      >
        <div />
        <div style={{ textAlign: "left" }}>
          {activeHeaderLabel}
          {!isDetTypeAvailableInNumber(activeTab) ? "（—）" : ""}
        </div>
        <div style={{ textAlign: "left", opacity: 0.55 }}>{headerReference}</div>
      </div>

      {/* rows */}
      <div style={{ display: "grid", rowGap: 2 }}>
        {CASE_KEYS.map((caseKey, index) => {
          const row = miniTableRows.find((r) => r.caseKey === caseKey);
          if (!row) return null;

          const caseLabel =
            caseKey === "Nom"
              ? resolvedCaseLabels.Nom
              : caseKey === "Akk"
              ? resolvedCaseLabels.Akk
              : caseKey === "Dat"
              ? resolvedCaseLabels.Dat
              : caseKey === "Gen"
              ? resolvedCaseLabels.Gen
              : caseKey;

          const nounDisplay = getNounForDisplay(caseKey);

          const activeAvailable = isDetTypeAvailableInNumber(activeTab);
          const activeArticle = activeAvailable
            ? getArticleForCell(caseKey, activeTab, row) || "-"
            : "";

          const refArticle = getArticleForCell(caseKey, referenceDet, row) || "-";

          const isActiveSelected =
            !!selectedCell &&
            selectedCell.caseKey === caseKey &&
            selectedCell.column === "active";

          const commonCellStyle = {
            fontWeight: 600,
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 1,
            padding: "3px 6px",
            borderRadius: 0,
            transition:
              "background-color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
          };

          const articleColor =
            numberMode === "pl"
              ? "var(--article-plural, #f2994a)"
              : baseArticleColor;

          return (
            <div
              key={caseKey}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1.1fr) repeat(2, minmax(0, 1.35fr))",
                columnGap: 12,
                alignItems: "baseline",
                borderBottom:
                  index < CASE_KEYS.length - 1
                    ? "1px solid rgba(0, 0, 0, 0.06)"
                    : "none",
                padding: "2px 0",
              }}
            >
              <div style={{ color: "var(--text-main)" }}>{caseLabel}</div>

              {/* active */}
              <div
                style={{
                  ...commonCellStyle,
                  cursor: activeAvailable ? "pointer" : "not-allowed",
                  opacity: activeAvailable ? 1 : 0.55,
                  border: isActiveSelected
                    ? `2px solid ${articleColor}`
                    : "1px solid transparent",
                  backgroundColor: isActiveSelected
                    ? "var(--bg-elevated)"
                    : "transparent",
                  pointerEvents: activeAvailable ? "auto" : "none",
                }}
                onClick={() => onSelectCell(caseKey, "active", row)}
                title={!activeAvailable ? "Plural 沒有 ein/eine" : ""}
              >
                {activeAvailable ? (
                  <>
                    <span style={{ color: articleColor }}>{activeArticle}</span>
                    <span>{nounDisplay}</span>
                  </>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </div>

              {/* reference */}
              <div
                style={{
                  ...commonCellStyle,
                  cursor: "default",
                  pointerEvents: "none",
                  opacity: 0.55,
                  border: "1px solid transparent",
                  backgroundColor: "transparent",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>{refArticle}</span>
                <span style={{ color: "var(--text-muted)" }}>{nounDisplay}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
