// frontend/src/components/conversation/useConversation.jsx
/**
 * useConversation Hook
 * --------------------------------------------------
 * 功能說明：
 * - 負責「例句對話 / 會話」的取得、狀態管理與操作
 * - 支援後端對話 API 與前端 fallback 範例對話
 *
 * 初始化狀態（Production 排查用）：
 * - conversation = null
 * - conversationLoading = false
 * - conversationError = ""
 *
 * 異動紀錄：
 * - 2025-12-19
 *   - 修正 API 呼叫在 Vercel 環境打到錯誤網域的問題
 *   - 新增 API_BASE_URL，與 analyze / examples / tts 行為一致
 *   - 保留原本相對路徑 fetch，標示為 deprecated（不移除）
 *
 * - 2026-01-07
 *   - 修正「對話翻譯不見」：支援後端直接回傳 Array（data 本身就是 turns）
 *   - 加入 console probe（僅在偵測到 Array 直出時印一次 sample，方便 Production 排查）
 *
 * - 2026-01-31
 *   - 修正 401：改用 apiFetch（統一 base + 自動附加 Authorization）
 *   - 補上 history（最多前三句）送往後端，避免回覆脫離例句
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch } from "../../utils/apiClient";

// ==================================================
// Debug flag (default OFF)
// - Enable by setting: VITE_DEBUG_CONVERSATION=1
// - Never affects logic/flow; only prints logs
// ==================================================
const __DEBUG_CONV__ = import.meta.env.VITE_DEBUG_CONVERSATION === "1";
const __convTs = () => new Date().toISOString();
const __convLog = (...args) => {
  if (!__DEBUG_CONV__) return;
  // eslint-disable-next-line no-console
  console.log(...args);
};
const __convErr = (...args) => {
  if (!__DEBUG_CONV__) return;
  // eslint-disable-next-line no-console
  console.error(...args);
};

// ==================================================
// Real conversation policy
// - Anonymous mode MUST be real conversation (no sample/demo fallback)
// - Allow fake conversation ONLY when explicitly enabled for local dev
//   via: VITE_ENABLE_FAKE_CONVERSATION=1
// ==================================================
const __ENABLE_FAKE_CONVERSATION__ =
  typeof import.meta !== "undefined" && import.meta?.env?.VITE_ENABLE_FAKE_CONVERSATION === "1";

const MOSAIC_LINE = "----------------------------";

/**
 * API_BASE_URL
 * --------------------------------------------------
 * 說明：
 * - 正式環境（Vercel）必須使用完整 backend URL
 * - 本機環境可由 Vite proxy 或 .env 控制
 *
 * NOTE:
 * - 本檔真正 request 走 apiFetch（它會統一 base + 自動帶 Authorization）
 * - 這裡保留 API_BASE_URL 只用於 debug log（不影響請求）
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * buildFakeConversation
 * --------------------------------------------------
 * 功能：
 * - 當後端失敗或尚未實作時，提供前端可用的範例對話
 */
const buildFakeConversation = (sentence) => {
  const s =
    typeof sentence === "string" && sentence.trim().length > 0
      ? sentence.trim()
      : "Lass uns ein kurzes Beispielgespräch führen.";
  return [
    { de: s, translation: "" },
    { de: "Echt? Erzähl mir ein bisschen mehr dazu.", translation: "" },
    {
      de: "Klar, das ist nur ein Beispiel für eine kleine Unterhaltung.",
      translation: "",
    },
    {
      de: "Später kann hier eine längere, echte Groq-Konversation erscheinen.",
      translation: "",
    },
  ];
};

/**
 * normalizeTurns
 * --------------------------------------------------
 * 功能：
 * - 統一後端回傳的對話格式
 */
