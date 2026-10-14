import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from '../../frontend/node_modules/exceljs/excel.js';
import { readKpiFile } from '../../frontend/src/services/kpiImport.js';
import { goalSourceText } from '../../frontend/src/services/kpiPresentation.js';
import { csvColumns, readCsv } from '../src/modules/kpi/kpiSchemas.js';
import { ApplicationService } from '../src/modules/awards/applicationService.js';

test('Excel goals preserve Vietnamese, quotes, newlines, dates and empty result columns through the backend parser', async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet('Empty');
  const sheet = book.addWorksheet('Goals');
  sheet.addRow(csvColumns);
  sheet.addRow(['PAPER-1', 'Bài báo "AI", tiếng Việt', 'bài', new Date('2026-01-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z'), 3, 'Kế hoạch\nNăm 2026', 'Quy định trường', null, null]);
  const data = await book.xlsx.writeBuffer();
  const csv = await readKpiFile({ name: 'goals.xlsx', size: data.length, arrayBuffer: async () => data });
  const rows = readCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].goal.title, 'Bài báo "AI", tiếng Việt');
  assert.equal(rows[0].goal.periodStart, '2026-01-01');
  assert.equal(rows[0].goal.plan, 'Kế hoạch\nNăm 2026');
});

test('import rejects unsupported files and oversized input before reading', async () => {
  await assert.rejects(readKpiFile({name:'old.xls',size:10}), /XLSX/);
  await assert.rejects(readKpiFile({name:'big.xlsx',size:6*1024*1024}), /5 MB/);
  const csv = csvColumns.join(',') + '\nPAPER-1,Bài báo,bài,2026-01-01,2026-12-31,3,Kế hoạch,Quy định,,\n';
  assert.equal(await readKpiFile({name:'goals.csv',size:csv.length,text:async()=>csv}), csv);
});

test('AI provenance is readable while manual notes remain intact', () => {
  const note = 'AI W4-P1; run internal-id; tiêu chí PAPER; [{"chunkHash":"hash","clauseReference":"Điều 5"}]; diagnostic';
  assert.equal(goalSourceText(note), 'Đề xuất từ phân tích AI · Tiêu chí PAPER · Điều 5');
  assert.equal(goalSourceText('Căn cứ kế hoạch 2026'), 'Căn cứ kế hoạch 2026');
});

test('application reads reuse roles only within one request and still reject revoked access', async () => {
  let calls = 0;
  let active = true;
  const pool = { query: async sql => ({ rows: sql.includes('WHERE created_by') ? [{application_id:1,lecturer_id:10,created_by:1},{application_id:2,lecturer_id:10,created_by:1}] : sql.includes('SELECT 1 FROM app.lecturers') ? [{}] : [] }) };
  const service = new ApplicationService({pool:()=>pool,roles:async()=>{calls++;return active ? ['LECTURER']:[];},scope:async()=>false});
  const user = { userId: 1 };
  assert.equal((await service.list({},user)).items.length,2);
  assert.equal(calls,1);
  active = false;
  assert.equal((await service.list({},user)).items.length,0);
  assert.equal(calls,2);
});
