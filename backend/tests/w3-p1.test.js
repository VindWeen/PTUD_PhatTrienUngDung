import test from 'node:test';
import assert from 'node:assert/strict';
import { reportSchema, reportQuery, csvCell, toCsv } from '../src/modules/reports/reportService.js';

test('W3-P1 validates filters, pagination and ambiguous type/year combinations', () => {
  assert.equal(reportSchema.parse({}).pageSize, 20);
  for (const input of [{ page: 0 }, { pageSize: 101 }, { recognitionYear: '2026 OR 1=1' }, { status: 'APPROVED' }, { typeId: 1 }, { kind: 'AWARD', academicYearId: 1 }, { userId: 3 }]) {
    assert.equal(reportSchema.safeParse(input).success, false);
  }
  assert.equal(reportSchema.safeParse({ kind: 'ACHIEVEMENT', typeId: '1', academicYearId: '3', page: '2' }).success, true);
});

test('W3-P1 parameterizes search and filters and escapes literal LIKE metacharacters', () => {
  const { sql, params } = reportQuery({ search: "' OR TRUE --%_", contextUnitId: 2 }, 1);
  assert.ok(!sql.includes("' OR TRUE"));
  assert.deepEqual(params, [1, 2, "%' OR TRUE --\\%\\_%"]);
});

test('W3-P1 CSV quotes cells, preserves Vietnamese, neutralizes formulas and controls', () => {
  for (const input of ['=1+1', '+cmd', '-1', '@SUM(1)', '  =1', '\t=1', '\r+1', '\n@1', '\u0000=1']) assert.ok(csvCell(input).startsWith('"\''));
  assert.equal(csvCell('Võ Nhạc Phước, "CSV"\nDòng 2'), '"Võ Nhạc Phước, ""CSV""\nDòng 2"');
  assert.equal(csvCell(null), '""');
  assert.ok(toCsv([]).startsWith('\uFEFF"kind"'));
});
