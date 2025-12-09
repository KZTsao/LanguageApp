// frontend/src/components/useExamples.jsx

import { useState, useEffect, useCallback } from "react";

// ✅ 統一管理後端 base URL：本機用 localhost，正式環境用 Render
const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:4000"
    : "https://languageapp-8j45.onrender.com";

  console.log("📘 [useExamples] API_BASE:", API_BASE);

export default function useExamples({
  d,
  senseIndex,
  caseOpt,
  articleType,
  explainLang,
}) {
  // 例句陣列
  const [examples, setExamples] = useState(
    d && Array.isArray(d.examples)
      ? d.examples
      : d && d.example
      ? [d.example]
      : []
  );

  // 例句翻譯
  const [exampleTranslation, setExampleTranslation] = useState(
    d && typeof d.exampleTranslation === "string"
      ? d.exampleTranslation
      : ""
  );

  const [loading, setLoading] = useState(false);

  // ⭐ 只要 d 改變（含換 UI 語言重新查），就從 d 重新同步例句＋翻譯
  useEffect(() => {
    if (!d) {
      setExamples([]);
      setExampleTranslation("");
      return;
    }

    // 同步例句
    if (Array.isArray(d.examples) && d.examples.length > 0) {
      setExamples(d.examples);
    } else if (typeof d.example === "string" && d.example.trim()) {
      setExamples([d.example]);
    } else {
      setExamples([]);
    }

    // 同步翻譯（依照後端當次 explainLang）
    if (
      typeof d.exampleTranslation === "string" &&
      d.exampleTranslation.trim()
    ) {
      setExampleTranslation(d.exampleTranslation.trim());
    } else {
      setExampleTranslation("");
    }
  }, [d]);

  const refreshExamples = useCallback(
    async () => {
      if (!d || !d.word) {
        console.log("[useExamples] refreshExamples called but no d.word", { d });
        return;
      }

      console.log("[useExamples] refreshExamples START", {
        word: d.word,
        baseForm: d.baseForm,
        partOfSpeech: d.partOfSpeech,
        gender: d.gender,
        senseIndex,
        caseOpt,
        articleType,
        explainLang,
      });

      setLoading(true);

      try {
        // 🔁 這裡改成打到後端 API_BASE，而不是相對路徑
        const resp = await fetch(`${API_BASE}/api/dictionary/examples`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: d.word,
            baseForm: d.baseForm,
            partOfSpeech: d.partOfSpeech,
            gender: d.gender,
            senseIndex,

            // 單義備用
            definitionDe: d.definition_de,
            definition: d.definition,

            // 多義字：把所有義項清單丟給後端，讓 senseIndex 有意義
            definitionDeList: d.definition_de_list || [],
            definitionLangList: d.definition_list || [],

            explainLang,

            options: {
              case: caseOpt,
              articleType,
              polarity: "pos",
            },

            _ts: Date.now(),
          }),
        });

        console.log(
          "[useExamples] fetch response",
          resp.status,
          resp.ok,
          "→",
          `${API_BASE}/api/dictionary/examples`
        );

        let data = null;
        try {
          data = await resp.json();
        } catch (e) {
          console.error("[useExamples] resp.json() error:", e);
        }

        console.log("[useExamples] response JSON:", data);

        if (data && Array.isArray(data.examples)) {
          setExamples((prev) => {
            const next = data.examples.filter(
              (s) => typeof s === "string" && s.trim().length > 0
            );
            if (next.length === 0 && prev && prev.length > 0) {
              console.warn(
                "[useExamples] empty examples from API, keep previous examples"
              );
              return prev;
            }
            return next;
          });

          if (
            typeof data.exampleTranslation === "string" &&
            data.exampleTranslation.trim().length > 0
          ) {
            setExampleTranslation(data.exampleTranslation.trim());
          }
        } else {
          console.warn("[useExamples] no examples array in response");
          setExamples((prev) => prev || []);
        }
      } catch (err) {
        console.error("useExamples refresh error:", err);
      }

      setLoading(false);
      console.log("[useExamples] refreshExamples END");
    },
    [d, senseIndex, caseOpt, articleType, explainLang]
  );

  // 回傳給外面使用
  return { examples, exampleTranslation, loading, refreshExamples };
}
