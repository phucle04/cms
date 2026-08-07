import { Response } from 'express';
import multer from 'multer';
import KnowledgeEntry, { KnowledgeStoreType } from '../models/KnowledgeEntry';
import { parseKnowledgeFile } from '../services/knowledgeImportService';
import { AuthRequest, DEMO_USER_ID } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

function getUserId(req: AuthRequest): string {
  return req.userId || DEMO_USER_ID;
}

const VALID_STORE_TYPES: KnowledgeStoreType[] = ['hook', 'pain_point', 'disc'];

function assertValidStoreType(value: unknown): asserts value is KnowledgeStoreType {
  if (typeof value !== 'string' || !VALID_STORE_TYPES.includes(value as KnowledgeStoreType)) {
    throw new ApiError(400, `storeType phải là 1 trong: ${VALID_STORE_TYPES.join(', ')}`);
  }
}

// GET /api/knowledge?storeType=hook&status=approved
export const getKnowledgeEntries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const { storeType, status } = req.query;

  const filter: Record<string, unknown> = { userId };
  if (storeType) {
    assertValidStoreType(storeType);
    filter.storeType = storeType;
  }
  if (status === 'approved' || status === 'pending') {
    filter.status = status;
  }

  const entries = await KnowledgeEntry.find(filter).sort({ usageCount: -1, createdAt: -1 });
  res.json({ data: entries });
});

// POST /api/knowledge - thêm tay 1 entry, luôn source='uploaded' + status='approved'
// (người dùng tự nhập/xem xét trước khi lưu nên tin tưởng ngay, khác entry AI
// tự học lúc phân tích video - xem server/models/KnowledgeEntry.ts).
export const createKnowledgeEntry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const entry = await KnowledgeEntry.create({
    ...req.body,
    userId,
    source: 'uploaded',
    status: 'approved',
    usageCount: 0,
  });
  res.status(201).json({ data: entry });
});

// PUT /api/knowledge/:id - sửa nội dung entry, hoặc duyệt entry 'pending'
// (gửi { status: 'approved' }) do AI tự học lúc phân tích video quét được.
export const updateKnowledgeEntry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const entry = await KnowledgeEntry.findOneAndUpdate(
    { _id: req.params.id, userId },
    { ...req.body },
    { new: true, runValidators: true }
  );
  if (!entry) {
    throw new ApiError(404, 'Không tìm thấy entry kiến thức');
  }
  res.json({ data: entry });
});

// DELETE /api/knowledge/:id
export const deleteKnowledgeEntry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const entry = await KnowledgeEntry.findOneAndDelete({ _id: req.params.id, userId });
  if (!entry) {
    throw new ApiError(404, 'Không tìm thấy entry kiến thức');
  }
  res.status(204).send();
});

// Multer memory storage - chỉ cần buffer để đọc/parse, không cần lưu file
// lên đĩa (file kiến thức chỉ dùng 1 lần lúc import, không cần giữ lại).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB - đủ cho tài liệu văn bản/bảng tính
});

export const uploadKnowledgeFileMiddleware = upload.single('file');

// POST /api/knowledge/import (multipart/form-data: field "file" + field "storeType")
// Đọc file, tách thành entry, lưu thẳng với source='uploaded' + status='approved'
// (người dùng đã tự chọn lọc nội dung file trước khi upload).
export const importKnowledgeFile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const file = req.file;
  if (!file) {
    throw new ApiError(400, 'Thiếu file upload (field "file")');
  }

  assertValidStoreType(req.body.storeType);
  const storeType = req.body.storeType as KnowledgeStoreType;

  const parsedEntries = await parseKnowledgeFile({
    storeType,
    filename: file.originalname,
    buffer: file.buffer,
  });

  if (parsedEntries.length === 0) {
    throw new ApiError(422, 'Không trích xuất được entry nào từ file - kiểm tra lại nội dung/định dạng file');
  }

  const created = await KnowledgeEntry.insertMany(
    parsedEntries.map((entry) => ({
      ...entry,
      userId,
      storeType,
      source: 'uploaded',
      status: 'approved',
      usageCount: 0,
    }))
  );

  res.status(201).json({ data: created });
});
