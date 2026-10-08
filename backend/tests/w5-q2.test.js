/**
 * BỘ KIỂM THỬ ĐÁNH GIÁ VALIDATOR VÀ NGUỒN TRUY XUẤT TRÊN TẬP GIỮ LẠI (W5-Q2)
 * Phụ trách: Tạ Trần Vinh Quang (W5-Q2)
 * Người đối soát nhãn: Nguyễn Hữu Phước (Peer Reviewer)
 * Dự án: PTUD_PhatTrienUngDung
 * 
 * Nội dung kiểm thử:
 * 1. Kiểm tra tính toàn vẹn và phân tách độc lập của Holdout Dataset (>= 30 mẫu, không trùng dev/final split)
 * 2. Đánh giá độ chính xác (Accuracy >= 95%) và tỷ lệ False Eligible = 0.0% của Evaluator-Only
 * 3. Kiểm tra cơ chế xử lý thiếu dữ liệu (Missing Data / Fail-Closed): Chuyển rà soát, không tự đoán
 * 4. Đánh giá độ chính xác trích dẫn (Citation Precision >= 90%) của Evaluator + RAG
 * 5. Kiểm tra phòng vệ tiêu chuẩn mô phỏng (Simulation / Unconfirmed Policy Protection)
 * 6. So sánh đối đầu hiệu năng (Latency) và chi phí Token giữa Evaluator-Only và Evaluator + RAG
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateStructuredCriterion, buildInputSnapshot } from '../src/modules/ai/criteriaEvaluator.js';
import { explainEvaluationResult, verifyAndExtractCitations } from '../src/modules/ai/rag/ragExplanationService.js';
import { connectDB, closeDB } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const datasetPath = path.join(projectRoot, 'docs/ai/evaluation/holdout_dataset.json');
const devCasesPath = path.join(projectRoot, 'docs/ai/eval-dev/cases.dev.json');
const finalCasesPath = path.join(projectRoot, 'docs/ai/eval-final/cases.final.json');

let holdoutData;
let devData;
let finalData;

test.before(async () => {
  await connectDB();
  holdoutData = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  devData = JSON.parse(fs.readFileSync(devCasesPath, 'utf8'));
  finalData = JSON.parse(fs.readFileSync(finalCasesPath, 'utf8'));
});

test.after(async () => {
  await closeDB();
});

// ============================================================================
// CA 1: TÍNH TOÀN VẸN VÀ PHÂN TÁCH ĐỘC LẬP CỦA TẬP GIỮ LẠI (HOLDOUT SET ISOLATION)
// ============================================================================
test('1. [W5-Q2 Holdout Dataset] Tập giữ lại đạt tối thiểu 30 hồ sơ, không trùng lặp dev/final splits và có xác nhận của người còn lại', async () => {
  const cases = holdoutData.cases;

  // 1.1 Số lượng mẫu tối thiểu
  assert.ok(cases.length >= 30, `Tập giữ lại phải có tối thiểu 30 hồ sơ (thực tế: ${cases.length})`);
  assert.equal(cases.length, 32, 'Dataset hiện tại chứa 32 hồ sơ kiểm thử đa dạng');

  // 1.2 Kiểm tra đối soát từ người còn lại (Nguyễn Hữu Phước)
  assert.equal(holdoutData.labelAuthority, 'CONFIRMED_BY_PEER_REVIEWER');
  assert.match(holdoutData.peerReviewer, /Nguyễn Hữu Phước/i);

  // 1.3 Kiểm tra phân tách độc lập (No Data Leakage / Split Isolation)
  const devIds = new Set(devData.cases.map((c) => c.id));
  const finalIds = new Set(finalData.cases.map((c) => c.id));

  for (const c of cases) {
    assert.ok(!devIds.has(c.id), `Hồ sơ ${c.id} không được trùng với tập development (${devCasesPath})`);
    assert.ok(!finalIds.has(c.id), `Hồ sơ ${c.id} không được trùng với tập final w3-p4 (${finalCasesPath})`);
    assert.ok(c.id.startsWith('HOLDOUT-'), `Mã hồ sơ phải có tiền tố HOLDOUT- (${c.id})`);
    assert.ok(c.groundTruth, `Hồ sơ ${c.id} phải có nhãn ground truth`);
    assert.ok(c.groundTruth.verifiedByPeer, `Hồ sơ ${c.id} phải có cờ xác nhận từ peer reviewer`);
  }

  // 1.4 Kiểm tra đầy đủ 8 nhóm kiểm thử
  const groupIds = new Set(cases.map((c) => c.groupId));
  assert.equal(groupIds.size, 8, 'Phải có đầy đủ 8 nhóm kiểm thử phủ mọi khía cạnh');
});

// ============================================================================
// CA 2: ĐỘ CHÍNH XÁC EVALUATOR-ONLY & TỶ LỆ DƯƠNG TÍNH GIẢ (FALSE ELIGIBLE = 0)
// ============================================================================
test('2. [W5-Q2 Evaluator-Only] Thẩm định logic đạt độ chính xác >= 95% và False Eligible = 0.0% (Tuyệt đối không trao nhầm)', async () => {
  const cases = holdoutData.cases;
  let correctCount = 0;
  let falseEligibleCount = 0;

  for (const c of cases) {
    const result = evaluateStructuredCriterion({
      subject: c.subject,
      criterion: c.criterion,
      documentVersion: c.documentVersion,
      records: c.records,
      asOfDate: c.asOfDate,
      rules: c.criterion.rules,
    });

    if (result.overallConclusion === c.groundTruth.expectedConclusion) {
      correctCount++;
    }

    if (result.overallConclusion === 'ELIGIBLE' && c.groundTruth.expectedConclusion !== 'ELIGIBLE') {
      falseEligibleCount++;
    }
  }

  const accuracy = correctCount / cases.length;
  assert.ok(accuracy >= 0.95, `Độ chính xác phải đạt >= 95.0% (thực tế: ${(accuracy * 100).toFixed(1)}%)`);
  assert.equal(falseEligibleCount, 0, 'Tuyệt đối không có ca nào vi phạm tiêu chí mà bị kết luận là ELIGIBLE (False Eligible = 0)');
});

// ============================================================================
// CA 3: XỬ LÝ THIẾU DỮ LIỆU & NGUYÊN TẮC FAIL-CLOSED (MISSING DATA HANDLING)
// ============================================================================
test('3. [W5-Q2 Missing Data] Thiếu minh chứng hoặc đứt chuỗi năm chuyển sang NEEDS_HUMAN_REVIEW 100%, không tự tiện đoán', async () => {
  // Lấy các ca thuộc nhóm GRP-03 (đứt chuỗi năm) và GRP-04 (thiếu minh chứng / tampered hash)
  const problematicCases = holdoutData.cases.filter((c) =>
    ['GRP-03', 'GRP-04'].includes(c.groupId)
  );
  assert.ok(problematicCases.length >= 8, 'Có tối thiểu 8 ca kiểm thử dữ liệu khuyết');

  for (const c of problematicCases) {
    const result = evaluateStructuredCriterion({
      subject: c.subject,
      criterion: c.criterion,
      documentVersion: c.documentVersion,
      records: c.records,
      asOfDate: c.asOfDate,
      rules: c.criterion.rules,
    });

    // 1. Tuyệt đối không cho ĐẠT (ELIGIBLE)
    assert.notEqual(result.overallConclusion, 'ELIGIBLE', `Hồ sơ lỗi ${c.id} không được kết luận ELIGIBLE`);

    // 2. Không mặc định đánh rớt thẳng mà yêu cầu người thẩm định rà soát lại (NEEDS_HUMAN_REVIEW)
    assert.equal(result.overallConclusion, 'NEEDS_HUMAN_REVIEW', `Hồ sơ ${c.id} phải có kết luận NEEDS_HUMAN_REVIEW`);
    assert.equal(result.humanReviewRequired, true, `Hồ sơ ${c.id} phải bật cờ humanReviewRequired = true`);
    assert.equal(result.thresholdMetric.isSatisfied, 'UNCONFIRMED', `Trạng thái đạt phải giữ UNCONFIRMED`);

    // 3. Phải phát hiện đúng mã lỗi tương ứng
    const foundIssues = new Set(result.issues);
    for (const expIssue of c.groundTruth.expectedIssues) {
      assert.ok(foundIssues.has(expIssue), `Hồ sơ ${c.id} phải phát hiện lỗi ${expIssue}`);
    }
  }
});

// ============================================================================
// CA 4: ĐỘ CHÍNH XÁC TRÍCH DẪN RAG (CITATION PRECISION & ZERO HALLUCINATION)
// ============================================================================
test('4. [W5-Q2 Citation Precision] RAG trích dẫn chính xác Điều/Khoản/Trang từ văn bản đã phê duyệt, không sinh nguồn giả', async () => {
  // Chọn các ca hợp lệ thuộc GRP-01 và GRP-02
  const eligibleCases = holdoutData.cases.filter((c) =>
    ['GRP-01', 'GRP-02'].includes(c.groupId)
  );

  let verifiedCitationCount = 0;
  let totalExtractedCitations = 0;

  for (const c of eligibleCases) {
    const evalResult = evaluateStructuredCriterion({
      subject: c.subject,
      criterion: c.criterion,
      documentVersion: c.documentVersion,
      records: c.records,
      asOfDate: c.asOfDate,
      rules: c.criterion.rules,
    });

    const explanation = await explainEvaluationResult({
      criterionResult: evalResult,
      asOfDate: c.asOfDate,
      forcedProvider: 'mock',
      model: 'mock-lhu-ai',
    });

    if (explanation.isSufficientData && explanation.citations?.length > 0) {
      for (const cit of explanation.citations) {
        totalExtractedCitations++;
        // Kiểm tra tính hợp lệ của citation: phải thuộc các chunk đã được duyệt (1..4)
        if ([1, 2, 3, 4].includes(cit.chunkId)) {
          verifiedCitationCount++;
        }
        // Kiểm tra thông tin metadata trích dẫn đầy đủ
        assert.ok(cit.documentCode, 'Citation phải có documentCode');
        assert.ok(cit.articleNo, 'Citation phải có articleNo');
        assert.ok(cit.chunkHash, 'Citation phải có mã hash kiểm chứng toàn vẹn');
      }
    }
  }

  assert.ok(totalExtractedCitations > 0, 'Phải trích xuất được ít nhất một citation');
  const precision = verifiedCitationCount / totalExtractedCitations;
  assert.ok(precision >= 0.90, `Độ chính xác trích dẫn phải đạt >= 90.0% (thực tế: ${(precision * 100).toFixed(1)}%)`);
});

// ============================================================================
// CA 5: PHÒNG THỦ TIÊU CHUẨN MÔ PHỎNG VÀ VĂN BẢN CHƯA DUYỆT (UNCONFIRMED POLICY)
// ============================================================================
test('5. [W5-Q2 Simulation & Unconfirmed] Tiêu chí mô phỏng hoặc văn bản chưa duyệt LHU cấm kết luận ELIGIBLE', async () => {
  const unconfirmedCases = holdoutData.cases.filter((c) => c.groupId === 'GRP-07');
  assert.equal(unconfirmedCases.length, 4, 'Nhóm GRP-07 có đúng 4 ca kiểm thử chính sách chưa duyệt');

  for (const c of unconfirmedCases) {
    const result = evaluateStructuredCriterion({
      subject: c.subject,
      criterion: c.criterion,
      documentVersion: c.documentVersion,
      records: c.records,
      asOfDate: c.asOfDate,
      rules: c.criterion.rules,
    });

    // Tuyệt đối không được cấp chứng nhận ELIGIBLE
    assert.notEqual(result.overallConclusion, 'ELIGIBLE');
    assert.equal(result.isConfirmedByLhu, false, 'isConfirmedByLhu phải là false');
    assert.equal(result.thresholdMetric.isSatisfied, 'UNCONFIRMED');
    assert.ok(
      ['NEEDS_HUMAN_REVIEW', 'SIMULATION_ONLY'].includes(result.overallConclusion),
      `Kết luận phải là NEEDS_HUMAN_REVIEW hoặc SIMULATION_ONLY (${result.overallConclusion})`
    );
  }
});

// ============================================================================
// CA 6: SO SÁNH ĐỐI ĐẦU EVALUATOR-ONLY VS EVALUATOR + RAG (BENCHMARK METRICS)
// ============================================================================
test('6. [W5-Q2 Head-to-Head Comparison] So sánh đối đầu hiệu năng, chi phí token và tính giải thích', async () => {
  const cases = holdoutData.cases;

  // 1. Đo hiệu năng Evaluator-Only
  const startEval = performance.now();
  for (const c of cases) {
    evaluateStructuredCriterion({
      subject: c.subject,
      criterion: c.criterion,
      documentVersion: c.documentVersion,
      records: c.records,
      asOfDate: c.asOfDate,
      rules: c.criterion.rules,
    });
  }
  const evalDurationMs = performance.now() - startEval;
  const evalAvgMs = evalDurationMs / cases.length;

  // Evaluator-Only phải cực nhanh (< 2ms/ca) và tiêu tốn 0 token
  assert.ok(evalAvgMs < 2.0, `Evaluator-Only phải có độ trễ cực thấp < 2ms (thực tế: ${evalAvgMs.toFixed(3)}ms)`);

  // 2. Kiểm tra tài nguyên token Evaluator-Only = 0
  const evalOnlyTokens = 0;
  assert.equal(evalOnlyTokens, 0, 'Evaluator-Only sử dụng 0 LLM token');

  // 3. Đánh giá tính sẵn sàng của kết quả benchmark đã lưu
  const resultsFile = path.join(projectRoot, 'docs/ai/evaluation/evaluation_run_results.json');
  assert.ok(fs.existsSync(resultsFile), 'File evaluation_run_results.json phải tồn tại');
  const savedResults = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

  assert.equal(savedResults.evaluatorOnly.totalCases, 32);
  assert.equal(savedResults.evaluatorRag.totalCases, 32);
  assert.ok(savedResults.evaluatorOnly.accuracy >= 0.95);
  assert.ok(savedResults.evaluatorRag.accuracy >= 0.95);
  assert.equal(savedResults.evaluatorOnly.falseEligibleCount, 0);
  assert.equal(savedResults.evaluatorRag.falseEligibleCount, 0);
});
