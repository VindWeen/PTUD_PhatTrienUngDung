import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config from './config/env.js';
import correlationId from './middlewares/correlationId.js';
import errorHandler from './middlewares/errorHandler.js';
import notFoundHandler from './middlewares/notFoundHandler.js';
import healthRoutes from './modules/health/healthRoutes.js';

const app = express();

// 1. Bảo mật và tiện ích nền tảng
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(correlationId);

// 2. Logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan(':date[iso] :method :url :status :response-time ms - :res[content-length] [req-id: :req[x-correlation-id]]'));
}

// 3. Khai báo các Routes
const apiPrefix = config.API_PREFIX || '/api/v1';

// Health Check Routes
app.use(`${apiPrefix}/health`, healthRoutes);

// Root Welcome Route
app.get('/', (req, res) => {
  res.json({
    name: 'PTUD - LHU Digital Achievement & Awards System REST API',
    version: '1.0.0',
    documentation: '/docs/api/openapi.yaml',
    healthCheck: `${apiPrefix}/health`,
  });
});

// 4. Bắt lỗi đường dẫn không tồn tại (404)
app.use(notFoundHandler);

// 5. Middleware xử lý lỗi tập trung chuẩn hóa
app.use(errorHandler);

export default app;
