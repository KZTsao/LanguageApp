// frontend/src/components/legal/TermsRenderer.jsx

import { useEffect, useState } from "react";

function TermsRenderer({ uiLang }) {
  const [content, setContent] = useState("");

  useEffect(() => {
    const lang = uiLang || "en";
    fetch(`/terms/terms.${lang}.md`)
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setContent("Failed to load terms."));
  }, [uiLang]);

  return (
    <div
      style={{
        overflowY: "auto",
        maxHeight: "60vh",
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
      }}
    >
      {content}
    </div>
  );
}

export default TermsRenderer;

// /frontend/src/components/legal/TermsRenderer.jsx
