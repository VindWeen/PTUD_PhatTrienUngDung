import { AiProvider } from '../aiProviderInterface.js';

export class MockAiProvider extends AiProvider {
  constructor(defaultModel = 'mock-evaluation-model') {
    super('mock');
    this.defaultModel = defaultModel;
  }

  async complete({
    prompt,
    systemPrompt,
    model,
    temperature,
    maxTokens,
    signal,
  }) {
    const startTime = Date.now();
    const selectedModel = model || this.defaultModel;

    // Giả lập độ trễ mạng ngắn
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Phân tích câu hỏi để sinh câu trả lời mock có tính logic
    const chunkMatches = [...new Set([...prompt.matchAll(/\[CHUNK_ID:\s*(\d+)\]/gi)].map(m => Number(m[1])))];
    let content = `[MOCK-AI-OUTPUT] Phân tích dựa trên trích đoạn quy định đã cung cấp:\n`;
    if (chunkMatches.length > 0) {
      content += `- Căn cứ theo các trích đoạn quy chế viện dẫn: ${chunkMatches.map(id => `[CHUNK_ID: ${id}]`).join(', ')}.\n`;
    }
    content += `- Provider mô phỏng không xác minh điều kiện hay tính phù hợp của hồ sơ.\n`;
    content += `- Cần người có thẩm quyền đối chiếu nguồn, phiên bản và minh chứng; không kết luận đủ điều kiện.\n`;
    content += `(Lưu ý: Đây là kết quả tạo bởi Mock Provider phục vụ kiểm thử đơn vị nội bộ, không thay thế cho gọi AI API thật)`;

    const usage = {
      promptTokens: Math.round(prompt.length / 4),
      completionTokens: Math.round(content.length / 4),
      totalTokens: Math.round((prompt.length + content.length) / 4),
    };

    return {
      content,
      model: selectedModel,
      provider: 'mock',
      isMock: true,
      usage,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  }
}
