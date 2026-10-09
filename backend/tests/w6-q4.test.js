/**
 * W6-Q4: Bàn giao phần kỹ thuật của Quang
 * Tác giả: Tạ Trần Vinh Quang
 * Mô tả: Kiểm tra bộ tư liệu bàn giao kỹ thuật đủ để viết báo cáo/slide sau 28/10.
 *        Gồm: ERD/kiến trúc/workflow, kết quả Validator, commit/PR list, cross-check Phước.
 *
 * Phụ thuộc: W6-Q3
 * Test runner: node:test (built-in, no external deps)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// ============================================================================
// Suite 1: Tư liệu bàn giao kỹ thuật — file tồn tại và đủ nội dung
// ============================================================================
describe('W6-Q4 S1: Tư liệu bàn giao kỹ thuật tồn tại', () => {
  const docs = [
    // Bộ tư liệu chính Quang
    'docs/report-inputs/quang/TECHNICAL_HANDOFF_W6Q4.md',
    // ERD và database
    'docs/database/ERD.md',
    'docs/database/DATA_DICTIONARY.md',
    // API contract
    'docs/api/openapi.json',
    // Workflow W3-Q1
    'docs/api/WORKFLOW_W3_Q1.md',
    // AI evaluation results
    'docs/ai/evaluation/evaluation_run_results.json',
    // Contributions Quang
    'docs/report-inputs/QUANG_CONTRIBUTIONS.md',
    // Release record và limitations từ W6-Q3
    'docs/report-inputs/RELEASE_RECORD_W6Q3.json',
    'docs/report-inputs/KNOWN_LIMITATIONS_W6Q3.md',
  ];

  for (const rel of docs) {
    it(`tư liệu tồn tại: ${rel}`, () => {
      const full = path.join(ROOT, rel);
      assert.ok(
        fs.existsSync(full),
        `File bàn giao không tìm thấy: ${rel}`
      );
    });
  }
});

// ============================================================================
// Suite 2: TECHNICAL_HANDOFF_W6Q4.md — nội dung đủ cho báo cáo
// ============================================================================
describe('W6-Q4 S2: TECHNICAL_HANDOFF — nội dung đủ cho báo cáo/slide', () => {
  let content;
  before(() => {
    const p = path.join(ROOT, 'docs/report-inputs/quang/TECHNICAL_HANDOFF_W6Q4.md');
    content = fs.readFileSync(p, 'utf8');
  });

  it('có phần ERD / sơ đồ CSDL', () => {
    assert.match(content, /ERD|sơ đồ|schema|app\.achievements/i,
      'Thiếu phần ERD/CSDL');
  });

  it('có danh sách migration 001–009', () => {
    assert.match(content, /001.*002|migration.*009|009.*drift/i,
      'Thiếu danh sách migration đầy đủ');
  });

  it('có phần kiến trúc stack (React/Express/Supabase)', () => {
    assert.match(content, /React|Express|Supabase|pg.*8|Vite/i,
      'Thiếu phần kiến trúc stack');
  });

  it('có phần workflow state machine', () => {
    assert.match(content, /DRAFT.*SUBMITTED|SUBMITTED.*VERIFIED|state.*machine|workflow/i,
      'Thiếu phần workflow state machine');
  });

  it('có kết quả AI Validator holdout với nhãn offline', () => {
    assert.match(content, /holdout|32.*ca|100%.*32|Evaluator.*Only|offline/i,
      'Thiếu kết quả AI Validator holdout');
  });

  it('kết quả AI có nhãn offline, không suy rộng là LLM live', () => {
    assert.match(content, /offline|không phải LLM|không suy rộng|rule engine/i,
      'Phải ghi nhãn rõ evaluator offline');
  });

  it('có danh sách commit của Quang với commit SHA', () => {
    assert.match(content, /[0-9a-f]{7,}|W1-Q1|W5-Q2|W6-Q1/i,
      'Thiếu danh sách commit với SHA');
  });

  it('có phần kiểm chéo nội dung Phước', () => {
    assert.match(content, /Phước|cross.*check|kiểm chéo|CONTRIBUTIONS/i,
      'Thiếu phần kiểm chéo nội dung Phước');
  });

  it('có Q&A kỹ thuật chuẩn bị', () => {
    assert.match(content, /Q:|Q&A|câu hỏi|ADR-001|OCC|auth/i,
      'Thiếu phần Q&A kỹ thuật');
  });

  it('ghi nhận trạng thái PR remote chưa xác minh', () => {
    assert.match(content, /PR remote|NOT_VERIFIED|chưa.*URL|github.*pulls/i,
      'Phải ghi rõ PR remote chưa xác minh');
  });

  it('KPI gắn nhãn mô phỏng', () => {
    assert.match(content, /KPI.*mô phỏng|MÔ PHỎNG|SIMULATED/i,
      'KPI phải gắn nhãn mô phỏng');
  });

  it('không tuyên bố AI trao thưởng (câu khẳng định dương)', () => {
    const lines = content.split('\n');
    const badLines = lines.filter(l =>
      /AI.*tự.*trao thưởng|AI.*ban hành.*quyết định/i.test(l) &&
      !/không|hỗ trợ|gợi ý/i.test(l)
    );
    assert.strictEqual(badLines.length, 0,
      `Phát hiện tuyên bố AI trao thưởng: ${badLines.join(' | ')}`);
  });
});

// ============================================================================
// Suite 3: QUANG_CONTRIBUTIONS.md — đúng phiên bản W6-Q4 cập nhật
// ============================================================================
describe('W6-Q4 S3: QUANG_CONTRIBUTIONS — đủ mục W6', () => {
  let content;
  before(() => {
    const p = path.join(ROOT, 'docs/report-inputs/QUANG_CONTRIBUTIONS.md');
    content = fs.readFileSync(p, 'utf8');
  });

  it('có mục W5-Q2 (holdout benchmark)', () => {
    assert.match(content, /W5-Q2|holdout|benchmark/i,
      'Thiếu mục W5-Q2 trong contributions');
  });

  it('có mục W5-Q3 hoặc W5-Q4', () => {
    assert.match(content, /W5-Q3|W5-Q4|backup|restore|RC/i,
      'Thiếu mục W5-Q3/Q4 trong contributions');
  });

  it('có số liệu AI với nhãn nguồn rõ ràng', () => {
    assert.match(content, /offline|mô phỏng|SIMULATED|không.*LLM|Evaluator.Only/i,
      'Số liệu AI phải có nhãn nguồn rõ');
  });
});

// ============================================================================
// Suite 4: AI evaluation results — cấu trúc và nhãn
// ============================================================================
describe('W6-Q4 S4: evaluation_run_results.json — cấu trúc hợp lệ', () => {
  let evalDir;
  before(() => {
    evalDir = path.join(ROOT, 'docs/ai/evaluation');
  });

  it('thư mục docs/ai/evaluation tồn tại', () => {
    assert.ok(fs.existsSync(evalDir), 'Thiếu thư mục docs/ai/evaluation');
  });

  it('evaluation_run_results.json tồn tại và parse được', () => {
    const p = path.join(evalDir, 'evaluation_run_results.json');
    assert.ok(fs.existsSync(p), 'Thiếu evaluation_run_results.json');
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    assert.ok(parsed, 'File không parse được JSON');
  });
});

// ============================================================================
// Suite 5: Cross-check Phước — không override công việc người khác
// ============================================================================
describe('W6-Q4 S5: Cross-check Phước — không ghi đè file của Phước', () => {
  it('CONTRIBUTIONS.md Phước vẫn tồn tại và không rỗng', () => {
    const p = path.join(ROOT, 'docs/report-inputs/CONTRIBUTIONS.md');
    assert.ok(fs.existsSync(p), 'CONTRIBUTIONS.md Phước bị xóa!');
    const stat = fs.statSync(p);
    assert.ok(stat.size > 100, 'CONTRIBUTIONS.md Phước bị làm rỗng!');
  });

  it('PR_REVIEW.md Phước vẫn tồn tại và không rỗng', () => {
    const p = path.join(ROOT, 'docs/report-inputs/PR_REVIEW.md');
    assert.ok(fs.existsSync(p), 'PR_REVIEW.md Phước bị xóa!');
    const stat = fs.statSync(p);
    assert.ok(stat.size > 100, 'PR_REVIEW.md Phước bị làm rỗng!');
  });

  it('verification.json Phước vẫn tồn tại và không rỗng', () => {
    const p = path.join(ROOT, 'docs/report-inputs/verification.json');
    assert.ok(fs.existsSync(p), 'verification.json Phước bị xóa!');
    const stat = fs.statSync(p);
    assert.ok(stat.size > 100, 'verification.json Phước bị làm rỗng!');
  });

  it('CHECKLIST.md Phước vẫn tồn tại', () => {
    const p = path.join(ROOT, 'docs/report-inputs/CHECKLIST.md');
    assert.ok(fs.existsSync(p), 'CHECKLIST.md Phước bị xóa!');
  });

  it('thư mục quang/ không ghi đè bất kỳ file gốc của Phước', () => {
    const quangDir = path.join(ROOT, 'docs/report-inputs/quang');
    const quangFiles = fs.existsSync(quangDir)
      ? fs.readdirSync(quangDir, { recursive: true })
      : [];
    const phuocFiles = ['CONTRIBUTIONS.md', 'PR_REVIEW.md', 'CHECKLIST.md',
      'verification.json', 'ASSETS.md', 'README.md', 'REPORT_AND_SLIDES.md'];
    for (const qf of quangFiles) {
      const base = path.basename(qf.toString());
      assert.ok(!phuocFiles.includes(base),
        `File quang/${base} trùng tên với file Phước — nguy cơ ghi đè`);
    }
  });
});
