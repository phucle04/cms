import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeSortAndTakeTop, normalizeToTrendVideo, TikTokService } from './tiktokService';
import type { ApifyTikTokResult } from '../types/apify';

/**
 * Test hàm THUẦN (không gọi mạng): dedupeSortAndTakeTop (lõi logic của PASS 1
 * discoverTrendVideos - bỏ trùng/sort/cắt top N/loại slideshow) và
 * normalizeToTrendVideo (map field thô Apify -> shape TrendVideo). Ngoài ra
 * test hydrateVideoDownloads (PASS 2) ở nhánh fail-safe không cần mạng: thiếu
 * APIFY_API_TOKEN thì trả nguyên dữ liệu PASS 1, không throw.
 */

function makeVideo(overrides: Partial<ApifyTikTokResult> = {}): ApifyTikTokResult {
  return {
    id: 'v1',
    text: 'caption',
    createTimeISO: '2026-01-01T00:00:00.000Z',
    playCount: 1000,
    diggCount: 100,
    shareCount: 10,
    commentCount: 5,
    collectCount: 2,
    webVideoUrl: 'https://www.tiktok.com/@x/video/v1',
    isSlideshow: false,
    isPinned: false,
    isSponsored: false,
    hashtags: [{ name: 'meova' }],
    authorMeta: {
      name: 'authorhandle',
      nickName: 'Author Nick',
      fans: 1000,
      heart: 5000,
      video: 20,
      avatar: 'https://example.com/avatar.jpg',
      verified: false,
      signature: 'bio',
    },
    videoMeta: {
      duration: 30,
      height: 1920,
      width: 1080,
      coverUrl: 'https://example.com/cover.jpg',
      originalCoverUrl: 'https://example.com/original-cover.jpg',
      downloadAddr: 'https://api.apify.com/v2/key-value-stores/store1/records/key1',
      subtitleLinks: [{ language: 'vi', downloadLink: 'https://example.com/sub.vtt' }],
    },
    musicMeta: {
      musicName: 'Original Sound',
      musicAuthor: 'author',
      musicOriginal: true,
    },
    ...overrides,
  };
}

// ============================================================
// dedupeSortAndTakeTop
// ============================================================

test('dedupeSortAndTakeTop: bỏ trùng theo videoId', () => {
  const items = [makeVideo({ id: 'v1', playCount: 100 }), makeVideo({ id: 'v1', playCount: 999 }), makeVideo({ id: 'v2', playCount: 50 })];
  const result = dedupeSortAndTakeTop(items, 10);
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((v) => v.id),
    ['v1', 'v2']
  );
});

test('dedupeSortAndTakeTop: sort theo playCount giảm dần', () => {
  const items = [
    makeVideo({ id: 'a', playCount: 500 }),
    makeVideo({ id: 'b', playCount: 5000 }),
    makeVideo({ id: 'c', playCount: 1000 }),
  ];
  const result = dedupeSortAndTakeTop(items, 10);
  assert.deepEqual(
    result.map((v) => v.id),
    ['b', 'c', 'a']
  );
});

test('dedupeSortAndTakeTop: cắt đúng top N', () => {
  const items = Array.from({ length: 20 }, (_, i) => makeVideo({ id: `v${i}`, playCount: i }));
  const result = dedupeSortAndTakeTop(items, 5);
  assert.equal(result.length, 5);
  assert.deepEqual(
    result.map((v) => v.id),
    ['v19', 'v18', 'v17', 'v16', 'v15']
  );
});

test('dedupeSortAndTakeTop: loại bỏ slideshow', () => {
  const items = [
    makeVideo({ id: 'v1', isSlideshow: true, playCount: 9999 }),
    makeVideo({ id: 'v2', isSlideshow: false, playCount: 1 }),
  ];
  const result = dedupeSortAndTakeTop(items, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'v2');
});

test('dedupeSortAndTakeTop: item thiếu id hoặc rỗng bị bỏ qua', () => {
  const items = [makeVideo({ id: '' }), makeVideo({ id: 'ok' })];
  const result = dedupeSortAndTakeTop(items, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'ok');
});

// ============================================================
// normalizeToTrendVideo
// ============================================================

