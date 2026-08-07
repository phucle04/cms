import { Response } from 'express';
import VideoKPI, { IVideoKPI } from '../models/VideoKPI';
import Script from '../models/Script';
import KnowledgeEntry, { DiscCode } from '../models/KnowledgeEntry';
import { AuthRequest, DEMO_USER_ID } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

function getUserId(req: AuthRequest): string {
  return req.userId || DEMO_USER_ID;
}

// GET /api/video-kpis
export const listVideoKpis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const kpis = await VideoKPI.find({ userId }).sort({ postedAt: -1 });
  res.json({ data: kpis });
});

async function resolveDiscEntryId(userId: string, discCode?: DiscCode): Promise<string | undefined> {
  if (!discCode) return undefined;
  const entry = await KnowledgeEntry.findOne({ userId, storeType: 'disc', discCode });
  return entry ? String(entry._id) : undefined;
}

/**
 * Cộng usageCount cho các KnowledgeEntry THẬT SỰ được gắn tag (hook + pain
 * point + entry DISC tương ứng discCode) - dùng chung cho create (+1) và
 * delete (-1, không cho âm) để kho tri thức luôn phản ánh đúng số video ĐÃ
 * ĐĂNG THẬT đang dùng entry đó (xem docstring usageCount trong KnowledgeEntry.ts).
 */
async function adjustUsageCounts(entryIds: string[], delta: 1 | -1): Promise<void> {
  if (entryIds.length === 0) return;
  const filter: Record<string, unknown> = { _id: { $in: entryIds } };
  if (delta < 0) filter.usageCount = { $gt: 0 };
  await KnowledgeEntry.updateMany(filter, { $inc: { usageCount: delta } });
}

/**
 * Gắn tag hook/pain point/DISC theo đúng quyết định đã chốt với người dùng
 * (G6 Phase 5, Q&A vòng 2): TỰ ĐỘNG lấy từ combo của Script gốc nếu có
 * scriptId VÀ script đó có combo (do pipeline Phase 4 sinh ra) - THỦ CÔNG
 * (dùng field người dùng tự chọn trong request) nếu không có scriptId, hoặc
 * script gốc không có combo (kịch bản tạo tay qua /ideation).
 */
export const createVideoKpi = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const { scriptId, hookEntryId, painPointEntryId, discCode, ...rest } = req.body as {
    scriptId?: string;
    hookEntryId?: string;
    painPointEntryId?: string;
    discCode?: DiscCode;
    [key: string]: unknown;
  };

  let candidateHookEntryId = hookEntryId;
  let candidatePainPointEntryId = painPointEntryId;
  let candidateDiscCode = discCode;

  if (scriptId) {
    const script = await Script.findOne({ _id: scriptId, userId });
    if (!script) {
      throw new ApiError(404, 'Không tìm thấy kịch bản gốc');
    }
    if (script.hookEntryId || script.painPointEntryId || script.discCode) {
      candidateHookEntryId = script.hookEntryId;
      candidatePainPointEntryId = script.painPointEntryId;
      candidateDiscCode = script.discCode;
    }
  }

  // Đối chiếu ID với kho THẬT trong DB trước khi lưu/tăng usageCount - không
  // tin mù ID gửi lên (dù từ script hay người dùng tự chọn), cùng nguyên tắc
  // chống hallucination như knowledgeMatchService.ts.
  const [hookEntry, painPointEntry, discEntryId] = await Promise.all([
    candidateHookEntryId ? KnowledgeEntry.findOne({ _id: candidateHookEntryId, userId }) : null,
    candidatePainPointEntryId ? KnowledgeEntry.findOne({ _id: candidatePainPointEntryId, userId }) : null,
    resolveDiscEntryId(userId, candidateDiscCode),
  ]);

  const kpi = await VideoKPI.create({
    ...rest,
    userId,
    scriptId: scriptId || undefined,
    hookEntryId: hookEntry ? String(hookEntry._id) : undefined,
    hookName: hookEntry?.name,
    painPointEntryId: painPointEntry ? String(painPointEntry._id) : undefined,
    painPointName: painPointEntry?.name,
    discCode: discEntryId ? candidateDiscCode : undefined,
  });

  const incrementTargets = [
    hookEntry ? String(hookEntry._id) : null,
    painPointEntry ? String(painPointEntry._id) : null,
    discEntryId ?? null,
  ].filter((id): id is string => !!id);
  await adjustUsageCounts(incrementTargets, 1);

  res.status(201).json({ data: kpi });
});

// DELETE /api/video-kpis/:id - hoàn lại usageCount đã cộng lúc tạo (nếu có),
// tránh kho tri thức bị "ảo" số liệu khi người dùng xoá 1 bản ghi nhập sai.
export const deleteVideoKpi = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const kpi = await VideoKPI.findOneAndDelete({ _id: req.params.id, userId });
  if (!kpi) {
    throw new ApiError(404, 'Không tìm thấy KPI video');
  }

  const decrementTargets = [
    (kpi as IVideoKPI).hookEntryId ?? null,
    (kpi as IVideoKPI).painPointEntryId ?? null,
    await resolveDiscEntryId(userId, (kpi as IVideoKPI).discCode),
  ].filter((id): id is string => !!id);
  await adjustUsageCounts(decrementTargets, -1);

  res.status(204).send();
});
