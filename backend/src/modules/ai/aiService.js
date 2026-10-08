import config from '../../config/env.js';
import { GroqProvider } from './providers/groqProvider.js';
import { OpenRouterProvider } from './providers/openrouterProvider.js';
import { MockAiProvider } from './providers/mockProvider.js';
import { validateFreeModel } from './aiProviderInterface.js';
import aiCache from './aiCache.js';
import { AiRateLimitError, AiTimeoutError, AiProviderUnavailableError } from './aiErrors.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import * as regulationRepo from '../regulations/regulationRepository.js';
import * as evaluationRepo from './evaluationRepository.js';
import { evaluateStructuredCriterion, buildInputSnapshot, buildEvaluationRunObject } from './criteriaEvaluator.js';
import { evaluationRunSchema } from './evaluationSchemas.js';
import achievementService from '../achievements/achievementService.js';
import { getPool } from '../../config/database.js';
import { query } from '../../utils/dbHelper.js';
import { isUnitInUserScope, getActiveRoles } from '../auth/authRepository.js';
import { ForbiddenError, OutOfScopeError } from '../../utils/errors.js';

export class AiService {
  constructor(options = {}) {
    this.regulations = options.regulations || regulationRepo;
    this.evaluationRepo = options.evaluationRepo || evaluationRepo;
    this.readAchievement = options.readAchievement || achievementService.getAchievementById;
    this.providerName = options.providerName || config.AI_PROVIDER;
    this.groqProvider = new GroqProvider(options.groqApiKey || config.GROQ_API_KEY, options.groqModel || config.GROQ_MODEL);
    this.openrouterProvider = new OpenRouterProvider(options.openrouterApiKey || config.OPENROUTER_API_KEY, options.openrouterModel || config.OPENROUTER_MODEL);
    this.mockProvider = new MockAiProvider(options.mockModel || 'mock-lhu-ai');
  }

  getProvider(forcedProvider) {
    const target = forcedProvider || this.providerName;
    if (target === 'groq') {
      if (this.groqProvider.apiKey) return this.groqProvider;
      console.warn('⚠️ GROQ_API_KEY chưa cấu hình, fallback sang MockAiProvider cho môi trường kiểm thử');
      return this.mockProvider;
    }
    if (target === 'openrouter') {
      if (this.openrouterProvider.apiKey) return this.openrouterProvider;
      console.warn('⚠️ OPENROUTER_API_KEY chưa cấu hình, fallback sang MockAiProvider cho môi trường kiểm thử');
      return this.mockProvider;
    }
    return this.mockProvider;
  }

  async completeWithRetry({ prompt, systemPrompt, model, forcedProvider, chunkHash = '', version = '1.0', requireRealProvider = false }) {
    const targetProvider = forcedProvider || this.providerName;
    if (model) {
      validateFreeModel(targetProvider, model);
    }
    if (requireRealProvider && !(
      (targetProvider === 'groq' && this.groqProvider.apiKey) ||
      (targetProvider === 'openrouter' && this.openrouterProvider.apiKey)
    )) throw new AiProviderUnavailableError(targetProvider, 'Cần key server-only; không dùng mock fallback');
    const provider = this.getProvider(forcedProvider);
    // Validate defaults before cache lookup; cache must never bypass the free-model gate.
    validateFreeModel(provider.name, model || provider.defaultModel);
    const cacheKey = aiCache.generateKey({
      model: model || provider.defaultModel,
      prompt,
      systemPrompt,
      chunkHash,
      version: `${provider.name}:${version}`,
    });

    // 1. Kiểm tra Cache
    const cached = aiCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Gọi Provider có giới hạn số lần retry
    let lastError = null;
    const maxRetries = config.AI_MAX_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.AI_TIMEOUT_MS);

        try {
          const result = await provider.complete({
            prompt,
            systemPrompt,
            model,
            signal: controller.signal,
          });

          // Lưu cache nếu thành công
          aiCache.set(cacheKey, result);
          return { ...result, cached: false };
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        lastError = err;
        // Nếu là Rate Limit (429) hoặc Timeout, không spam retry vô ích
        if (err.name === 'AiRateLimitError') {
          throw err;
        }
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Không thể hoàn thành yêu cầu gọi AI');
  }

