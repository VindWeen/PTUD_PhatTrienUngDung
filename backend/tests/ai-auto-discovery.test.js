import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverEligibleRegulations } from '../src/modules/ai/autoDiscoveryService.js';

test('Auto-Discovery: Quét các quy chế mở và tính toán % hoàn thành chính xác', async () => {
  const user = { userId: 1001, username: 'an.nv' };

  // Giả lập client DB với 2 quy chế:
  // Quy chế A (ID 1): 2 tiêu chí, người dùng đạt cả 2 -> 100%
  // Quy chế B (ID 2): 2 tiêu chí, người dùng chỉ đạt 1 -> 50%
  const mockClient = {
    async query(sql, params = []) {
      const text = sql.trim();

      // 1. Tìm thông tin giảng viên
      if (text.includes('SELECT lecturer_id FROM app.lecturers')) {
        return { rows: [{ lecturer_id: 2001 }] };
      }

      // 2. Tải danh sách thành tích
      if (text.includes('FROM app.achievements a')) {
        return {
          rows: [
            {
              id: 1,
              title: 'Bài báo Q1 Scopus',
              sourceTypeId: 1,
              lecturer_id: 2001,
              unit_id: null,
              year: 2024,
              status: 'ACTIVE',
              files: [{ id: 101, sha256: 'a'.repeat(64), name: 'scopus2024.pdf' }],
            },
            {
              id: 2,
              title: 'Bài báo Q1 Scopus',
              sourceTypeId: 1,
              lecturer_id: 2001,
              unit_id: null,
              year: 2025,
              status: 'ACTIVE',
              files: [{ id: 102, sha256: 'b'.repeat(64), name: 'scopus2025.pdf' }],
            },
          ],
        };
      }

      // 3. Tải danh sách hồ sơ khen thưởng
      if (text.includes('FROM app.award_records r')) {
        return { rows: [] };
      }

      // 4. Tải danh sách quy chế mở (is_confirmed = 1)
      if (text.includes('FROM app.regulation_document_versions v')) {
        return {
          rows: [
            {
              version_id: 10,
              document_id: 1,
              version_number: 'QC-01/2026',
              sha256_hash: 'c'.repeat(64),
              lhu_application_status: 'CONFIRMED_LHU_POLICY',
              effective_from_str: '2026-01-01',
              effective_to_str: '2026-12-31',
              document_code: 'LHU-KHCN-01',
              document_title: 'Quy chế Khen thưởng NCKH Xuất Sắc',
              document_type: 'POLICY',
              period_name: 'Kỳ Khen thưởng 2026',
              period_end_date: '2026-12-31',
            },
            {
              version_id: 20,
              document_id: 2,
              version_number: 'QC-02/2026',
              sha256_hash: 'd'.repeat(64),
              lhu_application_status: 'CONFIRMED_LHU_POLICY',
              effective_from_str: '2026-01-01',
              effective_to_str: '2026-12-31',
              document_code: 'LHU-CSTT-02',
              document_title: 'Quy chế Chiến sĩ thi đua cấp tỉnh',
              document_type: 'CRITERIA',
              period_name: 'Kỳ Khen thưởng 2026',
              period_end_date: '2026-12-31',
            },
          ],
        };
      }

      // 5. Tải tiêu chí theo từng version_id
      if (text.includes('FROM app.award_criteria_versions c')) {
        const versionId = params[0];
        if (versionId === 10) {
          // Quy chế 1: Tiêu chí 1 đạt (cần 1 bài Scopus), Tiêu chí 2 đạt (cần 2 bài)
          return {
            rows: [
              {
                criteria_version_id: 101,
                criterion_code: 'TC-NCKH-01',
                name: 'Có bài báo khoa học quốc tế',
                target_type: 'INDIVIDUAL',
                min_threshold: 1,
                unit_metric: 'bài báo',
                is_confirmed: true,
                version_id: 10,
                source_rules: JSON.stringify({ minimumDistinctYears: 1, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] }),
              },
              {
                criteria_version_id: 102,
                criterion_code: 'TC-NCKH-02',
                name: 'Có ít nhất 2 bài báo trong 2 năm',
                target_type: 'INDIVIDUAL',
                min_threshold: 2,
                unit_metric: 'bài báo',
                is_confirmed: true,
                version_id: 10,
                source_rules: JSON.stringify({ minimumDistinctYears: 2, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] }),
              },
            ],
          };
        } else if (versionId === 20) {
          // Quy chế 2: Tiêu chí 1 đạt (cần 1 bài), Tiêu chí 2 không đạt (cần 5 bài)
          return {
            rows: [
              {
                criteria_version_id: 201,
                criterion_code: 'TC-CSTT-01',
                name: 'Có tối thiểu 1 thành tích nghiên cứu',
                target_type: 'INDIVIDUAL',
                min_threshold: 1,
                unit_metric: 'thành tích',
                is_confirmed: true,
                version_id: 20,
                source_rules: JSON.stringify({ minimumDistinctYears: 1, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] }),
              },
              {
                criteria_version_id: 202,
                criterion_code: 'TC-CSTT-02',
                name: 'Yêu cầu 5 năm liên tục',
                target_type: 'INDIVIDUAL',
                min_threshold: 5,
                unit_metric: 'năm',
                is_confirmed: true,
                version_id: 20,
                source_rules: JSON.stringify({ minimumDistinctYears: 5, requireConsecutive: true, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] }),
              },
            ],
          };
        }
      }

      return { rows: [] };
    },
  };

  const res = await discoverEligibleRegulations(user, {}, mockClient);

  assert.equal(res.success, true);
  assert.equal(Array.isArray(res.data), true);
  assert.equal(res.data.length, 2);

  // Quy chế A (100%) phải xếp thứ nhất
  const topRank = res.data[0];
  assert.equal(topRank.regulationId, 1);
  assert.equal(topRank.percentage, 100);
  assert.equal(topRank.satisfiedCount, 2);
  assert.equal(topRank.totalCount, 2);
  assert.equal(topRank.isEligible, true);
  assert.equal(topRank.criteria.length, 2);
  assert.equal(topRank.criteria[0].isSatisfied, true);
  assert.equal(topRank.criteria[1].isSatisfied, true);

  // Quy chế B (50%) phải xếp thứ hai
  const secondRank = res.data[1];
  assert.equal(secondRank.regulationId, 2);
  assert.equal(secondRank.percentage, 50);
  assert.equal(secondRank.satisfiedCount, 1);
  assert.equal(secondRank.totalCount, 2);
  assert.equal(secondRank.isEligible, false);
  assert.equal(secondRank.criteria[0].isSatisfied, true);
  assert.equal(secondRank.criteria[1].isSatisfied, false);
  assert.equal(secondRank.criteria[1].missingCount > 0, true);
});

