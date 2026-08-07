'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit, Sparkles, Package } from 'lucide-react';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ProductBriefForm } from '@/components/modules/ideation/ProductBriefForm';
import { ExpandableText } from '@/components/common/ExpandableText';

export default function ProductsPage() {
  const [products, setProducts] = useState<Types.ProductBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Types.ProductBrief | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Types.ProductBrief | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, search]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await API.ProductAPI.list();
      setProducts(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveProduct = async (data: Omit<Types.ProductBrief, 'id'>) => {
    try {
      if (editingProduct) {
        const updated = await API.ProductAPI.update(editingProduct.id, data);
        setProducts(products.map(p => p.id === updated.id ? updated : p));
        setEditingProduct(undefined);
      } else {
        const created = await API.ProductAPI.create(data);
        setProducts([...products, created]);
      }
      setShowProductForm(false);
      toast.success(editingProduct ? 'Đã cập nhật sản phẩm' : 'Đã tạo sản phẩm');
    } catch (error) {
      toast.error('Lưu sản phẩm thất bại');
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.ProductAPI.delete(deleteTarget.id);
      setProducts(products.filter(p => p.id !== deleteTarget.id));
      toast.success('Đã xoá sản phẩm');
      setDeleteTarget(null);
    } catch (error) {
      toast.error('Xoá sản phẩm thất bại');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Sản phẩm"
        description="Quản lý sản phẩm và bắt đầu nghiên cứu xu hướng TikTok"
        icon={<Package size={28} />}
        actions={
          <Button onClick={() => { setEditingProduct(undefined); setShowProductForm(true); }}>
            <Plus size={18} className="mr-2" />
            Sản phẩm mới
          </Button>
        }
      />

      {!loading && !error && products.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc ngành hàng..."
          className="w-full max-w-sm px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 w-full rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent>
            <ErrorState message={error} onRetry={loadData} />
          </CardContent>
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Chưa có sản phẩm nào"
              description="Tạo sản phẩm đầu tiên để bắt đầu."
              action={
                <Button onClick={() => setShowProductForm(true)}>
                  <Plus size={18} className="mr-2" />
                  Sản phẩm mới
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title="Không tìm thấy sản phẩm nào khớp tìm kiếm" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProducts.map(product => (
            <Card key={product.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription>{product.category}</CardDescription>
                  </div>
                  <StatusBadge domain="product" value={product.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">USP</p>
                  <ExpandableText text={product.usp} className="text-sm text-muted-foreground" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingProduct(product); setShowProductForm(true); }}
                  >
                    <Edit size={16} className="mr-1" />
                    Sửa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(product)}
                  >
                    <Trash2 size={16} className="mr-1" />
                    Xoá
                  </Button>
                  <Link href={`/products/${product.id}`}>
                    <Button variant="outline" size="sm">
                      <Sparkles size={16} className="mr-1" />
                      Nghiên cứu TikTok
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProductBriefForm
        // key thay đổi theo sản phẩm đang sửa - buộc component remount để
        // useForm() bên trong nạp lại defaultValues MỚI. Không có key này,
        // ProductBriefForm không bao giờ unmount (Modal chỉ ẩn/hiện qua CSS),
        // nên defaultValues bị "đóng băng" ở lần mount đầu tiên - bấm "Sửa"
        // sản phẩm khác vẫn hiện data cũ/rỗng (bug thật đã gặp).
        key={editingProduct?.id ?? 'new'}
        isOpen={showProductForm}
        onClose={() => {
          setShowProductForm(false);
          setEditingProduct(undefined);
        }}
        onSave={handleSaveProduct}
        initialData={editingProduct}
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xoá sản phẩm?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct} isLoading={deleting}>
              Xoá
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Hành động này không thể hoàn tác. Sản phẩm &quot;{deleteTarget?.name}&quot; sẽ bị xoá vĩnh viễn.
        </p>
      </Modal>
    </div>
  );
}
