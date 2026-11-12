import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {runBackup,safeFile,sqlString,quoteIdentifier,sha256} from '../../scripts/backup.mjs';
import {validateTargetName,verifyArchive,runRestore} from '../../scripts/restore.mjs';
const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const testRoot=path.join(workspace,'tmp',`sqlserver-backup-check-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);

test('isolated target guards reject primary/system names and unsafe identifiers',()=>{
  assert.throws(()=>validateTargetName('PTUD_LHU',['PTUD_LHU']),/isolated target|differ/);
  assert.throws(()=>validateTargetName('master'),/isolated target|differ/);
  assert.throws(()=>validateTargetName('test_restore',['TEST_RESTORE']),/differ/);
  assert.throws(()=>validateTargetName('test]; DROP DATABASE x;--'),/isolated target/);
  assert.equal(validateTargetName('PTUD_restore_20261111',['PTUD_LHU']),'PTUD_restore_20261111');
  assert.equal(quoteIdentifier('a]b'),'[a]]b]');assert.equal(sqlString("x'y"),"N'x''y'");
});
test('archive paths cannot escape the private directory',()=>{
  for(const key of ['../secret','x/../../secret','/absolute','C:/absolute','a\\b','a//b','a/./b','a\0b']) assert.throws(()=>safeFile(testRoot,key),/Unsafe|escapes/);
  assert.ok(safeFile(testRoot,'evidence/file.pdf').startsWith(testRoot+path.sep));
});
test('SHA256 archive verification detects tampered private files before database access',async()=>{
  const folder=path.join(testRoot,'tamper-fixture'),privateFolder=path.join(folder,'storage_backup');fs.mkdirSync(privateFolder,{recursive:true});
  const bak=path.join(folder,'database.bak'),file=path.join(privateFolder,'proof.pdf');fs.writeFileSync(bak,'synthetic integrity fixture, not a SQL backup');fs.writeFileSync(file,'original');
  const hash=await sha256(file),manifest={formatVersion:2,databaseEngine:'SQL Server',database:{name:'Fixture',archiveFile:'database.bak',sizeBytes:fs.statSync(bak).size,sha256:await sha256(bak)},storage:{archiveDirectory:'storage_backup',files:[{storageKey:'proof.pdf',fileSizeBytes:8,checksumSha256:hash}]},privateReferences:[{storage_key:'proof.pdf',file_size:'8',sha256_hash:hash}]};
  const text=JSON.stringify(manifest);fs.writeFileSync(path.join(folder,'backup_manifest.json'),text);fs.writeFileSync(path.join(folder,'backup_manifest.sha256'),crypto.createHash('sha256').update(text).digest('hex'));
  await verifyArchive(folder);
  fs.writeFileSync(file,'tampered');
  await assert.rejects(verifyArchive(folder),/Private-file SHA256/);
  await assert.rejects(runRestore({backupDir:folder,targetDatabase:'PTUD_restore_fixture',apply:true,targetStorageDir:path.join(testRoot,'unused')}),/Private-file SHA256/);
});
test('native SQL Server COPY_ONLY backup preserves table counts and all private-file hashes',{
  skip:process.env.RUN_SQLSERVER_BACKUP_TEST!=='1',timeout:180000
},async t=>{
  const serverBackupDir=process.env.SQLSERVER_BACKUP_TEST_SERVER_DIR;
  if(serverBackupDir)fs.mkdirSync(serverBackupDir,{recursive:true});
  const result=await runBackup({outDir:path.join(testRoot,'native'),serverBackupDir});
  assert.equal(result.manifest.databaseEngine,'SQL Server');assert.equal(result.manifest.database.copyOnly,true);assert.equal(result.manifest.database.checksum,true);
  assert.ok(result.manifest.database.sizeBytes>0);assert.ok(Object.keys(result.manifest.database.tableCounts).length>=53);
  await verifyArchive(result.outDir);
  t.diagnostic(`Native backup retained for isolated restore: ${result.outDir}`);
  if(process.env.RUN_SQLSERVER_RESTORE_VERIFY==='1'){
    const check=await runRestore({backupDir:result.outDir,verifyOnly:true,serverBackupDir});assert.equal(check.verifyOnly,true);
  }else t.diagnostic('Engine RESTORE VERIFYONLY not requested; set RUN_SQLSERVER_RESTORE_VERIFY=1 with suitable SQL_RESTORE_* credentials.');
});
