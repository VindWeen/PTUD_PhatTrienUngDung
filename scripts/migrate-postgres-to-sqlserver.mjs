// Read-only export from PostgreSQL; import is allowed only into an empty SQL Server target.
// Snapshots contain private project data: keep them in ignored backups/ or tmp/.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'backend/package.json'));
const pg=require('pg'),dotenv=require('dotenv');
// PostgreSQL DATE and timestamp-without-zone are wall-clock values, not JS instants.
pg.types.setTypeParser(1082,value=>value);
pg.types.setTypeParser(1114,value=>value);
const mode=process.argv[2],snapshotPath=path.resolve((process.argv[3]&&!process.argv[3].startsWith('--')?process.argv[3]:null)||path.join(root,'backups/postgres-before-sqlserver.json'));
const quote=s=>'['+s.replaceAll(']',']]')+']';
if(mode==='export') {
 const env=dotenv.parse(await fs.readFile(path.join(root,'tmp/sqlserver-migration/source-postgres.env')));
 const url=env.DATABASE_URL||env.SUPABASE_DB_URL;
 if(!url)throw new Error('Missing source PostgreSQL URL in ignored source config');
 const pool=new pg.Pool({connectionString:url.replace(/[?&]sslmode=[^&]*/g,''),ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000});
 const client=await pool.connect();
 try {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const tables=(await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='app' AND table_type='BASE TABLE' AND table_name<>'_schema_migrations' ORDER BY table_name")).rows;
  const snapshot={format:'lhu-postgres-export-v1',createdAt:new Date().toISOString(),tables:[]};
  for(const {table_name:name} of tables) {
   if(!/^[a-z_][a-z0-9_]*$/.test(name))throw new Error('Unexpected source table');
   const columns=(await client.query("SELECT column_name,data_type,udt_name FROM information_schema.columns WHERE table_schema='app' AND table_name=$1 ORDER BY ordinal_position",[name])).rows;
   const rows=(await client.query(`SELECT * FROM app."${name}"`)).rows;
   snapshot.tables.push({name,columns,rows});console.log(`Export ${name}: ${rows.length}`);
  }
  await client.query('COMMIT');await fs.mkdir(path.dirname(snapshotPath),{recursive:true});await fs.writeFile(snapshotPath,JSON.stringify(snapshot));
  console.log(`Exported ${snapshot.tables.length} tables; source database unchanged.`);
 } catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}
} else if(mode==='import') {
 if(!process.argv.includes('--apply'))throw new Error('Import requires --apply and an empty target');
 const {Pool,getDbPoolConfig}=await import('../backend/src/config/database.js');
 const snapshot=JSON.parse(await fs.readFile(snapshotPath,'utf8'));
 if(snapshot.format!=='lhu-postgres-export-v1')throw new Error('Unsupported snapshot');
 const pool=new Pool(getDbPoolConfig());const c=await pool.connect();
 try {
  await c.query('BEGIN');
  const tables=(await c.query("SELECT t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name='app' AND t.name<>'_schema_migrations'")).rows.map(r=>r.name);
  for(const t of tables)if(Number((await c.query(`SELECT COUNT_BIG(*) n FROM app.${quote(t)}`)).rows[0].n)!==0)throw new Error(`Target table ${t} is not empty; refusing overwrite`);
  const known=new Set(tables);
  for(const t of snapshot.tables)if(!known.has(t.name)&&t.rows.length)throw new Error(`Missing target table: ${t.name}`);
  // Constraint/trigger suspension is scoped to this transaction and rolled back on any failure.
  for(const t of tables){await c.query(`ALTER TABLE app.${quote(t)} NOCHECK CONSTRAINT ALL; DISABLE TRIGGER ALL ON app.${quote(t)};`);}
  const report={createdAt:new Date().toISOString(),sourceFileSha256:crypto.createHash('sha256').update(await fs.readFile(snapshotPath)).digest('hex'),tables:[]};
  for(const t of snapshot.tables.filter(t=>known.has(t.name))) {
   const cols=(await c.query(`SELECT c.name,ty.name type,c.is_identity FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID($1) ORDER BY c.column_id`,['app.'+t.name])).rows;
   const targetCols=new Map(cols.map(c=>[c.name,c]));
   const extra=t.columns.filter(col=>!targetCols.has(col.column_name));
   if(extra.length&&t.rows.length)throw new Error(`Unmapped columns ${t.name}: ${extra.map(c=>c.column_name).join(',')}`);
   const names=t.columns.map(c=>c.column_name).filter(n=>targetCols.has(n));
   const identity=cols.some(c=>c.is_identity&&names.includes(c.name));
   // IDENTITY_INSERT is session scoped: include ON, INSERT, OFF in one request on the transaction connection.
   for(const row of t.rows) {
    const values=names.map(n=>{const v=row[n],type=targetCols.get(n).type;if(v===null||v===undefined)return null;if(type==='nvarchar'&&(Array.isArray(v)||typeof v==='object'&&!(v instanceof Date)))return JSON.stringify(v);return v;});
    const prefix=identity?`SET IDENTITY_INSERT app.${quote(t.name)} ON;`:'';
    const suffix=identity?`SET IDENTITY_INSERT app.${quote(t.name)} OFF;`:'';
    await c.query(`${prefix} INSERT INTO app.${quote(t.name)}(${names.map(quote).join(',')}) VALUES(${values.map((_,i)=>'$'+(i+1)).join(',')}); ${suffix}`,values);
   }
   const count=Number((await c.query(`SELECT COUNT_BIG(*) n FROM app.${quote(t.name)}`)).rows[0].n);
   if(count!==t.rows.length)throw new Error(`Count mismatch: ${t.name}`);
   report.tables.push({name:t.name,sourceRows:t.rows.length,targetRows:count});console.log(`Import ${t.name}: ${count}`);
  }
  for(const t of tables)await c.query(`ALTER TABLE app.${quote(t)} WITH CHECK CHECK CONSTRAINT ALL; ENABLE TRIGGER ALL ON app.${quote(t)};`);
  // Triggers are disabled during load; explicitly verify their cross-row invariants before commit.
  await c.query(`IF EXISTS(SELECT 1 FROM app.lecturer_assignments a JOIN app.lecturer_assignments b ON a.lecturer_id=b.lecturer_id AND a.assignment_id<b.assignment_id AND a.is_primary=1 AND b.is_primary=1 AND a.valid_from<COALESCE(b.valid_to,CONVERT(datetime2,'9999-12-31')) AND b.valid_from<COALESCE(a.valid_to,CONVERT(datetime2,'9999-12-31'))) THROW 51001,'Overlapping lecturer assignments in source',1;`);
  await c.query('COMMIT');await fs.writeFile(path.join(root,'tmp/sqlserver-migration/data-verification.json'),JSON.stringify(report,null,2));
  console.log('Import committed with validated foreign keys/check constraints.');
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{await c.release();await pool.end();}
} else throw new Error('Usage: node scripts/migrate-postgres-to-sqlserver.mjs export|import [snapshot.json] [--apply]');
