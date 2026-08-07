'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { formatDateTime } from '@/lib/format';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

export function ValueCommentTab() {
  const [comments, setComments] = useState<Types.ValueComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Types.ValueComment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await API.ValueCommentAPI.list();
      setComments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được kho value comment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.ValueCommentAPI.delete(deleteTarget.id);
      setComments(comments.filter((c) => c.id !== deleteTarget.id));
      toast.success('Đã xoá comment');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xoá comment thất bại');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        AI tự động lưu bình luận đặc sắc từ video đã quét vào đây trong lúc phân tích (không cần duyệt) - dùng làm
        cảm hứng khi sinh kịch bản cho các sản phẩm khác sau này. Không có nút thêm tay - chỉ có thể xoá.
      </p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 w-full rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent>
            <ErrorState message={error} onRetry={load} />
          </CardContent>
        </Card>
      ) : comments.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Kho đang trống"
              description="Chạy nghiên cứu TikTok để AI tự phát hiện và lưu các bình luận đáng tái dùng."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {comments.map((comment) => (
            <Card key={comment.id}>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-foreground italic">&quot;{comment.text}&quot;</p>
                  <Button size="sm" variant="outline" onClick={() => setDeleteTarget(comment)}>
                    <Trash2 size={14} className="mr-1" /> Xoá
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Lý do: {comment.reason}</p>
                <p className="text-xs text-muted-foreground/80">
                  {comment.sourceAuthorHandle && `Từ @${comment.sourceAuthorHandle} · `}
                  {formatDateTime(comment.createdAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xoá value comment?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleDelete} isLoading={deleting}>
              Xoá
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Hành động này không thể hoàn tác.</p>
      </Modal>
    </div>
  );
}
