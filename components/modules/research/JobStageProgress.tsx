'use client';

import { Check, X, Loader2, Pause, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import * as Types from '@/lib/types';

const STEPS: { key: Types.ResearchJobStatus; label: string }[] = [
  { key: 'generating_hashtags', label: 'Sinh hashtag' },
  { key: 'scraping', label: 'Cào TikTok' },
  { key: 'downloading', label: 'Tải video' },
  { key: 'analyzing', label: 'Phân tích' },
  { key: 'generating_scripts', label: 'Sinh kịch bản' },
];

function stepIndexForStatus(status: Types.ResearchJobStatus): number {
  if (status === 'queued') return -1;
  if (status === 'awaiting_hashtag_selection') return 0;
  // Dừng NGAY SAU khi phân tích xong (index của 'analyzing'), TRƯỚC khi sinh
  // kịch bản - chờ người dùng chọn combo hook/pain point/DISC.
  if (status === 'awaiting_combo_selection') return STEPS.findIndex((s) => s.key === 'analyzing');
  if (status === 'completed') return STEPS.length;
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? -1 : idx;
}

interface JobStageProgressProps {
  status: Types.ResearchJobStatus;
  errorStage?: string;
  // Bước đang chạy dở lúc bị dừng (lấy từ progress entry cuối cùng) - chỉ có
  // ý nghĩa khi status === 'cancelled'.
  cancelledStage?: string;
  latestPercent?: number;
  latestMessage?: string;
}

export function JobStageProgress({
  status,
  errorStage,
  cancelledStage,
  latestPercent,
  latestMessage,
}: JobStageProgressProps) {
  const failed = status === 'failed';
  const cancelled = status === 'cancelled';
  const paused = status === 'awaiting_hashtag_selection' || status === 'awaiting_combo_selection';
  const currentIndex = failed
    ? STEPS.findIndex((s) => s.key === errorStage)
    : cancelled
      ? STEPS.findIndex((s) => s.key === cancelledStage)
      : stepIndexForStatus(status);

  return (
    <div className="space-y-4">
      <div className="flex items-start">
        {STEPS.map((step, i) => {
          const isDone = !failed && !cancelled && i < currentIndex;
          const isPausedHere = paused && i === currentIndex;
          const isCurrent = !failed && !cancelled && !paused && i === currentIndex && status !== 'completed';
          const isFailed = failed && i === currentIndex;
          const isCancelledHere = cancelled && i === currentIndex;

          return (
            <div key={step.key} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 w-20 shrink-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0',
                    isDone && 'bg-success border-success text-success-foreground',
                    isCurrent && 'border-primary text-link',
                    isPausedHere && 'border-warning text-warning',
                    isFailed && 'bg-destructive border-destructive text-destructive-foreground',
                    isCancelledHere && 'bg-muted border-border-strong text-muted-foreground',
                    !isDone && !isCurrent && !isPausedHere && !isFailed && !isCancelledHere &&
                      'border-border-strong text-muted-foreground'
                  )}
                >
                  {isDone && <Check size={16} />}
                  {isFailed && <X size={16} />}
                  {isCancelledHere && <Square size={14} />}
                  {isCurrent && <Loader2 size={16} className="animate-spin" />}
                  {isPausedHere && <Pause size={14} />}
                  {!isDone && !isCurrent && !isPausedHere && !isFailed && !isCancelledHere && (
                    <span className="text-xs font-semibold">{i + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium text-center leading-tight',
                    (isDone || isCurrent) && 'text-foreground',
                    isPausedHere && 'text-warning',
                    isFailed && 'text-destructive',
                    !isDone && !isCurrent && !isPausedHere && !isFailed && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn('flex-1 h-0.5 mx-1 mt-4', isDone ? 'bg-success' : 'bg-muted')}
                />
              )}
            </div>
          );
        })}
      </div>

      {latestMessage && !failed && !cancelled && status !== 'completed' && !paused && (
        <div className="space-y-1.5">
          <Progress value={latestPercent ?? 0} />
          <p className="text-sm text-muted-foreground">{latestMessage}</p>
        </div>
      )}
    </div>
  );
}
