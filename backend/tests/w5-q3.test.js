import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import config from '../src/config/env.js';
import { getDbPoolConfig } from '../src/config/database.js';
import { getCookieOptions } from '../src/modules/auth/authController.js';
import { LocalStorageAdapter } from '../src/modules/evidences/storage/localStorageAdapter.js';
import { runBackup, copyPrivateStorage, checkReferences, safeFile } from '../../scripts/backup.mjs';
import { runRestore, verifyArchive, validateTargetName } from '../../scripts/restore.mjs';

// Unit tests use a fake SQL engine and isolated temporary files. Native BACKUP/RESTORE
// coverage has its own integration suite; npm test never changes the application's DB.
const digest = data => createHash('sha256').update(data).digest('hex');
let root, source, serverDir, archive;
const bytes = Buffer.from('%PDF-1.4\nPrivate evidence fixture — Tiếng Việt\n');
const key = 'evidences/fixture.pdf';
const metadata = { kind: 'evidence', file_id: '1', storage_key: key, file_size: String(bytes.length), sha256_hash: digest(bytes) };
const statements = [];
const fakePool = {
  async query(sql, params = []) {
    statements.push(sql);
    if (sql.includes('DB_NAME() AS database_name')) return { rows: [{ database_name: 'PTUD_unit_test', server_name: 'FAKE_ENGINE', backup_directory: serverDir }] };
    if (sql.includes('InstanceDefaultDataPath')) return { rows: [{ backup_directory: serverDir, data_directory: serverDir, log_directory: serverDir }] };
    if (sql.includes("N'evidence' AS kind")) return { rows: [{ ...metadata }] };
    if (sql.includes('FROM sys.tables')) return { rows: [{ name: 'evidence_files' }] };
    if (sql.includes('COUNT_BIG(*)')) return { rows: [{ total: '1' }] };
    if (sql.startsWith('BACKUP DATABASE')) {
      fs.writeFileSync(params[0], Buffer.from('UNIT_TEST_ENGINE_BACKUP_CONTAINS_METADATA_ONLY'));
      return { rows: [] };
    }
    if (sql.startsWith('RESTORE VERIFYONLY')) return { rows: [] };
    throw new Error(`Unexpected fake engine query: ${sql}`);
  },
};
test.before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'lhu-sqlserver-unit-'));
  source = path.join(root, 'private'); serverDir = path.join(root, 'sql-service');
  fs.mkdirSync(path.join(source, 'evidences'), { recursive: true }); fs.mkdirSync(serverDir);
  fs.writeFileSync(path.join(source, key), bytes);
});
test.after(() => {
  const resolved = path.resolve(root);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(resolved, { recursive: true, force: true });
});

test('1. SQL Server TLS options, CORS and HttpOnly cookie lifetimes follow configuration', () => {
  const pool = getDbPoolConfig();
  assert.equal(pool.server, config.DB_HOST);
  assert.equal(pool.database, config.DB_NAME);
  assert.equal(pool.port, config.DB_PORT);
  assert.equal(pool.options.encrypt, config.DB_ENCRYPT);
  assert.equal(pool.options.trustServerCertificate, config.DB_TRUST_SERVER_CERTIFICATE);
  assert.equal(pool.options.useUTC, true);
  assert.equal('connectionString' in pool, false);
  assert.equal(getCookieOptions(false).httpOnly, true);
  assert.equal(getCookieOptions(false).path, '/');
  assert.equal(getCookieOptions(false).maxAge, 7 * 86400000);
  assert.equal(getCookieOptions(true).maxAge, 30 * 86400000);
  assert.equal(typeof config.CORS_ORIGIN, 'string');
});

test('2. native backup contract uses COPY_ONLY/CHECKSUM and hashes BAK, manifest and private files', async () => {
  const result = await runBackup({ pool: fakePool, outDir: path.join(root, 'archive'), storageDir: source, writersStopped: true });
  archive = result.outDir;
  assert.equal(result.success, true);
  assert.equal(result.manifest.databaseEngine, 'SQL Server');
  assert.equal(result.manifest.database.copyOnly, true);
  assert.equal(result.manifest.database.checksum, true);
  assert.equal(result.manifest.storage.totalFiles, 1);
  assert.equal(result.manifest.storage.files[0].checksumSha256, digest(bytes));
  assert.deepEqual(result.manifest.database.tableCounts, { evidence_files: '1' });
  assert.ok(statements.some(sql => /BACKUP DATABASE \[PTUD_unit_test\].*COPY_ONLY,CHECKSUM/.test(sql)));
  assert.equal((await verifyArchive(archive)).manifest.backupId, result.manifest.backupId);
});

