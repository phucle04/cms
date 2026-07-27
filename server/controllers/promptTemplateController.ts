import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import PromptTemplate from '../models/PromptTemplate';
import { defaultPromptTemplates } from '../seeds/defaults/promptTemplates.default';

export const getPromptTemplates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { key } = req.query;
  const filter: Record<string, unknown> = { userId: req.userId };
  if (key) filter.key = key;

  const templates = await PromptTemplate.find(filter).sort({
    key: 1,
    isDefault: -1,
    createdAt: -1,
  });

  res.json({ success: true, data: templates });
});

export const getPromptTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const template = await PromptTemplate.findOne({ _id: req.params.id, userId: req.userId });

  if (!template) {
    throw new ApiError(404, 'Prompt template not found');
  }

  res.json({ success: true, data: template });
});

export const createPromptTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { key, name, systemPrompt, userPromptTemplate } = req.body;

  if (!key || !name || !systemPrompt || !userPromptTemplate) {
    throw new ApiError(400, 'key, name, systemPrompt, userPromptTemplate are required');
  }

  // Template do người dùng tự tạo không bao giờ là system seed, kể cả nếu
  // client cố truyền isSystemSeed trong body.
  const template = await PromptTemplate.create({
    ...req.body,
    userId: req.userId,
    isSystemSeed: false,
  });

  res.status(201).json({ success: true, data: template, message: 'Prompt template created' });
});

export const updatePromptTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await PromptTemplate.findOne({ _id: req.params.id, userId: req.userId });

  if (!existing) {
    throw new ApiError(404, 'Prompt template not found');
  }

  // isSystemSeed chỉ được đổi qua reset-default, không cho sửa tay qua PUT.
  const { isSystemSeed, ...safeBody } = req.body;

  const template = await PromptTemplate.findByIdAndUpdate(req.params.id, safeBody, {
    new: true,
    runValidators: true,
  });

  res.json({ success: true, data: template, message: 'Prompt template updated' });
});

export const deletePromptTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await PromptTemplate.findOne({ _id: req.params.id, userId: req.userId });

  if (!existing) {
    throw new ApiError(404, 'Prompt template not found');
  }

  if (existing.isSystemSeed) {
    throw new ApiError(
      400,
      'Cannot delete a system default template. Use reset-default instead, or duplicate it as a custom template.'
    );
  }

  await PromptTemplate.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  res.json({ success: true, data: null, message: 'Prompt template deleted' });
});

export const resetPromptTemplateToDefault = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await PromptTemplate.findOne({ _id: req.params.id, userId: req.userId });

  if (!existing) {
    throw new ApiError(404, 'Prompt template not found');
  }

  const def = defaultPromptTemplates.find((d) => d.key === existing.key);

  if (!def) {
    throw new ApiError(400, `No default definition found for key "${existing.key}"`);
  }

  const template = await PromptTemplate.findByIdAndUpdate(
    req.params.id,
    {
      name: def.name,
      niche: def.niche,
      systemPrompt: def.systemPrompt,
      userPromptTemplate: def.userPromptTemplate,
      aiModel: def.aiModel,
      temperature: def.temperature,
      isSystemSeed: true,
    },
    { new: true, runValidators: true }
  );

  res.json({ success: true, data: template, message: 'Prompt template reset to default' });
});
