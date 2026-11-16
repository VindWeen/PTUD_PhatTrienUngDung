import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { privateStorageRoots, referenceArchiveKey, checkReferences, runBackup, copyAllPrivateStorage, privateReferences } from './backup.mjs';
import { verifyArchive, validateTargetName } from './restore.mjs';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function temporary(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptud-storage-backup-test-'));
  t.after(async () => {
    const resolved = path.resolve(root), parent = path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith('ptud-storage-backup-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return root;
}
test('evidence STORAGE_DIR semantics retain sibling regulations and distinct archive namespaces', async t => {
  const root = await temporary(t), evidence = path.join(root, 'private', 'custom-evidence');
  const roots = privateStorageRoots(evidence);
  assert.equal(roots.evidences, evidence);
  assert.equal(roots.regulations, path.join(root, 'private', 'regulations'));
  for (const [name, dir] of Object.entries(roots)) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'same.pdf'), name); }
  const files = await copyAllPrivateStorage(evidence, path.join(root, 'copied'));
  assert.deepEqual(files.map(file => file.storageKey), ['evidences/same.pdf','regulations/same.pdf']);
  assert.notEqual(files[0].checksumSha256, files[1].checksumSha256);
  assert.equal(referenceArchiveKey({kind:'regulation_source',storage_key:'same.pdf'},3),'regulations/same.pdf');
  for (const key of ['../escape.pdf','C:\\escape.pdf','/escape.pdf','a/../b.pdf']) assert.throws(() => referenceArchiveKey({kind:'regulation_source',storage_key:key},3));
  assert.throws(() => referenceArchiveKey({kind:'regulation_source',storage_key:'same.pdf'},2), /Legacy/);
  assert.equal(referenceArchiveKey({kind:'decision',storage_key:'awards/2/decision.pdf'},2),'awards/2/decision.pdf');
  assert.throws(()=>referenceArchiveKey({kind:'decision',storage_key:'../outside.pdf'},2),/Unsafe/);
  assert.throws(()=>referenceArchiveKey({kind:'decision',storage_key:'awards/2/decision.pdf'},3),/Unknown/);
});
test('v3 artifacts verify both actual private stores and regulation version/hash references', async t => {
  const root = await temporary(t), roots = privateStorageRoots(path.join(root,'private','evidences'));
  const contents = { evidence: Buffer.from('evidence content'), regulation_source: Buffer.from('official regulation content') };
  await fs.mkdir(path.join(root,'server'));
  for (const dir of Object.values(roots)) await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(roots.evidences,'same.pdf'),contents.evidence);
  await fs.writeFile(path.join(roots.regulations,'same.pdf'),contents.regulation_source);
  const reference = kind => ({kind,file_id:1,...(kind==='regulation_source'?{regulation_version_id:37}:{}),storage_key:'same.pdf',file_size:contents[kind].length,sha256_hash:hash(contents[kind])});
  const pool={async query(sql,params){
    if(sql.includes('COL_LENGTH'))return {rows:[{private_schema:'V2'}]};
    if(sql.includes('DB_NAME()'))return {rows:[{database_name:'PTUD_test_source',server_name:'fixture-only',backup_directory:path.join(root,'server')}]};
    if(sql.includes('OBJECT_ID'))return {rows:[{table_id:1}]};
    if(sql.includes('FROM app.evidence_files'))return {rows:[reference('evidence')]};
    if(sql.includes('FROM app.regulation_source_files'))return {rows:[reference('regulation_source')]};
    if(sql.includes('FROM sys.tables'))return {rows:[]};
    if(sql.startsWith('BACKUP DATABASE')){await fs.writeFile(params[0],Buffer.from('SIMULATED SQL BAK: file workflow test only'));return {rows:[]};}
    throw new Error(`Unexpected query in fixture: ${sql}`);
  }};
  await assert.rejects(runBackup({pool,storageDir:roots.evidences,outDir:path.join(root,'refused')}), /writers-stopped/);
  const result = await runBackup({pool,writersStopped:true,storageDir:roots.evidences,outDir:path.join(root,'archive')});
  assert.equal(result.manifest.formatVersion,3);
  assert.equal(result.manifest.privateReferences[1].regulation_version_id,'37');
  const verified=await verifyArchive(result.outDir);
  assert.equal(verified.manifest.storage.files.length,2);
  await fs.writeFile(path.join(result.outDir,'storage_backup','regulations','same.pdf'),'corrupted source');
  await assert.rejects(verifyArchive(result.outDir), /SHA256\/size mismatch/);
});
test('historical reference reader detects schema before selecting old decision/evidence columns',async()=>{
  const calls=[];
  const pool={async query(sql){calls.push(sql);
    if(sql.includes('COL_LENGTH'))return {rows:[{private_schema:'LEGACY'}]};
    assert.match(sql,/evidence_file_id/);assert.match(sql,/decision_file_id/);assert.doesNotMatch(sql,/byte_size/);
    return {rows:[{kind:'decision',file_id:2,storage_key:'awards/2/source.pdf',file_size:123,sha256_hash:' AABB '},{kind:'evidence',file_id:4,storage_key:'evidences/2026/a.pdf',file_size:456,sha256_hash:' CCDD '}]};
  }};
  assert.deepEqual(await privateReferences(pool),[{kind:'decision',file_id:'2',storage_key:'awards/2/source.pdf',file_size:'123',sha256_hash:'aabb'},{kind:'evidence',file_id:'4',storage_key:'evidences/2026/a.pdf',file_size:'456',sha256_hash:'ccdd'}]);
  assert.equal(calls.length,2);
  await assert.rejects(privateReferences({async query(){return {rows:[{private_schema:'UNSUPPORTED'}]};}}),/Unrecognized/);
});
test('legacy v2 evidence archive remains accepted and reference checks fail closed', async t => {
  const root = await temporary(t), bytes=Buffer.from('legacy evidence'),bak=Buffer.from('SIMULATED legacy BAK');
  await fs.mkdir(path.join(root,'storage_backup'));
  await fs.writeFile(path.join(root,'storage_backup','old.pdf'),bytes);
  await fs.writeFile(path.join(root,'database.bak'),bak);
  const files=[{storageKey:'old.pdf',fileSizeBytes:bytes.length,checksumSha256:hash(bytes)}];
  const refs=[{kind:'evidence',file_id:'1',storage_key:'old.pdf',file_size:String(bytes.length),sha256_hash:hash(bytes)}];
  const manifest={formatVersion:2,databaseEngine:'SQL Server',database:{archiveFile:'database.bak',sizeBytes:bak.length,sha256:hash(bak)},storage:{archiveDirectory:'storage_backup',files,totalFiles:1,totalBytes:bytes.length},privateReferences:refs};
  const text=JSON.stringify(manifest);
  await fs.writeFile(path.join(root,'backup_manifest.json'),text);
  await fs.writeFile(path.join(root,'backup_manifest.sha256'),hash(text));
  assert.equal((await verifyArchive(root)).manifest.formatVersion,2);
  checkReferences(refs,files,2);
  assert.throws(() => checkReferences([{...refs[0],sha256_hash:'0'.repeat(64)}],files,2), /mismatched/);
  assert.throws(() => checkReferences([{...refs[0],kind:'unknown'}],files,3), /Unknown/);
  assert.throws(() => validateTargetName('PTUD_LHU',['PTUD_LHU']));
});
