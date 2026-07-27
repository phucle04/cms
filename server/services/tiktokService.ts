import { TikTokVideo } from '../types';
import { ApifyTikTokResult, NormalizedTrendVideo } from '../types/apify';
import { APIFY_KV_STORE_NAME, APIFY_DISCOVERY_LIMIT } from '../config/env';

const ACTOR_ID = 'clockworks~tiktok-scraper';
const ACTOR_RUNS_URL = `https://api.apify.com/v2/acts/${ACTOR_ID}/runs`;
const actorRunStatusUrl = (runId: string) => `https://api.apify.com/v2/actor-runs/${runId}`;
const datasetItemsUrl = (datasetId: string) => `https://api.apify.com/v2/datasets/${datasetId}/items`;

// Endpoint SYNC cũ - vẫn dùng cho fetchTopComments() (chưa cần track runId/cost
// chính xác ở đó, xem ghi chú tại hàm đó). PASS 1/PASS 2 KHÔNG dùng endpoint
// này nữa (xem runApifyActor) vì nó không trả runId đáng tin cậy - đã verify
// thật: header `x-apify-run-id` KHÔNG tồn tại trong response (2026-07-27).
const HASHTAG_SEARCH_URL = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items`;

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ApifyRunOutcome {
  runId: string;
  datasetId: string;
  status: string;
  items: ApifyTikTokResult[];
}

interface ApifyRunApiResponse {
  data?: {
    id?: string;
    defaultDatasetId?: string;
    status?: string;
    usageTotalUsd?: number;
  };
}

const TERMINAL_STATUSES = ['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'];

/**
 * Chạy actor bằng API BẤT ĐỒNG BỘ (start run -> poll status -> đọc dataset),
 * KHÔNG dùng run-sync-get-dataset-items. Lý do: đã verify thật (2026-07-27)
 * là run-sync-get-dataset-items không trả runId ở đâu cả (không có header
 * x-apify-run-id, body chỉ là mảng item trần) - không có cách nào tra chi phí
 * thật của 1 lần gọi cụ thể nếu dùng endpoint đó. API bất đồng bộ trả `data.id`
 * ngay khi start, dùng để tra chi phí thật sau (xem fetchApifyRunCost).
 */
async function runApifyActor(
  token: string,
  input: Record<string, unknown>,
  opts: { label: string; timeoutMs?: number; pollIntervalMs?: number }
): Promise<ApifyRunOutcome> {
  const timeoutMs = opts.timeoutMs ?? 240_000;
  const pollIntervalMs = opts.pollIntervalMs ?? 3000;

  const startRes = await fetchWithTimeout(
    `${ACTOR_RUNS_URL}?token=${encodeURIComponent(token)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    30_000
  );

  if (!startRes.ok) {
    const errText = await startRes.text().catch(() => '');
    throw new Error(`[${opts.label}] Apify không khởi động được run (${startRes.status}): ${errText.slice(0, 300)}`);
  }

  const startBody = (await startRes.json()) as ApifyRunApiResponse;
  const runId = startBody.data?.id;
  const datasetId = startBody.data?.defaultDatasetId;

  if (!runId || !datasetId) {
    throw new Error(`[${opts.label}] Apify start run không trả về id/defaultDatasetId hợp lệ`);
  }

  const deadline = Date.now() + timeoutMs;
  let status: string = startBody.data?.status ?? 'READY';

  while (!TERMINAL_STATUSES.includes(status)) {
    if (Date.now() > deadline) {
      throw new Error(`[${opts.label}] Apify run ${runId} vượt timeout ${timeoutMs}ms (status cuối=${status})`);
    }

    await sleep(pollIntervalMs);

    const pollRes = await fetchWithTimeout(`${actorRunStatusUrl(runId)}?token=${encodeURIComponent(token)}`, {}, 30_000);
    if (pollRes.ok) {
      const pollBody = (await pollRes.json()) as ApifyRunApiResponse;
      status = pollBody.data?.status ?? status;
    }
    // poll fail tạm thời -> vòng lại thử tiếp, không throw ngay (deadline lo phần timeout)
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`[${opts.label}] Apify run ${runId} kết thúc với status=${status}, không có dữ liệu tin cậy`);
  }

  const itemsRes = await fetchWithTimeout(
    `${datasetItemsUrl(datasetId)}?token=${encodeURIComponent(token)}&format=json`,
    {},
    60_000
  );

  if (!itemsRes.ok) {
    const errText = await itemsRes.text().catch(() => '');
    throw new Error(`[${opts.label}] Không đọc được dataset ${datasetId} (${itemsRes.status}): ${errText.slice(0, 300)}`);
  }

  const items = await itemsRes.json();
  if (!Array.isArray(items)) {
    throw new Error(`[${opts.label}] Dataset ${datasetId} không trả về mảng`);
  }

  return { runId, datasetId, status, items: items as ApifyTikTokResult[] };
}

