const test = require('node:test');
const assert = require('node:assert');
const { analyzeWord } = require('../services/analyzeWord');

test('analyzeWord returns basic info', async () => {
  const result = await analyzeWord('hello');

  assert.strictEqual(result.mode, 'word');
  assert.strictEqual(result.text, 'hello');
  assert.ok(result.length > 0);
  assert.ok(result.dictionary);
});
