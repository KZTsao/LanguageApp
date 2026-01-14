// frontend/src/components/WordHeader.jsx

/**
 * 文件說明：
 * - WordHeader：字卡最上方標題區（冠詞/單字/發音按鈕 + 詞性資訊）
 *
 * 異動紀錄：
 * - 2026-01-05：Step 6（只顯示，不做互動）
 *   - 新增支援 posOptions（多詞性清單）顯示：例如 "Adverb / Adjektiv"
 *   - 保留既有 posDisplay 行為（向下相容）
 * - 2026-01-06：Step 4-1（詞性切換：只打通點擊事件，不做 re-query）
 *   - 新增 onSelectPosKey / activePosKey（可選）
 *   - posOptions >= 2 時以「可點擊 pills」呈現，點擊會 console.log 並呼叫 onSelectPosKey（若有）
 *   - 保留舊的 "Adverb / Adjektiv" 純文字顯示作為 fallback（向下相容）
 *
 * - 2026-01-13：Task 1（收藏分類下拉搬移：打通 slot）
 *   - 新增 favoriteCategorySelectNode（可選，ReactNode）
 *   - 若父層傳入，會渲染於 WordHeader 主行區塊上方
 *   - 注意：本檔案不直接依賴 FavoriteStar；下一步由父層（WordCard）把星號與下拉做同欄位垂直堆疊
 *
 * 功能初始化狀態（Production 排查）：
 * - （本檔案不依賴 env）
 * - 若要觀察點擊事件：請在父層傳入 onSelectPosKey，並用 DevTools Console 觀察：
 *   - [WordHeader][posSwitch] clicked <POS>
 * - 若要觀察 props：React DevTools 檢查 WordHeader 的 posOptions / activePosKey / onSelectPosKey
 */

// frontend/src/components/WordHeader.jsx
import { playTTS } from "../../../utils/ttsClient";

// ✅ Step 4-1：可選的 debug 開關（不影響 production，只有開啟才印）
let __WORDHEADER_DEBUG_INIT_DONE__ = false;
function debugWordHeaderInitOnce(props) {
  // 中文功能說明：僅供 Production 排查，預設不輸出
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
      // 2026-01-13 Task 1：新增 slot（僅 debug 顯示是否存在）
      hasFavoriteCategorySelectNode: !!props?.favoriteCategorySelectNode,
    });
  } catch (e) {
    // noop
  }
}

// 第一行：冠詞 + 單字 + 喇叭
function WordHeaderMainLine({
  article,
  headword,
  articleColor,
  headerSpeakText,
  onWordClick,
}) {
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
            color: articleColor, // 性別顏色
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

      {/* ▶ 播放單字發音（改成 playTTS） */}
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
          {/* 外圈圓形 */}
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          {/* 置中的三角形 */}
          <polygon points="10,8 10,16 16,12" />
        </svg>
      </button>
    </div>
  );
}

// 第二行：詞性
function WordHeaderMetaLine({ posDisplay, posOptions, onSelectPosKey, activePosKey }) {
  /**
   * 中文功能說明（Step 6 / Step 4-1）：
   * - posDisplay：既有單一詞性顯示（保持不變）
   * - posOptions：新增「多詞性清單」顯示（向下相容）
   * - onSelectPosKey：Step 4-1 新增（可選），若存在則 posOptions 以可點擊 pills 呈現
   * - activePosKey：Step 4-1 新增（可選），用來標示當前詞性（僅 UI 狀態；Step 4-1 不做 re-query）
   */
  const safePosOptions = Array.isArray(posOptions)
    ? posOptions.map((x) => String(x || "").trim()).filter(Boolean)
    : null;

  const posOptionsText =
    safePosOptions && safePosOptions.length > 1
      ? safePosOptions.join(" / ")
      : null;

  const hasInteractivePosSwitch =
    Array.isArray(safePosOptions) &&
    safePosOptions.length > 1 &&
    typeof onSelectPosKey === "function";

  if (!posDisplay && !posOptionsText) return null;

  const handlePosClick = (posKey) => {
    // 中文功能說明：Step 4-1 只做「事件打通」，不做任何資料 re-fetch
    console.log("[WordHeader][posSwitch] clicked", posKey);
    try {
      if (typeof onSelectPosKey === "function") {
        onSelectPosKey(posKey);
      }
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
      {/* 既有：單一詞性（向下相容） */}
      {!!posDisplay && <div>{posDisplay}</div>}

      {/* Step 4-1：多詞性清單（互動 pills；只打通點擊事件） */}
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
          {safePosOptions.map((k) => {
            const isActive = !!activePosKey && String(activePosKey) === String(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => handlePosClick(k)}
                className="icon-button"
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  lineHeight: "16px",
                  border: "1px solid var(--border-subtle)",
                  background: isActive ? "var(--panel-bg)" : "transparent",
                  cursor: "pointer",
                }}
                title={k}
              >
                {k}
              </button>
            );
          })}
        </div>
      )}

      {/* Step 6：多詞性清單（純文字 fallback；向下相容） */}
      {!!posOptionsText && !hasInteractivePosSwitch && (
        <div style={{ opacity: 0.9 }}>
          {/* DEPRECATED（2026-01-05 Step 6）：如果未來要做互動切換，這裡改成 button/badge */}
          {posOptionsText}
        </div>
      )}
    </div>
  );
}

// 外層組合元件：兩行 + 分隔線
function WordHeader({
  article,
  headword,
  articleColor,
  headerSpeakText,
  posDisplay,
  onWordClick,
  posOptions, // ✅ Step 6：新增（多詞性清單，僅顯示）
  onSelectPosKey, // ✅ Step 4-1：新增（可選，點擊事件回呼）
  activePosKey, // ✅ Step 4-1：新增（可選，用於 UI active 標示）

  // ✅ 2026-01-13 Task 1：收藏分類下拉 slot（由父層傳入 JSX）
  favoriteCategorySelectNode,
}) {
  // ✅ Step 4-1：初始化 debug（可選）
  debugWordHeaderInitOnce({ posOptions, onSelectPosKey, activePosKey, favoriteCategorySelectNode });

  return (
    <>
      {/* 2026-01-13 Task 1：
          中文功能說明：父層可傳入「收藏分類下拉」的 JSX，
          用來在字卡 header 區域內排版（下一步會與 FavoriteStar 同欄位垂直堆疊）
      */}
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
      />

      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right, transparent, var(--border-subtle), transparent)",
          marginBottom: 10,
        }}
      />
    </>
  );
}

export default WordHeader;

// frontend/src/components/WordHeader.jsx
