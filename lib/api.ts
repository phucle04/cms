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

  async bulkUpdate(ids: string[], data: Partial<Types.Idea>): Promise<Types.Idea[]> {
    return apiFetch<Types.Idea[]>('/ideas/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ ids, data }),
    });
  },
};

// ============================================================
// Product API — ⚠️ CHỜ BACKEND: chưa có route /products
// Gọi theo chuẩn REST, sẽ hoạt động ngay khi backend bổ sung
// productController.ts + router.use('/products', ...) trong api.ts
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

export const ResearchAPI = {
  async run(productId?: string, hashtags?: string[]): Promise<Types.TrendResearchResult> {
    return apiFetch<Types.TrendResearchResult>('/research/run', {
      method: 'POST',
      body: JSON.stringify({ productId, hashtags }),
    });
  },
};

// ============================================================
// ⚠️ CÁC API DƯỚI ĐÂY VẪN LÀ MOCK DATA (dữ liệu giả, lưu tạm
// trong bộ nhớ trình duyệt) — vì backend hiện tại (server/routes)
// chỉ mới có route cho "ideas". Các API này giữ nguyên như file
// gốc để KHÔNG làm vỡ các trang khác đang dùng chúng.
// Khi cần nối API nào sang backend thật, báo em để làm tiếp
// theo đúng cách đã làm với IdeaAPI/ProductAPI.
// ============================================================

let mockDatabase = {
  brandVoice: {} as Record<string, Types.BrandVoice>,
  personas: {} as Record<string, Types.AudiencePersona>,
  compliance: {} as Record<string, Types.ComplianceRule>,
  storeInfo: {} as Record<string, Types.StoreBrandInfo>,
  keywords: {} as Record<string, Types.KeywordSet>,
  trends: {} as Record<string, Types.Trend>,
  competitors: {} as Record<string, Types.Competitor>,
  viralVideos: {} as Record<string, Types.ViralVideo>,
  comments: {} as Record<string, Types.CommentMining>,
  scripts: {} as Record<string, Types.Script>,
  storyboards: {} as Record<string, Types.Storyboard>,
  audio: {} as Record<string, Types.AudioGuide>,
  metadata: {} as Record<string, Types.VideoMetadata>,
  thumbnails: {} as Record<string, Types.ThumbnailBrief>,
  kpis: {} as Record<string, Types.VideoKPI>,
  analysis: {} as Record<string, Types.WinLossAnalysis>,
  lessons: {} as Record<string, Types.Lesson>,
  archive: [] as Types.ArchiveItem[],
  settings: {} as Record<string, Types.AppSettings>,
};

