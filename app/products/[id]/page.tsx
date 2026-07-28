'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Sparkles, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/ErrorState';
import { ExpandableText } from '@/components/common/ExpandableText';
import { Skeleton } from '@/components/ui/skeleton';
import * as API from '@/lib/api';
import { ApiClientError } from '@/lib/api';
import type * as Types from '@/lib/types';

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <ExpandableText text={value} className="text-sm text-muted-foreground whitespace-pre-wrap mt-1" />
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Types.ProductBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingJob, setCreatingJob] = useState(false);
  const [showCreateJobConfirm, setShowCreateJobConfirm] = useState(false);
  const [ageGateMessage, setAgeGateMessage] = useState<string | null>(null);

  const loadProduct = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await API.ProductAPI.get(params.id);
      setProduct(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleCreateResearchJob = async () => {
    setShowCreateJobConfirm(false);
    setCreatingJob(true);
    try {
      const { jobId } = await API.ResearchJobAPI.create(params.id, false);
      toast.success('Đã tạo research job, đang chuyển trang...');
      router.push(`/research/${jobId}`);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'AGE_GATE_BLOCKED') {
        setAgeGateMessage(e.message);
      } else {
        toast.error(e instanceof Error ? e.message : 'Tạo research job thất bại');
      }
      setCreatingJob(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6">
        <Card>
          <CardContent>
            <ErrorState message={error || 'Không tìm thấy sản phẩm'} onRetry={loadProduct} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Danh sách sản phẩm
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-xl">{product.name}</CardTitle>
            <CardDescription>{product.category}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {product.ageCategory && <StatusBadge domain="productAge" value={product.ageCategory} />}
            <StatusBadge domain="product" value={product.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Điểm bán hàng độc nhất (USP)" value={product.usp} />
          <Field label="Nỗi đau khách hàng" value={product.painPoints} />
          <Field label="Câu hỏi thường gặp" value={product.faqContent} />
          <Field label="Bằng chứng xã hội" value={product.socialProof} />
          <Field label="So sánh với đối thủ" value={product.comparison} />
          <Field label="Gợi ý quay/chụp" value={product.shootingTips} />
          {product.keywords && product.keywords.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground">Từ khoá</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {product.keywords.map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {ageGateMessage && (
        <Card className="border-info bg-info-muted">
          <CardContent className="py-4 flex items-start gap-3">
            <Info size={18} className="text-info-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-info-muted-foreground">{ageGateMessage}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-medium text-foreground">Nghiên cứu xu hướng TikTok cho sản phẩm này</p>
            <p className="text-sm text-muted-foreground mt-1">
              AI sẽ gợi ý hashtag, cào video viral, phân tích và sinh 5 kịch bản dựa trên sản phẩm này.
            </p>
          </div>
          <Button onClick={() => setShowCreateJobConfirm(true)} isLoading={creatingJob}>
            <Sparkles size={16} className="mr-2" />
            Tạo kịch bản từ sản phẩm này
          </Button>
        </CardContent>
      </Card>

      <Modal
        isOpen={showCreateJobConfirm}
        onClose={() => setShowCreateJobConfirm(false)}
        title="Bắt đầu nghiên cứu TikTok?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateJobConfirm(false)}>
              Huỷ
            </Button>
            <Button onClick={handleCreateResearchJob} isLoading={creatingJob}>
              Bắt đầu
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Thao tác này sẽ gọi AI để gợi ý hashtag rồi cào/tải/phân tích video TikTok - tốn chi phí Apify và Gemini thật.
          Bạn có chắc muốn tạo job nghiên cứu cho sản phẩm &quot;{product.name}&quot;?
        </p>
      </Modal>
    </div>
  );
}
