import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tải biến môi trường: ưu tiên backend/.env, nếu không có tải từ root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Cấu hình Database
  DB_SERVER: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: z.string().default('PTUD_AchievementDB'),
  DB_USER: z.string().optional().default('sa'),
  DB_PASSWORD: z.string().optional().default(''),
  DB_ENCRYPT: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  DB_TRUST_SERVER_CERTIFICATE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
  DB_CONNECTION_TIMEOUT: z.coerce.number().int().default(15000),
  DB_REQUEST_TIMEOUT: z.coerce.number().int().default(30000),

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

export const config = Object.freeze(parsedConfig);
export default config;
