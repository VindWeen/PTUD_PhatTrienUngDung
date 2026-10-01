import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from '../../backend/src/config/database.js';
import { migrateUp } from './migrate.js';
import { seedDatabase } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const protectedUrls = [process.env.SUPABASE_DB_URL, process.env.DATABASE_URL].filter(Boolean);

if (!testDatabaseUrl) {
  throw new Error('Thiếu TEST_DATABASE_URL. Không dùng SUPABASE_DB_URL của môi trường auth để chạy W1-P2.');
}

if (protectedUrls.includes(testDatabaseUrl)) {
  throw new Error('TEST_DATABASE_URL trùng database đang cấu hình cho backend. Đã từ chối chạy seed/TRUNCATE.');
}

if (process.env.CONFIRM_TEST_DB_RESET !== 'W1-P2') {
  throw new Error('Đặt CONFIRM_TEST_DB_RESET=W1-P2 để xác nhận database đích là DB test có thể reset dữ liệu.');
}

const parsedUrl = new URL(testDatabaseUrl);
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname);
const pool = new Pool({
  connectionString: testDatabaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 4,
});

try {
  await migrateUp(pool);
  await seedDatabase(pool);
  const testSql = fs.readFileSync(
    path.resolve(__dirname, '../../supabase/tests/w1_p2_profiles_catalogs_test.sql'),
    'utf8'
  );
  await pool.query(testSql);
  console.log('✅ W1-P2 migration, seed và kiểm tra constraint đạt trên DB test riêng.');
} finally {
  await pool.end();
}
