// backend/src/clients/dictionaryClient.js

const { lookupWord } = require('./dictionaryLookup');
const { generateExamples } = require('./dictionaryExamples');

module.exports = {
  lookupWord,
  generateExamples,
};
