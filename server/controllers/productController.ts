import { Response } from 'express';
import ProductBrief from '../models/ProductBrief';
import { AuthRequest, DEMO_USER_ID } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

function getUserId(req: AuthRequest): string {
  return req.userId || DEMO_USER_ID;
}

// GET /api/products
export const getProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const products = await ProductBrief.find({ userId }).sort({ createdAt: -1 });
  res.json({ data: products });
});

// GET /api/products/:id
export const getProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const product = await ProductBrief.findOne({ _id: req.params.id, userId });
  if (!product) {
    throw new ApiError(404, 'Không tìm thấy sản phẩm');
  }
  res.json({ data: product });
});

// POST /api/products
// req.body đã qua validateBody(createProductSchema) - name/category/usp chắc
// chắn có mặt, không cần check lại ở đây.
export const createProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const product = await ProductBrief.create({ ...req.body, userId });
  res.status(201).json({ data: product });
});

// PUT /api/products/:id
export const updateProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const product = await ProductBrief.findOneAndUpdate(
    { _id: req.params.id, userId },
    { ...req.body },
    { new: true, runValidators: true }
  );
  if (!product) {
    throw new ApiError(404, 'Không tìm thấy sản phẩm');
  }
  res.json({ data: product });
});

// DELETE /api/products/:id
export const deleteProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const product = await ProductBrief.findOneAndDelete({ _id: req.params.id, userId });
  if (!product) {
    throw new ApiError(404, 'Không tìm thấy sản phẩm');
  }
  res.status(204).send();
});
