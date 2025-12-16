import { useState, useCallback } from "react";

const MOSAIC_LINE = "----------------------------";

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

  const fetchConversationFromBackend = useCallback(async () => {
    if (!mainSentence) return buildFakeConversation(mainSentence);

    try {
      setConversationLoading(true);
      setConversationError("");

      const res = await fetch("/api/dictionary/conversation", {
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
      setConversation((prev) =>
        prev ? { ...prev, isOpen: !prev.isOpen } : prev
      );
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
      const nextIndex = Math.min(
        prev.turns.length - 1,
        prev.currentIndex + 1
      );
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