const normalizeTurns = (rawTurns) => {
  if (!Array.isArray(rawTurns)) return [];

  // Translation field is not stable across backends/LLMs.
  // Support a wide set of common keys while staying backward compatible.
  function pickTranslation(item) {
    try {
      if (!item || typeof item !== "object") return "";

      const candidates = [
        item.translation,
        item.trans,
        item.native,
        item.nativeText,
        item.translationText,
        item.zh,
        item["zh-TW"],
        item.zhTW,
        item.zh_tw,
        item["zh-CN"],
        item.zhCN,
        item.zh_cn,
        item.tw,
        item.cn,
        item.en,
        item.english,
      ];

      for (let i = 0; i < candidates.length; i += 1) {
        const v = candidates[i];
        if (typeof v === "string" && v.trim()) return v.trim();
      }

      // Optional structured format: { translations: { 'zh-TW': '...', en: '...' } }
      const translations = item.translations && typeof item.translations === "object" ? item.translations : null;
      if (translations) {
        const t2 =
          (typeof translations["zh-TW"] === "string" && translations["zh-TW"].trim()) ||
          (typeof translations.zhTW === "string" && translations.zhTW.trim()) ||
          (typeof translations.zh_tw === "string" && translations.zh_tw.trim()) ||
          (typeof translations["zh-CN"] === "string" && translations["zh-CN"].trim()) ||
          (typeof translations.zhCN === "string" && translations.zhCN.trim()) ||
          (typeof translations.zh_cn === "string" && translations.zh_cn.trim()) ||
          (typeof translations.en === "string" && translations.en.trim()) ||
          (typeof translations.english === "string" && translations.english.trim());
        if (typeof t2 === "string" && t2.trim()) return t2.trim();
      }
    } catch {
      // ignore
    }
    return "";
  }
  return rawTurns
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        if (!text) return null;
        return { de: text, translation: "" };
      }
      if (item && typeof item === "object") {
        const de =
          typeof item.de === "string"
            ? item.de.trim()
            : typeof item.german === "string"
            ? item.german.trim()
            : "";
        const translation = pickTranslation(item);
        if (!de) return null;
        return { de, translation };
      }
      return null;
    })
    .filter(Boolean);
};

/**
 * ensureLeadSentenceTurn
 * --------------------------------------------------
 * UI only：確保 turns[0] 永遠是當下例句（mainSentence）
 * - 不改後端 / LLM 回傳格式
 * - 避免重複插入（若第一句已等於 mainSentence 則不動）
 */
function ensureLeadSentenceTurn(turns, sentence, translation) {
  const s = typeof sentence === "string" ? sentence.trim() : "";
  const t = typeof translation === "string" ? translation.trim() : "";
  if (!s) return { turns: Array.isArray(turns) ? turns : [], indexShift: 0 };

  const arr = Array.isArray(turns) ? turns : [];
  const firstObj = arr[0] && typeof arr[0] === "object" ? arr[0] : null;
  const first = firstObj ? String(firstObj.de || "").trim() : "";

  // ✅ 若第一句已經是例句：
  // - 不插入
  // - 但若翻譯是空、而上游有 mainTranslation，補齊它（避免「例句在對話中沒有翻譯」）
  if (first && first === s) {
    try {
      const firstTrans = String(firstObj?.translation || "").trim();
      if (!firstTrans && t) {
        const next = [...arr];
        next[0] = { ...firstObj, translation: t };
        return { turns: next, indexShift: 0 };
      }
    } catch {
      // ignore
    }
    return { turns: arr, indexShift: 0 };
  }

  return {
    turns: [{ de: s, translation: t }, ...arr],
    indexShift: 1,
  };
}

