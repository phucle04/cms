import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import BrandProfile from '../models/BrandProfile';

export const getBrandProfiles = asyncHandler(async (req: AuthRequest, res: Response) => {
  const profiles = await BrandProfile.find({ userId: req.userId }).sort({
    isActive: -1,
    createdAt: -1,
  });
  res.json({ success: true, data: profiles });
});

export const getBrandProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const profile = await BrandProfile.findOne({ _id: req.params.id, userId: req.userId });

  if (!profile) {
    throw new ApiError(404, 'Brand profile not found');
  }

  res.json({ success: true, data: profile });
});

export const createBrandProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { brandName, industry, toneOfVoice } = req.body;

  if (!brandName || !industry || !toneOfVoice) {
    throw new ApiError(400, 'brandName, industry, toneOfVoice are required');
  }

  const profile = await BrandProfile.create({ ...req.body, userId: req.userId });

  res.status(201).json({ success: true, data: profile, message: 'Brand profile created' });
});

export const updateBrandProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await BrandProfile.findOne({ _id: req.params.id, userId: req.userId });

  if (!existing) {
    throw new ApiError(404, 'Brand profile not found');
  }

  const profile = await BrandProfile.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({ success: true, data: profile, message: 'Brand profile updated' });
});

export const deleteBrandProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const profile = await BrandProfile.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  if (!profile) {
    throw new ApiError(404, 'Brand profile not found');
  }

  res.json({ success: true, data: null, message: 'Brand profile deleted' });
});
