'use client';

import { Check, X, Loader2, Pause } from 'lucide-react';
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
  if (status === 'completed') return STEPS.length;
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? -1 : idx;
}

interface JobStageProgressProps {
  status: Types.ResearchJobStatus;
  errorStage?: string;
  latestPercent?: number;
  latestMessage?: string;
}

export function JobStageProgress({ status, errorStage, latestPercent, latestMessage }: JobStageProgressProps) {
  const failed = status === 'failed';
  const paused = status === 'awaiting_hashtag_selection';
  const currentIndex = failed ? STEPS.findIndex((s) => s.key === errorStage) : stepIndexForStatus(status);

  return (
    <div className="space-y-4">
      <div className="flex items-start">
        {STEPS.map((step, i) => {
          const isDone = !failed && i < currentIndex;
          const isPausedHere = paused && i === currentIndex;
          const isCurrent = !failed && !paused && i === currentIndex && status !== 'completed';
          const isFailed = failed && i === currentIndex;

          return (
            <div key={step.key} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 w-20 shrink-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0',
                    isDone && 'bg-green-500 border-green-500 text-white',
                    isCurrent && 'border-blue-500 text-blue-600 dark:text-blue-400',
                    isPausedHere && 'border-amber-500 text-amber-600 dark:text-amber-400',
                    isFailed && 'bg-red-500 border-red-500 text-white',
                    !isDone && !isCurrent && !isPausedHere && !isFailed &&
                      'border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600'
                  )}
                >
                  {isDone && <Check size={16} />}
                  {isFailed && <X size={16} />}
                  {isCurrent && <Loader2 size={16} className="animate-spin" />}
                  {isPausedHere && <Pause size={14} />}
                  {!isDone && !isCurrent && !isPausedHere && !isFailed && (
                    <span className="text-xs font-semibold">{i + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium text-center leading-tight',
                    (isDone || isCurrent) && 'text-gray-900 dark:text-white',
                    isPausedHere && 'text-amber-600 dark:text-amber-400',
                    isFailed && 'text-red-600 dark:text-red-400',
                    !isDone && !isCurrent && !isPausedHere && !isFailed && 'text-gray-400 dark:text-gray-600'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn('flex-1 h-0.5 mx-1 mt-4', isDone ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-800')}
                />
              )}
            </div>
          );
        })}
      </div>

      {latestMessage && !failed && status !== 'completed' && !paused && (
        <div className="space-y-1.5">
          <Progress value={latestPercent ?? 0} />
          <p className="text-sm text-gray-600 dark:text-gray-400">{latestMessage}</p>
        </div>
      )}
    </div>
  );
}
