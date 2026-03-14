// PATH: frontend/src/components/sentence/SentenceCard.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SpeakButton from "../common/SpeakButton";
import ConversationBox from "../conversation/ConversationBox";
import useConversation from "../conversation/useConversation";
import SpeakAnalyzePanel from "../speech/SpeakAnalyzePanel";
import { apiFetch } from "../../utils/apiClient";
import uiText from "../../uiText";

// -----------------------------
// Local helpers (self-contained)
// -----------------------------
const isPunctuationOnly = (s) => /^[\s\p{P}]+$/u.test(s);

const isTokenLike = (s) => {
  // Too short OR looks like token-to-token mapping "X: Y" OR punctuation.
  const t = (s || "").trim();
  if (!t) return true;
  if (t === ":") return true;
  if (isPunctuationOnly(t)) return true;
  if (t.length <= 2) return true;
  // common bad pattern: "Welche : 哪些" etc
  if (t.includes(":")) return true;
  // single word without spaces tends to be token-level, not explanation
  if (!t.includes(" ") && t.length < 6) return true;
  return false;
};

const cleanList = (arr, { allowShort = false } = {}) => {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const it of arr) {
    const raw =
      typeof it === "string"
        ? it
        : typeof it?.text === "string"
          ? it.text
          : typeof it?.hint === "string"
            ? it.hint
            : typeof it?.message === "string"
              ? it.message
              : "";
    const s = (raw || "").toString().trim();
    if (!s) continue;
    if (s === ":") continue;
    if (isPunctuationOnly(s)) continue;
    if (!allowShort && isTokenLike(s)) continue;
    // filter obvious "judgement" bullets (we only want explanation)
    if (/^\s*(Correct|Incorrect|Grammatically\s+correct|The\s+sentence\s+is\s+)/i.test(s)) continue;
    if (/^\s*(句子完全正確|句子語法正確|此句.*正確)/.test(s)) continue;

    if (out.includes(s)) continue;
    out.push(s);
  }
  return out;
};

const isRoleLabel = (s) => {
  const t = (s || "").toString().trim();
  if (!t) return false;
  // English
  if (/^(Subject|Verb|Object|Complement|Adjective|Adverbial|Time|Place)$/i.test(t)) return true;
  // Chinese common
  if (/^(主詞|主语|動詞|动词|受詞|受语|賓語|宾语|補語|补语|形容詞|形容词|時間|地点|地點)$/.test(t)) return true;
  return false;
};

const normalizeStructure = (s) => {
  // Preferred: backend provides structureLabels / structureRoles
  const labels = cleanList(s?.structureLabels || s?.structure || s?.breakdown, { allowShort: true });

  // If labels are sentence chunks (contain spaces / look like words), we ignore them.
  const roleLike = labels.filter((x) => isRoleLabel(x));
  if (roleLike.length >= 2) return roleLike;

  // Special-case legacy "Subject + Verb + Object" string
  if (typeof s?.structureLabel === "string" && s.structureLabel.includes("+")) {
    const parts = s.structureLabel.split("+").map((p) => p.trim()).filter(Boolean);
    const roleLike2 = parts.filter((x) => isRoleLabel(x));
    if (roleLike2.length >= 2) return roleLike2;
  }

  // Fallback: do not show structure rather than showing sentence chunks (per requirement)
  return [];
};

const isZhLike = (labels) => {
  const hint = (labels?.speakTitle || labels?.moreLabel || "").toString();
  return /[\u4e00-\u9fff]/.test(hint);
};

const roleLabelI18n = (role, zh) => {
  const r = (role || "").toString().trim();
  const key = r.toLowerCase();
  if (zh) {
    if (key === "subject" || r === "主语" || r === "主詞") return "主詞";
    if (key === "verb" || r === "动词" || r === "動詞") return "動詞";
    if (key === "object" || r === "受语" || r === "受詞" || r === "宾语" || r === "賓語") return "受詞";
    if (key === "complement" || r === "补语" || r === "補語") return "補語";
    if (key === "adjective" || r === "形容词" || r === "形容詞") return "形容詞";
    if (key === "adverbial") return "狀語";
    if (key === "time" || r === "時間") return "時間";
    if (key === "place" || r === "地点" || r === "地點") return "地點";
    return r;
  }
  // English
  if (r === "主詞" || r === "主语") return "Subject";
  if (r === "動詞" || r === "动词") return "Verb";
  if (r === "受詞" || r === "受语" || r === "賓語" || r === "宾语") return "Object";
  if (r === "補語" || r === "补语") return "Complement";
  if (r === "形容詞" || r === "形容词") return "Adjective";
  if (r === "時間") return "Time";
  if (r === "地點" || r === "地点") return "Place";
  return r || t.sentence.structureRoleFallback;
};

const simplifyBullet = (x) => {
  const s = (x ?? "").toString().trim();
  if (!s) return "";
  // remove common bullet prefixes
  return s.replace(/^[-•*\u2022\u2027\u25CF\u25E6\u25AA\u25AB]\s*/u, "").trim();
};

