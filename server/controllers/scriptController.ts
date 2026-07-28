import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import Script from '../models/Script';
import BrandProfile from '../models/BrandProfile';
import { scanScriptCompliance } from '../services/complianceScanner';

// Bộ quét tuân thủ (G6a): tính thêm, không lưu DB - đọc dontList của
// BrandProfile đang active của user rồi quét nội dung kịch bản.
async function getActiveDontList(userId: string): Promise<string[]> {
  const brandProfile = await BrandProfile.findOne({ userId, isActive: true });
  return brandProfile?.dontList ?? [];
}

export const getScripts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { ideaId, status } = req.query;
  const filter: Record<string, unknown> = { userId: req.userId };
  if (ideaId) filter.ideaId = ideaId;
  if (status) filter.status = status;

  const scripts = await Script.find(filter).populate('ideaId').sort({ createdAt: -1 });
  const dontList = await getActiveDontList(req.userId!);

  const data = scripts.map((script) => ({
    ...script.toJSON(),
    complianceFlags: scanScriptCompliance(script.content, dontList),
  }));

  res.json({ success: true, data });
});

export const getScript = asyncHandler(async (req: AuthRequest, res: Response) => {
  const script = await Script.findOne({ _id: req.params.id, userId: req.userId }).populate('ideaId');

  if (!script) {
    throw new ApiError(404, 'Script not found');
  }

  const dontList = await getActiveDontList(req.userId!);
  const data = {
    ...script.toJSON(),
    complianceFlags: scanScriptCompliance(script.content, dontList),
  };

  res.json({ success: true, data });
});

export const createScript = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { ideaId, title, content, callToAction } = req.body;

  if (!ideaId || !title || !content || !callToAction) {
    throw new ApiError(400, 'ideaId, title, content, callToAction are required');
  }

  const script = await Script.create({ ...req.body, userId: req.userId });

  res.status(201).json({ success: true, data: script, message: 'Script created' });
});

export const updateScript = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await Script.findOne({ _id: req.params.id, userId: req.userId });

  if (!existing) {
    throw new ApiError(404, 'Script not found');
  }

  const script = await Script.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({ success: true, data: script, message: 'Script updated' });
});

export const deleteScript = asyncHandler(async (req: AuthRequest, res: Response) => {
  const script = await Script.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  if (!script) {
    throw new ApiError(404, 'Script not found');
  }

  res.json({ success: true, data: null, message: 'Script deleted' });
});