function initializeMockData() {
  mockDatabase.brandVoice['default'] = {
    id: 'default',
    tone: 'Friendly, energetic, and relatable',
    personality: ['authentic', 'empowering', 'supportive'],
    dos: ['Be authentic', 'Share real stories', 'Show personality'],
    donts: ['Be preachy', 'Use jargon', 'Ignore feedback'],
    ctaSamples: ['Try this today', 'Join thousands of moms', 'Let me know in comments'],
    updatedAt: new Date().toISOString(),
  };

  mockDatabase.personas['default'] = {
    id: 'default',
    mainPersona: {
      id: 'main-1',
      name: 'Young Mama',
      painPoints: ['Time management', 'Self-doubt', 'Comparison'],
      goals: ['Feel confident', 'Connect with community', 'Efficient routines'],
      behaviors: ['Active on social media', 'Seeks validation', 'Open to learning'],
    },
    subPersonas: [
      {
        id: 'sub-1',
        name: 'New Mom',
        painPoints: ['Overwhelm', 'Sleep deprivation', 'Lack of support'],
        goals: ['Survive first year', 'Build confidence', 'Find community'],
        behaviors: ['Searching for help', 'Anxious', 'Eager to learn'],
      },
      {
        id: 'sub-2',
        name: 'Experienced Mom',
        painPoints: ['Feeling bored', 'Unappreciated', 'Stagnation'],
        goals: ['Feel inspired', 'Find purpose', 'Help others'],
        behaviors: ['Mentoring', 'Sharing experiences', 'Less social media'],
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  mockDatabase.compliance['default'] = {
    id: 'default',
    category: 'Medical Claims',
    rule: 'Cannot claim to cure or treat conditions',
    bannedWords: ['cure', 'treat', 'medical', 'diagnosis'],
    alternatives: ['support', 'may help with', 'some people find helpful'],
  };

  mockDatabase.storeInfo['default'] = {
    id: 'default',
    storeName: 'Baby Care Store',
    branches: ['New York', 'Los Angeles', 'Chicago'],
    promotions: ['Summer Sale 30% off', 'New Year Bundle Deals'],
    contactInfo: '+1-800-BABY-CARE',
    updatedAt: new Date().toISOString(),
  };

  mockDatabase.keywords['default'] = {
    id: 'default',
    groups: [
      { id: 'seo-1', type: 'seo', keywords: ['baby care tips', 'newborn essentials', 'parenting hacks'] },
      { id: 'hashtag-1', type: 'hashtag', keywords: ['#MomLife', '#BabyCare', '#ParentingTips'] },
    ],
    updatedAt: new Date().toISOString(),
  };

  const trendIds = ['trend-1', 'trend-2', 'trend-3', 'trend-4'];
  trendIds.forEach((id, idx) => {
    mockDatabase.trends[id] = {
      id,
      name: `Trending Topic ${idx + 1}`,
      category: ['Baby Care', 'Parenting Tips', 'Wellness', 'Lifestyle'][idx],
      source: ['TikTok Discover', 'Instagram Reels', 'YouTube Shorts', 'Twitter'][idx],
      relevance: ['high', 'high', 'medium', 'low'][idx] as any,
      contentIdeas: ['Create tutorial', 'Share tips', 'Host Q&A'],
      status: ['hot', 'new', 'cold', 'archived'][idx] as any,
      createdAt: new Date(Date.now() - idx * 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  mockDatabase.competitors['comp-1'] = {
    id: 'comp-1',
    name: 'Parenting Expert Pro',
    platform: 'TikTok',
    handle: '@parentingexpertpro',
    followers: 250000,
    averageViews: 85000,
    strengths: ['High engagement', 'Consistent posting', 'Educational content'],
    weaknesses: ['Formal tone', 'Long videos', 'Limited variety'],
    analysisDate: new Date().toISOString(),
  };

  mockDatabase.scripts['formula-1'] = {
    id: 'formula-1',
    ideaId: 'idea-1',
    title: 'DIY Diaper Rash Remedies Script',
    segments: [
      { seconds: 0, voiceover: 'Tired of expensive diaper rash treatments?', textOverlay: 'DIY Remedies', visual: 'Close-up of baby', sound: 'Energetic background music' },
      { seconds: 5, voiceover: 'Try these 3 simple remedies at home', textOverlay: 'Remedy #1', visual: 'Product demonstration', sound: 'Upbeat transition' },
    ],
    totalDuration: 60,
    notes: 'Perfect for TikTok/Reels format',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;

  mockDatabase.kpis['kpi-1'] = {
    id: 'kpi-1', scriptId: 'formula-1', views: 125000, likes: 8500, comments: 2300, shares: 890, avgWatchTime: 45, rank: 'A',
    recordedAt: new Date().toISOString(),
  };

  mockDatabase.kpis['kpi-2'] = {
    id: 'kpi-2', scriptId: 'formula-1', views: 42000, likes: 2100, comments: 420, shares: 150, avgWatchTime: 28, rank: 'C',
    recordedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  mockDatabase.settings['default'] = {
    id: 'default',
    aiApiEndpoint: process.env.NEXT_PUBLIC_AI_ENDPOINT || '',
    aiApiKey: process.env.NEXT_PUBLIC_AI_KEY || '',
    aiModel: 'gpt-4',
    aiTemperature: 0.7,
    autoArchiveOldTrends: true,
    autoArchiveDays: 30,
    updatedAt: new Date().toISOString(),
  };
}

initializeMockData();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateRank(data: Omit<Types.VideoKPI, 'id' | 'rank' | 'timestamp'>): Types.VideoKPI['rank'] {
  if (data.views > 200000 || data.likes > 10000) return 'S';
  if ((data.views >= 50000 && data.views <= 200000) || (data.likes >= 2000 && data.likes <= 10000)) return 'A';
  if ((data.views >= 10000 && data.views < 50000) || (data.likes >= 500 && data.likes < 2000)) return 'B';
  if ((data.views >= 2000 && data.views < 10000) || (data.likes >= 100 && data.likes < 500)) return 'C';
  return 'D';
}

export const BrandVoiceAPI = {
  async get(): Promise<Types.BrandVoice | null> { return mockDatabase.brandVoice['default'] || null; },
  async update(data: Partial<Types.BrandVoice>): Promise<Types.BrandVoice> {
    const updated = { ...mockDatabase.brandVoice['default'], ...data, updatedAt: new Date().toISOString() };
    mockDatabase.brandVoice['default'] = updated;
    return updated;
  },
};

export const PersonaAPI = {
  async get(): Promise<Types.AudiencePersona | null> { return mockDatabase.personas['default'] || null; },
  async update(data: Partial<Types.AudiencePersona>): Promise<Types.AudiencePersona> {
    const updated = { ...mockDatabase.personas['default'], ...data, updatedAt: new Date().toISOString() };
    mockDatabase.personas['default'] = updated;
    return updated;
  },
};

export const ComplianceAPI = {
  async list(): Promise<Types.ComplianceRule[]> { return Object.values(mockDatabase.compliance); },
  async get(id: string): Promise<Types.ComplianceRule | null> { return mockDatabase.compliance[id] || null; },
  async create(data: Omit<Types.ComplianceRule, 'id'>): Promise<Types.ComplianceRule> {
    const id = generateId('compliance');
    const item = { ...data, id };
    mockDatabase.compliance[id] = item;
    return item;
  },
  async update(id: string, data: Partial<Types.ComplianceRule>): Promise<Types.ComplianceRule> {
    const item = mockDatabase.compliance[id];
    if (!item) throw new Error('Not found');
    const updated = { ...item, ...data };
    mockDatabase.compliance[id] = updated;
    return updated;
  },
  async delete(id: string): Promise<void> { delete mockDatabase.compliance[id]; },
};

export const StoreInfoAPI = {
  async get(): Promise<Types.StoreBrandInfo | null> { return mockDatabase.storeInfo['default'] || null; },
  async update(data: Partial<Types.StoreBrandInfo>): Promise<Types.StoreBrandInfo> {
    const updated = { ...mockDatabase.storeInfo['default'], ...data, updatedAt: new Date().toISOString() };
    mockDatabase.storeInfo['default'] = updated;
    return updated;
  },
};

export const KeywordAPI = {
  async get(): Promise<Types.KeywordSet | null> { return mockDatabase.keywords['default'] || null; },
  async update(data: Partial<Types.KeywordSet>): Promise<Types.KeywordSet> {
    const updated = { ...mockDatabase.keywords['default'], ...data, updatedAt: new Date().toISOString() };
    mockDatabase.keywords['default'] = updated;
    return updated;
  },
};

export const TrendAPI = {
  async list(): Promise<Types.Trend[]> { return Object.values(mockDatabase.trends).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); },
  async listByStatus(status: Types.Trend['status']): Promise<Types.Trend[]> {
    return Object.values(mockDatabase.trends).filter(t => t.status === status).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  async get(id: string): Promise<Types.Trend | null> { return mockDatabase.trends[id] || null; },
  async create(data: Omit<Types.Trend, 'id'>): Promise<Types.Trend> {
    const id = generateId('trend');
    const item = { ...data, id };
    mockDatabase.trends[id] = item;
    return item;
  },
  async update(id: string, data: Partial<Types.Trend>): Promise<Types.Trend> {
    const item = mockDatabase.trends[id];
    if (!item) throw new Error('Not found');
    const updated = { ...item, ...data, updatedAt: new Date().toISOString() };
    mockDatabase.trends[id] = updated;
    return updated;
  },
  async delete(id: string): Promise<void> { delete mockDatabase.trends[id]; },
};

export const CompetitorAPI = {
  async list(): Promise<Types.Competitor[]> { return Object.values(mockDatabase.competitors); },
  async get(id: string): Promise<Types.Competitor | null> { return mockDatabase.competitors[id] || null; },
  async create(data: Omit<Types.Competitor, 'id'>): Promise<Types.Competitor> {
    const id = generateId('competitor');
    const item = { ...data, id };
    mockDatabase.competitors[id] = item;
    return item;
  },
  async update(id: string, data: Partial<Types.Competitor>): Promise<Types.Competitor> {
    const item = mockDatabase.competitors[id];
    if (!item) throw new Error('Not found');
    const updated = { ...item, ...data };
    mockDatabase.competitors[id] = updated;
    return updated;
  },
  async delete(id: string): Promise<void> { delete mockDatabase.competitors[id]; },
};

export const ScriptAPI = {
  async list(): Promise<Types.Script[]> { return Object.values(mockDatabase.scripts).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); },
  async get(id: string): Promise<Types.Script | null> { return mockDatabase.scripts[id] || null; },
  async create(data: Omit<Types.Script, 'id' | 'createdAt' | 'updatedAt'>): Promise<Types.Script> {
    const id = generateId('script');
    const now = new Date().toISOString();
    const item = { ...data, id, createdAt: now, updatedAt: now };
    mockDatabase.scripts[id] = item;
    return item;
  },
  async update(id: string, data: Partial<Types.Script>): Promise<Types.Script> {
    const item = mockDatabase.scripts[id];
    if (!item) throw new Error('Not found');
    const updated = { ...item, ...data, updatedAt: new Date().toISOString() };
    mockDatabase.scripts[id] = updated;
    return updated;
  },
  async delete(id: string): Promise<void> { delete mockDatabase.scripts[id]; },
};

export const KPIAPI = {
  async list(): Promise<Types.VideoKPI[]> { return Object.values(mockDatabase.kpis).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); },
  async get(id: string): Promise<Types.VideoKPI | null> { return mockDatabase.kpis[id] || null; },
  async create(data: Omit<Types.VideoKPI, 'id' | 'rank'>): Promise<Types.VideoKPI> {
    const id = generateId('kpi');
    const rank = calculateRank(data);
    const item: Types.VideoKPI = { ...data, id, rank };
    mockDatabase.kpis[id] = item;
    return item;
  },
  async update(id: string, data: Partial<Omit<Types.VideoKPI, 'id' | 'rank'>>): Promise<Types.VideoKPI> {
    const item = mockDatabase.kpis[id];
    if (!item) throw new Error('Not found');
    const rank = calculateRank({ ...item, ...data });
    const updated: Types.VideoKPI = { ...item, ...data, rank };
    mockDatabase.kpis[id] = updated;
    return updated;
  },
  async delete(id: string): Promise<void> { delete mockDatabase.kpis[id]; },
  async getTopPerformers(limit: number = 5): Promise<Types.VideoKPI[]> {
    return Object.values(mockDatabase.kpis).sort((a, b) => b.views - a.views).slice(0, limit);
  },
};

export const SettingsAPI = {
  async get(): Promise<Types.AppSettings | null> { return mockDatabase.settings['default'] || null; },
  async update(data: Partial<Types.AppSettings>): Promise<Types.AppSettings> {
    const updated = { ...mockDatabase.settings['default'], ...data, updatedAt: new Date().toISOString() };
    mockDatabase.settings['default'] = updated;
    return updated;
  },
};

export const AnalysisAPI = {
  async create(data: Omit<Types.WinLossAnalysis, 'id'>): Promise<Types.WinLossAnalysis> {
    const analysis: Types.WinLossAnalysis = { ...data, id: generateId('analysis') };
    mockDatabase.analysis[analysis.id] = analysis;
    return analysis;
  },
  async list(): Promise<Types.WinLossAnalysis[]> { return Object.values(mockDatabase.analysis); },
  async get(id: string): Promise<Types.WinLossAnalysis | null> { return mockDatabase.analysis[id] || null; },
  async delete(id: string): Promise<void> { delete mockDatabase.analysis[id]; },
};

export const LessonAPI = {
  async create(data: Omit<Types.Lesson, 'id'>): Promise<Types.Lesson> {
    const lesson: Types.Lesson = { ...data, id: generateId('lesson') };
    mockDatabase.lessons[lesson.id] = lesson;
    return lesson;
  },
  async list(): Promise<Types.Lesson[]> { return Object.values(mockDatabase.lessons); },
  async get(id: string): Promise<Types.Lesson | null> { return mockDatabase.lessons[id] || null; },
  async update(id: string, data: Partial<Omit<Types.Lesson, 'id'>>): Promise<Types.Lesson> {
    const lesson = mockDatabase.lessons[id];
    if (!lesson) throw new Error('Lesson not found');
    const updated = { ...lesson, ...data };
    mockDatabase.lessons[id] = updated;
    return updated;
  },
  async delete(id: string): Promise<void> { delete mockDatabase.lessons[id]; },
};

export const ArchiveAPI = {
  async list(): Promise<Types.ArchiveItem[]> { return mockDatabase.archive; },
  async archive(item: Omit<Types.ArchiveItem, 'id' | 'archivedAt'>): Promise<Types.ArchiveItem> {
    const archiveItem: Types.ArchiveItem = { ...item, id: generateId('archive'), archivedAt: new Date().toISOString() };
    mockDatabase.archive.push(archiveItem);
    return archiveItem;
  },
  async restore(id: string): Promise<void> {
    mockDatabase.archive = mockDatabase.archive.filter(item => item.id !== id);
  },
};