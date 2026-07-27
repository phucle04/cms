import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { downloadVideo, cleanupJobTempFiles, type DownloadableVideo } from './videoDownloadService';
import { VIDEO_TMP_DIR } from '../config/env';

/**
 * Test downloadVideo với cả 3 tầng được mock qua tham số tierFns (dependency
 * injection có sẵn trong videoDownloadService.ts) - KHÔNG gọi mạng/child_process
 * thật. Tầng (c) text_only không cần mock vì là nhánh mặc định khi cả 2 tầng
 * kia đều fail.
 */

const video: DownloadableVideo = {
  videoId: 'v1',
  webVideoUrl: 'https://www.tiktok.com/@x/video/v1',
  downloadAddr: 'https://api.apify.com/v2/key-value-stores/store1/records/key1',
};

test('downloadVideo: tầng (a) Apify KV store thành công -> downloaded_apify', async () => {
  const result = await downloadVideo(
    { video, jobId: 'job-1' },
    {
      tryApifyKvStore: async () => true,
      tryYtDlp: async () => {
        throw new Error('KHÔNG được gọi tới tầng yt-dlp khi tầng (a) đã thành công');
      },
    }
  );

  assert.equal(result.status, 'downloaded_apify');
  assert.equal(result.source, 'apify_kv_store');
  assert.ok(result.filePath);
});

test('downloadVideo: tầng (a) fail, tầng (b) yt-dlp thành công -> downloaded_ytdlp', async () => {
  const result = await downloadVideo(
    { video, jobId: 'job-2' },
    {
      tryApifyKvStore: async () => false,
      tryYtDlp: async () => true,
    }
  );

  assert.equal(result.status, 'downloaded_ytdlp');
  assert.equal(result.source, 'yt_dlp');
  assert.ok(result.filePath);
});

test('downloadVideo: cả 2 tầng đều fail -> text_only, KHÔNG throw', async () => {
  const result = await downloadVideo(
    { video, jobId: 'job-3' },
    {
      tryApifyKvStore: async () => false,
      tryYtDlp: async () => false,
    }
  );

  assert.equal(result.status, 'text_only');
  assert.equal(result.source, 'none');
  assert.equal(result.filePath, null);
});

test('downloadVideo: thử tầng (a) trước tầng (b) đúng thứ tự', async () => {
  const callOrder: string[] = [];

  await downloadVideo(
    { video, jobId: 'job-4' },
    {
      tryApifyKvStore: async () => {
        callOrder.push('apify');
        return false;
      },
      tryYtDlp: async () => {
        callOrder.push('ytdlp');
        return false;
      },
    }
  );

  assert.deepEqual(callOrder, ['apify', 'ytdlp']);
});

// ============================================================
// cleanupJobTempFiles - dọn file tạm kể cả khi pipeline throw giữa chừng
// (dùng trong catch block của researchPipelineService.ts::runResearchPipeline)
// ============================================================

test('cleanupJobTempFiles: chỉ xoá file đúng tiền tố "{jobId}-", giữ nguyên file job khác', async () => {
  await fs.mkdir(VIDEO_TMP_DIR, { recursive: true });

  const jobId = `test-cleanup-job-${Date.now()}`;
  const otherJobId = `unrelated-job-${Date.now()}`;

  const fileA = path.join(VIDEO_TMP_DIR, `${jobId}-v1.mp4`);
  const fileB = path.join(VIDEO_TMP_DIR, `${jobId}-v2.mp4`);
  const fileOther = path.join(VIDEO_TMP_DIR, `${otherJobId}-v1.mp4`);

  await fs.writeFile(fileA, 'dummy');
  await fs.writeFile(fileB, 'dummy');
  await fs.writeFile(fileOther, 'dummy');

  try {
    const { deletedCount } = await cleanupJobTempFiles(jobId);

    assert.equal(deletedCount, 2);
    assert.equal(await fs.stat(fileA).catch(() => null), null);
    assert.equal(await fs.stat(fileB).catch(() => null), null);
    assert.ok(await fs.stat(fileOther)); // file job khác KHÔNG bị xoá
  } finally {
    await fs.unlink(fileOther).catch(() => {});
  }
});

test('cleanupJobTempFiles: không có file nào khớp -> deletedCount=0, không throw', async () => {
  const { deletedCount } = await cleanupJobTempFiles(`no-such-job-${Date.now()}`);
  assert.equal(deletedCount, 0);
});
