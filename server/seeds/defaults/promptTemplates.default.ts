import { PromptTemplateKey } from '../../models/PromptTemplate';

/**
 * Nội dung PromptTemplate mặc định (isSystemSeed=true) cho 3 bước của pipeline
 * research: gợi ý hashtag, phân tích video viral, sinh idea+script. File này
 * CHỈ chứa dữ liệu thuần, không gọi DB - dùng chung bởi:
 *  - server/seeds/index.ts (seed lần đầu / upsert)
 *  - server/controllers/promptTemplateController.ts (reset-default)
 * để tránh 2 nguồn sự thật lệch nhau.
 *
 * userPromptTemplate dùng placeholder dạng {{tenBien}}, được service ở
 * Giai đoạn 2+ thay thế bằng dữ liệu thật trước khi gửi cho Gemini.
 */

export interface DefaultPromptTemplateDef {
  key: PromptTemplateKey;
  name: string;
  niche: string;
  systemPrompt: string;
  userPromptTemplate: string;
  // Tên "aiModel" để khớp với field IPromptTemplate.aiModel (xem lý do đổi
  // tên trong server/models/PromptTemplate.ts).
  aiModel: string;
  temperature: number;
}

export const defaultPromptTemplates: DefaultPromptTemplateDef[] = [
  {
    key: 'hashtag',
    name: 'Gợi ý hashtag TikTok mặc định',
    niche: 'Mẹ & bé',
    systemPrompt:
      'Bạn là chuyên gia social media marketing ngành hàng mẹ & bé tại thị trường Việt Nam, am hiểu xu hướng TikTok và hành vi tìm kiếm của các mẹ bỉm sữa Việt Nam.',
    userPromptTemplate: `Sản phẩm: {{productName}}
Ngành hàng: {{productCategory}}
Thương hiệu: {{brandName}}
USP (điểm bán hàng độc nhất): {{usp}}
Pain point khách hàng: {{painPoints}}
Đối tượng mục tiêu: {{targetAudience}}

Nhiệm vụ: Gợi ý 8-12 hashtag TikTok tiếng Việt phù hợp để tăng khả năng tiếp cận đúng đối tượng mẹ bỉm sữa Việt Nam.

Yêu cầu:
- Trộn đủ 3 loại: hashtag rộng (nhiều traffic, ví dụ #tiktokmemvabe), hashtag ngách (đúng đối tượng, theo tên sản phẩm/ngành), hashtag theo pain point (ví dụ #concaobiengan, #meobema).
- Ưu tiên hashtag mẹ bỉm sữa Việt Nam thực sự hay dùng, không bịa hashtag không tồn tại.
- Với mỗi hashtag, giải thích ngắn gọn lý do chọn (reason) và chấm điểm mức độ phù hợp từ 0-100 (score).
- Trả kết quả CHỈ dưới dạng JSON array, mỗi phần tử có đúng 3 field: tag, reason, score. Không thêm markdown, không giải thích ngoài JSON.`,
    aiModel: '',
    temperature: 0.9,
  },
  {
    key: 'video_analysis',
    name: 'Phân tích video viral mặc định',
    niche: 'Mẹ & bé',
    systemPrompt:
      'Bạn là chuyên gia phân tích nội dung video ngắn viral trên TikTok, có kinh nghiệm nhận diện công thức hook, nhịp kể chuyện, và yếu tố khiến video lan truyền trong ngành hàng mẹ & bé tại Việt Nam.',
    userPromptTemplate: `Dưới đây là thông tin về một video TikTok đang viral trong ngành mẹ & bé:
Caption: {{caption}}
Số lượt xem: {{playCount}}
Số lượt thích: {{diggCount}}
Transcript/phụ đề (nếu có): {{transcript}}

Nhiệm vụ: Phân tích video này và trả kết quả CHỈ dưới dạng JSON theo đúng schema sau, không thêm markdown, không giải thích ngoài JSON:
{
  "hook": "Mô tả 3 giây đầu tiên khiến người xem dừng lại xem tiếp",
  "structure": [ { "timeRange": "vd 0-3s", "content": "mô tả diễn biến tại mốc thời gian này" } ],
  "production": "Mô tả cách quay/dựng: góc máy, ánh sáng, nhạc nền, hiệu ứng, tốc độ cắt cảnh",
  "viralHypothesis": "Giả thuyết vì sao video này viral: yếu tố tâm lý, pain point chạm đúng, xu hướng đang hot, v.v.",
  "cta": "Call-to-action được sử dụng trong video (nếu có)",
  "transcript": "Bản ghi lời thoại/giọng đọc trong video (nếu có dữ liệu)"
}`,
    aiModel: '',
    temperature: 0.4,
  },
  {
    key: 'script_gen',
    name: 'Sinh 5 ý tưởng + kịch bản mặc định',
    niche: 'Mẹ & bé',
    systemPrompt:
      'Bạn là Content Strategist cấp cao chuyên viết kịch bản TikTok ngắn cho ngành hàng mẹ & bé tại Việt Nam, hiểu sâu tâm lý mẹ bỉm sữa và các quy định quảng cáo sản phẩm dinh dưỡng trẻ em.',
    userPromptTemplate: `Thông tin sản phẩm:
{{productContext}}

Thông tin thương hiệu:
- Tên: {{brandName}}
- Tone giọng: {{toneOfVoice}}
- BẮT BUỘC KHÔNG được vi phạm (dontList): {{dontList}}
- BẮT BUỘC tuân thủ (doList): {{doList}}
- Lưu ý pháp lý: {{complianceNotes}}

Bối cảnh xu hướng/đối thủ (nếu có): {{trendContext}}

Nhiệm vụ: Sinh ra ĐÚNG 5 ý tưởng (idea) và 5 kịch bản (script) tương ứng, mỗi ý tưởng phải đại diện cho MỘT GÓC TIẾP CẬN (angle) khác nhau rõ rệt về mặt nghiệp vụ, không phải 5 biến thể của cùng một ý. Bắt buộc dùng đủ 5 angle sau, mỗi angle đúng 1 idea:
1. Review trải nghiệm thật (như một khách hàng/mẹ bỉm đã dùng sản phẩm)
2. Giải đáp một FAQ cụ thể mà mẹ hay thắc mắc
3. So sánh trước/sau khi dùng sản phẩm
4. Storytelling xuất phát từ nỗi lo lắng thật của mẹ
5. Unbox/hướng dẫn sử dụng sản phẩm

Với mỗi idea, viết kịch bản gồm 3 phần rõ ràng: hook (3 giây đầu), body (nội dung chính), cta (kêu gọi hành động).

RÀNG BUỘC CỨNG (không được vi phạm trong bất kỳ kịch bản nào): {{dontList}}

Trả kết quả CHỈ dưới dạng JSON array gồm đúng 5 phần tử, không thêm markdown, không giải thích ngoài JSON. Mỗi phần tử có cấu trúc:
{
  "angle": "một trong 5 góc tiếp cận ở trên",
  "title": "tiêu đề ngắn gọn cho idea",
  "hook": "...",
  "body": "...",
  "cta": "..."
}`,
    aiModel: '',
    temperature: 0.8,
  },
];
