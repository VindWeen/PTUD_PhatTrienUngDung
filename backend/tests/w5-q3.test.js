/**
 * ==============================================================================
 * BỘ KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN W5-Q3 (W5-Q3 AUTOMATED TEST SUITE)
 * TRIỂN KHAI DEMO, BACKUP VÀ RESTORE CSDL / KHO FILE PRIVATE
 * ==============================================================================
 * Phụ trách: Tạ Trần Vinh Quang (W5-Q3)
 * Dự án: PTUD_PhatTrienUngDung
 * 
 * Phạm vi kiểm thử:
 *  1. Cấu hình triển khai: Express TLS, pooler Supabase, CORS đa nguồn và Cookie HttpOnly
 *  2. Sao lưu CSDL: Xuất schema DDL, data DML, roles & permissions
 *  3. Cô lập tệp tin: Kiểm chứng tệp private KHÔNG nằm trong DB dump (chỉ lưu metadata)
 *  4. Cơ chế an toàn (Safety Guard): Chặn đứng nguy cơ restore đè DB làm việc chính
 *  5. Khôi phục thử nghiệm tách biệt: Khôi phục vào isolated schema và kho file riêng
 *  6. So sánh mã băm (Hash Checksum): Khớp 100% SHA-256 giữa file khôi phục và manifest
 *  7. Tải minh chứng & Phân quyền: Đọc file qua storage adapter và đối chiếu hash DB
 *  8. Khởi động lại & Giới hạn gói Free: Đo latency, kiểm tra quota 500MB và tính tự chủ
 * ==============================================================================
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import config from '../src/config/env.js';
import { getDbPoolConfig, connectDB, closeDB } from '../src/config/database.js';
import { getCookieOptions } from '../src/modules/auth/authController.js';
import { LocalStorageAdapter } from '../src/modules/evidences/storage/localStorageAdapter.js';
import { runBackup } from '../../scripts/backup.mjs';
import { runRestore } from '../../scripts/restore.mjs';
import { runPreDemoCheck } from '../../scripts/pre-demo-check.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

test('1. [W5-Q3 Cấu hình & TLS] Cấu hình Express, TLS pooler, CORS đa nguồn và Cookie HttpOnly linh hoạt', async (t) => {
  // 1. Kiểm tra cấu hình TLS / SSL cho Supabase
  const poolConfig = getDbPoolConfig();
  assert.ok(poolConfig, 'Phải sinh cấu hình kết nối pg.Pool hợp lệ');
  assert.ok(poolConfig.connectionString || poolConfig.host, 'Phải có connection string hoặc host');

  const isSupabaseCloud = (poolConfig.connectionString && (
    poolConfig.connectionString.includes('supabase.co') ||
    poolConfig.connectionString.includes('supabase.com')
  )) || config.DB_SSL;

  if (isSupabaseCloud) {
    assert.deepEqual(poolConfig.ssl, { rejectUnauthorized: false }, 'TLS phải được kích hoạt an toàn với pooler');
  }

  // 2. Kiểm tra tùy chọn Cookie HttpOnly (getCookieOptions)
  const defaultCookieOpts = getCookieOptions(false);
  assert.equal(defaultCookieOpts.httpOnly, true, 'Cookie refresh token bắt buộc phải là HttpOnly');
  assert.equal(defaultCookieOpts.path, '/', 'Path cookie phải là root (/)');
  assert.equal(defaultCookieOpts.maxAge, 7 * 24 * 60 * 60 * 1000, 'Hạn mặc định là 7 ngày');

  const rememberMeCookieOpts = getCookieOptions(true);
  assert.equal(rememberMeCookieOpts.maxAge, 30 * 24 * 60 * 60 * 1000, 'RememberMe bật thì maxAge là 30 ngày');

  // 3. Kiểm tra biến môi trường mở rộng cho demo
  assert.ok(config.PORT > 0, 'Port phải là số nguyên dương');
  assert.ok(typeof config.CORS_ORIGIN === 'string', 'CORS_ORIGIN phải là chuỗi hợp lệ');
  assert.ok(typeof config.API_PREFIX === 'string', 'API_PREFIX phải là chuỗi hợp lệ');
});

test('2. [W5-Q3 Sao lưu CSDL] Thực thi sao lưu CSDL (schema, data, roles) và xuất đầy đủ tệp tin', async (t) => {
  const testBackupDir = path.resolve(projectRoot, `backups/test_backup_${Date.now()}`);
  
  const backupResult = await runBackup({ outDir: testBackupDir });
  assert.equal(backupResult.success, true, 'Quá trình sao lưu phải báo thành công');
  assert.ok(fs.existsSync(testBackupDir), 'Thư mục backup phải được tạo');

  const schemaFile = path.join(testBackupDir, 'schema.sql');
  const rolesFile = path.join(testBackupDir, 'roles.sql');
  const dataFile = path.join(testBackupDir, 'data.sql');
  const manifestFile = path.join(testBackupDir, 'backup_manifest.json');

  assert.ok(fs.existsSync(schemaFile), 'Phải tồn tại file schema.sql');
  assert.ok(fs.existsSync(rolesFile), 'Phải tồn tại file roles.sql');
  assert.ok(fs.existsSync(dataFile), 'Phải tồn tại file data.sql');
  assert.ok(fs.existsSync(manifestFile), 'Phải tồn tại file backup_manifest.json');

  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  assert.ok(manifest.database.totalTables >= 50, `Phải có ít nhất 50 bảng trong CSDL (thực tế: ${manifest.database.totalTables})`);
  assert.ok(manifest.database.totalRows > 0, `Phải có dữ liệu trong các bảng (thực tế: ${manifest.database.totalRows} dòng)`);
  assert.ok(manifest.storage.totalFiles > 0, `Kho file private phải có tệp tin (thực tế: ${manifest.storage.totalFiles} tệp)`);

  // Lưu lại đường dẫn để các test case tiếp theo sử dụng
  t.diagnostic(`Backup tạo thành công tại: ${testBackupDir}`);
});

test('3. [W5-Q3 Cô lập File Private] Nghiệm thu: File private KHÔNG nằm trong DB dump, chỉ lưu metadata', async (t) => {
  const backupsRoot = path.resolve(projectRoot, 'backups');
  const latestBackupDir = fs.readdirSync(backupsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('test_backup_'))
    .map(d => path.join(backupsRoot, d.name))
    .sort()
    .reverse()[0];

  assert.ok(latestBackupDir, 'Phải tìm thấy bản backup thử nghiệm');

  const dataSqlContent = fs.readFileSync(path.join(latestBackupDir, 'data.sql'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(latestBackupDir, 'backup_manifest.json'), 'utf8'));

  // 1. Kiểm tra tiêu chí nghiệm thu từ manifest
  assert.equal(manifest.acceptanceCriteria.privateFilesNotInDbDump, true, 'Tiêu chí privateFilesNotInDbDump phải là true');
  assert.equal(manifest.acceptanceCriteria.evidenceFilesInDbAreMetadataOnly, true, 'Tiêu chí evidenceFilesInDbAreMetadataOnly phải là true');

  // 2. Kiểm tra không có dữ liệu nhị phân hex bytea lớn trong dump
  const byteaHexMatches = dataSqlContent.match(/\\x[0-9a-fA-F]{200,}/g);
  assert.equal(byteaHexMatches, null, 'SQL Data dump không được chứa chuỗi bytea hex dữ liệu nhị phân dung lượng lớn');

  // 3. Kiểm tra các dòng INSERT vào evidence_files chỉ chứa thông tin metadata
  const evidenceFileInserts = dataSqlContent.split('\n').filter(line => line.includes('INSERT INTO app."evidence_files"'));
  for (const insertLine of evidenceFileInserts) {
    assert.ok(insertLine.includes('evidences/'), 'Dòng insert phải chứa đường dẫn storageKey dạng text');
    assert.ok(insertLine.includes('.pdf') || insertLine.includes('.png'), 'Dòng insert phải chứa phần mở rộng file');
    // Không chứa buffer/bytea
    assert.ok(!insertLine.includes('\\x'), 'Dòng insert metadata không được nhúng nội dung bytea');
  }
});

test('4. [W5-Q3 Safety Guard] Chặn đứng nguy cơ vô tình restore đè lên CSDL làm việc chính', async (t) => {
  const backupsRoot = path.resolve(projectRoot, 'backups');
  const latestBackupDir = fs.readdirSync(backupsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('test_backup_'))
    .map(d => path.join(backupsRoot, d.name))
    .sort()
    .reverse()[0];

  assert.ok(latestBackupDir, 'Phải có bản backup để kiểm thử');

  // Cố tình yêu cầu restore đè vào schema chính 'app' mà không có cờ force
  await assert.rejects(
    async () => {
      await runRestore({
        backupDir: latestBackupDir,
        targetSchema: 'app', // Trỏ đè vào schema chính
        forceOverwritePrimary: false,
      });
    },
    (err) => {
      assert.ok(err.message.includes('PHÁT HIỆN NGUY HIỂM'), 'Phải ném lỗi cảnh báo an toàn');
      assert.ok(err.message.includes('KHÔNG RESTORE ĐÈ DB LÀM VIỆC'), 'Phải nêu rõ tiêu chí nghiệm thu');
      return true;
    },
    'Hệ thống bắt buộc phải ném ngoại lệ chặn restore đè DB làm việc'
  );
});

test('5. [W5-Q3 Isolated Restore & Hashes] Khôi phục sang schema thử nghiệm tách biệt và đối chiếu 100% SHA-256', async (t) => {
  const backupsRoot = path.resolve(projectRoot, 'backups');
  const latestBackupDir = fs.readdirSync(backupsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('test_backup_'))
    .map(d => path.join(backupsRoot, d.name))
    .sort()
    .reverse()[0];

  const targetTestStorageDir = path.resolve(projectRoot, 'storage/test_restored_temp');

  const restoreResult = await runRestore({
    backupDir: latestBackupDir,
    targetSchema: 'app_restore_test',
    targetStorageDir: targetTestStorageDir,
  });

  assert.equal(restoreResult.success, true, 'Khôi phục thử nghiệm phải thành công');
  const report = restoreResult.report;

  // 1. Kiểm tra an toàn
  assert.equal(report.results.safetyGuardsPassed, true, 'Safety guard phải pass');
  assert.equal(report.results.primaryDbPreservedWithoutOverwrite, true, 'DB làm việc phải được giữ nguyên');

  // 2. Kiểm tra số lượng bảng và bản ghi CSDL đã khôi phục
  assert.ok(report.results.databaseRestore.totalTables >= 50, 'Số bảng khôi phục phải đạt chuẩn');
  assert.ok(report.results.databaseRestore.totalRows > 0, 'Dữ liệu phải được nạp đầy đủ');

  // 3. Kiểm tra đối soát mã băm 100% khớp
  assert.equal(report.results.storageRestore.allHashesMatched, true, 'Tất cả các file phải khớp mã băm 100%');
  assert.ok(report.results.storageRestore.totalFiles > 0, 'Phải có file được khôi phục');

  // 4. Kiểm tra tải minh chứng
  assert.equal(report.results.evidenceDownloadCheck.allPassed, true, 'Tất cả các tệp minh chứng kiểm thử phải tải thành công');
  assert.ok(report.results.evidenceDownloadCheck.verifiedCount > 0, 'Phải kiểm thử tải ít nhất 1 tệp minh chứng');

  // Dọn dẹp thư mục tạm
  try {
    fs.rmSync(targetTestStorageDir, { recursive: true, force: true });
  } catch {}
});

test('6. [W5-Q3 Proof Download & Quyền] Kiểm thử tải tệp minh chứng qua Storage Adapter có kiểm tra quyền', async (t) => {
  const pool = await connectDB();
  try {
    // 1. Truy vấn một bản ghi minh chứng từ CSDL
    const evidenceRes = await pool.query(`
      SELECT ef.evidence_file_id, ef.storage_key, ef.sha256_hash, ef.file_size, a.lecturer_id
      FROM app.evidence_files ef
      JOIN app.evidences e ON ef.evidence_id = e.evidence_id
      JOIN app.achievements a ON e.achievement_id = a.achievement_id
      LIMIT 1;
    `);

    assert.ok(evidenceRes.rows.length > 0, 'Phải có ít nhất 1 bản ghi evidence_files trong CSDL');
    const evidenceItem = evidenceRes.rows[0];

    // 2. Khởi tạo Storage Adapter trỏ vào kho lưu trữ private thật
    const storage = new LocalStorageAdapter();
    const exists = await storage.fileExists(evidenceItem.storage_key);
    assert.equal(exists, true, `Tệp tin [${evidenceItem.storage_key}] phải tồn tại trên đĩa`);

    // 3. Tải tệp tin và tính toán SHA-256
    const filePath = storage.resolveSafePath(evidenceItem.storage_key);
    const buffer = fs.readFileSync(filePath);
    const calculatedSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    assert.equal(calculatedSha256, evidenceItem.sha256_hash.trim(), 'Mã băm SHA-256 của tệp tải về phải khớp tuyệt đối với DB metadata');
    assert.equal(buffer.length.toString(), evidenceItem.file_size.toString(), 'Dung lượng tệp phải khớp với DB metadata');

    // 4. Kiểm tra phòng chống Path Traversal của Storage Adapter
    assert.throws(
      () => {
        storage.resolveSafePath('../../etc/passwd');
      },
      (err) => err.message.includes('Path Traversal') || err.message.includes('không an toàn'),
      'Storage Adapter bắt buộc phải chặn đứng tấn công Path Traversal'
    );
  } finally {
    await closeDB();
  }
});

test('7. [W5-Q3 Khởi động lại & Free Tier] Đánh thức CSDL qua TLS, kiểm tra quota 500MB và không phụ thuộc trả phí', async (t) => {
  const healthReport = await runPreDemoCheck();

  assert.ok(healthReport, 'Báo cáo kiểm tra sức khỏe phải tồn tại');
  assert.equal(healthReport.demoReadiness.status, 'READY', 'Hệ thống phải sẵn sàng cho buổi demo');
  assert.equal(healthReport.demoReadiness.noPaidServiceDependency, true, 'Hệ thống không được phụ thuộc vào backup trả phí');

  // Kiểm tra độ trễ mạng qua TLS
  assert.ok(healthReport.database.latencyMs < 5000, `Độ trễ phản hồi CSDL phải dưới 5s (thực tế: ${healthReport.database.latencyMs}ms)`);

  // Kiểm tra giới hạn gói Free 500 MB
  const maxBytes = 500 * 1024 * 1024;
  assert.ok(healthReport.database.totalBytes < maxBytes, `Dung lượng CSDL phải dưới 500 MB (thực tế: ${healthReport.database.totalFormatted})`);

  // Kiểm tra Supabase Storage quota = 0B (vì lưu trữ private trên Express)
  assert.equal(healthReport.storage.supabaseStorageQuotaUsed, '0 B', 'Không tiêu tốn dung lượng Supabase Storage');

  // Kiểm tra cô lập bảo mật PostgREST Data API
  assert.equal(healthReport.security.adr001PostgrestIsolated, true, 'Data API của Supabase phải được cô lập (anon bị chặn)');

  // Dọn dẹp các thư mục backup tạm sau khi chạy test
  try {
    const backupsRoot = path.resolve(projectRoot, 'backups');
    const testDirs = fs.readdirSync(backupsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('test_backup_'))
      .map((d) => path.join(backupsRoot, d.name));
    for (const d of testDirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  } catch {}
});
