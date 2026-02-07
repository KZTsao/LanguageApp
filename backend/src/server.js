// PATH: backend/src/server.js
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
 *
 * 異動日期：2026-01-26
 * 異動說明：
 * 1) /api/speech 路由改為強制登入：app.use("/api/speech", authMiddleware, speechRoute)
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
const crypto = require("crypto");


// =========================
// [support] server trace helper (dev-only, no logic change)
// =========================
function __supportTraceServer(event, payload) {
  try { console.info("[support]", event, payload || {}); } catch (e) {}
}

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
const authMiddleware = require("./middleware/authMiddleware");

/**
 * ✅ DEV/ENV 控制：Speech 是否強制登入
 * - 預設：強制登入（符合 2026-01-26 規格）
 * - 若前端在 session 未就緒就會呼叫 /api/speech 導致卡住，可在 dev 設：SPEECH_REQUIRE_AUTH=0
 *
 * Accept falsy values: "0", "false", "off"
 */
const SPEECH_REQUIRE_AUTH = !["0", "false", "off"].includes(String(process.env.SPEECH_REQUIRE_AUTH || "").toLowerCase());

/**
 * ✅ DEV/ENV：HTTP debug（用來抓前端「卡住」到底打了哪些 API）
 * - DEBUG_HTTP=1：印出每個 request（method + url + ms + status）
 * - REQ_TIMEOUT_MS=15000：超過即印 TIMEOUT（預設 15000ms；設 0 關閉）
 *
 * Accept truthy values: "1", "true", "on"
 */
const DEBUG_HTTP_RAW = String(process.env.DEBUG_HTTP || "").toLowerCase();
/**
 * DEBUG_HTTP 預設策略（避免「打不到後端但看不到 log」）：
 * - 若明確設為 1/true/on → 開
 * - 若明確設為 0/false/off → 關
 * - 若未設 → dev 預設開、production 預設關
 */
const DEBUG_HTTP =
  ["1", "true", "on"].includes(DEBUG_HTTP_RAW)
    ? true
    : ["0", "false", "off"].includes(DEBUG_HTTP_RAW)
      ? false
      : (String(process.env.NODE_ENV || "").toLowerCase() !== "production");
const REQ_TIMEOUT_MS = Number(process.env.REQ_TIMEOUT_MS || 15000);

const supportRoute = require("./routes/supportRoute");
const supportAdminRoute = require("./routes/supportAdminRoute");
const queryNormalizeRoute = require("./routes/queryNormalizeRoute");
const unitsRoute = require("./routes/unitsRoute");




// ✅ Billing（Lemon Checkout URL / external_id）
const billingRoute = require("./routes/billingRoute");
// ✅ Lemon Squeezy Webhook
const lemonWebhookRoute = require("./routes/lemonWebhookRoute");
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
    debugHttp: Boolean(process.env.DEBUG_HTTP),
    reqTimeoutMs: String(process.env.REQ_TIMEOUT_MS || "15000"),
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
    supportAdmin: false,
    units: false,
  },
};

/** 功能：建立 Express App */
function createApp() {
  return express();
}

/** 功能：掛載中介層（CORS、JSON、static） */
function mountMiddlewares(app) {
app.use(cors());

// ✅ Request ID / backend marker（協助判斷 500 是 Vite proxy 還是後端）
app.use((req, res, next) => {
  try {
    const incoming = req.headers["x-request-id"];
    const rid =
      (incoming && String(incoming)) ||
      (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    req.requestId = rid;
    res.setHeader("x-request-id", rid);
    res.setHeader("x-languageapp-backend", "1");
  } catch (e) {
    // no-op
  }
  next();
});

  // ✅ DEV/ENV：HTTP debug（抓前端卡住點）
  if (DEBUG_HTTP) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        const ms = Date.now() - start;
        console.log("[REQ]", req.method, req.originalUrl, res.statusCode, `${ms}ms`);
      });
      next();
    });
  }

  // ✅ DEV/ENV：request timeout（避免外部 I/O 無限 pending）
  if (REQ_TIMEOUT_MS > 0) {
    app.use((req, res, next) => {
      res.setTimeout(REQ_TIMEOUT_MS, () => {
        console.error("[TIMEOUT]", req.method, req.originalUrl, `${REQ_TIMEOUT_MS}ms`);
        if (!res.headersSent) res.status(504).end("timeout");
      });
      next();
    });
  }
  // ✅ Lemon Webhook 需要 raw body 驗簽：先用 express.raw() 接住此路徑
  // 這樣後面的 express.json() 會自動跳過，不會把 body 吃掉
  app.use("/api/webhooks/lemon", express.raw({ type: "*/*" }));

  app.use(express.json());

  // 靜態檔案（測試頁用）
  const publicPath = path.join(__dirname, "..", "public");
  app.use(express.static(publicPath));
}

