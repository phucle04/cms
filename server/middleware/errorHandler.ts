import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string
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
