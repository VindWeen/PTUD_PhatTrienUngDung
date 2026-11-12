#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool, getDbPoolConfig } from '../backend/src/config/database.js';
import storage from '../backend/src/modules/evidences/storage/localStorageAdapter.js';

export function parseArgs(args=process.argv.slice(2)) {
  const options={};
  const names={'out-dir':'outDir','storage-dir':'storageDir','server-backup-dir':'serverBackupDir','bak-source-path':'bakSourcePath',
    'backup-dir':'backupDir','target-db':'targetDatabase','target-storage-dir':'targetStorageDir','server-bak-path':'serverBakPath',
    'server-data-dir':'serverDataDir','server-log-dir':'serverLogDir'};
  for(const arg of args){
    if(arg==='--help'||arg==='-h') options.help=true;
    else if(arg==='--apply') options.apply=true;
    else if(arg==='--verify-only') options.verifyOnly=true;
    else if(arg==='--writers-stopped') options.writersStopped=true;
    else {
      const m=arg.match(/^--([^=]+)=(.+)$/);
      if(!m||!names[m[1]]) throw new Error(`Unknown argument: ${arg.split('=')[0]}`);
      options[names[m[1]]]=m[2];
    }
  }
  return options;
}
export const quoteIdentifier=name=>'['+String(name).replace(/\]/g,']]')+']';
export const sqlString=value=>"N'"+String(value).replace(/'/g,"''")+"'";
export function serverJoin(directory,name){
  if(!directory||!path.win32.isAbsolute(directory)&&!path.posix.isAbsolute(directory)) throw new Error('SQL Server file directory must be absolute.');
  return (/^[A-Za-z]:[\\/]|^\\\\/.test(directory)?path.win32:path.posix).join(directory,name);
}
export function within(root,candidate){
  const relative=path.relative(path.resolve(root),path.resolve(candidate));
  return !relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
}
export function safeFile(root,key){
  if(typeof key!=='string'||!key||key.includes('\0')||key.includes('\\')||path.posix.isAbsolute(key)||/^[A-Za-z]:/.test(key)||key.split('/').some(p=>!p||p==='.'||p==='..')) throw new Error('Unsafe relative file key in backup manifest.');
  const full=path.resolve(root,...key.split('/'));
  if(!within(root,full)) throw new Error('File key escapes storage directory.');
  return full;
}
export async function sha256(file){
  const hash=crypto.createHash('sha256');
  for await(const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export function walkFiles(root){
  const files=[];
  function visit(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name),stat=fs.lstatSync(full);
      if(stat.isSymbolicLink()) throw new Error(`Symbolic links/junctions are not supported in a backup: ${entry.name}`);
      if(stat.isDirectory()) visit(full);
      else if(stat.isFile()) files.push(path.relative(root,full).split(path.sep).join('/'));
      else throw new Error(`Unsupported private-storage entry: ${entry.name}`);
    }
  }
  if(fs.existsSync(root)) {if(!fs.lstatSync(root).isDirectory()) throw new Error('Storage source is not a directory.');visit(root);}
  return files.sort();
}
export async function privateReferences(pool){
  return (await pool.query(`SELECT N'evidence' AS kind,evidence_file_id AS file_id,storage_key,file_size,sha256_hash FROM app.evidence_files
    UNION ALL SELECT N'decision',decision_file_id,storage_key,file_size,sha256_hash FROM app.award_decision_files
    ORDER BY kind,file_id;`)).rows.map(row=>({...row,file_id:String(row.file_id),file_size:String(row.file_size),sha256_hash:row.sha256_hash.trim().toLowerCase()}));
}
export async function tableCounts(pool){
  const tables=(await pool.query(`SELECT t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=N'app' ORDER BY t.name;`)).rows;
  const counts={};
  for(const {name} of tables) counts[name]=String((await pool.query(`SELECT COUNT_BIG(*) AS total FROM app.${quoteIdentifier(name)};`)).rows[0].total);
  return counts;
}
export async function copyPrivateStorage(source,destination){
  fs.mkdirSync(destination,{recursive:true});
  const files=[];
  for(const storageKey of walkFiles(source)){
    const src=safeFile(source,storageKey),dst=safeFile(destination,storageKey);
    const before=fs.statSync(src),sourceHash=await sha256(src);
    fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst,fs.constants.COPYFILE_EXCL);
    const after=fs.statSync(src),copiedHash=await sha256(dst);
    if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||sourceHash!==copiedHash) throw new Error(`Private file changed while copying: ${storageKey}`);
    files.push({storageKey,fileSizeBytes:before.size,checksumSha256:sourceHash});
  }
  return files;
}
export function checkReferences(references,files){
  const map=new Map(files.map(file=>[file.storageKey,file]));
  for(const ref of references){
    const file=map.get(ref.storage_key);
    if(!file||String(file.fileSizeBytes)!==String(ref.file_size)||file.checksumSha256.toLowerCase()!==ref.sha256_hash.toLowerCase()) throw new Error(`Missing/mismatched private file referenced by database: ${ref.storage_key}`);
  }
}
export async function runBackup(options={}){
  const config=options.connectionConfig||getDbPoolConfig(),pool=options.pool||new Pool(config),ownPool=!options.pool;
  const id=new Date().toISOString().replace(/[-:.TZ]/g,'')+'_'+crypto.randomBytes(4).toString('hex');
  const outDir=path.resolve(options.outDir||`backups/sqlserver_${id}`),source=path.resolve(options.storageDir||storage.baseDir);
  if(within(source,outDir)||within(outDir,source)) throw new Error('Backup directory and active private storage must be separate.');
  if(fs.existsSync(outDir)) throw new Error('Backup output directory must be new; no existing artifact is overwritten.');
  fs.mkdirSync(path.dirname(outDir),{recursive:true});fs.mkdirSync(outDir);
  try {
    const info=(await pool.query(`SELECT DB_NAME() AS database_name,CONVERT(NVARCHAR(256),SERVERPROPERTY('ServerName')) AS server_name,
      CONVERT(NVARCHAR(4000),SERVERPROPERTY('InstanceDefaultBackupPath')) AS backup_directory;`)).rows[0];
    if(!info?.database_name||['master','model','msdb','tempdb'].includes(info.database_name.toLowerCase())) throw new Error('Refusing to back up a system database through the application backup tool.');
    const referencesBefore=await privateReferences(pool),countsBefore=await tableCounts(pool);
    const filename=`lhu_${id}.bak`,serverBakPath=serverJoin(options.serverBackupDir||info.backup_directory,filename);
    // No user transaction: SQL Server BACKUP is its own engine operation.
    await pool.query(`BACKUP DATABASE ${quoteIdentifier(info.database_name)} TO DISK=@p1 WITH COPY_ONLY,CHECKSUM,INIT,NAME=@p2;`,[serverBakPath,`LHU copy-only ${id}`]);
    const readableBak=options.bakSourcePath||serverBakPath;
    if(!fs.existsSync(readableBak)) throw new Error('SQL backup completed on the server but Node cannot read it (the default SQL folder may deny Node access). Retry with --server-backup-dir=ABSOLUTE_SHARED_FOLDER accessible to both SQL service and Node; use --bak-source-path only for a matching mounted/shared server file.');
    const archiveBak=path.join(outDir,'database.bak');fs.copyFileSync(readableBak,archiveBak,fs.constants.COPYFILE_EXCL);
    const bakHash=await sha256(archiveBak),bakSize=fs.statSync(archiveBak).size;
    const files=await copyPrivateStorage(source,path.join(outDir,'storage_backup'));
    const referencesAfter=await privateReferences(pool),countsAfter=await tableCounts(pool);
    if(JSON.stringify(referencesBefore)!==JSON.stringify(referencesAfter)||JSON.stringify(countsBefore)!==JSON.stringify(countsAfter)) throw new Error('Database changed during backup. Stop writers and retry into a new output directory.');
    // Preserve an explicitly partial database checkpoint even if a pre-existing
    // missing private file prevents a complete application backup. The full restore
    // command deliberately does not accept this file as a complete manifest.
    fs.writeFileSync(path.join(outDir,'database_checkpoint.json'),JSON.stringify({
      formatVersion:2,databaseEngine:'SQL Server',applicationBackupComplete:false,privateFileValidation:'pending',
      createdAt:new Date().toISOString(),database:{name:info.database_name,archiveFile:'database.bak',serverBakPath,sizeBytes:bakSize,sha256:bakHash,copyOnly:true,checksum:true,tableCounts:countsAfter}
    },null,2)+'\n',{flag:'wx'});
    try{checkReferences(referencesAfter,files);}catch(error){
      fs.writeFileSync(path.join(outDir,'backup_failure.json'),JSON.stringify({applicationBackupComplete:false,databaseBackupCreated:true,privateFileValidation:'failed',message:error.message,createdAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
      throw error;
    }
    const manifest={formatVersion:2,databaseEngine:'SQL Server',createdAt:new Date().toISOString(),backupId:id,
      database:{name:info.database_name,server:info.server_name,copyOnly:true,checksum:true,archiveFile:'database.bak',serverBakPath,sizeBytes:bakSize,sha256:bakHash,tableCounts:countsAfter},
      storage:{archiveDirectory:'storage_backup',sourceDirectory:source,files,totalFiles:files.length,totalBytes:files.reduce((n,f)=>n+f.fileSizeBytes,0)},
      privateReferences:referencesAfter,
      consistency:{metadataStable:true,writersStoppedDeclared:Boolean(options.writersStopped),note:'Database backup is engine-consistent. Storage is copied separately; stop writers for a coordinated backup and verify files after isolated restore.'}};
    const manifestPath=path.join(outDir,'backup_manifest.json'),text=JSON.stringify(manifest,null,2)+'\n';
    fs.writeFileSync(manifestPath,text,{flag:'wx'});
    fs.writeFileSync(path.join(outDir,'backup_manifest.sha256'),crypto.createHash('sha256').update(text).digest('hex')+'\n',{flag:'wx'});
    console.log(`SQL Server COPY_ONLY backup complete: ${outDir}; ${files.length} private files verified.`);
    return {success:true,outDir,manifest,manifestPath};
  } finally {if(ownPool)await pool.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let options;
  try{options=parseArgs();}catch(error){console.error(error.message);process.exitCode=1;}
  if(options?.help)console.log('node scripts/backup.mjs [--out-dir=NEW_FOLDER] [--storage-dir=PRIVATE_FOLDER] [--server-backup-dir=SQL_SERVICE_FOLDER] [--bak-source-path=NODE_READABLE_BAK] [--writers-stopped]\nUses configured SQL Server DB; writes COPY_ONLY BAK+CHECKSUM and SHA256 private-file manifest.\nDefault SQL backup folder comes from SERVERPROPERTY. If Node gets EPERM there, select an existing absolute shared folder with --server-backup-dir; both SQL service and Node need access.\nMissing referenced private files fail the full backup; database_checkpoint.json / backup_failure.json explicitly mark any partial artifact. Stop writers for a coordinated database/file backup.');
  else if(options)runBackup(options).catch(error=>{console.error(`Backup failed: ${error.message}`);process.exitCode=1;});
}
