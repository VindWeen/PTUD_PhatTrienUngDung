// Offline, deterministic baseline compiler. The emitted SQL is committed and executed,
// never the archived PostgreSQL files. Re-run only when intentionally reconciling schema.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const archive = path.resolve(here, '../../supabase/migrations');
export function splitTop(text, separator = ',') {
  const parts = []; let start = 0, depth = 0, quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") { if (quoted && text[i + 1] === "'") { i++; continue; } quoted = !quoted; }
    if (quoted) continue;
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    if (text[i] === separator && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1; }
  }
  if (text.slice(start).trim()) parts.push(text.slice(start).trim());
  return parts;
}
// A separate balanced scanner avoids touching embedded CHECK expressions.
function getBody(text, start) {
  let depth = 1, quote = false;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "'") { if (quote && text[i + 1] === "'") { i++; continue; } quote = !quote; continue; }
    if (quote) continue;
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return text.slice(start, i);
  }
  throw new Error('Unclosed table definition');
}
const files = fs.readdirSync(archive).filter(x => x.endsWith('.sql')).sort();
const tables = new Map(); const indexMap = new Map();
for (const file of files) {
  const sql = fs.readFileSync(path.join(archive, file), 'utf8').replace(/--[^\r\n]*/g, '');
  for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?app\.(\w+)\s*\(/g)) {
    if (tables.has(match[1])) {
      for (const [key, value] of indexMap) if (value.table === match[1]) indexMap.delete(key);
    }
    const body = getBody(sql, match.index + match[0].length);
    const columns = new Map(), constraints = [];
    for (const item of splitTop(body)) {
      if (/^(?:CONSTRAINT|CHECK|UNIQUE|PRIMARY|FOREIGN)\b/i.test(item)) constraints.push(item);
      else columns.set(item.match(/^\w+/)[0], item.replace(/\s+/g, ' '));
    }
    tables.set(match[1], { columns, constraints });
  }
  for (const match of sql.matchAll(/ALTER TABLE app\.(\w+)\s+([\s\S]*?);/g)) {
    const table = tables.get(match[1]); if (!table) throw new Error(`Unknown ${match[1]}`);
    for (let part of splitTop(match[2])) {
      part = part.trim(); let m;
      if ((m = part.match(/^ADD COLUMN (?:IF NOT EXISTS )?(\w+)\s+([\s\S]+)/i))) table.columns.set(m[1], `${m[1]} ${m[2].replace(/\s+/g, ' ')}`);
      else if ((m = part.match(/^ALTER COLUMN (\w+) (DROP NOT NULL|SET NOT NULL|SET DEFAULT ([\s\S]+))/i))) {
        let col = table.columns.get(m[1]); if (!col) throw new Error(`Unknown column ${match[1]}.${m[1]}`);
        if (m[2] === 'DROP NOT NULL') col = col.replace(/\bNOT NULL\b/i, 'NULL');
        if (m[2] === 'SET NOT NULL') col = col.replace(/\bNULL\b/i, 'NOT NULL');
        if (m[3]) col = col.replace(/DEFAULT\s+(?:'[^']*'|[\w.]+(?:\([^)]*\))?)/i, `DEFAULT ${m[3]}`);
        table.columns.set(m[1], col);
      } else if ((m = part.match(/^DROP CONSTRAINT (?:IF EXISTS )?(\w+)/i))) {
        table.constraints = table.constraints.filter(x => !new RegExp(`^CONSTRAINT ${m[1]}\\b`, 'i').test(x));
      } else if (/^ADD (?:CONSTRAINT|CHECK|FOREIGN|PRIMARY)/i.test(part) && !/EXCLUDE USING/i.test(part)) table.constraints.push(part.replace(/^ADD /i, ''));
    }
  }
  for (const m of sql.matchAll(/DROP INDEX (?:IF EXISTS )?(?:app\.)?(\w+)/g)) indexMap.delete(m[1]);
  for (const m of sql.matchAll(/CREATE (UNIQUE )?INDEX (?:IF NOT EXISTS )?(\w+)\s+ON app\.(\w+)\s*\(([\s\S]*?)\)\s*([^;]*);/g)) indexMap.set(m[2], { unique: !!m[1], table: m[3], columns: m[4], tail: m[5] });
}
// ALTER inside migration 16's DO block has been captured above. Canonical final PK.
tables.get('award_application_inputs').columns.set('application_id', 'application_id BIGINT NOT NULL REFERENCES app.award_applications(application_id)');
tables.get('award_application_inputs').constraints = [
  'PRIMARY KEY(application_id,input_version)', 'CHECK(input_version > 0)'
];
tables.get('award_application_inputs').columns.set('input_version', 'input_version INT NOT NULL');
// PostgreSQL-generated unnamed CHECK was dropped by migration 24.
tables.get('notifications').columns.set('entity_type', "entity_type VARCHAR(20) NOT NULL CHECK(entity_type IN ('AWARD','ACHIEVEMENT','APPLICATION'))");
tables.get('personal_calendar_events').columns.set('ends_at', 'ends_at TIMESTAMP WITHOUT TIME ZONE NOT NULL');
tables.get('personal_calendar_events').constraints.push('CHECK(ends_at >= starts_at)');
const nullableUnique = new Map([
  ['kpi_results.achievement_id', 'uq_kpi_results_achievement'],
  ['kpi_recommendations.goal_id', 'uq_kpi_recommendations_goal'],
  ['external_kpi_records.achievement_id', 'uq_external_kpi_records_achievement'],
]);
function expression(s) {
  return s.replace(/\blength\(trim\((\w+)\)\)/gi, 'LEN(LTRIM(RTRIM($1)))')
    .replace(/\blength\((\w+)\)/gi, 'LEN($1)')
    .replace(/\bDATE\s+'([^']*)'/gi, "'$1'")
    .replace(/\bTRUE\b/g, '1').replace(/\bFALSE\b/g, '0')
    .replace(/\bNOW\(\)/gi, 'SYSUTCDATETIME()').replace(/gen_random_uuid\(\)/gi, 'NEWID()')
    .replace(/::jsonb\b/gi, '')
    .replace(/\(\(lecturer_id IS NULL\) <> \(unit_id IS NULL\)\)/gi, '((lecturer_id IS NULL AND unit_id IS NOT NULL) OR (lecturer_id IS NOT NULL AND unit_id IS NULL))')
    .replace(/\(\(status='ACCEPTED'\) = \(goal_id IS NOT NULL\)\)/gi, "((status='ACCEPTED' AND goal_id IS NOT NULL) OR (status<>'ACCEPTED' AND goal_id IS NULL))")
    .replace(/\(\(application_id IS NULL\) = \(application_input_version IS NULL\)\)/gi, '((application_id IS NULL AND application_input_version IS NULL) OR (application_id IS NOT NULL AND application_input_version IS NOT NULL))');
}
const fks = [], jsonColumns = [], arrays = [], deleteDifferences = [];
let output = '-- SQL Server 2017+ / compatibility level 140+. Final state of archived PostgreSQL migrations 01-31.\n';
output += '-- UTC DATETIME2(3), except calendar starts_at/ends_at: Vietnam local wall clock.\n';
output += '-- All FK deletes are NO ACTION: archival/history is never silently cascaded or unlinked.\n';
output += "SET XACT_ABORT ON;\nSET ANSI_NULLS ON;\nSET ANSI_PADDING ON;\nSET ANSI_WARNINGS ON;\nSET ARITHABORT ON;\nSET CONCAT_NULL_YIELDS_NULL ON;\nSET QUOTED_IDENTIFIER ON;\nSET NUMERIC_ROUNDABORT OFF;\nIF SCHEMA_ID(N'app') IS NULL EXEC(N'CREATE SCHEMA app');\n\n";
for (const [name, table] of tables) {
  if (name === '_schema_migrations') continue; // Runner owns its tracking table.
  const defs = [], extras = [];
  for (const [column, original] of table.columns) {
    let col = original;
    const json = /\bJSONB\b|\b(?:BIGINT|REAL)\[\]/i.test(col);
    const array = /\b(?:BIGINT|REAL)\[\]/i.test(col);
    if (array) { arrays.push(`${name}.${column}`); col = col.replace(/DEFAULT '\{\}'/g, "DEFAULT '[]'"); }
    if (json) { jsonColumns.push(`${name}.${column}`); extras.push(`CONSTRAINT ck_${name}_${column}_json CHECK (${column} IS NULL OR ISJSON(${column}) = 1)`); }
    const reference = col.match(/REFERENCES app\.(\w+)\((\w+)\)(?: ON DELETE (CASCADE|RESTRICT|SET NULL))?/i);
    if (reference) {
      fks.push(`ALTER TABLE app.${name} ADD CONSTRAINT fk_${name}_${column} FOREIGN KEY(${column}) REFERENCES app.${reference[1]}(${reference[2]});`);
      if (reference[3] && reference[3] !== 'RESTRICT') deleteDifferences.push({ table: name, column, previous: reference[3], sqlServer: 'NO ACTION' });
      col = col.replace(reference[0], '');
    }
    if (nullableUnique.has(`${name}.${column}`)) {
      col = col.replace(/\bUNIQUE\b/, '');
      const key = nullableUnique.get(`${name}.${column}`);
      indexMap.set(key, { unique: true, table: name, columns: column, tail: `WHERE ${column} IS NOT NULL` });
    }
    col = col.replace(/::jsonb\b/gi, '').replace(/GENERATED (?:BY DEFAULT|ALWAYS) AS IDENTITY/gi, 'IDENTITY(1,1)')
      .replace(/TIMESTAMP WITHOUT TIME ZONE/gi, 'DATETIME2(3)')
      .replace(/\bTIMESTAMPTZ\b/gi, 'DATETIME2(3)')
      .replace(/\bBOOLEAN\b/gi, 'BIT').replace(/\bUUID\b/gi, 'UNIQUEIDENTIFIER')
      .replace(/\b(?:JSONB|TEXT)\b|\b(?:BIGINT|REAL)\[\]/gi, 'NVARCHAR(MAX)')
      .replace(/\bVARCHAR\((\d+)\)/gi, 'NVARCHAR($1) COLLATE Latin1_General_100_BIN2')
      .replace(/\bCHAR\((\d+)\)/gi, 'NCHAR($1) COLLATE Latin1_General_100_BIN2')
      .replace(/\bINTEGER\b/gi, 'INT').replace(/\bNUMERIC\b(?!\s*\()/gi, 'DECIMAL(28,8)');
    col = expression(col);
    // SQL Server defaults do not inherit PostgreSQL's Unicode literal semantics.
    col = col.replace(/(?<![\w'])'((?:[^']|'')*)'/g, "N'$1'");
    defs.push(col.trim().replace(/^plan\b/, '[plan]'));
  }
  for (let c of table.constraints) {
    if (/EXCLUDE USING/i.test(c)) continue; // Equivalent multi-row triggers in migration 2.
    if (/FOREIGN KEY/i.test(c)) { fks.push(`ALTER TABLE app.${name} ADD ${expression(c).replace(/ ON DELETE (?:RESTRICT|CASCADE|SET NULL)/gi, '')};`); continue; }
    defs.push(expression(c).replace(/\s+/g, ' '));
  }
  defs.push(...extras);
  // Fail closed rather than hiding an incomplete schema behind IF NOT EXISTS.
  output += `CREATE TABLE app.${name} (\n  ${defs.join(',\n  ')}\n);\n\n`;
}
const seenFks = new Set();
const distinctFks = fks.filter(sql => {
  const key = sql.replace(/ADD CONSTRAINT\s+\w+\s+/, 'ADD ').replace(/\s+/g, '').toLowerCase();
  if (seenFks.has(key)) return false;
  seenFks.add(key); return true;
});
output += distinctFks.join('\n') + '\n\n';
for (const [name, index] of indexMap) {
  if (index.table === '_schema_migrations' || !tables.has(index.table)) continue;
  let { columns, tail } = index;
  // Match UPPER(code)'s nested close separately from the CREATE INDEX scanner.
  if (/UPPER\(code/i.test(columns)) {
    output += `ALTER TABLE app.${index.table} ADD code_normalized AS UPPER(code) PERSISTED;\n`;
    columns = 'code_normalized'; tail = '';
  }
  output += `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${name} ON app.${index.table}(${columns}) ${expression(tail)};\n`;
}
fs.mkdirSync(path.join(here, 'migrations'), { recursive: true });
fs.writeFileSync(path.join(here, 'migrations/001_final_schema.sql'), output);
const manifest = {
  sourceFiles: files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(archive, file))).digest('hex') })),
  tables: Object.fromEntries([...tables].filter(([name]) => name !== '_schema_migrations').map(([name, t]) => [name, [...t.columns.keys()]])),
  jsonColumns, arrayColumns: arrays, foreignKeyDeleteDifferences: deleteDifferences,
};
fs.writeFileSync(path.join(here, 'schema-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Generated ${Object.keys(manifest.tables).length} tables, ${fks.length} foreign keys; ${jsonColumns.length} JSON columns.`);
