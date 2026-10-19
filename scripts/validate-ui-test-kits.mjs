/** Validate prepared INPUT FILES; no database, HTTP request or application test. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readKpiFile } from '../frontend/src/services/kpiImport.js';
import { readCsv } from '../backend/src/modules/kpi/kpiSchemas.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const all = [];
for (const tester of [1,2]) {
  const dir = path.join(root,`output/ui-test-kits/tester-${tester}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir,'MANIFEST.json'),'utf8'));
  assert.equal(manifest.cases.length,tester===1?72:73);
  all.push(...manifest.cases);
  for (const file of manifest.files) {
    const full = path.join(dir,file.path);
    const bytes = fs.readFileSync(full);
    assert.equal(bytes.length,file.bytes,file.path);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
    if (file.path.endsWith('.md')) {
      for (const match of bytes.toString('utf8').matchAll(/\]\(([^)]+)\)/g)) {
        const href = match[1];
        if (/^(https?:|#)/.test(href)) continue;
        assert.ok(fs.existsSync(path.resolve(path.dirname(full),href.split('#')[0])),`${file.path}: ${href}`);
      }
    }
  }
  assert.equal(fs.statSync(path.join(dir,'uploads/invalid/empty.pdf')).size,0);
  assert.equal(fs.statSync(path.join(dir,'uploads/invalid/over-10mb.pdf')).size,10*1024*1024+1);
  assert.notDeepEqual(fs.readFileSync(path.join(dir,'uploads/valid/evidence-v1.pdf')),fs.readFileSync(path.join(dir,'uploads/valid/evidence-v2.pdf')));
  console.log(`T${tester}: case mappings, local links, ${manifest.files.length} file hashes and upload boundaries verified.`);
}
assert.equal(new Set(all).size,145,'Overlapping cases');
const original = fs.readFileSync(path.join(root,'docs/testing/UI_TEST_PLAN.md'),'utf8');
const master = [...original.matchAll(/^\| ([A-Z]+-\d+) \|/gm)].map(m=>m[1]);
assert.deepEqual([...all].sort(),master.sort(),'Case coverage differs from master');

const kpi = path.join(root,'output/ui-test-kits/tester-2/kpi');
const load = async name => readKpiFile(new File([fs.readFileSync(path.join(kpi,name))],name));
const codes = [];
for (const ext of ['csv','tsv','xlsx']) {
  const rows = readCsv(await load(`import-valid.${ext}`));
  assert.equal(rows.length,3);
  assert.ok(rows.every(row=>!row.error),JSON.stringify(rows));
  assert.equal(rows[2].result.actual,1);
  codes.push(...rows.map(row=>row.goal.code));
}
assert.equal(new Set(codes).size,9,'Valid input variants share KPI codes');
for (const ext of ['csv','xlsx']) {
  const rows = readCsv(await load(`import-invalid.${ext}`));
  assert.equal(rows.length,2);
  assert.ok(rows.every(row=>row.error),'Both invalid rows must fail validation');
}
assert.throws(()=>readCsv(fs.readFileSync(path.join(kpi,'import-missing-column.csv'),'utf8')));
const dup = readCsv(await load('import-duplicate-code.csv'));
assert.equal(dup[0].goal.code,dup[1].goal.code);
await assert.rejects(()=>load('import-corrupt.xlsx'));
await assert.rejects(()=>load('import-over-5mb.csv'),/5 MB/);
console.log('KPI input fixtures: CSV/TSV/XLSX accepted; invalid rows, missing header, corruption, duplicates and size cases verified.');
console.log('Prepared-file validation passed. No UI test executed or database modified.');
