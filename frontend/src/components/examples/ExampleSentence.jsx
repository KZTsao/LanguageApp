// frontend/src/components/examples/ExampleSentence.jsx (file start)
import React, { useEffect, useMemo, useRef, useState } from "react";
import usePronunciationRecorder from "./usePronunciationRecorder";
import { supabase } from "../../utils/supabaseClient";

// ✅ Phase B-1: Coverage-once (record once -> ASR -> colorize tokens -> LLM feedback)
import CoverageOnceSentence from "./coverage/CoverageOnceSentence";
import { buildCoverageColoredTokens } from "./coverage/coverageOnce";
import SpeakAnalyzePanel from "../speech/SpeakAnalyzePanel";
import SpeakButton from "../common/SpeakButton";
import { EyeIconOpen, EyeIconClosed } from "../common/EyeIcons";

// ----------------------------------------------------------------------------
// NOTE
// - This file is intentionally kept verbose and additive.
// - DO NOT remove legacy blocks unless explicitly asked.
// ----------------------------------------------------------------------------

const MOSAIC_LINE = "----------------------------";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
// ✅ 2026-01-26: Attach Authorization header for /api/speech/asr (fix 401)
// - Token source of truth: supabase.auth.getSession()
// - If no session, returns empty headers (backend may 401; expected)
const __getAuthHeadersForApi = async () => {
  // NOTE:
  // - supabase.auth.getSession() should be fast (local storage), but in some environments
  //   it can hang due to browser/extension issues. We must never block the click handler.
  // - If session cannot be obtained quickly, we return {} and let backend decide (may 401).
  const __dbg =
    (import.meta &&
      import.meta.env &&
      (import.meta.env.VITE_DEBUG_SPEECH_AUTH || import.meta.env.VITE_DEBUG_AUTH)) ||
    "";

  const __timeoutMs = 400;

  const __withTimeout = (p, ms) =>
    Promise.race([
      p,
      new Promise((resolve) => {
        try {
          if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
            window.setTimeout(() => resolve({ __timeout: true }), ms);
          } else {
            setTimeout(() => resolve({ __timeout: true }), ms);
          }
        } catch (e) {
          setTimeout(() => resolve({ __timeout: true }), ms);
        }
      }),
    ]);

  try {
    if (!supabase || !supabase.auth || typeof supabase.auth.getSession !== "function") {
      if (__dbg === "1") console.warn("[authHeaders] supabase client not ready");
      return {};
    }

    const res = await __withTimeout(supabase.auth.getSession(), __timeoutMs);

    // timeout guard
    if (res && res.__timeout) {
      if (__dbg === "1") console.warn("[authHeaders] getSession timeout -> no auth header");
      return {};
    }

    const session = res && res.data ? res.data.session : null;

    const token = session && session.access_token ? session.access_token : "";
    if (!token) {
      if (__dbg === "1") console.warn("[authHeaders] no access_token in session");
      return {};
    }
    return { Authorization: `Bearer ${token}` };
  } catch (e) {
    if (__dbg === "1") console.warn("[authHeaders] getSession failed", e);
    return {};
  }
};

const __LEGACY_EyeIconOpen = () => (
  <svg
    className="eye-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M12 5C7 5 3.2 8 1.5 12 3.2 16 7 19 12 19s8.8-3 10.5-7C20.8 8 17 5 12 5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

const __LEGACY_EyeIconClosed = () => (
  <svg
    className="eye-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    {/* upper eyelid */}
    <path
      d="M4 12c2.5 2.5 5.5 3.8 8 3.8s5.5-1.3 8-3.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* lower eyelid (subtle, optional but looks more real) */}
    <path
      d="M6.5 13.2c1.7 1.2 3.6 1.8 5.5 1.8s3.8-.6 5.5-1.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      opacity="0.7"
    />
  </svg>
);


const eyeButtonStyle = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  flexShrink: 0,
};

// ✅ Phase 2-UX：Multi-ref toggle（亮/暗模式可見）
const getMultiRefToggleStyle = (enabled) => {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "2px 12px",
    borderRadius: 999,
    cursor: "pointer",
    userSelect: "none",
    border: enabled
      ? "1px solid rgba(60, 180, 120, 0.92)"
      : "1px solid rgba(0, 0, 0, 0.28)",
    background: enabled ? "rgba(80, 200, 120, 0.18)" : "rgba(0, 0, 0, 0.04)",
    color: "inherit",
    fontSize: 13,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
};

const getMultiRefToggleDotStyle = (enabled) => {
  return {
    width: 10,
    height: 10,
    borderRadius: 999,
    display: "inline-block",
    border: enabled
      ? "1px solid rgba(60, 180, 120, 0.95)"
      : "1px solid rgba(0, 0, 0, 0.25)",
    background: enabled
      ? "rgba(60, 180, 120, 0.95)"
      : "rgba(0, 0, 0, 0.12)",
  };
};

// ✅ headword badge（銳角外方匡）
const getHeadwordBadgeStyle = (hasHeadword) => {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 0,
    border: hasHeadword
      ? "1px solid currentColor"
      : "1px solid rgba(128, 128, 128, 0.35)",
    background: hasHeadword
      ? "rgba(127, 127, 127, 0.12)"
      : "rgba(127, 127, 127, 0.06)",
    color: "inherit",
    fontSize: 13,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    fontWeight: 500,
    opacity: hasHeadword ? 0.98 : 0.82,
  };
};

// ✅ 2026-01-13: headword badge clickable style (UI-only)
// - Do NOT change refs / API here
// - If onHeadwordClick exists, we allow clicking headword to trigger regenerate (upstream)
const getHeadwordClickableStyle = (enabled, loading) => {
  return {
    cursor: enabled && !loading ? "pointer" : "default",
    userSelect: enabled ? "none" : "text",
    transition: "opacity 120ms ease",
    opacity: loading ? 0.72 : 1,
  };
};

