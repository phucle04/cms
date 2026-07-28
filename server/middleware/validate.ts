import { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from './errorHandler';

/**
 * Middleware validate req.body bằng zod (G7, Giai đoạn 5) - chặn payload sai
 * hình dạng TRƯỚC khi vào controller, trả 400 rõ ràng thay vì để Mongoose
 * ném lỗi validate mập mờ hoặc (tệ hơn) lưu nhầm dữ liệu do field thừa/thiếu
 * kiểu bị bỏ qua lặng lẽ. Parse xong GHI ĐÈ req.body bằng dữ liệu đã qua zod
 * (đã coerce/lọc field lạ) để controller phía sau dùng dữ liệu sạch.
 */
export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      next(new ApiError(400, `Dữ liệu không hợp lệ - ${message}`));
      return;
    }
    req.body = result.data;
    next();
  };
}