test('normalizeToTrendVideo: map đúng field đầy đủ', () => {
  const raw = makeVideo();
  const normalized = normalizeToTrendVideo(raw, 'job-1', 'user-1');

  assert.equal(normalized.jobId, 'job-1');
  assert.equal(normalized.userId, 'user-1');
  assert.equal(normalized.videoId, 'v1');
  assert.equal(normalized.caption, 'caption');
  assert.deepEqual(normalized.hashtags, ['meova']);
  assert.equal(normalized.playCount, 1000);
  assert.equal(normalized.authorHandle, 'authorhandle');
  assert.equal(normalized.authorName, 'Author Nick');
  assert.equal(normalized.authorFollowers, 1000);
  assert.equal(normalized.thumbnailUrl, 'https://example.com/cover.jpg');
  assert.equal(normalized.downloadAddr, 'https://api.apify.com/v2/key-value-stores/store1/records/key1');
  assert.equal(normalized.subtitleLinks.length, 1);
  assert.equal(normalized.musicName, 'Original Sound');
  assert.equal(normalized.downloadStatus, 'pending');
});

test('normalizeToTrendVideo: xử lý được field thiếu (videoMeta/authorMeta/musicMeta rỗng)', () => {
  const raw = {
    id: 'v-missing',
    text: '',
    createTimeISO: '',
    playCount: 0,
    diggCount: 0,
    shareCount: 0,
    commentCount: 0,
    collectCount: 0,
    webVideoUrl: '',
    isSlideshow: false,
    isPinned: false,
    isSponsored: false,
    hashtags: undefined,
    authorMeta: undefined,
    videoMeta: undefined,
    musicMeta: undefined,
  } as unknown as ApifyTikTokResult;

  const normalized = normalizeToTrendVideo(raw, 'job-2', 'user-2');

  assert.equal(normalized.videoId, 'v-missing');
  assert.deepEqual(normalized.hashtags, []);
  assert.equal(normalized.authorName, '');
  assert.equal(normalized.authorFollowers, 0);
  assert.equal(normalized.thumbnailUrl, '');
  assert.equal(normalized.downloadAddr, undefined);
  assert.deepEqual(normalized.subtitleLinks, []);
  assert.equal(normalized.musicName, '');
  assert.equal(normalized.downloadStatus, 'pending');
});

// ============================================================
// hydrateVideoDownloads (PASS 2) - nhánh fail-safe, không cần mạng thật
// ============================================================

test('hydrateVideoDownloads: PASS 2 fail (thiếu APIFY_API_TOKEN) -> trả nguyên video PASS 1, KHÔNG throw', async () => {
  const originalToken = process.env.APIFY_API_TOKEN;
  delete process.env.APIFY_API_TOKEN;

  try {
    const service = new TikTokService();
    const discovered = [
      makeVideo({ id: 'v1', playCount: 500 }),
      makeVideo({ id: 'v2', playCount: 300 }),
    ];
    // Mô phỏng đúng kết quả PASS 1 thật: chưa có downloadAddr/subtitleLinks.
    discovered.forEach((v) => {
      v.videoMeta = { ...v.videoMeta, downloadAddr: undefined, subtitleLinks: undefined };
    });

    const result = await service.hydrateVideoDownloads(discovered);

    assert.equal(result.apifyRunId, undefined);
    assert.equal(result.videos.length, 2);
    assert.equal(result.videos[0].id, 'v1');
    assert.equal(result.videos[0].videoMeta.downloadAddr, undefined);
    assert.equal(result.videos[1].id, 'v2');
    assert.equal(result.videos[1].videoMeta.downloadAddr, undefined);
    // playCount và các field khác từ PASS 1 phải giữ nguyên, không bị mất.
    assert.equal(result.videos[0].playCount, 500);
    assert.equal(result.videos[1].playCount, 300);
  } finally {
    if (originalToken !== undefined) process.env.APIFY_API_TOKEN = originalToken;
  }
});

test('hydrateVideoDownloads: mảng video rỗng -> trả về rỗng ngay, không gọi gì', async () => {
  const service = new TikTokService();
  const result = await service.hydrateVideoDownloads([]);
  assert.deepEqual(result.videos, []);
});
