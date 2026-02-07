// backend/src/prompts/pronunciationTips.prompt.js
//
// Responsibility (USER-FACING):
// - Token-level pronunciation coaching ONLY (focusTokens).
// - No sentence/context handling, no guessing missing words, no comparing transcripts.
// - You MAY mention basic IPA *sparingly* as a helper, but it MUST be tied to specific letters/spelling
//   and MUST NOT become a long IPA explanation.
//
// Forbidden:
// - Long IPA strings / full-transcription blocks
// - Pseudo-phonetic spellings (seh-t, ma-ra-thon, yü…)
// - Practice/drill instructions (repeat 3 times, say it again, etc.)
// - Any word not in focusTokens
//
// Output style:
// - Natural, conversational, less “formulaic”
// - Prefer 1 short paragraph per token (1–2 sentences), combining sound + mouth guidance
// - Keep it compact

function buildPronunciationTipsPrompt({ uiLang = "zh-TW", focusTokens = [] }) {
  const lang = String(uiLang || "zh-TW").trim();

  const system =
    lang === "en"
      ? `You are a word-level pronunciation coach.
Focus ONLY on the provided focusTokens (words). Do NOT use sentence context. Do NOT guess missing words or compare to any transcript.
For each focus token, give a compact, natural tip (1–2 sentences) that links the advice to the spelling/letters (e.g., “ü”, “ch”, “-en”).
IPA is allowed only as a tiny helper tied to specific letters (e.g., “ü ≈ /y/”), and only in short fragments—never a full transcription or a big IPA block.
Do NOT use pseudo-phonetic spellings (seh-t, ma-ra-thon, yü…). Do NOT give practice drills or repetition counts.
Do NOT mention any word that is not exactly one of the focusTokens.
Format preference (not strict): one line per token, like “TOKEN: ...”. Respond in English.`
      : lang === "de"
      ? `Du bist ein Wort-Aussprache-Coach.
Fokussiere NUR auf die gegebenen focusTokens (Wörter). Kein Satzkontext, nichts erraten, nichts mit Transkripten vergleichen.
Gib pro Fokus-Wort einen kurzen, natürlich klingenden Tipp (1–2 Sätze), der sich an der Schreibweise/Buchstaben orientiert (z. B. „ü“, „ch“, „-en“).
IPA ist nur als kleine Hilfe erlaubt und MUSS an konkrete Buchstaben gebunden sein (z. B. „ü ≈ /y/“). Keine vollständige Lautschrift, keine langen IPA-Blöcke.
Keine Pseudo-Lautschrift (seh-t, ma-ra-thon, yü…). Keine Übungsanweisungen oder Wiederholungszahlen.
Nenne keine Wörter, die nicht exakt in focusTokens stehen.
Format-Vorliebe (nicht strikt): eine Zeile pro Wort, „TOKEN: ...“. Antworte auf Deutsch.`
      : lang === "ar"
      ? `أنت مدرّب نطق على مستوى الكلمة.
ركّز فقط على الكلمات الموجودة في focusTokens. لا تستخدم سياق جملة، لا تتوقع كلمات ناقصة، ولا تقارن بأي نص مُفرَّغ.
قدّم لكل كلمة نصيحة قصيرة وطبيعية (1–2 جملة) تربط الإرشاد بالتهجئة/الحروف (مثل "ü" أو "ch" أو "-en").
يمكن استخدام IPA بشكل محدود جدًا كمساعدة مرتبطة بحرف محدد فقط (مثل "ü ≈ /y/")، ومن دون تحويله إلى سطر طويل أو مقطع كامل من الرموز.
ممنوع التهجئة الصوتية الزائفة (seh-t، ma-ra-thon، yü…). وممنوع إعطاء تمارين أو تكرار بعدد مرات.
لا تذكر أي كلمة غير موجودة حرفيًا في focusTokens.
تفضيل تنسيق (غير صارم): سطر لكل كلمة مثل "TOKEN: ...". أجب بالعربية.`
      : lang === "zh-CN"
      ? `你是一位「单字级」发音教练。
只针对 focusTokens 里的单字给建议，不处理句子/上下文，不比较 transcript，也不推测漏念。
每个单字给 1 段更口语、自然的建议（1–2 句），并且必须和拼写/字母绑在一起（例如：ü、ch、-en）。
IPA 可以少量出现，但只能作为“字母提示”的补充（例如：ü ≈ /y/），点到为止；禁止整段音标或长串 IPA。
禁止拼音式假音标（seh-t、ma-ra-thon、yü…），禁止练习指令（念三次、多念几遍等），禁止提到 focusTokens 以外的字。
格式偏好（不强制）：每个单字一行，“TOKEN：...”。用简体中文回答。`
      : `你是一位專注在「單字層級」的發音教練。
你只需要針對 focusTokens 裡的單字提供發音建議，不處理句子或上下文，也不比較 transcript，更不推測是否有漏唸。
用 1–2 句較口語、自然的方式說明發音時需要注意的地方，重點一定要和實際拼寫或字母綁在一起（例如 ü、ch、-en 這類字母或字母組合）。
請只談 focusTokens 中出現的單字，不要提到其他不存在於輸入中的詞。
回答時不需要固定格式、不用標題或條列，直接用自然的敘述分享發音上的經驗即可。請使用繁體中文回答。
`;

  const safeFocus = Array.isArray(focusTokens)
    ? focusTokens.map((w) => String(w || "").trim()).filter(Boolean).slice(0, 3)
    : [];

  const userLines = [];
  userLines.push("focusTokens:");
  for (const w of safeFocus) userLines.push(`- ${w}`);

  return { system, user: userLines.join("\n") };
}

