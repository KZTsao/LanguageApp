// frontend/src/features/reader/ReaderView.jsx
import React, { useMemo, useState } from "react";
import useReaderPlayer from "./useReaderPlayer";
import ReaderSentence from "./ReaderSentence";

/**
 * ReaderView（最小可跑 demo）
 * - props: pages=[{page_no,image_url}], sentences=[{page_no,text,audio_url}]
 * - 先不接 router / api，讓你能快速落地驗證播放器狀態機
 */
export default function ReaderView({ pages, sentences } = {}) {
  const pageList = Array.isArray(pages) ? pages : [];
  const sentList = Array.isArray(sentences) ? sentences : [];

  const [pageNo, setPageNo] = useState(() => {
    const s0 = sentList[0];
    return s0 && typeof s0.page_no === "number" ? s0.page_no : 1;
  });

  const page = useMemo(() => {
    return pageList.find((p) => p && p.page_no === pageNo) || null;
  }, [pageList, pageNo]);

  const pageSentences = useMemo(() => {
    return sentList.filter((s) => s && s.page_no === pageNo);
  }, [sentList, pageNo]);

  // map page-local index to global index
  const pageStartGlobalIdx = useMemo(() => {
    const first = pageSentences[0];
    if (!first) return 0;
    const i = sentList.indexOf(first);
    return i >= 0 ? i : 0;
  }, [pageSentences, sentList]);

  const player = useReaderPlayer({
    sentences: sentList,
    initialSentenceIdx: 0,
    autoAdvance: true,
    onPageChange: (nextPage) => setPageNo(nextPage),
  });

  const canPrevPage = useMemo(() => pageList.some((p) => p && p.page_no === pageNo - 1), [pageList, pageNo]);
  const canNextPage = useMemo(() => pageList.some((p) => p && p.page_no === pageNo + 1), [pageList, pageNo]);

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "stretch", width: "100%" }}>
      <div
        style={{
          flex: "0 0 min(44vw, 520px)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10 }}>
          <button
            type="button"
            disabled={!canPrevPage}
            onClick={() => setPageNo((p) => Math.max(1, p - 1))}
            style={{ padding: "6px 10px", borderRadius: 12 }}
          >
            ◀
          </button>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Page {pageNo}</div>
          <button
            type="button"
            disabled={!canNextPage}
            onClick={() => setPageNo((p) => p + 1)}
            style={{ padding: "6px 10px", borderRadius: 12 }}
          >
            ▶
          </button>

          <div style={{ flex: 1 }} />

          <button type="button" onClick={player.prev} style={{ padding: "6px 10px", borderRadius: 12 }}>
            上一句
          </button>
          <button type="button" onClick={player.toggle} style={{ padding: "6px 10px", borderRadius: 12 }}>
            {player.isPlaying ? "暫停" : "播放"}
          </button>
          <button type="button" onClick={player.next} style={{ padding: "6px 10px", borderRadius: 12 }}>
            下一句
          </button>
        </div>

        <div style={{ width: "100%", aspectRatio: "3 / 4", background: "rgba(255,255,255,0.02)" }}>
          {page && page.image_url ? (
            <img
              src={page.image_url}
              alt={`page-${pageNo}`}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <div style={{ padding: 14, opacity: 0.7, fontSize: 13 }}>（此頁尚未設定 image_url）</div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 13, opacity: 0.75, padding: "2px 4px 10px" }}>
          點句子播放；自動播放會自動跨頁（依 sentence.page_no）
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", paddingRight: 4 }}>
          {pageSentences.map((s, i) => {
            const globalIdx = pageStartGlobalIdx + i;
            const active = player.currentIdx === globalIdx;
            return (
              <ReaderSentence
                key={`${pageNo}__${i}`}
                sentence={s}
                index={globalIdx}
                active={active}
                onClick={(_, idx) => player.goTo(idx, { autoplay: true })}
              />
            );
          })}
          {pageSentences.length === 0 ? (
            <div style={{ padding: 14, opacity: 0.7, fontSize: 13 }}>（此頁沒有句子）</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