const normalizeHighlights = (arr, text) => {
  if (!Array.isArray(arr)) return [];
  const t = (text || "").toString();
  const out = [];
  for (const h of arr) {
    if (!h || typeof h !== "object") continue;
    const start = Number.isFinite(h.start) ? h.start : -1;
    const end = Number.isFinite(h.end) ? h.end : -1;
    const role = typeof h.role === "string" ? h.role : "";
    const rawText = typeof h.text === "string" ? h.text : "";
    if (start < 0 || end <= start || end > t.length) continue;
    if (rawText && t.slice(start, end) !== rawText) {
      // tolerate minor mismatch but must still match by substring search at the same start
      continue;
    }
    out.push({ start, end, role });
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  // drop overlaps (keep first)
  const merged = [];
  for (const h of out) {
    const last = merged[merged.length - 1];
    if (!last || h.start >= last.end) merged.push(h);
  }
  return merged;
};

const tokenRegex = /(\s+|[.,!?;:"()«»„“”])/;

// =========================================================
// ✅ Learning-mode helpers
// - Force single core point
// - Force exactly 1 extension example when available
// =========================================================
const normalizeLearningFocus = (s, allBullets) => {
  if (!s || typeof s !== "object") return "";

  const lf = s.learningFocus;

  // object form
  if (lf && typeof lf === "object") {
    const title = typeof lf.title === "string" ? lf.title.trim() : "";
    const why = typeof lf.whyImportant === "string" ? lf.whyImportant.trim() : "";
    const chunk = typeof lf.chunk === "string" ? lf.chunk.trim() : "";
    const pick = why || title || chunk;
    if (pick) return simplifyBullet(pick);
  }

  // string form
  if (typeof lf === "string" && lf.trim()) return simplifyBullet(lf.trim());

  // legacy arrays / bullets
  if (Array.isArray(allBullets) && allBullets.length) {
    const first = allBullets.find((x) => typeof x === "string" && x.trim());
    if (first) return simplifyBullet(first);
  }

  // fallback: if backend only provided extend example focus) && s.extendExamples.length ? s.extendExamples[0] : null;
  const exFocus = ex0 && typeof ex0 === "object" ? (ex0.focus ?? ex0.point ?? ex0.learningPoint ?? "") : "";
  if (typeof exFocus === "string" && exFocus.trim()) return simplifyBullet(exFocus.trim());

  return "";
};

const pickFirstExtendExample = (s) => {
  const candidates = [
    s?.extendExamples,
    s?.extendExample,
    s?.extend_example,
    s?.extendExamplesRaw,
  ];

  for (const c of candidates) {
    if (!c) continue;
    if (Array.isArray(c) && c.length) return c[0];
    if (typeof c === "object") return c;
    if (typeof c === "string" && c.trim()) return { de: c.trim() };
  }
  return null;
};

const normalizeExtendExample = (raw) => {
  if (!raw) return null;
  if (typeof raw === "string") return { de: raw.trim(), zh: "", focus: "" };
  const de = (raw.de ?? raw.text ?? raw.sentence ?? raw.example ?? "").toString().trim();
  const zh = (raw.zh ?? raw.translation ?? raw.meaning ?? raw.zhTW ?? raw.zhCN ?? "").toString().trim();
  const focus = (raw.focus ?? raw.point ?? raw.learningPoint ?? "").toString().trim();
  if (!de && !zh) return null;
  return { de, zh, focus };
};

export default function SentenceCard({ input, sentence, labels, uiLang: uiLangProp, onWordClick, onSpeak, onExpand }) {
  // Prefer upstream uiLang from AppShell/ResultPanel; fallback to legacy labels.uiLang.
  const uiLang = uiLangProp || labels?.uiLang || "zh-TW";
  const tCandidate = uiText[uiLang] ?? uiText["zh-TW"];
  const t = tCandidate?.sentence ? tCandidate : uiText["zh-TW"];
  const s = sentence && typeof sentence === "object" ? sentence : null;
  const text = (input ?? "").toString();

  const meaning = (s?.meaning ?? "").toString().trim();

  // ✅ Normalize uiLang: accept UI labels like "English/Deutsch/繁體中文"
  const normalizeUiLang = useCallback((x) => {
    const raw = String(x || "").trim();
    if (!raw) return "en";
    const low = raw.toLowerCase();
    if (low === "english") return "en";
    if (low === "german" || low === "deutsch") return "de";
    if (low === "arabic" || raw === "العربية") return "ar";
    if (low === "traditional chinese" || raw.includes("繁體") || raw.includes("繁体")) return "zh-TW";
    if (low === "simplified chinese" || raw.includes("简体")) return "zh-CN";
    if (low.startsWith("zh-cn")) return "zh-CN";
    if (low.startsWith("zh")) return "zh-TW";
    if (low.startsWith("en")) return "en";
    if (low.startsWith("de")) return "de";
    if (low.startsWith("ar")) return "ar";
    return low.split("-")[0] || "en";
  }, []);

  const uiLangNorm = normalizeUiLang(labels?.uiLang || uiLang);
  const zhLike = /^zh\b/i.test(uiLangNorm) || uiLangNorm.toLowerCase().startsWith("zh-");
  const notes = cleanList(s?.notes).map((x) => simplifyBullet(x)).filter(Boolean);
  const expand = s && typeof s.expand === "object" && s.expand ? s.expand : null;

  // ✅ Stable template bullets (always render before notes; NOT dependent on expand mode)
  const templateLines = useMemo(() => {
    const base = cleanList(s?.template).map((x) => (x ?? "").toString().trim()).filter(Boolean);
    if (base.length > 0) return base;
    // Back-compat: older expand payload had template as a single string
    const legacy = (expand?.template ?? "").toString().trim();
    return legacy ? [legacy] : [];
  }, [s, expand]);

  const allBullets = useMemo(() => {
    // template always first
    return [...templateLines, ...notes].filter(Boolean);
  }, [templateLines, notes]);

  // ✅ One core point only (B-mode)
  const corePoint = useMemo(() => normalizeLearningFocus(s, allBullets), [s, allBullets, zhLike]);
  const coreChunk = useMemo(() => {
    const lf = s?.learningFocus;
    if (lf && typeof lf === "object") {
      const title = typeof lf.title === "string" ? lf.title.trim() : "";
      if (title) return title;
      const chunk = typeof lf.chunk === "string" ? lf.chunk.trim() : "";
      if (chunk) return chunk;
    }
    return "";
  }, [s]);
// ✅ One extension example only (B-mode)
  const extendExample = useMemo(() => {
    const fromSentence = pickFirstExtendExample(s);
    if (fromSentence) return normalizeExtendExample(fromSentence);
    // Back-compat: some expand payloads store example-like variants as strings
    if (Array.isArray(expand?.variants) && expand.variants.length > 0) {
      return normalizeExtendExample({ de: (expand.variants[0] ?? "").toString().trim() });
    }
    return normalizeExtendExample(expand?.example || null);
  }, [s, expand]);

  // ✅ Structure: show only role labels (no sentence chunks, no lookup)
  const structureLabels = useMemo(() => normalizeStructure(s), [s]);
  const structureRoles = Array.isArray(s?.structureRoles) ? s.structureRoles : [];

  // ✅ Verb highlights (for head sentence + verb chip coloring)
  const highlights = useMemo(
    () => normalizeHighlights(s?.highlights || s?.grammarHighlights || s?.verbHighlights, text),
    [s, text]
  );

  const hasVerbHighlight = highlights.some((h) => /^(verb_finite|aux|verb|finite|auxVerb)$/i.test(h.role));

  const speakTitle = (labels?.speakTitle || t.sentence.speakTitle).toString();
  const moreLabel = (labels?.moreLabel || t.sentence.moreLabel).toString();
  const extendTitle = (labels?.extendExampleTitle || t.sentence.extendExampleTitle).toString();

  // =========================================================
  // ✅ Conversation (like WordExampleBlock)
  // - Use useConversation per-sentence via storageKey
  // =========================================================
  const convStorageKey = useMemo(() => {
    const base = (text || "").trim();
    return base ? `sentence:${base}` : "";
  }, [text]);

  const {
    conversation,
    loading: conversationLoading,
    error: conversationError,
    isOpen: conversationIsOpen,
    openConversation,
    closeConversation,
    nextTurn,
    prevTurn,
  } = useConversation({
    mainSentence: text,
    mainTranslation: meaning,
    storageKey: convStorageKey,
  });

  const handleToggleConversation = useCallback(() => {
    if (!text) return;
    if (conversationIsOpen) {
      closeConversation();
      return;
    }
    openConversation();
    setPronOpen(true);
  }, [text, conversationIsOpen, closeConversation, openConversation]);

  // =========================================================
  // ✅ Pronunciation (record + analyze) - minimal
  // - Keep pronOpen BEFORE conversation keyboard guards (uses global flags)
  // =========================================================
  const [pronOpen, setPronOpen] = useState(false);

  // =========================================================
  // ✅ Conversation keyboard nav + global guards (match ExampleSentence)
  // - When conversation is open, ArrowLeft/ArrowRight ONLY switch turns
  // - It MUST NOT trigger ResultPanel history navigation
  // =========================================================
  const conversationToggleRef = useRef(null);
  const conversationNavRef = useRef(null);
  const conversationActive = !!conversationIsOpen;
  const sentenceCardRootRef = useRef(null);
  const [pronPanelBoundWidth, setPronPanelBoundWidth] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const rootEl = sentenceCardRootRef.current;
    if (!rootEl) return undefined;

    const measure = () => {
      try {
        const host = rootEl.closest('[data-ref="result-panel-root"]') || rootEl;
        const rect = host && typeof host.getBoundingClientRect === "function" ? host.getBoundingClientRect() : null;
        const next = rect ? Math.max(0, Math.floor(rect.width)) : 0;
        setPronPanelBoundWidth((prev) => (prev === next ? prev : next));
      } catch (e) {}
    };

    measure();

    let ro = null;
    try {
      const host = rootEl.closest('[data-ref="result-panel-root"]') || rootEl;
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => measure());
        ro.observe(host);
      }
    } catch (e) {}

    window.addEventListener("resize", measure);
    return () => {
      try { window.removeEventListener("resize", measure); } catch (e) {}
      try { if (ro) ro.disconnect(); } catch (e) {}
    };
  }, []);

  // ✅ Normalize turns: ensure each turn has `.translation` for current uiLang
  const pickTurnTranslation = useCallback((turnObj, uiLang0) => {
    if (!turnObj) return "";
    const lang = (uiLang0 || "zh-TW").toString();
    const langLower = lang.toLowerCase();
    const isZh = /^zh\b/i.test(lang) || langLower.startsWith("zh-");

    const c1 = turnObj.translationByLang && typeof turnObj.translationByLang === "object" ? turnObj.translationByLang[lang] : "";
    if (typeof c1 === "string" && c1.trim()) return c1.trim();
    const c2 = turnObj.translations && typeof turnObj.translations === "object" ? turnObj.translations[lang] : "";
    if (typeof c2 === "string" && c2.trim()) return c2.trim();

    // Non-Chinese UI: do NOT fall back to legacy Chinese fields
    if (!isZh) {
      const direct = (turnObj && typeof turnObj === "object" && typeof turnObj[lang] === "string") ? turnObj[lang] : "";
      if (typeof direct === "string" && direct.trim()) return direct.trim();
      const en = turnObj.en;
      if (langLower === "en" && typeof en === "string" && en.trim()) return en.trim();
      return "";
    }

    // Chinese UI: allow legacy fallbacks
    const c3 = turnObj.translation;
    if (typeof c3 === "string" && c3.trim()) return c3.trim();
    const c4 = turnObj.zh || turnObj.zhTW || turnObj.zhCN;
    if (typeof c4 === "string" && c4.trim()) return c4.trim();
    return "";
  }, []);
  const conversationNormalized = useMemo(() => {
    if (!conversation || !Array.isArray(conversation.turns)) return conversation;
    const lang = labels?.uiLang || uiLang || "zh-TW";
    const turns = conversation.turns.map((t0) => {
      if (!t0 || typeof t0 !== "object") return t0;
      const tr = (typeof pickTurnTranslation === "function") ? pickTurnTranslation(t0, lang) : (typeof t0.translation === "string" ? t0.translation.trim() : "");
      if (typeof tr === "string" && tr.trim()) return { ...t0, translation: tr.trim() };
      return t0;
    });
    return { ...conversation, turns };
  }, [conversation, labels?.uiLang, uiLang, pickTurnTranslation]);
  const conversationTurns = Array.isArray(conversationNormalized?.turns) ? conversationNormalized.turns : [];

  const conversationIndex =
    conversation && typeof conversation.currentIndex === "number" ? conversation.currentIndex : 0;
  const conversationCanPrev = conversationActive && conversationIndex > 0;
  const conversationCanNext =
    conversationActive && conversationTurns.length > 0 && conversationIndex < conversationTurns.length - 1;

  // ✅ Conversation totals + currently displayed turn (match ExampleSentence behavior)
  const conversationTotal = conversationTurns.length;
  const __turnObj = conversationActive && conversationTurns[conversationIndex] ? conversationTurns[conversationIndex] : null;

  // ✅ Translation picker: follow user's selected UI language (uiLang)
  // - IMPORTANT: legacy `turnObj.translation/zh*` are treated as Chinese-only fallback.
  //   Otherwise, UI may briefly show EN then switch to ZH when async payload fills `translation`.

  const displayedTargetText = (__turnObj && typeof __turnObj.de === "string" && __turnObj.de.trim()) ? __turnObj.de : (text || "");
  const displayedTranslationText = (pickTurnTranslation(__turnObj, uiLang) || meaning || "");

  // ✅ SpeakAnalyzePanel view toggles (local, keep simple defaults)
  const [showTarget, setShowTarget] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const toggleShowTarget = useCallback(() => { setShowTarget((v) => !v); }, []);
  const toggleShowTranslation = useCallback(() => { setShowTranslation((v) => !v); }, []);

  // ✅ SpeakAnalyzePanel: conversation paging handlers
  const onConversationPrev = useCallback(() => {
    if (!conversationCanPrev) return;
    prevTurn();
  }, [conversationCanPrev, prevTurn]);
  const onConversationNext = useCallback(() => {
    if (!conversationCanNext) return;
    nextTurn();
  }, [conversationCanNext, nextTurn]);

  // ✅ SpeakAnalyzePanel: play current target sentence (reuse parent onSpeak)
  const onPlayTarget = useCallback(() => {
    if (typeof onSpeak !== "function") return;
    if (!displayedTargetText) return;
    try {
      // ✅ Return Promise (if any) so SpeakAnalyzePanel continuous-play can await
      return onSpeak(displayedTargetText);
    } catch (e) {}
  }, [onSpeak, displayedTargetText]);

  // Keep global flags in sync (ResultPanel respects these)
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.__CONV_NAV_ACTIVE = !!conversationActive;
    window.__SPEAK_PANEL_OPEN = !!pronOpen;
    return undefined;
  }, [conversationActive, pronOpen]);

  // ✅ Conversation keyboard navigation (ArrowLeft/ArrowRight)
  // - ALWAYS eat ArrowLeft/ArrowRight to prevent falling back to history navigation
  // - Guard: when SpeakAnalyzePanel is open, it owns ArrowLeft/ArrowRight
  useEffect(() => {
    if (!conversationActive) return undefined;

    const onKeyDownCapture = (e) => {
      if (!e) return;
      // Guard: when SpeakAnalyzePanel is open, it owns ArrowLeft/ArrowRight
      if (typeof window !== "undefined" && window.__SPEAK_PANEL_OPEN) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      // Prevent ResultPanel (history navigation) from seeing ArrowLeft/ArrowRight
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "ArrowLeft") {
        if (conversationCanPrev) prevTurn();
        return;
      }
      if (e.key === "ArrowRight") {
        if (conversationCanNext) nextTurn();
      }
    };

    window.addEventListener("keydown", onKeyDownCapture, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDownCapture, { capture: true });
    };
  }, [conversationActive, conversationCanPrev, conversationCanNext, nextTurn, prevTurn]);

  // =========================================================
  // ✅ Pronunciation state (record + analyze)
  // =========================================================
  const [recordState, setRecordState] = useState("idle"); // idle | recording
  const [seconds, setSeconds] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const [analyzeState, setAnalyzeState] = useState("idle"); // idle | loading | done | error
  const [pronTokens, setPronTokens] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const [asrWords, setAsrWords] = useState(null);

  // ✅ Cache pronunciation analysis per utterance (prevents cross-sentence bleed)
  const utteranceId = useMemo(() => {
    if (conversationActive) {
      const base = (conversation && (conversation.id || conversation.conversationId || conversation.sessionId)) ? (conversation.id || conversation.conversationId || conversation.sessionId) : "";
      return `conv:${base}:${conversationIndex}:${displayedTargetText || ""}`;
    }
    return `single:${text || ""}`;
  }, [conversationActive, conversation, conversationIndex, displayedTargetText, text]);

  const pronCacheRef = useRef(new Map()); // utteranceId -> { tokens, transcript, message, asrWords, analyzeState, hasAudio, audioBlob }


  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(0);
  const audioBlobRef = useRef(null);
  const replayUrlRef = useRef("");

  const stopTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = 0;
    }
  };

  const cleanupStream = () => {
    try {
      const s0 = mediaStreamRef.current;
      if (!s0) return;
      const tracks = s0.getTracks?.() || [];
      tracks.forEach((t) => {
        try { t.stop(); } catch (e) {}
      });
    } catch (e) {
      // ignore
    }
    mediaStreamRef.current = null;
  };

  const resetAudio = useCallback(() => {
    audioBlobRef.current = null;
    setHasAudio(false);
    setPronTokens([]);
    setTranscript("");
    setAsrWords(null);
    setAnalyzeState("idle");
    setMessage("");
    try {
      if (replayUrlRef.current) URL.revokeObjectURL(replayUrlRef.current);
    } catch (e) {}
    replayUrlRef.current = "";
 }, []);


  // ✅ When switching sentences, restore cached analysis (or clear if none)
  useEffect(() => {
    if (!pronOpen) return;
    const cache = pronCacheRef.current.get(utteranceId);
    if (cache) {
      setPronTokens(Array.isArray(cache.tokens) ? cache.tokens : []);
      setTranscript(typeof cache.transcript === "string" ? cache.transcript : "");
      setAsrWords(cache.asrWords ?? null);
      setAnalyzeState(cache.analyzeState || (cache.tokens || cache.transcript ? "done" : "idle"));
      setMessage(typeof cache.message === "string" ? cache.message : "");
      setHasAudio(!!cache.hasAudio);
      audioBlobRef.current = cache.audioBlob || null;
      // recreate replay url for this utterance
      try {
        if (replayUrlRef.current) URL.revokeObjectURL(replayUrlRef.current);
      } catch (e) {}
      replayUrlRef.current = cache.audioBlob ? URL.createObjectURL(cache.audioBlob) : "";
    } else {
      resetAudio();
    }
  }, [pronOpen, utteranceId, resetAudio]);


  const stopRecording = useCallback(() => {
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state && mr.state !== "inactive") mr.stop();
    } catch (e) {
      // ignore
    }
    stopTick();
    setRecordState("idle");
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setMessage(labels?.recordNotSupported || t.sentence.recordNotSupported);
      return;
    }

    resetAudio();
    setSeconds(0);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    chunksRef.current = [];

    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    mr.onstop = () => {
      stopTick();
      setRecordState("idle");
      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = blob;
        setHasAudio(!!blob && blob.size > 0);
        if (blob && blob.size > 0) {
          replayUrlRef.current = URL.createObjectURL(blob);
        }
        // cache audio per utterance
        try {
          const prev = pronCacheRef.current.get(utteranceId) || {};
          pronCacheRef.current.set(utteranceId, {
            ...prev,
            hasAudio: !!blob && blob.size > 0,
            audioBlob: blob,
          });
        } catch (e) {}
      } catch (e) {
        setMessage(labels?.recordBuildFail || t.sentence.recordBuildFail);
      } finally {
        chunksRef.current = [];
        cleanupStream();
      }
    };

    mr.start();
    setRecordState("recording");
    tickRef.current = setInterval(() => setSeconds((s0) => s0 + 1), 1000);
  }, [labels]);

  const onToggleRecord = useCallback(() => {
    if (recordState === "recording") stopRecording();
    else startRecording().catch(() => setMessage(labels?.recordStartFail || t.sentence.recordStartFail));
  }, [recordState, stopRecording, startRecording, labels]);

  const onReplay = useCallback(() => {
    const url = replayUrlRef.current;
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.play().catch(() => {});
    } catch (e) {
      // ignore
    }
  }, []);

  const callASR = useCallback(async (audioBlob) => {
    const fd = new FormData();
    fd.append("audio", audioBlob, "sentence.webm");
    fd.append("lang", "de-DE");
    fd.append("mode", "pron");
    const resp = await apiFetch("/api/speech/asr", { method: "POST", body: fd });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || data.ok !== true) {
      throw new Error((data && data.error) || "ASR_FAILED");
    }
    return data;
  }, []);

  const callPronTips = useCallback(
    async ({ targetText, transcriptText }) => {
      // IMPORTANT: must use apiFetch to include identity headers (Authorization or x-visit-id)
      // otherwise backend will reply 400 MISSING_IDENTITY
      const resp = await apiFetch("/api/analyze/pronunciation-tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uiLang,
          targetText: targetText || "",
          transcript: transcriptText || "",
          tokens: [],
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data) throw new Error("TIPS_FAILED");
      return data;
    },
    [uiLang]
  );

  const onAnalyzeOnce = useCallback(async () => {
    const blob = audioBlobRef.current;
    if (!blob || !blob.size) {
      setMessage(labels?.recordFirst || t.sentence.recordFirst);
      return;
    }
    setAnalyzeState("loading");
    setMessage("");
    try {
      const asr = await callASR(blob);
      const tr = (asr && (asr.transcript || asr.text)) || "";
      setTranscript(String(tr || ""));
      setAsrWords((asr && (asr.words || asr.asrWords)) || null);

      const tipsResp = await callPronTips({ targetText: (displayedTargetText || text), transcriptText: tr });
      const tips = Array.isArray(tipsResp.tips) ? tipsResp.tips : [];
      setPronTokens([]);
      setMessage(tips.filter((s0) => typeof s0 === "string" && s0.trim()).join(" "));
      setAnalyzeState("done");

      // cache analysis per utterance
      try {
        pronCacheRef.current.set(utteranceId, {
          tokens: [],
          transcript: String(tr || ""),
          message: tips.filter((s0) => typeof s0 === "string" && s0.trim()).join(" "),
          asrWords: (asr && (asr.words || asr.asrWords)) || null,
          analyzeState: "done",
          hasAudio: !!blob && blob.size > 0,
          audioBlob: blob,
        });
      } catch (e) {}    } catch (e) {
      setAnalyzeState("error");
      setMessage(labels?.analyzeFail || t.sentence.analyzeFail);
    }
  }, [callASR, callPronTips, labels, text, displayedTargetText, utteranceId]);

  const onClosePron = useCallback(() => {
    setPronOpen(false);
    if (conversationIsOpen) closeConversation();
  }, [conversationIsOpen, closeConversation]);

  // Stop recording if panel is closed
  useEffect(() => {
    if (!pronOpen && recordState === "recording") stopRecording();
  }, [pronOpen, recordState, stopRecording]);

  const sentenceTokens = useMemo(() => {
    // split while keeping delimiters
    return text.split(tokenRegex);
  }, [text]);

  const tokenMeta = useMemo(() => {
    // compute char offsets for each token (split keeps delimiters exactly)
    const meta = [];
    let pos = 0;
    for (const tok of sentenceTokens) {
      const len = tok.length;
      meta.push({ start: pos, end: pos + len, tok });
      pos += len;
    }
    return meta;
  }, [sentenceTokens]);

  const roleForIndex = (idxStart, idxEnd) => {
    for (const h of highlights) {
      if (idxStart < h.end && idxEnd > h.start) return h.role || "";
    }
    return "";
  };

  const isWordToken = (tok) => /[A-Za-zÄÖÜäöüß]/.test(tok);

  const renderSentence = () => {
    if (!text) return null;

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25, flexBasis: "100%"  }}>
          {tokenMeta.map(({ start, end, tok }, idx) => {
            if (tok == null) return null;
            if (!tok) return null;

            const trimmed = tok.trim();
            if (!trimmed) return tok;

            const role = roleForIndex(start, end);
            const isVerbish = /^(verb_finite|aux|verb|finite|auxVerb)$/i.test(role);
            const isParticiple = /^(participle|verb_participle)$/i.test(role);
            const hlStyle =
              isVerbish
                ? {
                    background: "var(--accent-soft)",
                    borderBottom: "2px solid var(--accent)",
                    borderRadius: 6,
                    padding: "0 2px",
                  }
                : isParticiple
                  ? {
                      background: "rgba(96, 165, 250, 0.16)",
                      borderBottom: "2px solid #60a5fa",
                      borderRadius: 6,
                      padding: "0 2px",
                    }
                  : null;

            const clickable = typeof onWordClick === "function" && isWordToken(tok);
            if (!clickable) {
              return (
                <span key={idx} style={hlStyle || undefined}>
                  {tok}
                </span>
              );
            }

            const t = trimmed;
            return (
              <span
                key={idx}
                onClick={() => onWordClick(t)}
                title={labels?.wordTitle || t}
                style={{
                  cursor: "pointer",
                  textDecoration: "underline dotted",
                  textUnderlineOffset: 3,
                  ...(hlStyle || {}),
                }}
              >
                {tok}
              </span>
            );
          })}
        </div>
          
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* ✅ Speak button inline after head sentence */}
          <SpeakButton
            onClick={typeof onSpeak === "function" ? () => onSpeak(text) : undefined}
            title={speakTitle}
            disabled={!text || typeof onSpeak !== "function"}
          />

          {/* ✅ Conversation toggle (match ExampleSentence SVG + class) */}
          <button
            ref={conversationToggleRef}
            type="button"
            onClick={handleToggleConversation}
            title={labels?.conversationTitle}
            aria-label="open-conversation"
            className="icon-button sound-button"
            disabled={!text}
            style={{
              border: "none",
              background: "transparent",
              cursor: !text ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
              opacity: !text ? 0.45 : 0.95,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 4h16a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H9l-3.2 3.2A1 1 0 0 1 4 18.9V5a1 1 0 0 1 1-1z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="10" r="0.9" fill="currentColor" />
              <circle cx="12" cy="10" r="0.9" fill="currentColor" />
              <circle cx="15" cy="10" r="0.9" fill="currentColor" />
            </svg>
          </button>

          {/* ✅ Pronunciation button (match ExampleSentence mic SVG + class) */}
          <button
            type="button"
            onClick={() => {
              if (!text) return;
              setPronOpen((v) => !v);
            }}
            title={labels?.pronunciationTitle || t.sentence.pronunciationPracticeTitle}
            aria-label="sentence-pronunciation"
            className="icon-button sound-button"
            disabled={!text}
            style={{
              border: "none",
              background: "transparent",
              cursor: !text ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
              opacity: !text ? 0.45 : 0.86,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 11a7 7 0 0 1-14 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M12 18v3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M8 21h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* ✅ Conversation prev/next (when open) */}
          {conversationActive && (
            <div
              ref={conversationNavRef}
              data-ref="conversationNav"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginLeft: 4,
                color: "#f97316",
              }}
            >
              <button
                type="button"
                onClick={prevTurn}
                disabled={!conversationCanPrev}
                title={conversationCanPrev ? t.sentence.conversationPrevLabel : ""}
                aria-label="conversation-prev"
                className="icon-button sound-button"
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  cursor: !conversationCanPrev ? "not-allowed" : "pointer",
                  opacity: !conversationCanPrev ? 0.35 : 0.95,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M15 18l-6-6 6-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                type="button"
                onClick={nextTurn}
                disabled={!conversationCanNext}
                title={conversationCanNext ? t.sentence.conversationNextLabel : ""}
                aria-label="conversation-next"
                className="icon-button sound-button"
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  cursor: !conversationCanNext ? "not-allowed" : "pointer",
                  opacity: !conversationCanNext ? 0.35 : 0.95,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M9 6l6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConversationPanel = () => {
    if (!conversationActive) return null;

    return (
      <div style={{ marginTop: 12 }}>
        <ConversationBox
          conversation={conversationNormalized || conversation}
          loading={conversationLoading}
          error={conversationError}
          onPrev={prevTurn}
          onNext={nextTurn}
          onClose={closeConversation}
          onSpeak={typeof onSpeak === "function" ? (t) => onSpeak(t) : undefined}
          onWordClick={typeof onWordClick === "function" ? onWordClick : undefined}
          labels={labels}
          variant="sentenceCard"
        />
      </div>
    );
  };

  const renderPronunciationPanel = () => {
    if (!pronOpen) return null;
    const boundWidthPx = Number.isFinite(pronPanelBoundWidth) && pronPanelBoundWidth > 0 ? `${Math.max(0, pronPanelBoundWidth)}px` : "720px";
    return (
      <div
        className="solang-sentence-pron-bound"
        style={{ marginTop: 12, ["--solang-pron-bound-width"]: boundWidthPx }}
      >
        <style>{`
          .solang-sentence-pron-bound > [role="dialog"] > div {
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            width: min(calc(100vw - 48px), var(--solang-pron-bound-width)) !important;
            max-width: var(--solang-pron-bound-width) !important;
          }
        `}</style>
        <SpeakAnalyzePanel
          targetText={displayedTargetText}
          translationText={displayedTranslationText}
          uiLang={uiLang}

          showTarget={showTarget}
          showTranslation={showTranslation}
          onToggleShowTarget={toggleShowTarget}
          onToggleShowTranslation={toggleShowTranslation}
          onPlayTarget={onPlayTarget}

          disabled={!displayedTargetText}
          recordState={recordState}
          seconds={Number.isFinite(seconds) ? seconds : 0}
          hasAudio={hasAudio}
          analyzeState={analyzeState}
          tokens={pronTokens || []}
          transcript={transcript || ""}
          message={message || ""}

          onClose={onClosePron}
          onToggleRecord={onToggleRecord}
          onReplay={onReplay}
          onAnalyzeOnce={onAnalyzeOnce}

          // Optional: if caller has ASR words, panel can color tokens by confidence.
          asrWords={asrWords || []}
          confidenceThreshold={0.85}

          // Optional: conversation paging (SentenceCard now supports dialog examples)
          conversationActive={!!conversationActive}
          conversationIndex={Number.isFinite(conversationIndex) ? conversationIndex : 0}
          conversationTotal={Number.isFinite(conversationTotal) ? conversationTotal : 0}
          conversationCanPrev={!!conversationCanPrev}
          conversationCanNext={!!conversationCanNext}
          onConversationPrev={onConversationPrev}
          onConversationNext={onConversationNext}
        />
      </div>
    );
  };

  const Divider = () => (
    <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 12, paddingTop: 12 }} />
  );

  const renderBullets = (items) => {
    const list = cleanList(items);
    if (list.length === 0) return null;
    return (
      <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
        {list.map((t, i) => (
          <li key={i} style={{ margin: "4px 0", lineHeight: 1.45 }}>
            {t}
          </li>
        ))}
      </ul>
    );
  };

  const renderStructureLine = () => {
    // Render as a subtle single line, e.g. "主詞＋動詞＋受詞" / "Subject＋Verb＋Object"
    const roles = (structureLabels && structureLabels.length ? structureLabels : []).map((r) => roleLabelI18n(r, zhLike));
    if (!roles.length) return null;

    const sep = "＋";
    const parts = [];
    for (let i = 0; i < roles.length; i++) {
      const r = roles[i];
      const isVerbLabel = (zhLike ? r === "動詞" : r.toLowerCase() === "verb");
      parts.push(
        <span key={`r-${i}`} style={isVerbLabel ? { color: "var(--accent)", fontWeight: 700 } : undefined}>
          {r}
        </span>
      );
      if (i !== roles.length - 1) parts.push(<span key={`sep-${i}`} style={{ margin: "0 4px", color: "var(--text-muted)" }}>{sep}</span>);
    }

    return (
      <div style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 13,
        color: "var(--text-muted)",
        userSelect: "none",
        lineHeight: 1.4,
      }}>
        {parts}
      </div>
    );
  };

  const hasExpand = !!expand;

  return (
    <div
      ref={sentenceCardRootRef}
      data-ref="sentence-card-root"
      style={{
        position: "relative",
        background: "var(--card-bg)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
      }}
    >
      {/* optional expand trigger (kept minimal, no extra section title) */}
      {typeof onExpand === "function" && !hasExpand ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => onExpand(text)}
            className="btn btn-ghost"
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--border-subtle)",
              background: "var(--card-soft)",
            }}
          >
            {moreLabel}
          </button>
        </div>
      ) : null}

      {renderSentence()}

      {renderPronunciationPanel()}

      <Divider />
      <div style={{ marginTop: 6, lineHeight: 1.55 }}>
        {meaning || <span style={{ color: "var(--text-muted)" }}>(Sentence meaning unavailable)</span>}
      </div>

      {/* ✅ B-mode: remove grammar classification line; always show 1 core point */}
      {corePoint ? (
        <>
          <Divider />
          <div style={{ marginTop: 10 }}>
            
            {corePoint ? (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 6 }}>
              <div style={{ marginTop: 2 }}>•</div>
              <div>
                {coreChunk ? (
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{coreChunk}</div>
                ) : null}
                <div>{corePoint}</div>
              </div>
            </div>
          ) : null}
          </div>
        </>
      ) : null}

      {/* ✅ B-mode: show exactly 1 extension example when available */}
      {extendExample ? (
        <>
          <Divider />
          <div style={{ marginTop: 10, lineHeight: 1.55 }}>
            <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 6 }}>{extendTitle}</div>
            {extendExample.de ? <div style={{ fontWeight: 600, fontSize: 13.5 }}>{extendExample.de}</div> : null}
            {(() => {
              const m1 = extendExample.translationByLang && typeof extendExample.translationByLang === "object" ? extendExample.translationByLang : null;
              const m2 = extendExample.translations && typeof extendExample.translations === "object" ? extendExample.translations : null;
              const pickFromMap = (m) => {
                if (!m) return "";
                const k1 = uiLangNorm;
                const k2 = uiLangNorm.toLowerCase();
                const k3 = uiLangNorm.replace("_", "-");
                const k4 = uiLangNorm.split("-")[0];
                const v = m[k1] ?? m[k2] ?? m[k3] ?? m[k4] ?? "";
                return typeof v === "string" ? v.trim() : "";
              };
              const tr =
                pickFromMap(m1) ||
                pickFromMap(m2) ||
                (typeof extendExample.translation === "string" ? extendExample.translation.trim() : "") ||
                // If selected language missing, fall back to any available translation (avoid blank UI)
                (uiLangNorm.startsWith("zh")
                  ? (typeof extendExample.zh === "string" ? extendExample.zh.trim() : "")
                  : (typeof extendExample.en === "string" ? extendExample.en.trim() : "")) ||
                (typeof extendExample.zh === "string" ? extendExample.zh.trim() : "") ||
                (typeof extendExample.en === "string" ? extendExample.en.trim() : "");
              return tr ? <div style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 13, fontWeight: 450 }}>{tr}</div> : null;
            })()}
            {null}
          </div>
        </>
      ) : null}

      {hasExpand ? (
        <>
          <Divider />
          {Array.isArray(expand?.variants) && expand.variants.length > 0 ? (
            <div style={{ marginTop: 10 }}>{renderBullets(expand.variants)}</div>
          ) : null}

          {Array.isArray(expand?.commonMistakes) && expand.commonMistakes.length > 0 ? (
            <div style={{ marginTop: 10 }}>{renderBullets(expand.commonMistakes)}</div>
          ) : null}

          {Array.isArray(expand?.extraNotes) && expand.extraNotes.length > 0 ? (
            <div style={{ marginTop: 10 }}>{renderBullets(expand.extraNotes)}</div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}