# server/scripts/

Nơi chứa script chạy tay một lần (verify thật, debug, đo chi phí...) - KHÔNG
phải code sản phẩm. Không import bởi bất kỳ file nào trong `server/services`,
`server/controllers`, `server/models`.

Quy ước: xoá script sau khi dùng xong nếu chỉ là verify tạm thời (ví dụ
`_realtest_*.ts`). Chỉ giữ lại script ở đây nếu nó THẬT SỰ cần dùng lại nhiều
lần (ví dụ script backfill dữ liệu).
