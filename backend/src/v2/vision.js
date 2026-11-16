import config from '../config/env.js';

/**
 * Trích xuất thông tin bằng khen/chứng nhận từ buffer file ảnh/PDF bằng AI Vision
 * Hỗ trợ Groq Vision (llama-3.2-11b-vision-preview) và Google Gemini (gemini-1.5-flash).
 * Luôn fallback an toàn về chế độ nhập tay (success: true, fallback: true) nếu không có API key hoặc gặp sự cố.
 */
export async function extractCertificateInfo({ buffer, mimetype = 'image/jpeg', originalname = '' }) {
  const groqKey = process.env.GROQ_API_KEY || config.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY;

  if (!buffer || buffer.length === 0) {
    return {
      success: true,
      data: null,
      fallback: true,
      message: 'Không có nội dung tệp tin để trích xuất. Vui lòng tự nhập thông tin.',
    };
  }

  // 1. Kiểm tra API Key: Nếu không có cấu hình key -> fallback nhẹ nhàng ngay
  if (!groqKey && !geminiKey) {
    return {
      success: true,
      data: null,
      fallback: true,
      message: 'Chưa cấu hình API Key AI Vision (GROQ_API_KEY / GEMINI_API_KEY). Vui lòng tự nhập thông tin bằng khen/chứng chỉ.',
    };
  }

  const promptText = `Bạn là trợ lý AI chuyên trích xuất thông tin bằng khen, giấy chứng nhận thành tích, quyết định khen thưởng giáo dục đại học.
Hãy đọc nội dung từ hình ảnh/tài liệu đính kèm và trích xuất các thông tin sau.
Trả về DUY NHẤT một chuỗi JSON hợp lệ không có markdown backticks (không dùng \`\`\`json):
{
  "title": "Tên thành tích hoặc bằng khen (ví dụ: Chiến sĩ thi đua cấp cơ sở)",
  "recognitionYear": 2025,
  "issueDate": "YYYY-MM-DD",
  "issuer": "Đơn vị hoặc chức danh người ký cấp (ví dụ: Hiệu trưởng Trường Đại học Lạc Hồng)",
  "decisionNumber": "Số quyết định khen thưởng (ví dụ: 123/QĐ-ĐHLH hoặc null)",
  "category": "TEACHING|SCIENTIFIC_RESEARCH|COMMUNITY_SERVICE|OTHER"
}`;

  const base64Data = buffer.toString('base64');
  const timeoutMs = config.AI_TIMEOUT_MS || 15000;

  try {
    // 2. Thử gọi Groq Vision nếu có GROQ_API_KEY
    if (groqKey) {
      try {
        const groqModel = config.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview';
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: promptText },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimetype};base64,${base64Data}`,
                    },
                  },
                ],
              },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) {
          const body = await response.json();
          const rawContent = body.choices?.[0]?.message?.content;
          if (rawContent) {
            const parsed = parseExtractedJson(rawContent);
            if (parsed) {
              return {
                success: true,
                data: parsed,
                fallback: false,
                message: 'Trích xuất thông tin bằng khen thành công từ AI Vision.',
              };
            }
          }
        }
      } catch (groqErr) {
        console.warn('[AI Vision] Groq vision extraction failed, trying fallback:', groqErr.message);
      }
    }

    // 3. Thử gọi Google AI Studio (Gemini) nếu có GEMINI_API_KEY
    if (geminiKey) {
      try {
        const geminiModel = config.GEMINI_MODEL || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inline_data: {
                      mime_type: mimetype,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.1,
            },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) {
          const body = await response.json();
          const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = parseExtractedJson(text);
            if (parsed) {
              return {
                success: true,
                data: parsed,
                fallback: false,
                message: 'Trích xuất thông tin bằng khen thành công từ Gemini Vision.',
              };
            }
          }
        }
      } catch (geminiErr) {
        console.warn('[AI Vision] Gemini vision extraction failed:', geminiErr.message);
      }
    }

    // 4. Nếu các API không parse được dữ liệu hợp lệ -> fallback an toàn
    return {
      success: true,
      data: null,
      fallback: true,
      message: 'Không thể tự động đọc thông tin minh chứng. Vui lòng tự nhập thông tin vào biểu mẫu.',
    };
  } catch (err) {
    console.warn('[AI Vision Ingest Service] Unexpected error handled with fallback:', err.message);
    return {
      success: true,
      data: null,
      fallback: true,
      message: 'Không thể tự động đọc thông tin minh chứng. Vui lòng tự nhập thông tin vào biểu mẫu.',
    };
  }
}

function parseExtractedJson(rawText) {
  try {
    let clean = rawText.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    clean = clean.trim();

    const data = JSON.parse(clean);
    const currentYear = new Date().getFullYear();
    const year = Number(data.recognitionYear) || currentYear;

    return {
      title: typeof data.title === 'string' ? data.title.trim() : '',
      recognitionYear: Number.isInteger(year) && year >= 1990 && year <= 2100 ? year : currentYear,
      issueDate: data.issueDate && typeof data.issueDate === 'string' ? data.issueDate : null,
      issuer: data.issuer && typeof data.issuer === 'string' ? data.issuer.trim() : null,
      decisionNumber: data.decisionNumber && typeof data.decisionNumber === 'string' ? data.decisionNumber.trim() : null,
      category: ['TEACHING', 'SCIENTIFIC_RESEARCH', 'COMMUNITY_SERVICE', 'OTHER'].includes(data.category)
        ? data.category
        : 'OTHER',
    };
  } catch {
    return null;
  }
}

export default {
  extractCertificateInfo,
};
