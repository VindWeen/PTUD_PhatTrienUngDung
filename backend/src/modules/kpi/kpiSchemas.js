import { z } from "zod";
import { ValidationError } from "../../utils/errors.js";
export const id = z.coerce.number().int().positive().safe();
export const listSchema = z
  .object({
    subjectType: z.enum(["LECTURER", "UNIT"]).default("LECTURER"),
    organizationUnitId: id.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.subjectType === "UNIT"
        ? Boolean(v.organizationUnitId)
        : v.organizationUnitId === undefined,
    "Đơn vị chỉ dành cho UNIT",
  );
const text = (max) => z.string().trim().min(1).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return (
      !Number.isNaN(d.valueOf()) &&
      d.toISOString().slice(0, 10) === v &&
      d.getUTCFullYear() >= 1990 &&
      d.getUTCFullYear() <= 2100
    );
  }, "Ngày không tồn tại hoặc ngoài khoảng 1990–2100");
const amount = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d+)?$/),
  ])
  .pipe(z.coerce.number().finite().min(0).max(1e12));
export const goalFields = z
  .object({
    code: text(80).transform((v) => v.toUpperCase()),
    title: text(255).refine((v) => v.length >= 5),
    measureUnit: text(80),
    periodStart: date,
    periodEnd: date,
    target: amount,
    plan: z.string().trim().max(4000).default(""),
    sourceNote: text(2000),
  })
  .strict();
const ordered = (v) => v.periodEnd >= v.periodStart;
export const goalSchema = goalFields
  .extend({
    subjectType: z.enum(["LECTURER", "UNIT"]).default("LECTURER"),
    organizationUnitId: id.optional(),
  })
  .strict()
  .refine(ordered, "Kỳ kết thúc phải sau kỳ bắt đầu")
  .refine(
    (v) =>
      v.subjectType === "UNIT"
        ? Boolean(v.organizationUnitId)
        : v.organizationUnitId === undefined,
    "Đơn vị chỉ được nhập cho UNIT",
  );
export const goalUpdateSchema = goalFields
  .extend({ version: id })
  .strict()
  .refine(ordered, "Kỳ không hợp lệ");
export const resultSchema = z
  .object({ actual: amount, sourceNote: text(2000), evidenceNote: text(4000) })
  .strict();
export const resultUpdateSchema = resultSchema.extend({ version: id }).strict();
export const versionSchema = z.object({ version: id }).strict();
export const draftSchema = versionSchema
  .extend({ achievementTypeId: id })
  .strict();
export const importSchema = z
  .object({ csv: z.string().min(1).max(500000) })
  .strict();
export function parse(schema, raw) {
  const out = schema.safeParse(raw);
  if (!out.success)
    throw new ValidationError("Dữ liệu KPI không hợp lệ", out.error.flatten());
  return out.data;
}
export const csvColumns = [
  "code",
  "title",
  "measureUnit",
  "periodStart",
  "periodEnd",
  "target",
  "plan",
  "sourceNote",
  "actual",
  "evidenceNote",
];
export const csvTemplate =
  csvColumns.join(",") +
  "\r\nDEMO-PAPER,KPI MO PHONG - khong phai tieu chi, bai,2026-01-01,2026-12-31,2,Ke hoach do nguoi dung nhap,DU LIEU MO PHONG,,\r\n";
// RFC4180 reader: quoted commas/newlines/doubled quotes, strict header and row width.
export function readCsv(input) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  const csv = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const push = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === ",") push();
    else if (c === "\n") {
      push();
      rows.push(row);
      row = [];
    } else {
      if (closed || c === '"' || c === "\r")
        throw new ValidationError("CSV sai cú pháp");
      cell += c;
    }
  }
  if (quoted) throw new ValidationError("CSV thiếu dấu đóng quote");
  if (cell || row.length || closed) {
    push();
    rows.push(row);
  }
  if (JSON.stringify(rows.shift()) !== JSON.stringify(csvColumns))
    throw new ValidationError("CSV sai header; tải template");
  if (!rows.length || rows.length > 500)
    throw new ValidationError("CSV phải có 1–500 dòng");
  return rows.map((cells, index) => {
    if (cells.length !== csvColumns.length)
      return { row: index + 2, error: "Sai số cột" };
    const values = Object.fromEntries(
      csvColumns.map((key, i) => [key, cells[i]]),
    );
    const { actual, evidenceNote, ...goal } = values;
    try {
      return {
        row: index + 2,
        goal: parse(goalSchema, goal),
        result:
          actual === ""
            ? null
            : parse(resultSchema, {
                actual,
                evidenceNote,
                sourceNote: goal.sourceNote,
              }),
      };
    } catch (e) {
      return { row: index + 2, error: e.details || e.message };
    }
  });
}