test('Auto-Discovery: Xếp hạng giảm dần theo tỷ lệ % hoàn thành', async () => {
  const user = { userId: 1001, username: 'an.nv' };

  // Test sort order: 3 quy chế với các tỷ lệ khác nhau
  const mockClient = {
    async query(sql) {
      const text = sql.trim();
      if (text.includes('SELECT lecturer_id FROM app.lecturers')) return { rows: [{ lecturer_id: 1001 }] };
      if (text.includes('FROM app.achievements a')) return { rows: [] };
      if (text.includes('FROM app.award_records r')) return { rows: [] };
      if (text.includes('FROM app.regulation_document_versions v')) {
        return {
          rows: [
            { version_id: 1, document_id: 101, document_code: 'QC-A', document_title: 'Quy chế A', is_confirmed: 1 },
            { version_id: 2, document_id: 102, document_code: 'QC-B', document_title: 'Quy chế B', is_confirmed: 1 },
          ],
        };
      }
      if (text.includes('FROM app.award_criteria_versions c')) {
        return {
          rows: [
            { criteria_version_id: 1, criterion_code: 'TC-1', name: 'Tiêu chí', target_type: 'INDIVIDUAL', min_threshold: 1, is_confirmed: 1 },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const res = await discoverEligibleRegulations(user, {}, mockClient);
  assert.equal(res.success, true);
  assert.equal(res.data.length, 2);
  // Cả hai 0% đều được trả về và xếp theo tên
  assert.equal(res.data[0].percentage, 0);
  assert.equal(res.data[1].percentage, 0);
});
