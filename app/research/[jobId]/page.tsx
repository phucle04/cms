'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, AlertTriangle, Wifi, WifiOff, OctagonX, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/common/Tabs';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { formatRelativeTime, formatDateTime, formatCurrency, productName, productLinkId } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { JobStageProgress } from '@/components/modules/research/JobStageProgress';
import { HashtagSelectionPanel } from '@/components/modules/research/HashtagSelectionPanel';
import { ComboSelectionPanel } from '@/components/modules/research/ComboSelectionPanel';
import { TrendVideoCard } from '@/components/modules/research/TrendVideoCard';
import { ResearchScriptCard } from '@/components/modules/research/ResearchScriptCard';
import { useResearchJobStream } from '@/hooks/useResearchJobStream';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

const PRE_SCRAPE_STATUSES: Types.ResearchJobStatus[] = ['queued', 'generating_hashtags', 'awaiting_hashtag_selection'];
const PRE_SCRIPT_STATUSES: Types.ResearchJobStatus[] = [
  'queued',
  'generating_hashtags',
  'awaiting_hashtag_selection',
  'scraping',
  'downloading',
  'analyzing',
  'awaiting_combo_selection',
];
// Job còn "sống" (chưa tới trạng thái cuối) - có thể bấm dừng ở bất kỳ bước nào trong số này.
const STOPPABLE_STATUSES: Types.ResearchJobStatus[] = [
  'queued',
  'generating_hashtags',
  'awaiting_hashtag_selection',
  'scraping',
  'downloading',
  'analyzing',
  'awaiting_combo_selection',
  'generating_scripts',
];