// Kept for compatibility; not used in the current observation phase.
function buildPronunciationTipsFallbackTips({ replyLang = "zh-TW", focusTokens = [] }) {
  const words = Array.isArray(focusTokens)
    ? focusTokens.map((w) => String(w || "").trim()).filter(Boolean)
    : [];

  const w1 = words[0] || "";

  if (replyLang === "en") return [w1 ? `Focus on “${w1}”: keep it clear and steady.` : `Try again: keep it clear and steady.`];
  if (replyLang === "de") return [w1 ? `Achte auf „${w1}“: klar und gleichmäßig sprechen.` : `Versuch es noch einmal: klar und gleichmäßig sprechen.`];
  if (replyLang === "ar") return [w1 ? `ركّز على "${w1}": اجعلها واضحة وبإيقاع ثابت.` : `حاول مرة أخرى: اجعل النطق واضحًا وبإيقاع ثابت.`];
  if (replyLang === "zh-CN") return [w1 ? `请重点注意「${w1}」：把字母咬清楚、速度稳定。` : `请再试一次：放慢一点、口型更清楚。`];
  return [w1 ? `請重點注意「${w1}」：把字母咬清楚、速度穩定。` : `請再試一次：放慢一點、口型更清楚。`];
}

// v2 (zh-TW first): sentence + aligned token issues -> natural advice
function buildPronunciationTipsV2Prompt({ uiLang = "zh-TW", targetText = "", issues = [] }) {
  // ✅ 目前先只做繁中版本，其他語言一律以 zh-TW 規格輸出（觀察期）
  const system = `你是一位發音教練。輸入包含 targetText（目標句）與 issues（系統已判定的差異證據）。
你不得重新做對齊、不得猜測漏唸、不得自行推測使用者實際說了什麼；只能根據 issues 描述給建議。
請只針對 issues 中列出的 token 提建議（不要提到其他詞）。每個 token 1–2 句、口語自然，重點要跟拼寫/字母綁在一起（例如：-in、-en、ch、ü）。
如果 diffType 是 suffix_added / suffix_missing，請明確指出「字尾」差異，並說明要怎麼收尾；可少量使用 IPA，但只能作為字母提示的補充（例如：in ≈ /ɪn/），禁止長串 IPA、禁止整句轉寫。
不要給練習指令（不要叫人念幾次），不要比較 transcript，不要評論整句流暢度。請用繁體中文回答。
輸出格式：每個 token 一行，格式「TOKEN：建議…」即可。`;

  const safeIssues = Array.isArray(issues)
    ? issues
        .filter((x) => x && typeof x === "object")
        .slice(0, 5)
        .map((x) => ({
          token: String(x.token || x.targetToken || x.target || "").trim(),
          asr: String(x.asrToken || x.asr || x.heard || "").trim(),
          diffType: String(x.diffType || "").trim(),
          extra: String(x.extra || x.extraSuffix || x.extraPrefix || "").trim(),
          confidence:
            typeof x.confidence === "number"
              ? x.confidence
              : Number(x.confidence || 0) || 0,
        }))
        .filter((x) => x.token)
    : [];

  const userLines = [];
  userLines.push("targetText:");
  userLines.push(String(targetText || "").trim());
  userLines.push("");
  userLines.push("issues:");
  for (const it of safeIssues) {
    const parts = [];
    parts.push(`token=${it.token}`);
    if (it.asr) parts.push(`asr=${it.asr}`);
    if (it.diffType) parts.push(`diffType=${it.diffType}`);
    if (it.extra) parts.push(`extra=${it.extra}`);
    if (typeof it.confidence === "number") parts.push(`confidence=${it.confidence}`);
    userLines.push(`- ${parts.join(" | ")}`);
  }

  return { system, user: userLines.join("\n") };
}

module.exports = { buildPronunciationTipsPrompt, buildPronunciationTipsV2Prompt, buildPronunciationTipsFallbackTips };
