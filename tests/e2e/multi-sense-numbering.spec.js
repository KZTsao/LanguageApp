import { test, expect } from "@playwright/test";

test("多義字：義項有編號（①② 或 1.2.）", async ({ page }) => {
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });

  // 1) 找輸入框（第一個 textbox）
  const textbox = page.getByRole("textbox").first();
  await expect(textbox).toBeVisible();

  // 用一個你確定會出現多義的字（你截圖是 Schloss）
  await textbox.fill("Schloss");

  // 2) 觸發查詢：先 Enter，再嘗試點常見按鈕文字
  await textbox.press("Enter");
  await page.waitForTimeout(600);

  const btnCandidates = [
    page.getByRole("button", { name: /analyze/i }),
    page.getByRole("button", { name: /search/i }),
    page.getByRole("button", { name: /查詢/ }),
    page.getByRole("button", { name: /搜尋/ }),
    page.getByRole("button", { name: /送出/ }),
  ];

  for (const btn of btnCandidates) {
    if (await btn.first().isVisible().catch(() => false)) {
      await btn.first().click();
      await page.waitForTimeout(800);
      break;
    }
  }

  // 3) 等待「釋義」區塊出現（你畫面上明確有 "釋義："）
  await page.waitForFunction(() => {
    const t = document.body?.innerText || "";
    return t.includes("釋義") || t.includes("释义");
  }, null, { timeout: 5000 });

  // 4) 驗收：圈圈數字 or 1. 2. 至少出現一個
  const bodyText = await page.locator("body").innerText();

  const circled = bodyText.match(/[①②③④⑤⑥⑦⑧⑨⑩]/g) || [];
  const dotted = bodyText.match(/(?:^|\n)\s*\d+\./g) || [];

  expect(circled.length + dotted.length).toBeGreaterThan(0);
});
