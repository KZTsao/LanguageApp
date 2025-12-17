// backend/src/server.js

/**
 * 文件說明：
 * LanguageApp Backend Server 入口
 *
 * 異動日期：2025-12-17
 * 異動說明：
 * 1) 符合檔案規範：第一行/最後一行註解路徑、文件說明、異動日期/說明
 * 2) 模組化：將初始化與掛載拆小函式，加入中文功能說明
 * 3) 加入「初始化狀態」輸出，便於 Production 階段排查（env、routes 掛載）
 * 4) 保留原本行為：新增並掛載 /api/library（GET 分頁）
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const analyzeRoute = require("./routes/analyzeRoute");
const ttsRoute = require("./routes/ttsRoute");
const dictionaryRoute = require("./routes/dictionaryRoute");
const authTestRoute = require("./routes/authTestRoute");
const adminUsageRoute = require("./routes/adminUsageRoute");
const usageMeRoute = require("./routes/usageMeRoute");
const libraryRoute = require("./routes/libraryRoute");

const { errorMiddleware } = require("./utils/errorHandler");
const { logger } = require("./utils/logger");

/** =========================
 * 初始化狀態（Production 排查用）
 * - 只記錄「是否存在」等非敏感資訊
 * - 不輸出任何 key/secret
 * ========================= */
const INIT_STATUS = {
  app: {
    name: "LanguageApp-backend",
    startedAt: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || "undefined",
  },
  env: {
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    port: process.env.PORT || "4000(default)",
  },
  routes: {
    analyze: false,
    tts: false,
    dictionary: false,
    authTest: false,
    usageMe: false,
    library: false,
    adminUsage: false,
  },
};

/** 功能：建立 Express App */
function createApp() {
  return express();
}

/** 功能：掛載中介層（CORS、JSON、static） */
function mountMiddlewares(app) {
  app.use(cors());
  app.use(express.json());

  // 靜態檔案（測試頁用）
  const publicPath = path.join(__dirname, "..", "public");
  app.use(express.static(publicPath));
}

/** 功能：掛載 API Routes（集中管理，便於排查 404/掛錯 path） */
function mountRoutes(app) {
  app.use("/api/analyze", analyzeRoute);
  INIT_STATUS.routes.analyze = true;

  app.use("/api/tts", ttsRoute);
  INIT_STATUS.routes.tts = true;

  app.use("/api/dictionary", dictionaryRoute);
  INIT_STATUS.routes.dictionary = true;

  app.use("/api", authTestRoute);
  INIT_STATUS.routes.authTest = true;

  app.use("/api/usage", usageMeRoute);
  INIT_STATUS.routes.usageMe = true;

  // 收藏/單字庫：Phase 2（本輪只做 GET 分頁）
  app.use("/api/library", libraryRoute);
  INIT_STATUS.routes.library = true;

  app.use("/admin", adminUsageRoute);
  INIT_STATUS.routes.adminUsage = true;
}

/** 功能：掛載錯誤處理（最後一道） */
function mountErrorHandler(app) {
  app.use(errorMiddleware);
}

/** 功能：輸出初始化狀態（Production 排查用） */
function logInitStatus() {
  logger.info("[INIT] Backend init status:");
  logger.info(JSON.stringify(INIT_STATUS, null, 2));
}

/** 功能：啟動 Server */
function startServer(app) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    logger.info(`LanguageApp backend running on http://localhost:${port}`);
  });
}

/** 主流程：依序初始化 */
function main() {
  const app = createApp();
  mountMiddlewares(app);
  mountRoutes(app);
  mountErrorHandler(app);
  logInitStatus();
  startServer(app);
}

main();

// backend/src/server.js
