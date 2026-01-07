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
 */

// frontend/src/components/conversation/useConversation.jsx
import { useState, useCallback, useRef } from "react";

const MOSAIC_LINE = "----------------------------";

/**
 * API_BASE_URL
 * --------------------------------------------------
 * 說明：
 * - 正式環境（Vercel）必須使用完整 backend URL
 * - 本機環境可由 Vite proxy 或 .env 控制
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

export default function useConversation({ mainSentence, explainLang }) {
  const [conversation, setConversation] = useState(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState("");

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
   * - 使用相對路徑 /api/...，在 Vercel 會打到前端網域造成 404
   * - 僅保留作為歷史紀錄與回溯用途
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
   * - 使用 API_BASE_URL，與 analyze / examples / tts 行為一致
   */
  const fetchConversationFromBackend = useCallback(async () => {
    if (!mainSentence) return buildFakeConversation(mainSentence);

    try {
      setConversationLoading(true);
      setConversationError("");

      const res = await fetch(`${API_BASE_URL}/api/dictionary/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sentence: mainSentence,
          explainLang: explainLang || "zh-TW",
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      let turns = [];
      if (Array.isArray(data.turns)) {
        turns = normalizeTurns(data.turns);
      } else if (Array.isArray(data.conversation)) {
        turns = normalizeTurns(data.conversation);
      } else if (Array.isArray(data)) {
        // ✅ 2026-01-07：後端直接回傳 Array（最常見：[{de, translation}, ...]）
        turns = normalizeTurns(data);

        if (!hasLoggedArrayResponseRef.current) {
          hasLoggedArrayResponseRef.current = true;
          // eslint-disable-next-line no-console
          console.log("[conversation] backend returned Array directly (sample)", data && data[0]);
        }
      }

      if (!turns || turns.length === 0) {
        turns = buildFakeConversation(mainSentence);
      }

      return turns;
    } catch (err) {
      console.error("[conversation] 後端產生錯誤", err);
      setConversationError("對話產生失敗，改用範例對話。");
      return buildFakeConversation(mainSentence);
    } finally {
      setConversationLoading(false);
    }
  }, [mainSentence, explainLang]);

  const openConversation = useCallback(async () => {
    if (!mainSentence) return;

    // 已經有對話 → 只切換開關
    if (conversation && conversation.turns && conversation.turns.length > 0) {
      setConversation((prev) => (prev ? { ...prev, isOpen: !prev.isOpen } : prev));
      return;
    }

    // 第一次點，去後端拿資料
    setConversation({
      turns: [],
      currentIndex: 0,
      isOpen: true,
    });

    const turns = await fetchConversationFromBackend();

    setConversation({
      turns,
      currentIndex: 0,
      isOpen: true,
    });
  }, [conversation, fetchConversationFromBackend, mainSentence]);

  const prevTurn = useCallback(() => {
    setConversation((prev) => {
      if (!prev) return prev;
      const nextIndex = Math.max(0, prev.currentIndex - 1);
      return { ...prev, currentIndex: nextIndex };
    });
  }, []);

  const nextTurn = useCallback(() => {
    setConversation((prev) => {
      if (!prev) return prev;
      const nextIndex = Math.min(prev.turns.length - 1, prev.currentIndex + 1);
      return { ...prev, currentIndex: nextIndex };
    });
  }, []);

  const closeConversation = useCallback(() => {
    setConversation((prev) => (prev ? { ...prev, isOpen: false } : prev));
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
    nextTurn,
    prevTurn,
    MOSAIC_LINE,
  };
}

// frontend/src/components/conversation/useConversation.jsx
