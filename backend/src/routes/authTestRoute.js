// backend/src/routes/authTestRoute.js
// 簡單的登入驗證測試用路由：GET /api/auth-test

const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// 只有有帶正確 Bearer token 的請求才會通過
router.get("/auth-test", authMiddleware, (req, res) => {
  return res.json({
    ok: true,
    authUser: req.authUser,
  });
});

module.exports = router;
