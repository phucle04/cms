/**
 * Bộ quét tuân thủ TỐI GIẢN (Giai đoạn 5, G6a/G6#10) - so khớp từ khoá/cụm từ,
 * KHÔNG phải AI, KHÔNG bắt được diễn đạt gián tiếp (vd "trộm vía bé êm bụng"
 * thay vì nói thẳng "chữa táo bón"). Đây là lớp lọc SƠ BỘ đầu tiên; phần diễn
 * đạt gián tiếp bắt buộc phải do người phụ trách đọc tay (xem G8/docs/COSTS
 * hoặc CMS_OVERVIEW.md phần cổng tuân thủ).
 *
 * Nguồn danh sách cấm: BrandProfile.dontList (do người dùng tự cấu hình) +
 * BASELINE_BANNED_PHRASES (nhóm claim y tế/so sánh sữa mẹ phổ biến trong
 * ngành sữa công thức - xem Nghị định 100/2014/NĐ-CP).
 */

export interface ComplianceFlag {
  phrase: string;
  source: 'dontList' | 'baseline';
  /** Đoạn văn bản quanh chỗ khớp, để hiển thị/bôi đỏ trong UI */
  context: string;
  index: number;
}

export const BASELINE_BANNED_PHRASES: string[] = [
  'chữa bệnh',
  'chữa khỏi',
  'chữa dứt điểm',
  'trị bệnh',
  'trị dứt điểm',
  'đặc trị',
  'khỏi bệnh',
  'ngừa bệnh',
  'phòng ngừa bệnh',
  'phòng ngừa 100%',
  'cam kết khỏi',
  'cam kết hiệu quả',
  'hiệu quả tức thì',
  'hiệu quả ngay lập tức',
  'thần dược',
  'công dụng thần kỳ',
  'thay thế sữa mẹ',
  'tốt hơn sữa mẹ',
  'thay thế hoàn toàn sữa mẹ',
  'không cần đi khám',
  'không cần gặp bác sĩ',
];

function normalize(text: string): string {
  return text.toLowerCase();
}

/**
 * Quét 1 đoạn nội dung kịch bản, trả về danh sách các cụm từ khớp danh sách
 * cấm (dontList của brand + baseline). Không throw, không chặn gì - chỉ trả
 * dữ liệu để UI hiển thị cảnh báo.
 */
export function scanScriptCompliance(content: string, dontList: string[] = []): ComplianceFlag[] {
  if (!content) return [];
  const haystack = normalize(content);
  const flags: ComplianceFlag[] = [];

  const scan = (phrases: string[], source: ComplianceFlag['source']) => {
    for (const rawPhrase of phrases) {
      const phrase = rawPhrase.trim();
      if (!phrase) continue;
      const needle = normalize(phrase);
      let fromIndex = 0;
      while (true) {
        const idx = haystack.indexOf(needle, fromIndex);
        if (idx === -1) break;
        flags.push({
          phrase,
          source,
          context: content.slice(Math.max(0, idx - 25), idx + needle.length + 25).trim(),
          index: idx,
        });
        fromIndex = idx + needle.length;
      }
    }
  };

  scan(BASELINE_BANNED_PHRASES, 'baseline');
  scan(dontList, 'dontList');

  return flags.sort((a, b) => a.index - b.index);
}
