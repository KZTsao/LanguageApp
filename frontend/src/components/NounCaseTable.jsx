// frontend/src/components/NounCaseTable.jsx

import React from "react";
import { genderColors } from "../utils/wordCardConfig";

/**
 * 名詞四格變化（單數 + 定冠詞）
 *
 * props:
 * - gender: "der" | "die" | "das"
 * - baseForm: 單數基本型，例如 "Berlin"
 * - labels: {
 *     caseTableTitle,
 *     caseNom, caseAkk, caseDat, caseGen
 *   }
 *
 * 第 1 欄：多國語 + 德語備註（例：主格 (Nominativ)）
 * 第 2 欄：冠詞 + 名詞（例：der Berlin）
 * 樣式全部透明，讓多國語系可以動態延展。
 */

function makeGenitiveForm(noun, gender) {
  if (!noun) return "";
  if (gender === "die") return noun;

  const lower = noun.toLowerCase();
  const last = lower[lower.length - 1] || "";
  const vowels = "aeiouyäöü";

  if (vowels.includes(last)) return noun + "s";
  return noun + "es";
}

export default function NounCaseTable({ gender, baseForm, labels = {} }) {
  const noun = (baseForm || "").trim();
  if (!gender || !noun) return null;

  const {
    caseTableTitle = "Kasus – Singular (mit bestimmtem Artikel)",
    caseNom = "主格 (Nominativ)",
    caseAkk = "受格 (Akkusativ)",
    caseDat = "與格 (Dativ)",
    caseGen = "屬格 (Genitiv)",
  } = labels;

  const artColor = genderColors[gender] || "var(--text-main)";
  const genForm = makeGenitiveForm(noun, gender);

  const rows = [
    {
      key: "nom",
      label: caseNom,
      article:
        gender === "der" ? "der" :
        gender === "die" ? "die" :
        gender === "das" ? "das" : "",
      form: noun,
    },
    {
      key: "akk",
      label: caseAkk,
      article:
        gender === "der" ? "den" :
        gender === "die" ? "die" :
        gender === "das" ? "das" : "",
      form: noun,
    },
    {
      key: "dat",
      label: caseDat,
      article:
        gender === "der" ? "dem" :
        gender === "die" ? "der" :
        gender === "das" ? "dem" : "",
      form: noun,
    },
    {
      key: "gen",
      label: caseGen,
      article:
        gender === "der" ? "des" :
        gender === "die" ? "der" :
        gender === "das" ? "des" : "",
      form: (gender === "der" || gender === "das") ? genForm : noun,
    },
  ];

  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      {/* 標題：由 uiText 控制，多國語系 */}
      {caseTableTitle && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          {caseTableTitle}
        </div>
      )}

      {/* 透明「表格」：兩欄，左邊 label，右邊冠詞+名詞 */}
      <div
        style={{
          display: "grid",
          rowGap: 2,
          fontSize: 14,
          lineHeight: "22px",
          fontFamily: "var(--font-sans)",
        }}
      >
        {rows.map((row) => (
          <div
            key={row.key}
            style={{
              display: "grid",
              gridTemplateColumns: "auto auto minmax(0, 1fr)",
              columnGap: 8,
              alignItems: "baseline",
            }}
          >
            {/* 第 1 欄：多國語 + 德文備註，例如「主格 (Nominativ)」 */}
            <div style={{ color: "var(--text-main)" }}>{row.label}</div>

            {/* 第 2 欄：冒號，固定寬度就好 */}
            <div>：</div>

            {/* 第 3 欄：冠詞 + 名詞 */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 4,
              }}
            >
              <span
                style={{
                  color: artColor,
                  fontWeight: 600,
                }}
              >
                {row.article}
              </span>
              <span>{row.form}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
