// frontend/src/features/library/components/FavoriteCategoryManager.jsx
import React from "react";

/**
 * FavoriteCategoryManager.jsx
 * ✅ B2 任務：收藏分類（學習本）管理 UI（DB-backed）
 *
 * - 由上層（useLibraryController）提供 CRUD handlers
 * - 本元件不做 optimistic update：操作後呼叫 handler → 上層 reload categories
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - categories: Array<{ id: string|number, name: string, order_index: number }>
 * - onCreate: (name: string) => Promise<{ok:boolean,...}> | {ok:boolean,...}
 * - onRename: (id: number, name: string) => Promise<{ok:boolean,...}> | {ok:boolean,...}
 * - onReorder: (ids: number[]) => Promise<{ok:boolean,...}> | {ok:boolean,...}
 * - onArchive: (id: number) => Promise<{ok:boolean,...}> | {ok:boolean,...}
* - onImportCategory: ({ id, name }) => void  // 指定分類匯入
 * - isSaving: boolean
 * - errorText: string
 * - t: (optional) WordLibraryPanel 的 t（子元件不做 uiText 解析）
 *
 * 異動紀錄（只追加，不刪除）：
 * - 2026-01-16：
 *   ✅ B1 UI polish：按鈕改成 icon 工具按鈕（不靠文字）
 *   - close/add/up/down 全改為 icon（吃 currentColor，亮暗版自動）
 *   - aria-label / title 仍沿用 t.* fallback
 *   - disabled 明確（opacity/cursor），不做暈光
 *
 * - 2026-01-17：
 *   ✅ B1 UI style unify（本任務）：管理分類 modal 視覺與單字庫一致（亮/暗版）
 *   - 移除厚重 inline style → 改成 className + theme tokens（CSS variables）
 *   - Overlay：亮版淡、暗版稍深但不糊成黑洞
 *   - Panel：卡片式 surface / 細邊線 / 柔陰影 / 中等圓角 / 一致 padding
 *   - Header/Close：hit area >= 36px，hover 僅顏色/背景微變化，無 glow
 *   - Row/Input：高度/圓角一致，focus ring 細且乾淨（無外發光暈色）
 */

