import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDB, closeDB } from '../src/config/database.js';
import * as regulationRepo from '../src/modules/regulations/regulationRepository.js';
import aiService from '../src/modules/ai/aiService.js';

let pool;
let targetChunk;

test.before(async () => {
  pool = await connectDB();
  // Lấy 1 chunk thực tế đã được nạp từ W3-Q2
  const doc = await regulationRepo.findDocumentByCode(null, 'VN-LAW-002');
  if (doc) {
    const versions = await regulationRepo.listVersionsByDocumentId(null, doc.document_id);
    if (versions.length > 0) {
      const chunks = await regulationRepo.listChunksByVersionId(null, versions[0].version_id);
      targetChunk = chunks[0];
    }
  }
});

test.after(async () => {
  await closeDB();
});

test('1. [W3-Q3 Smoke Test Real DB Chunk] Thực hiện smoke test trả lời từ trích đoạn CSDL', async () => {
  assert.ok(targetChunk, 'Bắt buộc phải tìm thấy trích đoạn quy định thực tế từ W3-Q2 trong CSDL');
  assert.ok(targetChunk.chunk_id);
  assert.ok(targetChunk.content);
  assert.equal(targetChunk.chunk_hash.length, 64, 'Chunk phải có hash SHA-256 64 ký tự hex');

  const question = 'Tóm tắt nguyên tắc khen thưởng được quy định trong trích đoạn này?';
  const result = await aiService.executeSmokeTest({
    chunkId: targetChunk.chunk_id,
    question,
  });

  // Nghiệm thu hợp đồng kỹ thuật W3-Q3:
  assert.equal(result.success, true);
  assert.equal(result.chunkId, targetChunk.chunk_id);
  assert.equal(result.chunkHash, targetChunk.chunk_hash);
  assert.ok(result.aiResponse && result.aiResponse.length > 10, 'AI phải sinh ra câu trả lời có ý nghĩa');
  assert.ok(result.model, 'Phải ghi nhận model phục vụ');
  assert.ok(result.provider, 'Phải ghi nhận provider phục vụ');
  assert.ok(result.timestamp, 'Phải ghi nhận thời điểm gọi');
  assert.ok(typeof result.latencyMs === 'number', 'Phải đo lường độ trễ mạng (latencyMs)');
  assert.ok(result.usage, 'Phải ghi nhận định mức sử dụng tokens');

  console.log('----------------------------------------------------');
  console.log('📋 KẾT QUẢ SMOKE TEST W3-Q3 TỪ TRÍCH ĐOẠN QUY ĐỊNH THẬT:');
  console.log(`- Provider: ${result.provider} (Mock: ${result.isMock})`);
  console.log(`- Model: ${result.model}`);
  console.log(`- Thời điểm: ${result.timestamp}`);
  console.log(`- Độ trễ: ${result.latencyMs}ms`);
  console.log(`- Tokens: Prompt=${result.usage.promptTokens}, Completion=${result.usage.completionTokens}, Total=${result.usage.totalTokens}`);
  console.log(`- Trích đoạn: ${result.articleNo || ''} ${result.clauseNo || ''}`);
  console.log(`- Nội dung AI:\n${result.aiResponse}`);
  console.log('----------------------------------------------------');
});

test('2. [W3-Q3 Smoke Test Cache] Gọi lại cùng trích đoạn và câu hỏi phải trả về từ cache', async () => {
  const question = 'Tóm tắt nguyên tắc khen thưởng được quy định trong trích đoạn này?';
  const cachedResult = await aiService.executeSmokeTest({
    chunkId: targetChunk.chunk_id,
    question,
  });

  assert.equal(cachedResult.cached, true, 'Yêu cầu trùng lặp phải được trả về từ cache');
  assert.equal(cachedResult.chunkId, targetChunk.chunk_id);
});
