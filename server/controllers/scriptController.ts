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

// GET /api/scripts?ideaId=&status=&q=&page=&limit= - `page`/`limit` TUỲ CHỌN:
// không truyền thì trả TOÀN BỘ (data thô, không có `pagination`) để tương
// thích ngược với các nơi gọi cũ cần load hết (VD build map job<->script ở
// trang /scripts, hoặc ComboSelectionPanel...). Truyền page/limit thì trả
// kèm object `pagination` giống hệt listResearchJobs.
export const getScripts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { ideaId, status, q } = req.query;
  const filter: Record<string, unknown> = { userId: req.userId };
  if (ideaId) filter.ideaId = ideaId;
  if (status) filter.status = status;
  if (q && typeof q === 'string' && q.trim()) {
    filter.title = { $regex: q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const dontList = await getActiveDontList(req.userId!);
  const withComplianceFlags = (scripts: InstanceType<typeof Script>[]) =>
    scripts.map((script) => ({
      ...script.toJSON(),
      complianceFlags: scanScriptCompliance(script.content, dontList),
    }));

  if (req.query.page || req.query.limit) {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));

    const [scripts, total] = await Promise.all([
      Script.find(filter)
        .populate('ideaId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Script.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: withComplianceFlags(scripts),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
    return;
  }

  const scripts = await Script.find(filter).populate('ideaId').sort({ createdAt: -1 });
  res.json({ success: true, data: withComplianceFlags(scripts) });
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

// req.body đã qua validateBody(bulkUpdateScriptsSchema) - ids/status chắc
// chắn hợp lệ, không cần check lại ở đây (cùng pattern bulkUpdateIdeas).
export const bulkUpdateScripts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { ids, status } = req.body;

  await Script.updateMany({ _id: { $in: ids }, userId: req.userId }, { status });

  res.json({ success: true, message: `Đã cập nhật ${ids.length} kịch bản` });
});

export const deleteScript = asyncHandler(async (req: AuthRequest, res: Response) => {
  const script = await Script.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  if (!script) {
    throw new ApiError(404, 'Script not found');
  }

  res.json({ success: true, data: null, message: 'Script deleted' });
});
