# Thảo Nguyên Content System

Hệ thống CMS sản xuất nội dung TikTok cho thương hiệu sữa/dinh dưỡng mẹ & bé
Thảo Nguyên: từ brief sản phẩm → nghiên cứu xu hướng TikTok bằng AI → ý tưởng
→ kịch bản sẵn sàng quay, có cổng tuân thủ pháp lý và kiểm soát chi phí AI/
scraping tích hợp sẵn.

**Tài liệu liên quan:**
- [`CMS_OVERVIEW.md`](./CMS_OVERVIEW.md) - tổng quan hệ thống, luồng nghiệp vụ, kiến trúc kỹ thuật
- [`docs/COSTS.md`](./docs/COSTS.md) - chi phí thật mỗi job, cách kiểm soát/tra cứu
- [`docs/HUONG-DAN-SU-DUNG.md`](./docs/HUONG-DAN-SU-DUNG.md) - hướng dẫn dùng CMS cho người không biết code
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) - việc đã làm/còn thiếu qua từng giai đoạn
- [`docs/contrast-report.md`](./docs/contrast-report.md) - kiểm tra tương phản màu WCAG (sáng/tối)

## Bắt đầu nhanh (dev)

Yêu cầu: Node.js 20+, MongoDB Atlas (connection string thật - không có
localhost fallback), API key Gemini, token Apify (tuỳ chọn nếu muốn scrape
thật - không có thì tính năng nghiên cứu TikTok sẽ không chạy được).

```bash
npm install
cp .env.example .env   # rồi điền MONGODB_URI, GEMINI_API_KEY, APIFY_API_TOKEN, JWT_SECRET thật
npm run dev:full       # chạy song song Next.js (:3000) + Express API (:5000)
```

Các lệnh khác:

```bash
npm run lint           # ESLint cho app/ components/ lib/ (không lint server/)
npm test               # chạy toàn bộ test server (node:test), không gọi mạng/DB thật
npx tsc --noEmit                              # typecheck frontend
npx tsc --noEmit --project server/tsconfig.json  # typecheck server
node scripts/contrast-check.mjs               # kiểm tra tương phản màu WCAG cả 2 theme
```

**Biến môi trường quan trọng cần biết** (đầy đủ xem `.env.example`):
- `GEMINI_API_KEY`, `GEMINI_MODEL` - free tier Gemini có hạn mức **theo ngày VÀ theo từng model riêng** (không phải hạn mức chung cho tài khoản) - xem `docs/COSTS.md` nếu gặp lỗi 429 khi vừa mới bắt đầu dùng.
- `APIFY_API_TOKEN`, `APIFY_DISCOVERY_LIMIT` - đòn bẩy chi phí chính của pipeline nghiên cứu, xem `docs/COSTS.md`.
- `DAILY_COST_CAP_USD` (mặc định 5), `MAX_CONCURRENT_RESEARCH_JOBS` (mặc định 2) - hạn mức chi phí/đồng thời, chặn ở tầng API trước khi tốn tiền thật.

## Ghi chú kiến trúc

### BrandProfile thay thế BrandVoice + StoreInfo (2026-07-27)

`server/models/BrandProfile.ts` là model **duy nhất** nên dùng để lưu thông tin
thương hiệu/cửa hàng dùng làm ngữ cảnh cho AI sinh nội dung. Nó hấp thụ toàn bộ
field từng nằm rải rác ở hai model cũ:

- `BrandVoice.tone/personality/doList/dontList/ctaSamples` → gộp vào
  `BrandProfile.toneOfVoice` / `BrandProfile.doList` / `BrandProfile.dontList`.
- `StoreInfo.branches/currentPromo/promoDates/contactEmail/website` → gộp vào
  `BrandProfile.storeInfo.{branches,hotline,website,currentPromotions}`.

`server/models/BrandVoice.ts` và `server/models/StoreInfo.ts` được đánh dấu
`@deprecated` và giữ lại chỉ để tương thích ngược (không có controller/route
nào còn dùng chúng). Không tạo controller hoặc route mới trỏ vào hai model
này — mọi tính năng mới dùng `BrandProfile`.

### Tầng dự phòng tải video: yt-dlp qua package `youtube-dl-exec` (2026-07-27)

`server/services/videoDownloadService.ts` tải video theo 3 tầng: (a) Apify
key-value store (chính, rẻ) → (b) yt-dlp (dự phòng) → (c) `text_only` (không
throw). Tầng (b) dùng package **`youtube-dl-exec`**, KHÔNG gọi `yt-dlp` từ
PATH hệ điều hành như bản đầu tiên (bản đó im lặng fail trên máy chưa cài
yt-dlp thủ công, không có cách nào biết được trừ khi đọc kỹ log).

**Cài đặt**: đã có sẵn trong `dependencies` của `package.json`. `npm install`
sẽ tự tải binary `yt-dlp` thật cho đúng hệ điều hành vào
`node_modules/youtube-dl-exec/bin/` qua script `postinstall` — không cần cài gì
thêm thủ công.

**Cập nhật binary khi TikTok đổi cơ chế chống-bot** (yt-dlp cũ có thể ngừng
tải được TikTok dù binary vẫn "chạy" bình thường — `--version` OK không có
nghĩa là tải video OK):

```bash
node -e "require('youtube-dl-exec').update()"
```

hoặc xoá `node_modules/youtube-dl-exec/bin` rồi chạy lại `npm install` để
buộc tải lại bản mới nhất.

**Health-check lúc khởi động**: `server/index.ts` gọi
`checkYtDlpAvailable()` (từ `videoDownloadService.ts`) trước khi server sẵn
sàng nhận request. Nếu binary không chạy được (`--version` fail), server vẫn
khởi động bình thường (không fail-fast, vì tầng (a) Apify KV store hoạt động
độc lập không cần yt-dlp) nhưng log một dòng **WARN** rõ ràng — xem log lúc
start server nếu nghi ngờ tầng (b) đang chết.

Lưu ý: `checkYtDlpAvailable()` chỉ xác nhận binary CHẠY ĐƯỢC, không đảm bảo
binary đó vẫn tải được video TikTok thật (TikTok đổi chống-bot thường xuyên
hơn tốc độ health-check có thể phát hiện) — nếu tầng (b) fail hàng loạt dù
health-check báo OK, khả năng cao là cần cập nhật binary theo hướng dẫn trên.
