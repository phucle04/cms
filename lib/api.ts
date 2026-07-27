import * as Types from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
    throw new Error(message);
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

// ============================================
// Idea API — khớp đúng với server/routes/api.ts
// ============================================
export const IdeaAPI = {
  async list(): Promise<Types.Idea[]> {
    return apiFetch<Types.Idea[]>('/ideas');
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

  async delete(id: string): Promise<void> {
    return apiFetch<void>(`/ideas/${id}`, {
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

export const ResearchJobAPI = {
  async create(productId: string, autoSelectTop3?: boolean): Promise<{ jobId: string; status: Types.ResearchJobStatus }> {
    return apiFetch('/research/jobs', {
      method: 'POST',
      body: JSON.stringify({ productId, autoSelectTop3 }),
    });
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

  async retry(id: string): Promise<{ jobId: string; resumingFromStage: string }> {
    return apiFetch(`/research/jobs/${id}/retry`, { method: 'POST' });
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

export const ResearchScriptAPI = {
  async list(params?: { ideaId?: string; status?: Types.ResearchScript['status'] }): Promise<Types.ResearchScript[]> {
    const query = new URLSearchParams();
    if (params?.ideaId) query.set('ideaId', params.ideaId);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return apiFetch<Types.ResearchScript[]>(`/scripts${qs ? `?${qs}` : ''}`);
  },

  async get(id: string): Promise<Types.ResearchScript> {
    return apiFetch<Types.ResearchScript>(`/scripts/${id}`);
  },

  async update(id: string, data: Partial<Types.ResearchScript>): Promise<Types.ResearchScript> {
    return apiFetch<Types.ResearchScript>(`/scripts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiFetch<void>(`/scripts/${id}`, {
      method: 'DELETE',
    });
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
