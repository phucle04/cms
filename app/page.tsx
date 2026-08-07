'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { StatsCard } from '@/components/common/StatsCard';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { formatRelativeTime, formatDateTime, productName } from '@/lib/format';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';
import { Package, Lightbulb, Search, FileText, ArrowRight, History } from 'lucide-react';

const STEPS = [
  { label: 'Sản phẩm', href: '/products', icon: Package, desc: 'Tạo hồ sơ sản phẩm' },
  { label: 'Nghiên cứu', href: '/research', icon: Search, desc: 'Cào & phân tích TikTok' },
  { label: 'Ý tưởng', href: '/ideation', icon: Lightbulb, desc: 'Duyệt ý tưởng nội dung' },
  { label: 'Kịch bản', href: '/scripts', icon: FileText, desc: 'Xem & dùng kịch bản' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState({ products: 0, ideas: 0, jobs: 0, scripts: 0 });
  const [recentJobs, setRecentJobs] = useState<Types.ResearchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [products, ideas, jobsResult, scripts] = await Promise.all([
        API.ProductAPI.list(),
        API.IdeaAPI.list(),
        API.ResearchJobAPI.list(1, 5),
        API.ResearchScriptAPI.list(),
      ]);
      setStats({
        products: products.length,
        ideas: ideas.length,
        jobs: jobsResult.pagination.total,
        scripts: scripts.length,
      });
      setRecentJobs(jobsResult.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu tổng quan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Tổng quan" description="Toàn cảnh hệ thống sản xuất nội dung" />

      {error && (
        <Card>
          <CardContent>
            <ErrorState message={error} onRetry={load} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Sản phẩm" value={loading ? '—' : stats.products} icon={<Package size={24} />} />
        <StatsCard title="Ý tưởng" value={loading ? '—' : stats.ideas} icon={<Lightbulb size={24} />} />
        <StatsCard title="Job nghiên cứu" value={loading ? '—' : stats.jobs} icon={<Search size={24} />} />
        <StatsCard title="Kịch bản" value={loading ? '—' : stats.scripts} icon={<FileText size={24} />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bắt đầu từ đâu?</CardTitle>
          <CardDescription>Quy trình 4 bước: Sản phẩm → Nghiên cứu → Ý tưởng → Kịch bản</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, i) => (
              <Link key={step.href} href={step.href} className="block">
                <div className="h-full p-4 rounded-lg border border-border hover:border-border-strong hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
                    <span>BƯỚC {i + 1}</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <step.icon size={18} />
                    {step.label}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{step.desc}</p>
                  <ArrowRight size={14} className="mt-2 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History size={18} />
              Job gần đây
            </CardTitle>
            <CardDescription>5 job nghiên cứu TikTok mới nhất</CardDescription>
          </div>
          <Link href="/research" className="text-sm text-link hover:underline">
            Xem tất cả
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 w-full rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <EmptyState
              title="Chưa có job nghiên cứu nào"
              description='Vào trang Sản phẩm và bấm "Nghiên cứu TikTok" để bắt đầu.'
              action={
                <Link href="/products">
                  <span className="text-sm text-link hover:underline">Đi tới trang Sản phẩm</span>
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <Link key={job.id} href={`/research/${job.id}`}>
                  <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors flex-wrap">
                    <div>
                      <p className="font-medium text-foreground">{productName(job.productId)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5" title={formatDateTime(job.createdAt)}>
                        {formatRelativeTime(job.createdAt)}
                      </p>
                    </div>
                    <StatusBadge domain="researchJob" value={job.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
