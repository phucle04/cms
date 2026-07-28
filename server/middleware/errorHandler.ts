import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    // Mã lỗi máy-đọc-được tuỳ chọn (vd 'AGE_GATE_BLOCKED', 'COST_CAP_EXCEEDED')
    // để frontend phân biệt và hiển thị đúng UI (panel info thay vì toast lỗi
    // đỏ), không phải match chuỗi message tiếng Việt dễ vỡ khi đổi câu chữ.
    public code?: string
  ) {
    super(message);
  }
}

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
      ...(err.code ? { code: err.code } : {}),
    });
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    statusCode: 500,
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
