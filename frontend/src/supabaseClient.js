// frontend/src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ 這個 key 你也可以改成更獨特的名稱，但全專案要一致
const GLOBAL_KEY = "__LANGAPP_SUPABASE__";

// ✅ 跨 HMR / reload 的單例：避免重複 createClient → Multiple GoTrueClient instances
if (!globalThis[GLOBAL_KEY]) {
  globalThis[GLOBAL_KEY] = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = globalThis[GLOBAL_KEY];
