'use client';

import { useCallback, useEffect, useState } from 'react';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

interface UseResearchJobStreamResult {
  job: Types.ResearchJob | null;
  trendVideos: Types.TrendVideo[];
  ideas: Types.Idea[];
  scripts: Types.ResearchScript[];
  loading: boolean;
  error: string | null;
  connectionMode: 'sse' | 'polling';
  reload: () => void;
}

function isTerminalStatus(status?: Types.ResearchJobStatus): boolean {
  return status === 'completed' || status === 'failed';
}

/**
 * Theo dõi 1 research job real-time: mở SSE tới
 * GET /research/jobs/:id/stream, mỗi khi có event (progress/stage_complete/
 * done/error) thì tải lại chi tiết job qua REST (đơn giản và chắc chắn hơn
 * tự ráp state từ payload rời rạc của từng loại event).
 *
 * Nếu SSE đứt kết nối (lỗi mạng, server rớt...) thì đóng hẳn EventSource và
 * chuyển hẳn sang polling 3s - KHÔNG để trình duyệt tự động reconnect SSE
 * (mặc định của EventSource) chồng lên polling gây gọi API trùng lặp.
 *
 * Gọi reload() sau khi tự thực hiện 1 hành động đổi trạng thái job từ bên
 * ngoài (vd bấm "Thử lại") để mở lại kết nối SSE mới cho lượt chạy tiếp theo.
 */
export function useResearchJobStream(jobId: string): UseResearchJobStreamResult {
  const [job, setJob] = useState<Types.ResearchJob | null>(null);
  const [trendVideos, setTrendVideos] = useState<Types.TrendVideo[]>([]);
  const [ideas, setIdeas] = useState<Types.Idea[]>([]);
  const [scripts, setScripts] = useState<Types.ResearchScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<'sse' | 'polling'>('sse');
  const [reloadTick, setReloadTick] = useState(0);

  const fetchDetail = useCallback(async () => {
    const detail = await API.ResearchJobAPI.get(jobId);
    setJob(detail.job);
    setTrendVideos(detail.trendVideos);
    setIdeas(detail.ideas);
    setScripts(detail.scripts);
    return detail.job;
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDetail()
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Không tải được thông tin job');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchDetail, reloadTick]);

  useEffect(() => {
    let stopped = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let es: EventSource | null = null;

    const refreshAfterEvent = () => {
      fetchDetail().catch(() => {});
    };

    const startPolling = () => {
      if (pollInterval || stopped) return;
      setConnectionMode('polling');
      pollInterval = setInterval(async () => {
        try {
          const latestJob = await fetchDetail();
          if (isTerminalStatus(latestJob.status) && pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        } catch {
          // Bỏ qua, thử lại ở lượt poll kế tiếp - không spam lỗi liên tục.
        }
      }, 3000);
    };

    setConnectionMode('sse');
    es = new EventSource(API.ResearchJobAPI.streamUrl(jobId));

    es.addEventListener('progress_history', refreshAfterEvent);
    es.addEventListener('progress', refreshAfterEvent);
    es.addEventListener('stage_complete', refreshAfterEvent);
    es.addEventListener('done', () => {
      refreshAfterEvent();
      es?.close();
    });
    es.addEventListener('error', (e: Event) => {
      if (e instanceof MessageEvent && typeof e.data === 'string') {
        // Named event "error" thật từ pipeline (job vừa failed) - có kèm
        // data, khác với event lỗi kết nối gốc của EventSource (không có data).
        refreshAfterEvent();
        es?.close();
        return;
      }
      // Lỗi kết nối SSE - đóng hẳn, không để EventSource tự retry, chuyển
      // hẳn sang polling 3s theo đúng yêu cầu.
      es?.close();
      startPolling();
    });

    return () => {
      stopped = true;
      es?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [jobId, fetchDetail, reloadTick]);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  return { job, trendVideos, ideas, scripts, loading, error, connectionMode, reload };
}
