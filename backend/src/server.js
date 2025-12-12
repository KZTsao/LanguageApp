require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const analyzeRoute = require('./routes/analyzeRoute');
const ttsRoute = require("./routes/ttsRoute");
const dictionaryRoute = require('./routes/dictionaryRoute'); // ★ 例句 API
const authTestRoute = require("./routes/authTestRoute");      // ★ /api/auth-test
const adminUsageRoute = require('./routes/adminUsageRoute');  // ★ 新增：用量管理 API

const { errorMiddleware } = require('./utils/errorHandler');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// 靜態檔案（測試頁用）
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Routes
app.use('/api/analyze', analyzeRoute);
app.use('/api/tts', ttsRoute);
app.use('/api/dictionary', dictionaryRoute); // ★ 例句 API
app.use('/api', authTestRoute);              // ★ /api/auth-test

// Admin / 用量檢視
app.use('/admin', adminUsageRoute);

// Error handler
app.use(errorMiddleware);

app.listen(PORT, () => {
  logger.info(`LanguageApp backend running on http://localhost:${PORT}`);
});
