diff --git a/frontend/src/uiText.js b/frontend/src/uiText.js
--- a/frontend/src/uiText.js
+++ b/frontend/src/uiText.js
@@ -135,6 +135,28 @@
       // ✅ WordExampleBlock（新增：refs/multi-ref 共用字串集中）
       exampleBlock: {
         multiRefLabel: "多重參考",
+        // ✅ 2026-01-27：SentenceType（句型）— UI i18n（只做文案，不進 DB / options）
+        sentenceTypePrefix: "句型",
+        sentenceTypeSep: "：",
+        sentenceTypeLabel: {
+          default: "一般句（陳述）",
+          question_yesno: "問句（是／否）",
+          question_w: "問句（疑問詞）",
+          imperative: "命令句",
+          request_polite: "禮貌請求",
+          prohibition: "禁止／警告",
+          suggestion: "提議／建議",
+          exclamation: "感嘆句",
+        },
+        // ✅ 不即時重生：提示（沿用 refsDirtyHint 的語意）
+        sentenceTypeDirtyHint: "句型已變更，按重新產生才會套用",
+
         headwordRefLabel: "參考形式",
         headwordRefHint: "這個參考形式會提高例句出現機率，但不保證一定出現",
         refPlaceholder: "新增參考（名詞/動詞/文法）...",
@@ -494,6 +516,27 @@
       exampleBlock: {
         multiRefLabel: "Mehrfach-Referenz",
+        // ✅ 2026-01-27：SentenceType（Satztyp）— UI i18n
+        sentenceTypePrefix: "Satztyp",
+        sentenceTypeSep: ": ",
+        sentenceTypeLabel: {
+          default: "Aussagesatz",
+          question_yesno: "Ja/Nein-Frage",
+          question_w: "W-Frage",
+          imperative: "Imperativ",
+          request_polite: "Höfliche Bitte",
+          prohibition: "Verbot / Warnung",
+          suggestion: "Vorschlag",
+          exclamation: "Ausrufesatz",
+        },
+        sentenceTypeDirtyHint: "Satztyp geändert – bitte „Neu generieren“ klicken",
+
         headwordRefLabel: "Referenzform",
         headwordRefHint:
           "Diese Referenzform erhöht die Chance, dass sie im Beispielsatz vorkommt, ist aber nicht garantiert",
@@ -843,6 +886,27 @@
       exampleBlock: {
         multiRefLabel: "Multi-ref",
+        // ✅ 2026-01-27：SentenceType — UI i18n
+        sentenceTypePrefix: "Sentence",
+        sentenceTypeSep: ": ",
+        sentenceTypeLabel: {
+          default: "Statement",
+          question_yesno: "Yes/No Question",
+          question_w: "Wh-Question",
+          imperative: "Imperative",
+          request_polite: "Polite Request",
+          prohibition: "Prohibition / Warning",
+          suggestion: "Suggestion",
+          exclamation: "Exclamation",
+        },
+        sentenceTypeDirtyHint: "Sentence type changed — click “Regenerate” to apply",
+
         headwordRefLabel: "Reference form",
         headwordRefHint:
           "This reference form increases the chance it appears in examples, but it’s not guaranteed",
diff --git a/frontend/src/components/examples/ExampleList.jsx b/frontend/src/components/examples/ExampleList.jsx
--- a/frontend/src/components/examples/ExampleList.jsx
+++ b/frontend/src/components/examples/ExampleList.jsx
@@ -79,6 +79,14 @@
   refBadgesInline,
   refActionInline,
   refConfirm,
+
+  // ✅ 2026-01-27：SentenceType dropdown（由 WordExampleBlock 傳入；只管 UI）
+  sentenceTypeValue,
+  sentenceTypeOptions,
+  onSentenceTypeChange,
+  sentenceTypeDirtyHint,
 }) {
@@ -278,6 +286,12 @@
           headword={headword}
           headwordRefHint={headwordRefHint}
+
+          // ✅ sentenceType UI（放到 headword 旁邊，ⓘ 之前）
+          sentenceTypeValue={sentenceTypeValue}
+          sentenceTypeOptions={sentenceTypeOptions}
+          onSentenceTypeChange={onSentenceTypeChange}
+          sentenceTypeDirtyHint={sentenceTypeDirtyHint}
 
           multiRefEnabled={multiRefEnabled}
           onToggleMultiRef={onToggleMultiRef}
diff --git a/frontend/src/components/examples/ExampleSentence.jsx b/frontend/src/components/examples/ExampleSentence.jsx
--- a/frontend/src/components/examples/ExampleSentence.jsx
+++ b/frontend/src/components/examples/ExampleSentence.jsx
@@ -220,6 +220,14 @@
   onHeadwordClick,
   headwordClickTooltip,
+
+  // ✅ 2026-01-27：SentenceType dropdown（UI only）
+  sentenceTypeValue,
+  sentenceTypeOptions,
+  onSentenceTypeChange,
+  sentenceTypeDirtyHint,
 }) {
@@ -280,6 +288,23 @@
   const __headwordRefHint = (headwordRefHint || "").toString();
+
+  // ✅ sentenceType options normalize（UI only）
+  const __sentenceTypeValue = (sentenceTypeValue || "default").toString();
+  const __sentenceTypeOptions = Array.isArray(sentenceTypeOptions) ? sentenceTypeOptions : [];
+  const __hasSentenceTypeUI =
+    typeof onSentenceTypeChange === "function" && __sentenceTypeOptions.length > 0;
+
+  // ✅ dropdown style = headword badge style（同字型/同方框感）
+  const getSentenceTypeSelectWrapStyle = () => ({
+    ...getHeadwordBadgeStyle(true),
+    padding: "0px 8px",
+    cursor: "pointer",
+  });
+  const getSentenceTypeSelectStyle = () => ({
+    border: "none",
+    background: "transparent",
+    color: "inherit",
+    fontSize: 13,
+    fontWeight: 500,
+    lineHeight: 1.2,
+    outline: "none",
+    cursor: "pointer",
+  });
@@ -1509,6 +1534,24 @@
               <span
                 style={{
                   ...getHeadwordBadgeStyle(hasHeadword),
                 }}
               >
                 {safeHeadword}
                 </span>
+
+                {/* ✅ SentenceType dropdown：放在 headword 旁邊、ⓘ 之前（無「句型」標題） */}
+                {__hasSentenceTypeUI ? (
+                  <span
+                    title={sentenceTypeDirtyHint || ""}
+                    style={{ display: "inline-flex", alignItems: "center", marginLeft: 8 }}
+                    aria-label="sentenceType"
+                    data-ref="sentenceTypeDropdownInline"
+                    onClick={(e) => e.stopPropagation()}
+                  >
+                    <span style={getSentenceTypeSelectWrapStyle()}>
+                      <select
+                        value={__sentenceTypeValue}
+                        onChange={(e) => onSentenceTypeChange(e.target.value)}
+                        style={getSentenceTypeSelectStyle()}
+                      >
+                        {__sentenceTypeOptions.map((opt) => (
+                          <option key={opt.value} value={opt.value}>
+                            {opt.label}
+                          </option>
+                        ))}
+                      </select>
+                    </span>
+                  </span>
+                ) : null}
                 {__headwordRefHint && hasHeadword ? (
                   <span
                     title={__headwordRefHint}
                     onClick={(e) => e.stopPropagation()}
@@ -1556,6 +1599,24 @@
               <span
                 style={{
                   ...getHeadwordBadgeStyle(hasHeadword),
                   ...getHeadwordClickableStyle(false, !!loading),
                 }}
                 title={hasHeadword ? safeHeadword : "not available"}
                 aria-label="example-headword"
                 data-ref="exampleHeadwordBadge"
               >
                 {safeHeadword}
               </span>
+
+              {/* ✅ SentenceType dropdown：放在 headword 旁邊、ⓘ 之前（無「句型」標題） */}
+              {__hasSentenceTypeUI ? (
+                <span
+                  title={sentenceTypeDirtyHint || ""}
+                  style={{ display: "inline-flex", alignItems: "center", marginLeft: 8 }}
+                  aria-label="sentenceType"
+                  data-ref="sentenceTypeDropdownInline"
+                  onClick={(e) => e.stopPropagation()}
+                >
+                  <span style={getSentenceTypeSelectWrapStyle()}>
+                    <select
+                      value={__sentenceTypeValue}
+                      onChange={(e) => onSentenceTypeChange(e.target.value)}
+                      style={getSentenceTypeSelectStyle()}
+                    >
+                      {__sentenceTypeOptions.map((opt) => (
+                        <option key={opt.value} value={opt.value}>
+                          {opt.label}
+                        </option>
+                      ))}
+                    </select>
+                  </span>
+                </span>
+              ) : null}
               {__headwordRefHint && hasHeadword ? (
                 <span
                   title={__headwordRefHint}
                   onClick={(e) => e.stopPropagation()}
diff --git a/frontend/src/components/examples/WordExampleBlock.jsx b/frontend/src/components/examples/WordExampleBlock.jsx
--- a/frontend/src/components/examples/WordExampleBlock.jsx
+++ b/frontend/src/components/examples/WordExampleBlock.jsx
@@ -180,6 +180,12 @@
   const [multiRefEnabledByWordKey, setMultiRefEnabledByWordKey] = useState({});
   const [refsByWordKey, setRefsByWordKey] = useState({});
   const [dirtyByWordKey, setDirtyByWordKey] = useState({});
   const [refInputByWordKey, setRefInputByWordKey] = useState({});
+
+  // ✅ 2026-01-27：SentenceType（句型）— per wordKey（只做 UI，不改 schema）
+  const [sentenceTypeByWordKey, setSentenceTypeByWordKey] = useState({});
+  const [sentenceTypeDirtyByWordKey, setSentenceTypeDirtyByWordKey] = useState({});
@@ -224,6 +230,9 @@
   const multiRefEnabled = !!multiRefEnabledByWordKey[wordKey];
   const refs = Array.isArray(refsByWordKey[wordKey]) ? refsByWordKey[wordKey] : [];
   const dirty = !!dirtyByWordKey[wordKey];
+  const sentenceTypeValue =
+    typeof sentenceTypeByWordKey[wordKey] === "string" ? sentenceTypeByWordKey[wordKey] : "default";
+  const sentenceTypeDirty = !!sentenceTypeDirtyByWordKey[wordKey];
@@ -376,6 +385,26 @@
   const tMissingRefsHint = (tExampleBlock?.missingRefsHint || "missing refs").toString();
+
+  // ✅ SentenceType i18n（只做 UI 文案）
+  const tSentenceTypePrefix = (tExampleBlock?.sentenceTypePrefix || "Sentence").toString();
+  const tSentenceTypeSep = (tExampleBlock?.sentenceTypeSep || ": ").toString();
+  const tSentenceTypeLabelMap = tExampleBlock?.sentenceTypeLabel || {};
+  const tSentenceTypeDirtyHint = (tExampleBlock?.sentenceTypeDirtyHint || "").toString();
+
+  // ✅ dropdown options（封閉集合；不做第二層）
+  const sentenceTypeOptions = useMemo(() => {
+    const values = [
+      "default",
+      "question_yesno",
+      "question_w",
+      "imperative",
+      "request_polite",
+      "prohibition",
+      "suggestion",
+      "exclamation",
+    ];
+    return values.map((v) => ({
+      value: v,
+      label: `${tSentenceTypePrefix}${tSentenceTypeSep}${(tSentenceTypeLabelMap?.[v] || v).toString()}`,
+    }));
+  }, [tSentenceTypePrefix, tSentenceTypeSep, tSentenceTypeLabelMap]);
@@ -1062,9 +1091,15 @@
   const handleManualRefresh = useCallback(async () => {
     await refreshExamples();
     setDirtyByWordKey((prev) => ({
       ...prev,
       [wordKey]: false,
     }));
+    // ✅ 不即時重生：只有按「重新產生」才清掉 dirty
+    setSentenceTypeDirtyByWordKey((prev) => ({
+      ...prev,
+      [wordKey]: false,
+    }));
   }, [refreshExamples, wordKey]);
+
+  const handleSentenceTypeChange = useCallback(
+    (next) => {
+      setSentenceTypeByWordKey((prev) => ({ ...prev, [wordKey]: (next || "default").toString() }));
+      // ✅ 需求 5：不即時重新產生例句 → 只標記 dirty，等使用者按 Refresh
+      setSentenceTypeDirtyByWordKey((prev) => ({ ...prev, [wordKey]: true }));
+    },
+    [wordKey]
+  );
@@ -2104,6 +2139,12 @@
         <ExampleList
           examples={examples}
           loading={loading}
           sectionExample={tSectionExample}
           sectionExampleTranslation={tSectionExampleTranslation}
           exampleTranslation={generatedTranslation}
           onRefresh={handleManualRefresh}
           refreshTooltip={tRefreshExamplesTooltipLabel}
           onWordClick={onWordClick}
           onSpeak={handleSpeak}
           headword={headwordForExampleTitle}
           headwordRefHint={tHeadwordRefHint}
           explainLang={explainLang}
+
+          // ✅ SentenceType dropdown（放在 headword 旁邊、ⓘ 前；無「句型」標題）
+          sentenceTypeValue={sentenceTypeValue}
+          sentenceTypeOptions={sentenceTypeOptions}
+          onSentenceTypeChange={handleSentenceTypeChange}
+          sentenceTypeDirtyHint={sentenceTypeDirty ? tSentenceTypeDirtyHint : ""}
 
           conversationTitle={tConversationTitle}
           conversationToggleTooltip={tConversationToggleTooltip}
           conversationTurnLabel={tConversationTurnLabel}
           conversationPrevLabel={tConversationPrevLabel}
           conversationNextLabel={tConversationNextLabel}
           conversationPlayLabel={tConversationPlayLabel}
           conversationCloseLabel={tConversationCloseLabel}
           conversationLoadingLabel={tConversationLoadingLabel}
