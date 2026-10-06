import test from "node:test";
import assert from "node:assert/strict";
import {
  goalSchema,
  resultSchema,
  readCsv,
  csvColumns,
  parse,
} from "../src/modules/kpi/kpiSchemas.js";
const goal = {
  code: "paper",
  title: "KPI mô phỏng",
  measureUnit: "bài",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  target: 2,
  sourceNote: "MO PHONG",
};
test("Strict validation: no forged status/source/owner, finite amounts and real dates", () => {
  assert.equal(parse(goalSchema, goal).code, "PAPER");
  for (const patch of [
    { status: "VERIFIED" },
    { source: "EXTERNAL" },
    { lecturerId: 2 },
    { target: "" },
    { target: -1 },
    { target: "Infinity" },
    { periodStart: "2026-02-30" },
    { periodStart: "1989-01-01" },
    { periodEnd: "2101-01-01" },
    { periodEnd: "2025-12-31" },
  ])
    assert.throws(() => parse(goalSchema, { ...goal, ...patch }));
  assert.throws(() =>
    parse(resultSchema, { actual: 1, sourceNote: "x", evidenceNote: "" }),
  );
});
test("CSV handles BOM, quotes, multiline, bad header/width and bounded input", () => {
  const header = csvColumns.join(",");
  const entries = readCsv(
    "\uFEFF" +
      header +
      '\r\nPAPER,"KPI, ""MO PHONG""",bai,2026-01-01,2026-12-31,2,"dong 1\r\ndong 2",MO PHONG,,\r\n',
  );
  assert.equal(entries[0].goal.title, 'KPI, "MO PHONG"');
  assert.equal(entries[0].goal.plan, "dong 1\ndong 2");
  assert.throws(() => readCsv("code,title\nx,y"));
  assert.throws(() => readCsv(header + '\n"missing'));
  assert.throws(() => readCsv(header + '\n"closed"x'));
  assert.equal(readCsv(header + "\na,b")[0].error, "Sai số cột");
  assert.throws(() =>
    readCsv(header + "\n" + Array(501).fill("a,b").join("\n")),
  );
});
