# Tổng quan hệ thống

> Tài liệu này mô tả hệ thống ở trạng thái **thật, đang chạy** (MongoDB Atlas
> thật, Gemini/Apify thật) - không phải bản mock-data prototype ban đầu. Nếu
> bạn thấy tài liệu khác trong repo (`IMPLEMENTATION_COMPLETE.md`,
> `BACKEND_COMPLETE.md`...) mô tả "mock API layer", "placeholder pages" - đó
> là tài liệu **cũ, đã lỗi thời**, giữ lại vì lý do lịch sử, không phản ánh
> đúng hệ thống hiện tại. Coi tài liệu này là nguồn sự thật.

## Hệ thống làm gì

Thảo Nguyên Content System giúp một người phụ trách content (không cần biết
code) đi từ **1 sản phẩm** đến **5 kịch bản TikTok sẵn sàng quay**, dựa trên
video đang viral thật trên TikTok, trong vài phút thay vì tự nghiên cứu thủ
công. Hệ thống tự động:

1. Gợi ý hashtag phù hợp với sản phẩm (Gemini)
2. Cào video viral theo hashtag đã chọn (Apify - TikTok scraper)
3. Tải video về và phân tích cấu trúc/hook/lý do viral (Gemini multimodal - "xem" video thật)
4. Tổng hợp sản phẩm + brand voice + video đã phân tích → sinh 5 ý tưởng + 5 kịch bản theo 5 góc tiếp cận khác nhau

Toàn bộ quá trình tốn **tiền thật** (Apify cào/tải video, Gemini phân tích/sinh
nội dung) - xem [`docs/COSTS.md`](./docs/COSTS.md) để biết chi phí thực tế và
cách kiểm soát.

## IA (6 route)

| Route | Mục đích |
|---|---|
| `/` | Dashboard - tổng quan số liệu |
| `/products` | Quản lý brief sản phẩm (CRUD), bao gồm **độ tuổi phù hợp** |
| `/research` | Danh sách + tạo research job, theo dõi tiến trình 5 bước real-time (SSE) |
| `/ideation` | Danh sách ý tưởng (tay + tự sinh từ research), lọc theo trạng thái/độ ưu tiên |
| `/scripts` | Danh sách kịch bản (tay + tự sinh từ research), cảnh báo tuân thủ |
| `/settings` | Brand profile, prompt template (có thể sửa prompt AI ngay trên UI) |

## Luồng nghiệp vụ chính: Sản phẩm → Nghiên cứu → Kịch bản

```
/products/[id]
   │  bấm "Tạo kịch bản từ sản phẩm này"
   ▼
[Cổng tuân thủ tuổi]  ── ageCategory === 'under_24m'? ──▶ CHẶN, hiện panel giải thích
   │  không bị chặn                                       (Nghị định 100/2014/NĐ-CP)
   ▼
[Chặn job trùng / vượt hạn mức]  ── đã có job đang chạy cho SP này? ──▶ 409
   │                                ── đã đủ số job đồng thời? ──▶ 429
   │                                ── đã vượt trần chi phí/ngày? ──▶ 402
   ▼
Stage 1: generating_hashtags  (Gemini - rẻ, ~$0.005)
   ▼
[Người dùng chọn hashtag]  ← awaiting_hashtag_selection, dừng chờ UI
   ▼
Stage 2: scraping            (Apify PASS 1 discover + PASS 2 hydrate - ĐÂY LÀ CHI PHÍ CHÍNH)
   ▼
Stage 3: downloading         (Apify KV store → yt-dlp dự phòng → text_only, không throw)
   ▼
Stage 4: analyzing           (Gemini xem video thật hoặc phân tích text_only, ≥2/5 mới đủ để tiếp tục)
   ▼
Stage 5: generating_scripts  (Gemini sinh 5 idea + 5 script, áp dụng dontList/doList/compliance của brand)
   ▼
completed → hiện ở /research/[jobId], /ideation, /scripts
   │  bấm "Đẩy sang Scripting" trên từng kịch bản (đổi status draft → approved)
   ▼
/scripts - kịch bản đã duyệt, có bôi đỏ cụm từ bị bộ quét tuân thủ đánh dấu (nếu có)
```

**Idempotent theo từng bước** (mỗi Stage tự kiểm tra "đã làm chưa" trước khi
làm lại): nếu process chết giữa chừng, gọi lại `resumeResearchPipeline` an
toàn về mặt chi phí - không bao giờ gọi lại Apify/Gemini cho phần đã tốn tiền
xong. Xem `server/services/researchPipelineService.ts` (đọc comment đầu mỗi
Stage) và `server/services/researchPipelineService.test.ts` cho các ca test
resume cụ thể.

## 3 lớp bảo vệ đã tích hợp

