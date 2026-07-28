'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Copy, Send, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/ui/badge';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

function extractHook(content: string): string | null {
  const match = content.match(/^HOOK:\s*(.*)$/m);
  return match ? match[1].trim() : null;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Độ tin cậy cao',
  medium: 'Độ tin cậy trung bình',
  low: 'Độ tin cậy thấp',
};

interface ResearchScriptCardProps {
  script: Types.ResearchScript;
  index: number;
}

export function ResearchScriptCard({ script, index }: ResearchScriptCardProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(script.status);
  const hook = extractHook(script.content);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(script.content);
      toast.success('Đã copy toàn bộ kịch bản');
    } catch {
      toast.error('Không copy được - trình duyệt chặn quyền truy cập clipboard');
    }
  };

  const handleSaveToScripts = async () => {
    setSaving(true);
    try {
      const updated = await API.ResearchScriptAPI.update(script.id, { status: 'approved' });
      setStatus(updated.status);
      toast.success((t) => (
        <span className="flex items-center gap-3">
          Đã lưu vào Kịch bản
          <button
            onClick={() => {
              toast.dismiss(t.id);
              router.push(`/scripts/${script.id}`);
            }}
            className="underline font-medium whitespace-nowrap"
          >
            Xem ngay
          </button>
        </span>
      ));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lưu vào Kịch bản thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>
            Kịch bản {index + 1}: {script.title}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            {script.angle && <Badge variant="secondary">{script.angle}</Badge>}
            {script.confidence && <Badge variant="outline">{CONFIDENCE_LABEL[script.confidence] ?? script.confidence}</Badge>}
            {status === 'approved' && <Badge>Đã lưu vào Kịch bản</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {script.targetPainPoint && (
          <div>
            <p className="text-sm font-medium text-foreground">Đánh vào nỗi đau</p>
            <p className="text-sm text-muted-foreground">{script.targetPainPoint}</p>
          </div>
        )}

        {hook && (
          <div>
            <p className="text-sm font-medium text-foreground">Hook (câu mở đầu)</p>
            <p className="text-sm text-muted-foreground">{hook}</p>
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
                      <td className="py-2 pr-3 text-foreground">{seg.voiceover}</td>
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
          <p className="text-sm text-muted-foreground">{script.callToAction}</p>
        </div>

        {script.caption && (
          <div>
            <p className="text-sm font-medium text-foreground">Caption đăng bài</p>
            <p className="text-sm text-muted-foreground">{script.caption}</p>
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
          {status === 'approved' ? (
            <Link href={`/scripts/${script.id}`}>
              <Button variant="outline" size="sm">
                <ExternalLink size={14} className="mr-1.5" /> Xem trong Kịch bản
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" onClick={handleSaveToScripts} isLoading={saving}>
              <Send size={14} className="mr-1.5" /> Lưu vào Kịch bản
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
