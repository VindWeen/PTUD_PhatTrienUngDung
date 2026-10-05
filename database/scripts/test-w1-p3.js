import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from '../../backend/src/config/database.js';
import { migrateUp } from './migrate.js';
import { seedDatabase } from './seed.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const protectedUrls = [process.env.SUPABASE_DB_URL, process.env.DATABASE_URL].filter(Boolean);
if (!testDatabaseUrl) throw new Error('Thiếu TEST_DATABASE_URL; W1-P3 không chạy trên DB auth/production.');
if (protectedUrls.includes(testDatabaseUrl)) throw new Error('TEST_DATABASE_URL trùng DB backend; từ chối chạy.');
if (process.env.CONFIRM_TEST_DB_RESET !== 'W1-P3') throw new Error('Đặt CONFIRM_TEST_DB_RESET=W1-P3 để xác nhận DB test riêng.');

const parsed = new URL(testDatabaseUrl);
const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
const pool = new Pool({ connectionString: testDatabaseUrl, ssl: local ? false : { rejectUnauthorized: false }, max: 4 });
const here = path.dirname(fileURLToPath(import.meta.url));
try {
  await migrateUp(pool);
  await seedDatabase(pool);
  await pool.query(fs.readFileSync(path.resolve(here, '../../supabase/tests/w1_p3_organization_history_test.sql'), 'utf8'));
  console.log('✅ W1-P3: lịch sử điều chuyển và RESTRICT xóa đơn vị đạt trên DB test riêng.');
} finally { await pool.end(); }
