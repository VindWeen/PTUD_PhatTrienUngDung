import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFileName } from '../src/utils/fileName.js';

test('repairs Latin-1 decoded UTF-8 filenames without changing valid Unicode names', () => {
  const original = 'PHIẾU ĐÁNH GIÁ SV THỰC TẬP.pdf';
  const broken = Buffer.from(original, 'utf8').toString('latin1');
  assert.equal(normalizeFileName(broken), original);
  for (const name of [original, 'báo cáo.pdf', 'résumé.pdf', '日本語.pdf', 'plain.pdf', null]) {
    assert.equal(normalizeFileName(name), name);
  }
  assert.equal(normalizeFileName(normalizeFileName(broken)), original);
});
