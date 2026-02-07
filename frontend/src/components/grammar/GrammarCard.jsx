// frontend/src/components/grammar/GrammarCard.jsx
import { useEffect, useMemo, useRef, useState } from "react";

function GrammarCard({ labels, grammar, onWordClick, onSpeak }) {
  if (!grammar) return null;

  const hasErrors = Array.isArray(grammar.errors) && grammar.errors.length > 0;

  // -----------------------------
  // ✅ tokenHints 小浮層（0 LLM）
  // - 若 grammar.tokenHints[tok] 存在：點詞顯示浮層
  // - 否則：fallback to onWordClick(tok)
  // -----------------------------
  const [hintOpen, setHintOpen] = useState(false);
  const [hintTok, setHintTok] = useState(null);
  const [hintData, setHintData] = useState(null);
  const [hintPos, setHintPos] = useState({ x: 0, y: 0 });
  const hintRef = useRef(null);

  const tokenHints = useMemo(() => {
    // 支援兩種形狀：
    // 1) { "habe": { title, hint, bullets, ruleId, linkable } }
    // 2) [{ token: "habe", ... }, ...]
    const th = grammar?.tokenHints;
    if (!th) return {};
    if (Array.isArray(th)) {
      const map = {};
      for (const it of th) {
        if (it && it.token) map[it.token] = it;
      }
      return map;
    }
    if (typeof th === "object") return th;
    return {};
  }, [grammar]);

  const closeHint = () => {
    setHintOpen(false);
    setHintTok(null);
    setHintData(null);
  };

  useEffect(() => {
    if (!hintOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeHint();
    };

    const onMouseDown = (e) => {
      // 點到浮層外 → 關閉
      const el = hintRef.current;
      if (!el) return;
      if (!el.contains(e.target)) closeHint();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [hintOpen]);

  const handleTokenClick = (tok, e) => {
    const t = tok?.trim?.() ? tok.trim() : tok;
    if (!t) return;

    const h = tokenHints?.[t];
    if (h) {
      // 位置：用點擊座標，避免依賴 layout
      const x = Math.min(window.innerWidth - 280, Math.max(12, e.clientX + 10));
      const y = Math.min(window.innerHeight - 180, Math.max(12, e.clientY + 10));
      setHintPos({ x, y });
      setHintTok(t);
      setHintData(h);
      setHintOpen(true);
      return;
    }

    // fallback：走原本字卡/查字
    if (onWordClick) onWordClick(t);
  };

  const renderClickableText = (text) => {
    if (!text) return null;
    const tokens = text.split(/(\s+|[.,!?;:"()«»„“”])/);
    return tokens.map((tok, idx) => {
      if (!tok.trim()) return tok;
      if (!/[A-Za-zÄÖÜäöüß]/.test(tok)) return tok;

      const hasHint = !!tokenHints?.[tok.trim()];

      return (
        <span
          key={idx}
          onClick={(e) => handleTokenClick(tok, e)}
          title={hasHint ? (labels?.hintTitle || "句型提示") : (labels?.wordTitle || "查看字卡")}
          style={{
            cursor: "pointer",
            textDecoration: hasHint ? "underline" : "underline dotted",
            textUnderlineOffset: 2,
            // 有 hint 的詞稍微更「像可點」
            fontWeight: hasHint ? 600 : undefined,
          }}
        >
          {tok}
        </span>
      );
    });
  };

  // -----------------------------
  // ✅ 可選：句型骨架（structure slots）
  // 支援：
  // grammar.structure.slots = [{ role, text }]
  // 或 grammar.structure = { type, rule, slots, blocks... }
  // -----------------------------
  const structureSlots = useMemo(() => {
    const s = grammar?.structure;
    if (!s) return null;
    const slots = Array.isArray(s.slots) ? s.slots : null;
    if (!slots || slots.length === 0) return null;
    return { ...s, slots };
  }, [grammar]);

  const renderStructure = () => {
    if (!structureSlots) return null;

    const ruleText = structureSlots.rule || structureSlots.type;
    return (
      <div
        style={{
          marginBottom: 12,
          padding: 10,
          borderRadius: 10,
          background: "var(--card-subtle-bg)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
          <strong>{labels?.structureTitle || "句型骨架"}</strong>
          {ruleText ? (
            <span style={{ marginLeft: 8 }}>
              · <span style={{ opacity: 0.9 }}>{ruleText}</span>
            </span>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
          }}
        >
          {structureSlots.slots.map((sl, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: "var(--card-bg)",
                fontSize: 12,
              }}
            >
              {sl.role ? (
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                  {sl.role}
                </span>
              ) : null}
              <span>{renderClickableText(sl.text)}</span>
            </span>
          ))}
        </div>
      </div>
    );
  };

  // -----------------------------
  // ✅ hint popover
  // -----------------------------
  const renderHintPopover = () => {
    if (!hintOpen || !hintTok || !hintData) return null;

    const title = hintData.title || hintTok;
    const hint = hintData.hint || hintData.text || hintData.explanation || "";
    const bullets = Array.isArray(hintData.bullets) ? hintData.bullets : null;
    const ruleId = hintData.ruleId || hintData.rule_id || null;

    const canLinkToWordCard =
      hintData.linkable === true ||
      hintData.openWordCard === true ||
      hintData.kind === "verb" ||
      hintData.kind === "conjunction"; // 保守給一個預設行為

    return (
      <div
        ref={hintRef}
        style={{
          position: "fixed",
          left: hintPos.x,
          top: hintPos.y,
          width: 270,
          zIndex: 9999,
          background: "var(--card-bg)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
          padding: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{title}</div>
          <button
            type="button"
            onClick={closeHint}
            aria-label="close"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ✕
          </button>
        </div>

        {ruleId ? (
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
            {labels?.ruleIdLabel || "規則"}：{ruleId}
          </div>
        ) : null}

        {hint ? (
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45 }}>
            {hint}
          </div>
        ) : null}

        {bullets && bullets.length > 0 ? (
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.45 }}>
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : null}

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canLinkToWordCard && onWordClick ? (
            <button
              type="button"
              onClick={() => {
                closeHint();
                onWordClick(hintTok);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: "var(--card-subtle-bg)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {labels?.openWordCard || "查看字卡"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={closeHint}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            {labels?.close || "關閉"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        marginTop: 20,
        padding: 14,
        borderRadius: 14,
        background: "var(--card-bg)",
        border: "1px solid var(--border-subtle)",
        position: "relative",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: 8,
          color: "var(--text-main)",
        }}
      >
        {labels.title}
      </div>

      {/* ✅ 句型骨架（有資料才顯示） */}
      {renderStructure()}

      {grammar.overallComment && (
        <div style={{ marginBottom: 10, fontSize: 14 }}>
          {grammar.overallComment}
        </div>
      )}

      {hasErrors &&
        grammar.errors.map((err, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              borderRadius: 8,
              background: "var(--card-subtle-bg)",
              border: "1px solid var(--border-subtle)",
              marginBottom: 12,
            }}
          >
            {/* 原句 */}
            {err.original && (
              <div
                style={{
                  fontSize: 13,
                  marginBottom: 4,
                  color: "var(--text-muted)",
                }}
              >
                <strong>{labels.labelOriginal}：</strong>{" "}
                {renderClickableText(err.original)}
              </div>
            )}

            {/* 建議句 + ▶ 播放 */}
            {err.suggestion && (
              <div
                style={{
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 4,
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <strong>{labels.labelSuggestion}：</strong>{" "}
                {renderClickableText(err.suggestion)}
                {onSpeak && (
                  <button
                    type="button"
                    onClick={() => onSpeak(err.suggestion)}
                    title="播放建議句發音"
                    className="sound-play-button"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <polygon points="7,5 7,19 19,12" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* 說明 */}
            {err.explanation && (
              <div style={{ marginTop: 6, fontSize: 13 }}>
                <strong>{labels.labelExplanation}：</strong>{" "}
                {err.explanation}
              </div>
            )}
          </div>
        ))}

      {/* ✅ 小浮層（固定在 viewport） */}
      {renderHintPopover()}
    </div>
  );
}

export default GrammarCard;
// frontend/src/components/grammar/GrammarCard.jsx