  /**
   * Smoke test: Gọi model AI trả lời câu hỏi dựa trên đoạn trích dẫn (Chunk) quy định thực tế
   */
  async executeSmokeTest({ chunkId, question, provider: forcedProvider, model }) {
    if (!chunkId) {
      throw new ValidationError('Mã trích đoạn (chunkId) là bắt buộc cho smoke test');
    }

    const chunk = await this.regulations.findChunkById(null, chunkId);
    if (!chunk) {
      throw new NotFoundError(`Không tìm thấy trích đoạn quy định với ID #${chunkId}`);
    }
    await this.assertConfirmedVersion(chunk.version_id);

    const systemPrompt = `Bạn là trợ lý AI chuyên môn của Hội đồng Thi đua - Khen thưởng Trường Đại học Lạc Hồng.
Nhiệm vụ của bạn là trả lời các câu hỏi dựa CHÍNH XÁC trên đoạn trích dẫn quy phạm pháp luật / quy chế sau đây.
Không được bịa đặt hoặc suy diễn vượt quá nội dung trích đoạn.`;

    const prompt = `[TRÍCH ĐOẠN QUY ĐỊNH]
Điều/Khoản: ${chunk.article_no || ''} ${chunk.clause_no || ''} (Trang ${chunk.page_no || 'N/A'})
Nội dung: """${chunk.content}"""
Mã băm toàn vẹn: ${chunk.chunk_hash}

[CÂU HỎI KIỂM THỬ]
${question || 'Tóm tắt các điểm then chốt trong trích đoạn trên và đối tượng áp dụng là ai?'}`;

    const completion = await this.completeWithRetry({
      prompt,
      systemPrompt,
      model,
      forcedProvider,
      chunkHash: chunk.chunk_hash,
      version: 'smoke-test-v1',
    });

    return {
      success: true,
      chunkId,
      articleNo: chunk.article_no,
      clauseNo: chunk.clause_no,
      chunkHash: chunk.chunk_hash,
      question: question || 'Tóm tắt các điểm then chốt trong trích đoạn trên',
      aiResponse: completion.content,
      model: completion.model,
      provider: completion.provider,
      isMock: Boolean(completion.isMock),
      usage: completion.usage,
      latencyMs: completion.latencyMs,
      timestamp: completion.timestamp,
      cached: Boolean(completion.cached),
    };
  }

