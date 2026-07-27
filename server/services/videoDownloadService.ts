import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import youtubeDl from 'youtube-dl-exec';
import { VIDEO_TMP_DIR, VIDEO_MAX_SIZE_MB, ENABLE_YTDLP_FALLBACK } from '../config/env';

/**
 * Service THUẦN cho việc tải video về đĩa tạm - 3 tầng đúng thứ tự:
 * (a) Apify key-value store (chính) -> (b) yt-dlp (dự phòng) -> (c) text_only
 * (không throw). Không tự ghi DB. File tải về PHẢI được dọn qua cleanupVideo()
 * trong finally của caller - đây chỉ là đĩa tạm, không phải kho lưu trữ.
 *
 * Tầng (b) dùng package `youtube-dl-exec` (tự tải + tự quản binary yt-dlp
 * thật trong node_modules/youtube-dl-exec/bin, KHÔNG yêu cầu cài yt-dlp thủ
 * công vào PATH hệ điều hành - khác bản đầu tiên từng gọi thẳng `execFile('yt-dlp', ...)`
 * và im lặng fail nếu máy chưa cài). Cập nhật binary khi TikTok đổi chống-bot:
 * `npx youtube-dl-exec update` hoặc `require('youtube-dl-exec').update()`.
 */

const execFileAsync = promisify(execFile);

// youtube-dl-exec không export type cho `constants`, nhưng module JS thực có
// field này (xem node_modules/youtube-dl-exec/src/index.js) - cast tường minh
// thay vì dùng `any`.
const YT_DLP_BINARY_PATH = (
  youtubeDl as unknown as { constants: { YOUTUBE_DL_PATH: string } }
).constants.YOUTUBE_DL_PATH;

export type DownloadStatus = 'downloaded_apify' | 'downloaded_ytdlp' | 'text_only';
export type DownloadSource = 'apify_kv_store' | 'yt_dlp' | 'none';

export interface DownloadableVideo {
  videoId: string;
  webVideoUrl: string;
  downloadAddr?: string;
}

export interface DownloadVideoResult {
  filePath: string | null;
  status: DownloadStatus;
  source: DownloadSource;
}

function maxSizeBytes(): number {
  return VIDEO_MAX_SIZE_MB * 1024 * 1024;
}

/**
 * Đường dẫn file tạm CỐ ĐỊNH theo (jobId, videoId) - export để
 * researchPipelineService.ts tính lại được đúng đường dẫn ở Stage 4 (analyzing)
 * mà không cần lưu filePath vào DB (file tạm không phải state cần persist).
 * Nếu file không còn tồn tại lúc Stage 4 chạy (ví dụ resume sau crash, thư
 * mục tạm đã bị dọn) thì coi video đó như tải thất bại, KHÔNG throw cả job.
 */
export function getVideoFilePath(jobId: string, videoId: string): string {
  return path.join(VIDEO_TMP_DIR, `${jobId}-${videoId}.mp4`);
}

async function ensureTmpDir(): Promise<void> {
  await fs.mkdir(VIDEO_TMP_DIR, { recursive: true });
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
}

// ============================================================
// (a) Tầng chính - Apify key-value store
// ============================================================

