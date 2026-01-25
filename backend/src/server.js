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
 *
 * 異動日期：2026-01-05
 * 異動說明：
 * 1) 新增並掛載 /api/visit（POST 訪問紀錄）
 *
 * 異動日期：2026-01-05
 * 異動說明：
 * 1) 修正 admin usage 路徑：改回 /admin（避免前端誤打到 5173 /admin/usage 造成 404）
 * 2) 保留原掛載行但標示為 deprecated（不減少行數）
 *
 * 異動日期：2026-01-24
 * 異動說明：
 * 1) 新增並掛載 /api/support（即時客服服務 API）
 * 2) 掛載方式採 app.use("/api", supportRoute) 以避免路徑重複 /support/support
const supportAdminRoute = require("./routes/supportAdminRoute");
app.use("/api", supportAdminRoute);
 */

require("dotenv").config();
// =========================
// GCP ADC bootstrap (for Render)
// 說明：
// - Render 無法直接放 JSON 金鑰檔
// - 將 GCP_SA_JSON（env）寫成暫存檔
// - 設定 GOOGLE_APPLICATION_CREDENTIALS 供 Google SDK 使用
// =========================
const fs = require("fs");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GCP_SA_JSON) {
  const credPath = "/tmp/gcp-sa.json";
  fs.writeFileSync(credPath, process.env.GCP_SA_JSON, "utf8");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  console.log("[GCP] GOOGLE_APPLICATION_CREDENTIALS set via GCP_SA_JSON");
}

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
const visitRoute = require("./routes/visitRoute");
const speechRoute = require("./routes/speechRoute");
const supportRoute = require("./routes/supportRoute");
const queryNormalizeRoute = require("./routes/queryNormalizeRoute");


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
    visit: false,
    speech: false,
    support: false,
    queryNormalize: false,
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

  app.use("/api/speech", speechRoute);
  INIT_STATUS.routes.speech = true;

  // ✅ 2026-01-24：即時客服 Support API（/api/support/*）
  // 掛載方式：app.use("/api", supportRoute) + route 檔內定義 /support/...
  // ✅ 最終生效路徑：POST /api/support/session, GET/POST /api/support/messages ...
  app.use("/api", supportRoute);
  INIT_STATUS.routes.support = true;

  // ✅ Query Normalize（查詢前置修正：拼字 / 變形）
  // 最終路徑：POST /api/query/normalize
  app.use("/api/query", queryNormalizeRoute);
  INIT_STATUS.routes.queryNormalize = true;

  app.use("/api/dictionary", dictionaryRoute);
  INIT_STATUS.routes.dictionary = true;

  app.use("/api", authTestRoute);
  INIT_STATUS.routes.authTest = true;

  app.use("/api/usage", usageMeRoute);
  INIT_STATUS.routes.usageMe = true;

  app.use("/api/library", libraryRoute);
  INIT_STATUS.routes.library = true;

  // DEPRECATED（2026-01-05）：此路徑會造成前端誤打到 5173 /admin/usage 時更難排查
  // app.use("/api/admin/usage", adminUsageRoute);
  // INIT_STATUS.routes.adminUsage = true;

  // ✅ 正式路徑：與舊版一致（GET /admin/usage?days=7）
  app.use("/admin", adminUsageRoute);
  INIT_STATUS.routes.adminUsage = true;

  app.use("/api", visitRoute);
  INIT_STATUS.routes.visit = true;

  // 初始化狀態補充（便於 runtime 排查）
  logger.info(`[INIT] routes.adminUsage mounted at: /admin`);
}

/** 功能：掛載錯誤處理（集中管理） */
function mountErrorHandlers(app) {
  app.use(errorMiddleware);
}

/** 功能：啟動 Server */
function startServer(app) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    logger.info(`[server] listening on http://localhost:${port}`);
    logger.info(`[server] INIT_STATUS: ${JSON.stringify(INIT_STATUS, null, 2)}`);
  });
}

/** 主程式 */
function main() {
  const app = createApp();
  mountMiddlewares(app);
  mountRoutes(app);
  mountErrorHandlers(app);
  startServer(app);
}

main();

// backend/src/server.js