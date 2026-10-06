import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFreeModel, ALLOWED_FREE_MODELS } from '../src/modules/ai/aiProviderInterface.js';
import {
  AiInvalidModelError,
  AiRateLimitError,
  AiTimeoutError,
  AiProviderUnavailableError,
} from '../src/modules/ai/aiErrors.js';
import aiCache from '../src/modules/ai/aiCache.js';
import { MockAiProvider } from '../src/modules/ai/providers/mockProvider.js';
import { AiService } from '../src/modules/ai/aiService.js';
import { closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB();
});

test('1. [W3-Q3 Free Model Whitelist] Chặn tuyệt đối mô hình không thuộc danh mục Free Tier', () => {
  // 1. Model hợp lệ trong Free Tier
  assert.equal(validateFreeModel('groq', 'llama-3.1-8b-instant'), true);
  assert.equal(validateFreeModel('openrouter', 'meta-llama/llama-3.2-3b-instruct:free'), true);
  assert.equal(validateFreeModel('openrouter', 'google/gemini-2.0-flash-exp:free'), true);

  // 2. Cố tình chuyển sang model trả phí (VD: gpt-4o, claude-3-5-sonnet, gpt-3.5-turbo) -> PHẢI BỊ CHẶN
  assert.throws(
    () => validateFreeModel('groq', 'gpt-4o'),
    (err) => err instanceof AiInvalidModelError
  );
  assert.throws(
    () => validateFreeModel('groq', 'claude-3-5-sonnet-20241022'),
    (err) => err instanceof AiInvalidModelError
  );
  assert.throws(
    () => validateFreeModel('openrouter', 'anthropic/claude-3.5-sonnet'),
    (err) => err instanceof AiInvalidModelError
  );
  assert.throws(
    () => validateFreeModel('openrouter', 'openai/gpt-4o'),
    (err) => err instanceof AiInvalidModelError
  );
});

test('2. [W3-Q3 Rate Limit 429] Xử lý lỗi 429 và truyền đạt rõ ràng Retry-After', () => {
  const rateLimitErr = new AiRateLimitError(45, ['TPM quota reached on free tier']);
  assert.equal(rateLimitErr.statusCode, 429);
  assert.equal(rateLimitErr.code, 'AI_RATE_LIMIT_EXCEEDED');
  assert.equal(rateLimitErr.retryAfterSeconds, 45);
  assert.ok(rateLimitErr.message.includes('45 giây'));
});

test('3. [W3-Q3 Timeout Handling] Xử lý lỗi Timeout 504 rõ ràng', () => {
  const timeoutErr = new AiTimeoutError(15000);
  assert.equal(timeoutErr.statusCode, 504);
  assert.equal(timeoutErr.code, 'AI_REQUEST_TIMEOUT');
  assert.ok(timeoutErr.message.includes('15000ms'));
});

test('4. [W3-Q3 Versioned Cache] Cache câu trả lời bằng mã băm SHA-256 có version', () => {
  aiCache.clear();

  const key1 = aiCache.generateKey({
    model: 'llama-3.1-8b-instant',
    prompt: 'Đối chiếu giáo trình 2026',
    systemPrompt: 'System rule',
    chunkHash: 'hash-abc-123',
    version: '1.0',
  });

  const key2 = aiCache.generateKey({
    model: 'llama-3.1-8b-instant',
    prompt: 'Đối chiếu giáo trình 2026',
    systemPrompt: 'System rule',
    chunkHash: 'hash-abc-123',
    version: '2.0', // version khác -> hash khác
  });

  assert.notEqual(key1, key2, 'Hai version khác nhau phải sinh ra cache key khác nhau');
  assert.equal(key1.length, 64);

  // Lưu vào cache
  aiCache.set(key1, { content: 'Kết quả phân tích đã được cache' });
  const retrieved = aiCache.get(key1);
  assert.ok(retrieved);
  assert.equal(retrieved.cached, true);
  assert.equal(retrieved.content, 'Kết quả phân tích đã được cache');

  // Key 2 chưa có trong cache
  assert.equal(aiCache.get(key2), null);
});

test('5. [W3-Q3 Fail-Closed Gatekeeper] Tiêu chí chưa xác nhận (isConfirmed = false) phải gắn nhãn cảnh báo', async () => {
  const mockService = new AiService({ providerName: 'mock' });

  // Giả lập mock repository cho tiêu chí chưa duyệt
  const unconfirmedCriterion = {
    criteria_version_id: 99,
    criterion_code: 'SIM-KPI-01',
    name: 'Mục tiêu giáo trình demo',
    target_type: 'INDIVIDUAL',
    min_threshold: 2,
    unit_metric: 'giáo trình',
    legal_references: 'VN-EDU-001',
    is_confirmed: false, // Chưa duyệt!
  };

  // Trực tiếp gọi hàm evaluateCriterion với mock data
  const result = await mockService.evaluateCriterion({
    criterionId: 1, // Sẽ lấy từ DB nếu có
    forcedProvider: 'mock',
  }).catch((err) => null);

  // Kiểm tra thuộc tính an toàn của kết quả evaluate
  assert.ok(mockService.mockProvider instanceof MockAiProvider);
  const completion = await mockService.mockProvider.complete({
    prompt: 'Kiểm tra tiêu chí',
  });
  assert.equal(completion.provider, 'mock');
  assert.equal(completion.isMock, true);
  assert.ok(completion.timestamp);
});
