// frontend/src/features/library/LibraryAddPage.jsx
import React from "react";
import { apiFetch } from "../../utils/apiClient";
// Feature flag: hide "Official packs" (presets) UI for now.
const ENABLE_LIBRARY_PRESETS = false;
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function parseCategoryIdFromUrl() {
  try {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    const cid = url.searchParams.get("categoryId") || url.searchParams.get("category_id") || "";
    return safeStr(cid).trim();
  } catch {
    return "";
  }
}
function normalizePresetsPayload(json) {
  // backend may return: [{id,title,level,items:[{headword,canonical_pos}]}]
  // or: { presets: [...] }
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object" && Array.isArray(json.presets)) return json.presets;
  return [];
}
export default function LibraryAddPage({
  uiText,
  t,
  uiLang,
  targetCategoryId,
  favoriteCategories,
  favoriteCategoriesLoading,
  onClose,
  onOpenLibrary,
  onSelectFavoriteCategory,
}) {
  const __lang = safeStr(uiLang).toLowerCase();
  const __isZh = __lang.startsWith("zh");
  const L = React.useCallback(
    (key, fallbackEn, fallbackZh) => {
      // Prefer `t` (already resolved upstream). If missing, fall back by uiLang.
      const v = t?.[key];
      if (typeof v === "string" && v.trim()) return v;
      const map = uiText && typeof uiText === "object" ? uiText : null;
      const fromUiText =
        map?.[uiLang]?.[key] ||
        map?.[__lang]?.[key] ||
        map?.[__lang.split("-")[0]]?.[key];
      if (typeof fromUiText === "string" && fromUiText.trim()) return fromUiText;
      return __isZh ? fallbackZh || fallbackEn : fallbackEn;
    },
    [t, uiText, uiLang, __lang, __isZh]
  );
  const resolvedCategoryId = React.useMemo(() => {
    const fromProp = safeStr(targetCategoryId).trim();
    if (fromProp) return fromProp;
    return parseCategoryIdFromUrl();
  }, [targetCategoryId]);
  const categoryName = React.useMemo(() => {
    const arr = Array.isArray(favoriteCategories) ? favoriteCategories : [];
    const hit = arr.find((c) => safeStr(c?.id) === safeStr(resolvedCategoryId));
    return safeStr(hit?.name) || "";
  }, [favoriteCategories, resolvedCategoryId]);
  const [tab, setTab] = React.useState(ENABLE_LIBRARY_PRESETS ? "presets" : "ai"); // presets | ai
  // ------------------------
  // Presets tab state
  // ------------------------
  const [presets, setPresets] = React.useState([]);
  const [presetsLoading, setPresetsLoading] = React.useState(false);
  const [presetsError, setPresetsError] = React.useState("");
  const [presetId, setPresetId] = React.useState("");
  const [presetCheckedMap, setPresetCheckedMap] = React.useState({});
  const [presetCommitBusy, setPresetCommitBusy] = React.useState(false);
  const [presetCommitError, setPresetCommitError] = React.useState("");
  const selectedPreset = React.useMemo(() => {
    const arr = Array.isArray(presets) ? presets : [];
    return arr.find((p) => safeStr(p?.id) === safeStr(presetId)) || null;
  }, [presets, presetId]);
  const presetItems = React.useMemo(() => {
    const items = Array.isArray(selectedPreset?.items) ? selectedPreset.items : [];
    return items
      .map((it, idx) => {
        const headword = safeStr(it?.headword || it?.importKey || it?.de || it?.textDe).trim();
        const canonicalPos = safeStr(it?.canonical_pos || it?.canonicalPos || it?.type).trim();
        return {
          _key: `${safeStr(selectedPreset?.id)}_${idx}_${headword}`,
          headword,
          canonicalPos,
        };
      })
      .filter((x) => x.headword);
  }, [selectedPreset]);
  React.useEffect(() => {
    if (!ENABLE_LIBRARY_PRESETS) return;
    let alive = true;
    async function run() {
      setPresetsError("");
      setPresetsLoading(true);
      try {
        const res = await apiFetch("/api/library/import/presets", { method: "GET" });
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) {
          setPresetsError(safeStr(json?.message) || "Failed to load presets");
          setPresets([]);
          return;
        }
        const arr = normalizePresetsPayload(json);
        setPresets(arr);
      } catch (e) {
        if (!alive) return;
        setPresetsError("Failed to load presets");
        setPresets([]);
      } finally {
        if (!alive) return;
        setPresetsLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, []);
  React.useEffect(() => {
    // when preset changes: default all checked
    const next = {};
    for (const it of presetItems) next[it._key] = true;
    setPresetCheckedMap(next);
    setPresetCommitError("");
  }, [presetId]);
  const presetSelectedCount = React.useMemo(() => {
    let n = 0;
    for (const it of presetItems) if (presetCheckedMap[it._key]) n += 1;
    return n;
  }, [presetItems, presetCheckedMap]);
  async function commitPresetImport() {
    setPresetCommitError("");
    if (!resolvedCategoryId) {
      setPresetCommitError("targetCategoryId is required");
      return;
    }
    if (!presetId) {
      setPresetCommitError(t?.importPickPreset || "Please pick a preset list");
      return;
    }
    const selected = presetItems.filter((it) => presetCheckedMap[it._key]);
    if (!selected.length) {
      setPresetCommitError(t?.importPickAtLeastOne || "Please select at least one item");
      return;
    }
    setPresetCommitBusy(true);
    try {
      const items = selected.map((x) => ({
        headword: x.headword,
        canonicalPos: x.canonicalPos,
      }));
      const payload = {
        targetCategoryId: safeStr(resolvedCategoryId),
        items,
        meta: {
          source: "preset_import",
          presetId: safeStr(presetId),
          uiLang: safeStr(uiLang) || "en",
        },
      };
      const res = await apiFetch("/api/library/import/commit", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setPresetCommitError(safeStr(json?.message) || t?.importCommitFailed || "Import failed");
        return;
      }
      // best effort: switch favorites category + reopen library
      try {
        if (typeof onSelectFavoriteCategory === "function") onSelectFavoriteCategory(resolvedCategoryId);
      } catch {}
      try {
        if (typeof onOpenLibrary === "function") onOpenLibrary();
      } catch {}
      try {
        if (typeof onClose === "function") onClose();
      } catch {}
      // keep console for debugging
      try {
        // eslint-disable-next-line no-console
        console.log("[preset_import] ok", json);
      } catch {}
    } catch (e) {
      setPresetCommitError(t?.importCommitFailed || "Import failed");
    } finally {
      setPresetCommitBusy(false);
    }
  }
  // ------------------------
  // AI tab (LLM generate) state — minimal port from WordLibraryPanel
  // ------------------------
  const [aiLevel, setAiLevel] = React.useState("A1");
  const [aiType, setAiType] = React.useState("word");
  const [aiScenario, setAiScenario] = React.useState("");
  const [aiBusyGen, setAiBusyGen] = React.useState(false);
  const [aiBusyCommit, setAiBusyCommit] = React.useState(false);
  const [aiError, setAiError] = React.useState("");
  const [aiCandidates, setAiCandidates] = React.useState([]); // {id,textDe,importKey,checked,type,hint}
  const aiHasAnyChecked = React.useMemo(
    () => (Array.isArray(aiCandidates) ? aiCandidates : []).some((x) => x && x.checked),
    [aiCandidates]
  );
  function normalizeImportTypeLabel(typeKey) {
    if (typeKey === "phrase") return t?.importTypePhrases || t?.importTypePhrase || "Phrases";
    if (typeKey === "sentence") return t?.importTypeSentences || "Sentences";
    return t?.importTypeVocab || "Vocabulary";
  }
  async function generateAiCandidates() {
    setAiError("");
    setAiCandidates([]);
    const scenario = safeStr(aiScenario).trim();
    if (!scenario) {
      setAiError(t?.importScenarioRequired || "Please enter a scenario");
      return;
    }
    setAiBusyGen(true);
    try {
      const payload = {
        level: aiLevel,
        type: aiType,
        scenario,
        uiLang: safeStr(uiLang) || "en",
        excludeKeys: [],
      };
      const res = await apiFetch("/api/library/import/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      const arr = Array.isArray(json) ? json : [];
      const mapped = arr.slice(0, 5).map((x) => {
        const candidateId = x?.candidateId || x?.id || `cand_${Date.now()}_${Math.random()}`;
        const importKey = safeStr(x?.importKey || x?.display?.de || "").trim();
        const textDe = safeStr(x?.display?.de || importKey).trim();
        const hint = safeStr(x?.display?.hint || "").trim();
        return {
          id: safeStr(candidateId),
          type: safeStr(x?.type) || aiType,
          importKey: importKey || textDe,
          textDe,
          hint,
          checked: true,
        };
      });
      setAiCandidates(mapped.filter((x) => x && x.importKey));
      if (!res.ok) {
        setAiError(safeStr(json?.message) || t?.importGenerateFailed || "Generate failed");
      }
    } catch (e) {
      setAiError(t?.importGenerateFailed || "Generate failed");
    } finally {
      setAiBusyGen(false);
    }
  }
  async function commitAiImport() {
    setAiError("");
    if (!resolvedCategoryId) {
      setAiError("targetCategoryId is required");
      return;
    }
    const selected = (Array.isArray(aiCandidates) ? aiCandidates : []).filter((x) => x && x.checked);
    if (!selected.length) {
      setAiError(t?.importPickAtLeastOne || "Please select at least one item");
      return;
    }
    setAiBusyCommit(true);
    try {
      const items = selected
        .map((x) => ({
          type: x?.type || aiType,
          importKey: x?.importKey || x?.textDe || "",
        }))
        .filter((x) => x && safeStr(x.importKey).trim());
      const payload = {
        targetCategoryId: safeStr(resolvedCategoryId),
        items,
        meta: {
          level: aiLevel,
          scenario: safeStr(aiScenario).trim(),
          source: "llm_import",
          uiLang: safeStr(uiLang) || "en",
        },
      };
      const res = await apiFetch("/api/library/import/commit", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setAiError(safeStr(json?.message) || t?.importCommitFailed || "Import failed");
        return;
      }
      try {
        if (typeof onSelectFavoriteCategory === "function") onSelectFavoriteCategory(resolvedCategoryId);
      } catch {}
      try {
        if (typeof onOpenLibrary === "function") onOpenLibrary();
      } catch {}
      try {
        if (typeof onClose === "function") onClose();
      } catch {}
      try {
        // eslint-disable-next-line no-console
        console.log("[llm_import] ok", json);
      } catch {}
    } catch (e) {
      setAiError(t?.importCommitFailed || "Import failed");
    } finally {
      setAiBusyCommit(false);
    }
  }
  function toggleAiCandidate(id, checked) {
    setAiCandidates((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x && x.id === id ? { ...x, checked: !!checked } : x)));
  }
  // ------------------------
  // UI
  // ------------------------
  const pageTitle = L("libraryAddTitle", "Add learning content", "新增學習內容");
  const tabPresets = L("libraryAddTabPresets", "Official packs", "官方學習包");
  const tabAi = L("libraryAddTabAi", "AI", "AI 生成");
  const toLabel = L("libraryAddImportTo", "Import to", "匯入到");
  const backLabel = L("libraryAddBack", "Back", "返回");
  return (
    <div style={{ padding: 16, maxWidth: 920, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{pageTitle}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            {toLabel}: <b>{categoryName || resolvedCategoryId || "-"}</b>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              if (typeof onClose === "function") onClose();
            } catch {}
          }}
          style={{
            height: 32,
            padding: "0 12px",
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
            background: "var(--card-bg)",
            color: "var(--text-main)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {backLabel}
        </button>
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {ENABLE_LIBRARY_PRESETS && (
          <button
            type="button"
            onClick={() => setTab("presets")}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 10,
              border: tab === "presets" ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
              background: tab === "presets" ? "rgba(255,165,0,0.08)" : "var(--card-bg)",
              color: "var(--text-main)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {tabPresets}
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab("ai")}
          style={{
            height: 32,
            padding: "0 12px",
            borderRadius: 10,
            border: tab === "ai" ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
            background: tab === "ai" ? "rgba(255,165,0,0.08)" : "var(--card-bg)",
            color: "var(--text-main)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {tabAi}
        </button>
      </div>
      {tab === "presets" ? (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
          {/* left: preset list */}
          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 14, background: "var(--card-bg)", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 600 }}>
              {L("libraryAddPresetList", "List", "清單")}
            </div>
            <div style={{ padding: 8 }}>
              {presetsLoading ? (
                <div style={{ opacity: 0.7, fontSize: 12 }}>{t?.loading || "Loading..."}</div>
              ) : presetsError ? (
                <div style={{ color: "#c00", fontSize: 12 }}>{presetsError}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(Array.isArray(presets) ? presets : []).map((p) => {
                    const active = safeStr(p?.id) === safeStr(presetId);
                    const title = safeStr(p?.title) || safeStr(p?.id);
                    const cnt = Array.isArray(p?.items) ? p.items.length : 0;
                    const level = safeStr(p?.level);
                    return (
                      <button
                        key={safeStr(p?.id)}
                        type="button"
                        onClick={() => setPresetId(safeStr(p?.id))}
                        style={{
                          textAlign: "left",
                          width: "100%",
                          padding: "10px 10px",
                          borderRadius: 12,
                          border: active ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                          background: active ? "rgba(255,165,0,0.08)" : "transparent",
                          color: "var(--text-main)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                          {level ? `${level} · ` : ""}{cnt}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {/* right: items checklist */}
          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 14, background: "var(--card-bg)", overflow: "hidden" }}>
            <div
              style={{
                padding: "8px 10px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 500 }}>
                {L("libraryAddItems", "Content", "內容")} {presetId ? `(${presetSelectedCount}/${presetItems.length})` : ""}
              </div>
              <button
                type="button"
                disabled={presetCommitBusy || !presetId || !presetItems.length || !presetSelectedCount}
                onClick={commitPresetImport}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid var(--accent)",
                  background: "var(--accent)",
                  color: "white",
                  cursor: presetCommitBusy ? "not-allowed" : "pointer",
                  opacity: presetCommitBusy ? 0.6 : 1,
                  fontWeight: 600,
                }}
              >
                {L("importCommit", "Import", "匯入")}
              </button>
            </div>
            <div style={{ padding: 12 }}>
              {!resolvedCategoryId ? (
                <div style={{ color: "#c00", fontSize: 12 }}>targetCategoryId is required</div>
              ) : favoriteCategoriesLoading ? (
                <div style={{ opacity: 0.7, fontSize: 12 }}>{t?.loading || "Loading..."}</div>
              ) : !presetId ? (
                <div style={{ opacity: 0.75, fontSize: 12 }}>{t?.importPickPreset || "Please pick a preset list"}</div>
              ) : (
                <>
                  {presetCommitError ? <div style={{ color: "#c00", fontSize: 12, marginBottom: 8 }}>{presetCommitError}</div> : null}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = {};
                        for (const it of presetItems) next[it._key] = true;
                        setPresetCheckedMap(next);
                      }}
                      style={{
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 10,
                        border: "1px solid var(--border-subtle)",
                        background: "transparent",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {t?.selectAll || "全選"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetCheckedMap({})}
                      style={{
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 10,
                        border: "1px solid var(--border-subtle)",
                        background: "transparent",
                        cursor: "pointer",
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {t?.selectNone || "全不選"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {presetItems.map((it) => (
                      <label key={it._key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={!!presetCheckedMap[it._key]}
                          onChange={(e) => setPresetCheckedMap((prev) => ({ ...(prev || {}), [it._key]: !!e.target.checked }))}
                        />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontWeight: 500 }}>{it.headword}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 14, background: "var(--card-bg)", padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minWidth: 0 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600, marginBottom: 4 }}>{L("importLevel", "Level", "等級")}</div>
              <select
                value={aiLevel}
                onChange={(e) => setAiLevel(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: 0,
                  height: 34,
                  borderRadius: 10,
                  boxSizing: "border-box",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--card-bg)",
                }}
              >
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600, marginBottom: 4 }}>{t?.importType || "Type"}</div>
              <select
                value={aiType}
                onChange={(e) => setAiType(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: 0,
                  height: 34,
                  borderRadius: 10,
                  boxSizing: "border-box",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--card-bg)",
                }}
              >
                <option value="word">{normalizeImportTypeLabel("word")}</option>
                <option value="phrase">{normalizeImportTypeLabel("phrase")}</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600, marginBottom: 4 }}>{L("importScenario", "Scenario", "情境")}</div>
            <input
              value={aiScenario}
              onChange={(e) => setAiScenario(e.target.value)}
              placeholder={t?.importScenarioPlaceholder || "e.g. go grocery shopping"}
              style={{
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                height: 34,
                borderRadius: 10,
                padding: "0 10px",
                border: "1px solid var(--border-subtle)",
                boxSizing: "border-box",
              }}
            />
          </div>
          {aiError ? <div style={{ color: "#c00", fontSize: 12, marginTop: 10 }}>{aiError}</div> : null}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              type="button"
              onClick={generateAiCandidates}
              disabled={aiBusyGen || aiBusyCommit}
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {L("importGenerate", "Generate", "生成")}
            </button>
            <button
              type="button"
              onClick={commitAiImport}
              disabled={aiBusyGen || aiBusyCommit || !aiHasAnyChecked}
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid var(--accent)",
                background: "var(--accent)",
                color: "white",
                cursor: "pointer",
                fontWeight: 500,
                opacity: aiBusyGen || aiBusyCommit || !aiHasAnyChecked ? 0.6 : 1,
              }}
            >
              {L("importCommit", "Import", "匯入")}
            </button>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {(Array.isArray(aiCandidates) ? aiCandidates : []).map((c) => (
              <label key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input type="checkbox" checked={!!c.checked} onChange={(e) => toggleAiCandidate(c.id, e.target.checked)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{c.textDe || c.importKey}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{c.hint || ""}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}