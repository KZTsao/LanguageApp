import { test, expect } from "@playwright/test";

test("多國語言：下拉選單切換後頁面仍正常（不空白、不崩）", async ({ page }) => {
  // 1) 先打開前端（你本機 dev server）
  // 注意：你要先在另一個 terminal 跑 `cd frontend && npm run dev`
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });

  // 2) 找到第一個 <select>（通常就是語言下拉）
  const selects = page.locator("select");
  await expect(selects.first()).toBeVisible();

  const langSelect = selects.first();

  // 3) 讀取它有哪些選項
  const options = await langSelect.locator("option").allTextContents();
  expect(options.length).toBeGreaterThan(1);

  // 4) 依序切換前兩個選項，確認頁面沒有變空、沒有噴錯到顯示崩壞
  const values = await langSelect.locator("option").evaluateAll((opts) =>
    opts.map((o) => o.value)
  );

  // 切到第 2 個語言
  await langSelect.selectOption(values[1]);
  await page.waitForTimeout(200);

  // 切回第 1 個語言
  await langSelect.selectOption(values[0]);
  await page.waitForTimeout(200);

  // 5) 最基本的「沒崩」檢查：body 仍有內容
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.trim().length).toBeGreaterThan(20);
});
