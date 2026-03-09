// analyzeGrammar.js (FULL FILE REPLACE)
const groqClient = require("../clients/groqClient");
const { normalizeLang, promptPack } = require("../i18n");

function mapExplainLang(explainLang) {
  const l = normalizeLang(explainLang);
  switch (l) {
    case "en":
      return "English";
    case "de":
      return "German";
    case "ar":
      return "Arabic";
    case "zh-CN":
      return "Simplified Chinese";
    case "zh-TW":
    default:
      return "Traditional Chinese";
  }
}

function buildPrompts({ t, targetLangLabel, explainLang }) {
  // Explanations should follow explainLang. The German chunk itself should remain in German.
  const lang = normalizeLang(explainLang || "en");
  const P = promptPack("analyzeGrammar", lang) || promptPack("analyzeGrammar", "en") || {};

  const S = P;

  const __langNote = (P && Object.keys(P).length ? "" : `
IMPORTANT: Write ALL explanations in ${targetLangLabel}.`);
  const basic = `
${S.coach}${__langNote}
Please focus on ONE highest-value spoken CHUNK / PATTERN (exactly one) and provide ONE extension example sentence.

${S.sentenceLabel}:
"${t}"

${S.outLang}: ${targetLangLabel}
${S.onlyJson}

${S.rulesTitle}
${S.rules.join("\n")}

${S.bansTitle}
- ${S.bans.join("\n- ")}

${S.exTitle}
- ${S.exRules.join("\n- ")}

${S.jsonSchema}
{
  "isCorrect": true 或 false,
  "overallComment": "",
  "errors": [],
  "translation": "",
  "structureLabels": [],
  "structureRoles": [],
  "highlights": [{"role":"","start":0,"end":0,"text":""}],
  "keyPoints": [""],
  "learningFocus": {"title":"","whyImportant":""},
  "extendExample": {"de":"","translation":""}
}
`.trim();

  const expand = `
${S.expandCoach}

${S.sentenceLabel}:
"${t}"

${S.outLang}: ${targetLangLabel}
${S.onlyJson}

Return the SAME JSON fields as in basic, plus:
{
  "templates": [{"de":"","translation":""}],
  "variants": [{"de":"","translation":""}]
}
Constraints:
- templates/variants: keep them short and reusable.
- Still: ONE core point only. Still: ONE extension example only.
`.trim();

  const repair = `
${S.repairCoach}
${S.onlyJson}

Rules:
- keyPoints length MUST be 1
- learningFocus.title and whyImportant MUST be non-empty
- extendExample.de and extendExample.translation MUST be non-empty
- structureLabels and structureRoles MUST be empty arrays []
- learningFocus.title MUST include at least one German word/chunk from the original sentence (keep it in German)
- The core point must follow the chunk/pattern priority (chunks > patterns > transferable rule > word meaning)
`.trim();

  return { promptBasic: basic, promptExpand: expand, repairPrompt: repair };
}



function fallbackGrammar(detail = "basic") {
  const base = {
    isCorrect: true,
    overallComment: "",
    errors: [],
    // sentence-first fields (may be empty on fallback)
    translation: "",
    // ✅ structureLabels: role-only chips (no sentence chunks)
    structureLabels: [],
    // ✅ structureRoles: enum-like roles aligned with structureLabels
    structureRoles: [],
    // ✅ verb-related highlights on the original sentence (char ranges)
    highlights: [],
    keyPoints: [],
    // B-mode learning payload
    learningFocus: { title: "", whyImportant: "" },
    extendExample: { de: "", translation: "" },
  };

  if (detail === "expand") {
    return {
      ...base,
      template: "",
      variants: [],
      commonMistakes: [],
      extraNotes: [],
    };
  }

  return base;
}

