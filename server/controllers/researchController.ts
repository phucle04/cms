import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import ProductBrief from '../models/ProductBrief';
import AIService from '../services/aiService';
import TikTokService from '../services/tiktokService';

const aiService = new AIService();
const tiktokService = new TikTokService();

export const runTrendResearch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { productId, hashtags: providedHashtags } = req.body;

  if (!productId && (!providedHashtags || !Array.isArray(providedHashtags) || providedHashtags.length === 0)) {
    throw new ApiError(400, 'Product ID or hashtags required');
  }

  let product = null;
  if (productId) {
    product = await ProductBrief.findOne({
      _id: productId,
      userId: req.userId,
    });
  }

  if (!product && !providedHashtags) {
    throw new ApiError(404, 'Product not found');
  }

  const hashtags = providedHashtags?.length
    ? providedHashtags
    : await aiService.generateHashtags(product as any);

  const videos = await tiktokService.searchByHashtagsLegacy(hashtags, 5);
  const topVideos = tiktokService.getTop5ByViews(videos);

  const transcripts = await Promise.all(
    topVideos.map(async (video) => ({
      views: video.views,
      transcript: await tiktokService.getTranscript(video),
    }))
  );

  res.json({
    hashtags,
    videos: topVideos,
    transcripts,
  });
});
