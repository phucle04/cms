import * as Types from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Lỗi API có kèm mã lỗi máy-đọc-được (vd 'DUPLICATE_JOB_RUNNING') từ ApiError phía
// server (xem server/middleware/errorHandler.ts), để UI phân biệt và hiển thị
// đúng dạng (panel thông tin thay vì toast lỗi đỏ) mà không cần match chuỗi
// tiếng Việt dễ vỡ khi đổi câu chữ.
export class ApiClientError extends Error {
  constructor(message: string, public code?: string, public statusCode?: number) {
    super(message);
  }
}

// Hàm dùng chung: tự động gắn token đăng nhập + xử lý lỗi rõ ràng
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.error || errorBody.message || `API error: ${res.status}`;
    throw new ApiClientError(message, errorBody.code, res.status);
  }

  // Một số API có thể trả 204 No Content (ví dụ delete)
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const json = await res.json();
  // Chuẩn response MỚI cho mọi endpoint: { success, data, message? } - xem B5.
  // Vẫn giữ nhánh fallback "trả thẳng [...]" cho các endpoint cũ chưa migrate
  // hết (ví dụ createIdea/updateIdea/deleteIdea/bulkUpdateIdeas), để không vỡ
  // các trang đang gọi chúng. Xoá nhánh fallback này khi toàn bộ backend đã
  // đồng nhất theo chuẩn { success, data, message }.
  return (json.data !== undefined ? json.data : json) as T;
}

// Upload file (multipart/form-data) - KHÔNG tự set Content-Type như apiFetch,
// để trình duyệt tự gắn boundary đúng chuẩn multipart.
async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.error || errorBody.message || `API error: ${res.status}`;
    throw new ApiClientError(message, errorBody.code, res.status);
  }

  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

// ============================================
// Idea API — khớp đúng với server/routes/api.ts
// ============================================
export interface PaginatedIdeas {
  data: Types.Idea[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const IdeaAPI = {
  // KHÔNG phân trang - trả TOÀN BỘ ý tưởng. Dùng cho nơi cần load hết 1 lần
  // (VD đếm tổng số ở dashboard). Dùng listPaginated() cho danh sách hiển thị.
  async list(): Promise<Types.Idea[]> {
    return apiFetch<Types.Idea[]>('/ideas');
  },

  // Không dùng apiFetch() vì nó tự unwrap `data` và làm mất field `pagination`
  // đi kèm - cùng lý do như ResearchJobAPI.list()/ResearchScriptAPI.listPaginated().
  async listPaginated(params: {
    page?: number;
    limit?: number;
    source?: 'manual' | 'pipeline';
  }): Promise<PaginatedIdeas> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 20));
    if (params.source) query.set('source', params.source);

