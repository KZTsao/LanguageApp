// backend/test-analyze.js
// 簡單後端測試：確認 /analyze 單字 / 句子都能正常回傳

// -----------------------------
// SECTION 1: 小工具
// -----------------------------

/**
 * 顯示一行有顏色的文字（純裝飾，讓你一眼看出成功或失敗）
 */
function logOk(message) {
  console.log("\x1b[32m✔ " + message + "\x1b[0m"); // 綠色
}

function logFail(message) {
  console.log("\x1b[31m✖ " + message + "\x1b[0m"); // 紅色
}

// -----------------------------
// SECTION 2: 測試案例設定
// -----------------------------

/**
 * 每一個測試案例 = 使用者輸入 + 預期 mode + 要檢查的欄位
 */
const BASE_URL = "http://localhost:3000";

const testCases = [
  {
    name: "查動詞：machen（應該是 word 模式）",
    input: "machen",
    expectMode: "word",
    checks: (data) => {
      if (!data.word) throw new Error("缺少 data.word");
      if (!data.pos) throw new Error("缺少 data.pos");
      if (!Array.isArray(data.examples) || data.examples.length === 0) {
        throw new Error("examples 至少要有 1 筆");
      }
    },
  },
  {
    name: "查名詞 + 冠詞：den Tisch（應該是 word 模式，而且 word 應該是 Tisch）",
    input: "den Tisch",
    expectMode: "word",
    checks: (data) => {
      if (!data.word) throw new Error("缺少 data.word");
      if (!/tisch/i.test(data.word)) {
        throw new Error(`data.word 預期包含 "Tisch"，實際為：${data.word}`);
      }
    },
  },
  {
    name: "查句子：Ich mache Hausaufgaben.（應該是 sentence 模式）",
    input: "Ich mache Hausaufgaben.",
    expectMode: "sentence",
    checks: (data) => {
      if (!data.sentence) throw new Error("缺少 data.sentence");
      if (!data.translation_zh) {
        throw new Error("缺少 data.translation_zh");
      }
      if (!Array.isArray(data.grammar_points)) {
        throw new Error("grammar_points 應該是陣列");
      }
    },
  },
];

// -----------------------------
// SECTION 3: 呼叫 /analyze，執行測試
// -----------------------------

/**
 * 呼叫後端 /analyze API
 */
async function callAnalyzeAPI(input) {
  const res = await fetch(`${BASE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP 狀態碼：${res.status}，內容：${text}`);
  }

  return await res.json();
}

/**
 * 跑單一測試案例
 */
async function runSingleTest(testCase) {
  const { name, input, expectMode, checks } = testCase;
  try {
    const data = await callAnalyzeAPI(input);

    if (!data.mode) {
      throw new Error("回傳裡沒有 data.mode");
    }
    if (data.mode !== expectMode) {
      throw new Error(`mode 預期為 "${expectMode}"，實際為 "${data.mode}"`);
    }

    // 執行自訂檢查
    if (typeof checks === "function") {
      checks(data);
    }

    logOk(name);
    return true;
  } catch (err) {
    logFail(name);
    console.error("  → 錯誤原因:", err.message);
    return false;
  }
}

/**
 * 跑全部測試
 */
async function runAllTests() {
  console.log("開始測試 /analyze API ...");
  console.log("(請先確認 server.js 有在跑於 http://localhost:3000)\n");

  let passCount = 0;

  for (const tc of testCases) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await runSingleTest(tc);
    if (ok) passCount++;
  }

  console.log("\n-----------------------------");
  console.log(`測試完成：${passCount} / ${testCases.length} 個通過`);
  console.log("-----------------------------\n");
}

// 直接執行
runAllTests().catch((err) => {
  console.error("測試程式本身發生錯誤：", err);
});
