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

Bình luận nổi bật:
{{topComments}}

Kho HOOK đã có sẵn (mỗi dòng là 1 công thức hook đã được duyệt):
{{hookLibrary}}

Kho PAIN POINT đã có sẵn (mỗi dòng là 1 nỗi đau khách hàng đã được duyệt):
{{painPointLibrary}}

Nhiệm vụ: Phân tích video này và trả kết quả CHỈ dưới dạng JSON theo đúng schema sau, không thêm markdown, không giải thích ngoài JSON:
{
  "hook": "Mô tả 3 giây đầu tiên khiến người xem dừng lại xem tiếp",
  "structure": [ { "timeRange": "vd 0-3s", "content": "mô tả diễn biến tại mốc thời gian này" } ],
  "production": "Mô tả cách quay/dựng: góc máy, ánh sáng, nhạc nền, hiệu ứng, tốc độ cắt cảnh",
  "viralHypothesis": "Giả thuyết vì sao video này viral: yếu tố tâm lý, pain point chạm đúng, xu hướng đang hot, v.v.",
  "cta": "Call-to-action được sử dụng trong video (nếu có)",
  "transcript": "Bản ghi lời thoại/giọng đọc trong video (nếu có dữ liệu)",
  "knowledgeMatch": {
    "hookEntryId": "id (lấy đúng trong ngoặc [id=...] của kho HOOK ở trên) khớp nhất với hook của video này, hoặc chuỗi rỗng \"\" nếu KHÔNG có gì khớp tốt",
    "hookNewName": "chuỗi rỗng nếu hookEntryId đã có giá trị. Nếu hookEntryId rỗng VÀ video này thể hiện 1 công thức hook RÕ RÀNG, khác biệt hẳn với mọi entry trong kho -> đặt tên ngắn gọn cho công thức mới này, ngược lại để rỗng",
    "hookNewDescription": "mô tả công thức hook mới (chỉ điền nếu hookNewName có giá trị)",
    "hookNewExample": "trích 1 câu ví dụ THẬT từ chính video này minh hoạ cho hook mới (chỉ điền nếu hookNewName có giá trị)",
    "painPointEntryId": "id khớp nhất trong kho PAIN POINT, hoặc chuỗi rỗng \"\" nếu không khớp",
    "painPointNewName": "cùng quy tắc như hookNewName nhưng cho nỗi đau khách hàng mà video này đang khai thác",
    "painPointNewDescription": "mô tả nỗi đau mới (chỉ điền nếu painPointNewName có giá trị)",
    "painPointNewExample": "trích dẫn/tình huống THẬT từ video minh hoạ nỗi đau này (chỉ điền nếu painPointNewName có giá trị)",
    "discCode": "\"D\", \"I\", \"S\", \"C\", hoặc chuỗi rỗng \"\" - kiểu tính cách khách hàng mà cách thuyết phục của video này đang nhắm tới rõ nhất (D=quyết đoán/số liệu/kết quả nhanh, I=cảm xúc/câu chuyện/xã hội, S=an toàn/ổn định/không thích bị thúc ép, C=phân tích/dữ liệu/chứng nhận chi tiết). Để rỗng nếu video không thể hiện rõ 1 kiểu nào."
  },
  "valueComments": [
    { "text": "trích ĐÚNG NGUYÊN VĂN 1 bình luận trong danh sách Bình luận nổi bật ở trên", "reason": "vì sao bình luận này đáng lưu vào kho để tái dùng cho kịch bản SẢN PHẨM KHÁC sau này (VD: hài hước, đồng cảm sâu sắc, câu chữ bắt trend, phù hợp làm caption/trả lời comment)" }
  ]
}

QUAN TRỌNG: KHÔNG tự bịa hookEntryId/painPointEntryId không có trong 2 kho ở trên. CHỈ đề xuất entry mới (*NewName) khi video THỰC SỰ thể hiện 1 công thức/nỗi đau khác biệt rõ rệt, không phải biến thể nhỏ của entry đã có.

