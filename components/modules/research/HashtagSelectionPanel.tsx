'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Checkbox } from '@/components/ui/checkbox';
import * as Types from '@/lib/types';

interface HashtagSelectionPanelProps {
  suggestedHashtags: Types.ResearchJobSuggestedHashtag[];
  onSubmit: (selected: string[]) => void;
  submitting: boolean;
}

export function HashtagSelectionPanel({ suggestedHashtags, onSubmit, submitting }: HashtagSelectionPanelProps) {
  const sorted = useMemo(() => [...suggestedHashtags].sort((a, b) => b.score - a.score), [suggestedHashtags]);
  const top3Tags = useMemo(() => sorted.slice(0, 3).map((h) => h.tag), [sorted]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(top3Tags));

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chọn hashtag để cào TikTok</CardTitle>
        <CardDescription>
          AI đã gợi ý {suggestedHashtags.length} hashtag, mặc định tick sẵn 3 hashtag điểm cao nhất. Bạn có thể bỏ
          chọn hoặc chọn thêm trước khi bắt đầu cào.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((h) => (
          <label
            key={h.tag}
            className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
          >
            <Checkbox
              checked={selected.has(h.tag)}
              onCheckedChange={() => toggle(h.tag)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-white">{h.tag}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold whitespace-nowrap">
                  {h.score} điểm
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{h.reason}</p>
            </div>
          </label>
        ))}

        <div className="pt-2">
          <Button onClick={() => onSubmit(Array.from(selected))} disabled={selected.size === 0 || submitting} isLoading={submitting}>
            Bắt đầu cào TikTok ({selected.size} hashtag đã chọn)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
