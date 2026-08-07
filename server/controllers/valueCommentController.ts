import { Response } from 'express';
import ValueComment from '../models/ValueComment';
import { AuthRequest, DEMO_USER_ID } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

function getUserId(req: AuthRequest): string {
  return req.userId || DEMO_USER_ID;
}

// GET /api/value-comments - kho "value comment" AI tự lưu lúc phân tích
// video (Giai đoạn 6 Phase 6), KHÔNG có endpoint tạo/sửa thủ công (theo đúng
// quyết định "AI tự lưu thẳng, không cần duyệt" - chỉ có xem + xoá).
export const listValueComments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const comments = await ValueComment.find({ userId }).sort({ createdAt: -1 });
  res.json({ data: comments });
});

// DELETE /api/value-comments/:id
export const deleteValueComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const comment = await ValueComment.findOneAndDelete({ _id: req.params.id, userId });
  if (!comment) {
    throw new ApiError(404, 'Không tìm thấy value comment');
  }
  res.status(204).send();
});
