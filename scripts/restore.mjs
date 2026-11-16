#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool,getDbPoolConfig } from '../backend/src/config/database.js';
import { storageRoot } from '../backend/src/v2/files.js';
import {parseArgs,quoteIdentifier,sqlString,serverJoin,within,safeFile,sha256,walkFiles,privateReferences,tableCounts,checkReferences,privateStorageRoots} from './backup.mjs';

export function validateTargetName(target,protectedNames=[]){
  if(typeof target!=='string'||!/^[A-Za-z][A-Za-z0-9_]{2,100}$/.test(target)||!/restore|test/i.test(target)) throw new Error('Explicit isolated target DB name must contain restore/test and use letters, numbers or underscore.');
  if(['master','model','msdb','tempdb',...protectedNames.map(n=>String(n).toLowerCase())].includes(target.toLowerCase())) throw new Error('Restore target must differ from primary/source/system databases.');
  return target;
}
export async function verifyArchive(backupDir){
  const root=path.resolve(backupDir),manifestPath=path.join(root,'backup_manifest.json'),text=fs.readFileSync(manifestPath,'utf8');
  const recorded=fs.readFileSync(path.join(root,'backup_manifest.sha256'),'utf8').trim();
  if(!/^[a-f0-9]{64}$/i.test(recorded)||crypto.createHash('sha256').update(text).digest('hex')!==recorded) throw new Error('Backup manifest SHA256 mismatch.');
  const manifest=JSON.parse(text);
  if(![2,3].includes(manifest.formatVersion)||manifest.databaseEngine!=='SQL Server'||manifest.database?.archiveFile!=='database.bak'||manifest.storage?.archiveDirectory!=='storage_backup'||!Array.isArray(manifest.storage.files)) throw new Error('Unsupported or malformed SQL Server backup manifest.');
  const bak=safeFile(root,manifest.database.archiveFile),bakStat=fs.lstatSync(bak);
  if(!bakStat.isFile()||bakStat.isSymbolicLink()||bakStat.size!==manifest.database.sizeBytes||await sha256(bak)!==manifest.database.sha256) throw new Error('Database BAK SHA256/size mismatch.');
  const archiveStorage=path.join(root,'storage_backup'),actual=walkFiles(archiveStorage),seen=new Set();
  for(const file of manifest.storage.files){
    if(manifest.formatVersion===3&&!/^(evidences|regulations)\/.+$/.test(file.storageKey))throw new Error('V3 files must use evidence/regulation namespaces.');
    if(!Number.isSafeInteger(file.fileSizeBytes)||file.fileSizeBytes<0||!/^[a-f0-9]{64}$/i.test(file.checksumSha256))throw new Error('Invalid private file size/hash in manifest.');
    const full=safeFile(archiveStorage,file.storageKey);
    if(seen.has(file.storageKey))throw new Error('Duplicate private-file key in manifest.');seen.add(file.storageKey);
    const stat=fs.lstatSync(full);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==file.fileSizeBytes||await sha256(full)!==file.checksumSha256) throw new Error(`Private-file SHA256/size mismatch: ${file.storageKey}`);
  }
  if(actual.length!==seen.size||actual.some(key=>!seen.has(key))) throw new Error('Private archive has unlisted/missing files.');
  if(manifest.storage.totalFiles!==seen.size||manifest.storage.totalBytes!==manifest.storage.files.reduce((sum,file)=>sum+file.fileSizeBytes,0))throw new Error('Private manifest totals mismatch.');
  checkReferences(manifest.privateReferences,manifest.storage.files,manifest.formatVersion);
  return {root,manifest,bak,archiveStorage};
}
function restoreConfig(options){
  const original=options.connectionConfig||getDbPoolConfig();
  // Separate administrator credentials are optional and never stored in reports.
  return {...original,database:'master',
    user:process.env.SQL_RESTORE_USER||original.user,password:process.env.SQL_RESTORE_PASSWORD||original.password,
    server:process.env.SQL_RESTORE_HOST||original.server,port:Number(process.env.SQL_RESTORE_PORT||original.port)};
}
export async function runRestore(options={}){
  if(!options.backupDir)throw new Error('An explicit --backup-dir is required; no latest-backup guessing.');
  const archive=await verifyArchive(options.backupDir),primary=options.connectionConfig||getDbPoolConfig();
  if(!options.verifyOnly){
    if(!options.apply)throw new Error('Restore creation requires explicit --apply.');
    validateTargetName(options.targetDatabase,[primary.database,archive.manifest.database.name]);
    if(!options.targetStorageDir)throw new Error('An explicit NEW --target-storage-dir is required.');
  }
  const pool=options.pool||new Pool(restoreConfig(options)),ownPool=!options.pool;
  let targetPool;
  try{
    const directories=(await pool.query(`SELECT CONVERT(NVARCHAR(4000),SERVERPROPERTY('InstanceDefaultBackupPath')) AS backup_directory,
      CONVERT(NVARCHAR(4000),SERVERPROPERTY('InstanceDefaultDataPath')) AS data_directory,
      CONVERT(NVARCHAR(4000),SERVERPROPERTY('InstanceDefaultLogPath')) AS log_directory;`)).rows[0];
    const stage=options.serverBakPath||serverJoin(options.serverBackupDir||directories.backup_directory,`lhu_restore_${crypto.randomBytes(8).toString('hex')}.bak`);
    if(options.serverBakPath){if(!fs.existsSync(stage)||await sha256(stage)!==archive.manifest.database.sha256) throw new Error('Explicit server-bak-path is not a readable copy matching the archive hash.');}
    else fs.copyFileSync(archive.bak,stage,fs.constants.COPYFILE_EXCL);
    await pool.query('RESTORE VERIFYONLY FROM DISK=@p1 WITH CHECKSUM;',[stage]);
    if(options.verifyOnly){console.log('RESTORE VERIFYONLY WITH CHECKSUM passed; archive/private SHA256 verified.');return {success:true,verifyOnly:true,serverBakPath:stage};}
    const target=options.targetDatabase,exists=await pool.query('SELECT DB_ID(@p1) AS database_id;',[target]);
    if(exists.rows[0].database_id!==null)throw new Error('Restore target already exists; no database will be overwritten.');
    const targetStorage=path.resolve(options.targetStorageDir);
    if(fs.existsSync(targetStorage)||within(archive.root,targetStorage)||within(targetStorage,archive.root))throw new Error('Target storage must be new and separate from active storage and backup archive.');
    for(const active of Object.values(privateStorageRoots()))if(within(active,targetStorage)||within(targetStorage,active))throw new Error('Target storage must be separate from both active evidence and regulation storage.');
    const files=(await pool.query('RESTORE FILELISTONLY FROM DISK=@p1;',[stage])).rows;
    if(!files.length||files.some(file=>!['D','L'].includes(file.Type)))throw new Error('Unsupported backup file layout; only ordinary SQL data/log files are accepted.');
    const suffix=crypto.randomBytes(6).toString('hex');
    const moves=files.map((file,index)=>{
      const directory=file.Type==='L'?(options.serverLogDir||directories.log_directory):(options.serverDataDir||directories.data_directory);
      const filename=`${target}_${suffix}_${index}${file.Type==='L'?'.ldf':index===0?'.mdf':'.ndf'}`;
      return `MOVE ${sqlString(file.LogicalName)} TO ${sqlString(serverJoin(directory,filename))}`;
    });
    fs.mkdirSync(path.dirname(targetStorage),{recursive:true});fs.mkdirSync(targetStorage);
    for(const file of archive.manifest.storage.files){const dest=safeFile(targetStorage,file.storageKey);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(safeFile(archive.archiveStorage,file.storageKey),dest,fs.constants.COPYFILE_EXCL);}
    // No REPLACE, SINGLE_USER, DROP or writes to the source database. Recheck target
    // existence in the same batch that issues the nontransactional engine restore.
    await pool.query(`IF DB_ID(@p1) IS NOT NULL THROW 51004,N'Restore target already exists.',1;
      RESTORE DATABASE ${quoteIdentifier(target)} FROM DISK=@p2 WITH FILE=1,CHECKSUM,RECOVERY,${moves.join(',')};`,[target,stage]);
    targetPool=new Pool({...restoreConfig(options),database:target});
    const counts=await tableCounts(targetPool);
    if(JSON.stringify(counts)!==JSON.stringify(archive.manifest.database.tableCounts))throw new Error('Restored table counts differ from the backup manifest. Isolated target is retained for inspection.');
    const references=await privateReferences(targetPool);checkReferences(references,archive.manifest.storage.files,archive.manifest.formatVersion);
    if(JSON.stringify(references)!==JSON.stringify(archive.manifest.privateReferences))throw new Error('Restored private-file metadata/version links differ from the backup manifest.');
    for(const file of archive.manifest.storage.files)if(await sha256(safeFile(targetStorage,file.storageKey))!==file.checksumSha256)throw new Error('Restored private-file SHA256 mismatch.');
    const constraints=await targetPool.query('DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;');
    if(constraints.rows.length)throw new Error('Restored database has constraint violations.');
    const report={success:true,createdAt:new Date().toISOString(),databaseEngine:'SQL Server',backupId:archive.manifest.backupId,
      targetDatabase:target,targetStorageDir:targetStorage,targetEvidenceDirectory:archive.manifest.formatVersion===3?path.join(targetStorage,'evidences'):targetStorage,
      targetRegulationDirectory:archive.manifest.formatVersion===3?path.join(targetStorage,'regulations'):null,archiveFormatVersion:archive.manifest.formatVersion,serverBakPath:stage,tableCounts:counts,privateFilesVerified:archive.manifest.storage.files.length,
      constraintsChecked:true,primaryDatabaseOverwritten:false,note:'Isolated database retained. Server login mapping and runtime secrets must be configured separately before app use.'};
    const reportPath=path.join(targetStorage,'restore_report.json');fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log(`Isolated SQL Server restore verified: ${target}; ${report.privateFilesVerified} private files.`);
    return {success:true,report,reportPath};
  }catch(error){
    if([262,297,300,3110,3201,3013,15151,15247].includes(error.sqlServerNumber||error.number)) error.message+=' SQL Server service needs file access; restore/VERIFYONLY may require separate SQL_RESTORE_USER/PASSWORD administrator credentials. No source database was replaced.';
    throw error;
  }finally{if(targetPool)await targetPool.end();if(ownPool)await pool.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let options;try{options=parseArgs();}catch(error){console.error(error.message);process.exitCode=1;}
  if(options?.help)console.log('node scripts/restore.mjs --backup-dir=FOLDER --verify-only\nnode scripts/restore.mjs --backup-dir=FOLDER --target-db=PTUD_restore_UNIQUE --target-storage-dir=NEW_FOLDER --apply\nV3 restores NEW_FOLDER/evidences and NEW_FOLDER/regulations; point STORAGE_DIR to NEW_FOLDER/evidences. Legacy v2 restores evidence files directly in NEW_FOLDER.\nOptional server-backup-dir/server-bak-path/server-data-dir/server-log-dir; SQL_RESTORE_USER/PASSWORD are separate admin credentials. Existing DB/storage is always refused.');
  else if(options)runRestore(options).catch(error=>{console.error(`Restore refused/failed: ${error.message}`);process.exitCode=1;});
}
