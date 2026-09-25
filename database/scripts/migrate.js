import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { sql } from '../../backend/src/config/database.js';
import config from '../../backend/src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../migrations');

function getDbConfig() {
  return {
    server: config.DB_SERVER,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    options: {
      encrypt: config.DB_ENCRYPT,
      trustServerCertificate: config.DB_TRUST_SERVER_CERTIFICATE,
      enableArithAbort: true,
    },
    connectionTimeout: config.DB_CONNECTION_TIMEOUT,
    requestTimeout: config.DB_REQUEST_TIMEOUT,
  };
}

function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

/**
 * Tách script SQL có chứa các khối lệnh GO
 */
function splitSqlBatches(sqlContent) {
  return sqlContent
    .split(/^\s*GO\s*$/im)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0);
}

/**
 * Lấy danh sách toàn bộ các file migration theo thứ tự
 */
export function getMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

/**
 * Khởi tạo bảng _SchemaMigrations nếu chưa có
 */
async function ensureMigrationsTable(pool) {
  const initSql = `
    IF OBJECT_ID('dbo._SchemaMigrations', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo._SchemaMigrations (
        MigrationId BIGINT IDENTITY(1,1) NOT NULL,
        Name VARCHAR(255) NOT NULL,
        AppliedAt DATETIME2(3) NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT (SYSUTCDATETIME()),
        Checksum VARCHAR(64) NULL,
        ExecutionTimeMs INT NULL,
        CONSTRAINT PK_SchemaMigrations PRIMARY KEY CLUSTERED (MigrationId),
        CONSTRAINT UQ_SchemaMigrations_Name UNIQUE NONCLUSTERED (Name)
      );
    END;
  `;
  await pool.request().query(initSql);
}

/**
 * Kiểm tra trạng thái các bản migrations
 */
export async function getMigrationStatus(pool) {
  await ensureMigrationsTable(pool);
  const result = await pool.request().query('SELECT Name, AppliedAt, Checksum FROM dbo._SchemaMigrations ORDER BY MigrationId ASC;');
  const appliedMap = new Map(result.recordset.map((r) => [r.Name, r]));

  const files = getMigrationFiles();
  return files.map((file) => {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const checksum = calculateChecksum(content);
    const applied = appliedMap.get(file);

    return {
      file,
      applied: !!applied,
      appliedAt: applied ? applied.AppliedAt : null,
      checksum,
      matchedChecksum: applied ? applied.Checksum === checksum : true,
    };
  });
}

/**
 * Chạy các migrations chưa được áp dụng (MIGRATE UP)
 */
export async function migrateUp(customPool = null) {
  const pool = customPool || (await new sql.ConnectionPool(getDbConfig()).connect());
  const ownConnection = !customPool;

  try {
    console.log('🔄 Đang kiểm tra danh sách migration...');
    const statuses = await getMigrationStatus(pool);
    const pending = statuses.filter((s) => !s.applied);

    if (pending.length === 0) {
      console.log('✅ Cơ sở dữ liệu đã ở phiên bản mới nhất. Không có migration nào cần chạy.');
      return { appliedCount: 0, pendingCount: 0 };
    }

    console.log(`📌 Tìm thấy ${pending.length} migration cần áp dụng:`);
    let appliedCount = 0;

    for (const item of pending) {
      const filePath = path.join(migrationsDir, item.file);
      const content = fs.readFileSync(filePath, 'utf8');
      const batches = splitSqlBatches(content);
      const startTime = Date.now();

      console.log(`  ▶ Đang chạy: ${item.file}...`);

      const tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      try {
        for (const batch of batches) {
          const req = new sql.Request(tx);
          await req.query(batch);
        }

        const durationMs = Date.now() - startTime;
        const recordReq = new sql.Request(tx);
        recordReq.input('Name', sql.VarChar(255), item.file);
        recordReq.input('Checksum', sql.VarChar(64), item.checksum);
        recordReq.input('ExecutionTimeMs', sql.Int, durationMs);
        await recordReq.query(`
          INSERT INTO dbo._SchemaMigrations (Name, Checksum, ExecutionTimeMs)
          VALUES (@Name, @Checksum, @ExecutionTimeMs);
        `);

        await tx.commit();
        appliedCount++;
        console.log(`  ✅ Hoàn thành: ${item.file} (${durationMs}ms)`);
      } catch (err) {
        console.error(`  ❌ Lỗi khi thực thi migration ${item.file}. Đang ROLLBACK transaction...`);
        try {
          await tx.rollback();
          console.log(`  ↩️ Đã rollback toàn bộ thay đổi của ${item.file}.`);
        } catch (rollbackErr) {
          console.error('Lỗi khi rollback:', rollbackErr.message);
        }
        throw err;
      }
    }

    console.log(`🎉 Đã áp dụng thành công ${appliedCount} migrations!`);
    return { appliedCount, pendingCount: pending.length - appliedCount };
  } finally {
    if (ownConnection && pool) {
      await pool.close();
    }
  }
}

/**
 * Hiển thị bảng trạng thái trên terminal
 */
export async function showStatus() {
  const pool = await new sql.ConnectionPool(getDbConfig()).connect();
  try {
    const statuses = await getMigrationStatus(pool);
    console.log('\n================================================================');
    console.log('TRẠNG THÁI MIGRATIONS TRÊN CƠ SỞ DỮ LIỆU:');
    console.log('================================================================');
    statuses.forEach((s) => {
      const statusIcon = s.applied ? '✅ ĐÃ ÁP DỤNG' : '⏳ CHỜ CHẠY ';
      const time = s.appliedAt ? new Date(s.appliedAt).toISOString() : '---';
      console.log(`[${statusIcon}] ${s.file.padEnd(45)} | ${time}`);
    });
    console.log('================================================================\n');
  } finally {
    await pool.close();
  }
}

// CLI Runner
const command = process.argv[2] || 'up';

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  (async () => {
    try {
      if (command === 'status') {
        await showStatus();
      } else if (command === 'up') {
        await migrateUp();
      } else {
        console.log(`Lệnh không hợp lệ: ${command}. Sử dụng: node migrate.js [up|status]`);
      }
    } catch (err) {
      console.error('❌ Thao tác Migration thất bại:', err.message);
      process.exit(1);
    }
  })();
}

export default { migrateUp, getMigrationStatus, getMigrationFiles, showStatus };
