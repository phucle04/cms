'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, Trash2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/ErrorState';
import { ComplianceHighlight } from '@/components/common/ComplianceHighlight';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Độ tin cậy cao',
  medium: 'Độ tin cậy trung bình',
  low: 'Độ tin cậy thấp',
};

function extractHook(content: string): string | null {
  const match = content.match(/^HOOK:\s*(.*)$/m);
  return match ? match[1].trim() : null;
}

function ideaTitle(ideaId: Types.ResearchScript['ideaId']): string | null {
  if (typeof ideaId === 'string') return null;
  return ideaId.title;
}

export default function ScriptDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [script, setScript] = useState<Types.ResearchScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await API.ResearchScriptAPI.get(params.id);
      setScript(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được kịch bản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleCopyAll = async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script.content);
      toast.success('Đã copy toàn bộ kịch bản');
    } catch {
      toast.error('Không copy được - trình duyệt chặn quyền truy cập clipboard');
    }
  };

  const handleDelete = async () => {
    if (!script) return;
    setDeleting(true);
    try {
      await API.ResearchScriptAPI.delete(script.id);
      toast.success('Đã xoá kịch bản');
      router.push('/scripts');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xoá kịch bản thất bại');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !script) {
    return (
      <div className="p-6">
        <Card>
          <CardContent>
            <ErrorState message={error || 'Không tìm thấy kịch bản'} onRetry={load} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hook = extractHook(script.content);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link
        href="/scripts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Danh sách kịch bản
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-xl">{script.title}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {script.hookName && <Badge variant="secondary">Hook: {script.hookName}</Badge>}
              {script.discCode && <Badge variant="secondary">{Types.DISC_LABELS[script.discCode]}</Badge>}
              {script.confidence && <Badge variant="outline">{CONFIDENCE_LABEL[script.confidence] ?? script.confidence}</Badge>}
              <StatusBadge domain="script" value={script.status} />
              {ideaTitle(script.ideaId) && <Badge variant="outline">Ý tưởng: {ideaTitle(script.ideaId)}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {script.complianceFlags && script.complianceFlags.length > 0 && (
            <div className="rounded-md border border-destructive bg-destructive-muted p-3 flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-destructive-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-destructive-muted-foreground">
                <p className="font-medium">
                  Bộ quét tuân thủ phát hiện {script.complianceFlags.length} cụm từ cần xem lại
                </p>
                <p className="mt-0.5">
                  Đây là lớp lọc sơ bộ theo từ khoá, không thay thế việc đọc lại toàn bộ kịch bản trước khi đăng.
                  Các cụm bị bôi đỏ bên dưới: {[...new Set(script.complianceFlags.map((f) => f.phrase))].join(', ')}
                </p>
              </div>
            </div>
          )}

          {script.targetPainPoint && (
            <div>
              <p className="text-sm font-medium text-foreground">Đánh vào nỗi đau</p>
              <ComplianceHighlight
                text={script.targetPainPoint}
                flags={script.complianceFlags}
                className="text-sm text-muted-foreground"
              />
            </div>
          )}

          {hook && (
            <div>
              <p className="text-sm font-medium text-foreground">Hook (câu mở đầu)</p>
              <ComplianceHighlight text={hook} flags={script.complianceFlags} className="text-sm text-muted-foreground" />
            </div>
          )}

          {script.body && script.body.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Diễn biến theo thời gian</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Thời gian</th>
                      <th className="py-1.5 pr-3 font-medium">Lời thoại</th>
                      <th className="py-1.5 pr-3 font-medium">Hình ảnh</th>
                      <th className="py-1.5 font-medium">Chữ trên màn hình</th>
                    </tr>
                  </thead>
                  <tbody>
                    {script.body.map((seg, i) => (
                      <tr key={i} className="border-b border-border/60 align-top">
                        <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {seg.tStart}s-{seg.tEnd}s
                        </td>
                        <td className="py-2 pr-3 text-foreground">
                          <ComplianceHighlight text={seg.voiceover} flags={script.complianceFlags} />
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{seg.visual}</td>
                        <td className="py-2 text-muted-foreground">{seg.textOnScreen || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-foreground">CTA</p>
            <ComplianceHighlight
              text={script.callToAction}
              flags={script.complianceFlags}
              className="text-sm text-muted-foreground"
            />
          </div>

          {script.caption && (
            <div>
              <p className="text-sm font-medium text-foreground">Caption đăng bài</p>
              <ComplianceHighlight
                text={script.caption}
                flags={script.complianceFlags}
                className="text-sm text-muted-foreground"
              />
              {script.hashtags && script.hashtags.length > 0 && (
                <p className="text-sm text-link mt-1">{script.hashtags.join(' ')}</p>
              )}
            </div>
          )}

          {script.shotList && script.shotList.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground">Danh sách cảnh quay</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {script.shotList.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {script.learnedFrom && script.learnedFrom.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Học pattern từ: {script.learnedFrom.map((c) => (c.startsWith('@') ? c : `@${c}`)).join(', ')}
            </p>
          )}

          <div className="flex gap-2 flex-wrap pt-2">
            <Button variant="outline" size="sm" onClick={handleCopyAll}>
              <Copy size={14} className="mr-1.5" /> Copy toàn bộ
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} className="mr-1.5" /> Xoá kịch bản
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Xoá kịch bản?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleDelete} isLoading={deleting}>
              Xoá
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Hành động này không thể hoàn tác. Kịch bản &quot;{script.title}&quot; sẽ bị xoá vĩnh viễn.
        </p>
      </Modal>
    </div>
  );
}
