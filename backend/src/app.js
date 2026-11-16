import regulationSourceRoutes from './v2/regulationSourceRoutes.js';
import regulationDistributionRoutes from './v2/regulationDistributionRoutes.js';
import express from 'express';
import identityRoutes from './v2/identityRoutes.js';
import intelligenceRoutes from './v2/intelligenceRoutes.js';
import vaultRoutes from './v2/vaultRoutes.js';
import supportRoutes from './v2/supportRoutes.js';
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
const allowedOrigins = config.CORS_ORIGIN
  ? config.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép requests không có Origin header (Postman, server-to-server, health probes)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
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

const authAttempts = new Map();
app.use([`${apiPrefix}/auth/login`, `${apiPrefix}/auth/register`, `${apiPrefix}/auth/forgot-password`, `${apiPrefix}/auth/reset-password`], (req, res, next) => {
  const now = Date.now();
  for (const [key, value] of authAttempts) if (value.until <= now) authAttempts.delete(key);
  const key = req.ip;
  const entry = authAttempts.get(key) || { count: 0, until: now + 15 * 60000 };
  if (++entry.count > 30 || (authAttempts.size >= 10000 && !authAttempts.has(key))) return res.status(429).json({success:false,error:{code:'RATE_LIMITED',message:'Quá nhiều yêu cầu. Vui lòng thử lại sau.'}});
  authAttempts.set(key, entry);next();
});

// Health Check Routes
app.use(`${apiPrefix}/health`, healthRoutes);

// Auth Routes
app.use(apiPrefix, identityRoutes);
app.use(apiPrefix, vaultRoutes);
app.use(apiPrefix, regulationSourceRoutes);
app.use(apiPrefix, regulationDistributionRoutes);
app.use(apiPrefix, intelligenceRoutes);
app.use(apiPrefix, supportRoutes);

// Root Welcome Route
app.get('/', (req, res) => {
  res.json({
    name: 'PTUD - Personal Achievement Vault REST API',
    version: '2.0.0',
    healthCheck: `${apiPrefix}/health`,
  });
});

// 4. Bắt lỗi đường dẫn không tồn tại (404)
app.use(notFoundHandler);

// 5. Middleware xử lý lỗi tập trung chuẩn hóa
app.use(errorHandler);

export default app;