  /**
   * Đánh giá tiêu chí khen thưởng dựa trên hồ sơ thành tích và quy chế
   */
  async assertConfirmedVersion(versionId) {
    const version = await this.regulations.findVersionById(null, versionId);
    if (!version?.is_confirmed || version.lhu_application_status !== 'CONFIRMED_LHU_POLICY') {
      throw new ValidationError('Nguồn chưa được xác nhận áp dụng tại LHU; không gửi tới AI');
    }
    const day = value => value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10);
    const today = new Date().toISOString().slice(0,10);
    if (!version.effective_from || day(version.effective_from) > today || (version.effective_to && day(version.effective_to) < today)) {
      throw new ValidationError('Nguồn ngoài thời gian hiệu lực; cần người có thẩm quyền chốt phiên bản');
    }
    return version;
  }

  async evaluateCriterion({ criterionId, achievementId, forcedProvider, model }, user) {
    if (!achievementId) throw new ValidationError('Thiếu achievementId; không đánh giá hồ sơ khi thiếu dữ liệu');
    const achievement = await this.readAchievement(user, achievementId);
    if (achievement.status !== 'VERIFIED') throw new ValidationError('Hồ sơ chưa VERIFIED hoặc đã thu hồi; không gửi tới AI');
    const criterion = await this.regulations.findCriteriaVersionById(null, criterionId);
    if (!criterion) {
      throw new NotFoundError(`Không tìm thấy tiêu chí khen thưởng với ID #${criterionId}`);
    }

    if (!criterion.is_confirmed) throw new ValidationError('Tiêu chí chưa được xác nhận; không gửi tới AI');
    await this.assertConfirmedVersion(criterion.version_id);
    const target = achievement.subjectType === 'LECTURER' ? 'INDIVIDUAL' : 'COLLECTIVE';
    if (!['BOTH',target].includes(criterion.target_type)) throw new ValidationError('Tiêu chí không áp dụng cho chủ thể');

    // Fail-Closed Gatekeeper Check
    const isUnconfirmed = !criterion.is_confirmed;
    const warningNotice = isUnconfirmed
      ? 'CẢNH BÁO: Tiêu chuẩn này chưa được Hội đồng LHU phê duyệt chính thức (UNCONFIRMED / SIMULATION). Kết quả chỉ mang tính tham khảo mô phỏng.'
      : null;

    const systemPrompt = `Bạn là chuyên gia thẩm định hồ sơ thi đua khen thưởng độc lập.
Đối chiếu thành tích với tiêu chuẩn được giao và trích xuất kết quả dưới dạng nhận định khách quan.`;

    const prompt = `[TIÊU CHUẨN THẨM ĐỊNH]
Mã tiêu chí: ${criterion.criterion_code}
Tên tiêu chí: ${criterion.name}
Đối tượng: ${criterion.target_type}
Ngưỡng tối thiểu: ${criterion.min_threshold ?? 'Không quy định'} ${criterion.unit_metric || ''}
Căn cứ pháp lý: ${criterion.legal_references || 'Không có'}
Trạng thái duyệt LHU: ${criterion.is_confirmed ? 'ĐÃ PHÊ DUYỆT CHÍNH THỨC' : 'CHƯA DUYỆT / MÔ PHỎNG'}

[HỒ SƠ THÀNH TÍCH ĐỐI CHIẾU]
${`Mã: ${achievement.achievementId}, Tiêu đề: ${achievement.title}, Loại: ${achievement.achievementTypeId}, Trạng thái: ${achievement.status}`}

Hãy phân tích tính phù hợp và đưa ra kết luận.`;

    const completion = await this.completeWithRetry({
      prompt,
      systemPrompt,
      model,
      forcedProvider,
      chunkHash: criterion.criterion_code,
      version: 'eval-v1',
    });

    return {
      criterionId,
      criterionCode: criterion.criterion_code,
      criterionName: criterion.name,
      isConfirmed: criterion.is_confirmed,
      automaticAward: false, // TUYỆT ĐỐI không tự động trao thưởng
      warning: warningNotice,
      analysis: completion.content,
      model: completion.model,
      provider: completion.provider,
      isMock: Boolean(completion.isMock),
      timestamp: completion.timestamp,
      latencyMs: completion.latencyMs,
    };
  }

  async authorizeSubjectAccess(user, subjectType, subjectId, client = null) {
    if (!user) throw new ForbiddenError('Yêu cầu xác thực tài khoản');
    const roles = await getActiveRoles(user.userId);
    const roleCodes = roles.map((r) => (typeof r === 'string' ? r : r.Code || r.code));
    if (roleCodes.includes('ADMIN')) return true;

    const db = client ? client.query.bind(client) : query;

    if (subjectType === 'LECTURER') {
      const lecRes = await db('SELECT lecturer_id, user_id FROM app.lecturers WHERE lecturer_id = $1', [subjectId]);
      const lecturer = lecRes.rows[0];
      if (!lecturer) throw new NotFoundError('Không tìm thấy giảng viên');

      // Chính chủ
      if (Number(lecturer.user_id) === Number(user.userId)) return true;

      // MANAGER có scope trên đơn vị công tác của giảng viên
      if (roleCodes.includes('MANAGER')) {
        const assignRes = await db(
          `SELECT unit_id FROM app.lecturer_assignments 
           WHERE lecturer_id = $1 AND is_primary = TRUE 
             AND valid_from <= NOW() AND (valid_to IS NULL OR valid_to > NOW())`,
          [subjectId]
        );
        const unitId = assignRes.rows[0]?.unit_id;
        if (unitId && (await isUnitInUserScope(user.userId, unitId, 'MANAGER'))) {
          return true;
        }
      }
      throw new OutOfScopeError('Người ngoài scope không có quyền truy cập dữ liệu AI của giảng viên này');
    }

    if (subjectType === 'UNIT') {
      if (roleCodes.includes('MANAGER')) {
        const inScope = await isUnitInUserScope(user.userId, subjectId, 'MANAGER');
        if (inScope) return true;
      }
      if (roleCodes.includes('UNIT_REPRESENTATIVE')) {
        const inScope = await isUnitInUserScope(user.userId, subjectId, 'UNIT_REPRESENTATIVE');
        if (inScope) return true;
      }
      throw new OutOfScopeError('Người ngoài scope không có quyền truy cập dữ liệu AI của đơn vị này');
    }

    throw new ForbiddenError('Chủ thể không hợp lệ');
  }

  async evaluateStructured(
    {
      subjectType = 'LECTURER',
      subjectId,
      criteriaVersionIds = [],
      applicationId = null,
      kpiGoalId = null,
      asOfDate = new Date().toISOString().slice(0, 10),
      forcedProvider = 'mock',
      model = 'deterministic-evaluator-v1',
      rules = null,
      mockRecords = null,
    },
    user,
    client = null
  ) {
    if (!subjectId) throw new ValidationError('Mã chủ thể (subjectId) là bắt buộc');
    await this.authorizeSubjectAccess(user, subjectType, subjectId, client);

    const db = client ? client.query.bind(client) : query;

    // 1. Thu thập dữ liệu hồ sơ nguồn (Achievements + AwardRecords)
    let records = [];
    if (Array.isArray(mockRecords)) {
      records = mockRecords;
    } else {
      const achSql = `
        SELECT a.achievement_id AS id,
               'ACHIEVEMENT' AS type,
               a.lecturer_id, a.unit_id,
               COALESCE(a.recognition_year, EXTRACT(YEAR FROM a.achievement_date)::int) AS year,
               a.status,
               a.replaces_achievement_id AS "replacesRecordId",
               (
                 SELECT json_agg(json_build_object(
                   'id', ef.evidence_file_id,
                   'sha256', ef.sha256_hash,
                   'name', ef.original_file_name
                 ))
                 FROM app.evidences e
                 JOIN app.evidence_files ef ON ef.evidence_id = e.evidence_id
                 WHERE e.achievement_id = a.achievement_id AND e.is_removed = FALSE
               ) AS files
        FROM app.achievements a
        WHERE ${subjectType === 'LECTURER' ? 'a.lecturer_id = $1' : 'a.unit_id = $1'}
          AND a.status IN ('VERIFIED', 'RECORDED', 'REVOKED', 'CANCELLED')
      `;
      const achRes = await db(achSql, [subjectId]);

      const awardSql = `
        SELECT r.record_id AS id,
               'AWARD_RECORD' AS type,
               r.lecturer_id, r.unit_id,
               r.recognition_year AS year,
               r.status,
               r.replaces_award_record_id AS "replacesRecordId",
               (
                 SELECT json_agg(json_build_object(
                   'id', adf.decision_file_id,
                   'sha256', adf.sha256_hash,
                   'name', adf.original_file_name
                 ))
                 FROM app.award_decision_files adf
                 WHERE adf.decision_id = r.decision_id
               ) AS files
        FROM app.award_records r
        WHERE ${subjectType === 'LECTURER' ? 'r.lecturer_id = $1' : 'r.unit_id = $1'}
          AND r.status IN ('RECORDED', 'REVOKED')
      `;
      const awardRes = await db(awardSql, [subjectId]);

      const mapRow = (r) => ({
        id: Number(r.id),
        type: r.type,
        subjectId: Number(subjectType === 'LECTURER' ? r.lecturer_id : r.unit_id),
        year: Number(r.year),
        status: r.status,
        replacesRecordId: r.replacesRecordId ? Number(r.replacesRecordId) : null,
        file: Array.isArray(r.files) && r.files[0] ? r.files[0] : null,
        evidenceFiles: Array.isArray(r.files) ? r.files : [],
        hasEvidence: Array.isArray(r.files) && r.files.length > 0,
      });

      records = [...achRes.rows.map(mapRow), ...awardRes.rows.map(mapRow)];
    }

    // 2. Tải danh sách tiêu chí cần đánh giá
    let criteriaList = [];
    if (Array.isArray(criteriaVersionIds) && criteriaVersionIds.length > 0) {
      for (const cid of criteriaVersionIds) {
        const c = await this.regulations.findCriteriaVersionById(client, cid);
        if (c) criteriaList.push(c);
      }
    } else {
      criteriaList = await this.regulations.listCriteriaVersions(client, {
        confirmedOnly: false,
        targetType: subjectType === 'LECTURER' ? 'INDIVIDUAL' : 'COLLECTIVE',
      });
    }

    if (criteriaList.length === 0) {
      throw new ValidationError('Không tìm thấy tiêu chí nào phù hợp để đánh giá');
    }

    // 3. Thực thi evaluateStructuredCriterion cho từng tiêu chí
    const criterionResults = [];
    for (const crit of criteriaList) {
      const docVersion = await this.regulations.findVersionById(client, crit.version_id);
      if (!docVersion) continue;

      const evalResult = evaluateStructuredCriterion({
        subject: { subjectType, subjectId },
        criterion: {
          criteriaVersionId: crit.criteria_version_id,
          criterionCode: crit.criterion_code,
          name: crit.name,
          targetType: crit.target_type,
          minThreshold: crit.min_threshold,
          unitMetric: crit.unit_metric,
          isConfirmed: crit.is_confirmed,
          versionId: crit.version_id,
          legalReferences: crit.legal_references,
        },
        documentVersion: {
          versionId: docVersion.version_id,
          versionNumber: docVersion.version_number,
          sha256Hash: docVersion.sha256_hash,
          isConfirmed: docVersion.is_confirmed,
          lhuApplicationStatus: docVersion.lhu_application_status,
          effectiveFrom: docVersion.effective_from,
          effectiveTo: docVersion.effective_to,
          documentCode: docVersion.document_code,
        },
        records,
        asOfDate,
        rules,
      });
      criterionResults.push(evalResult);
    }

    // 4. Tạo input snapshot & SHA-256 hash
    const primaryCrit = criteriaList[0] || {};
    const docVersions = await Promise.all(
      criteriaList.map((c) => this.regulations.findVersionById(client, c.version_id))
    );
    const primaryDoc = docVersions[0] || {};
    const { snapshot, inputHash } = buildInputSnapshot({
      subject: { subjectType, subjectId },
      criterion: primaryCrit,
      documentVersion: primaryDoc,
      criteria: criteriaList,
      documentVersions: docVersions,
      records,
      asOfDate,
      rules,
    });

    // 5. Build EvaluationRun object
    const runObject = buildEvaluationRunObject({
      evaluationType: 'CRITERION_ASSESSMENT',
      subject: { subjectType, subjectId, kpiGoalId },
      providerInfo: {
        provider: forcedProvider || 'mock',
        model: model || 'deterministic-evaluator-v1',
        isMock: forcedProvider === 'mock' || !forcedProvider,
      },
      criterionResults,
    });

    // 6. Kiểm tra hợp đồng evaluationRunSchema
    evaluationRunSchema.parse(runObject);

    // 7. Lưu trữ vào CSDL
    const saved = await this.evaluationRepo.saveEvaluationRun(
      client,
      {
        ...runObject,
        applicationId,
        inputSnapshot: snapshot,
        inputHash,
        executedBy: user.userId,
      },
      criterionResults
    );

    return {
      ...runObject,
      runId: saved.run.run_id,
      inputSnapshot: snapshot,
      inputHash,
      applicationId: saved.run.application_id,
      executedBy: user.userId,
    };
  }

  async getEvaluationRun(runId, user, client = null) {
    if (!runId) throw new ValidationError('runId là bắt buộc');
    const run = await this.evaluationRepo.getEvaluationRunById(client, runId);
    if (!run) throw new NotFoundError(`Không tìm thấy phiên đánh giá #${runId}`);
    await this.authorizeSubjectAccess(user, run.targetSubject.subjectType, run.targetSubject.subjectId, client);
    return run;
  }

  async listEvaluations(filters = {}, user, client = null) {
    if (!user) throw new ForbiddenError('Yêu cầu xác thực tài khoản');
    const roles = await getActiveRoles(user.userId);
    const roleCodes = roles.map((r) => (typeof r === 'string' ? r : r.Code || r.code));
    const db = client ? client.query.bind(client) : query;

    if (roleCodes.includes('ADMIN') || roleCodes.includes('RECORDS_OFFICER')) {
      const { subjectType, subjectId } = filters;
      if (subjectId) {
        await this.authorizeSubjectAccess(user, subjectType || 'LECTURER', subjectId, client);
      }
      return this.evaluationRepo.listEvaluationRuns(client, filters);
    }

    if (filters.subjectId) {
      await this.authorizeSubjectAccess(user, filters.subjectType || 'LECTURER', filters.subjectId, client);
      return this.evaluationRepo.listEvaluationRuns(client, filters);
    }

    const lecRes = await db('SELECT lecturer_id FROM app.lecturers WHERE user_id = $1', [user.userId]);
    const lecturerId = lecRes.rows[0]?.lecturer_id;
    if (lecturerId) {
      return this.evaluationRepo.listEvaluationRuns(client, {
        ...filters,
        subjectType: 'LECTURER',
        subjectId: lecturerId,
      });
    }

    return [];
  }

  async checkEvaluationStale(runId, user, client = null) {
    if (!runId) throw new ValidationError('runId là bắt buộc');
    const run = await this.evaluationRepo.getEvaluationRunById(client, runId);
    if (!run) throw new NotFoundError(`Không tìm thấy phiên đánh giá #${runId}`);
    await this.authorizeSubjectAccess(user, run.targetSubject.subjectType, run.targetSubject.subjectId, client);

    const db = client ? client.query.bind(client) : query;
    const { subjectType, subjectId } = run.targetSubject;

    // Lấy lại các records hiện tại của chủ thể
    const achSql = `
      SELECT a.achievement_id AS id,
             'ACHIEVEMENT' AS type,
             a.lecturer_id, a.unit_id,
             COALESCE(a.recognition_year, EXTRACT(YEAR FROM a.achievement_date)::int) AS year,
             a.status,
             a.replaces_achievement_id AS "replacesRecordId",
             (
               SELECT json_agg(json_build_object(
                 'id', ef.evidence_file_id,
                 'sha256', ef.sha256_hash,
                 'name', ef.original_file_name
               ))
               FROM app.evidences e
               JOIN app.evidence_files ef ON ef.evidence_id = e.evidence_id
               WHERE e.achievement_id = a.achievement_id AND e.is_removed = FALSE
             ) AS files
      FROM app.achievements a
      WHERE ${subjectType === 'LECTURER' ? 'a.lecturer_id = $1' : 'a.unit_id = $1'}
        AND a.status IN ('VERIFIED', 'RECORDED', 'REVOKED', 'CANCELLED')
    `;
    const achRes = await db(achSql, [subjectId]);

    const awardSql = `
      SELECT r.record_id AS id,
             'AWARD_RECORD' AS type,
             r.lecturer_id, r.unit_id,
             r.recognition_year AS year,
             r.status,
             r.replaces_award_record_id AS "replacesRecordId",
             (
               SELECT json_agg(json_build_object(
                 'id', adf.decision_file_id,
                 'sha256', adf.sha256_hash,
                 'name', adf.original_file_name
               ))
               FROM app.award_decision_files adf
               WHERE adf.decision_id = r.decision_id
             ) AS files
      FROM app.award_records r
      WHERE ${subjectType === 'LECTURER' ? 'r.lecturer_id = $1' : 'r.unit_id = $1'}
        AND r.status IN ('RECORDED', 'REVOKED')
    `;
    const awardRes = await db(awardSql, [subjectId]);

    const mapRow = (r) => ({
      id: Number(r.id),
      type: r.type,
      subjectId: Number(subjectType === 'LECTURER' ? r.lecturer_id : r.unit_id),
      year: Number(r.year),
      status: r.status,
      replacesRecordId: r.replacesRecordId ? Number(r.replacesRecordId) : null,
      file: Array.isArray(r.files) && r.files[0] ? r.files[0] : null,
      evidenceFiles: Array.isArray(r.files) ? r.files : [],
      hasEvidence: Array.isArray(r.files) && r.files.length > 0,
    });

    const currentRecords = [...achRes.rows.map(mapRow), ...awardRes.rows.map(mapRow)];
    const savedSnapshot = run.inputSnapshot || {};

    const { inputHash: currentHash } = buildInputSnapshot({
      subject: run.targetSubject,
      criterion: savedSnapshot.criterion || {},
      documentVersion: savedSnapshot.documentVersion || {},
      criteria: savedSnapshot.criteria || [],
      documentVersions: savedSnapshot.documentVersions || [],
      records: currentRecords,
      asOfDate: savedSnapshot.asOfDate,
      rules: savedSnapshot.criterion?.rules || null,
    });

    const isStale = currentHash !== run.inputHash;
    if (isStale !== run.isStale) {
      await this.evaluationRepo.markRunStale(client, runId, isStale);
    }

    return {
      runId,
      isStale,
      savedHash: run.inputHash,
      currentHash,
      totalSavedRecords: savedSnapshot.records?.length || 0,
      totalCurrentRecords: currentRecords.length,
      reason: isStale
        ? 'Dữ liệu hồ sơ thành tích/khen thưởng của chủ thể đã thay đổi kể từ phiên đánh giá này'
        : 'Dữ liệu hồ sơ vẫn đồng nhất với thời điểm đánh giá',
    };
  }
}

export const aiService = new AiService();
export default aiService;
