const { logger } = require("./logger");

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Express 用的錯誤處理 middleware（必須永不 throw）
function errorMiddleware(err, req, res, next) {
  const status = err?.statusCode || 500;
  const message = err?.message || "Server error";
  const requestId = req?.requestId || req?.headers?.["x-request-id"] || null;

  try {
    const stack = err?.stack || err;
    logger.error(stack, requestId ? { requestId } : undefined);
  } catch (e) {
    try { console.error("[ERROR][fallback]", err); } catch (_) {}
  }

  if (res.headersSent) return next(err);

  res.status(status).json({
    error: message,
    requestId,
  });
}

module.exports = {
  AppError,
  errorMiddleware,
};