/**
 * Tra chi phí THẬT (usageTotalUsd) của 1 run đã chạy xong, qua Apify Actor
 * API. QUAN TRỌNG - đã verify thật (2026-07-27): `usageTotalUsd` CHƯA settle
 * ngay lúc status chuyển SUCCEEDED (đo được $0.001 ngay lúc SUCCEEDED, 5s sau
 * đọc lại ra đúng $0.011) - vì vậy hàm này chờ graceDelayMs (mặc định 5s)
 * trước khi đọc, để giảm rủi ro under-count. Vẫn có thể chưa phải số cuối
 * cùng tuyệt đối nếu Apify settle chậm hơn - đây là hạn chế đã biết của
 * Apify billing API, không phải bug ở đây.
 */
export async function fetchApifyRunCost(runId: string, opts: { graceDelayMs?: number } = {}): Promise<number> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token || !runId) return 0;

  const graceDelayMs = opts.graceDelayMs ?? 5000;
  await sleep(graceDelayMs);

  try {
    const res = await fetchWithTimeout(`${actorRunStatusUrl(runId)}?token=${encodeURIComponent(token)}`, {}, 30_000);
    if (!res.ok) return 0;
    const body = (await res.json()) as ApifyRunApiResponse;
    const usd = body.data?.usageTotalUsd;
    return typeof usd === 'number' ? usd : 0;
  } catch (error) {
    console.warn(`[TikTokService] fetchApifyRunCost(${runId}) thất bại, trả 0:`, error instanceof Error ? error.message : error);
    return 0;
  }
}

/**
 * Đơn giá CHÍNH XÁC theo sự kiện, lấy trực tiếp từ Apify Actor API
 * (GET .../acts/clockworks~tiktok-scraper/runs -> response.data.pricingInfo
 * .pricingPerEvent.actorChargeEvents), đọc thật ngày 2026-07-27. Verify công
 * thức khớp CHÍNH XÁC với chi phí thật đo được:
 *  - PASS 1: 45 item, không tải = 45x(0.0037+0.0013) + 0.001 = $0.226 (khớp
 *    tuyệt đối với run thật $0.2260).
 *  - PASS 2: 5 item, 4 tải thành công = 5x(0.0037+0.0013) + 4x0.0013 + 0.001
 *    = $0.0312 (khớp tuyệt đối với run thật $0.0312).
 * CẢNH BÁO: giá Apify có thể đổi theo thời gian/actor version - đây vẫn là
 * ƯỚC TÍNH trước khi chạy, không phải billing thật. Dùng fetchApifyRunCost()
 * để lấy số liệu billing thật SAU khi chạy.
 */
const PRICE_PER_RESULT_USD = 0.0037;
const PRICE_PER_COUNTRY_SCRAPE_USD = 0.0013; // add-on "scrape-as-in-country" - luôn áp dụng vì luôn set proxyCountryCode
const PRICE_PER_VIDEO_DOWNLOAD_USD = 0.0013;
const PRICE_ACTOR_START_USD = 0.001; // phí cố định 1 lần/run

