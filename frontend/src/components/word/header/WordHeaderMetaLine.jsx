// frontend/src/components/WordCard.jsx

function WordCard({ data, labels = {}, onWordClick, onSpeak }) {
  if (!data) return null;
  const d = data.dictionary || {};

  /* ------------------------
     冠詞顏色（支援 theme）
     ------------------------ */
  const genderColors = {
    der: "var(--article-der)",
    die: "var(--article-die)",
    das: "var(--article-das)",
  };
  const pluralArticleColor = "var(--article-plural)";

  const article = d.gender || "";
  const articleColor = genderColors[article] || "var(--text-main)";

  /* ------------------------
     Labels
     ------------------------ */
  const {
    labelPlural = "複數",
    labelRoot = "詞根",
    labelDefinition = "釋義",
    sectionExample = "例句",
    sectionExampleTranslation = "翻譯",
    sectionNotes = "補充說明",
    posLocalNameMap: externalPosLocalNameMap,
  } = labels;

  const defaultPosLocalNameMap = {
    Nomen: "名詞",
    Verb: "動詞",
    Adjektiv: "形容詞",
    Adverb: "副詞",
    Artikel: "冠詞",
    Pronomen: "代名詞",
    Präposition: "介系詞",
    Konjunktion: "連接詞",
    Numerale: "數詞",
    Interjektion: "感歎詞",
    Partikel: "語氣詞／功能小詞",
    Hilfsverb: "助動詞",
    Modalverb: "情態動詞",
    Reflexivpronomen: "反身代名詞",
    Possessivpronomen: "所有格代名詞",
  };
  const posLocalNameMap = externalPosLocalNameMap || defaultPosLocalNameMap;

  /* ------------------------
     詞性轉換
     ------------------------ */
  const rawPos = d.partOfSpeech || "";
  const rawPosKey = rawPos ? rawPos.trim().toLowerCase() : "";

  const posKeyMap = {
    noun: "Nomen",
    substantiv: "Nomen",
    nomen: "Nomen",
    verb: "Verb",
    adjective: "Adjektiv",
    adjektiv: "Adjektiv",
    adverb: "Adverb",
    artikel: "Artikel",
    pronomen: "Pronomen",
    pronoun: "Pronomen",
    präposition: "Präposition",
    preposition: "Präposition",
    konjunktion: "Konjunktion",
    numerale: "Numerale",
    zahlwort: "Numerale",
    interjektion: "Interjektion",
    partikel: "Partikel",
    hilfsverb: "Hilfsverb",
    modalverb: "Modalverb",
  };

  const canonicalPos =
    rawPosKey && posKeyMap[rawPosKey] ? posKeyMap[rawPosKey] : rawPos;

  let posDisplay = "";
  if (canonicalPos) {
    const local = posLocalNameMap[canonicalPos];
    posDisplay = `${canonicalPos}${local ? `（${local}）` : ""}`;
  }

  /* ------------------------
     釋義（中文母語）多義拆分
     ------------------------ */

  // 將 d.definition 正規化成陣列，支援字串 / 陣列
  let definitionList = [];
  if (Array.isArray(d.definition)) {
    definitionList = d.definition
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  } else if (typeof d.definition === "string") {
    const raw = d.definition.trim();
    if (raw) {
      // 以常見分隔符號切分：； ; ／ / 、 等
      const parts = raw
        .split(/[；;／/、]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      definitionList = parts.length > 0 ? parts : [raw];
    }
  }

  // ① ② ③… 超過 10 個就用數字加點
  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  const getDefinitionIndexLabel = (idx) =>
    circledNumbers[idx] || `${idx + 1}.`;

  /* ------------------------
     Definition(DE) 多義處理
     - definition_de / definition_de_translation 可能是字串或陣列
     ------------------------ */

  // 將 definition_de 正規化成陣列
  let definitionDeList = [];
  if (Array.isArray(d.definition_de)) {
    definitionDeList = d.definition_de
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((s) => s.length > 0);
  } else if (typeof d.definition_de === "string" && d.definition_de.trim()) {
    definitionDeList = [d.definition_de.trim()];
  }

  // 將 definition_de_translation 正規化成陣列
  let definitionDeTransList = [];
  if (Array.isArray(d.definition_de_translation)) {
    definitionDeTransList = d.definition_de_translation
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((s) => s.length > 0);
  } else if (
    typeof d.definition_de_translation === "string" &&
    d.definition_de_translation.trim()
  ) {
    definitionDeTransList = [d.definition_de_translation.trim()];
  }

  // fallback：如果沒有 definition_de_translation，就用中文釋義拼起來
  if (definitionDeTransList.length === 0) {
    const fallbackHint = Array.isArray(d.definition)
      ? d.definition.join("；")
      : d.definition || "";
    if (fallbackHint) {
      definitionDeTransList = [fallbackHint];
    }
  }

  const getDefinitionDeHint = (index) => {
    if (definitionDeTransList.length === 0) return "";
    if (definitionDeTransList.length === 1) return definitionDeTransList[0];
    return definitionDeTransList[index] || definitionDeTransList[0];
  };

  /* ------------------------
     例句翻譯
     ------------------------ */
  const exampleTranslation =
    typeof (d.exampleTranslation || d.example_translation) === "string"
      ? d.exampleTranslation || d.example_translation
      : "";

  /* ------------------------
     Token Rendering（支援 hover 整句翻譯）
     ------------------------ */
  const renderClickableText = (text, hoverHint) => {
    if (!text) return null;

    const tokens = text.split(/(\s+|[.,!?;:"()«»„“”])/);
    return tokens.map((tok, idx) => {
      if (!tok.trim()) return tok;
      if (!/[A-Za-zÄÖÜäöüß]/.test(tok)) return tok;

      return (
        <span
          key={idx}
          onClick={() => onWordClick(tok)}
          title={hoverHint}
          style={{
            cursor: "pointer",
            textDecoration: "underline dotted",
            textUnderlineOffset: 2,
          }}
        >
          {tok}
        </span>
      );
    });
  };

  const headword = d.word || data.text;
  const headerSpeakText = `${article ? article + " " : ""}${headword}`.trim();

  /* ------------------------
     UI Render
     ------------------------ */
  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        // 你原本已經關掉大型陰影，避免亮色主題下出現不自然色塊
        boxShadow: "none",
      }}
    >
      {/* Header */}
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
              color: articleColor,
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

        <button
          onClick={() => onSpeak(headerSpeakText)}
          style={{
            padding: "2px 6px",
            borderRadius: 999,
            border: "none",
            background: "var(--chip-bg)",
            cursor: "pointer",
          }}
        >
          🔊
        </button>
      </div>

      {/* 詞性 */}
      {posDisplay && (
        <div
          style={{
            color: "var(--text-muted)",
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          {posDisplay}
        </div>
      )}

      {/* 分隔線 */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right, transparent, var(--border-subtle), transparent)",
          marginBottom: 10,
        }}
      />

      {/* 釋義（多義 + ①②③） */}
      {definitionList.length > 0 && (
        <div style={{ marginBottom: 8, fontSize: 14 }}>
          <strong>{labelDefinition}：</strong>
          <div style={{ marginTop: 4 }}>
            {definitionList.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    marginRight: 4,
                    fontSize: 14,
                    lineHeight: 1.4,
                  }}
                >
                  {getDefinitionIndexLabel(idx)}
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Definition (DE) — 多義對應 + ①②③ */}
      {definitionDeList.length > 0 && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 8,
          }}
        >
          <div style={{ marginBottom: 2 }}>Definition (DE)：</div>

          <div>
            {definitionDeList.map((sentence, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                  marginBottom: 2,
                }}
              >
                <span>{getDefinitionIndexLabel(idx)}</span>
                <span style={{ color: "var(--text-main)" }}>
                  {renderClickableText(sentence, getDefinitionDeHint(idx))}
                </span>
                <button
                  onClick={() => onSpeak(sentence)}
                  style={{
                    padding: "2px 6px",
                    borderRadius: 999,
                    border: "none",
                    background: "var(--chip-bg)",
                    cursor: "pointer",
                  }}
                >
                  🔊
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 複數 */}
      {d.plural && (
        <div
          style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}
        >
          <strong>{labelPlural}：</strong>
          {/* 只讓「die」上色，名詞保持一般字色，點擊仍是整個短語 */}
          <span
            onClick={() => onWordClick(d.plural)}
            style={{ cursor: "pointer" }}
          >
            <span
              style={{
                color: pluralArticleColor,
                textShadow: "var(--text-outline)",
              }}
            >
              die
            </span>{" "}
            <span style={{ color: "var(--text-main)" }}>{d.plural}</span>
          </span>

          <button
            onClick={() => onSpeak(`die ${d.plural}`)}
            style={{
              padding: "2px 6px",
              borderRadius: 999,
              border: "none",
              background: "var(--chip-bg)",
              cursor: "pointer",
            }}
          >
            🔊
          </button>
        </div>
      )}

      {/* 例句 */}
      {d.example && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: 13,
              display: "flex",
              gap: 6,
            }}
          >
            <span>{sectionExample}</span>
            <button
              onClick={() => onSpeak(d.example)}
              style={{
                padding: "2px 6px",
                borderRadius: 999,
                border: "none",
                background: "var(--chip-bg)",
                cursor: "pointer",
              }}
            >
              🔊
            </button>
          </div>

          <div
            style={{
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 12,
              background: "var(--card-subtle-bg)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* 德文例句（hover 整句翻譯） */}
            <div
              style={{
                borderLeft: "2px solid var(--border-subtle)",
                paddingLeft: 10,
              }}
            >
              {renderClickableText(d.example, exampleTranslation)}
            </div>

            {exampleTranslation && (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)", marginRight: 4 }}>
                  {sectionExampleTranslation}：
                </span>
                {exampleTranslation}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 補充說明（如果有） */}
      {d.notes && (
        <div style={{ marginTop: 14, fontSize: 13 }}>
          <div
            style={{
              color: "var(--text-muted)",
              marginBottom: 4,
            }}
          >
            {sectionNotes}
          </div>
          <div>{d.notes}</div>
        </div>
      )}
    </div>
  );
}

export default WordCard;
