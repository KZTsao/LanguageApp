// backend/src/data/importPresets.js

const presets = [
  {
    id: "phrases-1",
    title: "Phrasen I",
    level: "A1",
    items: [
      { headword: "Hallo!", canonical_pos: "phrase" },
      { headword: "Tschüss!", canonical_pos: "phrase" },
      { headword: "Danke!", canonical_pos: "phrase" },
      { headword: "Wie geht's?", canonical_pos: "phrase" },
      { headword: "Gut.", canonical_pos: "phrase" },
      { headword: "Ja.", canonical_pos: "other" },
      { headword: "Nein.", canonical_pos: "other" }
    ]
  },
  {
    id: "phrases-2",
    title: "Phrasen II",
    level: "A1",
    items: [
      { headword: "Ich weiß nicht.", canonical_pos: "phrase" },
      { headword: "Ich verstehe nicht.", canonical_pos: "phrase" },
      { headword: "Was ist das?", canonical_pos: "phrase" },
      { headword: "Wie, bitte?", canonical_pos: "phrase" },
      { headword: "Kannst du das wiederholen?", canonical_pos: "phrase" },
      { headword: "Einen Moment, bitte!", canonical_pos: "phrase" },
      { headword: "Entschuldigung!", canonical_pos: "phrase" }
    ]
  },
  {
    id: "zahlen",
    title: "Zahlen 1–12",
    level: "A1",
    items: [
      { headword: "eins", canonical_pos: "other" },
      { headword: "zwei", canonical_pos: "other" },
      { headword: "drei", canonical_pos: "other" },
      { headword: "vier", canonical_pos: "other" },
      { headword: "fünf", canonical_pos: "other" },
      { headword: "sechs", canonical_pos: "other" },
      { headword: "sieben", canonical_pos: "other" },
      { headword: "acht", canonical_pos: "other" },
      { headword: "neun", canonical_pos: "other" },
      { headword: "zehn", canonical_pos: "other" },
      { headword: "elf", canonical_pos: "other" },
      { headword: "zwölf", canonical_pos: "other" }
    ]
  }
];

module.exports = presets;
