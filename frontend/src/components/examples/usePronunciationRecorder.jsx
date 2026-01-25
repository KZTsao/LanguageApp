// FILE: frontend/src/components/examples/usePronunciationRecorder.js
// frontend/src/components/examples/usePronunciationRecorder.js
/**
 * usePronunciationRecorder (Phase 2.2)
 * - Extracts pronunciation/shadowing recording + replay + waveform visualization from ExampleSentence.jsx
 * - UI stays in ExampleSentence; this hook provides state + handlers.
 *
 * Constraints:
 * - No API calls / no backend changes.
 * - Uses MediaRecorder + URL.createObjectURL(blob).
 * - Keeps only the LAST recording (overwrites & revokeObjectURL).
 * - Cleans up on unmount.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export default function usePronunciationRecorder(opts) {
  const {
    enabled = true,
    mainSentence = "",
    disabled = false,
    loading = false,
    onAudioReady,
    canvasRef,
    canvasWidth = 150,
    canvasHeight = 22,
  } = opts || {};

  const hasSupport = useMemo(() => {
    try {
      if (!enabled) return false;
      if (typeof window === "undefined") return false;
      return (
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof window.MediaRecorder !== "undefined"
      );
    } catch (e) {
      return false;
    }
  }, [enabled]);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const startTsRef = useRef(0);

  const replayUrlRef = useRef("");
  const replayAudioRef = useRef(null);

  const [status, setStatus] = useState(() => ({
    state: "idle", // idle | recording | done | error
    seconds: 0,
    error: "",
    lastDurationMs: 0,
    lastMimeType: "",
  }));

  const [replayUrl, setReplayUrl] = useState(() => "");
  const [replayMeta, setReplayMeta] = useState(() => ({
    durationMs: 0,
    mimeType: "",
    error: "",
  }));

  // =========================
  // Waveform visualization
  // =========================
  const vizRafRef = useRef(0);
  const vizAudioCtxRef = useRef(null);
  const vizAnalyserRef = useRef(null);
  const vizSourceRef = useRef(null);
  const vizLastColorRef = useRef("");

  const stopVizIfNeeded = () => {
    try {
      const rafId = vizRafRef.current;
      if (rafId && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(rafId);
      }
    } catch (e) {
      // ignore
    } finally {
      vizRafRef.current = 0;
    }

    try {
      const src = vizSourceRef.current;
      if (src && typeof src.disconnect === "function") src.disconnect();
    } catch (e) {
      // ignore
    } finally {
      vizSourceRef.current = null;
    }

    try {
      const an = vizAnalyserRef.current;
      if (an && typeof an.disconnect === "function") an.disconnect();
    } catch (e) {
      // ignore
    } finally {
      vizAnalyserRef.current = null;
    }

    try {
      const ctx = vizAudioCtxRef.current;
      if (ctx && typeof ctx.close === "function") {
        try { ctx.close(); } catch (e2) {}
      }
    } catch (e) {
      // ignore
    } finally {
      vizAudioCtxRef.current = null;
    }

    // clear canvas
    try {
      const c = canvasRef && canvasRef.current;
      if (c && c.getContext) {
        const g = c.getContext("2d");
        if (g) g.clearRect(0, 0, c.width, c.height);
      }
    } catch (e) {
      // ignore
    }
  };

  const startViz = (stream) => {
    try {
      if (!enabled) return;
      if (typeof window === "undefined") return;
      if (!stream) return;

      stopVizIfNeeded();

      const c = canvasRef && canvasRef.current;
      if (!c || !c.getContext) return;

      // ensure internal pixel size matches expected drawing
      try {
        if (canvasWidth && c.width !== canvasWidth) c.width = canvasWidth;
        if (canvasHeight && c.height !== canvasHeight) c.height = canvasHeight;
      } catch (e0) {}

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      vizAudioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      vizAnalyserRef.current = analyser;

      const src = ctx.createMediaStreamSource(stream);
      vizSourceRef.current = src;
      src.connect(analyser);

      const bufLen = analyser.fftSize;
      const data = new Uint8Array(bufLen);

      const resolveStrokeColor = () => {
        try {
          const color = (window.getComputedStyle && window.getComputedStyle(c).color) || "";
          return (color || "").toString().trim();
        } catch (e) {
          return "";
        }
      };

      const draw = () => {
        try {
          const canvas = canvasRef && canvasRef.current;
          const analyserNow = vizAnalyserRef.current;
          if (!canvas || !analyserNow) return;

          const g = canvas.getContext("2d");
          if (!g) return;

          const w = canvas.width || canvasWidth || 140;
          const h = canvas.height || canvasHeight || 22;

          analyserNow.getByteTimeDomainData(data);
          g.clearRect(0, 0, w, h);

          let stroke = vizLastColorRef.current || "";
          if (!stroke) stroke = resolveStrokeColor();
          if (stroke) vizLastColorRef.current = stroke;

          g.lineWidth = 1.6;
          g.strokeStyle = stroke || "rgba(120,120,120,0.85)";
          g.beginPath();

          const slice = w / data.length;
          let x = 0;
          for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0;
            const y = (v * h) / 2;
            if (i === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
            x += slice;
          }
          g.lineTo(w, h / 2);
          g.stroke();
        } catch (e) {
          // ignore draw errors
        } finally {
          try {
            vizRafRef.current = window.requestAnimationFrame(draw);
          } catch (e2) {
            vizRafRef.current = 0;
          }
        }
      };

      try {
        if (ctx && typeof ctx.resume === "function") {
          ctx.resume().catch(() => {});
        }
      } catch (e) {}

      vizRafRef.current = window.requestAnimationFrame(draw);
    } catch (e) {
      // ignore
    }
  };

  // =========================
  // Recorder helpers
  // =========================
  const stopStreamIfNeeded = () => {
    try {
      const st = mediaStreamRef.current;
      if (st && typeof st.getTracks === "function") {
        st.getTracks().forEach((tr) => {
          try { tr.stop(); } catch (e) {}
        });
      }
    } catch (e) {
      // ignore
    } finally {
      mediaStreamRef.current = null;
    }
  };

  const resetRecorderRefs = () => {
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startTsRef.current = 0;
  };

  const clearReplayUrl = () => {
    try {
      const au = replayAudioRef.current;
      if (au && typeof au.pause === "function") au.pause();
    } catch (e) {}
    try {
      const prev = replayUrlRef.current;
      if (prev && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(prev);
      }
    } catch (e) {}
    replayUrlRef.current = "";
    setReplayUrl("");
    setReplayMeta((m) => ({ ...(m || {}), durationMs: 0, mimeType: "", error: "" }));
  };

  const start = async () => {
    if (!enabled) return;
    if (!hasSupport) {
      setStatus((p) => ({ ...(p || {}), state: "error", error: "此瀏覽器不支援錄音（MediaRecorder）。" }));
      return;
    }
    if (disabled) return;
    if (loading) return;
    if (!mainSentence) return;

    try {
      setStatus((p) => ({ ...(p || {}), state: "recording", seconds: 0, error: "", lastDurationMs: 0, lastMimeType: "" }));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      try { startViz(stream); } catch (eViz) {}

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      startTsRef.current = Date.now();

      mr.ondataavailable = (ev) => {
        try {
          if (ev && ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
        } catch (e) {}
      };

      mr.onerror = () => {
        setStatus((p) => ({ ...(p || {}), state: "error", error: "錄音發生錯誤，請重試。" }));
        try { stopStreamIfNeeded(); } catch (e) {}
        resetRecorderRefs();
      };

      mr.onstop = () => {
        try {
          const chunks = chunksRef.current || [];
          const mimeType = (mr && mr.mimeType) || (chunks[0] && chunks[0].type) || "audio/webm";
          const blob = new Blob(chunks, { type: mimeType });
          const durMs = Math.max(0, Date.now() - (startTsRef.current || Date.now()));

          // last-only replay url
          clearReplayUrl();
          let nextUrl = "";
          try {
            if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
              nextUrl = URL.createObjectURL(blob);
            }
          } catch (eUrl) { nextUrl = ""; }

          replayUrlRef.current = nextUrl;
          setReplayUrl(nextUrl);
          setReplayMeta((m) => ({ ...(m || {}), durationMs: durMs, mimeType, error: nextUrl ? "" : "Replay URL 產生失敗" }));

          setStatus((p) => ({ ...(p || {}), state: "done", seconds: 0, error: "", lastDurationMs: durMs, lastMimeType: mimeType }));

          if (typeof onAudioReady === "function") {
            try { onAudioReady(mainSentence, blob, { durationMs: durMs, mimeType }); } catch (e) {}
          }
        } catch (e) {
          setStatus((p) => ({ ...(p || {}), state: "error", error: "錄音檔處理失敗，請重試。" }));
        } finally {
          try { stopVizIfNeeded(); } catch (eVizStop) {}
          try { stopStreamIfNeeded(); } catch (e2) {}
          resetRecorderRefs();
        }
      };

      mr.start();
    } catch (e) {
      setStatus((p) => ({ ...(p || {}), state: "error", error: "無法取得麥克風權限或錄音失敗。" }));
      try { stopVizIfNeeded(); } catch (eVizStop) {}
      try { stopStreamIfNeeded(); } catch (e2) {}
      resetRecorderRefs();
    }
  };

  const stop = () => {
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state && mr.state !== "inactive") {
        mr.stop();
        return;
      }
    } catch (e) {}
    // fallback cleanup
    try { stopVizIfNeeded(); } catch (eVizStop) {}
    try { stopStreamIfNeeded(); } catch (e2) {}
    resetRecorderRefs();
    setStatus((p) => ({ ...(p || {}), state: "idle", seconds: 0, error: "" }));
  };

  const toggle = () => {
    if (!enabled) return;
    if (disabled) return;
    if (!hasSupport) {
      setStatus((p) => ({ ...(p || {}), state: "error", error: "此瀏覽器不支援錄音（MediaRecorder）。" }));
      return;
    }
    if (!mainSentence) return;

    if (status && status.state === "recording") stop();
    else start();
  };

  const replay = () => {
    if (!enabled) return;
    if (disabled) return;
    if (loading) return;
    if (!replayUrl) return;

    try {
      let au = replayAudioRef.current;
      if (!au) {
        au = new Audio();
        replayAudioRef.current = au;
      }
      try { au.pause(); au.currentTime = 0; } catch (e) {}
      au.src = replayUrl;
      const p = au.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (e) {}
  };

  // recording timer (UI-only)
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!status || status.state !== "recording") return;
    const t = window.setInterval(() => {
      setStatus((prev) => {
        if (!prev || prev.state !== "recording") return prev;
        return { ...prev, seconds: (prev.seconds || 0) + 1 };
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [enabled, status && status.state]);

  // cleanup on unmount
  useEffect(() => {
    if (!enabled) return;
    return () => {
      try {
        const au = replayAudioRef.current;
        if (au && typeof au.pause === "function") au.pause();
      } catch (e) {}
      try {
        const u = replayUrlRef.current;
        if (u && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(u);
        }
      } catch (e) {}
      replayUrlRef.current = "";
      try { stopVizIfNeeded(); } catch (e) {}
      try { stopStreamIfNeeded(); } catch (e2) {}
      resetRecorderRefs();
    };
  }, [enabled]);

  return {
    hasSupport,
    status,
    replayUrl,
    replayMeta,
    toggle,
    stop,
    start,
    replay,
    stopVizIfNeeded,
    clearReplayUrl,
  };
}

// frontend/src/components/examples/usePronunciationRecorder.js
// END FILE: frontend/src/components/examples/usePronunciationRecorder.js
