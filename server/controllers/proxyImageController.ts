import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

/**
 * Whitelist domain cho /api/proxy-image - CHỈ ảnh thumbnail/avatar TikTok và
 * dữ liệu public từ Apify (key-value store) mới được phép proxy qua đây.
 * Đây là điểm chống SSRF: nếu không giới hạn domain, ai đó có thể truyền
 * ?url=http://169.254.169.254/... hoặc http://localhost:xxxx/... để dùng
 * server này như 1 cổng quét/đọc mạng nội bộ.
 *
 * So khớp bằng HẬU TỐ DOMAIN (hostname === domain HOẶC hostname kết thúc
 * bằng "." + domain), KHÔNG dùng includes()/startsWith() - includes() có
 * thể bị qua mặt bởi "evil.com/tiktokcdn.com" (path giả), còn so khớp hậu tố
 * thiếu dấu chấm có thể bị qua mặt bởi "eviltiktokcdn.com".
 */
const ALLOWED_HOST_SUFFIXES = [
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktokcdn-in.com',
  'tiktok.com',
  'apify.com',
  'apifyusercontent.com',
];

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 15 * 1024 * 1024; // 15MB - đủ cho thumbnail/avatar, chặn lạm dụng làm proxy tải file lớn

const IPV4_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;

export function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  // Chặn IP literal (IPv4 hoặc có dấu ":" của IPv6) - domain hợp lệ trong
  // whitelist không bao giờ là địa chỉ IP, nên đây chỉ có thể là input SSRF.
  if (IPV4_REGEX.test(host) || host.includes(':')) {
    return false;
  }

  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export const proxyImage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rawUrl = req.query.url;

  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new ApiError(400, 'Thiếu query param url');
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new ApiError(400, 'url không hợp lệ');
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new ApiError(400, 'url phải dùng giao thức http/https');
  }

  if (!isAllowedImageHost(target.hostname)) {
    throw new ApiError(403, `Domain "${target.hostname}" không nằm trong whitelist (chỉ cho phép TikTok CDN / Apify)`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThaoNguyenContentSystem/1.0)' },
    });
  } catch (error) {
    throw new ApiError(502, `Không tải được ảnh từ nguồn: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }

  // fetch() với redirect:'follow' có thể đi qua domain KHÔNG nằm trong
  // whitelist (redirect do server nguồn trả về) - kiểm tra lại domain CUỐI
  // CÙNG sau khi theo redirect để không bị vòng qua whitelist bằng 1 URL
  // ban đầu hợp lệ nhưng redirect sang nơi khác.
  const finalHost = new URL(upstream.url).hostname;
  if (!isAllowedImageHost(finalHost)) {
    throw new ApiError(403, `URL đã redirect sang domain "${finalHost}" không nằm trong whitelist`);
  }

  if (!upstream.ok) {
    throw new ApiError(502, `Nguồn ảnh trả về lỗi HTTP ${upstream.status}`);
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) {
    throw new ApiError(502, `Nguồn không trả về ảnh (content-type: "${contentType}")`);
  }

  const contentLength = upstream.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BYTES) {
    throw new ApiError(413, 'Ảnh vượt quá kích thước cho phép (15MB)');
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (!upstream.body) {
    res.end();
    return;
  }

  let bytesReceived = 0;
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesReceived += value.byteLength;
      if (bytesReceived > MAX_BYTES) {
        res.destroy();
        return;
      }
      res.write(value);
    }
    res.end();
  } catch {
    res.destroy();
  }
});
