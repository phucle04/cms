import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

// userId demo dùng chung cho TOÀN BỘ hệ thống khi chưa có trang login.
// productController và mọi controller khác nên lấy userId demo từ ĐÂY,
// không tự đặt riêng, để tránh "lệch tem" giữa các bảng dữ liệu.
// Khi làm xong login, xoá phần fallback demo này đi.
export const DEMO_USER_ID = '000000000000000000000000';

export const protect = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = (decoded as any).id;
    next(); // <-- QUAN TRỌNG: thiếu dòng này thì request sẽ bị treo mãi mãi
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// TẠM THỜI dùng thay cho "protect" trong lúc chưa có trang login.
// Nếu có token hợp lệ thì dùng userId thật; nếu không có token
// (hoặc token sai) thì tự động gán userId demo, để mọi controller
// vẫn tra cứu được dữ liệu nhất quán với nhau.
// -> Khi làm xong login, xoá middleware này, dùng lại "protect" ở mọi route.
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.userId = (decoded as any).id;
    } else {
      req.userId = DEMO_USER_ID;
    }
  } catch (error) {
    req.userId = DEMO_USER_ID;
  }
  next();
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};