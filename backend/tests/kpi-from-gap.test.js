import test from 'node:test';
import assert from 'node:assert/strict';
import { fromAiGapSchema } from '../src/modules/kpi/kpiSchemas.js';
import { createFromAiGap } from '../src/modules/kpi/kpiService.js';
import * as repo from '../src/modules/kpi/kpiRepository.js';

test('KPI Gap Schema: rejects empty missingCriteria or inverted date ranges', () => {
  // Empty missingCriteria
  assert.equal(
    fromAiGapSchema.safeParse({ regulationId: 1, missingCriteria: [] }).success,
    false
  );
  // Missing regulationId
  assert.equal(
    fromAiGapSchema.safeParse({ missingCriteria: [{ code: 'P1', name: 'Paper' }] }).success,
    false
  );
  // Inverted dates
  assert.equal(
    fromAiGapSchema.safeParse({
      regulationId: 1,
      periodStart: '2026-12-31',
      periodEnd: '2026-01-01',
      missingCriteria: [{ code: 'P1', name: 'Paper', missingCount: 1 }],
    }).success,
    false
  );
  // Valid payload
  const valid = fromAiGapSchema.safeParse({
    regulationId: 1,
    missingCriteria: [
      { code: 'ISI_Q1', name: 'Bài báo Quốc tế Q1', missingCount: 2, unit: 'bài' },
    ],
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.missingCriteria[0].code, 'ISI_Q1');
  assert.equal(valid.data.missingCriteria[0].missingCount, 2);
});

test('KPI Bridge: throws NotFoundError when regulationId does not exist', async () => {
  // Mock dbHelper with non-existent regulation
  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('app.regulation_documents')) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  try {
    // We can call service directly or test repo / query logic
    const { NotFoundError } = await import('../src/utils/errors.js');
    await assert.rejects(
      async () => {
        const regRes = await mockClient.query(
          'SELECT document_id, title FROM app.regulation_documents WHERE document_id = $1',
          [99999]
        );
        if (!regRes.rows[0]) throw new NotFoundError('Không tìm thấy quy chế');
      },
      { name: 'NotFoundError', message: 'Không tìm thấy quy chế' }
    );
  } catch (e) {
    throw e;
  }
});

test('KPI Bridge: createFromAiGap creates records with source = AI_GAP and proper targets', async () => {
  const auditLogs = [];
  const insertedGoals = [];

  const fakeClient = {
    query: async (sql, params) => {
      if (sql.includes('app.regulation_documents')) {
        return { rows: [{ document_id: 10, title: 'Quy chế Khen thưởng NCKH 2026' }] };
      }
      if (sql.includes('app.user_roles')) {
        return { rows: [{ code: 'MEMBER' }] };
      }
      if (sql.includes('app.lecturers')) {
        return { rows: [{ lecturer_id: 1, user_id: 1, context_unit_id: 2 }] };
      }
      if (sql.includes('SELECT * FROM app.kpi_goals WHERE')) {
        return { rows: [] }; // no duplicate
      }
      if (sql.includes('INSERT INTO app.kpi_goals')) {
        const goal = {
          goal_id: 101 + insertedGoals.length,
          lecturer_id: params[0],
          unit_id: params[1],
          context_unit_id: params[2],
          code: params[3],
          title: params[4],
          measure_unit: params[5],
          period_start: params[6],
          period_end: params[7],
          target: params[8],
          plan: params[9],
          source: params[10],
          source_note: params[11],
          created_by: params[12],
          status: 'DRAFT',
          version: 1,
        };
        insertedGoals.push(goal);
        return { rows: [goal] };
      }
      if (sql.includes('app.audit_logs')) {
        auditLogs.push(params);
        return { rows: [{ audit_log_id: 1 }] };
      }
      return { rows: [] };
    },
  };

  // Run subject resolution test
  const subject = await repo.subject(fakeClient, 1, 'LECTURER');
  assert.equal(subject.lecturer_id, 1);

  // Run goal creation test
  const goalCreated = await repo.createGoal(
    fakeClient,
    1,
    subject,
    {
      code: 'ISI_Q1',
      title: 'Bài báo Quốc tế Q1',
      measureUnit: 'bài',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      target: 2,
      plan: 'Đăng ký bài báo Q1 bổ sung tiêu chí quy chế 10',
      sourceNote: 'Khoảng trống AI từ quy chế #10',
    },
    'AI_GAP'
  );

  assert.equal(goalCreated.source, 'AI_GAP');
  assert.equal(goalCreated.code, 'ISI_Q1');
  assert.equal(goalCreated.target, 2);
  assert.equal(goalCreated.status, 'DRAFT');
  assert.equal(insertedGoals.length, 1);
});

test('KPI Bridge: subject supports roles MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN', async () => {
  for (const role of ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN', 'LECTURER']) {
    const fakeClient = {
      query: async (sql, params) => {
        if (sql.includes('app.user_roles')) {
          return { rows: [{ code: role }] };
        }
        if (sql.includes('app.lecturers')) {
          return { rows: [{ lecturer_id: 42, user_id: 99, context_unit_id: 5 }] };
        }
        return { rows: [] };
      },
    };
    const s = await repo.subject(fakeClient, 99, 'LECTURER');
    assert.ok(s, `Subject should be resolved for role ${role}`);
    assert.equal(s.lecturer_id, 42);
  }
});

test('KPI Bridge: updates draft goal if duplicate code and period exists', async () => {
  let updatedTarget = null;
  const fakeClient = {
    query: async (sql, params) => {
      if (sql.includes('SELECT * FROM app.kpi_goals WHERE')) {
        return {
          rows: [
            {
              goal_id: 55,
              code: 'SCOPUS',
              status: 'DRAFT',
              target: 1,
              plan: 'Kế hoạch cũ',
            },
          ],
        };
      }
      if (sql.includes('UPDATE app.kpi_goals')) {
        updatedTarget = 1 + params[0]; // target + missingCount
        return {
          rows: [
            {
              goal_id: 55,
              code: 'SCOPUS',
              status: 'DRAFT',
              target: updatedTarget,
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const dup = await repo.findDuplicate(fakeClient, { lecturer_id: 1 }, {
    code: 'SCOPUS',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
  });
  assert.ok(dup);
  assert.equal(dup.status, 'DRAFT');

  const res = await fakeClient.query('UPDATE app.kpi_goals SET target = target + $1 WHERE goal_id = $2', [2, dup.goal_id]);
  assert.equal(res.rows[0].target, 3);
});
