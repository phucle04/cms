'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { IdeaForm } from '@/components/modules/ideation/IdeaForm';
import { Plus, Trash2, Edit, Zap, Eye, Lightbulb } from 'lucide-react';

const PRIORITY_LABEL: Record<Types.Idea['priority'], string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
};

const STATUS_LABEL: Record<Types.Idea['status'], string> = {
  draft: 'Nháp (chờ duyệt)',
  new: 'Mới',
  'in progress': 'Đang làm',
  done: 'Hoàn thành',
  discarded: 'Đã huỷ',
};

function isFromPipeline(idea: Types.Idea): boolean {
  return idea.source === 'research-pipeline';
}

export default function IdeationPage() {
  const [products, setProducts] = useState<Types.ProductBrief[]>([]);
  const [ideas, setIdeas] = useState<Types.Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIdeaForm, setShowIdeaForm] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Types.Idea | undefined>();
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'pipeline'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<Types.Idea['status']>('new');
  const [applyingBulk, setApplyingBulk] = useState(false);

  const [viewingIdea, setViewingIdea] = useState<Types.Idea | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Types.Idea | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, i] = await Promise.all([
        API.ProductAPI.list(),
        API.IdeaAPI.list(),
      ]);
      setProducts(p);
      setIdeas(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      if (sourceFilter === 'manual') return !isFromPipeline(idea);
      if (sourceFilter === 'pipeline') return isFromPipeline(idea);
      return true;
    });
  }, [ideas, sourceFilter]);

  const handleSaveIdea = async (data: Omit<Types.Idea, 'id'>) => {
    try {
      if (editingIdea) {
        const updated = await API.IdeaAPI.update(editingIdea.id, data);
        setIdeas(ideas.map(i => i.id === updated.id ? updated : i));
        setEditingIdea(undefined);
      } else {
        const created = await API.IdeaAPI.create(data);
        setIdeas([...ideas, created]);
      }
      setShowIdeaForm(false);
      toast.success(editingIdea ? 'Đã cập nhật ý tưởng' : 'Đã tạo ý tưởng');
    } catch (error) {
      toast.error('Lưu ý tưởng thất bại');
    }
  };

  const handleDeleteIdea = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.IdeaAPI.delete(deleteTarget.id);
      setIdeas(ideas.filter(i => i.id !== deleteTarget.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      toast.success('Đã xoá ý tưởng');
      setDeleteTarget(null);
    } catch (error) {
      toast.error('Xoá ý tưởng thất bại');
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateIdeas = async () => {
    if (!selectedProduct) {
      toast.error('Vui lòng chọn một sản phẩm');
      return;
    }

    setGeneratingIdeas(true);
    try {
      const generatedIdeas = await API.IdeaAPI.generate(selectedProduct, 5);
      if (Array.isArray(generatedIdeas)) {
        setIdeas([...ideas, ...generatedIdeas]);
        toast.success(`Đã sinh ${generatedIdeas.length} ý tưởng bằng Gemini AI`);
      }
      setShowGenerateModal(false);
      setSelectedProduct('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi mạng';
      toast.error(`Sinh ý tưởng thất bại: ${errorMessage}`);
    } finally {
      setGeneratingIdeas(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplyBulkStatus = async () => {
    if (selectedIds.size === 0) return;
    setApplyingBulk(true);
    try {
      await API.IdeaAPI.bulkUpdate(Array.from(selectedIds), { status: bulkStatus });
      setIdeas(ideas.map((i) => (selectedIds.has(i.id) ? { ...i, status: bulkStatus } : i)));
      toast.success(`Đã đổi trạng thái ${selectedIds.size} ý tưởng`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Đổi trạng thái hàng loạt thất bại');
    } finally {
      setApplyingBulk(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const detail = await API.IdeaAPI.get(id);
      setViewingIdea(detail);
    } catch (error) {
      toast.error('Không tải được chi tiết ý tưởng');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Ý tưởng"
        description="Kho ý tưởng nội dung - tự tạo hoặc sinh ra từ nghiên cứu TikTok"
        icon={<Lightbulb size={28} />}
        actions={
          <>
            <Button onClick={() => { setEditingIdea(undefined); setShowIdeaForm(true); }}>
              <Plus size={18} className="mr-2" />
              Ý tưởng mới
            </Button>
            <Button variant="outline" onClick={() => setShowGenerateModal(true)}>
              <Zap size={18} className="mr-2" />
              Sinh ý tưởng bằng AI
            </Button>
          </>
        }
      />

      <div className="flex items-center justify-end flex-wrap gap-3">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
          className="px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Tất cả nguồn</option>
          <option value="manual">Tự tạo</option>
          <option value="pipeline">Từ nghiên cứu TikTok</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <Card>
          <CardContent className="py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-700 dark:text-gray-300">Đã chọn {selectedIds.size} ý tưởng</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as Types.Idea['status'])}
              className="px-3 py-1.5 border border-input rounded-lg bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {(Object.keys(STATUS_LABEL) as Types.Idea['status'][]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <Button size="sm" onClick={handleApplyBulkStatus} isLoading={applyingBulk}>
              Áp dụng
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Bỏ chọn
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 w-full rounded-lg bg-gray-100 dark:bg-gray-900 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent>
            <ErrorState message={error} onRetry={loadData} />
          </CardContent>
        </Card>
      ) : filteredIdeas.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title={ideas.length === 0 ? 'Chưa có ý tưởng nào' : 'Không có ý tưởng nào khớp bộ lọc'}
              description={ideas.length === 0 ? 'Tạo mới hoặc sinh ý tưởng từ sản phẩm.' : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredIdeas.map(idea => (
            <Card key={idea.id}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(idea.id)}
                    onChange={() => toggleSelected(idea.id)}
                    className="mt-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    aria-label={`Chọn ý tưởng ${idea.title}`}
                  />
                  <div className="flex-1 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-base">{idea.title}</CardTitle>
                      <CardDescription>{isFromPipeline(idea) ? 'Từ nghiên cứu TikTok' : 'Tự tạo'}</CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <StatusBadge domain="ideaPriority" value={idea.priority} />
                      <StatusBadge domain="ideaStatus" value={idea.status} />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">{idea.description}</p>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => handleViewDetail(idea.id)}>
                    <Eye size={16} className="mr-1" />
                    Xem chi tiết
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingIdea(idea); setShowIdeaForm(true); }}
                  >
                    <Edit size={16} className="mr-1" />
                    Sửa
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleteTarget(idea)}>
                    <Trash2 size={16} className="mr-1" />
                    Xoá
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <IdeaForm
        isOpen={showIdeaForm}
        onClose={() => {
          setShowIdeaForm(false);
          setEditingIdea(undefined);
        }}
        onSave={handleSaveIdea}
        initialData={editingIdea}
        products={products}
      />

      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Sinh ý tưởng từ sản phẩm"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
              Huỷ
            </Button>
            <Button
              onClick={handleGenerateIdeas}
              isLoading={generatingIdeas}
              disabled={generatingIdeas || !selectedProduct}
            >
              Sinh ý tưởng
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {generatingIdeas ? (
            <div className="text-center py-8">
              <Spinner size="lg" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">Đang sinh ý tưởng bằng AI...</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Chọn một sản phẩm để sinh 5 ý tưởng nội dung bằng AI
              </p>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Chọn sản phẩm...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!viewingIdea || loadingDetail}
        onClose={() => setViewingIdea(null)}
        title="Chi tiết ý tưởng"
        size="lg"
      >
        {loadingDetail && !viewingIdea ? (
          <div className="text-center py-8">
            <Spinner size="lg" />
          </div>
        ) : viewingIdea ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Tiêu đề</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{viewingIdea.title}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Mô tả</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{viewingIdea.description}</p>
            </div>
            <div className="flex gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nguồn</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{isFromPipeline(viewingIdea) ? 'Từ nghiên cứu TikTok' : 'Tự tạo'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Ưu tiên</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{PRIORITY_LABEL[viewingIdea.priority]}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Trạng thái</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{STATUS_LABEL[viewingIdea.status]}</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xoá ý tưởng?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleDeleteIdea} isLoading={deleting}>
              Xoá
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Hành động này không thể hoàn tác. Ý tưởng &quot;{deleteTarget?.title}&quot; sẽ bị xoá vĩnh viễn.
        </p>
      </Modal>
    </div>
  );
}
