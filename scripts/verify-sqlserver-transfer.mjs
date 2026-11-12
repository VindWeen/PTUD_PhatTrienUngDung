import fs from 'node:fs/promises';
import {Pool,getDbPoolConfig} from '../backend/src/config/database.js';
const file=process.argv[2]||'backups/postgres-before-sqlserver-corrected.json';
const snapshot=JSON.parse(await fs.readFile(file,'utf8'));
const pool=new Pool(getDbPoolConfig());const c=await pool.connect();
const quote=s=>'['+s.replaceAll(']',']]')+']';
function canonical(value,meta) {
 if(value===null||value===undefined)return null;
 if(meta.data_type==='date')return value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
 if(meta.data_type==='uuid')return String(value).toLowerCase();
 if(meta.data_type.includes('timestamp'))return new Date(value).toISOString();
 if(['bigint','integer','smallint','numeric','real','double precision'].includes(meta.data_type))return String(Number(value));
 if(['jsonb','json','ARRAY'].includes(meta.data_type)) {
  if(typeof value==='string')try{value=JSON.parse(value);}catch{}
  return stable(value);
 }
 return value;
}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
try {
 await c.query('BEGIN');
 const report={createdAt:new Date().toISOString(),source:file,tables:[],mismatches:[],dateRowsCorrected:0};
 for(const t of snapshot.tables) {
  const pk=(await c.query(`SELECT col.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns col ON col.object_id=ic.object_id AND col.column_id=ic.column_id WHERE i.is_primary_key=1 AND i.object_id=OBJECT_ID($1) ORDER BY ic.key_ordinal`,['app.'+t.name])).rows.map(r=>r.name);
  if(!pk.length)throw new Error(`Missing PK ${t.name}`);
  if(process.argv.includes('--repair-dates')) {
   const dates=t.columns.filter(col=>col.data_type==='date').map(col=>col.column_name);
   for(const r of t.rows)if(dates.length) {
    const params=[...dates.map(n=>r[n]),...pk.map(n=>r[n])];
    await c.query(`UPDATE app.${quote(t.name)} SET ${dates.map((n,i)=>`${quote(n)}=$${i+1}`).join(',')} WHERE ${pk.map((n,i)=>`${quote(n)}=$${dates.length+i+1}`).join(' AND ')}`,params);report.dateRowsCorrected++;
   }
  }
  const rows=(await c.query(`SELECT * FROM app.${quote(t.name)}`)).rows;
  const key=r=>pk.map(n=>String(r[n]).toLowerCase()).join('|');const target=new Map(rows.map(r=>[key(r),r]));
  if(rows.length!==t.rows.length)report.mismatches.push({table:t.name,kind:'row-count',source:t.rows.length,target:rows.length});
  for(const r of t.rows) {
   const current=target.get(key(r));if(!current){report.mismatches.push({table:t.name,key:key(r),kind:'missing-row'});continue;}
   for(const col of t.columns)if(JSON.stringify(canonical(r[col.column_name],col))!==JSON.stringify(canonical(current[col.column_name],col)))report.mismatches.push({table:t.name,key:key(r),column:col.column_name,kind:'value'});
  }
  report.tables.push({name:t.name,sourceRows:t.rows.length,targetRows:rows.length});
 }
 const integrity=(await c.query(`SELECT (SELECT COUNT(*) FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1) bad_fks,(SELECT COUNT(*) FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1) bad_checks,(SELECT COUNT(*) FROM sys.triggers WHERE parent_class=1 AND is_disabled=1) disabled_triggers`)).rows[0];
 report.integrity=integrity;
 if(report.mismatches.length||Object.values(integrity).some(Number)){await c.query('ROLLBACK');report.status='FAIL';}
 else {await c.query('COMMIT');report.status='PASS';}
 await fs.writeFile('tmp/sqlserver-migration/full-data-verification.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,tables:report.tables.length,mismatches:report.mismatches.slice(0,15)},null,2));
 if(report.status!=='PASS')process.exitCode=1;
} catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{await c.release();await pool.end();}
