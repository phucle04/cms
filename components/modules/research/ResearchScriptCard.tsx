'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Send, RefreshCw } from 'lucide-react';
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
  const [pushing, setPushing] = useState(false);
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

  const handlePushToScripting = async () => {
    setPushing(true);
    try {
      const updated = await API.ResearchScriptAPI.update(script.id, { status: 'approved' });
      setStatus(updated.status);
      toast.success('Đã đẩy sang Scripting');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Đẩy sang Scripting thất bại');
    } finally {
      setPushing(false);
    }
  };

  const handleRegenerate = () => {
    toast.error('Tính năng "Tạo lại kịch bản này" cần bổ sung 1 API backend riêng (sinh lại đúng 1 kịch bản) - chưa có ở giai đoạn này.');
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
            {status === 'approved' && <Badge>Đã đẩy sang Scripting</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {script.targetPainPoint && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Đánh vào nỗi đau</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{script.targetPainPoint}</p>
          </div>
        )}

        {hook && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Hook</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{hook}</p>
          </div>
        )}

        {script.body && script.body.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timeline</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Thời gian</th>
                    <th className="py-1.5 pr-3 font-medium">Lời thoại</th>
                    <th className="py-1.5 pr-3 font-medium">Hình ảnh</th>
                    <th className="py-1.5 font-medium">Chữ trên màn hình</th>
                  </tr>
                </thead>
                <tbody>
                  {script.body.map((seg, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-900 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs text-gray-500 dark:text-gray-500">
                        {seg.tStart}s-{seg.tEnd}s
                      </td>
                      <td className="py-2 pr-3 text-gray-800 dark:text-gray-200">{seg.voiceover}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{seg.visual}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">{seg.textOnScreen || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">CTA</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{script.callToAction}</p>
        </div>

        {script.caption && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Caption đăng bài</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{script.caption}</p>
            {script.hashtags && script.hashtags.length > 0 && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{script.hashtags.join(' ')}</p>
            )}
          </div>
        )}

        {script.shotList && script.shotList.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Danh sách cảnh quay</p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
              {script.shotList.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {script.learnedFrom && script.learnedFrom.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Học pattern từ: {script.learnedFrom.map((c) => (c.startsWith('@') ? c : `@${c}`)).join(', ')}
          </p>
        )}

        <div className="flex gap-2 flex-wrap pt-2">
          <Button variant="outline" size="sm" onClick={handleCopyAll}>
            <Copy size={14} className="mr-1.5" /> Copy toàn bộ
          </Button>
          <Button variant="outline" size="sm" onClick={handlePushToScripting} isLoading={pushing} disabled={status === 'approved'}>
            <Send size={14} className="mr-1.5" /> {status === 'approved' ? 'Đã đẩy sang Scripting' : 'Đẩy sang Scripting'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRegenerate}>
            <RefreshCw size={14} className="mr-1.5" /> Tạo lại kịch bản này
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
