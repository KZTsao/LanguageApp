// backend/scripts/testDb.js
// 測試能否連到 Supabase + 寫入/讀出資料

const { supabase } = require("../../db/supabaseClient");

async function main() {
  console.log("=== DB Health Check 開始 ===");

  // 1. 插入一筆測試 dict_entries
  const entryInsert = {
    language_code: "de",
    word: "testen",
    base_form: "testen",
    part_of_speech: "Verb",
    gender: "",
    meta: {},
  };

  const { data: entryData, error: entryError } = await supabase
    .from("dict_entries")
    .insert(entryInsert)
    .select()
    .single();

  if (entryError) {
    console.error("[testDb] 建立 dict_entries 失敗：", entryError);
    process.exit(1);
  }

  console.log("[testDb] 建立 entry 成功：", entryData);

  // 2. 查詢剛剛那筆（用 base_form + part_of_speech）
  const { data: list, error: listError } = await supabase
    .from("dict_entries")
    .select("*")
    .eq("base_form", "testen")
    .eq("part_of_speech", "Verb");

  if (listError) {
    console.error("[testDb] 查詢 dict_entries 失敗：", listError);
    process.exit(1);
  }

  console.log("[testDb] 查到的 entries =", list);

  console.log("=== ✅ DB Health Check 完成 ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("[testDb] 未預期錯誤：", err);
  process.exit(1);
});
