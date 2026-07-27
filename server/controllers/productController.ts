import { Response } from 'express';
import ProductBrief from '../models/ProductBrief';
import { AuthRequest, DEMO_USER_ID } from '../middleware/auth';

function getUserId(req: AuthRequest): string {
  return req.userId || DEMO_USER_ID;
}

// GET /api/products
export async function getProducts(req: AuthRequest, res: Response) {
  try {
    const userId = getUserId(req);
    const products = await ProductBrief.find({ userId }).sort({ createdAt: -1 });
    res.json({ data: products });
  } catch (error) {
    console.error('[Product] getProducts failed:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

// GET /api/products/:id
export async function getProduct(req: AuthRequest, res: Response) {
  try {
    const userId = getUserId(req);
    const product = await ProductBrief.findOne({ _id: req.params.id, userId });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ data: product });
  } catch (error) {
    console.error('[Product] getProduct failed:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
}

// POST /api/products
export async function createProduct(req: AuthRequest, res: Response) {
  try {
    const userId = getUserId(req);
    const product = await ProductBrief.create({ ...req.body, userId });
    res.status(201).json({ data: product });
  } catch (error) {
    console.error('[Product] createProduct failed:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

// PUT /api/products/:id
export async function updateProduct(req: AuthRequest, res: Response) {
  try {
    const userId = getUserId(req);
    const product = await ProductBrief.findOneAndUpdate(
      { _id: req.params.id, userId },
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ data: product });
  } catch (error) {
    console.error('[Product] updateProduct failed:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
}

// DELETE /api/products/:id
export async function deleteProduct(req: AuthRequest, res: Response) {
  try {
    const userId = getUserId(req);
    const product = await ProductBrief.findOneAndDelete({ _id: req.params.id, userId });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('[Product] deleteProduct failed:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
}