test('3. private bytes remain separate from BAK and copied files match database metadata', async () => {
  const bak = fs.readFileSync(path.join(archive, 'database.bak'));
  assert.equal(bak.includes(bytes), false);
  const verified = await verifyArchive(archive);
  assert.equal(verified.manifest.privateReferences[0].storage_key, key);
  assert.deepEqual(fs.readFileSync(path.join(archive, 'storage_backup', key)), bytes);
  const restored = await copyPrivateStorage(path.join(archive, 'storage_backup'), path.join(root, 'restored-private'));
  assert.doesNotThrow(() => checkReferences(verified.manifest.privateReferences, restored));
});

test('4. restore refuses unsafe, primary/system and existing target names; apply is explicit', async () => {
  for (const name of ['master', 'tempdb', 'app;DROP DATABASE app', 'PTUD_LHU']) {
    assert.throws(() => validateTargetName(name, ['PTUD_LHU']), /target|differ/);
  }
  assert.throws(() => validateTargetName('PTUD_restore_existing', ['PTUD_restore_existing']), /differ/);
  await assert.rejects(runRestore({ backupDir: archive, pool: fakePool }), /explicit --apply/);
  await assert.rejects(runBackup({ pool: fakePool, outDir: archive, storageDir: source }), /must be new/);
});

test('5. verify-only checks native SQL checksum and archive hash without issuing RESTORE DATABASE', async () => {
  const before = statements.length;
  const result = await runRestore({ backupDir: archive, pool: fakePool, verifyOnly: true });
  assert.equal(result.success, true);
  assert.equal(result.verifyOnly, true);
  const issued = statements.slice(before);
  assert.ok(issued.some(sql => /^RESTORE VERIFYONLY.*WITH CHECKSUM/.test(sql)));
  assert.ok(!issued.some(sql => /^RESTORE DATABASE|DROP DATABASE|ALTER DATABASE/.test(sql)));
});

test('6. missing, mismatched, tampered and traversal private files refuse backup/restore verification', async () => {
  assert.throws(() => checkReferences([metadata], []), /Missing\/mismatched/);
  assert.throws(() => checkReferences([metadata], [{ storageKey: key, fileSizeBytes: 0, checksumSha256: metadata.sha256_hash }]), /Missing\/mismatched/);
  assert.throws(() => checkReferences([metadata], [{ storageKey: key, fileSizeBytes: bytes.length, checksumSha256: '0'.repeat(64) }]), /Missing\/mismatched/);
  for (const bad of ['../secret', '..\\secret', '/etc/passwd', 'C:/secret', 'evidences//file']) assert.throws(() => safeFile(source, bad), /Unsafe|escapes/);
  const privateFile = path.join(archive, 'storage_backup', key);
  fs.writeFileSync(privateFile, 'tampered');
  await assert.rejects(verifyArchive(archive), /SHA256\/size mismatch/);
  fs.writeFileSync(privateFile, bytes);
  fs.unlinkSync(privateFile);
  await assert.rejects(verifyArchive(archive), /ENOENT/);
  fs.writeFileSync(privateFile, bytes);
  const missingSource = path.join(root, 'missing-private'); fs.mkdirSync(missingSource);
  await assert.rejects(runBackup({ pool: fakePool, outDir: path.join(root, 'refused-missing'), storageDir: missingSource }), /Missing\/mismatched private file/);
});

test('7. local private storage download preserves bytes/hash and blocks traversal', async () => {
  const storage = new LocalStorageAdapter(source);
  assert.equal(await storage.fileExists(key), true);
  const downloaded = fs.readFileSync(storage.resolveSafePath(key));
  assert.equal(digest(downloaded), metadata.sha256_hash);
  assert.equal(downloaded.length, Number(metadata.file_size));
  assert.throws(() => storage.resolveSafePath('../../etc/passwd'), /Path Traversal|không an toàn/);
});