function sanitizeHighlights(highlights, text) {
  if (!Array.isArray(highlights)) return [];
  const t = (text || "").toString();
  const out = [];
  for (const h of highlights) {
    if (!h || typeof h !== "object") continue;
    const role = typeof h.role === "string" ? h.role : "";
    const start = Number.isFinite(h.start) ? h.start : -1;
    const end = Number.isFinite(h.end) ? h.end : -1;
    const ht = typeof h.text === "string" ? h.text : "";
    if (!role) continue;
    if (start < 0 || end <= start || end > t.length) continue;
    if (ht && t.slice(start, end) !== ht) continue;
    out.push({ role, start, end, text: ht || t.slice(start, end) });
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  // drop overlaps (keep first)
  const merged = [];
  for (const h of out) {
    const last = merged[merged.length - 1];
    if (!last || h.start >= last.end) merged.push(h);
  }
  return merged;
}

function sanitizeKeyPoints(points) {
  if (!Array.isArray(points)) return [];
  const out = [];
  for (const p of points) {
    const s = (typeof p === "string" ? p : "").trim();
    if (!s) continue;
    // Avoid judgement-style notes; keep explanation only.
    if (/^\s*(Correct|Incorrect|Grammatically\s+correct|The\s+sentence\s+is\s+)/i.test(s)) continue;
    if (/^\s*(句子完全正確|句子語法正確|此句.*正確)/.test(s)) continue;
    if (out.includes(s)) continue;
    out.push(s);
  }
  return out.slice(0, 5);
}

function sanitizeLearningFocus(lf) {
  const o = lf && typeof lf === "object" ? lf : {};
  const title = (typeof o.title === "string" ? o.title : "").trim();
  const whyImportant = (typeof o.whyImportant === "string" ? o.whyImportant : "").trim();
  return { title, whyImportant };
}

function sanitizeExtendExample(ex) {
  const o = ex && typeof ex === "object" ? ex : {};
  const de = (typeof o.de === "string" ? o.de : "").trim();
  const translation = (typeof o.translation === "string" ? o.translation : "").trim();
  return { de, translation };
}

// ============================================================
// ✅ Multi-call LLM quality guard（不靠白名單）
// 目標：用「Validator + Repair 重新提示」來穩定結構輸出品質
// - 第一次：正常生成 JSON
// - Validator：檢查結構/roles/問句規則/labels 合理性
// - 失敗：把「錯誤原因 + 原 JSON」丟回 LLM，要求只修 JSON
// - 最多重試 2 次
// ============================================================

const ALLOWED_ROLES = new Set([
  "question_word",
  "subject",
  "verb",
  "object",
  "complement",
  "time",
  "place",
  "other",
]);

function pickLang(explainLang) {
  return normalizeLang(explainLang || "en");
}

function roleLabel(role, lang) {
  const map = {
    "zh-TW": {
      question_word: "疑問詞",
      subject: "主詞",
      verb: "動詞",
      object: "受詞",
      complement: "補語",
      time: "時間",
      place: "地點",
      other: "其他",
    },
    "zh-CN": {
      question_word: "疑问词",
      subject: "主语",
      verb: "动词",
      object: "宾语",
      complement: "补语",
      time: "时间",
      place: "地点",
      other: "其他",
    },
    en: {
      question_word: "Question word",
      subject: "Subject",
      verb: "Verb",
      object: "Object",
      complement: "Complement",
      time: "Time",
      place: "Place",
      other: "Other",
    },
    de: {
      question_word: "W-Frage",
      subject: "Subjekt",
      verb: "Verb",
      object: "Objekt",
      complement: "Ergänzung",
      time: "Zeit",
      place: "Ort",
      other: "Sonstiges",
    },
    ar: {
      question_word: "أداة استفهام",
      subject: "فاعل",
      verb: "فعل",
      object: "مفعول به",
      complement: "خبر/متمم",
      time: "زمان",
      place: "مكان",
      other: "أخرى",
    },
  };
  return map[lang]?.[role] || map.en?.[role] || map["zh-TW"][role] || "";
}

function isWQuestion(sentence) {
  return /^(wie|wer|was|wo|wann|warum|wieso|weshalb|welche[rnms]?|wessen|wem|wen)\b/i.test(String(sentence || "").trim());
}

function validateGrammarJSON(parsed, sentence, explainLang) {
  const errs = [];
  const t = String(sentence || "");
  const lang = pickLang(explainLang);

  if (typeof parsed.translation !== "string" || !parsed.translation.trim()) {
    errs.push("translation 必填且不可為空字串");
  }

  const labels = Array.isArray(parsed.structureLabels) ? parsed.structureLabels : [];
  const roles = Array.isArray(parsed.structureRoles) ? parsed.structureRoles : [];
  // B-mode: allow empty arrays to suppress grammar classification chips.
  if ((labels.length === 0) !== (roles.length === 0)) {
    errs.push("structureLabels 與 structureRoles 必須同時為空或同時為非空");
  }
  if (labels.length > 0 && labels.length !== roles.length) {
    errs.push("structureLabels 與 structureRoles 長度必須一致");
  }
  if (roles.length > 0) {
    for (const r of roles) {
      if (typeof r !== "string" || !ALLOWED_ROLES.has(r)) {
        errs.push(`structureRoles 出現不允許的值：${String(r)}`);
        break;
      }
    }
  }

  if (isWQuestion(t) && roles.length > 0) {
    if (roles[0] !== "question_word") {
      errs.push("W-疑問句：structureRoles[0] 必須是 question_word");
    }
    const expected = roleLabel("question_word", lang);
    if (labels[0] && expected && labels[0] !== expected) {
      errs.push(`W-疑問句：structureLabels[0] 應為「${expected}」以符合語言與角色一致`);
    }
  }

  if (parsed.highlights != null && !Array.isArray(parsed.highlights)) {
    errs.push("highlights 必須是陣列");
  }

  const kp = sanitizeKeyPoints(parsed.keyPoints).slice(0, 1);
  if (kp.length !== 1) {
    errs.push("keyPoints 必須且只能有 1 句核心教學重點");
  }

  const lf = sanitizeLearningFocus(parsed.learningFocus);
  if (!lf.title || !lf.whyImportant) {
    errs.push("learningFocus.title 與 learningFocus.whyImportant 必填");
  }
  // B-mode: title should point to a reusable German chunk/pattern.
  if (lf.title && !/[A-Za-zÄÖÜäöüß]/.test(lf.title)) {
    errs.push("learningFocus.title 必須包含德語語塊/句型（至少包含一個德文字母）");
  }

  const ex = sanitizeExtendExample(parsed.extendExample);
  if (!ex.de || !ex.translation) {
    errs.push("extendExample.de 與 extendExample.translation 必填（延伸例句 1 句）");
  }

  return { ok: errs.length === 0, errors: errs };
}

async function callLLMForGrammarJSON({ prompt, model = "llama-3.3-70b-versatile" }) {
  const response = await groqClient.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function buildRepairPrompt({ sentence, targetLangLabel, detailLevel, prevJSON, validationErrors }) {
  const errList = validationErrors.map((e) => `- ${e}`).join("\n");
  return `
你是「B-mode 德語語塊教練」的 JSON 修復器。你剛剛輸出的 JSON 不合格，請只輸出「修正後 JSON」，不要任何多餘文字。

句子："${sentence}"
輸出語言：${targetLangLabel}
detail: ${detailLevel}

不合格原因：
${errList}

你上一版 JSON：
${JSON.stringify(prevJSON, null, 2)}

修復時請嚴格遵守：
- structureLabels 必須是 []，structureRoles 必須是 []（B-mode 不顯示語法分類）。
- keyPoints 必須且只能 1 句，內容要教「語塊/句型怎麼用」，禁止寫「現在式/動詞/主詞/逗號」這種低價值點。
- learningFocus.title 必填，且必須包含德語語塊/句型本體（至少含一個德文字母），例如：Was ist los?（口語語塊）
- learningFocus.whyImportant 必填：說明可套用情境/可遷移性。
- extendExample.de / extendExample.translation 必填：延伸例句必須不同於原句（換情境或換主詞/稱呼），但維持同一語塊/句型。
- 若 isCorrect=true，errors 請輸出 []；若 isCorrect=false，errors 至少 1 筆且 suggestion 要口語自然。

核心選點優先序（請用來修復選錯重點的情況）：
1) 固定口語語塊 / 慣用問法 / 常見回應
2) 高頻可複用句型
3) 必要時才提可遷移規則
4) 最後才是單字解釋

請輸出修正後 JSON。
`.trim();
}

async function analyzeGrammar(text, explainLang = "zh-TW", options = {}) {
  const t = String(text || "").trim();
  const detail = options && typeof options === "object" && typeof options.detail === "string" ? options.detail : "basic";
  const detailLevel = detail === "expand" ? "expand" : "basic";
  if (!t) return fallbackGrammar(detailLevel);

  const targetLangLabel = mapExplainLang(explainLang);
  const suppressStructure = options && typeof options === "object" && options.intent === "sentence_decision";

  const { promptBasic, promptExpand, repairPrompt } = buildPrompts({ t, targetLangLabel, explainLang });

  try {
    const basePrompt = detailLevel === "expand" ? promptExpand : promptBasic;

    // 1) First pass generation
    let parsed = await callLLMForGrammarJSON({ prompt: basePrompt });
    if (!parsed) return fallbackGrammar(detailLevel);

    // 2) Validate + repair (multi-call)
    //    - 只做「品質保底」：不嘗試替你做語法全解析（那是另個專案）
    //    - 目標是：結構角色別再亂（例如 W-問句硬塞 SVO）
    for (let attempt = 0; attempt < 2; attempt++) {
      const v = validateGrammarJSON(parsed, t, explainLang);
      if (v.ok) break;
      const repairPrompt = buildRepairPrompt({
        sentence: t,
        targetLangLabel,
        detailLevel,
        prevJSON: parsed,
        validationErrors: v.errors,
      });
      const repaired = await callLLMForGrammarJSON({ prompt: repairPrompt });
      if (!repaired) break; // fall through; we'll sanitize whatever we have
      parsed = repaired;
    }

    const out = {
      isCorrect: Boolean(parsed.isCorrect),
      overallComment: parsed.overallComment || "",
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      translation: typeof parsed.translation === "string" ? parsed.translation : "",
      structureLabels: suppressStructure ? [] : (Array.isArray(parsed.structureLabels) ? parsed.structureLabels : []),
      structureRoles: suppressStructure ? [] : (Array.isArray(parsed.structureRoles) ? parsed.structureRoles : []),
      highlights: sanitizeHighlights(parsed.highlights, t),
      keyPoints: sanitizeKeyPoints(parsed.keyPoints).slice(0, 1),
      learningFocus: sanitizeLearningFocus(parsed.learningFocus),
      extendExample: sanitizeExtendExample(parsed.extendExample),
    };

    // Backward-compat fields (some callers still read `structure`)
    out.structure = out.structureLabels;

    if (detailLevel === "expand") {
      out.template = typeof parsed.template === "string" ? parsed.template : "";
      out.variants = Array.isArray(parsed.variants) ? parsed.variants : [];
      out.commonMistakes = Array.isArray(parsed.commonMistakes) ? parsed.commonMistakes : [];
      out.extraNotes = Array.isArray(parsed.extraNotes) ? parsed.extraNotes : [];
    }

    return out;
  } catch (err) {
    console.error("[grammar] Groq error:", err.message);
    return fallbackGrammar(detailLevel);
  }
}

module.exports = { analyzeGrammar };