### 1. Cổng tuân thủ tuổi (age gate)
`ProductBrief.ageCategory` = `under_24m` | `24m_plus` | `not_applicable`.
Sản phẩm `under_24m` bị chặn tạo research job tự động ngay tại
`POST /api/research/jobs` (422, code `AGE_GATE_BLOCKED`) - Nghị định
100/2014/NĐ-CP quy định quảng cáo riêng cho sản phẩm dinh dưỡng trẻ dưới 24
tháng, cần người phụ trách duyệt nội dung thủ công, hệ thống chưa hỗ trợ tự
động cho nhóm này.

### 2. Bộ quét tuân thủ (compliance scanner)
`server/services/complianceScanner.ts` - so khớp từ khoá **sơ bộ**, quét mỗi
kịch bản với (a) danh sách cấm baseline (các cụm claim y tế phổ biến: "chữa
bệnh", "thay thế sữa mẹ"...) và (b) `BrandProfile.dontList`. Kết quả đính kèm
vào response `GET /api/scripts`/`GET /api/scripts/:id` dưới field
`complianceFlags`, UI bôi đỏ trực tiếp trong nội dung kịch bản.

**Giới hạn quan trọng** (đã kiểm chứng qua audit thật ở Giai đoạn 5): đây là
so khớp cụm từ, **không bắt được diễn đạt gián tiếp** ("trộm vía con đi ngoài
dễ dàng" không chứa từ khoá cấm nào nhưng vẫn ngụ ý một claim hiệu quả sức
khỏe). Đọc thủ công toàn bộ kịch bản trước khi đăng **vẫn bắt buộc** -
`BrandProfile.complianceNotes` đã ghi rõ yêu cầu này. Cách giảm rủi ro thật sự
hiệu quả hơn: viết rõ trong `dontList`/prompt template những dạng ngôn ngữ cụ
thể cần tránh (xem ví dụ thật trong `docs/COSTS.md` phần "Sửa 1 lần, áp dụng
mọi lần sinh sau").

### 3. Hạn mức chi phí + chặn job trùng
`server/controllers/researchJobController.ts::createResearchJob` chặn 3
trường hợp trước khi tốn bất kỳ chi phí Apify/Gemini nào:
- Cùng sản phẩm đã có job đang chạy → 409 `DUPLICATE_JOB_RUNNING`
- Đã đủ số job đồng thời (`MAX_CONCURRENT_RESEARCH_JOBS`, mặc định 2) → 429 `CONCURRENT_JOB_LIMIT`
- Đã vượt trần chi phí/ngày (`DAILY_COST_CAP_USD`, mặc định $5) → 402 `DAILY_COST_CAP_EXCEEDED`

## Kiến trúc kỹ thuật

- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4
  (token màu semantic trong `app/globals.css`, 2 theme sáng/tối qua
  `next-themes`, không dùng class `dark:` rải rác trong component), shadcn/ui.
- **Backend**: Express + Mongoose, `asyncHandler`/`ApiError` cho error
  handling nhất quán, zod validate ở biên API cho các endpoint ghi dữ liệu
  chính (`server/validation/schemas.ts` + `server/middleware/validate.ts`).
- **Database**: MongoDB Atlas thật (không có chế độ local/mock).
- **AI**: Gemini (`@google/genai`) - text (hashtag/script) và multimodal
  (xem video thật qua Files API). Model cấu hình qua `GEMINI_MODEL` trong
  `server/config/env.ts` - **1 nguồn sự thật duy nhất**, không hardcode rải
  rác nơi khác.
- **Scraping**: Apify (`clockworks~tiktok-scraper`) - chiến lược tải video 3
  tầng: Apify KV store → yt-dlp (`youtube-dl-exec`) dự phòng → `text_only`.
- **Bảo mật**: `/api/proxy-image` có whitelist domain chống SSRF (đã pentest
  thật với ~14 payload khác nhau - IP literal mọi định dạng, redirect, subdomain
  giả... xem báo cáo Giai đoạn 5), không log secret dù trong thông báo lỗi.
- **Test**: `node:test` cho `server/**/*.test.ts` - mock qua `mock.method()`
  cho model Mongoose/class instance, dependency injection cho hàm thuần (xem
  comment đầu mỗi file `.test.ts` giải thích lý do chọn từng kỹ thuật mock).

## Những gì hệ thống KHÔNG (chưa) làm

- Không có cơ chế hashtag thay thế tự động khi Gemini sinh hashtag lỗi (job
  fail thẳng, người dùng phải tạo lại job).
- Không có hàng đợi job thật (BullMQ/Redis) - job chạy nền trong cùng process
  Express, chỉ phù hợp 1 instance duy nhất.
- Không có trang đăng nhập thật - mọi request dùng `DEMO_USER_ID` cố định
  (`optionalAuth` middleware) cho đến khi có tính năng auth.
- Không tự động archive/rank KPI (biến `ENABLE_AUTO_ARCHIVE`/`ENABLE_AUTO_RANK`
  trong `.env.example` là placeholder cho tương lai, chưa có code đọc).
