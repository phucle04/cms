'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { formatRelativeTime, formatDateTime } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

function ideaTitle(ideaId: Types.ResearchScript['ideaId']): string {
  if (typeof ideaId === 'string') return '—';
  return ideaId.title;
}

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Types.ResearchScript[]>([]);
  const [jobByScriptId, setJobByScriptId] = useState<Record<string, Types.ResearchJob>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Types.ResearchScript['status']>('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [scriptList, jobResult] = await Promise.all([
        API.ResearchScriptAPI.list(),
        API.ResearchJobAPI.list(1, 200),
      ]);
      setScripts(scriptList);

      const map: Record<string, Types.ResearchJob> = {};
      for (const job of jobResult.data) {
        for (const scriptId of job.resultScriptIds) {
          map[scriptId] = job;
        }
      }
      setJobByScriptId(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách kịch bản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return scripts
      .filter((s) => statusFilter === 'all' || s.status === statusFilter)
      .filter((s) => s.title.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [scripts, search, statusFilter]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Kịch bản"
        description="Danh sách kịch bản đã lưu từ các job nghiên cứu TikTok"
        icon={<FileText size={28} />}
      />

      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tiêu đề..."
          className="px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm min-w-[240px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="approved">Đã lưu</option>
          <option value="rejected">Đã từ chối</option>
        </select>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Card>
          <CardContent>
            <ErrorState message={error} onRetry={load} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              title={scripts.length === 0 ? 'Chưa có kịch bản nào được lưu' : 'Không tìm thấy kịch bản nào khớp bộ lọc'}
              description={scripts.length === 0 ? 'Vào một job nghiên cứu đã hoàn tất và bấm "Lưu vào Kịch bản".' : undefined}
              action={
                scripts.length === 0 ? (
                  <Link href="/research">
                    <Button variant="outline">Xem lịch sử nghiên cứu</Button>
                  </Link>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {!loading && !error && filtered.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border bg-muted/50 sticky top-0">
                  <th className="py-3 px-4 font-medium">Tiêu đề</th>
                  <th className="py-3 px-4 font-medium">Ý tưởng liên quan</th>
                  <th className="py-3 px-4 font-medium">Nguồn</th>
                  <th className="py-3 px-4 font-medium">Trạng thái</th>
                  <th className="py-3 px-4 font-medium whitespace-nowrap">Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((script) => {
                  const job = jobByScriptId[script.id];
                  return (
                    <tr
                      key={script.id}
                      className="border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link href={`/scripts/${script.id}`} className="font-medium text-foreground hover:underline">
                          {script.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{ideaTitle(script.ideaId)}</td>
                      <td className="py-3 px-4">
                        {job ? (
                          <Link href={`/research/${job.id}`} className="text-primary hover:underline">
                            Job nghiên cứu
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Không rõ</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge domain="script" value={script.status} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground" title={formatDateTime(script.createdAt)}>
                        {formatRelativeTime(script.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
