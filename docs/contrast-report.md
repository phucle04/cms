# Báo cáo tương phản màu (WCAG)

Tự động tính bằng `scripts/contrast-check.mjs` (OKLCH -> sRGB -> luminance theo chuẩn CSS Color 4, không dùng thư viện ngoài). Ngưỡng: chữ thường ≥ 4.5:1, chữ lớn/icon ≥ 3:1, viền ≥ 3:1.

## Chế độ Sáng

| Cặp | Chữ/viền | Nền | Ngưỡng | Tỉ lệ đo được | Kết quả |
|---|---|---|---|---|---|
| Chữ chính trên nền trang | `foreground` | `background` | 4.5:1 | 19.79:1 | ✅ Đạt |
| Chữ phụ/mờ trên nền trang (muted-foreground - dùng chung cho secondary & muted) | `muted-foreground` | `background` | 4.5:1 | 5.51:1 | ✅ Đạt |
| Chữ chính trên card | `foreground` | `card` | 4.5:1 | 19.79:1 | ✅ Đạt |
| Chữ phụ trên card | `muted-foreground` | `card` | 4.5:1 | 5.51:1 | ✅ Đạt |
| Chữ chính trên nền subtle (bg-muted, hover row) | `foreground` | `muted` | 4.5:1 | 18.15:1 | ✅ Đạt |
| Chữ phụ trên nền subtle | `muted-foreground` | `muted` | 4.5:1 | 5.05:1 | ✅ Đạt |
| Chữ trên nút chính (accent) | `primary-foreground` | `primary` | 4.5:1 | 6.17:1 | ✅ Đạt |
| Link/chữ màu nhấn trên nền trang (token link, tách khỏi primary) | `link` | `background` | 4.5:1 | 6.44:1 | ✅ Đạt |
| Link/chữ màu nhấn trên card | `link` | `card` | 4.5:1 | 6.44:1 | ✅ Đạt |
| Chữ trên nút nguy hiểm | `destructive-foreground` | `destructive` | 4.5:1 | 4.56:1 | ✅ Đạt |
| Badge nguy hiểm (nền nhạt + chữ đậm) | `destructive-muted-foreground` | `destructive-muted` | 4.5:1 | 5.88:1 | ✅ Đạt |
| Badge thành công (nền nhạt + chữ đậm) | `success-muted-foreground` | `success-muted` | 4.5:1 | 4.72:1 | ✅ Đạt |
| Badge cảnh báo (nền nhạt + chữ đậm) | `warning-muted-foreground` | `warning-muted` | 4.5:1 | 4.87:1 | ✅ Đạt |
| Badge thông tin (nền nhạt + chữ đậm) | `info-muted-foreground` | `info-muted` | 4.5:1 | 6.26:1 | ✅ Đạt |
| Icon trạng thái thành công trên nền trang | `success` | `background` | 3:1 | 3.22:1 | ✅ Đạt |
| Icon trạng thái cảnh báo trên nền trang | `warning` | `background` | 3:1 | 3.19:1 | ✅ Đạt |
| Icon trạng thái nguy hiểm trên nền trang | `destructive` | `background` | 3:1 | 4.76:1 | ✅ Đạt |
| Icon trạng thái info trên nền trang | `info` | `background` | 3:1 | 5.26:1 | ✅ Đạt |
| Viền thường trên nền trang | `border` | `background` | 3:1 | 3.23:1 | ✅ Đạt |
| Viền đậm (input/focus) trên nền trang | `border-strong` | `background` | 3:1 | 4.85:1 | ✅ Đạt |
| Viền thường trên card | `border` | `card` | 3:1 | 3.23:1 | ✅ Đạt |
| Viền ô nhập liệu (input) trên nền trang | `input` | `background` | 3:1 | 4.85:1 | ✅ Đạt |

**Số cặp không đạt: 0**

## Chế độ Tối

| Cặp | Chữ/viền | Nền | Ngưỡng | Tỉ lệ đo được | Kết quả |
|---|---|---|---|---|---|
| Chữ chính trên nền trang | `foreground` | `background` | 4.5:1 | 17.88:1 | ✅ Đạt |
| Chữ phụ/mờ trên nền trang (muted-foreground - dùng chung cho secondary & muted) | `muted-foreground` | `background` | 4.5:1 | 7.63:1 | ✅ Đạt |
| Chữ chính trên card | `foreground` | `card` | 4.5:1 | 16.18:1 | ✅ Đạt |
| Chữ phụ trên card | `muted-foreground` | `card` | 4.5:1 | 6.91:1 | ✅ Đạt |
| Chữ chính trên nền subtle (bg-muted, hover row) | `foreground` | `muted` | 4.5:1 | 13.66:1 | ✅ Đạt |
| Chữ phụ trên nền subtle | `muted-foreground` | `muted` | 4.5:1 | 5.83:1 | ✅ Đạt |
| Chữ trên nút chính (accent) | `primary-foreground` | `primary` | 4.5:1 | 5.66:1 | ✅ Đạt |
| Link/chữ màu nhấn trên nền trang (token link, tách khỏi primary) | `link` | `background` | 4.5:1 | 7.71:1 | ✅ Đạt |
| Link/chữ màu nhấn trên card | `link` | `card` | 4.5:1 | 6.98:1 | ✅ Đạt |
| Chữ trên nút nguy hiểm | `destructive-foreground` | `destructive` | 4.5:1 | 7.00:1 | ✅ Đạt |
| Badge nguy hiểm (nền nhạt + chữ đậm) | `destructive-muted-foreground` | `destructive-muted` | 4.5:1 | 5.28:1 | ✅ Đạt |
| Badge thành công (nền nhạt + chữ đậm) | `success-muted-foreground` | `success-muted` | 4.5:1 | 6.49:1 | ✅ Đạt |
| Badge cảnh báo (nền nhạt + chữ đậm) | `warning-muted-foreground` | `warning-muted` | 4.5:1 | 6.30:1 | ✅ Đạt |
| Badge thông tin (nền nhạt + chữ đậm) | `info-muted-foreground` | `info-muted` | 4.5:1 | 5.77:1 | ✅ Đạt |
| Icon trạng thái thành công trên nền trang | `success` | `background` | 3:1 | 8.66:1 | ✅ Đạt |
| Icon trạng thái cảnh báo trên nền trang | `warning` | `background` | 3:1 | 9.24:1 | ✅ Đạt |
| Icon trạng thái nguy hiểm trên nền trang | `destructive` | `background` | 3:1 | 7.00:1 | ✅ Đạt |
| Icon trạng thái info trên nền trang | `info` | `background` | 3:1 | 6.76:1 | ✅ Đạt |
| Viền thường trên nền trang | `border` | `background` | 3:1 | 4.01:1 | ✅ Đạt |
| Viền đậm (input/focus) trên nền trang | `border-strong` | `background` | 3:1 | 3.30:1 | ✅ Đạt |
| Viền thường trên card | `border` | `card` | 3:1 | 3.63:1 | ✅ Đạt |
| Viền ô nhập liệu (input) trên nền trang | `input` | `background` | 3:1 | 3.30:1 | ✅ Đạt |

**Số cặp không đạt: 0**

---

Chạy lại: `node scripts/contrast-check.mjs`
