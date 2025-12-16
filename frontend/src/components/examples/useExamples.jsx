import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../utils/apiClient";

export default function useExamples({
  d,
  senseIndex,
  caseOpt,
  articleType,
  explainLang,
}) {
  const [examples, setExamples] = useState(
    d && Array.isArray(d.examples)
      ? d.examples
      : d && d.example
      ? [d.example]
      : []
  );

  const [exampleTranslation, setExampleTranslation] = useState(
    d && typeof d.exampleTranslation === "string"
      ? d.exampleTranslation
      : ""
  );

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!d) {
      setExamples([]);
      setExampleTranslation("");
      return;
    }

    if (Array.isArray(d.examples) && d.examples.length > 0) {
      setExamples(d.examples);
    } else if (typeof d.example === "string" && d.example.trim()) {
      setExamples([d.example]);
    } else {
      setExamples([]);
    }

    if (
      typeof d.exampleTranslation === "string" &&
      d.exampleTranslation.trim()
    ) {
      setExampleTranslation(d.exampleTranslation.trim());
    } else {
      setExampleTranslation("");
    }
  }, [d]);

  const refreshExamples = useCallback(async () => {
    if (!d || !d.word) return;

    setLoading(true);

    try {
      const resp = await apiFetch("/api/dictionary/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: d.word,
          baseForm: d.baseForm,
          partOfSpeech: d.partOfSpeech,
          gender: d.gender,
          senseIndex,

          definitionDe: d.definition_de,
          definition: d.definition,
          definitionDeList: d.definition_de_list || [],
          definitionLangList: d.definition_list || [],

          explainLang,

          options: {
            polarity: "pos",
            case: caseOpt || undefined,
            articleType: articleType || undefined,
          },

          _ts: Date.now(),
        }),
      });

      const data = await resp.json();

      if (data && Array.isArray(data.examples)) {
        setExamples(
          data.examples.filter(
            (s) => typeof s === "string" && s.trim().length > 0
          )
        );

        if (
          typeof data.exampleTranslation === "string" &&
          data.exampleTranslation.trim()
        ) {
          setExampleTranslation(data.exampleTranslation.trim());
        }
      }
    } catch (err) {
      console.error("useExamples refresh error:", err);
    }

    setLoading(false);
  }, [d, senseIndex, caseOpt, articleType, explainLang]);

  useEffect(() => {
    if (!d || !d.word) return;
    refreshExamples();
  }, [d, senseIndex, explainLang, refreshExamples]);

  return {
    examples,
    exampleTranslation,
    loading,
    refreshExamples,
  };
}
