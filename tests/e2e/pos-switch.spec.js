// tests/e2e/pos-switch.spec.js
/**
 * 文件說明：
 * - 目的：自動驗證「單字多詞性（Adverb/Adjektiv）可顯示、可切換」的主線行為
 * - 規格：
 *   1) 基礎驗證：查詢 perfekt 後，應該在 UI 或 raw result 中看見 posOptions >= 2
 *   2) 切換驗證（未導入前先 skip）：點擊 Adjektiv 後，應觸發 re-query，並在 request payload 帶 targetPosKey
 *
 * 異動紀錄（僅追加，不可刪除）：
 * - 2026-01-06：新增本測試（先驗證 posOptions；切換驗證先 skip，待前端接線後再開）
 *
 * 功能初始化狀態（Production 排查）：
 * - 本測試會在 console 印出關鍵資訊，方便 CI/本機排查
 */

// tests/e2e/pos-switch.spec.js

import { test, expect } from "@playwright/test";

const APP_URL = process.env.E2E_BASE_URL || "http://localhost:5173";

/**
 * 中文功能說明：
 * - 將頁面導到 App，並輸入文字觸發查詢
 * - 由於你目前 UI 元件 selector 未必固定，這裡採「保守策略」：
 *   1) 優先找 input[type="text"]
 *   2) 找不到就 fallback 找 placeholder 含 Search 的 input
 * - 觸發方式：Enter
 */
async function searchWord(page, word) {
  const input =
    (await page.$('input[type="text"]')) ||
    (await page.$('input[placeholder*="Search"]')) ||
    (await page.$('input[placeholder*="search"]'));

  expect(input, "[E2E] 找不到搜尋 input，請確認 SearchBox 的 input selector").toBeTruthy();

  await input.fill("");
  await input.fill(word);
  await input.press("Enter");
}

/**
 * 中文功能說明：
 * - 監聽 /api/analyze 的 response JSON，回傳最新一次的 data
 * - 用途：不依賴 UI 細節，直接驗證 dictionary.posOptions 是否存在
 */
async function waitAnalyzeJson(page) {
  const res = await page.waitForResponse((r) => {
    try {
      const url = r.url();
      return url.includes("/api/analyze") && r.request().method() === "POST";
    } catch {
      return false;
    }
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { res, json };
}

test.describe("POS Switch - multi POS", () => {
  test("perfekt should have posOptions >= 2 (Adverb/Adjektiv)", async ({ page }) => {
    page.on("console", (msg) => {
      // Production 排查：保留 console（避免你需要手動重現）
      // eslint-disable-next-line no-console
      console.log("[browser console]", msg.type(), msg.text());
    });

    await page.goto(APP_URL);

    await searchWord(page, "perfekt");

    const { json } = await waitAnalyzeJson(page);

    // 基礎 sanity
    expect(json, "[E2E] /api/analyze 沒拿到 JSON").toBeTruthy();

    const posOptions = json?.dictionary?.posOptions;
    const len = Array.isArray(posOptions) ? posOptions.length : 0;

    // eslint-disable-next-line no-console
    console.log("[E2E] posOptions =", posOptions);

    expect(len, "[E2E] 預期 dictionary.posOptions >= 2").toBeGreaterThanOrEqual(2);

    // 你目前 log 是 [ 'Adverb', 'Adjektiv' ]，這裡也順便做強檢
    const posStr = Array.isArray(posOptions) ? posOptions.join("|") : "";
    expect(posStr.includes("Adverb"), "[E2E] 預期 posOptions 包含 Adverb").toBeTruthy();
    expect(posStr.includes("Adjektiv"), "[E2E] 預期 posOptions 包含 Adjektiv").toBeTruthy();
  });

  test.skip("click Adjektiv should re-query /api/analyze with targetPosKey=Adjektiv", async ({ page }) => {
    // ⚠️ 這段等你前端「真的能切換詞性」再打開
    await page.goto(APP_URL);

    // 先查一次
    await searchWord(page, "perfekt");
    await waitAnalyzeJson(page);

    // 監聽下一次 request body
    const reqPromise = page.waitForRequest((req) => {
      try {
        return req.url().includes("/api/analyze") && req.method() === "POST";
      } catch {
        return false;
      }
    });

    // 點擊 UI 上的 "Adjektiv"
    // 這裡用文字找 button/element（你之後可以把 pos option 做成 button）
    await page.getByText("Adjektiv", { exact: false }).click();

    const req = await reqPromise;

    let body = {};
    try {
      body = JSON.parse(req.postData() || "{}");
    } catch {
      body = {};
    }

    // eslint-disable-next-line no-console
    console.log("[E2E] request body =", body);

    expect(body.targetPosKey, "[E2E] 預期 request body 帶 targetPosKey").toBe("Adjektiv");
  });
});

// tests/e2e/pos-switch.spec.js
