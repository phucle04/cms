# Thảo Nguyên Content System

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
