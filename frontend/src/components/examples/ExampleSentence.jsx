import React, { useEffect, useMemo, useState } from "react";

// ----------------------------------------------------------------------------
// NOTE
// - This file is intentionally kept verbose and additive.
// - DO NOT remove legacy blocks unless explicitly asked.
// ----------------------------------------------------------------------------

const MOSAIC_LINE = "----------------------------";

const EyeIconOpen = () => (
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

const EyeIconClosed = () => (
  <svg
    className="eye-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M12 5C7 5 3.2 8 1.5 12 3.2 16 7 19 12 19s8.8-3 10.5-7C20.8 8 17 5 12 19s8.8-3 10.5-7C20.8 8 17 5 12 5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <line
      x1="4"
      y1="4"
      x2="20"
      y2="20"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
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

  const safeHeadword = useMemo(() => {
    const hw = (headword || "").toString().trim();
    return hw ? hw : "not available";
  }, [headword]);

  const hasHeadword = safeHeadword !== "not available";

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
    if (onSpeak && typeof onSpeak === "function") {
      onSpeak(mainSentence);
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

  const renderTranslation = () => {
    if (!exampleTranslation) return null;
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

  return (
    <>
      {/* ✅ 2026-01-10：先拆 div（Confirm Row）
          - DEPRECATED 2026-01-10: 需求改為「確認」要在 toggle 右側同一列
          - 保留原碼避免行數減少；預設不 render，避免畫面出現兩個「確認」
      */}
      {(() => {
        const __DEPRECATED_SHOW_CONFIRM_ROW = false;
        if (!__DEPRECATED_SHOW_CONFIRM_ROW) return null;
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
            </button>
          ) : (
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
        {hasExamples && onSpeak && (
          <button
            type="button"
            onClick={handleSpeakSentence}
            title="播放語音"
            className="icon-button sound-button"
          >
            <svg
              className="sound-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <polygon points="10,8 10,16 16,12" />
            </svg>
          </button>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            title={refreshTooltip}
            className="example-refresh-button"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
          >
            <svg
              className="example-refresh-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                stroke="none"
                d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.07-.28 2.07-.77 2.94l1.46 1.46A7.932 7.932 0 0020 12c0-4.42-3.58-8-8-8zm-6.69.69L3.85 6.15A7.932 7.932 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-1.07.28-2.07.77-2.94z"
              />
            </svg>
          </button>
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
        </div>
      )}

      {/* 翻譯 ＋ 眼睛切換 */}
      {exampleTranslation && (
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
    </>
  );
}
// frontend/src/components/examples/ExampleSentence.jsx (file end)
