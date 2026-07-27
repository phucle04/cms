import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import Idea from '../models/Idea';
import AIService from '../services/aiService';
import ProductBrief from '../models/ProductBrief';

// AIService initialized with Gemini from env vars
const aiService = new AIService();

export const getIdeas = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, priority, productId } = req.query;
  const filter: any = { userId: req.userId };

  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (productId) filter.productId = productId;

  const ideas = await Idea.find(filter)
    .populate('productId')
    // .populate('relatedTrends') // TẠM BỎ - chưa có model Trend, sẽ thêm lại sau
    .sort({ createdAt: -1 });

  res.json({ success: true, data: ideas });
});

export const getIdea = asyncHandler(async (req: AuthRequest, res: Response) => {
  const idea = await Idea.findOne({
    _id: req.params.id,
    userId: req.userId,
  }).populate('productId');
  // .populate('relatedTrends') // TẠM BỎ - chưa có model Trend, sẽ thêm lại sau

  if (!idea) {
    throw new ApiError(404, 'Idea not found');
  }

  res.json({ success: true, data: idea });
});

export const createIdea = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, description, source, priority, productId, status } = req.body;

  if (!title || !description || !source) {
    throw new ApiError(400, 'Missing required fields');
  }

  const idea = await Idea.create({
    userId: req.userId,
    title,
    description,
    source,
    priority: priority || 'medium',
    productId,
    status: status || 'new',
  });

  res.status(201).json(idea);
});

export const updateIdea = asyncHandler(async (req: AuthRequest, res: Response) => {
  let idea = await Idea.findOne({
    _id: req.params.id,
    userId: req.userId,
  });

  if (!idea) {
    throw new ApiError(404, 'Idea not found');
  }

  idea = await Idea.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(idea);
});

export const deleteIdea = asyncHandler(async (req: AuthRequest, res: Response) => {
  const idea = await Idea.findOneAndDelete({
    _id: req.params.id,
    userId: req.userId,
  });

  if (!idea) {
    throw new ApiError(404, 'Idea not found');
  }

  res.json({ message: 'Idea deleted' });
});

export const generateIdeasFromProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { productId, count = 5, competitorTranscripts, trendContext } = req.body;

  if (!productId) {
    throw new ApiError(400, 'Product ID required');
  }

  const product = await ProductBrief.findOne({
    _id: productId,
    userId: req.userId,
  });

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const evidence = Array.isArray(competitorTranscripts)
    ? competitorTranscripts
    : Array.isArray(trendContext)
      ? trendContext
      : [];

  // Generate ideas with Gemini - no silent fallback, let errors propagate
  let generatedIdeas;
  try {
    generatedIdeas = await aiService.generateIdeas(product as any, count, evidence);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[Idea Generation] Failed for product', productId, ':', errorMessage);

    // Return meaningful error to client
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      throw new ApiError(429, 'AI service rate limited. Please try again in a moment.');
    } else if (errorMessage.includes('safety')) {
      throw new ApiError(400, 'Content blocked by AI safety filter. Try different product details.');
    } else if (errorMessage.includes('configured')) {
      throw new ApiError(503, 'AI service not properly configured. Contact administrator.');
    }

    throw new ApiError(500, `Failed to generate ideas: ${errorMessage}`);
  }

  // Save generated ideas to database
  const ideas = await Idea.insertMany(
    generatedIdeas.map((idea) => ({
      ...idea,
      userId: req.userId,
    }))
  );

  res.status(201).json({
    success: true,
    data: ideas,
    message: `Generated ${ideas.length} ideas with Gemini AI`,
  });
});

export const bulkUpdateIdeas = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { ids, status, priority } = req.body;

  if (!ids || !Array.isArray(ids)) {
    throw new ApiError(400, 'Invalid request');
  }

  const update: any = {};
  if (status) update.status = status;
  if (priority) update.priority = priority;

  await Idea.updateMany(
    { _id: { $in: ids }, userId: req.userId },
    update
  );

  res.json({ message: `Updated ${ids.length} ideas` });
});