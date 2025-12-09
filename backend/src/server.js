require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const analyzeRoute = require('./routes/analyzeRoute');
const dictionaryRoute = require('./routes/dictionaryRoute'); // ★ 新增

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
app.use('/api/dictionary', dictionaryRoute); // ★ 新增：例句 API 進這裡

// Error handler
app.use(errorMiddleware);

app.listen(PORT, () => {
  logger.info(`LanguageApp backend running on http://localhost:${PORT}`);
});