Về valueComments: CHỈ chọn 0-3 bình luận THỰC SỰ đặc sắc, có thể tái dùng cho kịch bản của SẢN PHẨM KHÁC (không chỉ riêng sản phẩm trong video này) - không phải mọi video đều có bình luận đáng lưu, để mảng rỗng [] nếu không có. TUYỆT ĐỐI trích ĐÚNG NGUYÊN VĂN từ danh sách Bình luận nổi bật ở trên, KHÔNG diễn giải lại, KHÔNG bịa bình luận không có trong danh sách.`,
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

Danh sách combo (hook + pain point + kiểu khách hàng DISC) đã được người phụ trách xác nhận cho TỪNG kịch bản, dựa trên xu hướng thực tế vừa quét được từ TikTok:
{{comboContext}}

Kho "value comment" - bình luận THẬT từng thấy ở các video khác (có thể của sản phẩm khác), đã được đánh giá là đặc sắc/dễ tái dùng:
{{valueCommentBank}}
Nếu 1 comment trong kho trên PHÙ HỢP TỰ NHIÊN với sản phẩm/kịch bản đang viết (không gượng ép, không sai ngữ cảnh), có thể khéo léo lồng cảm hứng từ nó vào caption hoặc 1 câu thoại trong body (đừng copy nguyên văn nếu nó nhắc tên sản phẩm khác). Nếu không có comment nào phù hợp, bỏ qua kho này, KHÔNG cố gượng ép.

Nhiệm vụ: Sinh ra ĐÚNG {{scriptCount}} ý tưởng (idea) và {{scriptCount}} kịch bản (script) tương ứng, theo ĐÚNG THỨ TỰ danh sách combo ở trên - kịch bản thứ i BẮT BUỘC bám sát combo thứ i (KHÔNG tự đổi thứ tự, KHÔNG gộp/tách, KHÔNG tự thêm hay bớt kịch bản). Với mỗi kịch bản:
- hook (3 giây đầu) PHẢI thể hiện ĐÚNG công thức hook được chỉ định trong combo của nó.
- body (nội dung chính) PHẢI khai thác ĐÚNG pain point được chỉ định, viết bằng giọng văn/lý lẽ thuyết phục phù hợp với kiểu khách hàng DISC được chỉ định (VD: kiểu D cần số liệu/kết quả nhanh, kiểu I cần cảm xúc/câu chuyện, kiểu S cần sự an toàn/không thúc ép, kiểu C cần dữ liệu/chứng nhận chi tiết).
- Nếu 1 phần của combo ghi "KHÔNG chỉ định" thì bạn được tự do sáng tạo phần đó, miễn hợp lý với sản phẩm.
- cta (kêu gọi hành động) khớp với giọng văn đã chọn ở trên.

Đây là kịch bản VIDEO SHORT (15-60 giây), KHÔNG phải kịch bản livestream - viết ngắn gọn, súc tích, đi thẳng vào 1 thông điệp chính, không dàn trải nhiều round như live.

Về số liệu (liều dùng, độ tuổi, giá, xuất xứ, chứng nhận): CHỈ dùng đúng số liệu có trong "Thông tin sản phẩm" ở trên, TUYỆT ĐỐI không tự bịa hoặc suy đoán con số không có trong đó. Nếu sản phẩm có "Lưu ý an toàn/khi nào cần hỏi bác sĩ", cân nhắc lồng ghép tự nhiên vào cta hoặc cuối body ở kịch bản phù hợp (không bắt buộc ở tất cả).

RÀNG BUỘC CỨNG (không được vi phạm trong bất kỳ kịch bản nào): {{dontList}}

Trả kết quả CHỈ dưới dạng JSON array gồm ĐÚNG {{scriptCount}} phần tử theo ĐÚNG thứ tự combo ở trên, không thêm markdown, không giải thích ngoài JSON. Mỗi phần tử có cấu trúc:
{
  "title": "tiêu đề ngắn gọn cho idea",
  "hook": "câu/đoạn mở đầu 3 giây theo đúng công thức hook được chỉ định",
  "body": [
    { "tStart": 0, "tEnd": 3, "voiceover": "lời thoại/giọng đọc", "visual": "mô tả hình ảnh lên màn hình", "textOnScreen": "chữ hiện trên màn hình nếu có, để rỗng nếu không có" }
  ],
  "cta": "kêu gọi hành động cuối video",
  "caption": "caption đăng kèm video (không lặp hashtag ở đây)",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "shotList": ["mô tả cảnh quay 1", "mô tả cảnh quay 2"],
  "learnedFrom": ["@handle nếu học pattern trực tiếp từ 1 video cụ thể trong bối cảnh xu hướng ở trên, để mảng rỗng nếu không"],
  "confidence": "high, medium hoặc low - tự đánh giá dựa trên độ tin cậy của nguồn dữ liệu (video/comment) bạn dựa vào"
}`,
    aiModel: '',
    temperature: 0.8,
  },
];
