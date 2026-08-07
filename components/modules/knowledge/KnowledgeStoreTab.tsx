'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Upload, Trash2, Check } from 'lucide-react';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { FormInput } from '@/components/common/FormInput';
import { FormTextarea } from '@/components/common/FormTextarea';
import { FormSelect } from '@/components/common/FormSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';

interface KnowledgeStoreTabProps {
  storeType: Types.KnowledgeStoreType;
}

// Khớp định dạng file server/services/knowledgeImportService.ts hỗ trợ.
const ACCEPTED_EXTENSIONS = '.docx,.pdf,.xlsx,.xls,.csv,.txt';

const DISC_OPTIONS = [
  { value: 'D', label: 'D - Dominance (quyết đoán)' },
  { value: 'I', label: 'I - Influence (cảm xúc/xã hội)' },
  { value: 'S', label: 'S - Steadiness (ổn định/an toàn)' },
  { value: 'C', label: 'C - Conscientiousness (phân tích/dữ liệu)' },
];

interface AddForm {
  name: string;
  description: string;
  example: string;
  discCode: Types.DiscCode;
}

const EMPTY_FORM: AddForm = { name: '', description: '', example: '', discCode: 'D' };

export function KnowledgeStoreTab({ storeType }: KnowledgeStoreTabProps) {
  const [entries, setEntries] = useState<Types.KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Types.KnowledgeEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await API.KnowledgeAPI.list(storeType);
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được kho kiến thức');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeType]);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      toast.error('Vui lòng nhập Tên và Mô tả/công thức');
      return;
    }
    setSaving(true);
    try {
      const created = await API.KnowledgeAPI.create({
        storeType,
        name: form.name.trim(),
        description: form.description.trim(),
        example: form.example.trim() || undefined,
        discCode: storeType === 'disc' ? form.discCode : undefined,
      });
      setEntries([created, ...entries]);
      toast.success('Đã thêm entry');
      setForm(EMPTY_FORM);
      setShowAddModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Thêm entry thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (entry: Types.KnowledgeEntry) => {
    try {
      const updated = await API.KnowledgeAPI.approve(entry.id);
      setEntries(entries.map((e) => (e.id === updated.id ? updated : e)));
      toast.success('Đã duyệt entry');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Duyệt entry thất bại');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.KnowledgeAPI.delete(deleteTarget.id);
      setEntries(entries.filter((e) => e.id !== deleteTarget.id));
      toast.success('Đã xoá entry');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xoá entry thất bại');
    } finally {
      setDeleting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại đúng file đó ở lần sau
    if (!file) return;

    setUploading(true);
    try {
      const created = await API.KnowledgeAPI.importFile(storeType, file);
      setEntries([...created, ...entries]);
      toast.success(`Đã thêm ${created.length} entry từ file`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import file thất bại');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} isLoading={uploading}>
          <Upload size={16} className="mr-2" />
          Nhập từ file (.docx/.pdf/.xlsx/.csv)
        </Button>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus size={16} className="mr-2" />
          Thêm entry
        </Button>
      </div>

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
      ) : entries.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title="Kho đang trống" description="Thêm entry thủ công hoặc nhập từ file để bắt đầu." />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  {entry.name}
                  {entry.discCode && (
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-link text-xs font-semibold">
                      {entry.discCode}
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Đã dùng {entry.usageCount} video
                  </span>
                  <StatusBadge domain="knowledgeStatus" value={entry.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.description}</p>
                {entry.example && (
                  <p className="text-sm text-muted-foreground/80 italic">Ví dụ: {entry.example}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {entry.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => handleApprove(entry)}>
                      <Check size={14} className="mr-1" />
                      Duyệt
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setDeleteTarget(entry)}>
                    <Trash2 size={14} className="mr-1" />
                    Xoá
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Thêm entry"
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
          <FormInput label="Tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <FormTextarea
            label="Mô tả / công thức"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <FormTextarea
            label="Ví dụ (tuỳ chọn)"
            value={form.example}
            onChange={(e) => setForm({ ...form, example: e.target.value })}
          />
          {storeType === 'disc' && (
            <FormSelect
              label="Mã DISC"
              options={DISC_OPTIONS}
              value={form.discCode}
              onChange={(e) => setForm({ ...form, discCode: e.target.value as Types.DiscCode })}
            />
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xoá entry?"
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
          Hành động này không thể hoàn tác. Entry &quot;{deleteTarget?.name}&quot; sẽ bị xoá vĩnh viễn.
        </p>
      </Modal>
    </div>
  );
}
