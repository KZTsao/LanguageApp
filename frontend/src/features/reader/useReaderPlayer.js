// frontend/src/features/reader/useReaderPlayer.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * useReaderPlayer
 * - 逐句音檔播放（每句一檔）
 * - 自動前進 / 上一句 / 下一句
 * - 句子跨頁時：呼叫 onPageChange(nextPageNo)
 *
 * sentences: Array<{ idx?: number, page_no: number, text: string, audio_url: string }>
 */
export default function useReaderPlayer({
  sentences,
  initialSentenceIdx = 0,
  autoAdvance = false,
  onSentenceChange,
  onPageChange,
  onError,
} = {}) {
  const list = Array.isArray(sentences) ? sentences : [];

  const [currentIdx, setCurrentIdx] = useState(
    Number.isFinite(initialSentenceIdx) ? initialSentenceIdx : 0
  );
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef(null);
  const pendingPlayRef = useRef(false);

  const clampIdx = useCallback(
    (i) => {
      const n = Number(i);
      if (!Number.isFinite(n) || Number.isNaN(n)) return 0;
      if (list.length <= 0) return 0;
      if (n < 0) return 0;
      if (n >= list.length) return list.length - 1;
      return n;
    },
    [list.length]
  );

  const current = useMemo(() => {
    const i = clampIdx(currentIdx);
    return list[i] || null;
  }, [list, currentIdx, clampIdx]);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    try {
      const a = new Audio();
      a.preload = "auto";
      audioRef.current = a;
      return a;
    } catch (e) {
      audioRef.current = null;
      return null;
    }
  }, []);

  const emitError = useCallback(
    (e) => {
      try {
        if (typeof onError === "function") onError(e);
      } catch {}
    },
    [onError]
  );

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (!a) {
      setIsPlaying(false);
      return;
    }
    try {
      a.pause();
      a.currentTime = 0;
    } catch {}
    pendingPlayRef.current = false;
    setIsPlaying(false);
  }, []);

  const loadAndMaybePlay = useCallback(
    async (idx, shouldPlay) => {
      const nextIdx = clampIdx(idx);
      const next = list[nextIdx] || null;

      setCurrentIdx(nextIdx);

      try {
        if (typeof onSentenceChange === "function") onSentenceChange(next, nextIdx);
      } catch {}

      // page change hook（句子跨頁 → UI 翻頁）
      try {
        const nextPageNo = next && typeof next.page_no === "number" ? next.page_no : null;
        const curPageNo = current && typeof current.page_no === "number" ? current.page_no : null;
        if (nextPageNo != null && curPageNo != null && nextPageNo !== curPageNo) {
          if (typeof onPageChange === "function") onPageChange(nextPageNo, curPageNo);
        }
      } catch {}

      const a = ensureAudio();
      if (!a) {
        emitError(new Error("[readerPlayer] audio element init failed"));
        setIsPlaying(false);
        return;
      }

      const src = next && next.audio_url ? String(next.audio_url) : "";
      if (!src) {
        emitError(new Error("[readerPlayer] sentence audio_url missing"));
        setIsPlaying(false);
        return;
      }

      try {
        // 先 stop 舊音
        try {
          a.pause();
        } catch {}

        a.src = src;
        a.currentTime = 0;

        if (shouldPlay) {
          pendingPlayRef.current = true;
          const p = a.play();
          if (p && typeof p.then === "function") {
            await p;
          }
          setIsPlaying(true);
        } else {
          pendingPlayRef.current = false;
          setIsPlaying(false);
        }
      } catch (e) {
        pendingPlayRef.current = false;
        setIsPlaying(false);
        emitError(e);
      }
    },
    [
      clampIdx,
      list,
      ensureAudio,
      emitError,
      onSentenceChange,
      onPageChange,
      current,
    ]
  );

  const play = useCallback(async () => {
    if (!current) return;
    await loadAndMaybePlay(currentIdx, true);
  }, [current, currentIdx, loadAndMaybePlay]);

  const pause = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
      } catch {}
    }
    pendingPlayRef.current = false;
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(async () => {
    if (isPlaying) {
      pause();
      return;
    }
    await play();
  }, [isPlaying, pause, play]);

  const goTo = useCallback(
    async (idx, { autoplay } = {}) => {
      await loadAndMaybePlay(idx, !!autoplay);
    },
    [loadAndMaybePlay]
  );

  const next = useCallback(async () => {
    const ni = clampIdx(currentIdx + 1);
    await loadAndMaybePlay(ni, true);
  }, [clampIdx, currentIdx, loadAndMaybePlay]);

  const prev = useCallback(async () => {
    const pi = clampIdx(currentIdx - 1);
    await loadAndMaybePlay(pi, true);
  }, [clampIdx, currentIdx, loadAndMaybePlay]);

  // 綁 ended：自動前進
  useEffect(() => {
    const a = ensureAudio();
    if (!a) return;

    const onEnded = () => {
      setIsPlaying(false);
      if (!autoAdvance) return;
      const i = clampIdx(currentIdx + 1);
      // 末尾：停止
      if (i === clampIdx(currentIdx) && i === list.length - 1) return;
      // 自動下一句
      loadAndMaybePlay(i, true);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      // 某些瀏覽器會在 src 切換時觸發 pause；用 pendingPlayRef 避免閃爍
      if (pendingPlayRef.current) return;
      setIsPlaying(false);
    };

    const onErr = () => {
      pendingPlayRef.current = false;
      setIsPlaying(false);
      emitError(new Error("[readerPlayer] audio playback error"));
    };

    a.addEventListener("ended", onEnded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("error", onErr);

    return () => {
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("error", onErr);
    };
  }, [
    ensureAudio,
    autoAdvance,
    clampIdx,
    currentIdx,
    list.length,
    loadAndMaybePlay,
    emitError,
  ]);

  // 外部 sentences 變動：修正 idx
  useEffect(() => {
    setCurrentIdx((prev) => clampIdx(prev));
  }, [list.length, clampIdx]);

  return {
    // state
    currentIdx: clampIdx(currentIdx),
    currentSentence: current,
    isPlaying,

    // controls
    play,
    pause,
    toggle,
    stop,
    next,
    prev,
    goTo,
    setCurrentIdx: (i) => setCurrentIdx(clampIdx(i)),
  };
}
