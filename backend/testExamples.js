// backend/testExamples.js
require("dotenv").config();node testExamples.js

const { generateExamples } = require("./src/clients/dictionaryClient");

async function main() {
  const result = await generateExamples({
    word: "Schloss",
    baseForm: "Schloss",
    partOfSpeech: "Nomen",
    gender: "das",
    senseIndex: 1, // 第二義：鎖
    explainLang: "zh-TW",
    options: {
      case: "akk",        // 第四格
      articleType: "def", // 定冠詞
      // 之後你想玩 possessive / number 也可以加進來
    },
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
});
