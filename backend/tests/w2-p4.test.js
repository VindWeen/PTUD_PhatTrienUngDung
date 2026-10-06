import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EvidenceService } from '../src/modules/evidences/evidenceService.js';
const read = name => JSON.parse(fs.readFileSync(new URL(`../../docs/ai/criteria-draft/${name}.json`, import.meta.url)));
test('W2-P4: mỗi mục tiêu giữ nguyên W1-P4, có source/version/confirmation và máy/người', () => {
  const draft = read('criteria');
  const registry = read('sources');
  const original = fs.readFileSync(new URL('../../docs/ai/BUSINESS_CONFIRMATION_W1_P4.md', import.meta.url), 'utf8');
  assert.equal(draft.criteria.length, 4);
  assert.equal(draft.mode, 'SIMULATION_ONLY');
  assert.equal(draft.lhuApplication, 'UNCONFIRMED');
  assert.equal(draft.automaticAward, false);
  for (const c of draft.criteria) {
    assert.ok(original.includes(c.id) && original.includes(c.goal));
    assert.ok(registry.sources.some(s => s.id === c.sourceId && s.allowedUse === 'UI_DEMO_ONLY'));
    assert.ok(c.sourceVersion && c.machine.length && c.human.length && c.legalReferences.length);
    for (const ref of c.legalReferences) {
      const legal = registry.sources.find(s => s.id === ref.split(':')[0]);
      assert.ok(legal?.version && legal.clauses.length && legal.pages.length);
      assert.match(legal.sha256, /^[a-f0-9]{64}$/);
    }
    assert.equal(c.confirmation, 'SIMULATION_DOCUMENTED_LHU_UNCONFIRMED');
    assert.ok(c.blockedBy.includes('LHU-REQ-001'));
    assert.doesNotMatch(c.goal, /Q[12]/);
  }
});
test('W2-P4: SUBMITTED/VERIFIED khóa file cho mọi vai trò (Q3 đã sửa guard)', async () => {
  for (const status of ['SUBMITTED', 'VERIFIED', 'REVOKED']) for (const role of ['LECTURER', 'ADMIN', 'RECORDS_OFFICER']) {
    await assert.rejects(new EvidenceService()._assertCanModifyAchievement({ status, lecturerUserId: 1 }, { userId: 1, roles: [role] }), e => e.statusCode === 409);
  }
});
test('W2-P4: dữ liệu KPI mô phỏng đúng số lượng W1-P4; ngày/mẫu chưa xác nhận giữ null', () => {
  const fixture = read('demo.fixtures');
  assert.match(fixture.label, /MÔ PHỎNG/);
  assert.equal(fixture.sourceId, 'W1-P4-SIMULATION');
  assert.equal(new Set(fixture.textbooks.map(t => t.externalId)).size, 2);
  assert.ok(fixture.textbooks.every(t => t.evidence && t.version));
  assert.equal(new Set(fixture.guidance.map(g => g.learnerId)).size, 3);
  assert.ok(fixture.guidance.every(g => g.role && g.period));
  assert.equal(fixture.deadline, null);
  assert.equal(fixture.confirmedLhuCouncilForm, null);
});
test('W2-P4: file của chủ khác bị từ chối với lecturer', async () => {
  await assert.rejects(new EvidenceService()._assertCanViewAchievement({ lecturerUserId: 99 }, { userId: 1, roles: ['LECTURER'] }), e => e.statusCode === 403);
});
test('REPRO review: RECORDS_OFFICER authorization bypass scope', async () => {
  assert.equal(await new EvidenceService()._assertCanViewAchievement({ lecturerUserId: 99, contextUnitId: 999 }, { userId: 1, roles: ['RECORDS_OFFICER'] }), true);
});
