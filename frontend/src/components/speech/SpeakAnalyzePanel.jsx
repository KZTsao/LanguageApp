// frontend/src/components/speech/SpeakAnalyzePanel.jsx (file start)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../utils/apiClient";
import uiText from "../../uiText";
import SpeakButton from "../common/SpeakButton";
import { EyeIconOpen, EyeIconClosed, MOSAIC_LINE } from "../common/EyeIcons";

// ============================================================
// SpeakAnalyzePanel
// - Standalone panel UI for: record / replay / analyze
// - i18n: prefer uiText + uiLang (fallback to internal defaults)
// - ASR token coloring: supports "realign" compare to avoid
//   "one mismatch makes the rest all wrong".
// ============================================================

function __pickTokenStyle(t) {
  const state = String((t && t.state) || "").toLowerCase();
  // expected states (best-effort):
  // - hit_high / hit_low / missing / extra / mismatch ...
  const isHit = state.includes("hit") || state.includes("match") || state.includes("ok");
  const isLow = state.includes("low") || state.includes("weak") || state.includes("soft");
  const isMissing = state.includes("miss") || state.includes("missing") || state.includes("absent");
  const isExtra = state.includes("extra") || state.includes("insert");

  if (isMissing) {
    return { background: "rgba(220,38,38,0.18)", color: "rgba(220,38,38,1)", border: "1px solid rgba(220,38,38,0.28)" };
  }
  if (isHit && isLow) {
    return { background: "rgba(34,197,94,0.12)", color: "rgba(34,197,94,1)", border: "1px solid rgba(34,197,94,0.20)" };
  }
  if (isHit) {
    return { background: "rgba(34,197,94,0.22)", color: "rgba(20,83,45,1)", border: "1px solid rgba(34,197,94,0.30)" };
  }
  if (isExtra) {
    return { background: "rgba(59,130,246,0.14)", color: "rgba(29,78,216,1)", border: "1px solid rgba(59,130,246,0.22)" };
  }
  return { background: "rgba(127,127,127,0.10)", color: "rgba(20,20,20,0.88)", border: "1px solid rgba(127,127,127,0.18)" };
}

