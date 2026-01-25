// frontend/src/components/examples/coverage/CoverageOnceControls.jsx (file start)
import React from "react";
import CoverageOnceSentence from "./CoverageOnceSentence";

export default function CoverageOnceControls(props) {
  const {
    variant,
    hasExamples,
    loading,
    enabled,
    onToggle,
    state,
    tokens,
    transcript,
    llm,
  } = props || {};

  if (variant === "toggle") {
    if (!hasExamples) return null;
    return (
      <button
        type="button"
        onClick={() => {
          if (typeof onToggle === "function") onToggle();
        }}
        title={enabled ? "Coverage（ON）" : "Coverage（OFF）"}
        aria-label="example-coverage-once-toggle"
        data-ref="exampleCoverageOnceToggleButton"
        className="icon-button sound-button"
        disabled={!!loading}
        style={{
          border: "none",
          background: "transparent",
          cursor: !!loading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          padding: 0,
          opacity: !!loading ? 0.45 : enabled ? 0.98 : 0.72,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="12" r="2.4" fill="currentColor" />
        </svg>
      </button>
    );
  }

  if (variant === "status") {
    if (!enabled) return null;

    if (state === "processing") {
      return (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
          ASR 分析中…
        </div>
      );
    }

    if (state === "done") {
      const safeTokens = Array.isArray(tokens) ? tokens : [];
      const safeTranscript = (transcript || "").toString();
      const safeLLM = llm || {};
      const hasLLMContent = !!(safeLLM && (safeLLM.feedback || safeLLM.score !== null));

      return (
        <div style={{ marginTop: 6 }}>
          <CoverageOnceSentence tokens={safeTokens} />

          {safeTranscript ? (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78 }}>
              ASR：{safeTranscript}
            </div>
          ) : null}

          {hasLLMContent ? (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
              {typeof safeLLM.score === "number" ? (
                <div style={{ marginBottom: 4 }}>評分：{safeLLM.score}</div>
              ) : null}
              {safeLLM.feedback ? <div>{safeLLM.feedback}</div> : null}
              {safeLLM.error ? (
                <div style={{ marginTop: 4, opacity: 0.72 }}>
                  （LLM：{safeLLM.error}）
                </div>
              ) : null}
            </div>
          ) : safeLLM && safeLLM.error ? (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
              （LLM：{safeLLM.error}）
            </div>
          ) : null}
        </div>
      );
    }

    if (state === "error") {
      return (
        <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>
          Coverage error：{(llm && llm.error) || "ASR_FAILED"}
        </div>
      );
    }

    return null;
  }

  return null;
}
// frontend/src/components/examples/coverage/CoverageOnceControls.jsx (file end)