async function tryDownloadFromApifyKvStore(video: DownloadableVideo, destPath: string): Promise<boolean> {
  if (!video.downloadAddr) {
    console.log(`[VideoDownload] ${video.videoId}: không có downloadAddr, bỏ qua tầng Apify KV store`);
    return false;
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn(`[VideoDownload] ${video.videoId}: thiếu APIFY_API_TOKEN, bỏ qua tầng Apify KV store`);
    return false;
  }

  const url = video.downloadAddr.includes('token=')
    ? video.downloadAddr
    : `${video.downloadAddr}${video.downloadAddr.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });

    if (!res.ok) {
      console.warn(
        `[VideoDownload] ${video.videoId}: tầng Apify KV store FAIL (HTTP ${res.status}) - url gốc: ${video.downloadAddr}`
      );
      return false;
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxSizeBytes()) {
      console.warn(
        `[VideoDownload] ${video.videoId}: tầng Apify KV store FAIL - video ${contentLength} bytes vượt giới hạn ${VIDEO_MAX_SIZE_MB}MB (Content-Length)`
      );
      return false;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > maxSizeBytes()) {
      console.warn(
        `[VideoDownload] ${video.videoId}: tầng Apify KV store FAIL - video ${buffer.length} bytes vượt giới hạn ${VIDEO_MAX_SIZE_MB}MB (đo sau khi tải, Content-Length thiếu/sai)`
      );
      return false;
    }

    await ensureTmpDir();
    await fs.writeFile(destPath, buffer);
    console.log(`[VideoDownload] ${video.videoId}: tầng Apify KV store THÀNH CÔNG (${buffer.length} bytes) -> ${destPath}`);
    return true;
  } catch (error) {
    console.warn(
      `[VideoDownload] ${video.videoId}: tầng Apify KV store LỖI -`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

// ============================================================
// (b) Tầng dự phòng - yt-dlp qua package youtube-dl-exec
// ============================================================

const YTDLP_TIMEOUT_MS = 60_000;

async function tryDownloadWithYtDlp(video: DownloadableVideo, destPath: string): Promise<boolean> {
  if (!video.webVideoUrl) {
    console.log(`[VideoDownload] ${video.videoId}: không có webVideoUrl, bỏ qua tầng yt-dlp`);
    return false;
  }

  await ensureTmpDir();

  const subprocess = youtubeDl.exec(video.webVideoUrl, {
    output: destPath,
    format: `best[filesize<${VIDEO_MAX_SIZE_MB}M]/best`,
    noPlaylist: true,
    noWarnings: true,
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    subprocess.kill();
  }, YTDLP_TIMEOUT_MS);

  try {
    await subprocess;
  } catch (error) {
    clearTimeout(timer);

    if (timedOut) {
      console.warn(`[VideoDownload] ${video.videoId}: tầng yt-dlp FAIL - vượt timeout ${YTDLP_TIMEOUT_MS}ms, đã kill process`);
      return false;
    }

    const missingBinary = errorCode(error) === 'ENOENT';
    console.warn(
      `[VideoDownload] ${video.videoId}: tầng yt-dlp FAIL${missingBinary ? ` (không tìm thấy binary tại ${YT_DLP_BINARY_PATH} - chạy lại "npm install")` : ''} -`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
  clearTimeout(timer);

  const stat = await fs.stat(destPath).catch(() => null);
  if (!stat || stat.size === 0) {
    console.warn(`[VideoDownload] ${video.videoId}: tầng yt-dlp chạy xong nhưng không tạo được file hợp lệ`);
    return false;
  }

  if (stat.size > maxSizeBytes()) {
    console.warn(
      `[VideoDownload] ${video.videoId}: tầng yt-dlp FAIL - file ${stat.size} bytes vượt giới hạn ${VIDEO_MAX_SIZE_MB}MB`
    );
    await fs.unlink(destPath).catch(() => {});
    return false;
  }

  console.log(`[VideoDownload] ${video.videoId}: tầng yt-dlp THÀNH CÔNG (${stat.size} bytes) -> ${destPath}`);
  return true;
}

/**
 * Health-check gọi lúc khởi động server (server/index.ts) - KHÔNG throw dù
 * binary thiếu, chỉ log WARN rõ ràng. Mục đích: phát hiện tầng (b) chết ngay
 * lúc start server, thay vì phải đọc log của từng job hoặc đọc báo cáo cũ mới
 * biết. TikTok đổi cơ chế chống-bot khá thường xuyên -> binary yt-dlp cũ có
 * thể ngừng hoạt động dù vẫn "tồn tại" trên đĩa; check này chỉ xác nhận binary
 * CHẠY ĐƯỢC (--version thành công), không đảm bảo tải được video TikTok thật.
 */
export async function checkYtDlpAvailable(): Promise<{ available: boolean; version?: string; binaryPath: string }> {
  try {
    const { stdout } = await execFileAsync(YT_DLP_BINARY_PATH, ['--version'], { timeout: 10_000 });
    const version = stdout.trim();
    console.log(`[VideoDownload] checkYtDlpAvailable: OK - yt-dlp ${version} tại ${YT_DLP_BINARY_PATH}`);
    return { available: true, version, binaryPath: YT_DLP_BINARY_PATH };
  } catch (error) {
    console.warn(
      `[VideoDownload] checkYtDlpAvailable: KHÔNG chạy được yt-dlp binary tại ${YT_DLP_BINARY_PATH} - ` +
        'tầng (b) sẽ luôn FAIL, mọi video Apify không tải được (tầng (a)) sẽ rơi thẳng xuống text_only. ' +
        'Chạy lại "npm install" để cài đặt lại binary (package youtube-dl-exec tự tải khi postinstall).',
      error instanceof Error ? error.message : error
    );
    return { available: false, binaryPath: YT_DLP_BINARY_PATH };
  }
}

// ============================================================
// downloadVideo - orchestrate 3 tầng đúng thứ tự
// ============================================================

/**
 * Cho phép inject hàm thử từng tầng (dùng trong test để mock cả 3 tầng mà
 * không cần fetch/child_process thật). Production code không truyền tham số
 * này, dùng thẳng implementation thật ở trên làm mặc định.
 */
export interface DownloadTierFns {
  tryApifyKvStore?: (video: DownloadableVideo, destPath: string) => Promise<boolean>;
  tryYtDlp?: (video: DownloadableVideo, destPath: string) => Promise<boolean>;
}

export async function downloadVideo(
  params: { video: DownloadableVideo; jobId: string },
  tierFns: DownloadTierFns = {}
): Promise<DownloadVideoResult> {
  const { video, jobId } = params;
  const destPath = getVideoFilePath(jobId, video.videoId);

  const tryApify = tierFns.tryApifyKvStore ?? tryDownloadFromApifyKvStore;
  const tryYtDlp = tierFns.tryYtDlp ?? tryDownloadWithYtDlp;

  const apifyOk = await tryApify(video, destPath);
  if (apifyOk) {
    return { filePath: destPath, status: 'downloaded_apify', source: 'apify_kv_store' };
  }

  if (ENABLE_YTDLP_FALLBACK) {
    const ytDlpOk = await tryYtDlp(video, destPath);
    if (ytDlpOk) {
      return { filePath: destPath, status: 'downloaded_ytdlp', source: 'yt_dlp' };
    }
  } else {
    console.log(`[VideoDownload] ${video.videoId}: bỏ qua tầng yt-dlp (ENABLE_YTDLP_FALLBACK=false)`);
  }

  console.warn(`[VideoDownload] ${video.videoId}: cả 2 tầng tải video đều FAIL -> text_only (không throw)`);
  return { filePath: null, status: 'text_only', source: 'none' };
}

// ============================================================
// Dọn dẹp
// ============================================================

export async function cleanupVideo(filePath: string | null): Promise<void> {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return; // đã bị xoá từ trước, không sao
    console.warn(`[VideoDownload] Không xoá được file tạm ${filePath}:`, error instanceof Error ? error.message : error);
  }
}

export async function cleanupOrphans(maxAgeHours: number = 6): Promise<{ deletedCount: number }> {
  let entries: string[];
  try {
    entries = await fs.readdir(VIDEO_TMP_DIR);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return { deletedCount: 0 }; // thư mục chưa từng được tạo
    throw error;
  }

  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();
  let deletedCount = 0;

  for (const entry of entries) {
    const fullPath = path.join(VIDEO_TMP_DIR, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
        await fs.unlink(fullPath);
        deletedCount += 1;
        console.log(
          `[VideoDownload] cleanupOrphans: đã xoá file mồ côi ${entry} (~${Math.round((now - stat.mtimeMs) / 3_600_000)}h tuổi)`
        );
      }
    } catch (error) {
      console.warn(`[VideoDownload] cleanupOrphans: lỗi khi xử lý ${entry}:`, error instanceof Error ? error.message : error);
    }
  }

  return { deletedCount };
}

// ============================================================
// runWithConcurrency - pool đơn giản port từ tiktok-ai/app/src/lib/pipeline.ts
// Mặc định limit=1 (tuần tự) - pipeline Giai đoạn 3 PHẢI gọi với limit=1 khi
// xử lý video để tránh rate limit Gemini, giữ tham số này để sau chỉnh được.
// ============================================================

export async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number = 1): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const current = index;
      index += 1;
      results[current] = await tasks[current]();
    }
  }

  const workerCount = Math.max(1, Math.min(limit, tasks.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
