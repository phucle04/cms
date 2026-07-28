import { z } from 'zod';

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
  socialProof: z.string().optional(),
  comparison: z.string().optional(),
  shootingTips: z.string().optional(),
  mediaUrl: z.string().optional(),
  keywords: z.array(z.string()).optional(),
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

export const createResearchJobSchema = z.object({
  productId: z.string().min(1, 'Thiếu productId'),
  autoSelectTop3: z.boolean().optional(),
});

export const selectHashtagsSchema = z.object({
  selectedHashtags: z
    .array(z.string().trim().min(1, 'hashtag không được để trống/toàn khoảng trắng'))
    .min(1, 'selectedHashtags phải là mảng không rỗng'),
});