    const res = await fetch(`${API_BASE}/ideas?${query.toString()}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiClientError(body.error || body.message || `API error: ${res.status}`, body.code, res.status);
    }
    const json = await res.json();
    return { data: json.data, pagination: json.pagination };
  },

  async get(id: string): Promise<Types.Idea> {
    return apiFetch<Types.Idea>(`/ideas/${id}`);
  },

  async create(data: Omit<Types.Idea, 'id' | 'createdAt' | 'updatedAt'>): Promise<Types.Idea> {
    return apiFetch<Types.Idea>('/ideas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<Types.Idea>): Promise<Types.Idea> {
    return apiFetch<Types.Idea>(`/ideas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Server trả 200 + {message} (không phải 204), nên khai đúng shape thật -
  // trước đây khai `Promise<void>` sai với thực tế (tìm ở G4).
  async delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/ideas/${id}`, {
      method: 'DELETE',
    });
  },

  async generate(productId: string, count: number = 5, competitorTranscripts?: Types.CompetitorTranscript[]): Promise<Types.Idea[]> {
    return apiFetch<Types.Idea[]>('/ideas/generate', {
      method: 'POST',
      body: JSON.stringify({ productId, count, competitorTranscripts }),
    });
  },

  async bulkUpdate(
    ids: string[],
    updates: { status?: Types.Idea['status']; priority?: Types.Idea['priority'] }
  ): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/ideas/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ ids, ...updates }),
    });
  },
};

// ============================================================
// Product API — khớp đúng với server/routes/api.ts
// ============================================================
export const ProductAPI = {
  async list(): Promise<Types.ProductBrief[]> {
    return apiFetch<Types.ProductBrief[]>('/products');
  },

  async get(id: string): Promise<Types.ProductBrief> {
    return apiFetch<Types.ProductBrief>(`/products/${id}`);
  },

  async create(data: Omit<Types.ProductBrief, 'id' | 'createdAt' | 'updatedAt'>): Promise<Types.ProductBrief> {
    return apiFetch<Types.ProductBrief>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<Types.ProductBrief>): Promise<Types.ProductBrief> {
    return apiFetch<Types.ProductBrief>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiFetch<void>(`/products/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================
// Knowledge base API (kho hook / pain point / DISC) — khớp đúng
// server/controllers/knowledgeController.ts
// ============================================================
export const KnowledgeAPI = {
  async list(storeType: Types.KnowledgeStoreType, status?: Types.KnowledgeStatus): Promise<Types.KnowledgeEntry[]> {
    const params = new URLSearchParams({ storeType });
    if (status) params.set('status', status);
    return apiFetch<Types.KnowledgeEntry[]>(`/knowledge?${params.toString()}`);
  },

  async create(
    data: Pick<Types.KnowledgeEntry, 'storeType' | 'name' | 'description'> &
      Partial<Pick<Types.KnowledgeEntry, 'example' | 'discCode'>>
  ): Promise<Types.KnowledgeEntry> {
    return apiFetch<Types.KnowledgeEntry>('/knowledge', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: Partial<Pick<Types.KnowledgeEntry, 'name' | 'description' | 'example' | 'discCode' | 'status'>>
  ): Promise<Types.KnowledgeEntry> {
    return apiFetch<Types.KnowledgeEntry>(`/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async approve(id: string): Promise<Types.KnowledgeEntry> {
    return this.update(id, { status: 'approved' });
  },

  async delete(id: string): Promise<void> {
    return apiFetch<void>(`/knowledge/${id}`, { method: 'DELETE' });
  },

  async importFile(storeType: Types.KnowledgeStoreType, file: File): Promise<Types.KnowledgeEntry[]> {
    const formData = new FormData();
    formData.append('storeType', storeType);
    formData.append('file', file);
    return apiUpload<Types.KnowledgeEntry[]>('/knowledge/import', formData);
  },
};

// ============================================================
// Research Job API (pipeline 5 stage) — khớp đúng
// server/controllers/researchJobController.ts
// ============================================================

export const API_BASE_URL = API_BASE;

export interface ResearchJobDetail {
  job: Types.ResearchJob;
  trendVideos: Types.TrendVideo[];
  ideas: Types.Idea[];
  scripts: Types.ResearchScript[];
}

export interface PaginatedJobs {
  data: Types.ResearchJob[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ResearchJobCostEstimate {
  videoScanCount: number;
  scriptCount: number;
  apifyEstimatedUsd: number;
  geminiEstimatedUsd: number;
  totalEstimatedUsd: number;
}

export const ResearchJobAPI = {
  async create(
    productId: string,
    autoSelectTop3?: boolean,
    videoScanCount?: number,
    scriptCount?: number,
    maxVideoAgeMonths?: number | null
  ): Promise<{ jobId: string; status: Types.ResearchJobStatus }> {
    return apiFetch('/research/jobs', {
      method: 'POST',
      body: JSON.stringify({ productId, autoSelectTop3, videoScanCount, scriptCount, maxVideoAgeMonths }),
    });
  },

  async estimateCost(videoScanCount: number, scriptCount: number): Promise<ResearchJobCostEstimate> {
    const params = new URLSearchParams({ videoScanCount: String(videoScanCount), scriptCount: String(scriptCount) });
    return apiFetch<ResearchJobCostEstimate>(`/research/estimate-cost?${params.toString()}`);
  },

  async list(page = 1, limit = 20): Promise<PaginatedJobs> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const res = await fetch(`${API_BASE}/research/jobs?page=${page}&limit=${limit}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || body.message || `API error: ${res.status}`);
    }
    const json = await res.json();
    return { data: json.data, pagination: json.pagination };
  },

  async get(id: string): Promise<ResearchJobDetail> {
    return apiFetch<ResearchJobDetail>(`/research/jobs/${id}`);
  },

  async selectHashtags(id: string, selectedHashtags: string[]): Promise<{ jobId: string; selectedHashtags: string[] }> {
    return apiFetch(`/research/jobs/${id}/hashtags`, {
      method: 'POST',
      body: JSON.stringify({ selectedHashtags }),
    });
  },

  async selectCombos(id: string, selectedCombos: Types.ResearchJobCombo[]): Promise<{ jobId: string; selectedCombos: Types.ResearchJobCombo[] }> {
    return apiFetch(`/research/jobs/${id}/combos`, {
      method: 'POST',
      body: JSON.stringify({ selectedCombos }),
    });
  },

  async retry(id: string): Promise<{ jobId: string; resumingFromStage: string }> {
    return apiFetch(`/research/jobs/${id}/retry`, { method: 'POST' });
  },

  async cancel(id: string): Promise<{ jobId: string }> {
    return apiFetch(`/research/jobs/${id}/cancel`, { method: 'POST' });
  },

  streamUrl(id: string): string {
    return `${API_BASE}/research/jobs/${id}/stream`;
  },
};

export function proxyImageUrl(url: string): string {
  return `${API_BASE}/proxy-image?url=${encodeURIComponent(url)}`;
}

// ============================================================
// Research Script API (kịch bản THẬT do pipeline sinh ra) — khớp
// server/controllers/scriptController.ts
// ============================================================

export interface PaginatedScripts {
  data: Types.ResearchScript[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const ResearchScriptAPI = {
  // KHÔNG phân trang - trả TOÀN BỘ script khớp filter. Dùng cho nơi cần load
  // hết 1 lần (VD dropdown chọn kịch bản gốc ở trang KPI Video). Nếu cần
  // phân trang cho danh sách hiển thị, dùng listPaginated() bên dưới.
  async list(params?: { ideaId?: string; status?: Types.ResearchScript['status'] }): Promise<Types.ResearchScript[]> {
    const query = new URLSearchParams();
    if (params?.ideaId) query.set('ideaId', params.ideaId);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return apiFetch<Types.ResearchScript[]>(`/scripts${qs ? `?${qs}` : ''}`);
  },

  // Truyền page/limit -> server trả kèm `pagination` (xem scriptController.ts) -
  // KHÔNG dùng apiFetch() vì nó tự unwrap `data` và làm mất field `pagination`
  // đi kèm, giống cách ResearchJobAPI.list() đã xử lý.
  async listPaginated(params: {
    page?: number;
    limit?: number;
    status?: Types.ResearchScript['status'];
    q?: string;
  }): Promise<PaginatedScripts> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 20));
    if (params.status) query.set('status', params.status);
    if (params.q) query.set('q', params.q);

    const res = await fetch(`${API_BASE}/scripts?${query.toString()}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiClientError(body.error || body.message || `API error: ${res.status}`, body.code, res.status);
    }
    const json = await res.json();
    return { data: json.data, pagination: json.pagination };
  },

  async get(id: string): Promise<Types.ResearchScript> {
    return apiFetch<Types.ResearchScript>(`/scripts/${id}`);
  },

  // Lưu ý (G4): server KHÔNG populate `ideaId` ở updateScript (khác
  // list()/get() có populate) - kết quả trả về của hàm này có `ideaId` là
  // string thô, không phải object Idea. Đừng đọc field của Idea (vd .title)
  // trực tiếp từ kết quả update(), phải gọi lại get()/list() nếu cần.
  async update(id: string, data: Partial<Types.ResearchScript>): Promise<Types.ResearchScript> {
    return apiFetch<Types.ResearchScript>(`/scripts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async bulkUpdateStatus(ids: string[], status: Types.ResearchScript['status']): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/scripts/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ ids, status }),
    });
  },

  // Server trả {success:true, data:null} - apiFetch unwrap ra null (không
  // phải undefined/void như khai trước đây, tìm ở G4).
  async delete(id: string): Promise<null> {
    return apiFetch<null>(`/scripts/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================
// Video KPI API (nhật ký video đã đăng thật) — khớp
// server/controllers/videoKpiController.ts
// ============================================================

export interface CreateVideoKpiInput {
  videoUrl: string;
  scriptId?: string;
  hookEntryId?: string;
  painPointEntryId?: string;
  discCode?: Types.DiscCode;
  views?: number;
  likes?: number;
  comments?: number;
  retentionRate?: number;
  completionRate?: number;
  postedAt?: string;
}

export const VideoKpiAPI = {
  async list(): Promise<Types.VideoKPI[]> {
    return apiFetch<Types.VideoKPI[]>('/video-kpis');
  },

  async create(data: CreateVideoKpiInput): Promise<Types.VideoKPI> {
    return apiFetch<Types.VideoKPI>('/video-kpis', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiFetch<void>(`/video-kpis/${id}`, { method: 'DELETE' });
  },
};

// ============================================================
// Value Comment API (kho bình luận tái dùng, AI tự lưu) — khớp
// server/controllers/valueCommentController.ts
// ============================================================

export const ValueCommentAPI = {
  async list(): Promise<Types.ValueComment[]> {
    return apiFetch<Types.ValueComment[]>('/value-comments');
  },

  async delete(id: string): Promise<void> {
    return apiFetch<void>(`/value-comments/${id}`, { method: 'DELETE' });
  },
};

// ============================================================
// Brand Profile API — khớp server/controllers/brandProfileController.ts
// ============================================================

export const BrandProfileAPI = {
  async list(): Promise<Types.BrandProfile[]> {
    return apiFetch<Types.BrandProfile[]>('/brand-profiles');
  },

  async get(id: string): Promise<Types.BrandProfile> {
    return apiFetch<Types.BrandProfile>(`/brand-profiles/${id}`);
  },

  async create(data: Partial<Types.BrandProfile>): Promise<Types.BrandProfile> {
    return apiFetch<Types.BrandProfile>('/brand-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // CẢNH BÁO (G4): server dùng findByIdAndUpdate ghi đè NGUYÊN object lồng
  // nhau (storeInfo, targetAudience) chứ không merge từng field - gửi
  // `storeInfo` thiếu field nào sẽ mất field đó thật sự trong DB. Luôn gửi
  // đủ toàn bộ object lồng (xem cách BrandProfileTab.tsx tự làm: đọc lại
  // giá trị cũ rồi merge trước khi gọi update()).
  async update(id: string, data: Partial<Types.BrandProfile>): Promise<Types.BrandProfile> {
    return apiFetch<Types.BrandProfile>(`/brand-profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ============================================================
// Prompt Template API — khớp server/controllers/promptTemplateController.ts
// ============================================================

export const PromptTemplateAPI = {
  async list(key?: Types.PromptTemplateKey): Promise<Types.PromptTemplate[]> {
    return apiFetch<Types.PromptTemplate[]>(key ? `/prompt-templates?key=${key}` : '/prompt-templates');
  },

  async update(id: string, data: Partial<Types.PromptTemplate>): Promise<Types.PromptTemplate> {
    return apiFetch<Types.PromptTemplate>(`/prompt-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async resetToDefault(id: string): Promise<Types.PromptTemplate> {
    return apiFetch<Types.PromptTemplate>(`/prompt-templates/${id}/reset-default`, {
      method: 'POST',
    });
  },
};