/** 功能：掛載 API Routes（集中管理，便於排查 404/掛錯 path） */
function mountRoutes(app) {
  // ✅ health check（用來確認 request 是否真的進到後端）
  app.get("/api/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString(), requestId: req.requestId || null });
  });

  app.use("/api/analyze", analyzeRoute);
  INIT_STATUS.routes.analyze = true;

  app.use("/api/tts", ttsRoute);
  INIT_STATUS.routes.tts = true;

  // DEV/ENV：Speech 是否強制登入（避免前端 session 未就緒時卡住）
  // - 預設強制登入（符合規格）
  // - 若要在 dev 允許匿名，設：SPEECH_REQUIRE_AUTH=0
  if (SPEECH_REQUIRE_AUTH) {
    // ✅ ASR 強制登入：/api/speech 需通過 authMiddleware 才能使用
    app.use("/api/speech", authMiddleware, speechRoute);
  } else {
    // ✅ DEV bypass：允許匿名（避免前端初始化阻塞）
    app.use("/api/speech", speechRoute);
  }
  // DEPRECATED：保留舊註解（不減行數）
  // app.use("/api/speech", authMiddleware, speechRoute);
  INIT_STATUS.routes.speech = true;

  // ✅ 2026-01-24：即時客服 Support API（/api/support/*）
  // 掛載方式：app.use("/api", supportRoute) + route 檔內定義 /support/...
  // ✅ 最終生效路徑：POST /api/support/session, GET/POST /api/support/messages ...
  app.use("/api", supportRoute);
  INIT_STATUS.routes.support = true;

  // ✅ Admin Support API（/api/support/admin/*）
  // 掛載方式：app.use("/api", supportAdminRoute) + route 檔內定義 /support/admin/...
  app.use("/api", supportAdminRoute);
__supportTraceServer("mount:supportAdmin", { path: "(auto)" });
  INIT_STATUS.routes.supportAdmin = true;

  // ✅ Query Normalize（查詢前置修正：拼字 / 變形）
  // 最終路徑：POST /api/query/normalize
  app.use("/api/query", queryNormalizeRoute);
  INIT_STATUS.routes.queryNormalize = true;

  // ✅ Units / Reader API（/api/units/*）
  // 最終路徑：GET /api/units, GET /api/units/:id
  // 注意：此路由預設不強制登入（不影響既有）；若要 admin 可預覽未上架，可改為加 authMiddleware
  app.use("/api/units", unitsRoute);
  INIT_STATUS.routes.units = true;

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

  


  // ✅ Billing（建立 Lemon 付款連結，帶 external_id=profiles.id）
  // 最終路徑：POST /api/billing/checkout-url
  app.use("/api/billing", billingRoute);
  INIT_STATUS.routes.billing = true;

  // ✅ Lemon Squeezy Webhook（POST /api/webhooks/lemon）
  // 路徑說明：
  // - 本檔掛載：app.use("/api", lemonWebhookRoute)
  // - route 檔內定義：POST /webhooks/lemon
  // ✅ 最終生效路徑：POST /api/webhooks/lemon
  app.use("/api", lemonWebhookRoute);
  INIT_STATUS.routes.lemonWebhook = true;
  // 初始化狀態補充（便於 runtime 排查）
    logger.info(`[INIT] routes.adminUsage mounted at: /admin`);
    logger.info(`[INIT] routes.billing mounted at: /api/billing/checkout-url`);
    logger.info(`[INIT] routes.lemonWebhook mounted at: /api/webhooks/lemon`);
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
logger.info("[server] INIT_DONE");
// backend/src/server.js
// END PATH: backend/src/server.js
