import { TikTokVideo } from '../types';
import { ApifyTikTokResult, NormalizedTrendVideo } from '../types/apify';
import { APIFY_KV_STORE_NAME, APIFY_DISCOVERY_LIMIT } from '../config/env';

// Endpoint actor dùng cho luồng research thật (Giai đoạn 2) - đúng URL
// tiktok-ai/app/src/lib/apify.ts đang dùng thực tế, KHÁC với endpoint
// `run-sync` cũ ở searchByHashtagsLegacy() bên dưới (endpoint đó chưa từng
// được verify khớp actor schema thật).
const HASHTAG_SEARCH_URL =
  'https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items';

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * Đơn giá ước tính (USD/item), suy ra từ các lần chạy thật với actor
 * clockworks~tiktok-scraper (đo ngày 2026-07-27, hashtag 'sữacôngthức'):
 *  - PASS 1 discover (hashtag mode, 30 item, shouldDownloadVideos=false):
 *    tổng $0.1510 -> $0.1510 / 30 ≈ $0.00503/item.
 *  - So sánh bản 1-pass CŨ (30 item, CÓ tải video: $0.1783 tổng) với PASS 1
 *    ở trên (30 item, không tải: $0.1510) -> phần cộng thêm do tải video =
 *    $0.0273, chia cho ~24/30 item có downloadAddr (tỉ lệ ~80% quan sát được
 *    ở các lần chạy khác, actor không phải lúc nào cũng tải được video) ->
 *    ~$0.0273 / 24 ≈ $0.00114/item tải thành công.
 *
 * CẢNH BÁO: đây là ước tính THÔ để LOG tham khảo trước khi chạy job, KHÔNG
 * PHẢI cam kết billing chính xác - giá Apify thật phụ thuộc proxy dùng, độ
 * phức tạp trang, và có thể đổi theo thời gian/actor version. Luôn đối chiếu
 * với hoá đơn Apify thật (GET /v2/actor-runs?token=...) để biết chi phí
 * chính xác, đừng dùng số này để quyết định billing.
 */
const PRICE_PER_DISCOVERY_ITEM_USD = 0.00503;
const PRICE_PER_DOWNLOAD_ITEM_USD = 0.00114;

export function estimateApifyCost(itemCount: number, withVideoDownload: boolean): number {
  if (itemCount <= 0) return 0;
  const base = itemCount * PRICE_PER_DISCOVERY_ITEM_USD;
  const downloadAddon = withVideoDownload ? itemCount * PRICE_PER_DOWNLOAD_ITEM_USD : 0;
  return Math.round((base + downloadAddon) * 100000) / 100000;
}

/**
 * Bỏ trùng theo videoId, loại slideshow, sort theo playCount giảm dần, lấy
 * top N. Hàm THUẦN (không gọi mạng) - dễ test độc lập.
 */
export function dedupeSortAndTakeTop(items: ApifyTikTokResult[], topN: number): ApifyTikTokResult[] {
  const seen = new Set<string>();
  const deduped: ApifyTikTokResult[] = [];

  for (const item of items) {
    if (!item || item.isSlideshow) continue;
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped.sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, topN);
}

/**
 * Chuẩn hoá 1 item thô từ Apify về đúng shape TrendVideo (non-Document).
 * Chịu được field thiếu/undefined ở mọi mức lồng nhau - actor có thể trả về
 * item thiếu videoMeta/authorMeta/musicMeta tuỳ loại nội dung.
 */
export function normalizeToTrendVideo(
  raw: ApifyTikTokResult,
  jobId: string,
  userId: string
): NormalizedTrendVideo {
  return {
    userId,
    jobId,
    videoId: raw?.id || '',
    webVideoUrl: raw?.webVideoUrl || '',
    caption: raw?.text || '',
    hashtags: Array.isArray(raw?.hashtags)
      ? raw.hashtags.map((h) => h?.name).filter((name): name is string => Boolean(name))
      : [],
    playCount: raw?.playCount ?? 0,
    diggCount: raw?.diggCount ?? 0,
    shareCount: raw?.shareCount ?? 0,
    commentCount: raw?.commentCount ?? 0,
    collectCount: raw?.collectCount ?? 0,
    createTimeISO: raw?.createTimeISO || '',
    authorName: raw?.authorMeta?.nickName || raw?.authorMeta?.name || '',
    authorHandle: raw?.authorMeta?.name || '',
    authorFollowers: raw?.authorMeta?.fans ?? 0,
    thumbnailUrl: raw?.videoMeta?.coverUrl || raw?.videoMeta?.originalCoverUrl || '',
    downloadAddr: raw?.videoMeta?.downloadAddr,
    subtitleLinks: Array.isArray(raw?.videoMeta?.subtitleLinks) ? raw.videoMeta.subtitleLinks : [],
    musicName: raw?.musicMeta?.musicName || '',
    downloadStatus: 'pending',
  };
}

