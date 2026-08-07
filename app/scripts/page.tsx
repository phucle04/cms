'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
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

const PAGE_SIZE = 20;

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Types.ResearchScript[]>([]);
  const [jobByScriptId, setJobByScriptId] = useState<Record<string, Types.ResearchJob>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Types.ResearchScript['status']>('all');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applyingBulk, setApplyingBulk] = useState(false);

  // Debounce ô tìm kiếm 300ms trước khi gọi API - tránh gọi dồn dập lúc gõ,
  // cùng pattern debounce ước tính chi phí ở app/products/[id]/page.tsx.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Đổi bộ lọc/tìm kiếm -> luôn quay về trang 1, tránh kẹt ở trang rỗng.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [scriptResult, jobResult] = await Promise.all([
        API.ResearchScriptAPI.listPaginated({
          page,
          limit: PAGE_SIZE,
          status: statusFilter === 'all' ? undefined : statusFilter,
          q: search || undefined,
        }),
        API.ResearchJobAPI.list(1, 200),
      ]);
      setScripts(scriptResult.data);
      setTotalPages(scriptResult.pagination.totalPages);
      setTotal(scriptResult.pagination.total);

      const map: Record<string, Types.ResearchJob> = {};
      for (const job of jobResult.data) {
        for (const scriptId of job.resultScriptIds) {
          map[scriptId] = job;
        }
      }
      setJobByScriptId(map);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách kịch bản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === scripts.length ? new Set() : new Set(scripts.map((s) => s.id))));
  };

  const handleBulkStatus = async (status: Types.ResearchScript['status']) => {
    if (selectedIds.size === 0) return;
    setApplyingBulk(true);
    try {
      await API.ResearchScriptAPI.bulkUpdateStatus(Array.from(selectedIds), status);
      toast.success(`Đã cập nhật ${selectedIds.size} kịch bản`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cập nhật hàng loạt thất bại');
    } finally {
      setApplyingBulk(false);
    }
  };

  const allSelected = scripts.length > 0 && selectedIds.size === scripts.length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Kịch bản"
        description="Danh sách kịch bản đã lưu từ các job nghiên cứu TikTok"
        icon={<FileText size={28} />}
      />

      <div className="flex gap-3 flex-wrap items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">Đã chọn {selectedIds.size}</span>
            <Button size="sm" variant="outline" onClick={() => handleBulkStatus('approved')} isLoading={applyingBulk}>
              Duyệt
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkStatus('rejected')} isLoading={applyingBulk}>
              Từ chối
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Bỏ chọn
            </Button>
          </div>
        )}
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

      {!loading && !error && scripts.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              title={total === 0 && !search && statusFilter === 'all' ? 'Chưa có kịch bản nào được lưu' : 'Không tìm thấy kịch bản nào khớp bộ lọc'}
              description={
                total === 0 && !search && statusFilter === 'all'
                  ? 'Vào một job nghiên cứu đã hoàn tất và bấm "Lưu vào Kịch bản".'
                  : undefined
              }
              action={
                total === 0 && !search && statusFilter === 'all' ? (
                  <Link href="/research">
                    <Button variant="outline">Xem lịch sử nghiên cứu</Button>
                  </Link>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {!loading && !error && scripts.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border bg-muted/50 sticky top-0">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Chọn tất cả"
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    />
                  </th>
                  <th className="py-3 px-4 font-medium">Tiêu đề</th>
                  <th className="py-3 px-4 font-medium">Nguồn</th>
                  <th className="py-3 px-4 font-medium">Trạng thái</th>
                  <th className="py-3 px-4 font-medium whitespace-nowrap">Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {scripts.map((script) => {
                  const job = jobByScriptId[script.id];
                  return (
                    <tr
                      key={script.id}
                      className="border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(script.id)}
                          onChange={() => toggleSelected(script.id)}
                          aria-label={`Chọn kịch bản ${script.title}`}
                          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        />
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <Link
                          href={`/scripts/${script.id}`}
                          title={script.title}
                          className="font-medium text-foreground hover:underline block truncate"
                        >
                          {script.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        {job ? (
                          <Link href={`/research/${job.id}`} className="text-link hover:underline">
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

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={16} className="mr-1" /> Trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {page} / {totalPages} ({total} kịch bản)
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Sau <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
