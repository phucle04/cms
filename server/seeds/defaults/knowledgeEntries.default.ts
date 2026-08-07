import type { KnowledgeStoreType, DiscCode } from '../../models/KnowledgeEntry';

/**
 * 4 entry DISC nền tảng (D/I/S/C) - đây là 4 kiểu tính cách CHUẨN của mô hình
 * DISC nên seed sẵn ngay từ đầu (khác kho hook/pain_point vốn không có "bộ
 * chuẩn" cố định, để trống cho người dùng tự nhập/upload). File này CHỈ chứa
 * dữ liệu thuần, không gọi DB - dùng bởi server/seeds/index.ts.
 */
export interface DefaultKnowledgeEntryDef {
  storeType: KnowledgeStoreType;
  name: string;
  description: string;
  example?: string;
  discCode?: DiscCode;
}

export const defaultKnowledgeEntries: DefaultKnowledgeEntryDef[] = [
  {
    storeType: 'disc',
    discCode: 'D',
    name: 'D - Dominance (Quyết đoán)',
    description:
      'Thích đi thẳng vào kết quả, không dài dòng. Ưu tiên số liệu cụ thể, so sánh trước/sau, lợi ích rõ ràng. CTA cần mạnh, dứt khoát, tạo cảm giác kiểm soát được quyết định (VD "chốt ngay hôm nay").',
    example: 'Bé nhà mình hết mồ hôi trộm sau đúng 2 tuần - đây là cách mẹ làm.',
  },
  {
    storeType: 'disc',
    discCode: 'I',
    name: 'I - Influence (Cảm xúc/Xã hội)',
    description:
      'Thích câu chuyện, cảm xúc, được truyền cảm hứng. Bị thuyết phục bởi trải nghiệm người khác (social proof), lời khen từ cộng đồng mẹ bỉm. Giọng văn gần gũi, nhiều cảm thán, kể chuyện thật.',
    example: 'Cả hội mẹ bỉm trong group đều rỉ tai nhau về sản phẩm này...',
  },
  {
    storeType: 'disc',
    discCode: 'S',
    name: 'S - Steadiness (Ổn định/An toàn)',
    description:
      'Thích cảm giác an toàn, ổn định, ngại thay đổi/rủi ro. Cần được trấn an nhẹ nhàng, không thích bị thúc ép mua gấp. Nhấn mạnh sự an toàn, đã được nhiều mẹ dùng lâu dài, không có tác dụng phụ.',
    example: 'Mẹ cứ yên tâm dùng thử, không vội, sản phẩm đã được hàng ngàn mẹ tin dùng lâu năm rồi.',
  },
  {
    storeType: 'disc',
    discCode: 'C',
    name: 'C - Conscientiousness (Phân tích/Dữ liệu)',
    description:
      'Thích phân tích kỹ, cần dữ liệu/chứng nhận/nguồn gốc rõ ràng, chi tiết kỹ thuật. Không bị thuyết phục bởi lời quảng cáo cảm tính - cần thành phần, cơ chế hoạt động, kết quả kiểm nghiệm cụ thể.',
    example: 'Sản phẩm đạt chứng nhận FSSC 22000, mỗi lô đều có COA kiểm nghiệm độc lập, đây là bảng thành phần chi tiết...',
  },
];
