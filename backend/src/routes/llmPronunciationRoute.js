// PATH: backend/src/routes/llmPronunciationRoute.js
const express = require("express");
const router = express.Router();

const { callGroqChat } = require("../clients/groqClient"); 
// ↑ 你專案裡已經有 groqClient（dictionary/examples 在用）

router.post("/pronunciation-feedback", async (req, res) => {
  try {
    const { target, asr, lang = "de", uiLang = "zh-TW" } = req.body || {};

    if (!target || !asr) {
      return res.status(400).json({ error: "missing target or asr" });
    }

    const systemPrompt = `
你是一位德語發音教練。
請比較「目標句」與「語音辨識結果」，只給 **一到兩句** 發音建議。
- 用 ${uiLang === "zh-TW" ? "繁體中文" : uiLang}
- 不要教文法
- 不要稱讚
- 不要重述句子
- 聚焦母音、子音、重音或連音
`;

    const userPrompt = `
【目標句】
${target}

【辨識結果】
${asr}

請給精簡發音建議：
`;

    const llm = await callGroqChat({
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: userPrompt.trim() },
      ],
      temperature: 0.2,
      max_tokens: 80,
    });

    const feedback =
      llm?.content?.trim() ||
      llm?.choices?.[0]?.message?.content?.trim() ||
      "";

    return res.json({ feedback });
  } catch (e) {
    console.error("[llmPronunciationRoute] error", e);
    return res.status(500).json({ error: "llm_failed" });
  }
});

module.exports = router;

// END PATH: backend/src/routes/llmPronunciationRoute.js