export default function useConversation({
  mainSentence,
  mainTranslation,
  explainLang,
  /**
   * storageKey
   * --------------------------------------------------
   * 用途：讓「每個字卡」各自保留自己的 conversation（避免切換字卡後看到上一張字卡的對話）
   * - key 建議用 headword / wordId / lemma 等穩定識別
   * - 若未提供，fallback 使用 mainSentence
   */
  storageKey,
}) {
  const [conversation, setConversation] = useState(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState("");

  /**
   * Conversation context (local only)
   * - 用於把「最多前三句對話」送到後端，避免 LLM 回覆脫離例句
   * - 不依賴任何外部 store / DB（一次只改本檔）
   */
  const historyRef = useRef([]);
  const historySentenceKeyRef = useRef("");

  // ==================================================
  // Per-card conversation store
  // --------------------------------------------------
  // 問題：切換字卡後再打開對話，會看到上一張字卡的對話
  // 解法：用 storageKey 將 conversation / history 分卡保存
  // ==================================================
  const __storeRef = useRef({});
  const __activeKeyRef = useRef("");

  const __resolvedKey = (() => {
    const k = typeof storageKey === "string" ? storageKey.trim() : "";
    if (k) return k;
    const s = typeof mainSentence === "string" ? mainSentence.trim() : "";
    return s || "__default__";
  })();

  // key 切換時：先保存舊 key 的狀態，再載入新 key 的狀態
  useEffect(() => {
    const nextKey = __resolvedKey;
    const prevKey = __activeKeyRef.current;
    if (prevKey === nextKey) return;

    // save prev
    if (prevKey) {
      __storeRef.current[prevKey] = {
        conversation,
        conversationError,
        history: Array.isArray(historyRef.current) ? historyRef.current : [],
        historySentenceKey: historySentenceKeyRef.current || "",
      };
    }

    // load next
    const snapshot = __storeRef.current[nextKey];
    historyRef.current = Array.isArray(snapshot?.history) ? snapshot.history : [];
    historySentenceKeyRef.current = snapshot?.historySentenceKey || "";
    setConversation(snapshot?.conversation ?? null);
    setConversationError(snapshot?.conversationError || "");
    setConversationLoading(false);

    __activeKeyRef.current = nextKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [__resolvedKey]);

  // conversation 變更時：同步寫回 store（確保關閉 overlay / 翻頁也會被保存）
  useEffect(() => {
    const key = __activeKeyRef.current || __resolvedKey;
    if (!key) return;
    __storeRef.current[key] = {
      conversation,
      conversationError,
      history: Array.isArray(historyRef.current) ? historyRef.current : [],
      historySentenceKey: historySentenceKeyRef.current || "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation, conversationError]);

  function normalizeHistoryItem(item) {
    if (!item || typeof item !== "object") return null;
    const roleRaw = typeof item.role === "string" ? item.role.trim() : "";
    const role = roleRaw === "user" || roleRaw === "assistant" ? roleRaw : "assistant";
    const content =
      typeof item.content === "string"
        ? item.content
        : typeof item.de === "string"
        ? item.de
        : typeof item.text === "string"
        ? item.text
        : "";
    const cleaned = String(content || "").trim();
    if (!cleaned) return null;
    return { role, content: cleaned };
  }

  function buildHistoryPayload() {
    const raw = Array.isArray(historyRef.current) ? historyRef.current : [];
    const normalized = raw.map(normalizeHistoryItem).filter(Boolean);
    return normalized.slice(-3);
  }

  /**
   * Production 排查：避免 console 洗版
   * - 只在偵測到「後端直接回傳 Array」時印一次 sample
   */
  const hasLoggedArrayResponseRef = useRef(false);

  /**
   * fetchConversationFromBackend_DEPRECATED
   * --------------------------------------------------
   * ⚠️ 已淘汰（但保留）
   * 原因：
   * - 使用相對路徑 /api/...，在 Vercel 可能打到前端網域造成 404
   */
  const fetchConversationFromBackend_DEPRECATED = async () => {
    return fetch("/api/dictionary/conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sentence: mainSentence,
        explainLang: explainLang || "zh-TW",
      }),
    });
  };

  /**
   * fetchConversationFromBackend
   * --------------------------------------------------
   * 正式使用版本
   * - ✅ 使用 apiFetch：統一 base + 自動附加 Authorization（避免 401）
   * - ✅ 送出 history（最多前三句）
   */
  const fetchConversationFromBackend = useCallback(async () => {
    if (!mainSentence) return [];

    // ✅ 例句變更時：清空既有 history（避免帶到別的例句）
    const sentenceKey =
      typeof mainSentence === "string" ? mainSentence.trim() : "";
    if (sentenceKey && historySentenceKeyRef.current !== sentenceKey) {
      historySentenceKeyRef.current = sentenceKey;
      historyRef.current = [];
    }

    try {
      setConversationLoading(true);
      setConversationError("");

      __convLog("[***CONV:API]", __convTs(), "request", {
        // log only (request 走 apiFetch)
        url: `${API_BASE_URL}/api/dictionary/conversation`,
        explainLang: explainLang || "zh-TW",
        sentencePreview:
          typeof mainSentence === "string" ? mainSentence.slice(0, 120) : "",
      });

      const history = buildHistoryPayload();

      const res = await apiFetch(`/api/dictionary/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sentence: mainSentence,
          explainLang: explainLang || "zh-TW",
          history,
        }),
      });

      __convLog("[***CONV:API]", __convTs(), "response", {
        ok: res.ok,
        status: res.status,
      });

      if (!res.ok) {
        // ✅ Anonymous must be real conversation: do NOT fallback to sample.
        // - 401: token expired / auth mismatch
        // - 429: anon daily limit reached
        if (res.status === 429) {
          setConversationError("匿名對話次數已達上限。");
          return __ENABLE_FAKE_CONVERSATION__ ? buildFakeConversation(mainSentence) : [];
        }
        if (res.status === 401) {
          setConversationError("授權失效，請重新登入或重新整理。");
          return __ENABLE_FAKE_CONVERSATION__ ? buildFakeConversation(mainSentence) : [];
        }
        setConversationError(`對話請求失敗（HTTP ${res.status}）。`);
        return __ENABLE_FAKE_CONVERSATION__ ? buildFakeConversation(mainSentence) : [];
      }

      const data = await res.json();

      __convLog("[***CONV:API]", __convTs(), "response.json", {
        isArray: Array.isArray(data),
        keys:
          data && typeof data === "object" && !Array.isArray(data)
            ? Object.keys(data)
            : [],
      });

      let turns = [];
      if (Array.isArray(data.turns)) {
        turns = normalizeTurns(data.turns);
      } else if (Array.isArray(data.conversation)) {
        turns = normalizeTurns(data.conversation);
      } else if (Array.isArray(data)) {
        // ✅ 後端直接回傳 Array（最常見：[{de, translation}, ...]）
        turns = normalizeTurns(data);

        if (!hasLoggedArrayResponseRef.current) {
          hasLoggedArrayResponseRef.current = true;
          // eslint-disable-next-line no-console
          console.log(
            "[conversation] backend returned Array directly (sample)",
            data && data[0]
          );
        }
      }

      if (!turns || turns.length === 0) {
        __convLog("[***CONV:TURN]", __convTs(), "normalize", {
          rawSource: Array.isArray(data?.turns)
            ? "data.turns"
            : Array.isArray(data?.conversation)
            ? "data.conversation"
            : Array.isArray(data)
            ? "data(array)"
            : "none",
          normalizedLen: 0,
          usedFallback: __ENABLE_FAKE_CONVERSATION__,
        });
        if (__ENABLE_FAKE_CONVERSATION__) {
          turns = buildFakeConversation(mainSentence);
        } else {
          setConversationError("對話回傳為空。");
          turns = [];
        }
      } else {
        __convLog("[***CONV:TURN]", __convTs(), "normalize", {
          rawSource: Array.isArray(data?.turns)
            ? "data.turns"
            : Array.isArray(data?.conversation)
            ? "data.conversation"
            : Array.isArray(data)
            ? "data(array)"
            : "none",
          normalizedLen: turns.length,
          usedFallback: false,
        });
      }

      __convLog("[***CONV:TURN]", __convTs(), "finalTurns", {
        count: turns.length,
        preview: turns
          .map((t) => (t && t.de ? String(t.de) : ""))
          .filter(Boolean)
          .join(" | ")
          .slice(0, 240),
      });

      
      // ✅ Ensure the displayed conversation starts with the seed sentence (mainSentence)
      // - Reason: backend may generate turns without repeating the seed.
      // - UX: user expects the conversation to "extend from" the example sentence.
      const __seedSentence =
        typeof mainSentence === "string" ? mainSentence.trim() : "";
      const __seedTranslation =
        typeof mainTranslation === "string" ? mainTranslation.trim() : "";
      if (__seedSentence && Array.isArray(turns) && turns.length > 0) {
        const __firstDe =
          turns[0] && typeof turns[0].de === "string" ? turns[0].de.trim() : "";
        if (!__firstDe || __firstDe !== __seedSentence) {
          turns = [
            { de: __seedSentence, translation: __seedTranslation || "" },
            ...turns,
          ];
        }
      }

      // ✅ 成功後：更新本地 history（最多保留 6 筆，避免無限增長）
      try {
        const nextHistory = [];
        if (sentenceKey) nextHistory.push({ role: "user", content: sentenceKey });
        for (const t of turns) {
          if (t && typeof t.de === "string" && t.de.trim()) {
            const __de = t.de.trim();
            if (sentenceKey && __de === sentenceKey) continue; // avoid duplicating seed
            nextHistory.push({ role: "assistant", content: __de });
          }
        }
        historyRef.current = nextHistory.slice(-6);
      } catch {
        // ignore
      }

      return turns;
    } catch (err) {
      __convErr("[***CONV:API]", __convTs(), "error", err);
      // eslint-disable-next-line no-console
      console.error("[conversation] 後端產生錯誤", err);
      setConversationError("對話產生失敗。");
      return __ENABLE_FAKE_CONVERSATION__ ? buildFakeConversation(mainSentence) : [];
    } finally {
      setConversationLoading(false);
    }
  }, [mainSentence, explainLang]);

  const openConversation = useCallback(async () => {
    if (!mainSentence) return;

    __convLog("[***CONV:HOOK]", __convTs(), "openConversation", {
      mainSentencePreview:
        typeof mainSentence === "string" ? mainSentence.slice(0, 120) : "",
      hasExistingTurns: !!(
        conversation &&
        conversation.turns &&
        conversation.turns.length > 0
      ),
      currentIsOpen:
        conversation && typeof conversation.isOpen === "boolean"
          ? conversation.isOpen
          : null,
    });

    // 已經有對話 → 只切換開關
    if (conversation && conversation.turns && conversation.turns.length > 0) {
      // ✅ UI 對齊：確保例句是 turns[0]
      // - 若之前版本缺少例句，這裡補上並維持當下顯示句不跳動
      try {
        const ensured = ensureLeadSentenceTurn(
          conversation.turns,
          mainSentence,
          mainTranslation
        );
        if (ensured.indexShift === 1) {
          console.log("[20260202 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
          console.log("[20260203 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
          setConversation((prev) => {
            if (!prev) return prev;
            const nextIndex = Math.min(
              Math.max(0, (prev.currentIndex || 0) + 1),
              ensured.turns.length - 1
            );
            return { ...prev, turns: ensured.turns, currentIndex: nextIndex };
          });
        }
      } catch {
        // ignore
      }

      __convLog("[***CONV:HOOK]", __convTs(), "toggleIsOpen", {
        nextIsOpen: !(conversation && conversation.isOpen),
      });
      console.log("[20260202 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
      console.log("[20260203 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
      setConversation((prev) => (prev ? { ...prev, isOpen: !prev.isOpen } : prev));
      return;
    }

    // 第一次點，去後端拿資料
    console.log("[20260202 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    console.log("[20260203 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    setConversation({
      turns: [],
      currentIndex: 0,
      isOpen: true,
    });

    const turns = await fetchConversationFromBackend();

    // ✅ Safety：維持 UI 不掛，但不造假對話（除非 dev 明確開啟 fake）
    const __safeTurns = Array.isArray(turns) ? turns : [];

    __convLog("[***CONV:HOOK]", __convTs(), "fetched", {
      turnsCount: Array.isArray(__safeTurns) ? __safeTurns.length : 0,
    });

    const ensured = ensureLeadSentenceTurn(__safeTurns, mainSentence, mainTranslation);
    console.log("[20260202 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    console.log("[20260203 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    setConversation({
      turns: ensured.turns,
      currentIndex: 0,
      isOpen: true,
    });
  }, [conversation, fetchConversationFromBackend, mainSentence, mainTranslation]);

  const prevTurn = useCallback(() => {
    __convLog("[***CONV:HOOK]", __convTs(), "prevTurn");
    console.log("[20260202 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    console.log("[20260203 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    setConversation((prev) => {
      if (!prev) return prev;
      const nextIndex = Math.max(0, prev.currentIndex - 1);
      return { ...prev, currentIndex: nextIndex };
    });
  }, []);

  const nextTurn = useCallback(() => {
    __convLog("[***CONV:HOOK]", __convTs(), "nextTurn");
    console.log("[20260202 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    console.log("[20260203 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    setConversation((prev) => {
      if (!prev) return prev;
      const nextIndex = Math.min(prev.turns.length - 1, prev.currentIndex + 1);
      return { ...prev, currentIndex: nextIndex };
    });
  }, []);

  const closeConversation = useCallback(() => {
    __convLog("[***CONV:HOOK]", __convTs(), "closeConversation");
    console.log("[20260202 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    console.log("[20260203 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    setConversation((prev) => (prev ? { ...prev, isOpen: false } : prev));
  }, []);

  /**
   * clearConversation
   * --------------------------------------------------
   * 用途：
   * - 當「產生新的例句」時，必須清除舊對話與切換箭頭
   * 行為：
   * - 關閉 overlay（isOpen=false）
   * - 清空對話 state（conversation=null）
   * - 清空對話 history（避免帶到下一個例句）
   */
  const clearConversation = useCallback(() => {
    __convLog("[***CONV:HOOK]", __convTs(), "clearConversation");
    try {
      historyRef.current = [];
      historySentenceKeyRef.current = "";
      // 同步清掉當前卡片的 snapshot，避免下次又被載回
      const k = __activeKeyRef.current || __resolvedKey;
      if (k && __storeRef.current && __storeRef.current[k]) {
        delete __storeRef.current[k];
      }
    } catch (e) {
      // ignore
    }
    console.log("[20260202 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    console.log("[20260203 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    setConversation(null);
    setConversationError("");
    setConversationLoading(false);
  }, [__resolvedKey]);

  const isOpen =
    conversation && typeof conversation.isOpen === "boolean"
      ? conversation.isOpen
      : false;

  return {
    conversation,
    loading: conversationLoading,
    error: conversationError,
    isOpen,
    openConversation,
    closeConversation,
    clearConversation,
    nextTurn,
    prevTurn,
    MOSAIC_LINE,
  };
}