function formatVideoAgeLimit(months: number): string {
  if (months % 12 === 0) return `${months / 12} năm`;
  return `${months} tháng`;
}

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-9/16 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function ScriptListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function ResearchJobPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const { job, trendVideos, scripts, loading, error, connectionMode, reload } = useResearchJobStream(jobId);
  const [submittingHashtags, setSubmittingHashtags] = useState(false);
  const [submittingCombos, setSubmittingCombos] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleSelectHashtags = async (selected: string[]) => {
    setSubmittingHashtags(true);
    try {
      await API.ResearchJobAPI.selectHashtags(jobId, selected);
      toast.success('Đã chọn hashtag, đang bắt đầu cào TikTok...');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không chọn được hashtag');
    } finally {
      setSubmittingHashtags(false);
    }
  };

  const handleSelectCombos = async (combos: Types.ResearchJobCombo[]) => {
    setSubmittingCombos(true);
    try {
      await API.ResearchJobAPI.selectCombos(jobId, combos);
      toast.success('Đã chọn combo, đang bắt đầu sinh kịch bản...');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không chọn được combo');
    } finally {
      setSubmittingCombos(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await API.ResearchJobAPI.retry(jobId);
      toast.success('Đang thử lại job từ bước bị lỗi...');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Thử lại thất bại');
    } finally {
      setRetrying(false);
    }
  };

  const handleCancel = async () => {
    setShowCancelConfirm(false);
    setCancelling(true);
    try {
      await API.ResearchJobAPI.cancel(jobId);
      toast.success('Đã gửi yêu cầu dừng - job sẽ dừng trong giây lát');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không dừng được job');
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !job) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="p-6">
        <Card>
          <CardContent>
            <ErrorState message={error} onRetry={reload} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job) return null;

  const latestProgress = job.progress[job.progress.length - 1];
  const videosPending = trendVideos.length === 0 && PRE_SCRAPE_STATUSES.includes(job.status);
  const videosLoading = trendVideos.length === 0 && job.status === 'scraping';
  const scriptsPending = scripts.length === 0 && PRE_SCRIPT_STATUSES.includes(job.status);
  const scriptsLoading = scripts.length === 0 && job.status === 'generating_scripts';
  const canCancel = STOPPABLE_STATUSES.includes(job.status);
  const stopping = canCancel && Boolean(job.cancelRequested);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/research"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft size={14} /> Lịch sử research
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 flex-wrap">
            Research:{' '}
            {productLinkId(job.productId) ? (
              <Link href={`/products/${productLinkId(job.productId)}`} className="hover:underline">
                {productName(job.productId)}
              </Link>
            ) : (
              <span className="text-muted-foreground">{productName(job.productId)}</span>
            )}
            <StatusBadge domain="researchJob" value={job.status} />
          </h1>
          <p className="text-sm text-muted-foreground mt-1" title={formatDateTime(job.createdAt)}>
            Chi phí ước tính: {formatCurrency(job.cost.totalEstimatedUsd)} · Tạo {formatRelativeTime(job.createdAt)}
            {job.maxVideoAgeMonths ? ` · Chỉ quét video đăng trong ${formatVideoAgeLimit(job.maxVideoAgeMonths)} gần đây` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {connectionMode === 'sse' ? <Wifi size={14} className="text-success" /> : <WifiOff size={14} className="text-warning" />}
            {connectionMode === 'sse' ? 'Đang cập nhật real-time' : 'Mất kết nối real-time - đang cập nhật mỗi 3 giây'}
          </div>
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelConfirm(true)}
              isLoading={cancelling}
              disabled={stopping}
            >
              <OctagonX size={14} className="mr-1.5" />
              {stopping ? 'Đang dừng...' : 'Dừng job'}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <JobStageProgress
            status={job.status}
            errorStage={job.error?.stage}
            cancelledStage={job.status === 'cancelled' ? latestProgress?.stage : undefined}
            latestPercent={latestProgress?.percent}
            latestMessage={latestProgress?.message}
          />
        </CardContent>
      </Card>

      {job.status === 'cancelled' && (
        <Card className="border-border-strong">
          <CardContent className="pt-6 flex items-start gap-3">
            <Info className="text-muted-foreground shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-foreground">
                Job đã dừng theo yêu cầu{latestProgress?.stage ? ` ở bước "${latestProgress.stage}"` : ''}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Dữ liệu đã xử lý xong trước khi dừng (video/kịch bản, nếu có) vẫn được giữ lại bên dưới - không bị mất.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {job.status === 'failed' && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-destructive">Job thất bại ở bước &quot;{job.error?.stage}&quot;</p>
                <p className="text-sm text-muted-foreground mt-1">{job.error?.message}</p>
              </div>
            </div>
            <Button onClick={handleRetry} isLoading={retrying} variant="destructive">
              Thử lại từ bước bị lỗi
            </Button>
          </CardContent>
        </Card>
      )}

      {job.status === 'awaiting_hashtag_selection' && (
        <HashtagSelectionPanel
          suggestedHashtags={job.suggestedHashtags}
          onSubmit={handleSelectHashtags}
          submitting={submittingHashtags}
        />
      )}

      {job.status === 'awaiting_combo_selection' && (
        <ComboSelectionPanel
          trendStats={job.trendStats}
          suggestedCombos={job.suggestedCombos}
          onSubmit={handleSelectCombos}
          submitting={submittingCombos}
        />
      )}

      <Tabs defaultValue="videos">
        <TabsList>
          <TabsTrigger value="videos">Video viral ({trendVideos.length})</TabsTrigger>
          <TabsTrigger value="scripts">5 kịch bản ({scripts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="videos">
          {videosLoading && <VideoGridSkeleton />}
          {videosPending && (
            <Card>
              <CardContent>
                <EmptyState title="Video sẽ xuất hiện sau khi cào xong TikTok" />
              </CardContent>
            </Card>
          )}
          {trendVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {trendVideos.map((v) => (
                <TrendVideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scripts">
          {scriptsLoading && <ScriptListSkeleton />}
          {scriptsPending && (
            <Card>
              <CardContent>
                <EmptyState title="Kịch bản sẽ xuất hiện sau khi phân tích xong video và sinh kịch bản" />
              </CardContent>
            </Card>
          )}
          {scripts.length > 0 && (
            <div className="space-y-4">
              {scripts.map((s, i) => (
                <ResearchScriptCard key={s.id} script={s} index={i} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Modal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="Dừng job nghiên cứu?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleCancel} isLoading={cancelling}>
              Dừng job
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Job sẽ dừng lại trong giây lát ở bước đang chạy. Dữ liệu đã xử lý xong (video/kịch bản, nếu có) vẫn được giữ
          lại, không bị mất - nhưng phần đang chạy dở sẽ không hoàn tất.
        </p>
      </Modal>
    </div>
  );
}