export class TikTokService {
  private readonly provider = (process.env.TIKTOK_PROVIDER || 'apify').toLowerCase();
  private readonly token = process.env.APIFY_API_TOKEN || '';
  private readonly actorId = process.env.APIFY_TIKTOK_ACTOR_ID || 'clockworks~tiktok-scraper';

  /**
   * PASS 1 (rẻ) - cào rộng theo hashtag, shouldDownloadVideos=FALSE, KHÔNG
   * tải phụ đề. Trả về metadata đầy đủ (playCount, caption, author...) nhưng
   * CHƯA có downloadAddr/subtitleLinks thật (Apify không tải nên field này
   * rỗng). FAIL-FAST nếu thiếu APIFY_API_TOKEN.
   */
  async discoverTrendVideos(
    hashtags: string[],
    opts: { topN?: number; region?: string; discoveryLimit?: number } = {}
  ): Promise<{ videos: ApifyTikTokResult[]; apifyRunId?: string; totalFetched: number }> {
    if (!this.token) {
      throw new Error('FATAL: APIFY_API_TOKEN is missing - không thể tìm video theo hashtag');
    }

    const normalizedHashtags = hashtags.map((h) => h.replace(/^#/, '').trim()).filter(Boolean);
    if (normalizedHashtags.length === 0) {
      return { videos: [], totalFetched: 0 };
    }

    const topN = opts.topN ?? 5;
    const region = opts.region ?? 'VN';
    const discoveryLimit = opts.discoveryLimit ?? APIFY_DISCOVERY_LIMIT;

    // discoveryLimit là số item MỖI HASHTAG (xem env.ts) - ước tính phải nhân
    // theo số hashtag, không phải dùng thẳng discoveryLimit làm tổng.
    const estimatedItems = normalizedHashtags.length * discoveryLimit;
    const estimatedCost = estimateApifyCost(estimatedItems, false);
    console.log(
      `[TikTokService] Ước tính chi phí PASS 1 (discover): ~${estimatedItems} item ` +
        `(${normalizedHashtags.length} hashtag x ${discoveryLimit} item/hashtag), KHÔNG tải video ` +
        `≈ $${estimatedCost} (ước tính thô, KHÔNG phải giá thật - xem cảnh báo ở estimateApifyCost)`
    );

    const t0 = Date.now();
    const res = await fetchWithTimeout(
      `${HASHTAG_SEARCH_URL}?token=${encodeURIComponent(this.token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashtags: normalizedHashtags,
          resultsPerPage: discoveryLimit,
          shouldDownloadVideos: false,
          downloadSubtitlesOptions: 'NEVER_DOWNLOAD_SUBTITLES',
          proxyCountryCode: region,
        }),
      },
      180_000
    );
    const elapsedMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `[PASS 1] Apify hashtag discovery failed cho [${normalizedHashtags.join(', ')}] (${res.status}): ${errText.slice(0, 300)}`
      );
    }

    const apifyRunId = res.headers.get('x-apify-run-id') || undefined;

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new Error('[PASS 1] Apify trả về JSON không hợp lệ cho hashtag discovery');
    }

    if (!Array.isArray(data)) {
      throw new Error(
        `[PASS 1] Apify trả về dữ liệu không phải mảng cho hashtag discovery: ${JSON.stringify(data).slice(0, 200)}`
      );
    }

    const items = data as ApifyTikTokResult[];
    const topVideos = dedupeSortAndTakeTop(items, topN);

    console.log(
      `[TikTokService] PASS 1 (discover): hashtags=[${normalizedHashtags.join(', ')}] region=${region} ` +
        `resultsPerPage=${discoveryLimit} apifyRunId=${apifyRunId ?? '(không rõ)'} thời gian=${elapsedMs}ms -> ` +
        `${items.length} item thô, giữ top ${topVideos.length} sau bỏ trùng/lọc slideshow/sort`
    );

    return { videos: topVideos, apifyRunId, totalFetched: items.length };
  }

  /**
   * PASS 2 (đắt) - CHỈ tải video/phụ đề cho ĐÚNG danh sách video đã chọn ở
   * PASS 1 (dùng postURLs, không phải hashtag search). Bật shouldDownloadVideos
   * + videoKvStoreIdOrName để Apify tự tải video vào key-value store CỦA NÓ
   * (không chạm CDN TikTok) - đây là lý do server có thể tải video ổn định mà
   * tiktok-ai không làm được.
   *
   * KHÔNG BAO GIỜ throw: nếu PASS 2 fail (network, HTTP lỗi, JSON hỏng...),
   * trả nguyên danh sách video của PASS 1 KHÔNG có downloadAddr - tầng (b)/(c)
   * trong videoDownloadService.ts sẽ lo tiếp, job không được phép chết chỉ vì
   * bước tải video (vốn chỉ là tối ưu, không phải bắt buộc) thất bại.
   */
  async hydrateVideoDownloads(
    videos: ApifyTikTokResult[],
    region: string = 'VN'
  ): Promise<ApifyTikTokResult[]> {
    if (videos.length === 0) return videos;

    if (!this.token) {
      console.warn('[TikTokService] PASS 2 (hydrate): thiếu APIFY_API_TOKEN, bỏ qua - trả video KHÔNG có downloadAddr');
      return videos;
    }

    const urls = videos.map((v) => v.webVideoUrl).filter(Boolean);
    if (urls.length === 0) {
      console.warn('[TikTokService] PASS 2 (hydrate): không có webVideoUrl nào để tải, bỏ qua');
      return videos;
    }

    const estimatedCost = estimateApifyCost(urls.length, true);
    console.log(
      `[TikTokService] Ước tính chi phí PASS 2 (hydrate): ~${urls.length} item, CÓ tải video ` +
        `≈ $${estimatedCost} (ước tính thô, KHÔNG phải giá thật - xem cảnh báo ở estimateApifyCost)`
    );

    const t0 = Date.now();
    try {
      const res = await fetchWithTimeout(
        `${HASHTAG_SEARCH_URL}?token=${encodeURIComponent(this.token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postURLs: urls,
            resultsPerPage: 1,
            shouldDownloadVideos: true,
            videoKvStoreIdOrName: APIFY_KV_STORE_NAME,
            downloadSubtitlesOptions: 'DOWNLOAD_SUBTITLES',
            proxyCountryCode: region,
          }),
        },
        180_000
      );
      const elapsedMs = Date.now() - t0;

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(
          `[TikTokService] PASS 2 (hydrate) FAIL (HTTP ${res.status}) sau ${elapsedMs}ms: ${errText.slice(0, 300)} - ` +
            'trả video KHÔNG có downloadAddr, tầng (b)/(c) sẽ xử lý tiếp'
        );
        return videos;
      }

      const apifyRunId = res.headers.get('x-apify-run-id') || undefined;

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        console.warn(`[TikTokService] PASS 2 (hydrate): JSON không hợp lệ sau ${elapsedMs}ms - trả video KHÔNG có downloadAddr`);
        return videos;
      }

