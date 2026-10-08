import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceService } from '../src/modules/evidences/evidenceService.js';

for (const mode of ['database failure', 'malformed response', 'revoked role']) {
  test(`W5-P4: stale JWT cannot authorize file download on ${mode}`, async () => {
    let storageReads = 0;
    const service = new EvidenceService({
      evidenceRepo: { findEvidenceFileDetail: async () => ({
        achievementId: 1, lecturerId: 1, lecturerUserId: 10,
        contextUnitId: 5, achievementStatus: 'DRAFT', storageKey: 'private.pdf',
      }) },
      roleGetter: async () => {
        if (mode === 'database failure') throw new Error('role lookup unavailable');
        return mode === 'malformed response' ? null : [];
      },
      scopeChecker: async () => true,
      storageAdapter: {
        fileExists: async () => { storageReads++; return true; },
        getFileStream: () => { storageReads++; },
      },
    });
    await assert.rejects(service.getFileForDownload({
      evidenceFileId: 1, user: { userId: 20, roles: ['MANAGER'] },
    }), mode === 'database failure' ? /role lookup unavailable/ : /không có quyền/);
    assert.equal(storageReads, 0);
  });
}
