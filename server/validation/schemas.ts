import { z } from 'zod';
import { MAX_VIDEO_SCAN_COUNT, MAX_SCRIPT_COUNT } from '../config/env';

/**
 * Schema zod cho các endpoint GHI dữ liệu chính đang được UI thật sử dụng
 * (G7, Giai đoạn 5). Chỉ validate hình dạng/kiểu dữ liệu - không validate
 * nghiệp vụ (nghiệp vụ như cổng tuổi vẫn nằm trong controller).
 */

export const createProductSchema = z.object({
  name: z.string().min(1, 'Tên sản phẩm không được để trống'),
  category: z.string().min(1, 'Ngành hàng không được để trống'),
  usp: z.string().min(1, 'USP không được để trống'),
  painPoints: z.string().optional(),
  faqContent: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  usageInstructions: z.string().optional(),
  originCountry: z.string().optional(),
  certifications: z.string().optional(),
  price: z.number().nonnegative().optional(),
  promoPrice: z.number().nonnegative().optional(),
  promotionOffer: z.string().optional(),
  safetyNotes: z.string().optional(),
  status: z.enum(['active', 'archived']).optional(),
  ageCategory: z.enum(['under_24m', '24m_plus', 'not_applicable']).optional(),
});

export const updateProductSchema = createProductSchema.partial();

const ideaStatusEnum = z.enum(['draft', 'new', 'in progress', 'done', 'discarded']);
const ideaPriorityEnum = z.enum(['low', 'medium', 'high']);

export const createIdeaSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được để trống'),
  description: z.string().min(1, 'Mô tả không được để trống'),
  source: z.string().min(1, 'Nguồn không được để trống'),
  priority: ideaPriorityEnum.optional(),
  productId: z.string().optional(),
  status: ideaStatusEnum.optional(),
});

export const updateIdeaSchema = createIdeaSchema.partial();

export const bulkUpdateIdeasSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'ids phải là mảng không rỗng'),
  status: ideaStatusEnum.optional(),
  priority: ideaPriorityEnum.optional(),
});

export const bulkUpdateScriptsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'ids phải là mảng không rỗng'),
  status: z.enum(['draft', 'approved', 'rejected']),
});

export const createResearchJobSchema = z.object({
  productId: z.string().min(1, 'Thiếu productId'),
  autoSelectTop3: z.boolean().optional(),
  videoScanCount: z.number().int().min(1, 'Tối thiểu 1 video').max(MAX_VIDEO_SCAN_COUNT, `Tối đa ${MAX_VIDEO_SCAN_COUNT} video`).optional(),
  scriptCount: z.number().int().min(1, 'Tối thiểu 1 kịch bản').max(MAX_SCRIPT_COUNT, `Tối đa ${MAX_SCRIPT_COUNT} kịch bản`).optional(),
  // Lọc video theo tuổi (tháng) - không giới hạn giá trị theo 1 tập cố định
  // (UI chỉ gợi ý preset 6/12/24/36) để không phải đổi cả FE lẫn BE nếu sau
  // này thêm preset khác. null/không truyền = không giới hạn.
  maxVideoAgeMonths: z.number().int().positive('maxVideoAgeMonths phải là số tháng dương').nullable().optional(),
});

export const selectHashtagsSchema = z.object({
  selectedHashtags: z
    .array(z.string().trim().min(1, 'hashtag không được để trống/toàn khoảng trắng'))
    .min(1, 'selectedHashtags phải là mảng không rỗng'),
});

const comboSchema = z.object({
  hookEntryId: z.string().nullable().optional(),
  painPointEntryId: z.string().nullable().optional(),
  discCode: z.enum(['D', 'I', 'S', 'C']).nullable().optional(),
});

export const selectCombosSchema = z.object({
  selectedCombos: z.array(comboSchema).min(1, 'selectedCombos phải là mảng không rỗng'),
});

const knowledgeStoreTypeEnum = z.enum(['hook', 'pain_point', 'disc']);

export const createKnowledgeEntrySchema = z.object({
  storeType: knowledgeStoreTypeEnum,
  name: z.string().min(1, 'Tên không được để trống'),
  description: z.string().min(1, 'Mô tả/công thức không được để trống'),
  example: z.string().optional(),
  discCode: z.enum(['D', 'I', 'S', 'C']).optional(),
});

export const updateKnowledgeEntrySchema = createKnowledgeEntrySchema.partial().extend({
  status: z.enum(['approved', 'pending']).optional(),
});

// scriptId có thì hookEntryId/painPointEntryId/discCode CÓ THỂ bị controller
// ghi đè bằng combo THẬT lấy từ Script gốc (xem videoKpiController.ts) - 3
// field này ở đây chỉ dùng khi không có scriptId, hoặc script gốc không có
// combo (kịch bản tạo tay).
export const createVideoKpiSchema = z.object({
  videoUrl: z.string().min(1, 'Link video không được để trống'),
  scriptId: z.string().optional(),
  hookEntryId: z.string().optional(),
  painPointEntryId: z.string().optional(),
  discCode: z.enum(['D', 'I', 'S', 'C']).optional(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  retentionRate: z.number().min(0).max(100).optional(),
  completionRate: z.number().min(0).max(100).optional(),
  postedAt: z.string().optional(),
});
