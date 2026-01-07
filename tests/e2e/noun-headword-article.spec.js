import { test, expect } from "@playwright/test";

/**
 * 規則（名詞 headword）：
 * - 必須出現：der / die / das（小寫）
 * - 後面跟著：空格 + 名詞（首字母大寫）
 *
 * 我們不掃整個 body，而是直接找「可見文字」匹配這個模式。
 */
test("名詞 headword：必須是 冠詞 + 名詞（名詞大寫）", async ({ page }) => {
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });

  // 1) 輸入名詞
  const textbox = page.getByRole("textbox").first();
  await expect(textbox).toBeVisible();

  await textbox.fill("Schloss");
  await textbox.press("Enter");

  // 2) 等待結果出現（以 headword 模式出現當作 ready）
  //    直接等待頁面上出現 "das Schloss" 這種模式（der/die/das + 大寫名詞）
  const headwordRegex = /\b(der|die|das)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]+/;

  const headword = page.getByText(headwordRegex).first();
  await expect(headword).toBeVisible({ timeout: 8000 });

  // 3) 再額外驗一次：取到的文字確實符合規則（避免誤抓別段）
  const text = (await headword.innerText()).trim();
  expect(text).toMatch(headwordRegex);
});
