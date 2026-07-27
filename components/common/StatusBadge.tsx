import React from 'react';
import { cn } from '@/lib/utils';
import type * as Types from '@/lib/types';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning',
  danger: 'bg-destructive/15 text-destructive',
};

interface StatusConfigEntry {
  label: string;
  tone: Tone;
}

const RESEARCH_JOB_CONFIG: Record<Types.ResearchJobStatus, StatusConfigEntry> = {
  queued: { label: 'Đang chờ', tone: 'neutral' },
  generating_hashtags: { label: 'Đang sinh hashtag', tone: 'info' },
  awaiting_hashtag_selection: { label: 'Chờ chọn hashtag', tone: 'warning' },
  scraping: { label: 'Đang cào TikTok', tone: 'info' },
  downloading: { label: 'Đang tải video', tone: 'info' },
  analyzing: { label: 'Đang phân tích', tone: 'info' },
  generating_scripts: { label: 'Đang sinh kịch bản', tone: 'info' },
  completed: { label: 'Hoàn tất', tone: 'success' },
  failed: { label: 'Thất bại', tone: 'danger' },
};

const PRODUCT_CONFIG: Record<Types.ProductBrief['status'], StatusConfigEntry> = {
  active: { label: 'Đang hoạt động', tone: 'success' },
  archived: { label: 'Đã lưu trữ', tone: 'neutral' },
};

const IDEA_STATUS_CONFIG: Record<Types.Idea['status'], StatusConfigEntry> = {
  draft: { label: 'Nháp (chờ duyệt)', tone: 'warning' },
  new: { label: 'Mới', tone: 'neutral' },
  'in progress': { label: 'Đang làm', tone: 'info' },
  done: { label: 'Hoàn thành', tone: 'success' },
  discarded: { label: 'Đã huỷ', tone: 'danger' },
};

const IDEA_PRIORITY_CONFIG: Record<Types.Idea['priority'], StatusConfigEntry> = {
  low: { label: 'Thấp', tone: 'neutral' },
  medium: { label: 'Trung bình', tone: 'warning' },
  high: { label: 'Cao', tone: 'danger' },
};

const SCRIPT_CONFIG: Record<Types.ResearchScript['status'], StatusConfigEntry> = {
  draft: { label: 'Nháp', tone: 'neutral' },
  approved: { label: 'Đã lưu', tone: 'success' },
  rejected: { label: 'Đã từ chối', tone: 'danger' },
};

const TREND_VIDEO_DOWNLOAD_CONFIG: Record<Types.TrendVideoDownloadStatus, StatusConfigEntry> = {
  pending: { label: 'Đang chờ tải', tone: 'neutral' },
  downloaded_apify: { label: 'Đã tải (Apify)', tone: 'success' },
  downloaded_ytdlp: { label: 'Đã tải (yt-dlp)', tone: 'success' },
  text_only: { label: 'Chỉ có văn bản', tone: 'warning' },
  failed: { label: 'Tải thất bại', tone: 'danger' },
};

const CONFIG_BY_DOMAIN = {
  researchJob: RESEARCH_JOB_CONFIG,
  product: PRODUCT_CONFIG,
  ideaStatus: IDEA_STATUS_CONFIG,
  ideaPriority: IDEA_PRIORITY_CONFIG,
  script: SCRIPT_CONFIG,
  trendVideoDownload: TREND_VIDEO_DOWNLOAD_CONFIG,
} as const;

type StatusDomain = keyof typeof CONFIG_BY_DOMAIN;

interface StatusBadgeProps<D extends StatusDomain> {
  domain: D;
  value: keyof (typeof CONFIG_BY_DOMAIN)[D];
  className?: string;
}

export function StatusBadge<D extends StatusDomain>({ domain, value, className }: StatusBadgeProps<D>) {
  const config = CONFIG_BY_DOMAIN[domain] as Record<string, StatusConfigEntry>;
  const entry = config[value as string] ?? { label: String(value), tone: 'neutral' as Tone };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded text-xs font-semibold whitespace-nowrap',
        TONE_CLASSES[entry.tone],
        className
      )}
    >
      {entry.label}
    </span>
  );
}
