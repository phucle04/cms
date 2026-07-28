# Chi phí thật của hệ thống

Số liệu trong tài liệu này là **chi phí thật, đo được**, không phải ước tính
lý thuyết - lấy từ 1 job nghiên cứu chạy thật ngày 2026-07-28 (sản phẩm "Sữa
Thảo Nguyên Số 4", chọn 1 hashtag `#mebimsua`, 5 video).

## Chi phí 1 job đầy đủ (5 bước)

| Bước | Dịch vụ | Chi phí thật | Ghi chú |
|---|---|---|---|
| 1. Sinh hashtag | Gemini | $0.0046 | 422 token vào / 535 token ra |
| 2. Cào video | Apify | $0.1072 | PASS 1 (discover, ~15 item/hashtag) + PASS 2 (hydrate top 5) |
| 3. Tải video | (miễn phí) | $0 | Nằm trong chi phí Apify cào ở bước 2 (KV store) hoặc yt-dlp (miễn phí) |
| 4. Phân tích video | Gemini (multimodal) | ~$0.06 | 5 video, model "xem" file thật qua Files API |
| 5. Sinh kịch bản | Gemini | ~$0.04 | 1 lần gọi, trả về JSON 5 idea+script |
| **Tổng 1 job** | | **~$0.17 - $0.21** | Dao động theo độ dài video/kịch bản thật |

**Nếu chọn top-3 hashtag thay vì 1** (mặc định `autoSelectTop3=true`): chi phí
bước 2 tăng gần gấp 3 (PASS 1 cào theo TỪNG hashtag, không phải tổng chung) -
xem `APIFY_DISCOVERY_LIMIT` trong `server/config/env.ts`. **Khuyến nghị: luôn
chọn thủ công 1-2 hashtag phù hợp nhất** thay vì để tự động lấy top 3, trừ khi
thực sự cần độ phủ rộng.

**Nếu phải sinh lại kịch bản sau khi audit tuân thủ phát hiện lỗi** (xem
mục dưới): +~$0.04-0.07 (chỉ gọi lại Gemini bước 5, KHÔNG gọi lại Apify -
`rawScrapedVideos`/phân tích video đã lưu sẵn trong DB, tái sử dụng nguyên).

## Hạn mức chi phí đã tích hợp

Cấu hình qua biến môi trường (xem `.env.example`, đọc trong
`server/config/env.ts`):

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DAILY_COST_CAP_USD` | 5 | Tổng chi phí ước tính tối đa 1 user được tạo job trong 1 ngày (giờ server) |
| `MAX_CONCURRENT_RESEARCH_JOBS` | 2 | Số job chạy đồng thời tối đa 1 user |

Vượt trần → `POST /api/research/jobs` trả lỗi rõ ràng (`402`/`429`) **trước
khi** gọi Apify/Gemini, không tốn tiền cho request bị chặn. Xem
`server/controllers/researchJobController.ts::createResearchJob`.

**Sự cố thật đã xảy ra trước khi có hạn mức này**: double-click nút "Tạo kịch
bản" tạo 2 job cho cùng sản phẩm, 1 job "chết" giữa chừng vẫn tốn $0.26 (Apify
đã cào xong, tốn tiền, nhưng job fail trước khi sinh kịch bản). Giờ đã có
chặn job trùng (409 `DUPLICATE_JOB_RUNNING`) nên tình huống này không lặp lại.

## Quota Gemini free tier - lưu ý quan trọng

Quota free tier tính **RIÊNG theo từng model**, không phải hạn mức chung cho
cả tài khoản/API key. Khi hết quota 1 model (vd `gemini-3.6-flash`: 20
request/ngày), đổi sang model khác (vd `gemini-3.5-flash`) trong
`GEMINI_MODEL` (`.env`) vẫn gọi được bình thường - không cần đợi qua ngày mới
hay tạo API key mới. Không phải model nào trong danh sách `models.list()`
cũng thật sự gọi được - một số model cũ (`gemini-2.5-flash`,
`gemini-2.5-flash-lite`) trả lỗi 404 "no longer available to new users" dù
vẫn hiện trong danh sách; một số model có quota free tier = 0 cho project mới
(`gemini-2.0-flash`, `gemini-2.0-flash-lite`). **Trước khi đổi model, kiểm tra
nhanh bằng 1 lệnh `generateContent` nhỏ** (xem ví dụ trong
`server/config/env.ts` phần comment 2026-07-28) thay vì đoán.

## Sửa 1 lần, áp dụng mọi lần sinh sau

Khi audit thủ công (đọc bằng tay) phát hiện kịch bản có ngôn ngữ claim sức
khỏe không phù hợp mà bộ quét từ khoá không bắt được (xem giới hạn của
`complianceScanner.ts` trong `CMS_OVERVIEW.md`), cách sửa đúng là sửa ở
**nguồn sinh ra vấn đề** (prompt template + `BrandProfile.dontList`), không
phải sửa tay từng kịch bản:

1. `PUT /api/brand-profiles/:id` - thêm quy tắc cụ thể vào `dontList` (vd:
   "Không khẳng định kết quả sức khỏe cụ thể như chắc chắn xảy ra... chỉ được
   dùng ngôn ngữ hỗ trợ/góp phần").
2. `PUT /api/prompt-templates/:id` (template `script_gen`) - thêm hướng dẫn
   rõ ràng vào `userPromptTemplate`, có thể kèm ví dụ cụ thể nên/không nên
   dùng từ nào.
3. Sinh lại kịch bản: đặt lại `ResearchJob.status='analyzing'`, xoá
   `rawGeneratedScripts`/`resultIdeaIds`/`resultScriptIds` cũ, gọi lại
   `resumeResearchPipeline(jobId)` - **không gọi lại Apify**, chỉ tốn thêm 1
   lần gọi Gemini bước 5.

Kết quả thật đã kiểm chứng (Giai đoạn 5): sau khi sửa, toàn bộ 5/5 kịch bản
mới không còn claim "tăng cân rõ rệt"/"hết táo bón" kiểu khẳng định chắc chắn,
chuyển sang ngôn ngữ "hỗ trợ"/"góp phần" nhất quán - vẫn còn 2-3 cụm diễn đạt
mềm cần người phụ trách xem lại tay (vd "con đi ngoài dễ dàng"), nhưng đã loại
bỏ hoàn toàn dạng claim định lượng nghiêm trọng nhất (số liệu cân nặng/chiều
cao trước-sau).

## Ước tính chi phí ở quy mô 20 sản phẩm/tháng

Giả định mỗi sản phẩm chạy 1 job/tháng (không tính lần chạy lại do sửa lỗi):

- 20 job × ~$0.18 (trung bình) = **~$3.6/tháng** chi phí Apify+Gemini thuần.
- Vẫn nằm dưới `DAILY_COST_CAP_USD` mặc định ($5/ngày) nếu chạy rải đều,
  nhưng nếu chạy dồn nhiều job trong 1 ngày (vd cuối tháng chạy bù) cần tăng
  `DAILY_COST_CAP_USD` hoặc chia ra nhiều ngày.
- Bottleneck thực tế không phải chi phí tiền mà là **thời gian**: 1 job mất
  ~7 phút thật (đo được: 03:12:12 → 03:19:41), chạy TUẦN TỰ từng video (không
  Promise.all) để tránh dồn request Apify/Gemini - 20 job chạy nối tiếp nhau
  sẽ mất ~2h20 tổng, KHÔNG chạy song song được (giới hạn
  `MAX_CONCURRENT_RESEARCH_JOBS`, mặc định chỉ 2 job cùng lúc).
- Quota Gemini free tier theo NGÀY - 20 job/tháng rải đều (~1 job/1.5 ngày)
  khó chạm trần, nhưng nếu dồn nhiều job trong 1 ngày cần theo dõi quota qua
  https://ai.dev/rate-limit hoặc cân nhắc nâng cấp gói trả phí.
