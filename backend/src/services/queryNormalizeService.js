
// ==============================================
// File: backend/src/services/queryNormalizeService.js
// Purpose: Decide whether input is German, inflection, or typo
// ==============================================

import { askGroq } from "../clients/groqClient.js";

/**
 * normalizeGermanQuery
 * - returns the most likely normalized German form
 * - does NOT touch dictionary / analyze logic
 */
export async function normalizeGermanQuery(input) {
  const prompt = `
You are a German language expert.
Given a user input, decide:
1) Is it likely German?
2) Is it an inflected form?
3) If incorrect, guess the most likely intended German word.

Return STRICT JSON only:

{
  "normalized": string,
  "confidence": number,
  "message": { "type": "info|warn|error", "text": string } | null,
  "candidates": [{ "text": string, "score": number }]
}

User input: "${input}"
`;

  const response = await askGroq(prompt, { temperature: 0.2 });

  try {
    return JSON.parse(response);
  } catch {
    return {
      normalized: input,
      confidence: 0,
      message: {
        type: "warn",
        text: "無法確認是否為德文，已使用原始輸入"
      },
      candidates: []
    };
  }
}

// ==============================================
// END OF FILE: backend/src/services/queryNormalizeService.js
// ==============================================
