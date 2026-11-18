import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentContexts, effective } from '../src/pages/assessmentSelection.js';

test('the same version can be selected independently for each application context', () => {
  const personal = { regulation_version_id: 7, adoption_id: null };
  const school = { regulation_version_id: 7, adoption_id: 11, member_organization_id: 3 };
  const schoolViaOtherMembership = { ...school, member_organization_id: 4 };
  const faculty = { regulation_version_id: 7, adoption_id: 12 };
  const contexts = assessmentContexts([personal, school, schoolViaOtherMembership, faculty]);
  assert.deepEqual(contexts.map(([key]) => key), ['7:owner', '7:11', '7:12']);
  assert.deepEqual(contexts.filter(([key]) => key === '7:12').map(([, item]) => item), [faculty]);
});

test('changing the assessment date excludes inactive versions and includes both effective boundaries', () => {
  const version = { publication_status: 'PUBLISHED', effective_from: '2026-01-01', effective_to: '2026-11-18' };
  assert.equal(effective(version, '2025-12-31'), false);
  assert.equal(effective(version, '2026-01-01'), true);
  assert.equal(effective(version, '2026-11-18'), true);
  assert.equal(effective(version, '2026-11-19'), false);
  assert.equal(effective({ ...version, publication_status: 'DRAFT' }, '2026-11-18'), false);
});
