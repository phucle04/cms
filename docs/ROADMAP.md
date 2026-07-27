# Roadmap sau Giai đoạn 4.5B

Các mục dưới đây là tính năng đã bị xoá khỏi UI trong đợt dọn dẹp này vì bản
cũ chạy trên **dữ liệu giả** (mock, không có backend thật). Người dùng xác
nhận vẫn cần các tính năng này — chỉ là phải làm lại bằng dữ liệu thật ở một
lượt backend riêng. Xếp theo giá trị/công sức ước lượng (cao → thấp).

## 1. Analytics / KPI thật (giá trị cao, công sức cao)

**Đã xoá:** `/analytics` (tab KPI, Win-Loss Analysis, Lessons), `KPIAPI`,
`AnalysisAPI`, `LessonAPI` (toàn bộ mock trong `lib/api.ts`), `KPIForm.tsx`.

**Cần làm lại:**
- Server: thêm `kpiController`, `analysisController`, `lessonController` +
  route tương ứng trong `server/routes/api.ts`. Model `VideoKPI.ts` và
  `WinLossAnalysis.ts` đã có sẵn trong `server/models/` (orphan, chưa dùng)
  nhưng cần rà lại schema có khớp nhu cầu thật không (ví dụ: KPI nên gắn vào
  `ResearchScript` thật qua `scriptId`, không phải KPI đứng độc lập như bản
  mock).
- Cần nguồn dữ liệu thật cho "views/likes/comments" sau khi đăng video lên
  TikTok — hiện hệ thống không có tích hợp nào để lấy số liệu hiệu suất sau
  khi đăng (đây là khoảng trống lớn nhất: tất cả dữ liệu KPI trước giờ đều do
  người dùng tự nhập tay hoặc là mock).
- Quyết định cần chốt trước khi code: nhập tay số liệu, hay tích hợp API
  TikTok/Apify để tự động lấy view/like/comment theo video đã đăng?

**Công sức:** cao (cần thiết kế lại model, quyết định nguồn dữ liệu, làm API
mới, làm UI biểu đồ/bảng xếp hạng).

## 2. "Tạo lại kịch bản này" (giá trị trung bình, công sức trung bình)

**Đã xoá:** nút trong `ResearchScriptCard.tsx` (trước đây chỉ là stub báo lỗi
"chưa có API").

**Cần làm lại:**
- Server: thêm 1 endpoint (ví dụ `POST /research/jobs/:jobId/scripts/:scriptId/regenerate`)
  gọi lại đúng bước sinh kịch bản (Stage 5 trong `researchPipelineService.ts`)
  nhưng chỉ cho 1 kịch bản, dùng lại video/phân tích đã có sẵn của job (không
  cào lại TikTok, không tốn thêm Apify — chỉ tốn thêm 1 lượt gọi Gemini).
- Cần quyết định: kịch bản cũ bị ghi đè, hay tạo bản mới giữ cả 2 để so sánh?

**Công sức:** trung bình (logic Stage 5 đã có sẵn, chỉ cần tách ra gọi lại
cho 1 item thay vì cả batch 5 item).

## 3. Content Calendar (giá trị thấp hơn, công sức cao)

**Đã xoá:** tab "Content Calendar" trong `/ideation` (luôn là placeholder
"coming soon", chưa từng có dữ liệu thật).

**Cần làm lại:**
- Server: cần model mới (`ContentCalendarEvent` — đã có type nháp trong
  lịch sử code cũ nhưng chưa từng có model/route thật) + route CRUD.
- UI: lịch tuần/tháng, kéo-thả gắn ý tưởng/kịch bản vào ngày đăng, nhắc lịch.
- Đây là tính năng chưa có bất kỳ nền tảng thật nào (khác 2 mục trên đã có
  ít nhiều model/service liên quan) nên công sức thực tế sẽ cao nhất dù giá
  trị công việc hiện tại thấp hơn 2 mục trên.

**Công sức:** cao (làm từ đầu, không có gì tái sử dụng).

---

## Ghi chú khác (không phải xoá, chỉ là quyết định để ngỏ)

- `POST /research/run` (route "legacy" ở server, độc lập với pipeline 5 bước)
  vẫn còn nguyên ở server theo đúng yêu cầu (không đụng server). Frontend đã
  bỏ hẳn wrapper `ResearchAPI` vì không còn UI nào gọi. Nếu sau này không ai
  cần route legacy này nữa, có thể cân nhắc xoá ở một đợt dọn server riêng.
- `brand-profiles DELETE` và `prompt-templates POST/DELETE` là endpoint thật
  đã có ở server nhưng chưa gắn UI (xem báo cáo mục 5) — không nằm trong
  phạm vi 6 trang chốt của giai đoạn này, để dành cho lượt sau nếu cần quản
  lý nhiều brand profile / prompt template cùng lúc.
