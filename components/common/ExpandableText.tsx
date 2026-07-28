'use client';

import { useState } from 'react';

interface ExpandableTextProps {
  text: string;
  lines?: number;
  className?: string;
}

// Ngưỡng ước lượng để quyết định có cần nút "Xem thêm" không (tránh hiện nút
// thừa cho đoạn văn ngắn chắc chắn không tràn quá `lines` dòng).
const CHARS_PER_LINE_ESTIMATE = 70;

export function ExpandableText({ text, lines = 3, className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const mayOverflow = text.length > lines * CHARS_PER_LINE_ESTIMATE;

  if (!mayOverflow) {
    return <p className={className}>{text}</p>;
  }

  return (
    <div>
      <p
        className={className}
        style={
          expanded
            ? undefined
            : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
        }
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-sm text-link hover:underline mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        {expanded ? 'Thu gọn' : 'Xem thêm'}
      </button>
    </div>
  );
}
