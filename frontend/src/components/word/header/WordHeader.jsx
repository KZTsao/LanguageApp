// frontend/src/components/word/header/WordHeader.jsx

/**
 * 文件說明：
 * - WordHeader：字卡最上方標題區（冠詞/單字/發音按鈕 + 詞性資訊）
 *
 * 需求對齊（20260117 多詞性壞掉 / POS Pill Spec 延伸）：
 * - POS pill 必須可點擊，不能是 display-only
 * - 點擊要完整往上傳（onSelectPosKey）
 * - POS 顯示文字需多國（來源 uiText）
 * - pill 外匡要保留（未選取也要有 border）
 * - 亮/暗版顏色由 CSS tokens 處理（本檔不做 CSS）
 *
 * 注意：
 * - 本檔只負責「UI 事件」與「顯示文字多國化」
 * - 真正的 state mutation / re-query 必須在 App.jsx handler 內完成（你 spec 已定）
 */

import { playTTS } from "../../../utils/ttsClient";
import uiText from "../../../uiText"; // ✅ 正確：src/components/word/header -> src/uiText.js

// ✅ 可選 debug：只在 window.__DEBUG_WORDHEADER__ = true 時印一次
let __WORDHEADER_DEBUG_INIT_DONE__ = false;
function debugWordHeaderInitOnce(props) {
  try {
    if (typeof window === "undefined") return;
    if (!window.__DEBUG_WORDHEADER__) return;
    if (__WORDHEADER_DEBUG_INIT_DONE__) return;
    __WORDHEADER_DEBUG_INIT_DONE__ = true;
    console.log("[WordHeader][init]", {
      hasPosOptions: Array.isArray(props?.posOptions),
      posOptionsLen: Array.isArray(props?.posOptions) ? props.posOptions.length : 0,
      hasOnSelectPosKey: typeof props?.onSelectPosKey === "function",
      activePosKey: props?.activePosKey || null,
      uiLang: props?.uiLang || null,
      hasFavoriteCategorySelectNode: !!props?.favoriteCategorySelectNode,
    });
  } catch {
    // noop
  }
}

/**
 * ✅ POS 多國顯示（來源 uiText）
 * - 顯示：uiText[uiLang].wordCard.posLocalNameMap[posKey]
 * - fallback：沒有 map 或沒有 key → 回 posKey（例如 Adjektiv / Adverb）
 */
function getPosLabel(uiLang, posKey) {
  const k = String(posKey || "").trim();
  if (!k) return "";
  const lang = uiLang || "zh-TW";
  const map = uiText?.[lang]?.wordCard?.posLocalNameMap;
  if (map && typeof map === "object" && map[k]) return String(map[k]);
  return k;
}

// 第一行：冠詞 + 單字 + 喇叭
function WordHeaderMainLine({ article, headword, articleColor, headerSpeakText, onWordClick }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {article && (
        <span
          onClick={() => onWordClick(article)}
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: articleColor,
            cursor: "pointer",
            textShadow: "var(--text-outline)",
          }}
        >
          {article}
        </span>
      )}

      <span
        onClick={() => onWordClick(headword)}
        style={{
          fontSize: 24,
          fontWeight: 700,
          cursor: "pointer",
          textShadow: "var(--text-outline)",
        }}
      >
        {headword}
      </span>

      {/* ▶ 播放單字發音 */}
      <button
        onClick={() => playTTS(headerSpeakText, "de-DE")}
        className="icon-button sound-button"
        title={`朗讀「${headerSpeakText}」`}
      >
        <svg
          className="sound-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <polygon points="10,8 10,16 16,12" />
        </svg>
      </button>
    </div>
  );
}

// 第二行：詞性（多詞性 pills + fallback 文字）
function WordHeaderMetaLine({ posDisplay, posOptions, onSelectPosKey, activePosKey, uiLang }) {
  const safePosOptions = Array.isArray(posOptions)
    ? posOptions.map((x) => String(x || "").trim()).filter(Boolean)
    : null;

  const hasInteractivePosSwitch =
    Array.isArray(safePosOptions) &&
    safePosOptions.length > 1 &&
    typeof onSelectPosKey === "function";

  // ✅ fallback 純文字也要走 uiText
  const posOptionsText =
    safePosOptions && safePosOptions.length > 1
      ? safePosOptions.map((k) => getPosLabel(uiLang, k)).join(" / ")
      : null;

  if (!posDisplay && !posOptionsText) return null;

  const handlePosClick = (posKey) => {
    // ✅ 保留 log（方便 debug），但不是 only-log：一定會呼叫 handler
    console.log("[WordHeader][posSwitch] clicked", posKey);
    try {
      if (typeof onSelectPosKey === "function") onSelectPosKey(posKey);
    } catch (e) {
      console.warn("[WordHeader][posSwitch] onSelectPosKey failed", e);
    }
  };

  return (
    <div
      style={{
        color: "var(--text-muted)",
        marginBottom: 8,
        fontSize: 13,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {/* 既有：單一詞性（向下相容）
         注意：posDisplay 來源在上游；若要連這個也多國化，需改上游產生點（非本檔範圍） */}
      {!!posDisplay && <div>{posDisplay}</div>}

      {/* ✅ 多詞性：互動 pills（外匡永遠保留） */}
      {!!hasInteractivePosSwitch && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
            opacity: 0.95,
          }}
        >
          {safePosOptions.map((posKey) => {
            const isActive = !!activePosKey && String(activePosKey) === String(posKey);

            // ✅ 外匡保留：未選取也套 .pos-pill（border 永遠存在）
            // ✅ 亮/暗版顏色：交給 index.css 的 tokens
            const cls = `icon-button pos-pill${isActive ? " pos-pill--active" : ""}`;

            const label = getPosLabel(uiLang, posKey);
            const title = label === posKey ? label : `${label} (${posKey})`;

            return (
              <button
                key={posKey}
                type="button"
                onClick={() => handlePosClick(posKey)}
                className={cls}
                title={title}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ✅ 多詞性：純文字 fallback（一樣走 uiText） */}
      {!!posOptionsText && !hasInteractivePosSwitch && (
        <div style={{ opacity: 0.9 }}>{posOptionsText}</div>
      )}
    </div>
  );
}

// 外層組合元件
function WordHeader({
  article,
  headword,
  articleColor,
  headerSpeakText,
  posDisplay,
  onWordClick,

  posOptions,
  onSelectPosKey,
  activePosKey,

  // ✅ 新增：用來決定 uiText 語系（由 App/上游傳入）
  uiLang,

  // ✅ slot
  favoriteCategorySelectNode,
}) {
  debugWordHeaderInitOnce({
    posOptions,
    onSelectPosKey,
    activePosKey,
    uiLang,
    favoriteCategorySelectNode,
  });

  return (
    <>
      {!!favoriteCategorySelectNode && (
        <div
          data-ref="wordHeaderFavoriteCategorySlot"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          {favoriteCategorySelectNode}
        </div>
      )}

      <WordHeaderMainLine
        article={article}
        headword={headword}
        articleColor={articleColor}
        headerSpeakText={headerSpeakText}
        onWordClick={onWordClick}
      />

      <WordHeaderMetaLine
        posDisplay={posDisplay}
        posOptions={posOptions}
        onSelectPosKey={onSelectPosKey}
        activePosKey={activePosKey}
        uiLang={uiLang}
      />

      <div
        style={{
          height: 1,
          background: "linear-gradient(to right, transparent, var(--border-subtle), transparent)",
          marginBottom: 10,
        }}
      />
    </>
  );
}

export default WordHeader;

// frontend/src/components/word/header/WordHeader.jsx
