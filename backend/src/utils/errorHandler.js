const { logger } = require('./logger');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Express 用的錯誤處理 middleware
function errorMiddleware(err, req, res, next) {
  const status = err.statusCode || 500;
  const message = err.message || 'Server error';

  logger.error(err.stack || err);

  res.status(status).json({
    error: message,
  });
}

module.exports = {
  AppError,
  errorMiddleware,
};
