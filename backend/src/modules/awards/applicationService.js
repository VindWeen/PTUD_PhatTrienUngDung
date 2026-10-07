import { z } from "zod";
import { AwardService } from "./awardService.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../utils/errors.js";

const id = z.coerce.number().int().positive().safe();
const ids = z
  .array(id)
  .max(100)
  .refine((a) => new Set(a).size === a.length, "Mã input bị trùng");
export const applicationSchema = z
  .object({
    lecturerId: id.optional(),
    organizationUnitId: id.optional(),
    cycleId: id,
    targetAwardTypeId: id,
    purpose: z.string().trim().min(5).max(2000),
    achievementIds: ids.default([]),
    awardRecordIds: ids.default([]),
  })
  .strict()
  .refine(
    (b) => Boolean(b.lecturerId) !== Boolean(b.organizationUnitId),
    "Chọn đúng một chủ thể",
  );
export const applicationTransitionSchema = z
  .object({ version: id, reason: z.string().trim().max(1000).optional() })
  .strict();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
export const cycleSchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(255),
    startDate: date,
    endDate: date,
  })
  .strict()
  .refine((b) => b.endDate >= b.startDate, "Ngày kết thúc trước ngày bắt đầu");

export class ApplicationService extends AwardService {
  async council(user, r, c, assigned = false) {
    if (
      !(await this.roleCodes(user)).includes("COUNCIL") ||
      !(await this.scope(user.userId, r.context_unit_id, "COUNCIL"))
    )
      throw new ForbiddenError("Cần Hội đồng đúng phạm vi");
    await this.noSelf(user, r, c);
    if (
      assigned &&
      !(
        await c.query(
          "SELECT 1 FROM app.application_reviews WHERE application_id=$1 AND reviewer_id=$2",
          [r.application_id, user.userId],
        )
      ).rows.length
    )
      throw new ForbiddenError("Chưa được phân công hồ sơ");
  }
  async noSelf(user, r, c) {
    const own = (
      await c.query(
        `SELECT 1 FROM app.lecturers WHERE lecturer_id=$1 AND user_id=$2
           UNION ALL SELECT 1 FROM app.award_application_inputs WHERE application_id=$3 AND submitted_by=$2
           UNION ALL SELECT 1 FROM app.application_review_comments WHERE application_id=$3 AND actor_id=$2 AND action='resubmit'`,
        [r.lecturer_id, user.userId, r.application_id],
      )
    ).rows.length;
    const representative =
      r.unit_id &&
      (await this.scope(user.userId, r.unit_id, "UNIT_REPRESENTATIVE"));
    if (own || representative || String(r.created_by) === String(user.userId))
      throw new ForbiddenError(
        "Không tự xét hồ sơ cá nhân hoặc tập thể mình đại diện",
      );
  }
  async applicationNotice(c, r, from) {
    const recipients = (
      await c.query(
        `SELECT user_id FROM app.users WHERE status='ACTIVE' AND (user_id=$1 OR user_id IN (SELECT reviewer_id FROM app.application_reviews WHERE application_id=$2))`,
        [r.created_by, r.application_id],
      )
    ).rows;
    for (const u of recipients) {
      try {
        await this.reader({ userId: u.user_id }, r, c);
      } catch (e) {
        if (e instanceof ForbiddenError) continue;
        throw e;
      }
      await c.query(
        `INSERT INTO app.notifications(user_id,entity_type,entity_id,entity_version,from_status,to_status,audience) VALUES($1,'APPLICATION',$2,$3,$4,$5,'SUBJECT') ON CONFLICT DO NOTHING`,
        [u.user_id, r.application_id, r.version, from, r.status],
      );
    }
  }
  async review(rawId, body, user, action) {
    const b = z
      .object({
        version: id,
        reason: z.string().trim().min(5).max(1000),
        reviewerId: id.optional(),
      })
      .strict()
      .parse(body);
    if (action !== "assign" && b.reviewerId)
      throw new ValidationError("Chỉ phân công nhận reviewerId");
    return this.transaction(user, "APPLICATION_" + action, async (c) => {
      const r = await this.get(rawId, user, c, true);
      if (String(r.version) !== String(b.version))
        throw new ConflictError("Sai phiên bản hồ sơ");
      let target = r.status;
      if (action === "resubmit") {
        await this.applicant(user, r, c);
        if (r.status !== "NEED_CORRECTION")
          throw new ConflictError("Chỉ bổ sung hồ sơ NEED_CORRECTION");
        target = "SUBMITTED";
      } else {
        await this.council(user, r, c, action !== "assign");
        if (!["COUNCIL_PENDING", "UNDER_REVIEW"].includes(r.status))
          throw new ConflictError("Hồ sơ chưa ở bước Hội đồng");
        if (action === "assign") {
          if (!b.reviewerId)
            throw new ValidationError("Cần người được phân công");
          await this.council({ userId: b.reviewerId }, r, c);
          await c.query(
            "INSERT INTO app.application_reviews(application_id,reviewer_id,assigned_by) VALUES($1,$2,$3)",
            [r.application_id, b.reviewerId, user.userId],
          );
          target = "UNDER_REVIEW";
        } else if (action === "request-correction") target = "NEED_CORRECTION";
        else if (action === "recommend") target = "RECOMMENDED";
        else if (action === "not-recommend") target = "NOT_RECOMMENDED";
        else if (action !== "comment")
          throw new ValidationError("Hành động không hỗ trợ");
      }
      await c.query(
        "INSERT INTO app.application_review_comments(application_id,actor_id,action,content) VALUES($1,$2,$3,$4)",
        [r.application_id, user.userId, action, b.reason],
      );
      const updated = (
        await c.query(
          "UPDATE app.award_applications SET status=$2,version=version+1,updated_at=NOW() WHERE application_id=$1 AND version=$3 AND status=$4 RETURNING *",
          [r.application_id, target, b.version, r.status],
        )
      ).rows[0];
      if (!updated) throw new ConflictError("Sai phiên bản hoặc trạng thái");
      await this.history(c, updated, r.status, user, b.reason);
      await this.applicationNotice(c, updated, r.status);
      return updated;
    });
  }
  async roleCodes(user) {
    if (!user?.userId) throw new ForbiddenError();
    return (await this.roles(user.userId)).map((r) =>
      typeof r === "string" ? r : r.Code || r.code,
    );
  }
  async applicant(user, r, c) {
    const roles = await this.roleCodes(user);
    if (r.lecturer_id && roles.includes("LECTURER")) {
      const own = (
        await c.query(
          "SELECT 1 FROM app.lecturers WHERE lecturer_id=$1 AND user_id=$2 AND is_active=TRUE",
          [r.lecturer_id, user.userId],
        )
      ).rows.length;
      if (own) return;
    }
    if (
      r.unit_id &&
      roles.includes("UNIT_REPRESENTATIVE") &&
      (await this.scope(user.userId, r.unit_id, "UNIT_REPRESENTATIVE"))
    )
      return;
    throw new ForbiddenError(
      "Chỉ chính chủ hoặc đại diện hiệu lực được nộp hồ sơ",
    );
  }
  async reader(user, r, c) {
    if (
      [
        "COUNCIL_PENDING",
        "UNDER_REVIEW",
        "NEED_CORRECTION",
        "RECOMMENDED",
        "NOT_RECOMMENDED",
      ].includes(r.status)
    ) {
      try {
        await this.council(user, r, c);
        return;
      } catch (e) {
        if (!(e instanceof ForbiddenError)) throw e;
      }
    }
    try {
      await this.applicant(user, r, c);
      return;
    } catch (e) {
      if (!(e instanceof ForbiddenError)) throw e;
    }
    const roles = await this.roleCodes(user);
    for (const role of ["MANAGER", "RECORDS_OFFICER"])
      if (
        roles.includes(role) &&
        (await this.scope(user.userId, r.context_unit_id, role))
      )
        return;
    throw new ForbiddenError("Hồ sơ ngoài quyền đọc");
  }
  async cycles(user) {
    await this.roleCodes(user);
    return (
      await this.pool().query(
        "SELECT * FROM app.award_periods ORDER BY start_date DESC",
      )
    ).rows;
  }
  async createCycle(body, user) {
    await this.authorize(user);
    const b = cycleSchema.parse(body);
    return this.transaction(
      user,
      "CREATE_AWARD_CYCLE",
      async (c) =>
        (
          await c.query(
            "INSERT INTO app.award_periods(code,name,start_date,end_date,status) VALUES($1,$2,$3,$4,'OPEN') RETURNING *",
            [b.code, b.name, b.startDate, b.endDate],
          )
        ).rows[0],
    );
  }
  async validateTarget(c, r) {
    const cycle = (
      await c.query(
        "SELECT * FROM app.award_periods WHERE award_period_id=$1 FOR SHARE",
        [r.award_period_id],
      )
    ).rows[0];
    if (!cycle || cycle.status !== "OPEN")
      throw new ValidationError("Kỳ không tồn tại hoặc chưa mở");
    const open = (
      await c.query(
        "SELECT 1 FROM app.award_periods WHERE award_period_id=$1 AND CURRENT_DATE BETWEEN start_date AND end_date",
        [r.award_period_id],
      )
    ).rows.length;
    if (!open) throw new ValidationError("Ngoài thời gian nộp của kỳ");
    const type = (
      await c.query(
        "SELECT * FROM app.award_types WHERE award_type_id=$1 AND is_active=TRUE",
        [r.target_award_type_id],
      )
    ).rows[0];
    if (
      !type ||
      !["BOTH", r.lecturer_id ? "LECTURER" : "UNIT"].includes(
        type.applicable_subject_type,
      )
    )
      throw new ValidationError("Mục tiêu không áp dụng cho chủ thể");
    return { cycle, target: type };
  }
  async create(body, user) {
    const b = applicationSchema.parse(body);
    return this.transaction(user, "CREATE_AWARD_APPLICATION", async (c) => {
      const r = {
        lecturer_id: b.lecturerId || null,
        unit_id: b.organizationUnitId || null,
        award_period_id: b.cycleId,
        target_award_type_id: b.targetAwardTypeId,
      };
      await this.applicant(user, r, c);
      await this.validateTarget(c, r);
      let unit = r.unit_id;
      if (r.lecturer_id) {
        const rows = (
          await c.query(
            "SELECT unit_id FROM app.lecturer_assignments WHERE lecturer_id=$1 AND is_primary=TRUE AND valid_from<=NOW() AND (valid_to IS NULL OR valid_to>NOW())",
            [r.lecturer_id],
          )
        ).rows;
        if (rows.length !== 1)
          throw new ValidationError("Thiếu đơn vị công tác chính hiệu lực");
        unit = rows[0].unit_id;
      }
      const created = (
        await c.query(
          `INSERT INTO app.award_applications(award_period_id,lecturer_id,unit_id,target_award_type_id,context_unit_id,created_by,purpose,achievement_ids,award_record_ids,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT') RETURNING *`,
          [
            b.cycleId,
            r.lecturer_id,
            r.unit_id,
            b.targetAwardTypeId,
            unit,
            user.userId,
            b.purpose,
            b.achievementIds,
            b.awardRecordIds,
          ],
        )
      ).rows[0];
      await this.history(c, created, null, user);
      return created;
    });
  }
  async history(c, r, from, user, reason) {
    await c.query(
      "INSERT INTO app.award_application_histories(application_id,from_status,to_status,actor_id,reason) VALUES($1,$2,$3,$4,$5)",
      [r.application_id, from, r.status, user.userId, reason || null],
    );
  }
  async get(rawId, user, c = this.pool(), lock = false) {
    const r = (
      await c.query(
        `SELECT * FROM app.award_applications WHERE application_id=$1 ${lock ? "FOR UPDATE" : ""}`,
        [id.parse(rawId)],
      )
    ).rows[0];
    if (!r) throw new NotFoundError();
    await this.reader(user, r, c);
    return r;
  }
  async snapshot(c, r, user) {
    const { cycle, target } = await this.validateTarget(c, r);
    if (!r.achievement_ids.length)
      throw new ValidationError(
        "Thiếu thành tích VERIFIED: chọn ít nhất một thành tích",
      );
    const achievements = [];
    const awards = [];
    const same = (a) =>
      String(a.lecturer_id || "") === String(r.lecturer_id || "") &&
      String(a.unit_id || "") === String(r.unit_id || "");
    // Lock sources in deterministic order; revocations serialize with snapshot capture.
    for (const aid of [...r.achievement_ids].sort(
      (a, b) => Number(a) - Number(b),
    )) {
      const a = (
        await c.query(
          "SELECT * FROM app.achievements WHERE achievement_id=$1 FOR SHARE",
          [aid],
        )
      ).rows[0];
      if (!a || !same(a) || a.status !== "VERIFIED")
        throw new ValidationError(
          `Thành tích #${aid} thiếu, khác chủ thể hoặc chưa VERIFIED`,
        );
      const submission = (
        await c.query(
          "SELECT * FROM app.achievement_submissions WHERE achievement_id=$1 ORDER BY revision_no DESC LIMIT 1",
          [aid],
        )
      ).rows[0];
      if (!submission)
        throw new ValidationError(
          `Thành tích #${aid} thiếu revision đã nộp (W3-Q1)`,
        );
      const files = (
        await c.query(
          `SELECT f.evidence_file_id,f.version_no,f.original_file_name,f.sha256_hash,f.mime_type,f.file_size,f.storage_key FROM app.submission_evidence_files s JOIN app.evidence_files f USING(evidence_file_id) WHERE s.submission_id=$1 ORDER BY f.evidence_file_id`,
          [submission.submission_id],
        )
      ).rows;
      if (!files.length)
        throw new ValidationError(
          `Thành tích #${aid} thiếu file trong revision`,
        );
      for (const file of files) {
        if (!(await this.storage.fileExists(file.storage_key)))
          throw new ValidationError(
            `Thành tích #${aid} thiếu file private #${file.evidence_file_id}`,
          );
        delete file.storage_key;
      }
      achievements.push({ record: a, submission, files });
    }
    for (const rid of [...r.award_record_ids].sort(
      (a, b) => Number(a) - Number(b),
    )) {
      const a = (
        await c.query(
          "SELECT * FROM app.award_records WHERE record_id=$1 FOR SHARE",
          [rid],
        )
      ).rows[0];
      if (!a || !same(a) || a.status !== "RECORDED")
        throw new ValidationError(
          `Khen thưởng #${rid} thiếu, khác chủ thể hoặc chưa RECORDED`,
        );
      if (!a.decision_id)
        throw new ValidationError(
          `Khen thưởng #${rid} thiếu quyết định có phiên bản (W2-P2)`,
        );
      const decision = (
        await c.query(
          "SELECT * FROM app.award_decisions WHERE decision_id=$1",
          [a.decision_id],
        )
      ).rows[0];
      const files = (
        await c.query(
          "SELECT decision_file_id,version_no,original_file_name,sha256_hash,storage_key FROM app.award_decision_files WHERE decision_id=$1 ORDER BY version_no",
          [a.decision_id],
        )
      ).rows;
      if (!files.length)
        throw new ValidationError(`Khen thưởng #${rid} thiếu file quyết định`);
      for (const file of files) {
        if (!(await this.storage.fileExists(file.storage_key)))
          throw new ValidationError(
            `Khen thưởng #${rid} thiếu file private #${file.decision_file_id}`,
          );
        delete file.storage_key;
      }
      awards.push({ record: a, decision, files });
    }
    return {
      schemaVersion: 1,
      inputVersion: 1,
      source: "SUPABASE_POSTGRESQL",
      capturedBy: user.userId,
      capturedAt: new Date().toISOString(),
      purpose: r.purpose,
      cycle,
      target,
      achievements,
      awards,
      workflow: ["UNIT", "COUNCIL"],
      criteriaEvaluation: null,
    };
  }
  async transition(rawId, body, user, action) {
    const b = applicationTransitionSchema.parse(body);
    return this.transaction(user, "AWARD_APPLICATION_" + action, async (c) => {
      const r = await this.get(rawId, user, c, true);
      if (String(r.version) !== String(b.version))
        throw new ConflictError("Sai phiên bản hồ sơ");
      if (action === "submit") {
        await this.applicant(user, r, c);
        if (r.status !== "DRAFT")
          throw new ConflictError("Chỉ nộp hồ sơ DRAFT");
        const snapshot = await this.snapshot(c, r, user);
        await c.query(
          "INSERT INTO app.award_application_inputs(application_id,input_version,snapshot,submitted_by) VALUES($1,1,$2,$3)",
          [r.application_id, JSON.stringify(snapshot), user.userId],
        );
      } else if (action === "forward") {
        await this.noSelf(user, r, c);
        const roles = await this.roleCodes(user);
        if (
          !roles.includes("MANAGER") ||
          !(await this.scope(user.userId, r.context_unit_id, "MANAGER"))
        )
          throw new ForbiddenError("Cần Manager đúng phạm vi");
        const own = (
          await c.query(
            "SELECT 1 FROM app.lecturers WHERE lecturer_id=$1 AND user_id=$2",
            [r.lecturer_id, user.userId],
          )
        ).rows.length;
        if (own || String(r.created_by) === String(user.userId))
          throw new ForbiddenError("Không tự chuyển hồ sơ của mình");
        if (r.status !== "SUBMITTED")
          throw new ConflictError("Chỉ chuyển hồ sơ SUBMITTED");
        if (!b.reason)
          throw new ValidationError("Chuyển Hội đồng cần ý kiến đơn vị");
      } else throw new ValidationError("Hành động không hỗ trợ");
      const updated = (
        await c.query(
          "UPDATE app.award_applications SET status=$2,version=version+1,updated_at=NOW() WHERE application_id=$1 AND version=$3 AND status=$4 RETURNING *",
          [
            r.application_id,
            action === "submit" ? "SUBMITTED" : "COUNCIL_PENDING",
            b.version,
            r.status,
          ],
        )
      ).rows[0];
      if (!updated)
        throw new ConflictError("Sai trạng thái hoặc phiên bản hồ sơ");
      await this.history(c, updated, r.status, user, b.reason);
      await this.applicationNotice(c, updated, r.status);
      return updated;
    });
  }
  async detail(rawId, user) {
    const r = await this.get(rawId, user);
    const c = this.pool();
    r.reviews = (
      await c.query(
        "SELECT * FROM app.application_reviews WHERE application_id=$1 ORDER BY review_id",
        [r.application_id],
      )
    ).rows;
    r.comments = (
      await c.query(
        "SELECT * FROM app.application_review_comments WHERE application_id=$1 ORDER BY comment_id",
        [r.application_id],
      )
    ).rows;
    r.canCouncil = false;
    try {
      await this.council(user, r, c);
      r.canCouncil = true;
    } catch (e) {
      if (!(e instanceof ForbiddenError)) throw e;
    }
    r.canReview =
      r.canCouncil &&
      r.reviews.some((a) => String(a.reviewer_id) === String(user.userId));
    r.input =
      (
        await c.query(
          "SELECT * FROM app.award_application_inputs WHERE application_id=$1",
          [r.application_id],
        )
      ).rows[0] || null;
    r.histories = (
      await c.query(
        "SELECT * FROM app.award_application_histories WHERE application_id=$1 ORDER BY history_id",
        [r.application_id],
      )
    ).rows;
    return r;
  }
  async list(query, user) {
    const c = this.pool();
    const page = id.parse(query.page || 1);
    const pageSize = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(query.pageSize || 20);
    if (query.contextUnitId) {
      const unit = id.parse(query.contextUnitId);
      const roles = await this.roleCodes(user);
      let allowed = false;
      for (const role of ["MANAGER", "RECORDS_OFFICER", "COUNCIL"])
        if (roles.includes(role) && (await this.scope(user.userId, unit, role)))
          allowed = true;
      if (!allowed) throw new ForbiddenError("Cần quyền đọc đơn vị");
      const candidates = (
        await c.query(
          "SELECT * FROM app.award_applications WHERE context_unit_id=$1 ORDER BY application_id DESC LIMIT $2 OFFSET $3",
          [unit, pageSize, (page - 1) * pageSize],
        )
      ).rows;
      const items = [];
      for (const r of candidates) {
        try {
          await this.reader(user, r, c);
          items.push(r);
        } catch (e) {
          if (!(e instanceof ForbiddenError)) throw e;
        }
      }
      return {
        items,
        page,
        pageSize,
      };
    }
    await this.roleCodes(user);
    const rows = (
      await c.query(
        "SELECT * FROM app.award_applications WHERE created_by=$1 ORDER BY application_id DESC LIMIT $2 OFFSET $3",
        [user.userId, pageSize, (page - 1) * pageSize],
      )
    ).rows;
    const items = [];
    for (const r of rows) {
      try {
        await this.reader(user, r, c);
        items.push(r);
      } catch (e) {
        if (!(e instanceof ForbiddenError)) throw e;
      }
    }
    return { items, page, pageSize };
  }
}
export default new ApplicationService();
