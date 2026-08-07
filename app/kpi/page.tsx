'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BarChart3, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { FormInput } from '@/components/common/FormInput';
import { FormSelect } from '@/components/common/FormSelect';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { formatDateTime } from '@/lib/format';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

const NONE_VALUE = '__none__';
const DISC_CODES: Types.DiscCode[] = ['D', 'I', 'S', 'C'];

interface KpiForm {
  videoUrl: string;
  scriptId: string;
  hookEntryId: string;
  painPointEntryId: string;
  discCode: string;
  views: string;
  likes: string;
  comments: string;
  retentionRate: string;
  completionRate: string;
  postedAt: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: KpiForm = {
  videoUrl: '',
  scriptId: NONE_VALUE,
  hookEntryId: NONE_VALUE,
  painPointEntryId: NONE_VALUE,
  discCode: NONE_VALUE,
  views: '',
  likes: '',
  comments: '',
  retentionRate: '',
  completionRate: '',
  postedAt: todayISO(),
};

export default function VideoKpiPage() {
  const [kpis, setKpis] = useState<Types.VideoKPI[]>([]);
  const [scripts, setScripts] = useState<Types.ResearchScript[]>([]);
  const [hooks, setHooks] = useState<Types.KnowledgeEntry[]>([]);
  const [painPoints, setPainPoints] = useState<Types.KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<KpiForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Types.VideoKPI | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpiData, scriptData, hookData, painPointData] = await Promise.all([
        API.VideoKpiAPI.list(),
        API.ResearchScriptAPI.list(),
        API.KnowledgeAPI.list('hook', 'approved'),
        API.KnowledgeAPI.list('pain_point', 'approved'),
      ]);
      setKpis(kpiData);
      setScripts(scriptData);
      setHooks(hookData);
      setPainPoints(painPointData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu KPI video');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Kịch bản gốc do pipeline Phase 4 sinh ra có sẵn combo (hookName/discCode)
  // -> tự động gắn tag, KHÔNG cho chọn thủ công nữa. Kịch bản tạo tay
  // (/ideation) không có combo -> vẫn phải chọn thủ công dù đã gắn scriptId.
  const selectedScript = useMemo(() => scripts.find((s) => s.id === form.scriptId) ?? null, [scripts, form.scriptId]);
  const autoTag = !!selectedScript && !!(selectedScript.hookName || selectedScript.painPointEntryId || selectedScript.discCode);

  const scriptOptions = [
    { value: NONE_VALUE, label: '(Không có kịch bản gốc - tự chọn tag)' },
    ...scripts.map((s) => ({ value: s.id, label: s.title })),
  ];
  const hookOptions = [{ value: NONE_VALUE, label: '(Không chọn)' }, ...hooks.map((h) => ({ value: h.id, label: h.name }))];
  const painPointOptions = [
    { value: NONE_VALUE, label: '(Không chọn)' },
    ...painPoints.map((p) => ({ value: p.id, label: p.name })),
  ];
  const discOptions = [
    { value: NONE_VALUE, label: '(Không chọn)' },
    ...DISC_CODES.map((code) => ({ value: code, label: Types.DISC_LABELS[code] })),
  ];

  const handleAdd = async () => {
    if (!form.videoUrl.trim()) {
      toast.error('Vui lòng nhập link video');
      return;
    }
    setSaving(true);
    try {
      const created = await API.VideoKpiAPI.create({
        videoUrl: form.videoUrl.trim(),
        scriptId: form.scriptId !== NONE_VALUE ? form.scriptId : undefined,
        hookEntryId: !autoTag && form.hookEntryId !== NONE_VALUE ? form.hookEntryId : undefined,
        painPointEntryId: !autoTag && form.painPointEntryId !== NONE_VALUE ? form.painPointEntryId : undefined,
        discCode: !autoTag && form.discCode !== NONE_VALUE ? (form.discCode as Types.DiscCode) : undefined,
        views: form.views ? Number(form.views) : undefined,
        likes: form.likes ? Number(form.likes) : undefined,
        comments: form.comments ? Number(form.comments) : undefined,
        retentionRate: form.retentionRate ? Number(form.retentionRate) : undefined,
        completionRate: form.completionRate ? Number(form.completionRate) : undefined,
        postedAt: form.postedAt ? new Date(form.postedAt).toISOString() : undefined,
      });
      setKpis([created, ...kpis]);
      toast.success('Đã ghi nhận video - kho kiến thức đã được cập nhật');
      setForm(EMPTY_FORM);
      setShowAddModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ghi nhận video thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.VideoKpiAPI.delete(deleteTarget.id);
      setKpis(kpis.filter((k) => k.id !== deleteTarget.id));
      toast.success('Đã xoá bản ghi');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xoá bản ghi thất bại');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="KPI Video"
        description="Ghi nhận số liệu video đã đăng lên TikTok (view, tim, comment, chỉ số giữ chân, tỉ lệ xem hết) - tự động gắn tag hook/pain point/DISC nếu video sinh ra từ 1 kịch bản của hệ thống, giúp kho kiến thức tự xếp hạng theo hiệu quả THẬT."
        icon={<BarChart3 size={28} />}
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowAddModal(true);
            }}
          >
            <Plus size={16} className="mr-2" />
            Ghi nhận video
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 w-full rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent>
            <ErrorState message={error} onRetry={load} />
          </CardContent>
        </Card>
      ) : kpis.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Chưa có video nào được ghi nhận"
              description="Ghi nhận video đầu tiên đã đăng lên TikTok để bắt đầu theo dõi hiệu quả và xếp hạng kho kiến thức."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
                <div>
                  <a
                    href={kpi.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-link inline-flex items-center gap-1"
                  >
                    Xem video <ExternalLink size={12} />
                  </a>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(kpi.postedAt)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setDeleteTarget(kpi)}>
                  <Trash2 size={14} className="mr-1" /> Xoá
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Lượt xem</p>
                    <p className="font-medium text-foreground">{kpi.views.toLocaleString('vi-VN')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Lượt tim</p>
                    <p className="font-medium text-foreground">{kpi.likes.toLocaleString('vi-VN')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Comment</p>
                    <p className="font-medium text-foreground">{kpi.comments.toLocaleString('vi-VN')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Chỉ số giữ chân</p>
                    <p className="font-medium text-foreground">{kpi.retentionRate}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Tỉ lệ xem hết</p>
                    <p className="font-medium text-foreground">{kpi.completionRate}%</p>
                  </div>
                </div>
                {(kpi.hookName || kpi.painPointName || kpi.discCode) && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {kpi.hookName && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">Hook: {kpi.hookName}</span>
                    )}
                    {kpi.painPointName && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">
                        Pain point: {kpi.painPointName}
                      </span>
                    )}
                    {kpi.discCode && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">
                        {Types.DISC_LABELS[kpi.discCode]}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Ghi nhận video đã đăng"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Huỷ
            </Button>
            <Button onClick={handleAdd} isLoading={saving}>
              Lưu
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Link video TikTok"
            value={form.videoUrl}
            onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            placeholder="https://www.tiktok.com/@..."
          />
          <FormSelect
            label="Kịch bản gốc (nếu có)"
            options={scriptOptions}
            value={form.scriptId}
            onChange={(e) => setForm({ ...form, scriptId: e.target.value })}
          />

          {form.scriptId !== NONE_VALUE &&
            (autoTag ? (
              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                Tự động gắn tag từ kịch bản gốc:{' '}
                {[
                  selectedScript?.hookName ? `Hook: ${selectedScript.hookName}` : null,
                  selectedScript?.painPointEntryId ? 'Có pain point' : null,
                  selectedScript?.discCode ? Types.DISC_LABELS[selectedScript.discCode] : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Kịch bản này không có tag combo sẵn (kịch bản tạo tay) - vui lòng chọn thủ công bên dưới.
              </p>
            ))}

          {!autoTag && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormSelect
                label="Hook"
                options={hookOptions}
                value={form.hookEntryId}
                onChange={(e) => setForm({ ...form, hookEntryId: e.target.value })}
              />
              <FormSelect
                label="Pain point"
                options={painPointOptions}
                value={form.painPointEntryId}
                onChange={(e) => setForm({ ...form, painPointEntryId: e.target.value })}
              />
              <FormSelect
                label="DISC"
                options={discOptions}
                value={form.discCode}
                onChange={(e) => setForm({ ...form, discCode: e.target.value })}
              />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <FormInput
              label="Lượt xem"
              type="number"
              min={0}
              value={form.views}
              onChange={(e) => setForm({ ...form, views: e.target.value })}
            />
            <FormInput
              label="Lượt tim"
              type="number"
              min={0}
              value={form.likes}
              onChange={(e) => setForm({ ...form, likes: e.target.value })}
            />
            <FormInput
              label="Lượt comment"
              type="number"
              min={0}
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
            />
            <FormInput
              label="Chỉ số giữ chân (%)"
              type="number"
              min={0}
              max={100}
              value={form.retentionRate}
              onChange={(e) => setForm({ ...form, retentionRate: e.target.value })}
            />
            <FormInput
              label="Tỉ lệ xem hết (%)"
              type="number"
              min={0}
              max={100}
              value={form.completionRate}
              onChange={(e) => setForm({ ...form, completionRate: e.target.value })}
            />
            <FormInput
              label="Ngày đăng"
              type="date"
              value={form.postedAt}
              onChange={(e) => setForm({ ...form, postedAt: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xoá bản ghi video?"
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
        <p className="text-sm text-muted-foreground">
          Hành động này không thể hoàn tác. usageCount đã cộng cho kho kiến thức từ bản ghi này cũng sẽ được hoàn lại.
        </p>
      </Modal>
    </div>
  );
}
