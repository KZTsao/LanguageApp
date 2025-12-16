// backend/src/middleware/authMiddleware.js
// 用來驗證從前端送來的 Supabase JWT（access token）

const jwt = require("jsonwebtoken");

/**
 * 驗證 Authorization: Bearer <token>
 * 驗證成功 → req.authUser = decoded payload
 * 驗證失敗 → 回傳 401
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    if (!process.env.SUPABASE_JWT_SECRET) {
      console.error("[authMiddleware] SUPABASE_JWT_SECRET is not set in env");
      return res.status(500).json({ error: "Auth configuration error" });
    }

    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);

    // 給後續的 route 用：req.authUser
    req.authUser = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      raw: decoded,
    };

    next();
  } catch (err) {
    console.error("[authMiddleware] JWT verify failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = authMiddleware;
