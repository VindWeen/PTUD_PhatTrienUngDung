import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chỉ dùng root .env làm fallback khi backend/.env không tồn tại, tránh trộn cấu hình DB cũ.
const backendEnvPath = path.resolve(__dirname, '../../.env');
const rootEnvPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: existsSync(backendEnvPath) ? backendEnvPath : rootEnvPath });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Cấu hình Database Supabase PostgreSQL
  DATABASE_URL: z.string().optional(),
  SUPABASE_DB_URL: z.string().optional(),
  DB_HOST: z.string().optional().default('localhost'),
  DB_SERVER: z.string().optional(), // tương thích ngược nếu đặt DB_SERVER
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('postgres'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().optional().default(''),
  DB_SSL: z.preprocess((val) => val === 'true' || val === true || val === '1', z.boolean()).default(false),
  DB_CONNECTION_TIMEOUT: z.coerce.number().int().default(15000),

  // Pool
  DB_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(10),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16).default('ptud_lhu_super_secret_access_key_2026_dev_only'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('2h'),
  JWT_REFRESH_SECRET: z.string().min(16).default('ptud_lhu_super_secret_refresh_key_2026_dev_only'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Storage
  UPLOAD_DIR: z.string().default('../storage/evidences'),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().default(10485760),
});

let parsedConfig;
try {
  parsedConfig = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ LỖI CẤU HÌNH BIẾN MÔI TRƯỜNG (.env invalid):');
    error.errors.forEach((err) => {
      console.error(`  - Biến [${err.path.join('.')}]: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// Chuẩn hóa DB_HOST từ DB_SERVER nếu có
if (!process.env.DB_HOST && parsedConfig.DB_SERVER) {
  parsedConfig.DB_HOST = parsedConfig.DB_SERVER;
}

export const config = Object.freeze(parsedConfig);
export default config;
