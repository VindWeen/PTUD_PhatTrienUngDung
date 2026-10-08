import { withTransaction } from "../../utils/dbHelper.js";
import { recordAuditLog } from "../audit/auditService.js";
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../utils/errors.js";
import * as repo from "./kpiRepository.js";
import {
  parse,
  id,
  listSchema,
  goalSchema,
  goalUpdateSchema,
  resultSchema,
  resultUpdateSchema,
  versionSchema,
  draftSchema,
  importSchema,
  readCsv,
} from "./kpiSchemas.js";

const same = (a, b) => String(a) === String(b);
async function authorized(client, user, goal) {
  const s = await repo.subject(
    client,
    user.userId,
    goal.lecturer_id ? "LECTURER" : "UNIT",
    goal.unit_id,
  );
  if (!s || (goal.lecturer_id && !same(s.lecturer_id, goal.lecturer_id)))
    throw new ForbiddenError(
      "KPI chỉ dành cho chính chủ/đại diện còn hiệu lực",
    );
  return s;
}
async function lockGoal(client, user, rawId) {
  const goal = (
    await client.query(
      "SELECT *,period_start::text,period_end::text FROM app.kpi_goals WHERE goal_id=$1 FOR UPDATE",
      [parse(id, rawId)],
    )
  ).rows[0];
  if (!goal) throw new NotFoundError("Không tìm thấy mục tiêu KPI");
  await authorized(client, user, goal);
  return goal;
}
function version(record, p) {
  if (!same(record.version, p.version))
    throw new ConflictError("Version đã thay đổi; tải lại dữ liệu");
}
function editable(goal) {
  if (goal.status !== "DRAFT")
    throw new ConflictError(
      "Mục tiêu đã chấp nhận bị khóa; dùng mục tiêu/kỳ mới",
    );
}
async function audit(client, user, action, entityName, record) {
  await recordAuditLog({
    client,
    throwOnError: true,
    userId: user.userId,
    action: `KPI_${action}`,
    entityName,
    entityId: record.goal_id || record.result_id,
    newValues: record,
  });
}
async function run(fn) {
  try {
    return await withTransaction(({ client }) => fn(client));
  } catch (e) {
    if (e.code === "23505")
      throw new ConflictError("Trùng mã KPI/kỳ hoặc kết quả đã tồn tại");
    if (e.code === "23503")
      throw new ConflictError("Bản ghi có liên kết hoặc danh mục không hợp lệ");
    throw e;
  }
}
export async function list(user, raw) {
  const { subjectType, organizationUnitId } = parse(listSchema, raw);
  return run(async (client) => {
    const s = await repo.subject(
      client,
      user.userId,
      subjectType || "LECTURER",
      organizationUnitId,
    );
    if (!s)
      throw new ForbiddenError("Chưa có hồ sơ/phân công hoặc vai trò hợp lệ");
    return {
      items: (
        await client.query(
          `SELECT g.*,g.period_start::text,g.period_end::text,
      (to_jsonb(r)||jsonb_build_object('result_id',r.result_id::text,'goal_id',r.goal_id::text,
        'actual',r.actual::text,'achievement_id',r.achievement_id::text,'created_by',r.created_by::text,'version',r.version::text)) result FROM app.kpi_goals g
      LEFT JOIN app.kpi_results r USING(goal_id) WHERE g.lecturer_id IS NOT DISTINCT FROM $1
      AND g.unit_id IS NOT DISTINCT FROM $2 ORDER BY g.period_end DESC,g.goal_id DESC`,
          [s.lecturer_id || null, s.unit_id || null],
        )
      ).rows,
    };
  });
}
export async function catalogs(user) {
  return run(async (client) => {
    const roles = (
      await client.query(repo.activeRolesSql, [user.userId])
    ).rows.map((r) => r.code);
    if (!roles.some((r) => ["LECTURER", "UNIT_REPRESENTATIVE"].includes(r)))
      throw new ForbiddenError("Không có vai trò KPI");
    const types = (
      await client.query(
        "SELECT achievement_type_id,code,name,applicable_subject_type FROM app.achievement_types WHERE is_active ORDER BY name",
      )
    ).rows;
    const units = roles.includes("UNIT_REPRESENTATIVE")
      ? (
          await client.query(
            `SELECT u.unit_id,u.name FROM app.unit_representatives r JOIN app.organization_units u USING(unit_id)
      WHERE r.user_id=$1 AND u.is_active AND r.revoked_at IS NULL AND r.valid_from<=NOW() AND (r.valid_to IS NULL OR r.valid_to>NOW()) ORDER BY u.name`,
            [user.userId],
          )
        ).rows
      : [];
    return { types, units };
  });
}
export async function create(user, raw) {
  const p = parse(goalSchema, raw);
  return run(async (client) => {
    const s = await repo.subject(
      client,
      user.userId,
      p.subjectType,
      p.organizationUnitId,
    );
    if (!s)
      throw new ForbiddenError("Chưa có hồ sơ/phân công hoặc vai trò hợp lệ");
    const g = await repo.createGoal(client, user.userId, s, p, "MANUAL");
    await audit(client, user, "CREATE", "kpi_goals", g);
    return g;
  });
}
export async function mutateGoal(user, goalId, action, raw) {
  const p = parse(action === "update" ? goalUpdateSchema : versionSchema, raw);
  return run(async (client) => {
    const g = await lockGoal(client, user, goalId);
    version(g, p);
    editable(g);
    let out;
    if (action === "delete")
      out = (
        await client.query(
          "DELETE FROM app.kpi_goals WHERE goal_id=$1 RETURNING *,period_start::text,period_end::text",
          [g.goal_id],
        )
      ).rows[0];
    else if (action === "accept")
      out = (
        await client.query(
          `UPDATE app.kpi_goals SET status='ACCEPTED',accepted_by=$2,accepted_at=NOW(),version=version+1,updated_at=NOW() WHERE goal_id=$1 RETURNING *,period_start::text,period_end::text`,
          [g.goal_id, user.userId],
        )
      ).rows[0];
    else
      out = (
        await client.query(
          `UPDATE app.kpi_goals SET code=$2,title=$3,measure_unit=$4,period_start=$5,period_end=$6,target=$7,plan=$8,source='MANUAL',source_note=$9,version=version+1,updated_at=NOW() WHERE goal_id=$1 RETURNING *,period_start::text,period_end::text`,
          [
            g.goal_id,
            p.code,
            p.title,
            p.measureUnit,
            p.periodStart,
            p.periodEnd,
            p.target,
            p.plan,
            p.sourceNote,
          ],
        )
      ).rows[0];
    await audit(client, user, action.toUpperCase(), "kpi_goals", out);
    return out;
  });
}
export async function result(user, goalId, action, raw) {
  const schema =
    action === "create"
      ? resultSchema
      : action === "update"
        ? resultUpdateSchema
        : action === "draft"
          ? draftSchema
          : versionSchema;
  const p = parse(schema, raw);
  return run(async (client) => {
    const g = await lockGoal(client, user, goalId);
    if (g.status !== "ACCEPTED")
      throw new ConflictError("Cần chấp nhận mục tiêu trước khi ghi kết quả");
    let r = (
      await client.query(
        "SELECT * FROM app.kpi_results WHERE goal_id=$1 FOR UPDATE",
        [g.goal_id],
      )
    ).rows[0];
    if (action === "create") {
      if (r) throw new ConflictError("Kỳ này đã có kết quả");
      r = await repo.createResult(client, user.userId, g.goal_id, p, "MANUAL");
    } else {
      if (!r) throw new NotFoundError("Chưa có kết quả");
      version(r, p);
      if (r.achievement_id)
        throw new ConflictError(
          "Kết quả đã tạo kê khai; sửa hồ sơ theo workflow, không ghi đè nguồn",
        );
      if (action === "delete")
        await client.query("DELETE FROM app.kpi_results WHERE result_id=$1", [
          r.result_id,
        ]);
      else if (action === "update")
        r = (
          await client.query(
            `UPDATE app.kpi_results SET actual=$2,source='MANUAL',source_note=$3,evidence_note=$4,version=version+1,updated_at=NOW() WHERE result_id=$1 RETURNING *`,
            [r.result_id, p.actual, p.sourceNote, p.evidenceNote],
          )
        ).rows[0];
      else {
        const type = (
          await client.query(
            `SELECT 1 FROM app.achievement_types WHERE achievement_type_id=$1 AND is_active
          AND applicable_subject_type IN ($2,'BOTH')`,
            [p.achievementTypeId, g.lecturer_id ? "LECTURER" : "UNIT"],
          )
        ).rows[0];
        if (!type)
          throw new ValidationError("Chọn loại thành tích đang hoạt động");
        const description = `KPI ${g.code}: mục tiêu ${g.target}, thực tế ${r.actual} ${g.measure_unit}. Nguồn ${r.source}: ${r.source_note}\nMinh chứng do người dùng kê khai (chưa xác nhận): ${r.evidence_note}\nKế hoạch: ${g.plan}`;
        if (description.length > 4000)
          throw new ValidationError(
            "Nội dung sao chép vượt 4000 ký tự của kê khai; rút gọn kết quả/nguồn/minh chứng trước khi tạo nháp",
          );
        const a = (
          await client.query(
            `INSERT INTO app.achievements(lecturer_id,unit_id,context_unit_id,achievement_type_id,title,description,start_date,end_date,recognition_year,status,created_by)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT',$10) RETURNING achievement_id,status,version`,
            [
              g.lecturer_id,
              g.unit_id,
              g.context_unit_id,
              p.achievementTypeId,
              g.title,
              description,
              g.period_start,
              g.period_end,
              Number(g.period_end.slice(0, 4)),
              user.userId,
            ],
          )
        ).rows[0];
        r = (
          await client.query(
            "UPDATE app.kpi_results SET achievement_id=$2,version=version+1,updated_at=NOW() WHERE result_id=$1 RETURNING *",
            [r.result_id, a.achievement_id],
          )
        ).rows[0];
        await audit(client, user, "CREATE_DRAFT", "achievements", {
          goal_id: a.achievement_id,
          ...a,
        });
      }
    }
    await audit(client, user, `RESULT_${action.toUpperCase()}`, "kpi_results", {
      ...r,
      goal_id: undefined,
    });
    return r;
  });
}
export async function importCsv(user, raw, commit = false) {
  const entries = readCsv(parse(importSchema, raw).csv);
  return run(async (client) => {
    const s = await repo.subject(client, user.userId);
    if (!s) throw new ForbiddenError("CSV dành cho giảng viên chính chủ");
    // Serialize imports for this subject; unique DB indexes also protect manual/import races.
    if (commit)
      await client.query(
        "SELECT lecturer_id FROM app.lecturers WHERE lecturer_id=$1 FOR UPDATE",
        [s.lecturer_id],
      );
    const seen = new Map();
    const rows = [];
    for (const e of entries) {
      if (e.error) {
        rows.push({ ...e, status: "INVALID" });
        continue;
      }
      const key = JSON.stringify([
        e.goal.code,
        e.goal.periodStart,
        e.goal.periodEnd,
      ]);
      if (seen.has(key)) {
        const identical = seen.get(key) === JSON.stringify([e.goal, e.result]);
        rows.push({ ...e, status: identical ? "DUPLICATE" : "INVALID", message: identical ? "Trùng trong CSV" : "Cùng mã/kỳ nhưng khác nội dung trong CSV" });
        continue;
      }
      seen.set(key, JSON.stringify([e.goal, e.result]));
      const g = await repo.findDuplicate(client, s, e.goal);
      if (g) {
        const existing = (
          await client.query("SELECT actual, evidence_note, source_note FROM app.kpi_results WHERE goal_id=$1", [
            g.goal_id,
          ])
        ).rows[0];
        const matches =
          g.title === e.goal.title &&
          g.measure_unit === e.goal.measureUnit &&
          Number(g.target) === e.goal.target &&
          g.plan === e.goal.plan && g.source_note === e.goal.sourceNote;
        if (!matches) {
          rows.push({
            ...e,
            status: "INVALID",
            message: "Dữ liệu mục tiêu khác mục tiêu đã chấp nhận",
          });
          continue;
        }
        if (!e.result || existing) {
          const sameResult = !e.result || (Number(existing.actual) === e.result.actual &&
            existing.evidence_note === e.result.evidenceNote && existing.source_note === e.result.sourceNote);
          rows.push({ ...e, status: sameResult ? "DUPLICATE" : "INVALID", goalId: g.goal_id,
            ...(!sameResult ? { message: "Kết quả CSV khác bản đã nhập; không ghi đè" } : {}) });
          continue;
        }
        if (g.status !== "ACCEPTED") {
          rows.push({ ...e, status: "INVALID", message: "Chấp nhận mục tiêu trước khi import kết quả" });
          continue;
        }
        rows.push({ ...e, status: "READY_RESULT", goalId: g.goal_id });
      } else if (e.result)
        rows.push({
          ...e,
          status: "INVALID",
          message: "Import mục tiêu trước, chấp nhận, rồi import kết quả",
        });
      else rows.push({ ...e, status: "READY_GOAL" });
    }
    if (commit) {
      if (rows.some((r) => r.status === "INVALID"))
        throw new ValidationError(
          "CSV có dòng không hợp lệ; không ghi dòng nào",
          rows,
        );
      for (const e of rows) {
        let record;
        if (e.status === "READY_GOAL") {
          record = await repo.createGoal(client, user.userId, s, e.goal, "CSV");
          await audit(client, user, "IMPORT_GOAL", "kpi_goals", record);
        }
        if (e.status === "READY_RESULT") {
          await lockGoal(client, user, e.goalId);
          record = await repo.createResult(
            client,
            user.userId,
            e.goalId,
            e.result,
            "CSV",
          );
          await audit(client, user, "IMPORT_RESULT", "kpi_results", {
            ...record,
            goal_id: undefined,
          });
        }
        if (record) e.status = "IMPORTED";
      }
    }
    return {
      rows,
      imported: rows.filter((r) => r.status === "IMPORTED").length,
      duplicates: rows.filter((r) => r.status === "DUPLICATE").length,
    };
  });
}
