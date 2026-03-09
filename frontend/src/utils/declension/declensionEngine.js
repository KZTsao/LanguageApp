// frontend/src/utils/declension/declensionEngine.js
// Minimal, feature-based declension engine.
// Goal: validate form by (case/number/gender) and handle ambiguity (e.g. "den").

import {
  DEF_ARTICLE_BY_FEATURES,
  INDEF_ARTICLE_BY_FEATURES,
  DEF_ARTICLE_REVERSE,
  INDEF_ARTICLE_REVERSE,
} from "./tables/articles";

function norm(x) {
  return (x || "").trim().toLowerCase();
}

function getTables(type) {
  if (type === "def_article") {
    return { byFeatures: DEF_ARTICLE_BY_FEATURES, reverse: DEF_ARTICLE_REVERSE, hasPlural: true };
  }
  if (type === "indef_article") {
    return { byFeatures: INDEF_ARTICLE_BY_FEATURES, reverse: INDEF_ARTICLE_REVERSE, hasPlural: false };
  }
  // Future: personalPronoun / possessive etc.
  return null;
}

export function getPossibleFeaturesByForm(type, form) {
  const t = getTables(type);
  if (!t) return [];
  const f = norm(form);
  return t.reverse[f] ? [...t.reverse[f]] : [];
}

export function isFormCompatible(type, form, features) {
  const t = getTables(type);
  if (!t) return false;
  const f = norm(form);
  if (!f) return false;

  const possible = t.reverse[f];
  if (!possible || !possible.length) return false;

  const wantCase = features?.caseKey;
  const wantGender = features?.genderKey;
  const wantNumber = features?.numberKey;

  return possible.some((p) => {
    if (wantCase && p.caseKey !== wantCase) return false;
    if (wantNumber && p.numberKey !== wantNumber) return false;
    if (wantGender && p.genderKey !== wantGender) return false;
    return true;
  });
}

export function getAllowedForms(type, features) {
  const t = getTables(type);
  if (!t) return [];

  const { caseKey, genderKey, numberKey } = features || {};

  // forward lookup when we have explicit cell coords
  if (caseKey && genderKey) {
    const form = t.byFeatures?.[caseKey]?.[genderKey];
    if (!form) return [];
    // if asked plural for a non-plural cell, treat as incompatible
    const inferredNumber = genderKey === "p" ? "P" : "S";
    if (numberKey && inferredNumber !== numberKey) return [];
    return [form];
  }

  // reverse filter by possible features
  const out = new Set();
  for (const [form, poss] of Object.entries(t.reverse)) {
    if (poss.some((p) => {
      if (caseKey && p.caseKey !== caseKey) return false;
      if (numberKey && p.numberKey !== numberKey) return false;
      if (genderKey && p.genderKey !== genderKey) return false;
      return true;
    })) {
      out.add(form);
    }
  }
  return [...out];
}