export default function ExampleSentence({
  hasExamples,
  mainSentence,
  exampleTranslation,
  sectionExample,
  loading,
  onRefresh,
  refreshTooltip,
  onWordClick,
  onSpeak,
  onToggleConversation,
  conversationToggleTooltip,
  headword,
  headwordOverride,

  // ✅ 2026-01-27：參考形式提示（小 i / hover）
  headwordRefHint,

  multiRefEnabled,
  onToggleMultiRef,
  multiRefToggleLabel,
  multiRefToggleHint,
  refControls,
  refBadgesInline,
  refActionInline,
  // ✅ 2026-01-10：先拆 div（可選）
  // - refConfirm：單獨放 Confirm 按鈕（或 Confirm 區塊）
  // - 注意：若上層尚未提供 refConfirm，畫面不會改；refControls 原邏輯完全保留
  refConfirm,

  // ✅ 2026-01-13: click headword to regenerate (upstream controls the actual behavior)
  // - This is UI-only: ExampleSentence never calls API directly
  // - Upstream should pass a function that triggers the SAME refresh pipeline
  // - When loading=true, click is ignored
  onHeadwordClick,
  headwordClickTooltip,

  // ✅ 2026-01-22: Pronunciation / shadowing (Phase 1 UI-only)
  // - ExampleSentence records user's voice for the CURRENT example sentence
  // - It never calls API directly; upstream decides what to do with the audio blob
  onPronunciationAudioReady,
  pronunciationTooltip,
  pronunciationDisabled,
  pronunciationButtonLabel,
}) {
  // =========================
  // 初始化狀態（Production 排查）
  // =========================
  const __initState = useMemo(
    () => ({
      component: "ExampleSentence",
      phase: "2-UX",
      timestamp: new Date().toISOString(),
    }),
    []
  );

  const effectiveHeadword = useMemo(() => {
    const hw = (headwordOverride || headword || "").toString().trim();
    return hw;
  }, [headwordOverride, headword]);

  const safeHeadword = useMemo(() => {
    return effectiveHeadword ? effectiveHeadword : "not available";
  }, [effectiveHeadword]);

  const hasHeadword = safeHeadword !== "not available";

  // ✅ 2026-01-27：參考形式提示（小 i / hover）
  // - 若上游未提供（或字串為空），則不顯示 icon。
  const __headwordRefHint = (headwordRefHint || "").toString();

  // ✅ headword click gate
  const canClickHeadword = useMemo(() => {
    return typeof onHeadwordClick === "function";
  }, [onHeadwordClick]);

  // ✅ 可控 presence log（Production 排查）
  // - 使用方式：VITE_DEBUG_EXAMPLES_PRESENCE=1
  try {
    const __dbgPresence =
      (import.meta &&
        import.meta.env &&
        import.meta.env.VITE_DEBUG_EXAMPLES_PRESENCE) ||
      "";
    if (__dbgPresence === "1") {
      console.log("[ExampleSentence][presence] =", {
        headword: safeHeadword,
        hasHeadword,
        hasExamples: !!hasExamples,
        hasRefControls: !!refControls,
        hasRefConfirm: !!refConfirm,
        multiRefEnabled,
        canClickHeadword,
        __initState,
      });
    }
  } catch (e) {
    // debug only
  }

  const [showGerman, setShowGerman] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("exampleShowGerman");
    return stored === "false" ? false : true;
  });

  const [showTranslation, setShowTranslation] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("exampleShowTranslation");

    return stored === "false" ? false : true;
  });
// =========================
// ✅ Controlled target/translation state (single source of truth)
// - SpeakAnalyzePanel must be controlled by ExampleSentence.
// =========================
const showTarget = showGerman;
const toggleShowTarget = () => setShowGerman((v) => !v);
const toggleShowTranslation = () => setShowTranslation((v) => !v);

const onPlayTarget =
  onSpeak && typeof onSpeak === "function"
    ? () => {
        try {
          onSpeak(mainSentence || "");
        } catch (e) {}
      }
    : undefined;



  // ✅ 2026-01-22: Pronunciation / shadowing recorder (Phase 1 UI-only)
  // - We keep this local to each ExampleSentence instance
  // - Upstream can store the blob and later call /api/pronunciation/score in Phase 2+
  const __hasMediaRecorderSupport = useMemo(() => {
  try {
    if (typeof window === "undefined") return false;
    return (
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof window.MediaRecorder !== "undefined"
    );
  } catch (e) {
    return false;
  }
}, []);


  const __pronMediaRecorderRef = useRef(null);
  const __pronMediaStreamRef = useRef(null);
  const __pronChunksRef = useRef([]);
  const __pronStartTsRef = useRef(0);

  const [pronStatus, setPronStatus] = useState(() => {
    return {
      state: "idle", // idle | recording | done | error
      seconds: 0,
      error: "",
      lastDurationMs: 0,
      lastMimeType: "",
    };
  });

  // ✅ 2026-01-22: Pronunciation replay (Phase 1.5 UI-only)
  // - Only keep the last recording as an object URL
  // - Revoke URL on unmount or when overwriting with a new recording
  const __pronReplayUrlRef = useRef("");
  const __pronReplayAudioRef = useRef(null);
  const [pronReplayUrl, setPronReplayUrl] = useState(() => "");
  const [pronReplayMeta, setPronReplayMeta] = useState(() => ({
    durationMs: 0,
    mimeType: "",
    error: "",
  }));

  // ✅ 2026-01-24: Speak Analyze Panel (open from sentence mic button)
  // - The mic button no longer starts recording directly; it opens this panel.
  // - Recording / replay / analyze are performed inside the panel.
  // - Analyze is single-run: once done, the analyze button disappears.
  const [__speakPanelOpen, __setSpeakPanelOpen] = useState(() => false);
  const [__speakPanelHasAudio, __setSpeakPanelHasAudio] = useState(() => false);
  const [__speakPanelAnalyzeState, __setSpeakPanelAnalyzeState] = useState(() => "idle"); // idle | processing | done | error
  const [__speakPanelTokens, __setSpeakPanelTokens] = useState(() => null);
  const [__speakPanelTranscript, __setSpeakPanelTranscript] = useState(() => "");
  const [__speakPanelMessage, __setSpeakPanelMessage] = useState(() => "");
  const __speakPanelAudioBlobRef = useRef(null);

  // ✅ Phase B-1: Coverage-once state
  // - record once -> ASR once -> compare to reference -> colorize per confidence
  // - no pass/fail; only colored sentence + optional LLM feedback/score
  const [coverageOnceEnabled, setCoverageOnceEnabled] = useState(() => false);
  const [coverageOnceState, setCoverageOnceState] = useState(() => "idle"); // idle | recording | processing | done | error
  const [coverageOnceTokens, setCoverageOnceTokens] = useState(() => null); // [{ idx, raw, norm, state, confidence? }]
  const [coverageOnceTranscript, setCoverageOnceTranscript] = useState(() => "");
  const [coverageOnceLLM, setCoverageOnceLLM] = useState(() => ({
    score: null,
    feedback: "",
    error: "",
  }));

  const __coverageStopAnyRef = useRef(null);

  // ✅ 2026-01-22: Pronunciation waveform (Phase 1.6 UI-only)
  // - Visualize mic input while recording (no backend, no file saving)
  // - Uses Web Audio API AnalyserNode + canvas
  // - Must stop/cleanup on stop/unmount to avoid console errors & leaks
  const __pronVizCanvasRef = useRef(null);
  const __pronVizRafRef = useRef(0);
  const __pronVizAudioCtxRef = useRef(null);
  const __pronVizAnalyserRef = useRef(null);
  const __pronVizSourceRef = useRef(null);
  const __pronVizLastColorRef = useRef("");

// ✅ Phase 2.2: usePronunciationRecorder hook (readability / future split)
// - IMPORTANT: This is additive. We keep all legacy recorder/replay/waveform logic below.
// - UI + handlers will prefer hook outputs when enabled to reduce future changes.
// - No API calls, no backend changes.
const __USE_PRONUNCIATION_RECORDER_HOOK = true;

const __pronHook = usePronunciationRecorder({
  enabled: __USE_PRONUNCIATION_RECORDER_HOOK,
  mainSentence,
  disabled: !!pronunciationDisabled,
  loading: !!loading,
  onAudioReady: (sentence, blob, meta) => {
    try { __speakPanelAudioBlobRef.current = blob || null; } catch (e) {}
    try { __setSpeakPanelHasAudio(!!blob); } catch (e) {}
    if (typeof onPronunciationAudioReady === "function") {
      try { onPronunciationAudioReady(sentence, blob, meta); } catch (e2) {}
    }
  },
  // reuse existing canvas ref so JSX doesn't need structural changes
  canvasRef: __pronVizCanvasRef,
  canvasWidth: 150,
  canvasHeight: 22,
});