      if (!Array.isArray(data)) {
        console.warn('[TikTokService] PASS 2 (hydrate): dữ liệu không phải mảng - trả video KHÔNG có downloadAddr');
        return videos;
      }

      const hydratedById = new Map<string, ApifyTikTokResult>();
      for (const item of data as ApifyTikTokResult[]) {
        if (item?.id) hydratedById.set(item.id, item);
      }

      let hydratedCount = 0;
      const merged = videos.map((v) => {
        const h = hydratedById.get(v.id);
        const downloadAddr = h?.videoMeta?.downloadAddr;
        const subtitleLinks = h?.videoMeta?.subtitleLinks;
        if (downloadAddr) hydratedCount += 1;

        return {
          ...v,
          videoMeta: {
            ...v.videoMeta,
            downloadAddr: downloadAddr ?? v.videoMeta?.downloadAddr,
            subtitleLinks: subtitleLinks ?? v.videoMeta?.subtitleLinks,
          },
        };
      });

      console.log(
        `[TikTokService] PASS 2 (hydrate): ${urls.length} URL, apifyRunId=${apifyRunId ?? '(không rõ)'} thời gian=${elapsedMs}ms -> ` +
          `${hydratedCount}/${videos.length} video có downloadAddr`
      );

      return merged;
    } catch (error) {
      const elapsedMs = Date.now() - t0;
      console.warn(
        `[TikTokService] PASS 2 (hydrate) LỖI sau ${elapsedMs}ms (không throw, job vẫn tiếp tục bằng tầng (b)/(c)):`,
        error instanceof Error ? error.message : error
      );
      return videos;
    }
  }

  /**
   * Tìm + tải video theo hashtag, tách 2 pass để tối ưu chi phí Apify: PASS 1
   * cào rộng KHÔNG tải video (rẻ), PASS 2 chỉ tải THẬT đúng topN video đã
   * chọn (đắt). Giữ nguyên signature/return type của bản 1-pass cũ để
   * pipeline gọi vào không phải sửa gì.
   */
  async searchTrendVideosByHashtags(
    hashtags: string[],
    opts: { topN?: number; region?: string; maxItemsPerHashtag?: number } = {}
  ): Promise<{ videos: ApifyTikTokResult[]; apifyRunId?: string; totalFetched: number }> {
    const region = opts.region ?? 'VN';

    const discovery = await this.discoverTrendVideos(hashtags, {
      topN: opts.topN,
      region,
      discoveryLimit: opts.maxItemsPerHashtag,
    });

    if (discovery.videos.length === 0) {
      return discovery;
    }

    const hydratedVideos = await this.hydrateVideoDownloads(discovery.videos, region);

    return { videos: hydratedVideos, apifyRunId: discovery.apifyRunId, totalFetched: discovery.totalFetched };
  }

  /**
   * Lấy top comment của 1 video qua 1 lần gọi actor bổ sung (postURLs).
   * KHÔNG có tài liệu công khai xác nhận chính xác shape của comment item
   * (chỉ biết actor trả về field `commentsDatasetURL` trỏ tới 1 dataset
   * riêng) - hàm này vì vậy hoàn toàn phòng thủ: bất kỳ bước nào thất bại
   * hoặc field không khớp kỳ vọng đều trả mảng RỖNG, KHÔNG throw, để không
   * làm chết cả job phân tích chỉ vì lấy comment thất bại.
   */
  async fetchTopComments(
    videoUrl: string,
    limit: number = 20
  ): Promise<Array<{ text: string; likeCount: number; authorHandle: string }>> {
    if (!this.token || !videoUrl) return [];

    try {
      const res = await fetchWithTimeout(
        `${HASHTAG_SEARCH_URL}?token=${encodeURIComponent(this.token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postURLs: [videoUrl],
            resultsPerPage: 1,
            commentsPerPost: limit,
            topLevelCommentsPerPost: limit,
            shouldDownloadVideos: false,
          }),
        },
        60_000
      );

      if (!res.ok) return [];

      const data: unknown = await res.json().catch(() => null);
      if (!Array.isArray(data) || data.length === 0) return [];

      const item = data[0] as ApifyTikTokResult | undefined;
      const commentsDatasetURL = item?.commentsDatasetURL;
      if (!commentsDatasetURL) return [];

      const commentsRes = await fetchWithTimeout(
        `${commentsDatasetURL}${commentsDatasetURL.includes('?') ? '&' : '?'}token=${encodeURIComponent(this.token)}`,
        {},
        30_000
      );
      if (!commentsRes.ok) return [];

      const commentsData: unknown = await commentsRes.json().catch(() => null);
      if (!Array.isArray(commentsData)) return [];

      return commentsData.slice(0, limit).map((raw) => {
        const c = raw as Record<string, unknown>;
        return {
          text: typeof c.text === 'string' ? c.text : '',
          likeCount: typeof c.diggCount === 'number' ? c.diggCount : 0,
          authorHandle:
            typeof c.uniqueId === 'string'
              ? c.uniqueId
              : typeof c.username === 'string'
                ? c.username
                : '',
        };
      });
    } catch (error) {
      console.warn(
        '[TikTokService] fetchTopComments thất bại, trả mảng rỗng (không throw):',
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  /**
   * @deprecated Giữ nguyên tên/hành vi cũ (đổi tên từ `searchByHashtags`) chỉ
   * để không phá vỡ researchController.ts đang gọi nó. Endpoint (`run-sync`)
   * và input shape (`{hashtag, maxItems, addMetadata}`) ở đây CHƯA từng được
   * verify khớp actor schema thật - khác với searchTrendVideosByHashtags()
   * ở trên (endpoint + input đã verify qua docs actor thật, Giai đoạn 2).
   * Đừng dùng hàm này cho code mới.
   */
  async searchByHashtagsLegacy(hashtags: string[], limitPerTag: number = 5): Promise<TikTokVideo[]> {
    const normalizedHashtags = hashtags.filter(Boolean).map((tag) => tag.replace(/^#/, '').trim());

    if (!normalizedHashtags.length) {
      return [];
    }

    if (!this.token || this.provider !== 'apify') {
      return this.getMockVideos(normalizedHashtags, limitPerTag);
    }

    try {
      const results: TikTokVideo[] = [];
      for (const hashtag of normalizedHashtags) {
        const response = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(this.actorId)}/run-sync?token=${encodeURIComponent(this.token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hashtag,
            maxItems: limitPerTag,
            addMetadata: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`Apify request failed with ${response.status}`);
        }

        const payload = await response.json().catch(() => ({}));
        const items = Array.isArray((payload as any)?.defaultDatasetItems)
          ? (payload as any).defaultDatasetItems
          : Array.isArray((payload as any)?.items)
            ? (payload as any).items
            : [];

        for (const item of items.slice(0, limitPerTag)) {
          results.push({
            id: item.id || `${hashtag}-${results.length}`,
            url: item.url || `https://www.tiktok.com/@example/video/${results.length}`,
            views: Number(item.playCount || item.views || item.statistics?.playCount || 0),
            caption: item.text || item.caption || `Trending content for #${hashtag}`,
            captionsUrl: item.captionsUrl || undefined,
          });
        }
      }

      return this.getTop5ByViews(results);
    } catch (error) {
      console.warn('[TikTokService] Provider request failed, using mock fallback:', error);
      return this.getMockVideos(normalizedHashtags, limitPerTag);
    }
  }

  getTop5ByViews(videos: TikTokVideo[]): TikTokVideo[] {
    return [...videos]
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }

  async getTranscript(video: TikTokVideo): Promise<string> {
    if (video.caption && video.caption.trim()) {
      return video.caption.trim();
    }

    if (video.captionsUrl) {
      try {
        const response = await fetch(video.captionsUrl);
        if (response.ok) {
          const text = await response.text();
          return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      } catch (error) {
        console.warn('[TikTokService] Failed to fetch captions URL, falling back to mock transcript:', error);
      }
    }

    return this.getMockTranscript(video);
  }

  private getMockVideos(hashtags: string[], limitPerTag: number): TikTokVideo[] {
    const results: TikTokVideo[] = [];
    hashtags.forEach((hashtag, idx) => {
      for (let i = 0; i < Math.min(limitPerTag, 3); i += 1) {
        const views = 1200000 - (idx * 120000) - (i * 40000);
        results.push({
          id: `mock-${hashtag}-${i}`,
          url: `https://www.tiktok.com/@example/video/${hashtag}-${i}`,
          views,
          caption: `Mock viral caption for #${hashtag}: ${['hook', 'problem', 'solution', 'story'][i % 4]} based trend example.`,
        });
      }
    });

    return this.getTop5ByViews(results);
  }

  private getMockTranscript(video: TikTokVideo): string {
    const base = video.caption || 'Mock transcript';
    return `${base}\n\nSample viral pattern: strong hook, quick problem setup, clear payoff, and direct CTA.`;
  }
}

export default TikTokService;
