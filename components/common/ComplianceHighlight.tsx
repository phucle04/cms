import type { ReactNode } from 'react';
import type { ComplianceFlag } from '@/lib/types';

interface ComplianceHighlightProps {
  text: string;
  flags?: ComplianceFlag[];
  className?: string;
}

/**
 * Bôi đỏ các cụm từ bị bộ quét tuân thủ (G6a) đánh dấu, ngay trong đoạn văn
 * bản gốc. Đây là lớp lọc SƠ BỘ (khớp cụm từ) - không bắt được diễn đạt gián
 * tiếp, xem docs/COSTS.md phần cổng tuân thủ.
 */
export function ComplianceHighlight({ text, flags, className }: ComplianceHighlightProps) {
  if (!flags || flags.length === 0) {
    return <p className={className}>{text}</p>;
  }

  const lowerText = text.toLowerCase();
  const relevant = flags.filter((f) => lowerText.includes(f.phrase.toLowerCase()));
  if (relevant.length === 0) {
    return <p className={className}>{text}</p>;
  }

  const ranges: Array<{ start: number; end: number }> = [];
  for (const flag of relevant) {
    const needle = flag.phrase.toLowerCase();
    let from = 0;
    while (true) {
      const idx = lowerText.indexOf(needle, from);
      if (idx === -1) break;
      ranges.push({ start: idx, end: idx + needle.length });
      from = idx + needle.length;
    }
  }
  ranges.sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  merged.forEach((r, i) => {
    if (r.start > cursor) parts.push(text.slice(cursor, r.start));
    parts.push(
      <mark
        key={i}
        className="bg-destructive-muted text-destructive-muted-foreground rounded px-0.5 not-italic"
        title="Cụm từ bị bộ quét tuân thủ đánh dấu - cần người phụ trách xem lại"
      >
        {text.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  return <p className={className}>{parts}</p>;
}
