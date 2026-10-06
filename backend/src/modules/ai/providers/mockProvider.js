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
    let content = `[MOCK-AI-OUTPUT] Phân tích dựa trên trích đoạn quy định đã cung cấp:\n`;
    content += `- Căn cứ trích dẫn: Phù hợp với điều khoản quy định.\n`;
    content += `- Kết luận sơ bộ: Dữ liệu hồ sơ thỏa mãn các điều kiện tiên quyết trong trích đoạn.\n`;
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
