/**
 * Nội dung BrandProfile mặc định cho thương hiệu "Thảo Nguyên" (bán lẻ mẹ & bé).
 * File này CHỈ chứa dữ liệu thuần, không gọi DB - được import bởi
 * server/seeds/index.ts (seed) để giữ một nguồn sự thật duy nhất.
 */

export interface DefaultBrandProfileDef {
  brandName: string;
  tagline: string;
  industry: string;
  targetAudience: {
    ageRange: string;
    gender: string;
    roles: string[];
    painPoints: string[];
  };
  toneOfVoice: string;
  doList: string[];
  dontList: string[];
  complianceNotes: string;
  storeInfo: {
    branches: unknown[];
    hotline: string;
    website: string;
    currentPromotions: string[];
  };
  isActive: boolean;
}

export const defaultBrandProfile: DefaultBrandProfileDef = {
  brandName: 'Thảo Nguyên',
  tagline: 'Đồng hành cùng mẹ trong hành trình nuôi con khôn lớn',
  industry: 'Bán lẻ mẹ & bé',
  targetAudience: {
    ageRange: '25-38',
    gender: 'Nữ',
    roles: ['Mẹ bỉm sữa', 'Người chăm sóc chính trong gia đình'],
    painPoints: [
      'Sợ chọn sai sữa/sản phẩm cho con',
      'Con biếng ăn, táo bón, khó ngủ',
      'Không biết tin nguồn thông tin nào',
      'Lo mua phải hàng giả, hàng kém chất lượng',
      'Ngân sách chi tiêu cho con có hạn',
    ],
  },
  toneOfVoice:
    'Thân thiện, gần gũi, đáng tin cậy - như một người chị đã có kinh nghiệm nuôi con chia sẻ thật lòng. Không hù doạ, không phán xét mẹ, không dùng ngôn từ đao to búa lớn.',
  doList: [
    "Dùng ngôn ngữ đời thường, xưng hô 'mẹ ơi', 'các mẹ'",
    'Chia sẻ trải nghiệm, câu chuyện thật',
    'Đưa bằng chứng cụ thể (đánh giá, số liệu, chứng nhận) khi có',
    'Khuyến khích mẹ tự tìm hiểu, tham khảo ý kiến bác sĩ khi cần',
    'Luôn đặt lợi ích và sự an toàn của bé lên hàng đầu',
  ],
  // dontList là ràng buộc CỨNG mang tính pháp lý/compliance, không phải sở
  // thích - service sinh script ở Giai đoạn 2+ PHẢI nhúng nguyên văn danh
  // sách này vào prompt như một constraint bắt buộc.
  dontList: [
    'Không nói hoặc ám chỉ sản phẩm có thể thay thế sữa mẹ',
    "Không hứa hẹn chữa bệnh; không dùng từ ngữ y khoa như 'điều trị', 'khỏi bệnh', 'chữa khỏi'",
    'Không nêu tên hoặc so sánh trực tiếp với đối thủ cạnh tranh',
    'Không dùng hình ảnh, lời nói, trang phục của nhân viên y tế/bác sĩ để quảng cáo sản phẩm',
    "Không cam kết kết quả tuyệt đối (ví dụ: 'chắc chắn tăng cân', '100% hết táo bón')",
  ],
  complianceNotes:
    'Nhắc nhở nội bộ: sản phẩm dinh dưỡng cho trẻ nhỏ tại Việt Nam chịu quy định quảng cáo riêng (xem Nghị định 100/2014/NĐ-CP và các văn bản sửa đổi/hướng dẫn liên quan), đặc biệt với sản phẩm dùng cho trẻ dưới 24 tháng tuổi. Đây không phải tư vấn pháp lý đầy đủ - mọi kịch bản, hình ảnh, nội dung liên quan đến sản phẩm PHẢI được người phụ trách duyệt nội dung xem và phê duyệt trước khi đăng tải công khai.',
  storeInfo: {
    branches: [],
    hotline: '',
    website: '',
    currentPromotions: [],
  },
  isActive: true,
};