// ✅ Phase 2.2: effective values for UI (prefer hook when enabled)
const __effectiveHasMediaRecorderSupport = __USE_PRONUNCIATION_RECORDER_HOOK
  ? !!(__pronHook && __pronHook.hasSupport)
  : __hasMediaRecorderSupport;

const __effectivePronStatus = __USE_PRONUNCIATION_RECORDER_HOOK
  ? ((__pronHook && __pronHook.status) || pronStatus)
  : pronStatus;

const __effectivePronReplayUrl = __USE_PRONUNCIATION_RECORDER_HOOK
  ? ((__pronHook && __pronHook.replayUrl) || pronReplayUrl)
  : pronReplayUrl;

const __effectivePronReplayMeta = __USE_PRONUNCIATION_RECORDER_HOOK
  ? ((__pronHook && __pronHook.replayMeta) || pronReplayMeta)
  : pronReplayMeta;


  const __stopPronunciationVizIfNeeded = () => {
    try {
      const rafId = __pronVizRafRef.current;
      if (
        rafId &&
        typeof window !== "undefined" &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(rafId);
      }
    } catch (e) {
      // ignore
    } finally {
      __pronVizRafRef.current = 0;
    }

    try {
      const src = __pronVizSourceRef.current;
      if (src && typeof src.disconnect === "function") {
        src.disconnect();
      }
    } catch (e4) {
      // ignore
    } finally {
      __pronVizSourceRef.current = null;
    }

    try {
      const an = __pronVizAnalyserRef.current;
      if (an && typeof an.disconnect === "function") {
        an.disconnect();
      }
    } catch (e5) {
      // ignore
    } finally {
      __pronVizAnalyserRef.current = null;
    }

    try {
      const ctx = __pronVizAudioCtxRef.current;
      if (ctx && typeof ctx.close === "function") {
        try {
          ctx.close();
        } catch (e2) {
          // ignore
        }
      }
    } catch (e3) {
      // ignore
    } finally {
      __pronVizAudioCtxRef.current = null;
    }

    // clear canvas
    try {
      const c = __pronVizCanvasRef.current;
      if (c && c.getContext) {
        const g = c.getContext("2d");
        if (g) {
          g.clearRect(0, 0, c.width, c.height);
        }
      }
    } catch (e6) {
      // ignore
    }
  };

  const __startPronunciationViz = (stream) => {
    try {
      if (typeof window === "undefined") return;
      if (!stream) return;

      // stop any existing viz first
      __stopPronunciationVizIfNeeded();

      const c = __pronVizCanvasRef.current;
      if (!c || !c.getContext) return;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      __pronVizAudioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      __pronVizAnalyserRef.current = analyser;

      const src = ctx.createMediaStreamSource(stream);
      __pronVizSourceRef.current = src;

      src.connect(analyser);

      const bufLen = analyser.fftSize;
      const data = new Uint8Array(bufLen);

      const g = c.getContext("2d");
      if (!g) return;

      const __resolveStrokeColor = () => {
        try {
          if (!c) return "";
          const color =
            (window.getComputedStyle && window.getComputedStyle(c).color) || "";
        
// === Controlled aliases for SpeakAnalyzePanel (single source of truth) ===
// const showTarget = showGerman;
// const toggleShowTarget = () => setShowGerman(v => !v);
// const toggleShowTranslation = () => setShowTranslation(v => !v);

  return (color || "").toString().trim();
        } catch (e) {
          return "";
        }
      };

      const draw = () => {
        try {
          if (!__pronVizAnalyserRef.current || !__pronVizCanvasRef.current) return;

          const canvas = __pronVizCanvasRef.current;
          const ctx2d = canvas.getContext("2d");
          if (!ctx2d) return;

          const w = canvas.width || 140;
          const h = canvas.height || 22;

          __pronVizAnalyserRef.current.getByteTimeDomainData(data);

          // background clear
          ctx2d.clearRect(0, 0, w, h);

          // stroke color: follow CSS color (theme-aware)
          let stroke = __pronVizLastColorRef.current || "";
          if (!stroke) stroke = __resolveStrokeColor();
          if (stroke) __pronVizLastColorRef.current = stroke;

          ctx2d.lineWidth = 1.6;
          ctx2d.strokeStyle = stroke || "rgba(120,120,120,0.85)";
          ctx2d.beginPath();

          const slice = w / data.length;
          let x = 0;
          for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0; // 0..2
            const y = (v * h) / 2;

            if (i === 0) ctx2d.moveTo(x, y);
            else ctx2d.lineTo(x, y);

            x += slice;
          }
          ctx2d.lineTo(w, h / 2);
          ctx2d.stroke();
        } catch (e) {
          // ignore draw errors
        } finally {
          try {
            __pronVizRafRef.current = window.requestAnimationFrame(draw);
          } catch (e2) {
            __pronVizRafRef.current = 0;
          }
        }
      };

      // resume in case browser starts suspended
      try {
        if (ctx && typeof ctx.resume === "function") {
          ctx.resume().catch(() => {});
        }
      } catch (e) {
        // ignore
      }

      __pronVizRafRef.current = window.requestAnimationFrame(draw);
    } catch (e) {
      // ignore
    }
  };


  // cleanup: revoke object URL and stop audio
  useEffect(() => {
  
// === Controlled aliases for SpeakAnalyzePanel (single source of truth) ===
// const showTarget = showGerman;
// const toggleShowTarget = () => setShowGerman(v => !v);
// const toggleShowTranslation = () => setShowTranslation(v => !v);

  return () => {
      try {
        const au = __pronReplayAudioRef.current;
        if (au && typeof au.pause === "function") {
          au.pause();
        }
      } catch (e) {
        // ignore
      }
      try {
        const u = __pronReplayUrlRef.current;
        if (u && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(u);
        }
      } catch (e2) {
        // ignore
      } finally {
        __pronReplayUrlRef.current = "";
      }
      // Phase 1.6: stop waveform viz on unmount
      try {
        __stopPronunciationVizIfNeeded();
      } catch (e3) {
        // ignore
      }
    };
  }, []);


  // ✅ simple timer for recording duration (UI-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pronStatus || pronStatus.state !== "recording") return;
    const t = window.setInterval(() => {
      setPronStatus((prev) => {
        if (!prev || prev.state !== "recording") return prev;
        return { ...prev, seconds: (prev.seconds || 0) + 1 };
      });
    }, 1000);
  