// ✅ 共用工具 icon button + icons
import ToolIconButton from "../../../components/common/ToolIconButton";
import {
  SlidersIcon,
  PlusIcon,
  XIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "../../../components/icons/ToolIcons";

/**
 * ✅ UI-only：內嵌樣式（避免你還要新增/搬 CSS 檔）
 * 原則：
 * - 優先吃既有 theme tokens（index.css 內的 CSS variables）
 * - 不硬寫死顏色（必要時提供 fallback）
 * - 亮/暗版都清楚；hover/focus/disabled 無霓虹暈光
 *
 * 兼容常見 dark mode selector：
 * - body.dark / .dark
 * - [data-theme="dark"]
 * - .theme-dark
 */
const FAVORITE_CATEGORY_MANAGER_CSS = `
/* ===== FavoriteCategoryManager (UI-only) ===== */
.fcm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  /* light default */
  background: rgba(0,0,0,0.35);
}

body.dark .fcm-overlay,
.dark .fcm-overlay,
[data-theme="dark"] .fcm-overlay,
.theme-dark .fcm-overlay {
  background: rgba(0,0,0,0.55);
}

.fcm-panel {
  width: min(720px, 96vw);
  max-height: 80vh;
  overflow: auto;

  /* ✅ card-like */
  background: var(--card-bg, rgba(255,255,255,0.96));
  color: inherit;
  border: 1px solid var(--border-subtle, rgba(0,0,0,0.12));
  border-radius: 14px;
  padding: 16px;

  /* ✅ soft shadow */
  box-shadow:
    0 10px 30px rgba(0,0,0,0.14),
    0 2px 10px rgba(0,0,0,0.10);
}

body.dark .fcm-panel,
.dark .fcm-panel,
[data-theme="dark"] .fcm-panel,
.theme-dark .fcm-panel {
  /* dark surface (non-pure black) */
  background: var(--card-bg, rgba(28,28,30,0.96));
  border-color: var(--border-subtle, rgba(255,255,255,0.12));
  box-shadow:
    0 14px 34px rgba(0,0,0,0.35),
    0 2px 10px rgba(0,0,0,0.24);
}

.fcm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.fcm-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text, inherit);
}

.fcm-titleIcon {
  display: inline-flex;
  color: var(--text-muted, currentColor);
}

.fcm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.fcm-count {
  font-size: 12px;
  color: var(--text-muted, rgba(0,0,0,0.55));
}

.fcm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fcm-row {
  display: flex;
  align-items: center;
  gap: 8px;

  padding: 10px 10px;
  border-radius: 12px;

  border: 1px solid var(--border-subtle, rgba(0,0,0,0.10));
  background: transparent;
}

.fcm-row:hover {
  /* ✅ hover only: subtle background change (no glow) */
  background: var(--accent-soft, rgba(0,0,0,0.04));
}

body.dark .fcm-row:hover,
.dark .fcm-row:hover,
[data-theme="dark"] .fcm-row:hover,
.theme-dark .fcm-row:hover {
  background: var(--accent-soft, rgba(255,255,255,0.06));
}

.fcm-nameWrap {
  flex: 1;
  min-width: 0;
}

.fcm-nameBtn {
  width: 100%;
  text-align: left;

  border: none;
  background: transparent;
  padding: 0;

  cursor: text;

  font-size: 13px;
  line-height: 1.2;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  color: var(--text, inherit);
}

.fcm-nameBtn:hover {
  /* ✅ only color change */
  color: var(--text, inherit);
  opacity: 0.92;
}

.fcm-editWrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fcm-input {
  width: 100%;
  height: 32px;               /* ✅ unified height */
  font-size: 13px;

  padding: 6px 10px;
  border-radius: 10px;        /* ✅ slightly smaller than panel */
  border: 1px solid var(--border-subtle, rgba(0,0,0,0.16));
  background: var(--input-bg, rgba(0,0,0,0.02));
  color: var(--text, inherit);

  outline: none;
  box-shadow: none;
}

/* ✅ clean focus ring: thin, no glow */
.fcm-input:focus {
  border-color: var(--accent, rgba(0,0,0,0.24));
  box-shadow: 0 0 0 2px var(--accent-soft, rgba(0,0,0,0.06));
}

body.dark .fcm-input:focus,
.dark .fcm-input:focus,
[data-theme="dark"] .fcm-input:focus,
.theme-dark .fcm-input:focus {
  border-color: var(--accent, rgba(255,255,255,0.22));
  box-shadow: 0 0 0 2px var(--accent-soft, rgba(255,255,255,0.08));
}

.fcm-error {
  font-size: 12px;
  color: var(--text, inherit);
  opacity: 0.86;
}

.fcm-empty {
  font-size: 12px;
  color: var(--text-muted, rgba(0,0,0,0.55));
  padding: 10px;
}

/* 工具按鈕周邊節奏 */
.fcm-toolBtnSlot {
  display: inline-flex;
  align-items: center;
}

/* ✅ 保證 close hit area >= 36px（ToolIconButton 傳 size=36） */
`;

/**
 * ✅ 小工具：避免重複注入 style tag（多個 modal mount/unmount）
 */
function useInjectStyleOnce(id, cssText) {
  React.useEffect(() => {
    if (!id || !cssText) return;

    const exists = typeof document !== "undefined" && document.getElementById(id);
    if (exists) return;

    try {
      const el = document.createElement("style");
      el.id = id;
      el.type = "text/css";
      el.appendChild(document.createTextNode(cssText));
      document.head.appendChild(el);
    } catch {}
  }, [id, cssText]);
}

export default function FavoriteCategoryManager({
  open,
  onClose,
  categories,
  onCreate,
  onRename,
  onReorder,
  onArchive,
  onImportCategory,
  isSaving,
  errorText,
  t,

  // ✅ Task C：權限 gate（未登入不可編輯分類；但不等於 saving）
  // - canEdit：上游可直接傳 boolean
  // - authUserId：若未傳 canEdit，則本元件以 !!authUserId 判斷
  canEdit,
  authUserId,
}) {
  // ✅ inject UI-only CSS
  useInjectStyleOnce("fcm-style-v1", FAVORITE_CATEGORY_MANAGER_CSS);

  const list = Array.isArray(categories) ? categories : [];
  const canCreate = typeof onCreate === "function";
  const canRename = typeof onRename === "function";
  const canReorder = typeof onReorder === "function";
  const canArchive = typeof onArchive === "function";

  // ✅ Task C：鎖定條件
  // - saving：只有嚴格 true 才鎖（避免 undefined/null/0 誤鎖）
  // - edit：是否可編輯（未登入不可 CRUD；但不等於 saving lock）
  const isSavingStrict = isSaving === true;
  const canEditEffective = typeof canEdit === "boolean" ? canEdit : !!authUserId;
  const disabledAll = isSavingStrict;

  const [editingId, setEditingId] = React.useState(null);
  const [draftName, setDraftName] = React.useState("");
  const [localErrorText, setLocalErrorText] = React.useState("");

  const inputRef = React.useRef(null);
  const originalNameRef = React.useRef("");

  // ✅ Task C：新增後自動 focus（簡單版 heuristic）
  const pendingFocusAfterCreateRef = React.useRef(false);
  const prevListLenRef = React.useRef(0);

  React.useEffect(() => {
    if (!open) {
      setEditingId(null);
      setDraftName("");
      setLocalErrorText("");
      originalNameRef.current = "";
      pendingFocusAfterCreateRef.current = false;
      prevListLenRef.current = 0;
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (!pendingFocusAfterCreateRef.current) return;
    if (disabledAll) return;
    if (!canEditEffective) return;
    if (!canRename) return;
    if (!Array.isArray(list) || list.length === 0) return;

    const prevLen = prevListLenRef.current || 0;
    const lenChanged = list.length !== prevLen;

    let candidate = null;
    try {
      const withOrder = list
        .map((c) => {
          const n = Number(c && c.order_index);
          return { c, n: Number.isFinite(n) ? n : null };
        })
        .filter((x) => x && x.c && x.c.id != null);

      const anyHasOrder = withOrder.some((x) => x.n !== null);
      if (anyHasOrder) {
        withOrder.sort((a, b) => {
          const an = a.n === null ? -1 : a.n;
          const bn = b.n === null ? -1 : b.n;
          return bn - an;
        });
        candidate = withOrder[0] ? withOrder[0].c : null;
      } else {
        candidate = list[list.length - 1] || null;
      }
    } catch {
      candidate = list[list.length - 1] || null;
    }

    if (candidate && candidate.id != null) {
      pendingFocusAfterCreateRef.current = false;

      const id = String(candidate.id);
      const name = String(candidate.name || "");

      originalNameRef.current = name;
      setEditingId(id);
      setDraftName(name);
      setLocalErrorText("");

      try {
        console.log("[categoryUI] focusAfterCreate", {
          lenChanged,
          pickedId: id,
          pickedName: name,
          pickedOrderIndex: candidate && candidate.order_index,
        });
      } catch {}
    }

    prevListLenRef.current = list.length;
  }, [open, list, disabledAll, canEditEffective, canRename]);

  React.useEffect(() => {
    if (editingId && open) {
      try {
        setTimeout(() => {
          if (inputRef.current) inputRef.current.focus();
          if (inputRef.current) inputRef.current.select();
        }, 0);
      } catch {}
    }
  }, [editingId, open]);

  function normalizeName(s) {
    return String(s || "").trim();
  }

  function hasDuplicateName(nextName, excludeId) {
    const target = normalizeName(nextName).toLowerCase();
    if (!target) return false;
    return list.some((c) => {
      if (!c) return false;
      if (excludeId && String(c.id) === String(excludeId)) return false;
      const n = normalizeName(c.name).toLowerCase();
      return n === target;
    });
  }

  // ✅ 2026-01-18：新增分類預設名避免重複（流水號）
  // - 目的：若 DB/後端有同名限制，使用者未先改名仍可連續新增
  // - 規則：「新分類」「新分類 2」「新分類 3」...
  function getUniqueUntitledCategoryName(baseName) {
    const base = normalizeName(baseName) || "新分類";
    if (!hasDuplicateName(base, null)) return base;

    for (let i = 2; i <= 999; i += 1) {
      const candidate = `${base} ${i}`;
      if (!hasDuplicateName(candidate, null)) return candidate;
    }
    return `${base} ${Date.now()}`;
  }

  function beginEdit(c) {
    if (!c) return;
    if (disabledAll) return;
    if (!canEditEffective) return;
    const id = String(c.id);
    const name = String(c.name || "");
    originalNameRef.current = name;
    setEditingId(id);
    setDraftName(name);
    setLocalErrorText("");
  }

  function cancelEdit() {
    setLocalErrorText("");
    setEditingId(null);
    setDraftName("");
    originalNameRef.current = "";
  }

  async function commitEdit() {
    if (!editingId) return;
    if (!canRename) return;
    if (disabledAll) return;
    if (!canEditEffective) return;

    const nextName = normalizeName(draftName);
    if (!nextName) {
      setLocalErrorText((t && t.nameEmptyError) || "名稱不可為空");
      return;
    }
    if (hasDuplicateName(nextName, editingId)) {
      setLocalErrorText((t && t.nameDuplicateError) || "名稱不可重複");
      return;
    }

    const before = originalNameRef.current || "";
    try {
      console.log(
        `[categoryUI] rename id=${editingId} from=${JSON.stringify(before)} to=${JSON.stringify(nextName)}`
      );
    } catch {}

    const idNum = Number(editingId);
    if (!Number.isFinite(idNum)) {
      setLocalErrorText((t && t.idInvalidError) || "ID 不合法");
      return;
    }

    const res = await onRename(idNum, nextName);
    if (res && res.ok) {
      cancelEdit();
      return;
    }
    // 失敗：保留編輯狀態讓使用者可再改
    setLocalErrorText(
      (res && res.errorText) || (t && t.saveFailedError) || "儲存失敗"
    );
  }

  async function addCategory() {
    if (!canCreate) return;
    if (disabledAll) return;
    if (!canEditEffective) return;

    const baseName = (t && t.untitledCategoryLabel) || "新分類";
    const name = getUniqueUntitledCategoryName(baseName);
    try {
      console.log(`[categoryUI] create name=${JSON.stringify(name)}`);
    } catch {}

    const res = await onCreate(name);
    if (!res || !res.ok) {
      setLocalErrorText(
        (res && res.errorText) || (t && t.createFailedError) || "新增失敗"
      );
      return;
    }
    // 新增成功：等上層 reload categories 後，自動進入改名（heuristic）
    pendingFocusAfterCreateRef.current = true;
    prevListLenRef.current = list.length;
    setLocalErrorText("");
  }

  async function move(fromIndex, toIndex) {
    if (!canReorder) return;
    if (disabledAll) return;
    if (!canEditEffective) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= list.length || toIndex >= list.length) return;
    if (fromIndex === toIndex) return;

    const arr = [...list];
    const item = arr[fromIndex];
    arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, item);

    try {
      console.log(
        `[categoryUI] reorder id=${JSON.stringify(
          item && item.id
        )} fromIndex=${fromIndex} toIndex=${toIndex}`
      );
    } catch {}

    const ids = arr
      .map((x) => Number(x && x.id))
      .filter((n) => Number.isFinite(n));
    // 若有非數字 id（理論上 DB-backed 不會），就不送 reorder
    if (ids.length !== arr.length) {
      setLocalErrorText((t && t.idInvalidError) || "ID 不合法");
      return;
    }

    const res = await onReorder(ids);
    if (!res || !res.ok) {
      setLocalErrorText(
        (res && res.errorText) || (t && t.reorderFailedError) || "排序失敗"
      );
      return;
    }
    setLocalErrorText("");
  }

  async function archiveCategory(id) {
    if (!canArchive) return;
    if (disabledAll) return;
    if (!canEditEffective) return;
    const idNum = Number(id);
    if (!Number.isFinite(idNum)) {
      setLocalErrorText((t && t.idInvalidError) || "ID 不合法");
      return;
    }
    const ok =
      typeof window !== "undefined"
        ? window.confirm((t && t.archiveConfirmText) || "確定封存這個分類？")
        : true;
    if (!ok) return;

    try {
      console.log(`[categoryUI] archive id=${JSON.stringify(idNum)}`);
    } catch {}

    const res = await onArchive(idNum);
    if (!res || !res.ok) {
      setLocalErrorText(
        (res && res.errorText) || (t && t.archiveFailedError) || "封存失敗"
      );
      return;
    }
    setLocalErrorText("");
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={(t && t.manageCategoriesLabel) || "管理分類"}
      className="fcm-overlay"
      onMouseDown={(e) => {
        // 點背景關閉（但點卡片內不關閉）
        if (e && e.target === e.currentTarget && typeof onClose === "function") {
          onClose();
        }
      }}
    >
      <div className="fcm-panel">
        {/* Header */}
        <div className="fcm-header">
          {/* ✅ header title + icon */}
          <div className="fcm-title">
            <span aria-hidden="true" className="fcm-titleIcon">
              <SlidersIcon size={18} />
            </span>
            <span>{(t && t.manageCategoriesLabel) || "管理分類"}</span>
          </div>

          {/* ✅ close：icon button（hit area >= 36px） */}
          <span className="fcm-toolBtnSlot">
            <ToolIconButton
              ariaLabel={(t && t.closeLabel) || "關閉"}
              title={(t && t.closeLabel) || "關閉"}
              onClick={() => typeof onClose === "function" && onClose()}
              size={36}
              iconSize={18}
              variant="ghost"
              icon={<XIcon size={18} />}
            />
          </span>

          {/* =========================
           * DEPRECATED (2026-01-16)
           * =========================
          <button
            type="button"
            aria-label={(t && t.closeLabel) || "關閉"}
            title={(t && t.closeLabel) || "關閉"}
            onClick={() => typeof onClose === "function" && onClose()}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
              opacity: 0.9,
            }}
          >
            {(t && t.closeLabel) || "關閉"}
          </button>
           * ========================= */}
        </div>

        {/* Actions */}
        <div className="fcm-actions">
          {/* ✅ add：icon button（對齊主 UI 的工具按鈕節奏） */}
          <span className="fcm-toolBtnSlot">
            <ToolIconButton
              ariaLabel={(t && t.addCategoryLabel) || "新增分類"}
              title={(t && t.addCategoryLabel) || "新增分類"}
              onClick={addCategory}
              disabled={disabledAll || !canCreate}
              size={36}
              iconSize={18}
              icon={<PlusIcon size={18} />}
            />
          </span>

          {/* =========================
           * DEPRECATED (2026-01-16)
           * =========================
          <button
            type="button"
            aria-label={(t && t.addCategoryLabel) || "新增分類"}
            title={(t && t.addCategoryLabel) || "新增分類"}
            onClick={addCategory}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            {(t && t.addCategoryLabel) || "新增分類"}
          </button>
           * ========================= */}

          <div className="fcm-count">{list.length > 0 ? `${list.length}` : ""}</div>
        </div>

        {/* List */}
        <div className="fcm-list">
          {list.map((c, idx) => {
            const id = c && c.id ? String(c.id) : "";
            const name =
              c && typeof c.name !== "undefined" ? String(c.name) : "";
            const isEditing = !!editingId && String(editingId) === id;

            const isFirst = idx === 0;
            const isLast = idx === list.length - 1;

            const disableUp = isFirst;
            const disableDown = isLast;

            return (
              <div key={id || `${idx}`} className="fcm-row">
                {/* Name */}
                <div className="fcm-nameWrap">
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => beginEdit(c)}
                      aria-label={(t && t.renameLabel) || "改名"}
                      title={(t && t.renameLabel) || "改名"}
                      className="fcm-nameBtn"
                    >
                      {name || "—"}
                    </button>
                  )}

                  {isEditing && (
                    <div className="fcm-editWrap">
                      <input
                        ref={inputRef}
                        value={draftName}
                        onChange={(e) => {
                          setDraftName(e && e.target ? e.target.value : "");
                          setLocalErrorText("");
                        }}
                        onKeyDown={(e) => {
                          if (!e) return;
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitEdit();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        onBlur={() => {
                          // blur = 保存（若驗證不過就留在編輯狀態）
                          commitEdit();
                        }}
                        aria-label={(t && t.renameLabel) || "改名"}
                        className="fcm-input"
                        disabled={disabledAll}
                      />

                      {!!localErrorText && (
                        <div className="fcm-error">{localErrorText}</div>
                      )}
                      {!!errorText && (
                        <div className="fcm-error">{errorText}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Up (icon) */}
                <span className="fcm-toolBtnSlot">
                  <ToolIconButton
                    ariaLabel={(t && t.moveUpLabel) || "上移"}
                    title={(t && t.moveUpLabel) || "上移"}
                    disabled={disabledAll || !canReorder || disableUp}
                    onClick={() => move(idx, idx - 1)}
                    size={36}
                    iconSize={18}
                    variant="ghost"
                    icon={<ChevronUpIcon size={18} />}
                  />
                </span>

                {/* Down (icon) */}
                <span className="fcm-toolBtnSlot">
                  <ToolIconButton
                    ariaLabel={(t && t.moveDownLabel) || "下移"}
                    title={(t && t.moveDownLabel) || "下移"}
                    disabled={disabledAll || !canReorder || disableDown}
                    onClick={() => move(idx, idx + 1)}
                    size={36}
                    iconSize={18}
                    variant="ghost"
                    icon={<ChevronDownIcon size={18} />}
                  />
                </span>


                {/* Import (per-category) */}
                <button
                  type="button"
                  aria-label={(t && t.importLabel) || "匯入"}
                  title={(t && t.importLabel) || "匯入"}
                  onClick={() => {
                    if (typeof onImportCategory === "function") {
                      onImportCategory({ id, name });
                    }
                  }}
                  disabled={disabledAll}
                  style={{
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--border-subtle, rgba(0,0,0,0.16))",
                    background: "transparent",
                    color: "inherit",
                    cursor: disabledAll ? "not-allowed" : "pointer",
                    opacity: disabledAll ? 0.35 : 0.8,
                    userSelect: "none",
                  }}
                >
                  {(t && t.importLabel) || "匯入"}
                </button>

                {/* Archive (text button; no new icon dependency) */}
                <button
                  type="button"
                  aria-label={(t && t.archiveLabel) || "封存"}
                  title={(t && t.archiveLabel) || "封存"}
                  onClick={() => archiveCategory(id)}
                  disabled={disabledAll || !canArchive}
                  style={{
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--border-subtle, rgba(0,0,0,0.16))",
                    background: "transparent",
                    color: "inherit",
                    cursor: disabledAll || !canArchive ? "not-allowed" : "pointer",
                    opacity: disabledAll || !canArchive ? 0.35 : 0.8,
                    userSelect: "none",
                  }}
                >
                  {(t && t.archiveLabel) || "封存"}
                </button>

                {/* =========================
                 * DEPRECATED (2026-01-16)
                 * =========================
                <button
                  type="button"
                  aria-label={(t && t.moveUpLabel) || "上移"}
                  title={(t && t.moveUpLabel) || "上移"}
                  disabled={disableUp}
                  onClick={() => move(idx, idx - 1)}
                  style={{
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit",
                    cursor: disableUp ? "not-allowed" : "pointer",
                    opacity: disableUp ? 0.35 : 0.9,
                    userSelect: "none",
                  }}
                >
                  ↑
                </button>

                <button
                  type="button"
                  aria-label={(t && t.moveDownLabel) || "下移"}
                  title={(t && t.moveDownLabel) || "下移"}
                  disabled={disableDown}
                  onClick={() => move(idx, idx + 1)}
                  style={{
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit",
                    cursor: disableDown ? "not-allowed" : "pointer",
                    opacity: disableDown ? 0.35 : 0.9,
                    userSelect: "none",
                  }}
                >
                  ↓
                </button>
                 * ========================= */}
              </div>
            );
          })}

          {list.length === 0 && (
            <div className="fcm-empty">
              {(t && t.noCategoriesText) || "—"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// frontend/src/features/library/components/FavoriteCategoryManager.jsx
