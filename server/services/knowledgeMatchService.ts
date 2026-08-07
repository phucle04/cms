import KnowledgeEntry, { DiscCode } from '../models/KnowledgeEntry';

/**
 * Nối kho tri thức (hook/pain point/DISC) vào bước phân tích video viral
 * (Giai đoạn 6, Phase 2): trước khi phân tích, đưa cho Gemini danh sách entry
 * ĐÃ DUYỆT để chọn ID khớp nhất; sau khi phân tích, RESOLVE kết quả Gemini trả
 * về với kho THẬT trong DB - không tin mù ID/gợi ý Gemini tự trả.
 */

export interface KnowledgeLibraryEntry {
  id: string;
  name: string;
  description: string;
}

export interface KnowledgeLibrary {
  hook: KnowledgeLibraryEntry[];
  painPoint: KnowledgeLibraryEntry[];
}

const VALID_DISC_CODES: DiscCode[] = ['D', 'I', 'S', 'C'];

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt để so khớp tên linh hoạt
    .replace(/\s+/g, '')
    .trim();
}

export function formatLibraryForPrompt(entries: KnowledgeLibraryEntry[]): string {
  if (entries.length === 0) {
    return '(kho đang trống - nếu video có mẫu rõ ràng, hãy đề xuất mục mới qua *NewName/*NewDescription/*NewExample)';
  }
  return entries.map((e) => `- [id=${e.id}] ${e.name}: ${e.description}`).join('\n');
}

/**
 * Tải kho hook + pain point ĐÃ DUYỆT 1 LẦN cho cả lượt chạy Stage 4 (không
 * tải lại mỗi video - kho không đổi trong lúc 1 job đang chạy, tải lại mỗi
 * video chỉ tốn query vô ích).
 */
export async function loadApprovedKnowledgeLibrary(userId: string): Promise<KnowledgeLibrary> {
  const entries = await KnowledgeEntry.find({
    userId,
    storeType: { $in: ['hook', 'pain_point'] },
    status: 'approved',
  });

  return {
    hook: entries
      .filter((e) => e.storeType === 'hook')
      .map((e) => ({ id: e.id, name: e.name, description: e.description })),
    painPoint: entries
      .filter((e) => e.storeType === 'pain_point')
      .map((e) => ({ id: e.id, name: e.name, description: e.description })),
  };
}

/**
 * State dùng chung xuyên suốt 1 lượt Stage 4 (nhiều video) - giữ mọi entry đã
 * biết (đã duyệt TỪ ĐẦU + 'learned' vừa tạo cho video trước đó trong CÙNG lượt
 * chạy này), để video sau không tạo trùng entry 'pending' cho cùng 1 pattern.
 */
export interface KnowledgeMatchState {
  hookById: Map<string, KnowledgeLibraryEntry>;
  hookByName: Map<string, string>;
  painPointById: Map<string, KnowledgeLibraryEntry>;
  painPointByName: Map<string, string>;
}

export function buildKnowledgeMatchState(library: KnowledgeLibrary): KnowledgeMatchState {
  const state: KnowledgeMatchState = {
    hookById: new Map(),
    hookByName: new Map(),
    painPointById: new Map(),
    painPointByName: new Map(),
  };
  for (const entry of library.hook) {
    state.hookById.set(entry.id, entry);
    state.hookByName.set(normalizeName(entry.name), entry.id);
  }
  for (const entry of library.painPoint) {
    state.painPointById.set(entry.id, entry);
    state.painPointByName.set(normalizeName(entry.name), entry.id);
  }
  return state;
}

export interface RawKnowledgeMatch {
  hookEntryId: string;
  hookNewName: string;
  hookNewDescription: string;
  hookNewExample: string;
  painPointEntryId: string;
  painPointNewName: string;
  painPointNewDescription: string;
  painPointNewExample: string;
  discCode: string;
}

export interface ResolvedKnowledgeMatch {
  hookEntryId: string | null;
  painPointEntryId: string | null;
  discCode: DiscCode | null;
}

async function resolveOneStore(params: {
  userId: string;
  storeType: 'hook' | 'pain_point';
  entryId: string;
  newName: string;
  newDescription: string;
  newExample: string;
  byId: Map<string, KnowledgeLibraryEntry>;
  byName: Map<string, string>;
}): Promise<string | null> {
  const { userId, storeType, entryId, newName, newDescription, newExample, byId, byName } = params;

  // Gemini chọn 1 ID có sẵn - CHỈ tin nếu ID đó THẬT có trong kho đã tải
  // (chống Gemini bịa ID không tồn tại).
  if (entryId && byId.has(entryId)) {
    return entryId;
  }

  if (!newName.trim() || !newDescription.trim()) {
    return null;
  }

  // So khớp tên đã chuẩn hoá với TOÀN BỘ entry đã biết (kể cả 'learned' vừa
  // tạo cho video trước đó trong CÙNG lượt chạy) - tránh tạo trùng lặp entry
  // 'pending' khi nhiều video cùng thể hiện 1 pattern giống nhau.
  const normalized = normalizeName(newName);
  const existingId = byName.get(normalized);
  if (existingId) {
    return existingId;
  }

  const created = await KnowledgeEntry.create({
    userId,
    storeType,
    name: newName.trim(),
    description: newDescription.trim(),
    example: newExample.trim() || undefined,
    source: 'learned',
    status: 'pending',
    usageCount: 0,
  });

  const entry: KnowledgeLibraryEntry = { id: created.id, name: created.name, description: created.description };
  byId.set(created.id, entry);
  byName.set(normalized, created.id);
  return created.id;
}

/**
 * Resolve knowledgeMatch THÔ do Gemini trả về thành kết quả THẬT đã đối
 * chiếu/DB (tạo entry 'learned'+'pending' mới nếu cần) - `state` bị MUTATE
 * trực tiếp để lần gọi kế tiếp trong cùng lượt Stage 4 dùng lại.
 */
export async function resolveKnowledgeMatch(params: {
  userId: string;
  raw: RawKnowledgeMatch;
  state: KnowledgeMatchState;
}): Promise<ResolvedKnowledgeMatch> {
  const { userId, raw, state } = params;

  const hookEntryId = await resolveOneStore({
    userId,
    storeType: 'hook',
    entryId: raw.hookEntryId,
    newName: raw.hookNewName,
    newDescription: raw.hookNewDescription,
    newExample: raw.hookNewExample,
    byId: state.hookById,
    byName: state.hookByName,
  });

  const painPointEntryId = await resolveOneStore({
    userId,
    storeType: 'pain_point',
    entryId: raw.painPointEntryId,
    newName: raw.painPointNewName,
    newDescription: raw.painPointNewDescription,
    newExample: raw.painPointNewExample,
    byId: state.painPointById,
    byName: state.painPointByName,
  });

  const discCode = VALID_DISC_CODES.includes(raw.discCode as DiscCode) ? (raw.discCode as DiscCode) : null;

  return { hookEntryId, painPointEntryId, discCode };
}
