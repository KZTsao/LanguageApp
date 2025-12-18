// frontend/src/components/examples/WordExampleBlock.jsx
import React, { useCallback, useState } from "react";
import { callTTS } from "../../utils/ttsClient";

import ExampleList from "./ExampleList";
import useExamples from "./useExamples";
import WordPosInfo from "../posInfo/WordPosInfo";

export default function WordExampleBlock({
  d,
  senseIndex,
  sectionExample,
  sectionExampleTranslation,
  exampleTranslation,
  explainLang,
  onWordClick,
  uiLang,

  // 以下保留舊 props，不使用，但不能刪（避免上層報錯）
  grammarOptionsLabel,
  grammarCaseLabel,
  grammarArticleLabel,
  grammarCaseNomLabel,
  grammarCaseAkkLabel,
  grammarCaseDatLabel,
  grammarCaseGenLabel,
  grammarArticleDefLabel,
  grammarArticleIndefLabel,
  grammarArticleNoneLabel,
  refreshExamplesTooltipLabel,
  grammarToggleLabel,

  conversationTitleLabel,
  conversationToggleTooltipLabel,
  conversationTurnLabel,
  conversationPrevLabel,
  conversationNextLabel,
  conversationPlayLabel,
  conversationCloseLabel,
  conversationLoadingLabel,
}) {
 

  // ✅ 方案 M：保留接線（不顯示 debug UI）
  const [selectedForm, setSelectedForm] = useState(null);

  // 語系判斷（簡單版）
  const isZh = explainLang?.startsWith("zh");
  const isEn = explainLang?.startsWith("en");
  const isJa = explainLang?.startsWith("ja");

  // ===== 多國：例句重新產生 tooltip =====
  const tRefreshTooltip =
    refreshExamplesTooltipLabel ||
    (isEn ? "Regenerate examples" : isJa ? "例文を再生成" : "重新產生例句");

  // ===== 多國：連續對話相關字串 =====
  const tConversationTitle =
    conversationTitleLabel ||
    (isEn ? "Conversation" : isJa ? "連続会話" : "連續對話");

  const tConversationToggleTooltip =
    conversationToggleTooltipLabel ||
    (isEn ? "Generate conversation" : isJa ? "連続会話を生成" : "產生連續對話");

  const tConversationTurn =
    conversationTurnLabel || (isEn ? "turn" : isJa ? "ターン" : "turn");

  const tConversationPrev =
    conversationPrevLabel || (isEn ? "Prev" : isJa ? "前の文" : "上一句");

  const tConversationNext =
    conversationNextLabel || (isEn ? "Next" : isJa ? "次の文" : "下一句");

  const tConversationPlay =
    conversationPlayLabel || (isEn ? "Play" : isJa ? "再生" : "播放");

  const tConversationClose =
    conversationCloseLabel || (isEn ? "Close" : isJa ? "閉じる" : "關閉");

  const tConversationLoading =
    conversationLoadingLabel ||
    (isEn ? "Generating conversation…" : isJa ? "会話を生成中…" : "對話產生中…");

  // ⭐ useExamples：固定使用預設條件產生例句（已移除調整句型）
  const {
    examples,
    exampleTranslation: generatedTranslation,
    loading,
    refreshExamples,
  } = useExamples({
    d,
    senseIndex,
    explainLang,
  });

  const effectiveExampleTranslation =
    generatedTranslation || exampleTranslation || "";

  async function handleSpeak(sentence) {
    try {
      if (!sentence) return;
      const audioBase64 = await callTTS(sentence, "de-DE");
      const audio = new Audio(audioBase64);
      audio.play();
    } catch (err) {
      console.error("[TTS 播放失敗]", err);
    }
  }

  // ✅ 手動重新產生例句
  const handleManualRefresh = useCallback(async () => {
    await refreshExamples();
  }, [refreshExamples]);

  // ✅ 把字典複數塞進 extraInfo，讓 WordPosInfo → WordPosInfoNoun 吃得到
  const injectedPlural =
    typeof (d?.plural || d?.pluralForm || d?.nounPlural || d?.pluralBaseForm) ===
    "string"
      ? (d.plural || d.pluralForm || d.nounPlural || d.pluralBaseForm).trim()
      : "";

  return (
    <div style={{ marginTop: 20 }}>
      {d && (d.baseForm || d.word) && (
        <WordPosInfo
          partOfSpeech={d.partOfSpeech}
          baseForm={d.baseForm || d.word}
          gender={d.gender}
          uiLabels={{}}
          extraInfo={{
            plural: injectedPlural,
            dictionary: d,
          }}
          type={d.type}
          uiLang={uiLang}
          // ✅ 方案 M：保留接線（noun/verb 都可用），但不顯示任何 debug UI
          onSelectForm={setSelectedForm}
          onWordClick={onWordClick}
        />
      )}

      <ExampleList
        examples={Array.isArray(examples) ? examples : []}
        loading={loading}
        sectionExample={sectionExample}
        sectionExampleTranslation={sectionExampleTranslation}
        exampleTranslation={effectiveExampleTranslation}
        onSpeak={handleSpeak}
        onRefresh={handleManualRefresh}
        refreshTooltip={tRefreshTooltip}
        onWordClick={onWordClick}
        explainLang={explainLang}
        conversationTitle={tConversationTitle}
        conversationToggleTooltip={tConversationToggleTooltip}
        conversationTurnLabel={tConversationTurn}
        conversationPrevLabel={tConversationPrev}
        conversationNextLabel={tConversationNext}
        conversationPlayLabel={tConversationPlay}
        conversationCloseLabel={tConversationClose}
        conversationLoadingLabel={tConversationLoading}
      />
    </div>
  );
}
// frontend/src/components/examples/WordExampleBlock.jsx