function __normalizeWord(s) {
  if (!s) return "";
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[“”„"']/g, "")
    .replace(/[.,!?;:()[\]{}]/g, "")
    .replace(/\s+/g, " ");
}

function __tokenizeExpected(expectedText) {
  const raw = String(expectedText || "").trim();
  if (!raw) return [];
  // keep apostrophes in german contractions? we strip quotes above anyway.
  // Split by whitespace; strip punctuation on each token.
  const parts = raw.split(/\s+/).filter(Boolean);
  return parts.map((p) => {
    const norm = __normalizeWord(p);
    return { raw: p, norm };
  });
}

/**
 * Realign compare (greedy subsequence match):
 * - Walk expected tokens left->right.
 * - For each expected token, search forward in ASR words list for the next match.
 * - If found: mark hit_(high/low) based on confidence threshold and advance ASR index.
 * - If not found: mark missing (but do NOT consume ASR words).
 *
 * This prevents: "one early mismatch => all subsequent positional comparisons fail".
 */
function __realignTokens(expectedText, asrWords, confThreshold) {
  const exp = __tokenizeExpected(expectedText || "");
  const words = Array.isArray(asrWords) ? asrWords : [];
  const threshold = typeof confThreshold === "number" ? confThreshold : 0.85;

  let j = 0; // asr index
  const out = [];

  for (let i = 0; i < exp.length; i += 1) {
    const e = exp[i];
    const target = e && e.norm;
    if (!target) {
      out.push({ text: e.raw || "", state: "missing", confidence: 0 });
      continue;
    }

    let foundIndex = -1;
    let foundConf = 0;

    for (let k = j; k < words.length; k += 1) {
      const w = __normalizeWord(words[k] && (words[k].w || words[k].word || words[k].text));
      if (w && w === target) {
        foundIndex = k;
        foundConf = Number((words[k] && (words[k].confidence ?? words[k].conf)) || 0) || 0;
        break;
      }
    }

    if (foundIndex >= 0) {
      const isHigh = foundConf >= threshold;
      out.push({ text: e.raw, state: isHigh ? "hit_high" : "hit_low", confidence: foundConf });
      j = foundIndex + 1; // advance
    } else {
      out.push({ text: e.raw, state: "missing", confidence: 0 });
    }
  }

  // Optional: remaining ASR words are "extra" (not required by current AC)
  // We keep it minimal but present for debugging / future UX.
  for (let k = j; k < words.length; k += 1) {
    const wRaw = (words[k] && (words[k].w || words[k].word || words[k].text)) || "";
    const wNorm = __normalizeWord(wRaw);
    if (!wNorm) continue;
    out.push({ text: wRaw, state: "extra", confidence: Number(words[k] && (words[k].confidence ?? words[k].conf)) || 0, __extra: true });
  }

  return out;
}

function __getLangPack(uiLang) {
  const raw = String(uiLang || "").toLowerCase();
  if (raw === "zh-cn" || raw.startsWith("zh-cn")) return "zh-CN";
  if (raw === "zh-tw" || raw.startsWith("zh-tw")) return "zh-TW";
  // Default: align with uiText available packs (this repo currently ships zh-TW / zh-CN)
  return "zh-TW";
}


function __pick(obj, pathArr) {
  try {
    let cur = obj;
    for (let i = 0; i < pathArr.length; i += 1) {
      if (!cur) return undefined;
      cur = cur[pathArr[i]];
    }
    return cur;
  } catch (e) {
    return undefined;
  }
}

export default function SpeakAnalyzePanel({
  // ===== Legacy props (backward compatible) =====
  expectedText,

  // ===== Controlled target / translation (from ExampleSentence) =====
  // NOTE: Prefer these; fallback to expectedText for legacy callers.
  targetText,
  translationText,
  showTarget,
  showTranslation,
  onToggleShowTarget,
  onToggleShowTranslation,
  onPlayTarget,

  // ===== Panel core props =====
  disabled,
  recordState,
  seconds,
  hasAudio,
  analyzeState,
  tokens,
  transcript,
  message,
  onClose,
  onToggleRecord,
  onReplay,
  onAnalyzeOnce,

  // ✅ 2026-01-24: i18n (optional)
  uiLang,

  // ✅ 2026-01-24: realign compare (optional)
  // If parent can pass ASR response words, panel can self-color with realign.
  asrWords,
  confidenceThreshold,

  // ✅ 2026-02-01: Conversation paging (dialog practice)
  conversationActive,
  conversationIndex,
  conversationTotal,
  conversationCanPrev,
  conversationCanNext,
  onConversationPrev,
  onConversationNext,
}) {
  const __isRecording = recordState === "recording";

  // ============================================================
  // ✅ Controlled target/translation (single source of truth: parent)
  // - Prefer targetText/showTarget/... from ExampleSentence
  // - Fallback to legacy expectedText callers
  // ============================================================
  const __expected = String(targetText ?? expectedText ?? "");
  const __translation = String(translationText ?? "");

  const __canToggle = !disabled && !!__expected;
  const __canReplay = !disabled && !!hasAudio && !__isRecording;
  const __canAnalyze = !disabled && !!hasAudio && !__isRecording && analyzeState !== "processing";
  const __navDisabled = !!disabled || __isRecording || analyzeState === "processing";

  const __asrText = transcript || "";

  // ============================================================
  // ✅ Global guard: while panel is open, history left/right shortcuts MUST be disabled
  // ============================================================
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.__SPEAK_PANEL_OPEN = true;
    } catch (e) {
      // ignore
    }
    return () => {
      try {
        if (typeof window === "undefined") return;
        window.__SPEAK_PANEL_OPEN = false;
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // ============================================================
  // ✅ ArrowLeft/ArrowRight (capture):
  // - Always eat arrows while panel is open (prevent falling back to history)
  // - If conversation paging is enabled, trigger prev/next
  // ============================================================
  useEffect(() => {
    if (typeof window === "undefined") return;

    function __isEditable(el) {
      try {
        if (!el) return false;
        const tag = (el.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return true;
        if (typeof el.isContentEditable === "boolean" && el.isContentEditable) return true;
        const role = typeof el.getAttribute === "function" ? el.getAttribute("role") : "";
        if (role === "textbox") return true;
        return false;
      } catch (e) {
        return false;
      }
    }

    function onKeyDownCapture(e) {
      if (!e) return;
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      console.log("[20260203 record][SpeakAnalyzePanel][keydown]", { ts: Date.now(), key: e?.key });
      console.log("[20260202 record][SpeakAnalyzePanel][keydown]", { key: e?.key, ts: Date.now() });
      console.log("[20260202 record][SpeakAnalyzePanel][keydown]", { key: e?.key, ts: Date.now() });

      const el0 = e.target || null;
      const el1 = typeof document !== "undefined" ? document.activeElement : null;
      if (__isEditable(el0) || __isEditable(el1)) return;

      // ✅ Always block history
      e.preventDefault();
      e.stopPropagation();

      // ✅ If conversation paging is active, navigate
      if (!!conversationActive) {
        if (e.key === "ArrowLeft") {
          if (conversationCanPrev && typeof onConversationPrev === "function") {
            try { onConversationPrev(); } catch (err) {}
          }
          return;
        }
        if (e.key === "ArrowRight") {
          if (conversationCanNext && typeof onConversationNext === "function") {
            try { onConversationNext(); } catch (err) {}
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDownCapture, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDownCapture, { capture: true });
  }, [conversationActive, conversationCanPrev, conversationCanNext, onConversationPrev, onConversationNext]);

  // ============================================================
  // ✅ Close / stop via ESC
  // - ESC / click-outside: if recording -> stop (do NOT close)
  // - Otherwise -> close
  // ============================================================
  useEffect(() => {
    const onEscCapture = (ev) => {
      try {
        if (!ev) return;
        const key = ev.key || ev.code;
        if (key !== "Escape") return;

        // If user is typing in an input/textarea, still allow ESC to stop recording/close
        ev.preventDefault?.();
        ev.stopPropagation?.();

        if (__isRecording && typeof onToggleRecord === "function") {
          try { onToggleRecord(); } catch (e) {}
          return;
        }
        if (typeof onClose === "function") onClose();
      } catch (e) {}
    };

    try { window.addEventListener("keydown", onEscCapture, { capture: true }); } catch (e) {}
    return () => {
      try { window.removeEventListener("keydown", onEscCapture, { capture: true }); } catch (e) {}
    };
  }, [__isRecording, onToggleRecord, onClose]);



  const __mask = (s) => {
    const raw = String(s || "");
    const n = Math.max(8, Math.min(raw.length || 0, 80));
    return "█".repeat(n);
  };

  // ============================================================
  // ✅ 2026-01-24: i18n (uiText)
  // - Prefer uiText[lang].speech.speakAnalyzePanel.* if exists
  // - Fallback to internal defaults
  // ============================================================
  const __langKey = useMemo(() => __getLangPack(uiLang), [uiLang]);

  // ------------------------------------------------------------
  // DEPRECATED (kept intentionally to avoid losing historical context)
  // - Prior versions shipped internal fallback strings here.
  // - Current requirement: all fixed UI strings MUST come from uiText.
  // - If a key is missing in uiText, __t() will return the key itself
  //   so the missing string is obvious during UI QA.
  //
  // (Historical reference only; NOT used by runtime)
  //
  // const __DEPRECATED_FALLBACK_TEXT = {
  //   "zh-TW": {
  //     title: "口說分析",
  //     targetLabel: "目標",
  //     resultLabel: "分析結果",
  //     startRecording: "開始錄音",
  //     stopRecording: "停止錄音",
  //     replay: "重播",
  //     analyze: "分析",
  //     recording: "錄音中",
  //     secondsSuffix: "秒",
  //     asrProcessing: "ASR 分析中…",
  //     asrPrefix: "ASR：",
  //     perfect: "全對",
  //     closeAria: "關閉",
  //     waveformAria: "口說波形",
  //   },
  //   "zh-CN": {
  //     title: "口说分析",
  //     targetLabel: "目标",
  //     resultLabel: "分析结果",
  //     startRecording: "开始录音",
  //     stopRecording: "停止录音",
  //     replay: "重播",
  //     analyze: "分析",
  //     recording: "录音中",
  //     secondsSuffix: "秒",
  //     asrProcessing: "ASR 分析中…",
  //     asrPrefix: "ASR：",
  //     perfect: "全对",
  //     closeAria: "关闭",
  //     waveformAria: "口说波形",
  //   },
  // };
  // ------------------------------------------------------------
  const __t = (k) => {
    // ✅ Single source of truth:
    // uiText[lang].speakAnalyzePanel.<key>
    const pack = (uiText && uiText[__langKey]) || (uiText && uiText["zh-TW"]) || {};

    // ✅ Backward-compatible aliases (do NOT remove call-sites in this phase)
    const __aliasMap = {
      startRecord: "startRecording",
      stopRecord: "stopRecording",
      analyzing: "asrProcessing",
    };


    const key = (__aliasMap && __aliasMap[k]) || k;
    const v = __pick(pack, ["speakAnalyzePanel", key]);

    if (typeof v === "string" && v.length) return v;

    // strict-ish i18n: fallback to key itself so missing strings are easy to spot
    return String(key || "");
  };



  // ============================================================
  // ✅ Pronunciation tips (LLM-first, fallback heuristic)
  // - Source: target sentence + ASR transcript + token states
  // - Keep it short (1~3 lines)
  // ============================================================
  const [__llmPronTips, __setLlmPronTips] = useState(null); // null=not fetched, []=fetched but empty
  const [__llmPronTipsLoading, __setLlmPronTipsLoading] = useState(false);

  useEffect(() => {
    // reset when inputs change
    __setLlmPronTips(null);

    const tks = Array.isArray(tokens) ? tokens : [];
    if (!__expected || !__asrText || tks.length === 0) return;

    let aborted = false;
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;

    async function run() {
      try {
        __setLlmPronTipsLoading(true);

        const resp = await apiFetch("/api/analyze/pronunciation-tips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uiLang: uiLang || "",
            targetText: __expected,
            transcript: __asrText,
            tokens: tks,
          }),
          signal: ac ? ac.signal : undefined,
        });

        const data = await resp.json().catch(() => null);
        if (aborted) return;

        if (resp.ok && data && Array.isArray(data.tips)) {
          __setLlmPronTips(data.tips.filter(Boolean).slice(0, 3));
        } else {
          // backend not ready / missing key / auth / error => fall back to heuristic
          __setLlmPronTips([]);
        }
      } catch (e) {
        if (aborted) return;
        __setLlmPronTips([]);
      } finally {
        if (aborted) return;
        __setLlmPronTipsLoading(false);
      }
    }

    run();

    return () => {
      aborted = true;
      try {
        ac && ac.abort();
      } catch (e) {}
    };
  }, [__expected, __asrText, uiLang, tokens]);

  const __pronTips = useMemo(() => {
    // prefer real LLM tips if present
    if (Array.isArray(__llmPronTips) && __llmPronTips.length) return __llmPronTips;

    const tks = Array.isArray(tokens) ? tokens : [];
    if (!tks.length || !__expected) return [];

    let missing = 0;
    let extra = 0;
    let low = 0;

    for (let i = 0; i < tks.length; i += 1) {
      const st = String((tks[i] && tks[i].state) || "").toLowerCase();
      if (st.includes("miss")) missing += 1;
      else if (st.includes("extra") || st.includes("insert")) extra += 1;
      else if (st.includes("hit_low") || (st.includes("hit") && st.includes("low"))) low += 1;
    }

    const out = [];
    if (missing > 0) out.push(__t("pronTipsMissing") || "可能有漏念：請對照紅色標記的字再試一次。");
    if (extra > 0) out.push(__t("pronTipsExtra") || "可能有多念/插入：請放慢速度，避免多加字。");
    if (low > 0) out.push(__t("pronTipsLow") || "部分字不夠清楚：可加強子音收尾與重音。");
    if (!out.length && __asrText) out.push(__t("pronTipsOk") || "整體不錯：再注意節奏與連音即可。");

    return out.slice(0, 3);
  }, [__llmPronTips, tokens, __expected, __asrText]);


  // ============================================================
  // UI helpers (icons + tooltips) — panel-level scope
  // ============================================================
  const __ORANGE = "rgba(255,122,0,1)";
  const __ORANGE_BG = "rgba(255,122,0,0.10)";

  const __IconButton = ({ title, ariaLabel, disabled, onClick, children }) => {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel || title}
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          border: "1px solid var(--border-subtle)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 0,
          padding: "0px",
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          flex: "0 0 auto",
          background: "var(--accent)",
          color: "rgb(255, 255, 255)",
          boxShadow: "rgba(0, 0, 0, 0.1) 0px 6px 16px",
          opacity: disabled ? 0.45 : 1,
        }}
      >
        {children}
      </button>
    );
  };

  const __Icon = ({ pathD }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={pathD} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );



  // ============================================================
  // ✅ 2026-01-24: Colored tokens (prefer caller tokens; else self realign)
  // ============================================================
  const __coloredTokens = useMemo(() => {
    const hasCallerTokens = Array.isArray(tokens) && tokens.length > 0;
    if (hasCallerTokens) return tokens;

    const hasAsrWords = Array.isArray(asrWords) && asrWords.length > 0;
    if (hasAsrWords && __expected) {
      return __realignTokens(__expected, asrWords, confidenceThreshold);
    }

    // fallback: show expected as neutral tokens (no analysis yet)
    const exp = __tokenizeExpected(__expected || "");
    return exp.map((t) => ({ text: t.raw, state: "neutral", confidence: 0 }));
  }, [tokens, asrWords, __expected, confidenceThreshold]);

  const __tokenNodes = useMemo(() => {
    return (__coloredTokens || []).map((t, idx) => {
      const style = __pickTokenStyle(t);
      const text = (t && (t.text || t.w || t.word || t.raw)) || "";
      /*
      DEPRECATED (kept for history): duplicated UI helper block accidentally inserted here.
      It caused __IconButton/__Icon scope + redeclare issues.
      Original block preserved below (commented out):
        // ============================================================
        // UI helpers (icons + tooltips)
        // ============================================================
        const __ORANGE = "rgba(255,122,0,1)";
        const __ORANGE_BG = "rgba(255,122,0,0.10)";
      
        const __IconButton = ({ title, ariaLabel, disabled, onClick, children }) => {
          return (
            <button
              type="button"
              onClick={onClick}
              disabled={disabled}
              title={title}
              aria-label={ariaLabel || title}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: "1px solid rgba(255,122,0,0.45)",
                background: __ORANGE,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.45 : 1,
                boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
                userSelect: "none",
              }}
            >
              {children}
            </button>
          );
        };
      
        const __Icon = ({ pathD }) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d={pathD} stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      */


      return (
        <span
          key={`tok-${idx}-${text}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 8px",
            margin: "0 6px 6px 0",
            borderRadius: 10,
            fontSize: 14,
            lineHeight: 1.2,
            ...style,
          }}
          title={typeof t.confidence === "number" ? String(t.confidence.toFixed(2)) : ""}
        >
          {text}
        </span>
      );
    });
  }, [__coloredTokens]);

  // ============================================================
  // ✅ Confidence hint tooltip (one per token block)
  // - Keep UI lightweight: show ⓘ and explain what confidence means
  // - Hover: show tooltip; Touch: toggle + auto-hide
  // ============================================================
  const [__showConfidenceHint, __setShowConfidenceHint] = useState(false);

  // [20260202 record] mount/unmount
  useEffect(() => {
    console.log("[20260202 record][SpeakAnalyzePanel][mount]", { ts: Date.now() });
    return () => console.log("[20260202 record][SpeakAnalyzePanel][unmount]", { ts: Date.now() });
  }, []);

  console.log("[20260202 record][SpeakAnalyzePanel][flags]", { ts: Date.now(), speakOpen: typeof window!=="undefined"?window.__SPEAK_PANEL_OPEN:undefined, convNav: typeof window!=="undefined"?window.__CONV_NAV_ACTIVE:undefined });
  const __confidenceHintTimerRef = useRef(null);

  const __openConfidenceHint = () => {
    try {
      if (__confidenceHintTimerRef.current) {
        clearTimeout(__confidenceHintTimerRef.current);
        __confidenceHintTimerRef.current = null;
      }
    } catch (e) {}
    __setShowConfidenceHint(true);
  };

  const __closeConfidenceHint = () => {
    try {
      if (__confidenceHintTimerRef.current) {
        clearTimeout(__confidenceHintTimerRef.current);
        __confidenceHintTimerRef.current = null;
      }
    } catch (e) {}
    __setShowConfidenceHint(false);
  };

  const __toggleConfidenceHintTouch = () => {
    const next = !__showConfidenceHint;
    __setShowConfidenceHint(next);
    try {
      if (__confidenceHintTimerRef.current) {
        clearTimeout(__confidenceHintTimerRef.current);
        __confidenceHintTimerRef.current = null;
      }
      if (next) {
        __confidenceHintTimerRef.current = setTimeout(() => {
          __setShowConfidenceHint(false);
          __confidenceHintTimerRef.current = null;
        }, 2600);
      }
    } catch (e) {}
  };


  // ============================================================
  // ✅ 2026-01-24: Celebration (when all non-extra tokens are correct)
  // - Trigger only once per panel open (no re-run)
  // - Small animation + soft beep sound (no external assets)
  // ============================================================
  const __celebratedRef = useRef(false);
  const [__showCelebrate, __setShowCelebrate] = useState(() => false);

  // ============================================================
  // ✅ 2026-01-24: "Done" sound (always play once on analyze done)
  // - If perfect => celebration beep handled separately
  // - If not perfect => play a short "dun-dun" style tone
  // ============================================================
  const __doneSoundPlayedRef = useRef(false);

  // ============================================================
  // ✅ 2026-01-24: Allow re-analyze
  // - When user triggers another analyze, parent should flip analyzeState
  // - Reset "done sound" + "celebration" guards so UX can repeat
  // ============================================================
  useEffect(() => {
    if (analyzeState !== "done") {
      __doneSoundPlayedRef.current = false;
      __celebratedRef.current = false;
      __setShowCelebrate(false);
    }
  }, [analyzeState]);


  const __isAllCorrect = useMemo(() => {
    if (!Array.isArray(__coloredTokens) || __coloredTokens.length === 0) return false;
    const nonExtra = __coloredTokens.filter((t) => !(t && t.__extra));
    if (nonExtra.length === 0) return false;
    return nonExtra.every((t) => {
      const st = String((t && t.state) || "").toLowerCase();
      const isHit = st.includes("hit") || st.includes("match") || st.includes("ok");
      const isMissing = st.includes("miss") || st.includes("missing") || st.includes("absent");
      return isHit && !isMissing;
    });
  }, [__coloredTokens]);

  const __playTone = (sequence) => {
    try {
      const AC = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) return;
      const ctx = new AC();
      const now = ctx.currentTime;

      (sequence || []).forEach((seg) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = seg.freq || 440;
        gain.gain.setValueAtTime(0.0001, now + (seg.t || 0));
        gain.gain.exponentialRampToValueAtTime(seg.vol || 0.08, now + (seg.t || 0) + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (seg.t || 0) + (seg.d || 0.16));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + (seg.t || 0));
        osc.stop(now + (seg.t || 0) + (seg.d || 0.16));
      });

      const last = (sequence || []).reduce((m, s) => Math.max(m, (s.t || 0) + (s.d || 0)), 0);
      setTimeout(() => {
        try { ctx.close(); } catch (e) {}
      }, Math.max(200, Math.floor((last + 0.12) * 1000)));
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (analyzeState !== "done") return;

    // play done sound once per analyze completion
    if (!__doneSoundPlayedRef.current) {
      __doneSoundPlayedRef.current = true;
      if (!__isAllCorrect) {
        // "登登" (two short tones)
        __playTone([
          { t: 0.0, d: 0.16, freq: 392, vol: 0.08 },
          { t: 0.20, d: 0.18, freq: 330, vol: 0.08 },
        ]);
      }
    }

    // celebration only for perfect
    if (__isAllCorrect && !__celebratedRef.current) {
      __celebratedRef.current = true;
      __setShowCelebrate(true);
      // gentle "success" tone
      __playTone([
        { t: 0.0, d: 0.14, freq: 523.25, vol: 0.06 },
        { t: 0.16, d: 0.14, freq: 659.25, vol: 0.06 },
        { t: 0.32, d: 0.16, freq: 783.99, vol: 0.06 },
      ]);
      const timer = setTimeout(() => __setShowCelebrate(false), 900);
      return () => clearTimeout(timer);
    }
  }, [analyzeState, __isAllCorrect]);

  // ============================================================
  // ✅ 2026-01-24: Waveform (while recording)
  // - Visual feedback only (no backend)
  // - Uses its own mic stream to avoid depending on upstream recorder internals
  // - Starts when recordState === "recording", stops on stop/close/unmount
  // ============================================================
  const __waveCanvasRef = useRef(null);
  const __waveRafRef = useRef(0);
  const __waveAudioCtxRef = useRef(null);
  const __waveAnalyserRef = useRef(null);
  const __waveSourceRef = useRef(null);
  const __waveStreamRef = useRef(null);

  const __stopWaveformIfNeeded = () => {
    try {
      const rafId = __waveRafRef.current;
      if (rafId && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(rafId);
      }
    } catch (e) {
      // ignore
    } finally {
      __waveRafRef.current = 0;
    }

    try {
      const src = __waveSourceRef.current;
      if (src && typeof src.disconnect === "function") src.disconnect();
    } catch (e2) {
      // ignore
    } finally {
      __waveSourceRef.current = null;
    }

    try {
      const an = __waveAnalyserRef.current;
      if (an && typeof an.disconnect === "function") an.disconnect();
    } catch (e3) {
      // ignore
    } finally {
      __waveAnalyserRef.current = null;
    }

    try {
      const ctx = __waveAudioCtxRef.current;
      if (ctx && typeof ctx.close === "function") {
        try { ctx.close(); } catch (e4) {}
      }
    } catch (e5) {
      // ignore
    } finally {
      __waveAudioCtxRef.current = null;
    }

    try {
      const st = __waveStreamRef.current;
      if (st && typeof st.getTracks === "function") {
        st.getTracks().forEach((tr) => {
          try { tr.stop(); } catch (e6) {}
        });
      }
    } catch (e7) {
      // ignore
    } finally {
      __waveStreamRef.current = null;
    }
  };

  const __drawWave = () => {
    const canvas = __waveCanvasRef.current;
    const analyser = __waveAnalyserRef.current;
    if (!canvas || !analyser) return;

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const bufLen = analyser.fftSize;
    const data = new Uint8Array(bufLen);

    const draw = () => {
      __waveRafRef.current = window.requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);

      const w = canvas.width;
      const h = canvas.height;

      ctx2d.clearRect(0, 0, w, h);

      // background
      ctx2d.fillStyle = "rgba(127,127,127,0.06)";
      ctx2d.fillRect(0, 0, w, h);

      // waveform
      ctx2d.lineWidth = 2;
      ctx2d.strokeStyle = "rgba(34,197,94,0.85)";
      ctx2d.beginPath();

      const sliceW = w / bufLen;
      let x = 0;

      for (let i = 0; i < bufLen; i += 1) {
        const v = data[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
        x += sliceW;
      }

      ctx2d.lineTo(w, h / 2);
      ctx2d.stroke();
    };

    draw();
  };

  useEffect(() => {
    if (!__isRecording) {
      __stopWaveformIfNeeded();
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          try { stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
          return;
        }

        __waveStreamRef.current = stream;

        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;

        const audioCtx = new AC();
        __waveAudioCtxRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        __waveAnalyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        __waveSourceRef.current = source;
        source.connect(analyser);

        __drawWave();
      } catch (e) {
        // ignore (mic permission etc.)
      }
    };

    start();

    return () => {
      cancelled = true;
      __stopWaveformIfNeeded();
    };
  }, [__isRecording]);

  // ============================================================
  // Overlay container
  // ============================================================
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
      onClick={(e) => {
        if (e && e.target === e.currentTarget) {
          // click-outside: stop recording first; do NOT close in the same action
          if (__isRecording && typeof onToggleRecord === "function") {
            try { onToggleRecord(); } catch (e2) {}
            return;
          }
          if (typeof onClose === "function") onClose();
        }
      }}
    >
      <div
        style={{
          width: "min(920px, 96vw)",
          maxHeight: "88vh",
          overflow: "auto",
          background: "linear-gradient(180deg, rgba(255, 244, 234, 0.14) 0%, rgba(255,122,0,0.06) 55%, rgba(255,122,0,0.03) 100%), var(--panel-bg, var(--bg, #fff))",
          color: "var(--text)",
          borderRadius: 14,
          border: "1px solid rgba(127,127,127,0.22)",
          boxShadow: "0 14px 40px rgba(0,0,0,0.22)",
          padding: 14,
        }}
        onClick={(e) => {
          try { e.stopPropagation(); } catch (e2) {}
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.92, whiteSpace: "nowrap" }}>{__t("title")}</div>

            {/* ✅ Conversation paging (matches dialog arrows behavior) */}
            {!!conversationActive && (Number(conversationTotal) || 0) > 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,122,0,0.22)",
                  background: "rgba(255,122,0,0.06)",
                }}
              >
                <button
                  type="button"
                  disabled={__navDisabled}
                  onClick={() => {
                    // Always block history regardless of boundary; if cannot prev, do nothing.
                    if (conversationCanPrev && typeof onConversationPrev === "function") {
                      try { onConversationPrev(); } catch (e) {}
                    }
                  }}
                  title={__t("prev") || "上一句"}
                  aria-label={__t("prev") || "上一句"}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: __navDisabled ? "not-allowed" : "pointer",
                    opacity: __navDisabled ? 0.38 : 0.92,
                    padding: "2px 4px",
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ‹
                </button>

                <div style={{ fontSize: 12, opacity: 0.86, whiteSpace: "nowrap" }}>
                  {String((Number(conversationIndex) || 0) + 1)}/{String(Number(conversationTotal) || 0)}
                </div>

                <button
                  type="button"
                  disabled={__navDisabled}
                  onClick={() => {
                    // Always block history regardless of boundary; if cannot next, do nothing.
                    if (conversationCanNext && typeof onConversationNext === "function") {
                      try { onConversationNext(); } catch (e) {}
                    }
                  }}
                  title={__t("next") || "下一句"}
                  aria-label={__t("next") || "下一句"}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: __navDisabled ? "not-allowed" : "pointer",
                    opacity: __navDisabled ? 0.38 : 0.92,
                    padding: "2px 4px",
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              try {
                if (__isRecording && typeof onToggleRecord === "function") onToggleRecord();
              } catch (e) {}
              if (typeof onClose === "function") onClose();
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "4px 6px",
              opacity: 0.78,
            }}
            aria-label={__t("closeAria")}
          >
            ×
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(127,127,127,0.18)",
            background: "rgb(255,255,255)",
          }}
        >
          {/* ===== Target / Translation (controlled by parent) ===== */}
          {/* header row: label left, controls right (eye only) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            {/* ✅ UI tweak: enlarge label (目標) */}
            <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.78 }}>{__t("targetLabel")}</div>

            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              {typeof onToggleShowTarget === "function" ? (
                <button
                  type="button"
                  onClick={() => {
                    try { onToggleShowTarget(); } catch (e) {}
                  }}
                  title={showTarget ? (__t("hideTarget") || "隱藏") : (__t("showTarget") || "顯示")}
                  aria-label="toggle-show-target"
                  className="icon-button sound-button"
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    opacity: disabled ? 0.55 : 1,
                  }}
                  disabled={disabled}
                >
                  {showTarget ? <EyeIconOpen size={20} /> : <EyeIconClosed size={20} />}
                </button>
              ) : null}
            </div>
          </div>

          
          {/* target row (play icon on the left of sentence) */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            {typeof onPlayTarget === "function" ? (
              <SpeakButton
                onClick={() => {
                  try { onPlayTarget(); } catch (e) {}
                }}
                title={__t("playTarget") || "播放語音"}
                ariaLabel="play-target"
                style={{ width: 16, height: 16, borderRadius: 9, marginTop: 2 }}
              />
            ) : null}

            {/* target text */}
            <div style={{ fontSize: 18, lineHeight: 1.35, wordBreak: "break-word", flex: 1 }}>
              {showTarget === false ? <span style={{ whiteSpace: "nowrap" }}>{MOSAIC_LINE}</span> : __expected}
            </div>
          </div>




          {/* translation */}
          {__translation ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 12,
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.78 }}>
                  {__t("translationLabel")}
                </div>
                
                {typeof onToggleShowTranslation === "function" ? (
                  <button
                    type="button"
                    onClick={() => {
                      try { onToggleShowTranslation(); } catch (e) {}
                    }}
                    title={showTranslation ? (__t("hideTranslation") || "隱藏") : (__t("showTranslation") || "顯示")}
                    aria-label="toggle-show-translation"
                    className="icon-button sound-button"
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 34,
                      height: 34,
                      flexShrink: 0,
                      opacity: disabled ? 0.55 : 1,
                    }}
                    disabled={disabled}
                  >
                    {showTranslation ? <EyeIconOpen size={20} /> : <EyeIconClosed size={20} />}
                  </button>
                ) : null}
                
              </div>
                
              <div style={{ fontSize: 16, lineHeight: 1.35, wordBreak: "break-word", opacity: 0.92 ,gap:10}}>
                  {/* target row (play icon on the left of sentence) */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            {typeof onPlayTarget === "function" ? (
                  <div
                    
                    aria-label="play-target"
                    style={{ width: 16, height: 16, borderRadius: 9, marginTop: 2 }}
                  />
                ) : null}

            {/* target text */}
            <div style={{ fontSize: 16, lineHeight: 1.35, wordBreak: "break-word", flex: 1 }}>
            {showTranslation === false ? <span style={{ whiteSpace: "nowrap" }}>{MOSAIC_LINE}</span> : __translation}
            </div>
          </div>
          

          
                  
                
              </div>
            </>
          ) : null}
          </div>
          
        
          
        
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <__IconButton
            onClick={onToggleRecord}
            disabled={!__canToggle}
            title={__isRecording ? __t("stopRecording") : __t("startRecording")}
            ariaLabel={__isRecording ? __t("stopRecording") : __t("startRecording")}
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
          </__IconButton>

          <__IconButton
            onClick={onReplay}
            disabled={!__canReplay}
            title={__t("replay")}
            ariaLabel={__t("replay")}
          >
            <__Icon pathD="M8 5v14l11-7-11-7Z" />
          </__IconButton>

          <__IconButton
            onClick={onAnalyzeOnce}
            disabled={!__canAnalyze}
            title={__t("analyze")}
            ariaLabel={__t("analyze")}
          >
            <__Icon pathD="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.8 2.8M14.7 14.7l2.8 2.8M6.5 17.5l2.8-2.8M14.7 9.3l2.8-2.8" />
          </__IconButton>



          {__isRecording ? (
            <span style={{ fontSize: 12, opacity: 0.72 }}>{__t("recording")} {seconds || 0}{__t("secondsSuffix")}</span>
          ) : null}

          {__isRecording ? (
            <canvas
              ref={__waveCanvasRef}
              width={240}
              height={32}
              aria-label={__t("waveformAria")}
              data-ref="speakAnalyzeWaveform"
              style={{
                display: "inline-block",
                width: 240,
                height: 32,
                borderRadius: 10,
                border: "1px solid rgba(127,127,127,0.22)",
                background: "rgba(127,127,127,0.08)",
                verticalAlign: "middle",
                color: "var(--text)",
                opacity: 0.92,
              }}
            />
          ) : null}

          {analyzeState === "processing" ? (
            <span style={{ fontSize: 12, opacity: 0.72 }}>{__t("analyzing")}</span>
          ) : null}
        </div>

        {message ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{message}</div> : null}

        {analyzeState === "done" ? (
          <div style={{ marginTop: 12 }}>
            {/* ✅ Success celebration (all green) */}
            {__showCelebrate ? (
              <>
                <style>{`
                  @keyframes speakCelebrateIn {
                    0% { transform: translateY(6px); opacity: 0; }
                    35% { transform: translateY(0px); opacity: 1; }
                    80% { transform: translateY(-2px); opacity: 1; }
                    100% { transform: translateY(-6px); opacity: 0; }
                  }
                `}</style>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(34,197,94,0.32)",
                    background: "rgba(34,197,94,0.18)",
                    color: "rgba(20,83,45,1)",
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 10,
                    animation: "speakCelebrateIn 900ms ease-out 1",
                  }}
                >
                  <span aria-hidden="true">✅</span>
                  <span>{__t("perfect")}</span>
                </div>
              </>
            ) : null}


            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: "1 1 auto", minWidth: 0 }}>{__tokenNodes}</div>
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center", flex: "0 0 auto", marginTop: 2 }}>
                <button
                  type="button"
                  aria-label={__t("confidenceHintAria")}
                  onMouseEnter={__openConfidenceHint}
                  onMouseLeave={__closeConfidenceHint}
                  onFocus={__openConfidenceHint}
                  onBlur={__closeConfidenceHint}
                  onTouchStart={(e) => {
                    try { e.preventDefault(); } catch (err) {}
                    __toggleConfidenceHintTouch();
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "rgba(15,23,42,0.04)",
                    color: "rgba(71,85,105,0.95)",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    padding: 0,
                    lineHeight: 1,
                  }}
                  title={__t("confidenceHint")}
                >
                  ⓘ
                </button>

                {__showConfidenceHint ? (
                  <div
                    role="tooltip"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 28,
                      zIndex: 10,
                      minWidth: 240,
                      maxWidth: 320,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,0.28)",
                      background: "rgba(255,255,255,0.98)",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                      fontSize: 12,
                      lineHeight: 1.35,
                      color: "rgba(15,23,42,0.92)",
                      whiteSpace: "normal",
                    }}
                  >
                    {__t("confidenceHint")}
                  </div>
                ) : null}
              </div>
            </div>

            {/* ✅ ASR 判定結果（顯示於分析結果下方，跟隨對話切換） */}
            {__asrText ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  opacity: 0.7,
                  lineHeight: 1.35,
                  wordBreak: "break-word",
                }}
              >
                <span style={{ fontWeight: 600, opacity: 0.85 }}>{__t("asrPrefix") || "ASR："}</span>
                <span>{__asrText}</span>
              </div>
            ) : null}

          </div>
        ) : null}
      </div>
    </div>
  );
}

// frontend/src/components/speech/SpeakAnalyzePanel.jsx (file end)

// PATCH: guard pronunciation tips by uiLang consistency