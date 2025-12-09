const test = require('node:test');
const assert = require('node:assert');
const { analyzeSentence } = require('../services/analyzeSentence');

test('analyzeSentence splits sentence into words', async () => {
  const result = await analyzeSentence('Hello world');

  assert.strictEqual(result.mode, 'sentence');
  assert.strictEqual(result.wordCount, 2);
  assert.strictEqual(result.words.length, 2);
});
