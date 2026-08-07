import dotenv from "dotenv";
import os from "os";
import path from "path";

dotenv.config();

// ============================================================
// Cấu hình cho pipeline tải video + phân tích Gemini (Giai đoạn 2+).
// Giai đoạn 1 chỉ khai báo hằng số mặc định ở đây - CHƯA có service nào
// gọi tới các biến này (không có videoDownloadService/geminiVideoService).
// ============================================================

/** Thư mục tạm lưu video trước khi upload Gemini, dọn ngay sau khi phân tích xong. */
export const VIDEO_TMP_DIR = process.env.VIDEO_TMP_DIR || path.join(os.tmpdir(), "tn-videos");

/** Giới hạn dung lượng 1 video được tải về (MB), video vượt ngưỡng bị bỏ qua. */
export const VIDEO_MAX_SIZE_MB = Number(process.env.VIDEO_MAX_SIZE_MB) || 100;

/** Tên KV store Apify dùng để lưu video đã tải (tầng (a) trong chiến lược 3 tầng). */
export const APIFY_KV_STORE_NAME = process.env.APIFY_KV_STORE_NAME || "tiktok-videos";

/** Số video tối đa lấy về mỗi lần scrape. */
export const APIFY_MAX_ITEMS = Number(process.env.APIFY_MAX_ITEMS) || 30;

/**
 * Số video "cào rộng" ở PASS 1 (discoverTrendVideos, shouldDownloadVideos=false
 * - rẻ) để có đủ lựa chọn trước khi chọn topN và chỉ tải THẬT đúng topN đó ở
 * PASS 2 (hydrateVideoDownloads, shouldDownloadVideos=true - đắt). Tách khỏi
 * topN cố ý: cào rộng (discovery) và tải hẹp (hydrate) là 2 chi phí khác hẳn
 * nhau - xem server/services/tiktokService.ts.
 *
 * QUAN TRỌNG - đây là số item MỖI HASHTAG, KHÔNG PHẢI tổng: actor
 * clockworks~tiktok-scraper tính field `resultsPerPage` theo TỪNG hashtag
 * (đã verify qua docs actor thật: "Number of TikToks to scrape per hashtag,
 * profile, or search query"). Với N hashtag, PASS 1 sẽ cào ~N x
 * APIFY_DISCOVERY_LIMIT item, KHÔNG PHẢI đúng APIFY_DISCOVERY_LIMIT item.
 * Ví dụ 3 hashtag x 15 = ~45 item bị cào ở PASS 1.
 *
 * Đổi mặc định 30 -> 15 (2026-07-27, lượt tối ưu chi phí E2): đây là đòn bẩy
 * chi phí THẬT của cả pipeline (đã verify bằng chạy thật - xem README/báo cáo
 * lượt "Giai đoạn 2 / Lượt 3A"), không phải cờ shouldDownloadVideos như giả
 * định ban đầu.
 */
export const APIFY_DISCOVERY_LIMIT = Number(process.env.APIFY_DISCOVERY_LIMIT) || 15;

/**
 * Model Gemini - NGUỒN SỰ THẬT DUY NHẤT, mọi nơi trong server/ (aiService.ts
 * và các service Giai đoạn 2+ như geminiVideoService.ts) đều phải import
 * hằng số này thay vì tự đọc process.env.GEMINI_MODEL hoặc tự hardcode giá
 * trị mặc định riêng - tránh lặp lại tình trạng 2 nguồn sự thật lệch nhau đã
 * gặp ở Giai đoạn 1 (aiService.ts từng hardcode 'gemini-2.5-flash' riêng).
 * Fail-fast: thiếu biến env thì throw ngay lúc import, không âm thầm dùng
 * giá trị mặc định nào - theo đúng chính sách fail-fast cho production path.
 * Có thể override theo từng PromptTemplate (field "aiModel") ở Giai đoạn 2+.
 */
// 2026-07-28: tạm chuyển từ gemini-3.6-flash sang gemini-3.5-flash trong .env
// (G5, Giai đoạn 5) - gemini-3.6-flash đã hết quota free-tier trong ngày
// (giới hạn 20 request/ngày/model), quota tính RIÊNG theo từng model nên đổi
// model là cách hợp lệ để tiếp tục mà không cần đợi qua ngày mới. Đã thử lần
// lượt gemini-2.5-flash (404 "no longer available to new users"),
// gemini-2.0-flash/gemini-2.0-flash-lite (quota free-tier = 0 cho project
// này) trước khi tìm ra gemini-3.5-flash thật sự gọi được.
export const GEMINI_MODEL = (() => {
  const value = process.env.GEMINI_MODEL;
  if (!value || value.trim() === "") {
    throw new Error("FATAL: GEMINI_MODEL is missing or empty in .env");
  }
  return value;
})();

/** Số lần retry tối đa khi Gemini trả 429/503, dùng mảng backoff kiểu tiktok-ai. */
export const GEMINI_MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES) || 5;

/** Bật/tắt tầng dự phòng yt-dlp (tầng (b)) khi Apify KV store không có file. */
export const ENABLE_YTDLP_FALLBACK = process.env.ENABLE_YTDLP_FALLBACK !== "false";

/**
 * Hạn mức chi phí + đồng thời cho research job (G7, Giai đoạn 5) - mỗi job
 * tốn tiền THẬT (Apify + Gemini). Sự cố thật đã xảy ra: 1 job chết giữa
 * chừng vẫn tốn $0.26 do double-click / chạy trùng không bị chặn.
 */
/** Trần tổng chi phí ước tính (USD) cho các job 1 user tạo trong 1 ngày (giờ server). */
export const DAILY_COST_CAP_USD = Number(process.env.DAILY_COST_CAP_USD) || 5;

/** Số research job đang chạy đồng thời tối đa cho 1 user (chưa completed/failed). */
export const MAX_CONCURRENT_RESEARCH_JOBS = Number(process.env.MAX_CONCURRENT_RESEARCH_JOBS) || 2;

/**
 * Giai đoạn 6 Phase 3: cho người dùng tự chọn số video sẽ quét (PASS 2 - tải
 * THẬT + phân tích Gemini, phần tốn tiền nhất) và số kịch bản sẽ sinh mỗi
 * job, thay vì cố định topN=5 như trước. Giới hạn tối đa để tránh bấm nhầm
 * gây tốn phí Apify/Gemini lớn ngoài ý muốn.
 */
export const DEFAULT_VIDEO_SCAN_COUNT = Number(process.env.DEFAULT_VIDEO_SCAN_COUNT) || 5;
export const MAX_VIDEO_SCAN_COUNT = Number(process.env.MAX_VIDEO_SCAN_COUNT) || 50;
export const DEFAULT_SCRIPT_COUNT = Number(process.env.DEFAULT_SCRIPT_COUNT) || 5;
export const MAX_SCRIPT_COUNT = Number(process.env.MAX_SCRIPT_COUNT) || 50;
