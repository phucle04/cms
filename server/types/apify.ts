/**
 * Shape dữ liệu thô trả về từ actor clockworks~tiktok-scraper (endpoint
 * run-sync-get-dataset-items). Copy cấu trúc field từ
 * tiktok-ai/app/src/lib/types.ts (project tham khảo, chỉ đọc) - giữ nguyên
 * videoMeta.downloadAddr, videoMeta.subtitleLinks, authorMeta, musicMeta,
 * collectCount vì đó là các field then chốt cho pipeline tải video +
 * phân tích text-only.
 */
export interface ApifyTikTokResult {
  id: string;
  text: string;
  createTimeISO: string;
  playCount: number;
  diggCount: number;
  shareCount: number;
  commentCount: number;
  collectCount: number;
  webVideoUrl: string;
  isSlideshow: boolean;
  isPinned: boolean;
  isSponsored: boolean;
  hashtags: { name: string }[];
  authorMeta: {
    name: string;
    nickName: string;
    fans: number;
    heart: number;
    video: number;
    avatar: string;
    verified: boolean;
    signature: string;
    bioLink?: string;
  };
  videoMeta: {
    duration: number;
    height: number;
    width: number;
    coverUrl: string;
    originalCoverUrl: string;
    downloadAddr?: string;
    subtitleLinks?: { language: string; downloadLink: string }[];
  };
  musicMeta: {
    musicName: string;
    musicAuthor: string;
    musicOriginal: boolean;
  };
  /**
   * Chỉ xuất hiện khi input có commentsPerPost/topLevelCommentsPerPost - trỏ
   * tới 1 dataset RIÊNG chứa comment. Đã VERIFY THẬT (2026-07-27, xem báo cáo
   * lượt pipeline F1-S2): tên field CHÍNH XÁC là "commentsDatasetUrl" (chữ
   * "rl" thường, không phải "URL" hoa) - bug ban đầu ở đây khiến
   * fetchTopComments() luôn trả [] dù comment thật tồn tại. Shape 1 comment
   * item đã verify thật: { text, diggCount, uniqueId, cid, replyCommentTotal,
   * createTimeISO, avatarThumbnail, ... }.
   */
  commentsDatasetUrl?: string;
}

/**
 * Shape phẳng, đã chuẩn hoá về đúng các field non-Document của model
 * TrendVideo (server/models/TrendVideo.ts) - KHÔNG phải Document Mongoose,
 * KHÔNG được service tự lưu DB. Pipeline (Giai đoạn 3) sẽ spread field này
 * vào TrendVideo.create(...).
 */
export interface NormalizedTrendVideo {
  userId: string;
  jobId: string;
  videoId: string;
  webVideoUrl: string;
  caption: string;
  hashtags: string[];
  playCount: number;
  diggCount: number;
  shareCount: number;
  commentCount: number;
  collectCount: number;
  createTimeISO: string;
  authorName: string;
  authorHandle: string;
  authorFollowers: number;
  thumbnailUrl: string;
  downloadAddr?: string;
  subtitleLinks: Array<{ language: string; downloadLink: string }>;
  musicName: string;
  downloadStatus: 'pending';
}