// === Controlled aliases for SpeakAnalyzePanel (single source of truth) ===
// const showTarget = showGerman;
// const toggleShowTarget = () => setShowGerman(v => !v);
// const toggleShowTranslation = () => setShowTranslation(v => !v);

  return () => window.clearInterval(t);
  }, [pronStatus && pronStatus.state]);



  // ✅ 2026-01-10：多義詞 toggle（UI-only legacy）
  // - 2026-01-10 이후：真正的 toggle 狀態以 props.multiRefEnabled 為準（由上層控制）
  // - 這個 local state 先保留，避免你其他地方還在依賴 localStorage
  const [polysemyEnabled, setPolysemyEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("examplePolysemyEnabled");
    return stored === "true" ? true : false;
  });

  // ✅ 2026-01-10：統一 toggle 真正顯示狀態（以 multiRefEnabled 優先）
  const effectiveMultiRefEnabled = useMemo(() => {
    if (typeof multiRefEnabled === "boolean") return multiRefEnabled;
    return !!polysemyEnabled;
  }, [multiRefEnabled, polysemyEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("exampleShowGerman", String(showGerman));
  }, [showGerman]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "exampleShowTranslation",
      String(showTranslation)
    );
  }, [showTranslation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "examplePolysemyEnabled",
      String(polysemyEnabled)
    );
  }, [polysemyEnabled]);

  const handleWordClick = (word) => {
    if (onWordClick && typeof onWordClick === "function") {
      onWordClick(word);
    }
  };

  const handleSpeakSentence = () => {
    if (!mainSentence) return;

    // Phase 1.5: overwrite previous replay URL when starting a new recording
    try {
      const au = __pronReplayAudioRef.current;
      if (au && typeof au.pause === "function") au.pause();
    } catch (e) {
      // ignore
    }
    try {
      const prevUrl = __pronReplayUrlRef.current;
      if (prevUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(prevUrl);
      }
    } catch (e2) {
      // ignore
    } finally {
      __pronReplayUrlRef.current = "";
      setPronReplayUrl("");
      setPronReplayMeta((m) => ({ ...(m || {}), durationMs: 0, mimeType: "", error: "" }));
    }

    if (onSpeak && typeof onSpeak === "function") {
      onSpeak(mainSentence);
    }
  };


  // ✅ 2026-01-22: Pronunciation / shadowing (Phase 1 UI-only)
  // - Toggle recording. When finished, call onPronunciationAudioReady(mainSentence, blob, meta)
  const __stopPronunciationStreamIfNeeded = () => {
    try {
      const st = __pronMediaStreamRef.current;
      if (st && typeof st.getTracks === "function") {
        st.getTracks().forEach((tr) => {
          try {
            tr.stop();
          } catch (e) {
            // ignore
          }
        });
      }
    } catch (e) {
      // ignore
    } finally {
      __pronMediaStreamRef.current = null;
    }
  };

  const __resetPronunciationRecorderRefs = () => {
    __pronMediaRecorderRef.current = null;
    __pronChunksRef.current = [];
    __pronStartTsRef.current = 0;
  };

  const startPronunciationRecording = async () => {
    if (!__hasMediaRecorderSupport) {
      setPronStatus((p) => ({
        ...(p || {}),
        state: "error",
        error: "此瀏覽器不支援錄音（MediaRecorder）。",
      }));

      // ✅ Phase B-1: coverage-once enter recording
      if (coverageOnceEnabled) {
        setCoverageOnceState("recording");
        setCoverageOnceTokens(null);
        setCoverageOnceTranscript("");
        setCoverageOnceLLM({ score: null, feedback: "", error: "" });

        // 錄音期間：點畫面任意處停止（只在 coverage-once 開啟時）
        try { __removeCoverageStopAnyListener(); } catch (e) {}
        const __stopAny = () => {
          stopPronunciationRecording();
        };
        __coverageStopAnyRef.current = __stopAny;
        try {
          window.addEventListener("pointerdown", __stopAny, true);
        } catch (e) {
          // ignore
        }
      }
      return;
    }
    if (!!pronunciationDisabled) return;
    if (!mainSentence) return;

    try {
      setPronStatus((p) => ({
        ...(p || {}),
        state: "recording",
        seconds: 0,
        error: "",
        lastDurationMs: 0,
        lastMimeType: "",
      }));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      __pronMediaStreamRef.current = stream;
      // Phase 1.6: start waveform viz (recording only)
      try {
        __startPronunciationViz(stream);
      } catch (eViz) {
        // ignore
      }

      const mr = new MediaRecorder(stream);
      __pronMediaRecorderRef.current = mr;
      __pronChunksRef.current = [];
      __pronStartTsRef.current = Date.now();

      mr.ondataavailable = (ev) => {
        try {
          if (ev && ev.data && ev.data.size > 0) {
            __pronChunksRef.current.push(ev.data);
          }
        } catch (e) {
          // ignore
        }
      };

      mr.onerror = (ev) => {
        setPronStatus((p) => ({
          ...(p || {}),
          state: "error",
          error: "錄音發生錯誤，請重試。",
        }));
        try {
          __stopPronunciationStreamIfNeeded();
        } catch (e) {
          // ignore
        }
        __resetPronunciationRecorderRefs();
      };

      mr.onstop = () => {
        try {
          const chunks = __pronChunksRef.current || [];
          const mimeType =
            (mr && mr.mimeType) || (chunks[0] && chunks[0].type) || "audio/webm";
          const blob = new Blob(chunks, { type: mimeType });

          const durMs = Math.max(0, Date.now() - (__pronStartTsRef.current || Date.now()));

          // ✅ Phase B-1: coverage-once (錄完一次 -> ASR -> 上色 -> LLM 回饋/評分)
          if (coverageOnceEnabled) {
            setCoverageOnceState("processing");
            try { __removeCoverageStopAnyListener(); } catch (eRm) {}

            (async () => {
              try {
                const asr = await callCoverageOnceASR(blob);

                const built = buildCoverageColoredTokens({
                  refText: mainSentence || "",
                  asrWords: asr.words || [],
                  highConfThreshold: 0.85,
                });

                setCoverageOnceTranscript(asr.transcript || "");
                setCoverageOnceTokens(__realignCoverageRefTokensByBag((built && built.refTokens) || [], asr.words || [], 0.85));
                setCoverageOnceState("done");

                // after we have tokens/transcript, call LLM for short feedback + score (optional)
                try {
                  const tokens = (built && built.refTokens) || [];
                  const missingWords = tokens
                    .filter((t) => t && t.state === "miss")
                    .map((t) => t.raw);
                  const lowConfidenceWords = tokens
                    .filter((t) => t && t.state === "hit_low")
                    .map((t) => t.raw);

                  const llmPayload = {
                    lang: "de-DE",
                    refText: mainSentence || "",
                    transcript: asr.transcript || "",
                    missingWords,
                    lowConfidenceWords,
                    meta: {
                      wordsCount: tokens.length,
                    },
                  };

                  const llm = await callCoverageOnceLLMFeedback(llmPayload);
                  setCoverageOnceLLM((p) => ({
                    ...(p || {}),
                    score:
                      typeof llm.score === "number"
                        ? llm.score
                        : typeof llm.rating === "number"
                          ? llm.rating
                          : null,
                    feedback: llm.feedback || llm.text || "",
                    error: "",
                  }));
                } catch (eLlm) {
                  setCoverageOnceLLM((p) => ({
                    ...(p || {}),
                    error: "LLM_FEEDBACK_UNAVAILABLE",
                  }));
                }
              } catch (eAsr) {
                setCoverageOnceState("error");
                setCoverageOnceLLM((p) => ({
                  ...(p || {}),
                  error: (eAsr && eAsr.message) || "ASR_FAILED",
                }));
              }
            })();
          }
          // Phase 1.5: build replay URL for the last recording
          try {
            const prevUrl = __pronReplayUrlRef.current;
            if (prevUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
              URL.revokeObjectURL(prevUrl);
            }
          } catch (ePrev) {
            // ignore
          }
          let __nextReplayUrl = "";
          try {
            if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
              __nextReplayUrl = URL.createObjectURL(blob);
            }
          } catch (eUrl) {
            __nextReplayUrl = "";
          }
          __pronReplayUrlRef.current = __nextReplayUrl;
          setPronReplayUrl(__nextReplayUrl);
          setPronReplayMeta((m) => ({
            ...(m || {}),
            durationMs: durMs,
            mimeType,
            error: __nextReplayUrl ? "" : "Replay URL 產生失敗",
          }));


          setPronStatus((p) => ({
            ...(p || {}),
            state: "done",
            seconds: 0,
            error: "",
            lastDurationMs: durMs,
            lastMimeType: mimeType,
          }));

          // UI-only: delegate to upstream
          if (typeof onPronunciationAudioReady === "function") {
            try {
              onPronunciationAudioReady(mainSentence, blob, {
                durationMs: durMs,
                mimeType,
              });
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          setPronStatus((p) => ({
            ...(p || {}),
            state: "error",
            error: "錄音檔處理失敗，請重試。",
          }));
        } finally {
          // Phase 1.6: stop waveform viz when recording stops
          try {
            __stopPronunciationVizIfNeeded();
          } catch (eVizStop) {
            // ignore
          }
          try {
            __stopPronunciationStreamIfNeeded();
          } catch (e) {
            // ignore
          }
          __resetPronunciationRecorderRefs();
        }
      };

      mr.start();
    } catch (e) {
      setPronStatus((p) => ({
        ...(p || {}),
        state: "error",
        error: "無法取得麥克風權限或錄音失敗。",
      }));
      try {
        __stopPronunciationStreamIfNeeded();
      } catch (e2) {
        // ignore
      }
      __resetPronunciationRecorderRefs();
    }
  };

  const stopPronunciationRecording = () => {
    // ✅ Phase B-1: remove stop-anywhere listener
    try { __removeCoverageStopAnyListener(); } catch (e) {}

    try {
      const mr = __pronMediaRecorderRef.current;
      if (mr && mr.state && mr.state !== "inactive") {
        mr.stop();
        return;
      }
    } catch (e) {
      // ignore
    }
    // fallback
    // Phase 1.6: ensure waveform viz stops even if recorder was not active
    try {
      __stopPronunciationVizIfNeeded();
    } catch (eVizStop) {
      // ignore
    }
    try {
      __stopPronunciationStreamIfNeeded();
    } catch (e2) {
      // ignore
    }
    __resetPronunciationRecorderRefs();
    setPronStatus((p) => ({
      ...(p || {}),
      state: "idle",
      seconds: 0,
      error: "",
    }));
  };

  
  // ✅ Phase B-1: Coverage-once helpers
  const __removeCoverageStopAnyListener = () => {
    try {
      if (__coverageStopAnyRef.current) {
        window.removeEventListener("pointerdown", __coverageStopAnyRef.current, true);
      }
    } catch (e) {
      // ignore
    }
    __coverageStopAnyRef.current = null;
  };

  const callCoverageOnceASR = async (audioBlob) => {
    const fd = new FormData();
    fd.append("audio", audioBlob, "coverage.webm");
    fd.append("lang", "de-DE");
    fd.append("mode", "coverage");

    const __authHeaders = await __getAuthHeadersForApi();

    const resp = await fetch(`${API_BASE}/api/speech/asr`, {
      method: "POST",
      headers: __authHeaders,
      body: fd,
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || data.ok !== true) {
      const err = (data && data.error) || "ASR_FAILED";
      throw new Error(err);
    }
    return data;
  };


  // ✅ 2026-01-24: Coverage token realign (避免「前面錯→後面全錯」)
  // 規則：先保留既有 hit_*，再把 ref 中 state=miss 的字，嘗試在 asrWords 的剩餘字集中重新配對（bag-of-words）
  // 目的：即使前面有插入/漏字，後面只要「有出現」仍能被標記為命中（高/低信心依 confidence）
  const __realignCoverageRefTokensByBag = (refTokens, asrWords, highConfThreshold) => {
    const tokens = Array.isArray(refTokens) ? refTokens.map((t) => ({ ...(t || {}) })) : [];
    const words = Array.isArray(asrWords) ? asrWords : [];
    const norm = (s) =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/[\u2019\u2018]/g, "'")
        .replace(/[^a-zäöüß0-9']/gi, "");
    const buckets = {};
    for (const w of words) {
      const raw = (w && (w.w || w.raw || w.text)) || "";
      const k = norm(raw);
      if (!k) continue;
      if (!buckets[k]) buckets[k] = [];
      buckets[k].push(typeof w.confidence === "number" ? w.confidence : null);
    }
    // 先扣掉已命中的 tokens，避免重複吃到同一顆字
    for (const t of tokens) {
      const k = norm(t && (t.raw || t.text || t.w));
      if (!k) continue;
      if (t && (t.state === "hit_high" || t.state === "hit_low")) {
        if (buckets[k] && buckets[k].length) buckets[k].shift();
      }
    }
    // 再把 miss 的嘗試補回來
    for (const t of tokens) {
      if (!t || t.state !== "miss") continue;
      const k = norm(t.raw || t.text || t.w);
      if (!k) continue;
      if (buckets[k] && buckets[k].length) {
        const conf = buckets[k].shift();
        const c = typeof conf === "number" ? conf : (t.confidence != null ? t.confidence : null);
        t.confidence = c;
        t.state = typeof c === "number" && c >= highConfThreshold ? "hit_high" : "hit_low";
        t.__realigned = true;
      }
    }
    return tokens;
  };


  // ✅ Phase B-1: LLM feedback + score (optional)
  // - 你若已有既定 endpoint，把 URL 改到你現有的即可
  // - 失敗不阻斷 coverage 上色顯示
  const callCoverageOnceLLMFeedback = async (payload) => {
    const resp = await fetch(`${API_BASE}/api/llm/coverage-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      throw new Error("LLM_FAILED");
    }
    return data;
  };


  // ✅ 2026-01-24: Coverage token realign (避免「前面錯→後面全錯」)
  // 規則：先保留既有 hit_*，再把 ref 中 state=miss 的字，嘗試在 asrWords 的剩餘字集中重新配對（bag-of-words）
  // 目的：即使前面有插入/漏字，後面只要「有出現」仍能被標記為命中（高/低信心依 confidence）
  // ❌ DEPRECATED DUPLICATE: kept for history/line-count, do not use
  const __realignCoverageRefTokensByBag__DEPRECATED_DUP = (refTokens, asrWords, highConfThreshold) => {
    const tokens = Array.isArray(refTokens) ? refTokens.map((t) => ({ ...(t || {}) })) : [];
    const words = Array.isArray(asrWords) ? asrWords : [];
    const norm = (s) =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/[\u2019\u2018]/g, "'")
        .replace(/[^a-zäöüß0-9']/gi, "");
    const buckets = {};
    for (const w of words) {
      const raw = (w && (w.w || w.raw || w.text)) || "";
      const k = norm(raw);
      if (!k) continue;
      if (!buckets[k]) buckets[k] = [];
      buckets[k].push(typeof w.confidence === "number" ? w.confidence : null);
    }
    // 先扣掉已命中的 tokens，避免重複吃到同一顆字
    for (const t of tokens) {
      const k = norm(t && (t.raw || t.text || t.w));
      if (!k) continue;
      if (t && (t.state === "hit_high" || t.state === "hit_low")) {
        if (buckets[k] && buckets[k].length) buckets[k].shift();
      }
    }
    // 再把 miss 的嘗試補回來
    for (const t of tokens) {
      if (!t || t.state !== "miss") continue;
      const k = norm(t.raw || t.text || t.w);
      if (!k) continue;
      if (buckets[k] && buckets[k].length) {
        const conf = buckets[k].shift();
        const c = typeof conf === "number" ? conf : (t.confidence != null ? t.confidence : null);
        t.confidence = c;
        t.state = typeof c === "number" && c >= highConfThreshold ? "hit_high" : "hit_low";
        t.__realigned = true;
      }
    }
    return tokens;
  };

const handlePronunciationToggle = () => {

// ✅ Phase 2.2: prefer hook implementation
if (__USE_PRONUNCIATION_RECORDER_HOOK && __pronHook && typeof __pronHook.toggle === "function") {
  __pronHook.toggle();
  return;
}

    if (!!pronunciationDisabled) return;
    if (!__hasMediaRecorderSupport) {
      setPronStatus((p) => ({
        ...(p || {}),
        state: "error",
        error: "此瀏覽器不支援錄音（MediaRecorder）。",
      }));
      return;
    }
    if (!mainSentence) return;

    if (pronStatus && pronStatus.state === "recording") {
      stopPronunciationRecording();
      return;
    }
    // start
    startPronunciationRecording();
  };

  const handlePronunciationReplay = () => {

// ✅ Phase 2.2: prefer hook implementation
if (__USE_PRONUNCIATION_RECORDER_HOOK && __pronHook && typeof __pronHook.replay === "function") {
      __pronHook.replay();
      return;
    }

    if (!!pronunciationDisabled) return;
    if (!!loading) return;
    if (!pronReplayUrl) return;
    try {
      let au = __pronReplayAudioRef.current;
      if (!au) {
        au = new Audio();
        __pronReplayAudioRef.current = au;
      }
      try {
        au.pause();
        au.currentTime = 0;
      } catch (e1) {
        // ignore
      }
      au.src = pronReplayUrl;
      const p = au.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // ignore autoplay restrictions
        });
      }
    } catch (e) {
      // ignore
    }
  };



  // ✅ 2026-01-13: click headword to regenerate (UI-only)
  // ✅ 2026-01-13 (hotfix): support both signatures
  // - some upstream may pass onHeadwordClick() (no args)
  // - some upstream may pass onHeadwordClick(headword) (1 arg)
  const handleHeadwordClick = () => {
    if (!canClickHeadword) return;
    if (!!loading) return;
    if (typeof onHeadwordClick === "function") {
      try {
        // Prefer calling with arg only when upstream expects it
        if (typeof onHeadwordClick.length === "number" && onHeadwordClick.length >= 1) {
          onHeadwordClick(safeHeadword);
        } else {
          onHeadwordClick();
        }
      } catch (e) {
        // fallback: try no-arg
        try {
          onHeadwordClick();
        } catch (e2) {
          // ignore
        }
      }
    }
  };

  // ✅ legacy（保留不刪）：此 function 目前未使用
  const handleToggleMultiRefClick = () => {
    if (onToggleMultiRef && typeof onToggleMultiRef === "function") {
      onToggleMultiRef();
    }
  };

  // ✅ legacy（保留不刪）：本地 toggle（目前不作為 render gate 依據）
  const handleTogglePolysemyClick = () => {
    setPolysemyEnabled((v) => !v);
  };

  const renderSentence = () => {
    if (!mainSentence) return null;
    const parts = mainSentence.split(/(\s+)/);
    return parts.map((part, idx) => {
      if (part.trim() === "") return part;
    
// === Controlled aliases for SpeakAnalyzePanel (single source of truth) ===
// const showTarget = showGerman;
// const toggleShowTarget = () => setShowGerman(v => !v);
// const toggleShowTranslation = () => setShowTranslation(v => !v);

  return (
        <span
          key={idx}
          style={{
            cursor: onWordClick ? "pointer" : "default",
            paddingInline: 1,
          }}
          onClick={() => handleWordClick(part)}
        >
          {part}
        </span>
      );
    });
  };

  const renderSentenceMosaic = () => {
    return <span style={{ whiteSpace: "nowrap" }}>{MOSAIC_LINE}</span>;
  };


  // NOTE: Translation gate must not rely on truthy checks, because snapshot replay may carry "".
  const hasTranslation =
    typeof exampleTranslation === "string" && exampleTranslation.trim() !== "";
  const renderTranslation = () => {
    if (!hasTranslation) return null;
    if (showTranslation) return <span>{exampleTranslation}</span>;
    return <span style={{ whiteSpace: "nowrap" }}>{MOSAIC_LINE}</span>;
  };

  // ✅ 方案 2：toggle ON 才 render「新增按鈕（refControls）」
  // - 注意：refControls 仍然保留在原本的 div（exampleRefControlsInline）
  // - 只是 gate 變成：multiRefEnabled == true 才顯示
  const showRefControls = !!refControls;

  // ✅ DEPRECATED（保留）：舊邏輯是只看 refControls 是否存在
  const __DEPRECATED_showRefControls_withoutToggleGate = showRefControls;

  // ✅ NEW：正式 gate（你的方案 2）
  const showRefControlsWhenToggleOn =
    !!effectiveMultiRefEnabled && !!refControls;

  // ✅ Phase 2-UX：refControls 位置策略（更新）
  // - refControls（新增參考 / pills / badge 等）一律放在標題列中間區塊
  // - 下方的 refControls fallback 保留，但預設不再使用（避免重複顯示）
  const showRefControlsInHeader = showRefControlsWhenToggleOn;
  const showRefControlsBelow = false;

  // ✅ 2026-01-10：refConfirm（獨立一行）
  const showRefConfirmRow = !!refConfirm;

  // ✅ 2026-01-10：Confirm Inline（跟 toggle 同一列，放在 toggle 右側）
  const showRefConfirmInline = !!refConfirm;


// === Controlled aliases for SpeakAnalyzePanel (single source of truth) ===
// const showTarget = showGerman;
// const toggleShowTarget = () => setShowGerman(v => !v);
// const toggleShowTranslation = () => setShowTranslation(v => !v);

  return (
    <>
      {/* ✅ 2026-01-10：先拆 div（Confirm Row）
          - DEPRECATED 2026-01-10: 需求改為「確認」要在 toggle 右側同一列
          - 保留原碼避免行數減少；預設不 render，避免畫面出現兩個「確認」
      */}
      {(() => {
        const __DEPRECATED_SHOW_CONFIRM_ROW = false;
        if (!__DEPRECATED_SHOW_CONFIRM_ROW) return null;
      
// === Controlled aliases for SpeakAnalyzePanel (single source of truth) ===
// const showTarget = showGerman;
// const toggleShowTarget = () => setShowGerman(v => !v);
// const toggleShowTranslation = () => setShowTranslation(v => !v);

  return (
          showRefConfirmRow && (
            <div
              data-ref="exampleConfirmRow"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 8,
                marginBottom: 6,
              }}
            >
              {refConfirm}
            </div>
          )
        );
      })()}

      {/* ✅ Toggle row：toggle + confirm */}
      <div
        data-ref="examplePolysemyToggleRow"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 6,
        }}
      >
        <button
          type="button"
          onClick={onToggleMultiRef}
          aria-pressed={effectiveMultiRefEnabled ? "true" : "false"}
          title={multiRefToggleLabel || ""}
          style={{
            ...getMultiRefToggleStyle(!!effectiveMultiRefEnabled),
          }}
        >
          <span>{multiRefToggleLabel}</span>
          <span style={getMultiRefToggleDotStyle(!!effectiveMultiRefEnabled)} />
        </button>

        {/* ✅ 2026-01-10：把「確認」移到 toggle 右側（同一列） */}
        {showRefConfirmInline && (
          <div
            data-ref="exampleConfirmInline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,

              // ✅ 2026-01-10: 讓 refConfirm 內的「新增 popup」可以定位在按鈕旁邊
              // - WordExampleBlock 內的 popup 使用 position:absolute; top/right
              // - 若外層沒有 position:relative，popup 會以整頁（或其他祖先）定位，造成「點了沒反應」其實是跑到看不到的地方
              // - 這裡只加定位與 overflow，不改任何邏輯
              position: "relative",
              overflow: "visible",
              zIndex: 5,
            }}
          >
            {refConfirm}
          </div>
        )}
      </div>

      {/* ✅ Row 1：標題 + headword + refControls（同一列） */}
      <div
        data-ref="exampleHeaderRow"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        {/* 左側：Example + headword（獨立 div） */}
        <div
          data-ref="exampleTitleGroup"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <div style={{ fontWeight: 600 }}>{sectionExample || "例句"}</div>

          {/* ✅ 2026-01-13: headword clickable (optional) */}
          {/* - If onHeadwordClick is provided, clicking triggers upstream regenerate */}
          {/* - Otherwise behaves like original static badge */}
          {canClickHeadword ? (
            <button
              type="button"
              onClick={handleHeadwordClick}
              disabled={!!loading}
              title={
                headwordClickTooltip ||
                (hasHeadword
                  ? "點這個主詞重新產生例句"
                  : "not available")
              }
              aria-label="example-headword"
              data-ref="exampleHeadwordButton"
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                margin: 0,
                display: "inline-flex",
                alignItems: "center",
                ...getHeadwordClickableStyle(true, !!loading),
              }}
            >
              <span
                style={{
                  ...getHeadwordBadgeStyle(hasHeadword),
                }}
              >
                {safeHeadword}
                </span>
                {__headwordRefHint && hasHeadword ? (
                  <span
                    title={__headwordRefHint}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginLeft: 6,
                      cursor: "help",
                      fontSize: 12,
                      opacity: 0.72,
                      lineHeight: "14px",
                      alignSelf: "center",
                    }}
                    aria-label="info"
                  >
                    ⓘ
                  </span>
                ) : null}

            </button>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
              }}
              aria-label="example-headword-wrap"
              data-ref="exampleHeadwordWrap"
            >
              <span
                style={{
                  ...getHeadwordBadgeStyle(hasHeadword),
                  ...getHeadwordClickableStyle(false, !!loading),
                }}
                title={hasHeadword ? safeHeadword : "not available"}
                aria-label="example-headword"
                data-ref="exampleHeadwordBadge"
              >
                {safeHeadword}
              </span>
              {__headwordRefHint && hasHeadword ? (
                <span
                  title={__headwordRefHint}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginLeft: 6,
                    cursor: "help",
                    fontSize: 12,
                    opacity: 0.72,
                    lineHeight: "14px",
                    alignSelf: "center",
                  }}
                  aria-label="info"
                  data-ref="exampleHeadwordRefHint"
                >
                  ⓘ
                </span>
              ) : null}
            </span>

          )}
        </div>

        {/* 中間：refControls（獨立 div） */}
        {/* ✅ 方案 2：toggle ON 才 render 新增按鈕 / badge */}
        {showRefControlsInHeader && (
          <div
            data-ref="exampleRefControlsInline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {refControls}
          </div>
        )}

        {/* ✅ DEPRECATED（保留不刪）：舊行為提示（不 render）
            - 用來保留你之前的條件判斷概念，不影響目前 UI
        */}
        {(() => {
          const __DEPRECATED_SHOW_REFCONTROLS_WHEN_EXIST = false;
          if (!__DEPRECATED_SHOW_REFCONTROLS_WHEN_EXIST) return null;
        
// === Controlled aliases for SpeakAnalyzePanel (single source of truth) ===
// const showTarget = showGerman;
// const toggleShowTarget = () => setShowGerman(v => !v);
// const toggleShowTranslation = () => setShowTranslation(v => !v);

  return (
            __DEPRECATED_showRefControls_withoutToggleGate && (
              <div
                data-ref="exampleRefControlsInline__deprecated"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: 0.65,
                }}
              >
                {refControls}
              </div>
            )
          );
        })()}
      </div>

      {/* ✅ Row 2：三個 icon（播放 / refresh / 對話）移到下一行 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        {hasExamples && !__speakPanelOpen && onSpeak && (
          <SpeakButton
            onClick={handleSpeakSentence}
            title="播放語音"
          />
        )}

        {hasExamples && onToggleConversation && (
          <button
            type="button"
            onClick={onToggleConversation}
            title={conversationToggleTooltip}
            className="icon-button sound-button"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
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
        )}


        {/* ✅ 2026-01-22: Pronunciation / shadowing button (Phase 1 UI-only) */}
        {hasExamples && (
          <button
            type="button"
            onClick={() => {
              // open SpeakAnalyzePanel (do not start recording immediately)
              if (!!pronunciationDisabled || !!loading) return;
              if (!__effectiveHasMediaRecorderSupport) return;
              __speakPanelAudioBlobRef.current = null;
              __setSpeakPanelHasAudio(false);
              __setSpeakPanelAnalyzeState("idle");
              __setSpeakPanelTokens(null);
              __setSpeakPanelTranscript("");
              __setSpeakPanelMessage("");
              __setSpeakPanelOpen(true);
            }}
            title={
              pronunciationTooltip ||
              (__effectivePronStatus && __effectivePronStatus.state === "recording"
                ? "停止錄音"
                : "跟讀錄音")
            }
            aria-label="example-pronunciation"
            data-ref="examplePronunciationButton"
            className="icon-button sound-button"
            disabled={!!pronunciationDisabled || !__effectiveHasMediaRecorderSupport || !!loading}
            style={{
              border: "none",
              background: "transparent",
              cursor:
                !!pronunciationDisabled || !__effectiveHasMediaRecorderSupport || !!loading
                  ? "not-allowed"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
              opacity:
                !!pronunciationDisabled || !__effectiveHasMediaRecorderSupport || !!loading
                  ? 0.45
                  : __effectivePronStatus && __effectivePronStatus.state === "recording"
                    ? 0.98
                    : 0.86,
            }}
          >
            {/* mic icon */}
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
        )}

        {/* ✅ 2026-01-22: Pronunciation status (UI-only, small hint) */}
        {hasExamples && !__speakPanelOpen && __effectivePronStatus && __effectivePronStatus.state === "recording" && (
          <span style={{ fontSize: 12, opacity: 0.72 }}>
            錄音中 {__effectivePronStatus.seconds || 0}s
          </span>
        )}

        {/* ✅ Phase 1.6: live waveform while recording */}
        {hasExamples && !__speakPanelOpen && __effectivePronStatus && __effectivePronStatus.state === "recording" && (
          <canvas
            ref={__pronVizCanvasRef}
            width={150}
            height={22}
            aria-label="pronunciation-waveform"
            data-ref="examplePronunciationWaveform"
            style={{
              display: "inline-block",
              width: 150,
              height: 22,
              borderRadius: 8,
              border: "1px solid rgba(127,127,127,0.28)",
              background: "rgba(127,127,127,0.08)",
              marginLeft: 6,
              verticalAlign: "middle",
              // color is used by getComputedStyle(canvas).color for strokeStyle
              color: "var(--text)",
              opacity: !!pronunciationDisabled || !!loading ? 0.45 : 0.92,
            }}
          />
        )}
        
        {hasExamples && !__speakPanelOpen && __effectivePronStatus && __effectivePronStatus.state === "error" && !!__effectivePronStatus.error && (
          <span style={{ fontSize: 12, opacity: 0.72 }}>
            {__effectivePronStatus.error}
          </span>
        )}

        {loading && (
          <span
            style={{
              fontSize: 12,
              opacity: 0.7,
              marginLeft: "auto",
            }}
          >
            產生中…
          </span>
        )}
      </div>

      {/* 主例句（德文）＋ 眼睛切換 */}
      {hasExamples && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setShowGerman((v) => !v)}
            title={showGerman ? "隱藏德文例句" : "顯示德文例句"}
            className="icon-button sound-button"
            style={eyeButtonStyle}
          >
            {showGerman ? <EyeIconOpen /> : <EyeIconClosed />}
          </button>

          <div
            style={{
              fontSize: 18,
              lineHeight: 1.6,
              marginBottom: 4,
            }}
          >

            {showGerman ? renderSentence() : renderSentenceMosaic()}
          </div>

          {/* ✅ Phase B-1: Coverage-once colored sentence + feedback */}
          {coverageOnceEnabled && coverageOnceState === "processing" && (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
              ASR 分析中…
            </div>
          )}

          {coverageOnceEnabled && coverageOnceState === "done" && (
            <div style={{ marginTop: 6 }}>
              <CoverageOnceSentence tokens={coverageOnceTokens || []} />

              {coverageOnceTranscript ? (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78 }}>
                  ASR：{coverageOnceTranscript}
                </div>
              ) : null}

              {coverageOnceLLM && (coverageOnceLLM.feedback || coverageOnceLLM.score !== null) ? (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                  {typeof coverageOnceLLM.score === "number" ? (
                    <div style={{ marginBottom: 4 }}>評分：{coverageOnceLLM.score}</div>
                  ) : null}
                  {coverageOnceLLM.feedback ? <div>{coverageOnceLLM.feedback}</div> : null}
                  {coverageOnceLLM.error ? (
                    <div style={{ marginTop: 4, opacity: 0.72 }}>
                      （LLM：{coverageOnceLLM.error}）
                    </div>
                  ) : null}
                </div>
              ) : coverageOnceLLM && coverageOnceLLM.error ? (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
                  （LLM：{coverageOnceLLM.error}）
                </div>
              ) : null}
            </div>
          )}

          {coverageOnceEnabled && coverageOnceState === "error" && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>
              Coverage error：{(coverageOnceLLM && coverageOnceLLM.error) || "ASR_FAILED"}
            </div>
          )}
        </div>
      )}

      {/* 翻譯 ＋ 眼睛切換 */}
      {hasTranslation && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setShowTranslation((v) => !v)}
            title={showTranslation ? "隱藏翻譯" : "顯示翻譯"}
            className="icon-button sound-button"
            style={eyeButtonStyle}
          >
            {showTranslation ? <EyeIconOpen /> : <EyeIconClosed />}
          </button>

          <div
            style={{
              fontSize: 15,
              opacity: 0.9,
            }}
          >
            {renderTranslation()}
          </div>
        </div>
      )}

      {/* ✅ Phase 2-UX：RefControls Slot（固定放在翻譯之後，避免卡在例句與對話之間） */}
      {/* DEPRECATED 2026-01-08: refControls 預設改放到標題列；此處僅保留 fallback（目前不使用，避免重複顯示） */}
      {showRefControlsBelow && (
        <div
          style={{
            marginTop: 10,
          }}
        >
          {refControls}
        </div>
      )}

      {/* ✅ 2026-01-24: SpeakAnalyzePanel (record/replay/analyze in one place) */}
      {__speakPanelOpen && (
        <SpeakAnalyzePanel
          targetText={mainSentence || ""}
          translationText={exampleTranslation || ""}
          showTarget={showTarget}
          showTranslation={showTranslation}
          onToggleShowTarget={toggleShowTarget}
          onToggleShowTranslation={toggleShowTranslation}
          onPlayTarget={onPlayTarget}
          disabled={!!pronunciationDisabled || !!loading || !__effectiveHasMediaRecorderSupport}
          recordState={(__effectivePronStatus && __effectivePronStatus.state) || "idle"}
          seconds={(__effectivePronStatus && __effectivePronStatus.seconds) || 0}
          hasAudio={__speakPanelHasAudio}
          analyzeState={__speakPanelAnalyzeState}
          tokens={__speakPanelTokens || []}
          transcript={__speakPanelTranscript || ""}
          message={__speakPanelMessage || ""}
          onClose={() => { __setSpeakPanelOpen(false); }}
          onToggleRecord={() => { try { handlePronunciationToggle(); } catch (e) {} }}
          onReplay={() => { try { handlePronunciationReplay(); } catch (e) {} }}
          onAnalyzeOnce={async () => {
            if (__speakPanelAnalyzeState === "processing") return;
            const blob = __speakPanelAudioBlobRef.current;
            if (!blob) return;
            __setSpeakPanelAnalyzeState("processing");
            __setSpeakPanelMessage("");
            try {
              const fd = new FormData();
              fd.append("audio", blob, "speak.webm");
              fd.append("lang", "de-DE");
              const __authHeaders = await __getAuthHeadersForApi();

    const resp = await fetch(`${API_BASE}/api/speech/asr`, {
      method: "POST",
      headers: __authHeaders,
      body: fd,
    });
              const data = await resp.json().catch(() => null);
              if (!resp.ok || !data) throw new Error((data && data.error) || "ASR_FAILED");
              const built = buildCoverageColoredTokens({
                refText: mainSentence || "",
                asrWords: (data && data.words) || [],
                highConfThreshold: 0.85,
              });
              __setSpeakPanelTranscript((data && data.transcript) || "");
              __setSpeakPanelTokens((built && built.refTokens) || []);
              __setSpeakPanelAnalyzeState("done");
              __setSpeakPanelMessage("");
            } catch (e) {
              __setSpeakPanelAnalyzeState("error");
              __setSpeakPanelMessage("分析失敗：" + ((e && e.message) || "ASR_FAILED"));
            }
          }}
        />
      )}
    </>
  );
}
// frontend/src/components/examples/ExampleSentence.jsx (file end)
// frontend/src/components/examples/ExampleSentence.jsx
