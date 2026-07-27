'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Card, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Skeleton } from '@/components/ui/skeleton';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

const STATUS_LABEL: Record<Types.ResearchJobStatus, string> = {
  queued: 'Đang chờ',
  generating_hashtags: 'Đang sinh hashtag',
  awaiting_hashtag_selection: 'Chờ chọn hashtag',
  scraping: 'Đang cào TikTok',
  downloading: 'Đang tải video',
  analyzing: 'Đang phân tích',
  generating_scripts: 'Đang sinh kịch bản',
  completed: 'Hoàn tất',
  failed: 'Thất bại',
};

const STATUS_COLOR: Record<Types.ResearchJobStatus, string> = {
  queued: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400',
  generating_hashtags: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  awaiting_hashtag_selection: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  scraping: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  downloading: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  analyzing: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  generating_scripts: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

function productName(productId: Types.ResearchJob['productId']): string {
  if (typeof productId === 'string') return productId;
  return productId.name;
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <History size={28} />
          Lịch sử Research
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Danh sách các job nghiên cứu xu hướng TikTok đã chạy</p>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <Button onClick={() => load(page)}>Thử lại</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && jobs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
            Chưa có job research nào. Vào trang sản phẩm và bấm &quot;Tạo kịch bản từ sản phẩm này&quot; để bắt đầu.
          </CardContent>
        </Card>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/research/${job.id}`}>
              <Card className="hover:border-gray-300 dark:hover:border-gray-700 transition-colors cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{productName(job.productId)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {new Date(job.createdAt).toLocaleString('vi-VN')} · ${job.cost.totalEstimatedUsd.toFixed(4)}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${STATUS_COLOR[job.status]}`}>
                    {STATUS_LABEL[job.status]}
                  </span>
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
          <span className="text-sm text-gray-600 dark:text-gray-400">
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
