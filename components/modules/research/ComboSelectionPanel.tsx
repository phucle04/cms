'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { FormSelect } from '@/components/common/FormSelect';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

interface ComboSelectionPanelProps {
  trendStats?: Types.ResearchJobTrendStats;
  suggestedCombos: Types.ResearchJobCombo[];
  onSubmit: (combos: Types.ResearchJobCombo[]) => void;
  submitting: boolean;
}

const DISC_CODES: Types.DiscCode[] = ['D', 'I', 'S', 'C'];

// Giá trị đại diện cho "không chọn" trong <select> (HTML select không có
// khái niệm value=null) - convert qua lại với null khi đọc/ghi state.
const NONE_VALUE = '__none__';
const NONE_OPTION = { value: NONE_VALUE, label: '(Không chọn - để AI tự do)' };

export function ComboSelectionPanel({ trendStats, suggestedCombos, onSubmit, submitting }: ComboSelectionPanelProps) {
  const [hooks, setHooks] = useState<Types.KnowledgeEntry[]>([]);
  const [painPoints, setPainPoints] = useState<Types.KnowledgeEntry[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [combos, setCombos] = useState<Types.ResearchJobCombo[]>(suggestedCombos);

  useEffect(() => {
    let cancelled = false;
    setLoadingLibrary(true);
    Promise.all([API.KnowledgeAPI.list('hook', 'approved'), API.KnowledgeAPI.list('pain_point', 'approved')])
      .then(([hookEntries, painPointEntries]) => {
        if (cancelled) return;
        setHooks(hookEntries);
        setPainPoints(painPointEntries);
      })
      .finally(() => {
        if (!cancelled) setLoadingLibrary(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateCombo = (index: number, patch: Partial<Types.ResearchJobCombo>) => {
    setCombos((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const hookOptions = [NONE_OPTION, ...hooks.map((h) => ({ value: h.id, label: h.name }))];
  const painPointOptions = [NONE_OPTION, ...painPoints.map((p) => ({ value: p.id, label: p.name }))];
  const discOptions = [NONE_OPTION, ...DISC_CODES.map((code) => ({ value: code, label: Types.DISC_LABELS[code] }))];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Xu hướng phát hiện được từ video vừa phân tích</CardTitle>
          <CardDescription>
            {trendStats
              ? `Phân loại được ${trendStats.videosClassified} video theo kho hook/pain point/DISC hiện có.`
              : 'Không có dữ liệu xu hướng.'}
          </CardDescription>
        </CardHeader>
        {trendStats && (
          <CardContent className="space-y-5">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Hook đang gặp nhiều nhất</p>
              {trendStats.topHooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa phát hiện hook nào khớp kho (kho hook có thể đang trống - vào trang Kiến thức để upload).
                </p>
              ) : (
                <div className="space-y-1.5">
                  {trendStats.topHooks.map((h) => (
                    <div key={h.entryId} className="flex items-center justify-between text-sm gap-3">
                      <span className="text-foreground">{h.name}</span>
                      <span className="text-muted-foreground whitespace-nowrap">{h.count} video</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Pain point đang gặp nhiều nhất</p>
              {trendStats.topPainPoints.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa phát hiện pain point nào khớp kho (kho pain point có thể đang trống).
                </p>
              ) : (
                <div className="space-y-1.5">
                  {trendStats.topPainPoints.map((p) => (
                    <div key={p.entryId} className="flex items-center justify-between text-sm gap-3">
                      <span className="text-foreground">{p.name}</span>
                      <span className="text-muted-foreground whitespace-nowrap">{p.count} video</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Phân bố kiểu tính cách DISC</p>
              <div className="space-y-1.5">
                {DISC_CODES.map((code) => (
                  <div key={code} className="flex items-center gap-3">
                    <span className="text-xs font-semibold w-6 text-foreground">{code}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${trendStats.discDistribution[code]}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{trendStats.discDistribution[code]}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chọn combo cho {combos.length} kịch bản</CardTitle>
          <CardDescription>
            Đã gợi ý sẵn theo xu hướng phát hiện được - giữ nguyên hoặc tự chọn lại từng ô từ toàn bộ kho (không chỉ
            những gì đang trend).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {combos.map((combo, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg border border-border">
              <FormSelect
                label={`Kịch bản ${i + 1} - Hook`}
                options={hookOptions}
                value={combo.hookEntryId ?? NONE_VALUE}
                onChange={(e) => updateCombo(i, { hookEntryId: e.target.value === NONE_VALUE ? null : e.target.value })}
                disabled={loadingLibrary}
              />
              <FormSelect
                label="Pain point"
                options={painPointOptions}
                value={combo.painPointEntryId ?? NONE_VALUE}
                onChange={(e) => updateCombo(i, { painPointEntryId: e.target.value === NONE_VALUE ? null : e.target.value })}
                disabled={loadingLibrary}
              />
              <FormSelect
                label="DISC"
                options={discOptions}
                value={combo.discCode ?? NONE_VALUE}
                onChange={(e) =>
                  updateCombo(i, { discCode: e.target.value === NONE_VALUE ? null : (e.target.value as Types.DiscCode) })
                }
              />
            </div>
          ))}

          <Button onClick={() => onSubmit(combos)} isLoading={submitting}>
            Bắt đầu sinh {combos.length} kịch bản
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
