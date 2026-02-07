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

import { useState, useCallback, useRef } from "react";
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
        const translation =
          typeof item.translation === "string"
            ? item.translation.trim()
            : typeof item.trans === "string"
            ? item.trans.trim()
            : "";
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

export default function useConversation({ mainSentence, mainTranslation, explainLang }) {
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
    if (!mainSentence) return buildFakeConversation(mainSentence);

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
        // ✅ 401：不要 fallback 造假（避免你以為後端/LLM 有進）
        if (res.status === 401) {
          setConversationError("401 Unauthorized");
          return null;
        }
        throw new Error(`HTTP ${res.status}`);
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
          usedFallback: true,
        });
        // 非 401 的情況下才 fallback（避免 UI 全掛）
        turns = buildFakeConversation(mainSentence);
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

      // ✅ 成功後：更新本地 history（最多保留 6 筆，避免無限增長）
      try {
        const nextHistory = [];
        if (sentenceKey) nextHistory.push({ role: "user", content: sentenceKey });
        for (const t of turns) {
          if (t && typeof t.de === "string" && t.de.trim()) {
            nextHistory.push({ role: "assistant", content: t.de.trim() });
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
      setConversationError("對話產生失敗，改用範例對話。");
      return buildFakeConversation(mainSentence);
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

    // ✅ 401 / Unauthorized：fetchConversationFromBackend 會回 null
    if (!turns) {
      console.log("[20260202 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
      console.log("[20260203 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
      setConversation(null);
      return;
    }

    __convLog("[***CONV:HOOK]", __convTs(), "fetched", {
      turnsCount: Array.isArray(turns) ? turns.length : 0,
    });

    const ensured = ensureLeadSentenceTurn(turns, mainSentence, mainTranslation);
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
    } catch (e) {
      // ignore
    }
    console.log("[20260202 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    console.log("[20260203 record][useConversation][setConversation-call]", { ts: Date.now(), stack: (new Error()).stack });
    setConversation(null);
    setConversationError("");
    setConversationLoading(false);
  }, []);

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