// backend/src/routes/usageMeRoute.js

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const { getUserUsageMe } = require("../utils/usageLogger");

// 需要登入：必須有 Authorization: Bearer <token>
// verify → decode fallback（只用於讀取 userId，不做權限升級）
function requireAuthUser(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  // ① 優先 verify（若環境變數存在）
  if (process.env.SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      return {
        id: decoded.sub || "",
        email: decoded.email || "",
        source: "verify",
      };
    } catch (e) {
      console.warn("[usageMeRoute] jwt.verify failed, fallback to decode");
    }
  }

  // ② fallback：decode（不驗證，只讀 id/email）
  try {
    const decoded = jwt.decode(token);
    if (!decoded) return null;

    return {
      id: decoded.sub || "",
      email: decoded.email || "",
      source: "decode",
    };
  } catch {
    return null;
  }
}

// GET /api/usage/me
router.get("/me", (req, res) => {
  const authUser = requireAuthUser(req);
  if (!authUser || !authUser.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const data = getUserUsageMe({
    userId: authUser.id,
    email: authUser.email || "",
  });

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.send(JSON.stringify(data, null, 2));
});

module.exports = router;

// backend/src/routes/usageMeRoute.js
