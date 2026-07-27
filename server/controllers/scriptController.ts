import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import Script from '../models/Script';

export const getScripts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { ideaId, status } = req.query;
  const filter: Record<string, unknown> = { userId: req.userId };
  if (ideaId) filter.ideaId = ideaId;
  if (status) filter.status = status;

  const scripts = await Script.find(filter).populate('ideaId').sort({ createdAt: -1 });

  res.json({ success: true, data: scripts });
});

export const getScript = asyncHandler(async (req: AuthRequest, res: Response) => {
  const script = await Script.findOne({ _id: req.params.id, userId: req.userId }).populate('ideaId');

  if (!script) {
    throw new ApiError(404, 'Script not found');
  }

  res.json({ success: true, data: script });
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
