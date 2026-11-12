import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const schema=fs.readFileSync(path.join(here,'migrations/001_final_schema.sql'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(here,'schema-manifest.json'),'utf8'));
const identities=new Map([...schema.matchAll(/CREATE TABLE app\.(\w+)\s*\(\s*(\w+) BIGINT IDENTITY/g)].map(m=>[m[1],m[2]]));
const source=fs.readFileSync(path.resolve(here,'../../supabase/seed.sql'),'utf8').replace(/--[^\r\n]*/g,'');
let output=`-- Synthetic development data translated from the archived base seed.\n-- Runner requires --apply; no DELETE/TRUNCATE and no PostgreSQL access.\nSET XACT_ABORT ON;\n`;
for(const table of Object.keys(manifest.tables)) output+=`IF EXISTS(SELECT 1 FROM app.${table} WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;\n`;
let start=0, quote=false; const statements=[];
for(let i=0;i<source.length;i++){
  if(source[i]==="'"){if(quote&&source[i+1]==="'"){i++;continue;}quote=!quote;}
  if(source[i]===';'&&!quote){statements.push(source.slice(start,i).trim());start=i+1;}
}
for(let sql of statements){
  if(!/^INSERT INTO app\./i.test(sql)) continue;
  const m=sql.match(/^INSERT INTO app\.(\w+)\s*\(([^)]+)\)/i);
  const identity=identities.get(m[1]), explicit=m[2].split(',').map(s=>s.trim()).includes(identity);
  sql=sql.replace(/OVERRIDING SYSTEM VALUE\s*/gi,'')
    .replace(/NOW\(\)\s*-\s*INTERVAL '(\d+) (year|day)s?'/gi,(_,n,u)=>`DATEADD(${u},-${n},SYSUTCDATETIME())`)
    .replace(/CURRENT_DATE\s*([+-])\s*INTERVAL '(\d+) days?'/gi,(_,sign,n)=>`DATEADD(day,${sign==='-'?'-':''}${n},CAST(SYSUTCDATETIME() AS DATE))`)
    .replace(/TIMESTAMPTZ '([^']+)'/gi,(_,v)=>`CAST('${v.replace(/\+00$/,'')}' AS DATETIME2(3))`)
    .replace(/\bDATE '([^']+)'/gi,"CAST('$1' AS DATE)")
    .replace(/\bNOW\(\)/gi,'SYSUTCDATETIME()').replace(/\bTRUE\b/g,'1').replace(/\bFALSE\b/g,'0')
    .replace(/(?<![\w'])'((?:[^']|'')*)'/g,"N'$1'");
  if(explicit) output+=`SET IDENTITY_INSERT app.${m[1]} ON;\n`;
  output+=sql+';\n';
  if(explicit) output+=`SET IDENTITY_INSERT app.${m[1]} OFF;\n`;
}
// The archived base seed has no council user; provide a sixth-role synthetic account.
output+=`SET IDENTITY_INSERT app.users ON;
INSERT app.users(user_id,username,email,password_hash,display_name,status)
VALUES(6,N'council.demo',N'council.demo@example.invalid',N'$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK',N'Hội đồng DEMO',N'ACTIVE');
SET IDENTITY_INSERT app.users OFF;
INSERT app.user_roles(user_id,role_id,valid_from) VALUES(6,4,DATEADD(day,-1,SYSUTCDATETIME()));
INSERT app.user_unit_scopes(user_id,role_id,unit_id,include_descendants,valid_from)
VALUES(6,4,1,1,DATEADD(day,-1,SYSUTCDATETIME()));
`;
// Preserve the archived base seed's next generated key >=10 without moving past live data.
for(const table of identities.keys()) output+=`IF (SELECT MAX(${identities.get(table)}) FROM app.${table}) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.${table}',RESEED,9) WITH NO_INFOMSGS;\n`;
fs.writeFileSync(path.join(here,'seed.sql'),output);
console.log('Generated guarded SQL Server seed. No existing row is removed.');
