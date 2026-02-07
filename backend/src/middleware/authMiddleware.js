// START PATH: backend/src/middleware/authMiddleware.js
// backend/src/middleware/authMiddleware.js
// 用來驗證從前端送來的 Supabase JWT（access token）
// ✅ 配合 getSupabaseAdmin()，改用 Supabase 官方 auth.getUser 驗證
// ⚠️ 含暫時性 init status log（確認用，驗證完成可移除）

const {
  getSupabaseAdmin,
  getSupabaseAdminInitStatus,
} = require("../db/supabaseAdmin");

/**
 * 驗證 Authorization: Bearer <token>
 * 驗證成功 → req.authUser = Supabase user
 * 驗證失敗 → 回傳 401
 */
async function authMiddleware(req, res, next) {
  try {
    // 🔍 runtime 觀測：確認 supabase admin 初始化狀態
    console.log(
      "[authMiddleware] supabase init status:",
      getSupabaseAdminInitStatus()
    );

    const authHeader =
      req.headers["authorization"] || req.headers["Authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      console.error(
        "[authMiddleware] Supabase auth.getUser failed:",
        error?.message
      );
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // 給後續的 route 用：req.authUser
    req.authUser = data.user;

    next();
  } catch (err) {
    console.error("[authMiddleware] Unexpected error:", err.message);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

module.exports = authMiddleware;
// backend/src/middleware/authMiddleware.js
// END PATH: backend/src/middleware/authMiddleware.js
