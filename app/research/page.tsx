'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Card, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { formatRelativeTime, formatDateTime, formatCurrency, productName } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

export default function ResearchHistoryPage() {
  const [jobs, setJobs] = useState<Types.ResearchJob[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await API.ResearchJobAPI.list(p, 20);
      setJobs(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được lịch sử research');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Nghiên cứu TikTok"
        description="Danh sách các job nghiên cứu xu hướng TikTok đã chạy"
        icon={<History size={28} />}
      />

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Card>
          <CardContent>
            <ErrorState message={error} onRetry={() => load(page)} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && jobs.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              title="Chưa có job research nào"
              description='Vào trang sản phẩm và bấm "Nghiên cứu TikTok" để bắt đầu.'
            />
          </CardContent>
        </Card>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/research/${job.id}`}>
              <Card className="hover:border-border-strong transition-colors cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-foreground">{productName(job.productId)}</p>
                    <p className="text-sm text-muted-foreground mt-0.5" title={formatDateTime(job.createdAt)}>
                      {formatRelativeTime(job.createdAt)} · {formatCurrency(job.cost.totalEstimatedUsd)}
                    </p>
                  </div>
                  <StatusBadge domain="researchJob" value={job.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={16} className="mr-1" /> Trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Sau <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