export function estimateApifyCost(itemCount: number, withVideoDownload: boolean): number {
  if (itemCount <= 0) return 0;
  const perItem = PRICE_PER_RESULT_USD + PRICE_PER_COUNTRY_SCRAPE_USD + (withVideoDownload ? PRICE_PER_VIDEO_DOWNLOAD_USD : 0);
  const total = itemCount * perItem + PRICE_ACTOR_START_USD;
  return Math.round(total * 100000) / 100000;
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
    const outcome = await runApifyActor(
      this.token,
      {
        hashtags: normalizedHashtags,
        resultsPerPage: discoveryLimit,
        shouldDownloadVideos: false,
        downloadSubtitlesOptions: 'NEVER_DOWNLOAD_SUBTITLES',
        proxyCountryCode: region,
      },
      { label: 'PASS 1 discover' }
    );
    const elapsedMs = Date.now() - t0;

    const topVideos = dedupeSortAndTakeTop(outcome.items, topN);

    console.log(
      `[TikTokService] PASS 1 (discover): hashtags=[${normalizedHashtags.join(', ')}] region=${region} ` +
        `resultsPerPage=${discoveryLimit} apifyRunId=${outcome.runId} thời gian=${elapsedMs}ms -> ` +
        `${outcome.items.length} item thô, giữ top ${topVideos.length} sau bỏ trùng/lọc slideshow/sort`
    );

    return { videos: topVideos, apifyRunId: outcome.runId, totalFetched: outcome.items.length };
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
  ): Promise<{ videos: ApifyTikTokResult[]; apifyRunId?: string }> {
    if (videos.length === 0) return { videos };

    if (!this.token) {
      console.warn('[TikTokService] PASS 2 (hydrate): thiếu APIFY_API_TOKEN, bỏ qua - trả video KHÔNG có downloadAddr');
      return { videos };
    }

    const urls = videos.map((v) => v.webVideoUrl).filter(Boolean);
    if (urls.length === 0) {
      console.warn('[TikTokService] PASS 2 (hydrate): không có webVideoUrl nào để tải, bỏ qua');
      return { videos };
    }

    const estimatedCost = estimateApifyCost(urls.length, true);
    console.log(
      `[TikTokService] Ước tính chi phí PASS 2 (hydrate): ~${urls.length} item, CÓ tải video ` +
        `≈ $${estimatedCost} (ước tính thô, KHÔNG phải giá thật - xem cảnh báo ở estimateApifyCost)`
    );

    const t0 = Date.now();
    try {
      const outcome = await runApifyActor(
        this.token,
        {
          postURLs: urls,
          resultsPerPage: 1,
          shouldDownloadVideos: true,
          videoKvStoreIdOrName: APIFY_KV_STORE_NAME,
          downloadSubtitlesOptions: 'DOWNLOAD_SUBTITLES',
          proxyCountryCode: region,
        },
        { label: 'PASS 2 hydrate' }
      );
      const elapsedMs = Date.now() - t0;

      const hydratedById = new Map<string, ApifyTikTokResult>();
      for (const item of outcome.items) {
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
        `[TikTokService] PASS 2 (hydrate): ${urls.length} URL, apifyRunId=${outcome.runId} thời gian=${elapsedMs}ms -> ` +
          `${hydratedCount}/${videos.length} video có downloadAddr`
      );

      return { videos: merged, apifyRunId: outcome.runId };
    } catch (error) {
      const elapsedMs = Date.now() - t0;
      console.warn(
        `[TikTokService] PASS 2 (hydrate) LỖI sau ${elapsedMs}ms (không throw, job vẫn tiếp tục bằng tầng (b)/(c)):`,
        error instanceof Error ? error.message : error
      );
      return { videos };
    }
  }

  /**
   * Tìm + tải video theo hashtag, tách 2 pass để tối ưu chi phí Apify: PASS 1
   * cào rộng KHÔNG tải video (rẻ), PASS 2 chỉ tải THẬT đúng topN video đã
   * chọn (đắt). Tự tra chi phí THẬT của cả 2 pass qua fetchApifyRunCost() sau
   * khi xong (song song, ~5s grace delay mỗi cái) và trả về apifyActualUsd -
   * pipeline (researchPipelineService.ts) cộng thẳng vào ResearchJob.cost,
   * không cần tự biết runId của từng pass.
   */
  async searchTrendVideosByHashtags(
    hashtags: string[],
    opts: { topN?: number; region?: string; maxItemsPerHashtag?: number } = {}
  ): Promise<{ videos: ApifyTikTokResult[]; apifyRunId?: string; totalFetched: number; apifyActualUsd: number }> {
    const region = opts.region ?? 'VN';

    const discovery = await this.discoverTrendVideos(hashtags, {
      topN: opts.topN,
      region,
      discoveryLimit: opts.maxItemsPerHashtag,
    });

    if (discovery.videos.length === 0) {
      const discoverCost = discovery.apifyRunId ? await fetchApifyRunCost(discovery.apifyRunId) : 0;
      return { ...discovery, apifyActualUsd: discoverCost };
    }

    const hydrateResult = await this.hydrateVideoDownloads(discovery.videos, region);

    const [discoverCost, hydrateCost] = await Promise.all([
      discovery.apifyRunId ? fetchApifyRunCost(discovery.apifyRunId) : Promise.resolve(0),
      hydrateResult.apifyRunId ? fetchApifyRunCost(hydrateResult.apifyRunId) : Promise.resolve(0),
    ]);
    const apifyActualUsd = discoverCost + hydrateCost;

    console.log(
      `[TikTokService] Chi phí Apify THẬT: PASS 1=$${discoverCost} + PASS 2=$${hydrateCost} = $${apifyActualUsd}`
    );

    return {
      videos: hydrateResult.videos,
      apifyRunId: discovery.apifyRunId,
      totalFetched: discovery.totalFetched,
      apifyActualUsd,
    };
  }

  /**
   * Lấy top comment của 1 video qua 1 lần gọi actor bổ sung (postURLs).
   * Đã VERIFY THẬT (2026-07-27): field đúng là `commentsDatasetUrl` (chữ
   * "rl" thường - bug ban đầu dùng nhầm `commentsDatasetURL` hoa khiến hàm
   * này luôn trả [] dù comment thật tồn tại, đã sửa). Shape comment item đã
   * verify thật: { text, diggCount, uniqueId, cid, replyCommentTotal, ... }.
   * Vẫn giữ toàn bộ logic phòng thủ (try/catch, kiểm tra kiểu dữ liệu từng
   * field) vì Apify không cam kết hợp đồng field chính thức qua docs công
   * khai - bất kỳ bước nào thất bại đều trả mảng RỖNG, KHÔNG throw.
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
      const commentsDatasetUrl = item?.commentsDatasetUrl;
      if (!commentsDatasetUrl) return [];

      const commentsRes = await fetchWithTimeout(
        `${commentsDatasetUrl}${commentsDatasetUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(this.token)}`,
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
