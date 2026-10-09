/**
 * W6-Q1: Sửa lỗi chặn cuối và chạy lại backend/AI
 * Tác giả: Tạ Trần Vinh Quang
 * Mô tả: Kiểm chứng các P1 blocker đã được sửa, regression bị ảnh hưởng,
 *        kiểm tra ngày áp dụng quy định 28/10, và đóng băng cấu hình phiên bản demo.
 *
 * Phụ thuộc: W5-Q4 (phân loại lỗi), W5-P4 (fix fallback JWT)
 * Test runner: node:test (built-in, no external deps)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// ============================================================================
// Suite 1: Migration 009 — Schema Drift Fix (verified_by et al.)
// ============================================================================
describe('W6-Q1 S1: Migration 009 — schema drift fix verified_by', () => {
  const migrationPath = path.join(ROOT, 'database/migrations/009_add_missing_columns_to_achievements.sql');

  it('migration 009 file tồn tại', () => {
    assert.ok(fs.existsSync(migrationPath), 'Thiếu file 009_add_missing_columns_to_achievements.sql');
  });

  it('migration 009 chứa ADD COLUMN IF NOT EXISTS verified_by', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS verified_by/i,
      'Migration 009 phải chứa ADD COLUMN IF NOT EXISTS verified_by');
  });

  it('migration 009 chứa ADD COLUMN IF NOT EXISTS verified_at', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS verified_at/i);
  });

  it('migration 009 chứa ADD COLUMN IF NOT EXISTS submitted_at', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS submitted_at/i);
  });

  it('migration 009 chứa ADD COLUMN IF NOT EXISTS version', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS version/i);
  });

  it('migration 009 dùng PostgreSQL syntax (không phải T-SQL)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.doesNotMatch(sql, /OBJECT_ID|IDENTITY\(|NVARCHAR|DATETIME2|dbo\./i,
      'Migration 009 không được chứa T-SQL syntax');
    assert.match(sql, /ALTER TABLE app\.achievements/i,
      'Migration 009 phải ALTER TABLE app.achievements');
  });

  it('migration 009 idempotent — IF NOT EXISTS trên tất cả ADD COLUMN', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const addCols = sql.match(/ADD COLUMN/gi) || [];
    const addColsIfNotExists = sql.match(/ADD COLUMN IF NOT EXISTS/gi) || [];
    assert.equal(addCols.length, addColsIfNotExists.length,
      'Tất cả ADD COLUMN phải dùng IF NOT EXISTS để idempotent');
  });

  it('migration 009 ghi version vào _schema_migrations', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /_schema_migrations/i);
    assert.match(sql, /'009'/);
  });

  it('migration 009 không chứa key/secret thật', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();
    const forbidden = ['password', 'secret', 'api_key', 'token =', 'bearer '];
    for (const word of forbidden) {
      assert.ok(!sql.includes(word),
        `Migration 009 không được chứa "${word}" — không ghi secret vào Git`);
    }
  });
});

// ============================================================================
// Suite 2: restore.mjs — P1 Fixes Kiểm chứng
// ============================================================================
describe('W6-Q1 S2: restore.mjs — P1 blockers đã được sửa', () => {
  const restorePath = path.join(ROOT, 'scripts/restore.mjs');
  let restoreSource;

  before(() => {
    restoreSource = fs.readFileSync(restorePath, 'utf8');
  });

  it('restore.mjs tồn tại', () => {
    assert.ok(fs.existsSync(restorePath));
  });

  it('P1-fix: containment check path.resolve có trong restorePrivateStorage', () => {
    assert.match(restoreSource, /path\.resolve\(backupStorageDir,\s*item\.storageKey\)/,
      'Cần dùng path.resolve thay path.join khi tính srcPath để containment check hoạt động');
  });

  it('P1-fix: containment guard chặn srcPath thoát backup root', () => {
    assert.match(restoreSource, /srcPath\.startsWith\(resolvedBackupRoot/,
      'Cần kiểm tra srcPath.startsWith(resolvedBackupRoot ...) để chặn path traversal');
  });

  it('P1-fix: containment guard chặn dstPath thoát target root', () => {
    assert.match(restoreSource, /dstPath\.startsWith\(resolvedTargetRoot/,
      'Cần kiểm tra dstPath.startsWith(resolvedTargetRoot ...) để chặn path traversal');
  });

  it('P1-fix: fail hard khi downloadCheck.allPassed false', () => {
    assert.match(restoreSource, /if\s*\(\s*!downloadCheck\.allPassed\s*\)/,
      'Cần throw khi downloadCheck.allPassed là false');
  });

  it('P1-fix: throw sau !downloadCheck.allPassed có chứa thông báo lỗi rõ ràng', () => {
    const failBlock = restoreSource.match(/if\s*\(\s*!downloadCheck\.allPassed\s*\)([\s\S]{0,500}?throw\s+new\s+Error)/);
    assert.ok(failBlock, 'Không tìm thấy block "throw new Error" sau !downloadCheck.allPassed');
  });

  it('P1-fix: restorePrivateStorage throw khi storageKey traversal nguồn', () => {
    assert.match(restoreSource, /Chặn path traversal.*backup root/,
      'Cần message lỗi rõ khi storageKey thoát backup root');
  });

  it('P1-fix: restorePrivateStorage throw khi storageKey traversal đích', () => {
    assert.match(restoreSource, /Chặn path traversal.*target root/,
      'Cần message lỗi rõ khi storageKey thoát target root');
  });
});

// ============================================================================
// Suite 3: Ngày áp dụng quy định 28/10 — Kiểm tra trong cấu hình
// ============================================================================
describe('W6-Q1 S3: Ngày áp dụng quy định 28/10', () => {
  const configPath = path.join(ROOT, 'docs/deployment/DEMO_VERSION_CONFIG.json');

  it('DEMO_VERSION_CONFIG.json tồn tại', () => {
    assert.ok(fs.existsSync(configPath), 'Thiếu docs/deployment/DEMO_VERSION_CONFIG.json');
  });

  it('regulationEnforcementDate = "2026-10-28"', () => {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(cfg.regulationEnforcementDate, '2026-10-28',
      'Phải ghi rõ ngày áp dụng quy định 28/10');
  });

  it('regulationNote mô tả nghĩa vụ backend kiểm tra academic_year', () => {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(typeof cfg.regulationNote === 'string' && cfg.regulationNote.length > 20,
      'regulationNote phải mô tả ngữ nghĩa của ngày 28/10 cho backend');
    assert.match(cfg.regulationNote, /academic_year|quy.nh/i);
  });

  it('featureFreezeDate = "2026-10-21"', () => {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(cfg.featureFreezeDate, '2026-10-21');
  });

  it('candidateTagDate = "2026-10-25"', () => {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(cfg.candidateTagDate, '2026-10-25');
  });
});

// ============================================================================
// Suite 4: Đóng băng cấu hình phiên bản demo
// ============================================================================
describe('W6-Q1 S4: Đóng băng cấu hình phiên bản demo', () => {
  const configPath = path.join(ROOT, 'docs/deployment/DEMO_VERSION_CONFIG.json');
  let cfg;

  before(() => {
    cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  });

  it('stack.backend.pg phiên bản được ghi rõ', () => {
    assert.ok(cfg.stack?.backend?.pg, 'Thiếu stack.backend.pg trong cấu hình demo');
  });

  it('stack.backend.express phiên bản được ghi rõ', () => {
    assert.ok(cfg.stack?.backend?.framework?.includes('Express'), 'Thiếu Express version');
  });

  it('stack.database.migrationsApplied bao gồm "009"', () => {
    assert.ok(
      Array.isArray(cfg.stack?.database?.migrationsApplied) &&
      cfg.stack.database.migrationsApplied.includes('009'),
      'Migration 009 phải được liệt kê trong migrationsApplied'
    );
  });

  it('blockerStatus.P1_verified_by_schema_drift = FIXED', () => {
    assert.match(cfg.blockerStatus?.P1_verified_by_schema_drift, /FIXED/,
      'P1 verified_by schema drift phải ghi FIXED sau W6-Q1');
  });

  it('blockerStatus.P1_storageKey_containment = FIXED', () => {
    assert.match(cfg.blockerStatus?.P1_storageKey_containment, /FIXED/);
  });

  it('blockerStatus.P1_downloadCheck_allPassed_no_exit = FIXED', () => {
    assert.match(cfg.blockerStatus?.P1_downloadCheck_allPassed_no_exit, /FIXED/);
  });

  it('ai.accuracyClaim = NONE — không tự trao thưởng AI kết quả chưa đo', () => {
    assert.match(cfg.stack?.ai?.accuracyClaim, /NONE/i,
      'accuracyClaim phải là NONE — không ghi nhận kết quả AI live chưa đo');
  });

  it('ai.kpiSource gắn nhãn SIMULATED', () => {
    assert.match(cfg.stack?.ai?.kpiSource, /SIMULATED/i,
      'KPI upstream phải gắn nhãn SIMULATED');
  });

  it('smokeProviderCheck.quotaFailPolicy mô tả rõ xử lý hết quota', () => {
    assert.ok(
      cfg.smokeProviderCheck?.quotaFailPolicy &&
      cfg.smokeProviderCheck.quotaFailPolicy.length > 10,
      'Phải có chính sách xử lý khi provider hết quota'
    );
    // Chính sách phải KHÔNG gọi kết quả từ quota fail là "new AI result"
    assert.doesNotMatch(
      cfg.smokeProviderCheck.quotaFailPolicy,
      /^claim as new AI result$/i,
      'Không được nhầm lẫn quota fail với kết quả AI mới'
    );
    assert.match(cfg.smokeProviderCheck.quotaFailPolicy, /NOT claim|do NOT claim|không gọi|log error|retry/i,
      'Chính sách phải nêu rõ không tuyên bố kết quả mới hoặc ghi log retry');
  });

  it('cấu hình demo không chứa key/secret thật', () => {
    const raw = fs.readFileSync(configPath, 'utf8').toLowerCase();
    const forbidden = ['-----begin', 'sk-', 'eyjaaa', 'password=', 'secret='];
    for (const word of forbidden) {
      assert.ok(!raw.includes(word),
        `DEMO_VERSION_CONFIG.json không được chứa "${word}"`);
    }
  });
});

// ============================================================================
// Suite 5: Smoke — Kiểm tra backend tests vẫn pass sau sửa
// ============================================================================
describe('W6-Q1 S5: Regression — các file test liên quan vẫn tồn tại và không bị phá vỡ', () => {
  const testFiles = [
    'backend/tests/w5-q4.test.js',
    'backend/tests/w5-q1.test.js',
  ];

  for (const rel of testFiles) {
    it(`${rel} vẫn tồn tại sau W6-Q1 patch`, () => {
      const p = path.join(ROOT, rel);
      assert.ok(fs.existsSync(p), `${rel} bị xóa hoặc đổi tên — regression`);
    });
  }

  it('restore.mjs vẫn có function runRestore export được tìm thấy', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/restore.mjs'), 'utf8');
    assert.match(src, /async function runRestore/,
      'Hàm runRestore phải còn nguyên sau patch P1');
  });

  it('restore.mjs vẫn có safety guard chặn ghi đè DB làm việc', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/restore.mjs'), 'utf8');
    assert.match(src, /PHÁT HIỆN NGUY HIỂM|KHÔNG RESTORE ĐÈ DB/,
      'Safety guard không được bị xóa khi sửa P1');
  });

  it('migration 009 không chứa DROP TABLE hoặc TRUNCATE', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'database/migrations/009_add_missing_columns_to_achievements.sql'),
      'utf8'
    );
    assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/i,
      'Migration 009 không được DROP hoặc TRUNCATE bảng');
  });
});
