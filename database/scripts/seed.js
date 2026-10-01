import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, getDbPoolConfig } from '../../backend/src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedSqlPath = path.resolve(__dirname, '../../supabase/seed.sql');

export async function seedDatabase(customPool = null) {
  const pool = customPool || new Pool(getDbPoolConfig());
  const ownPool = !customPool;

  try {
    console.log('🌱 Đang nạp dữ liệu mẫu Supabase (Seed Data)...');
    console.log(`📂 Nguồn seed: ${seedSqlPath}`);

    if (!fs.existsSync(seedSqlPath)) {
      throw new Error(`Không tìm thấy file seed: ${seedSqlPath}`);
    }

    const seedSql = fs.readFileSync(seedSqlPath, 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(seedSql);
      await client.query('COMMIT');
      console.log('✅ Nạp dữ liệu mẫu Supabase PostgreSQL thành công 100%!');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Lỗi khi nạp dữ liệu seed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

// Chạy trực tiếp từ CLI: node database/scripts/seed.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed thất bại:', err);
      process.exit(1);
    });
}
