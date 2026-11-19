#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool, getDbPoolConfig } from '../backend/src/config/database.js';
import { storageRoot } from '../backend/src/modules/files.js';

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
export async function privateReferenceSchema(pool){
  const row=(await pool.query(`SELECT CASE
    WHEN COL_LENGTH(N'app.evidence_files',N'id') IS NOT NULL AND COL_LENGTH(N'app.evidence_files',N'byte_size') IS NOT NULL AND COL_LENGTH(N'app.evidence_files',N'sha256') IS NOT NULL THEN N'V2'
    WHEN COL_LENGTH(N'app.evidence_files',N'evidence_file_id') IS NOT NULL AND COL_LENGTH(N'app.evidence_files',N'file_size') IS NOT NULL AND COL_LENGTH(N'app.evidence_files',N'sha256_hash') IS NOT NULL
      AND COL_LENGTH(N'app.award_decision_files',N'decision_file_id') IS NOT NULL AND COL_LENGTH(N'app.award_decision_files',N'file_size') IS NOT NULL AND COL_LENGTH(N'app.award_decision_files',N'sha256_hash') IS NOT NULL THEN N'LEGACY'
    ELSE N'UNSUPPORTED' END AS private_schema;`)).rows[0];
  if(!['V2','LEGACY'].includes(row?.private_schema))throw new Error('Unrecognized private-file database schema; no compatible reference reader.');
  return row.private_schema;
}
export async function privateReferences(pool){
  // Read historical metadata only for isolated restoration verification. Runtime
  // modules and new backup layouts stay on V2; no legacy writes are introduced.
  const schema=await privateReferenceSchema(pool);
  const rows=schema==='LEGACY'?(await pool.query(`SELECT N'evidence' AS kind,evidence_file_id AS file_id,storage_key,file_size,sha256_hash FROM app.evidence_files
    UNION ALL SELECT N'decision',decision_file_id,storage_key,file_size,sha256_hash FROM app.award_decision_files ORDER BY kind,file_id;`)).rows:
    (await pool.query(`SELECT N'evidence' AS kind,id AS file_id,storage_key,byte_size AS file_size,CONVERT(varchar(64),sha256,2) AS sha256_hash FROM app.evidence_files ORDER BY id;`)).rows;
  if(schema==='V2'&&(await pool.query("SELECT OBJECT_ID(N'app.regulation_source_files',N'U') AS table_id;")).rows[0]?.table_id){
    rows.push(...(await pool.query(`SELECT N'regulation_source' AS kind,id AS file_id,regulation_version_id,storage_key,byte_size AS file_size,CONVERT(varchar(64),sha256,2) AS sha256_hash FROM app.regulation_source_files ORDER BY id;`)).rows);
  }
  return rows.map(row=>({...row,file_id:String(row.file_id),...(row.regulation_version_id!=null?{regulation_version_id:String(row.regulation_version_id)}:{}),file_size:String(row.file_size),sha256_hash:(row.sha256_hash||'').trim().toLowerCase()}));
}
// STORAGE_DIR and --storage-dir continue to name the evidence directory.
// Regulation sources use the same sibling resolution as the application.
export function privateStorageRoots(evidenceDirectory=storageRoot){
  const evidences=path.resolve(evidenceDirectory);
  return {evidences,regulations:path.join(path.dirname(evidences),'regulations')};
}
export function referenceArchiveKey(ref,formatVersion=2){
  if(formatVersion===2){
    if(!['evidence','decision'].includes(ref.kind))throw new Error('Legacy v2 archives support only evidence/decision references.');
    safeFile('.',ref.storage_key);
    return ref.storage_key;
  }
  const directory={evidence:'evidences',regulation_source:'regulations'}[ref.kind];
  if(formatVersion!==3||!directory)throw new Error('Unknown private reference kind or archive version.');
  // Validate the unprefixed key before composing its archive namespace.
  safeFile('.',ref.storage_key);
  return `${directory}/${ref.storage_key}`;
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
export function checkReferences(references,files,formatVersion=2){
  if(!Array.isArray(references)||!Array.isArray(files))throw new Error('Missing private references/files in manifest.');
  const map=new Map(files.map(file=>[file.storageKey,file]));
  for(const ref of references){
    const key=referenceArchiveKey(ref,formatVersion),file=map.get(key);
    if(!file||String(file.fileSizeBytes)!==String(ref.file_size)||file.checksumSha256.toLowerCase()!==ref.sha256_hash.toLowerCase()) throw new Error(`Missing/mismatched private file referenced by database: ${key}`);
  }
}
export async function copyAllPrivateStorage(evidenceDirectory,destination){
  const roots=privateStorageRoots(evidenceDirectory),files=[];
  for(const [namespace,source] of Object.entries(roots)){
    for(const file of await copyPrivateStorage(source,path.join(destination,namespace)))files.push({...file,storageKey:`${namespace}/${file.storageKey}`});
  }
  return files;
}
export async function runBackup(options={}){
  if(!options.writersStopped)throw new Error('Stop application, seed and other database/storage writers, then pass --writers-stopped for a coordinated SQL/private-files backup.');
  const config=options.connectionConfig||getDbPoolConfig(),pool=options.pool||new Pool(config),ownPool=!options.pool;
  const id=new Date().toISOString().replace(/[-:.TZ]/g,'')+'_'+crypto.randomBytes(4).toString('hex');
  const outDir=path.resolve(options.outDir||`backups/sqlserver_${id}`),source=path.resolve(options.storageDir||storageRoot);
  for(const root of Object.values(privateStorageRoots(source)))if(within(root,outDir)||within(outDir,root)) throw new Error('Backup directory and both active private storage directories must be separate.');
  if(fs.existsSync(outDir)) throw new Error('Backup output directory must be new; no existing artifact is overwritten.');
  fs.mkdirSync(path.dirname(outDir),{recursive:true});fs.mkdirSync(outDir);
  try {
    const info=(await pool.query(`SELECT DB_NAME() AS database_name,CONVERT(NVARCHAR(256),SERVERPROPERTY('ServerName')) AS server_name,
      CONVERT(NVARCHAR(4000),SERVERPROPERTY('InstanceDefaultBackupPath')) AS backup_directory;`)).rows[0];
    if(!info?.database_name||['master','model','msdb','tempdb'].includes(info.database_name.toLowerCase())) throw new Error('Refusing to back up a system database through the application backup tool.');
    if(await privateReferenceSchema(pool)!=='V2')throw new Error('New v3 backups require the V2 schema. Historical decision/evidence metadata is supported only for verifying existing legacy archives/restores.');
    const referencesBefore=await privateReferences(pool),countsBefore=await tableCounts(pool);
    const filename=`lhu_${id}.bak`,serverBakPath=serverJoin(options.serverBackupDir||info.backup_directory,filename);
    // No user transaction: SQL Server BACKUP is its own engine operation.
    await pool.query(`BACKUP DATABASE ${quoteIdentifier(info.database_name)} TO DISK=@p1 WITH COPY_ONLY,CHECKSUM,INIT,NAME=@p2;`,[serverBakPath,`LHU copy-only ${id}`]);
    const readableBak=options.bakSourcePath||serverBakPath;
    if(!fs.existsSync(readableBak)) throw new Error('SQL backup completed on the server but Node cannot read it (the default SQL folder may deny Node access). Retry with --server-backup-dir=ABSOLUTE_SHARED_FOLDER accessible to both SQL service and Node; use --bak-source-path only for a matching mounted/shared server file.');
    const archiveBak=path.join(outDir,'database.bak');fs.copyFileSync(readableBak,archiveBak,fs.constants.COPYFILE_EXCL);
    const bakHash=await sha256(archiveBak),bakSize=fs.statSync(archiveBak).size;
    const files=await copyAllPrivateStorage(source,path.join(outDir,'storage_backup'));
    const referencesAfter=await privateReferences(pool),countsAfter=await tableCounts(pool);
    if(JSON.stringify(referencesBefore)!==JSON.stringify(referencesAfter)||JSON.stringify(countsBefore)!==JSON.stringify(countsAfter)) throw new Error('Database changed during backup. Stop writers and retry into a new output directory.');
    // Preserve an explicitly partial database checkpoint even if a pre-existing
    // missing private file prevents a complete application backup. The full restore
    // command deliberately does not accept this file as a complete manifest.
    fs.writeFileSync(path.join(outDir,'database_checkpoint.json'),JSON.stringify({
      formatVersion:3,databaseEngine:'SQL Server',applicationBackupComplete:false,privateFileValidation:'pending',
      createdAt:new Date().toISOString(),database:{name:info.database_name,archiveFile:'database.bak',serverBakPath,sizeBytes:bakSize,sha256:bakHash,copyOnly:true,checksum:true,tableCounts:countsAfter}
    },null,2)+'\n',{flag:'wx'});
    try{checkReferences(referencesAfter,files,3);}catch(error){
      fs.writeFileSync(path.join(outDir,'backup_failure.json'),JSON.stringify({applicationBackupComplete:false,databaseBackupCreated:true,privateFileValidation:'failed',message:error.message,createdAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
      throw error;
    }
    const manifest={formatVersion:3,databaseEngine:'SQL Server',createdAt:new Date().toISOString(),backupId:id,
      database:{name:info.database_name,server:info.server_name,copyOnly:true,checksum:true,archiveFile:'database.bak',serverBakPath,sizeBytes:bakSize,sha256:bakHash,tableCounts:countsAfter},
      storage:{archiveDirectory:'storage_backup',sourceDirectories:privateStorageRoots(source),files,totalFiles:files.length,totalBytes:files.reduce((n,f)=>n+f.fileSizeBytes,0)},
      privateReferences:referencesAfter,
      consistency:{metadataStable:true,writersStoppedDeclared:true,note:'Database backup is engine-consistent. Operator declares all database/storage writers stopped across the coordinated backup; verify files after isolated restore.'}};
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
  if(options?.help)console.log('node scripts/backup.mjs --writers-stopped [--out-dir=NEW_FOLDER] [--storage-dir=EVIDENCE_FOLDER] [--server-backup-dir=SQL_SERVICE_FOLDER] [--bak-source-path=NODE_READABLE_BAK]\nWrites v3 COPY_ONLY SQL BAK+CHECKSUM and SHA256 manifest covering evidences and sibling regulations. STORAGE_DIR/--storage-dir still identifies evidence storage.\nStop all application, seed, DB and file writers before --writers-stopped. Default SQL backup folder comes from SERVERPROPERTY; use a shared server-backup-dir when Node cannot read it.\nMissing/mismatched referenced private files fail the full backup; checkpoint/failure files mark partial artifacts.');
  else if(options)runBackup(options).catch(error=>{console.error(`Backup failed: ${error.message}`);process.exitCode=1;});
}
