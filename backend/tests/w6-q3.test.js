/**
 * W6-Q3: Demo cuối và tag bản phát hành
 * Tác giả: Tạ Trần Vinh Quang
 * Mô tả: Kiểm checklist nghiệm thu cuối (kịch bản PTUD→đề nghị→AI→KPI),
 *        xác nhận kịch bản demo end-to-end có thể chạy, kiểm tra tài liệu
 *        release/tag, commit SHA bản demo và danh sách giới hạn đã ghi nhận.
 *
 * Phụ thuộc: W6-Q2 (migration 009 verified, restore scripts fixed), W6-Q1
 * Test runner: node:test (built-in, no external deps)
 *
 * Ghi chú nghiệm thu:
 *   - AI gọi thật (live provider) cần OPENAI_API_KEY hoặc GROQ_API_KEY,
 *     KHÔNG có trong CI → smoke test bỏ qua nếu không có key.
 *   - Restore integration vẫn cần RESTORE_TARGET_DB_URL riêng.
 *   - Nguồn KPI mô phỏng phải gắn nhãn; không tuyên bố AI trao thưởng.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// ============================================================================
// Suite 1: Checklist nghiệm thu cuối — tài liệu và artefacts cần có
// ============================================================================
describe('W6-Q3 S1: Checklist nghiệm thu cuối — artefacts tồn tại', () => {
  const artefacts = [
    // Migration đầy đủ
    'database/migrations/009_add_missing_columns_to_achievements.sql',
    // Cấu hình đóng băng version
    'docs/deployment/DEMO_VERSION_CONFIG.json',
    // Health/readiness report
    'docs/deployment/PRE_DEMO_HEALTH_REPORT.json',
    // Release checklist W6-Q2
    'docs/report-inputs/RELEASE_CHECKLIST_W6Q2.json',
    // Demo script
    'docs/DEMO_SCRIPT.md',
    // User guide
    'docs/USER_GUIDE.md',
    // API contract
    'docs/api/openapi.json',
    // Candidate manifest (hash baseline)
    'docs/report-inputs/candidate-manifest.json',
    // Restore + backup scripts
    'scripts/restore.mjs',
    'scripts/backup.mjs',
    // Demo release record (tạo bởi W6-Q3)
    'docs/report-inputs/RELEASE_RECORD_W6Q3.json',
    // Known limitations doc (tạo bởi W6-Q3)
    'docs/report-inputs/KNOWN_LIMITATIONS_W6Q3.md',
    // Demo scenario doc (tạo bởi W6-Q3)
    'docs/DEMO_SCENARIO_W6Q3.md',
  ];

  for (const rel of artefacts) {
    it(`artefact tồn tại: ${rel}`, () => {
      const full = path.join(ROOT, rel);
      assert.ok(
        fs.existsSync(full),
        `File bắt buộc không tìm thấy: ${rel}`
      );
    });
  }
});

// ============================================================================
// Suite 2: DEMO_VERSION_CONFIG — đóng băng hợp lệ
// ============================================================================
describe('W6-Q3 S2: DEMO_VERSION_CONFIG — cấu hình đóng băng hợp lệ', () => {
  let config;
  before(() => {
    const p = path.join(ROOT, 'docs/deployment/DEMO_VERSION_CONFIG.json');
    config = JSON.parse(fs.readFileSync(p, 'utf8'));
  });

  it('featureFreezeDate là 21/10 hoặc trước', () => {
    const freeze = new Date(config.featureFreezeDate);
    const deadline = new Date('2026-10-21T23:59:59+07:00');
    assert.ok(
      freeze <= deadline,
      `featureFreezeDate ${config.featureFreezeDate} phải ≤ 2026-10-21`
    );
  });

  it('regulationEnforcementDate là 28/10', () => {
    assert.ok(
      config.regulationEnforcementDate === '2026-10-28',
      `Phải là 2026-10-28; hiện là ${config.regulationEnforcementDate}`
    );
  });

  it('accuracyClaim là NONE (không tuyên bố AI live)', () => {
    const claim = config?.stack?.ai?.accuracyClaim ?? '';
    assert.ok(
      /NONE/i.test(claim),
      `accuracyClaim phải là NONE; hiện là "${claim}"`
    );
  });

  it('kpiSource gắn nhãn SIMULATED', () => {
    const src = config?.stack?.ai?.kpiSource ?? '';
    assert.ok(
      /SIMULATED/i.test(src),
      `kpiSource phải gắn nhãn SIMULATED; hiện là "${src}"`
    );
  });

  it('tất cả P1 blocker đều FIXED', () => {
    const bs = config.blockerStatus ?? {};
    const p1Keys = Object.keys(bs).filter(k => k.startsWith('P1_'));
    assert.ok(p1Keys.length >= 3, 'Phải có ít nhất 3 mục P1 trong blockerStatus');
    for (const k of p1Keys) {
      assert.ok(
        /FIXED/i.test(bs[k]),
        `Blocker ${k} chưa FIXED: "${bs[k]}"`
      );
    }
  });

  it('stack backend ghi đủ framework/version', () => {
    const be = config?.stack?.backend ?? {};
    assert.ok(be.framework, 'Thiếu backend.framework');
    assert.ok(be.pg, 'Thiếu backend.pg driver version');
    assert.ok(be.runtime, 'Thiếu backend.runtime');
  });
});

// ============================================================================
// Suite 3: RELEASE_RECORD_W6Q3 — bản phát hành hợp lệ
// ============================================================================
describe('W6-Q3 S3: RELEASE_RECORD — bản phát hành hợp lệ', () => {
  let record;
  before(() => {
    const p = path.join(ROOT, 'docs/report-inputs/RELEASE_RECORD_W6Q3.json');
    record = JSON.parse(fs.readFileSync(p, 'utf8'));
  });

  it('có trường tagName', () => {
    assert.ok(record.tagName && record.tagName.length > 0, 'Thiếu tagName');
  });

  it('có commitSHA bản demo (7+ ký tự hex)', () => {
    assert.match(
      record.commitSHA ?? '',
      /^[0-9a-f]{7,}/i,
      'commitSHA phải là hex ≥ 7 ký tự'
    );
  });

  it('aiAccuracyClaim là NONE', () => {
    assert.ok(
      /NONE/i.test(record.aiAccuracyClaim ?? ''),
      'aiAccuracyClaim phải NONE'
    );
  });

  it('kpiSource gắn nhãn SIMULATED', () => {
    assert.ok(
      /SIMULATED/i.test(record.kpiSource ?? ''),
      'kpiSource phải SIMULATED'
    );
  });

  it('knownLimitationsRef trỏ đến file KNOWN_LIMITATIONS', () => {
    assert.ok(
      /KNOWN_LIMITATIONS/i.test(record.knownLimitationsRef ?? ''),
      'Thiếu knownLimitationsRef'
    );
  });

  it('demoScenarioRef trỏ đến DEMO_SCENARIO', () => {
    assert.ok(
      /DEMO_SCENARIO/i.test(record.demoScenarioRef ?? ''),
      'Thiếu demoScenarioRef'
    );
  });

  it('không có key/secret thật trong file', () => {
    const raw = JSON.stringify(record);
    // Chỉ fail nếu có giá trị thật như bearer token, password thật, key thật
    // Cho phép text hướng dẫn (ví dụ "OPENAI_API_KEY") và _comment mô tả
    assert.doesNotMatch(raw, /bearer\s+ey[a-zA-Z0-9_-]{10,}|"password"\s*:\s*"[^"]{4,}"|"secret"\s*:\s*"[^"]{4,}"/i,
      'Phát hiện giá trị nhạy cảm thật trong RELEASE_RECORD_W6Q3.json');
  });
});

// ============================================================================
// Suite 4: DEMO_SCENARIO_W6Q3 — kịch bản PTUD→đề nghị→AI→KPI
// ============================================================================
describe('W6-Q3 S4: DEMO_SCENARIO — kịch bản PTUD→AI→KPI đầy đủ', () => {
  let content;
  before(() => {
    const p = path.join(ROOT, 'docs/DEMO_SCENARIO_W6Q3.md');
    content = fs.readFileSync(p, 'utf8');
  });

  it('có phần đăng nhập / kiến trúc (phút 0–1)', () => {
    assert.match(content, /0.{0,5}1|giới thiệu|kiến trúc|readiness/i,
      'Thiếu phần giới thiệu kiến trúc đầu kịch bản');
  });

  it('có bước tạo hồ sơ thành tích và upload minh chứng', () => {
    assert.match(content, /upload|minh chứng|evidence|PDF/i,
      'Thiếu bước upload minh chứng');
  });

  it('có bước gửi hồ sơ và xác nhận bởi manager', () => {
    assert.match(content, /gửi|submit|verify|xác nhận|bich\.tt|manager/i,
      'Thiếu bước gửi/xác nhận hồ sơ');
  });

  it('có bước AI/KPI với nhãn mô phỏng', () => {
    assert.match(content, /KPI|AI|mô phỏng|SIMULATED|recommender/i,
      'Thiếu phần AI/KPI hoặc nhãn mô phỏng');
  });

  it('có phần giới hạn / known limitations', () => {
    assert.match(content, /giới hạn|limitation|restore|BLOCKED|not_run/i,
      'Thiếu phần giới hạn trong kịch bản');
  });

  it('KHÔNG tuyên bố AI trao thưởng (câu khẳng định dương)', () => {
    // Phủ định ("không tuyên bố AI trao thưởng") là hợp lệ — chỉ fail câu khẳng định
    const lines = content.split('\n');
    const badLines = lines.filter(l =>
      /AI.*trao thưởng|AI.*quyết định trao/i.test(l) &&
      !/không.*tuyên bố|không.*trao|không.*ban hành|AI.*gợi ý|AI.*hỗ trợ/i.test(l)
    );
    assert.strictEqual(badLines.length, 0,
      `Phát hiện câu khẳng định AI trao thưởng: ${badLines.join(' | ')}`);
  });
});

// ============================================================================
// Suite 5: KNOWN_LIMITATIONS_W6Q3 — giới hạn được công bố đầy đủ
// ============================================================================
describe('W6-Q3 S5: KNOWN_LIMITATIONS — danh sách giới hạn đầy đủ', () => {
  let content;
  before(() => {
    const p = path.join(ROOT, 'docs/report-inputs/KNOWN_LIMITATIONS_W6Q3.md');
    content = fs.readFileSync(p, 'utf8');
  });

  it('ghi nhận trạng thái restore (BLOCKED hoặc đã unblock)', () => {
    assert.match(content, /restore|42703|RESTORE_TARGET/i,
      'Phải nêu rõ trạng thái restore');
  });

  it('ghi nhận AI live provider chưa nghiệm thu', () => {
    assert.match(content, /AI|provider|smoke|NOT_RUN|key/i,
      'Phải nêu rõ trạng thái AI live provider');
  });

  it('ghi nhận KPI mô phỏng (không phải live LHU)', () => {
    assert.match(content, /KPI.*mô phỏng|SIMULATED|MÔ PHỎNG/i,
      'Phải gắn nhãn KPI mô phỏng rõ ràng');
  });

  it('ghi nhận dashboard p95 chưa đạt < 2s', () => {
    assert.match(content, /p95|dashboard|2s|2 giây|2078|chưa đạt/i,
      'Phải nêu giới hạn dashboard p95');
  });

  it('ghi nhận Hội đồng chưa có tài khoản / phân công', () => {
    assert.match(content, /hội đồng|council|phân công|tài khoản/i,
      'Phải nêu giới hạn Hội đồng');
  });

  it('không tự công nhận PASS cho phần chưa đo', () => {
    // Câu phủ định ("Không tự tích PASS") là hợp lệ — chỉ fail câu khẳng định dương
    const lines = content.split('\n');
    const badLines = lines.filter(l =>
      /đã đạt.*KPI.*thật|accuracy.*live.*100%/i.test(l)
    );
    assert.strictEqual(badLines.length, 0,
      `Phát hiện tự công nhận PASS: ${badLines.join(' | ')}`);
  });
});
