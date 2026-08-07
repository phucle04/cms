'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/ErrorState';
import { ExpandableText } from '@/components/common/ExpandableText';
import { FormInput } from '@/components/common/FormInput';
import { FormSelect } from '@/components/common/FormSelect';
import { Skeleton } from '@/components/ui/skeleton';
import * as API from '@/lib/api';
import type * as Types from '@/lib/types';
import { formatCurrency } from '@/lib/format';

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <ExpandableText text={value} className="text-sm text-muted-foreground whitespace-pre-wrap mt-1" />
    </div>
  );
}

// Khớp mặc định/giới hạn ở server/config/env.ts - CHỈ dùng để gợi ý min/max
// cho input ở đây, server (zod createResearchJobSchema) vẫn là nơi chặn THẬT.
const DEFAULT_VIDEO_SCAN_COUNT = 5;
const MAX_VIDEO_SCAN_COUNT = 50;
const DEFAULT_SCRIPT_COUNT = 5;
const MAX_SCRIPT_COUNT = 50;

// "__no_limit__" đại diện cho "không giới hạn" (maxVideoAgeMonths=null gửi lên
// server) - KHÔNG dùng "" vì FormSelect tự chèn 1 option value="" placeholder
// ("Select an option...") ở đầu danh sách, trùng value sẽ tạo 2 option giống
// nhau (cùng pattern NONE_VALUE ở ComboSelectionPanel.tsx).
const NO_AGE_LIMIT = '__no_limit__';
const VIDEO_AGE_OPTIONS = [
  { value: NO_AGE_LIMIT, label: 'Không giới hạn' },
  { value: '6', label: '6 tháng gần đây' },
  { value: '12', label: '1 năm gần đây' },
  { value: '24', label: '2 năm gần đây' },
  { value: '36', label: '3 năm gần đây' },
];

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Types.ProductBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingJob, setCreatingJob] = useState(false);
  const [showCreateJobConfirm, setShowCreateJobConfirm] = useState(false);
  const [videoScanCount, setVideoScanCount] = useState(DEFAULT_VIDEO_SCAN_COUNT);
  const [scriptCount, setScriptCount] = useState(DEFAULT_SCRIPT_COUNT);
  const [maxVideoAgeMonths, setMaxVideoAgeMonths] = useState(NO_AGE_LIMIT);
  const [costEstimate, setCostEstimate] = useState<API.ResearchJobCostEstimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

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

  // Ước tính chi phí THÔ mỗi khi mở modal hoặc đổi số video/số kịch bản -
  // debounce nhẹ để không gọi API dồn dập lúc gõ số.
  useEffect(() => {
    if (!showCreateJobConfirm) return;
    setLoadingEstimate(true);
    const timeout = setTimeout(() => {
      API.ResearchJobAPI.estimateCost(videoScanCount, scriptCount)
        .then(setCostEstimate)
        .catch(() => setCostEstimate(null))
        .finally(() => setLoadingEstimate(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [showCreateJobConfirm, videoScanCount, scriptCount]);

  const handleCreateResearchJob = async () => {
    setShowCreateJobConfirm(false);
    setCreatingJob(true);
    try {
      const { jobId } = await API.ResearchJobAPI.create(
        params.id,
        false,
        videoScanCount,
        scriptCount,
        maxVideoAgeMonths === NO_AGE_LIMIT ? null : Number(maxVideoAgeMonths)
      );
      toast.success('Đã tạo research job, đang chuyển trang...');
      router.push(`/research/${jobId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Tạo research job thất bại');
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
          <Field label="Đối tượng phù hợp" value={product.targetAudience} />
          <Field label="Cách dùng & liều dùng" value={product.usageInstructions} />
          <Field label="Lưu ý an toàn / khi nào cần hỏi bác sĩ" value={product.safetyNotes} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Xuất xứ" value={product.originCountry} />
            <Field label="Chứng nhận / kiểm nghiệm" value={product.certifications} />
          </div>
          {(product.price || product.promoPrice || product.promotionOffer) && (
            <div>
              <p className="text-sm font-medium text-foreground">Giá & ưu đãi</p>
              <p className="text-sm text-muted-foreground mt-1">
                {product.price ? `Giá thường: ${product.price.toLocaleString('vi-VN')}đ` : ''}
                {product.promoPrice ? ` · Giá ưu đãi: ${product.promoPrice.toLocaleString('vi-VN')}đ` : ''}
                {product.promotionOffer ? ` · Quà tặng/ưu đãi: ${product.promotionOffer}` : ''}
              </p>
            </div>
          )}
          <Field label="Câu hỏi thường gặp" value={product.faqContent} />
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

      <Card>
        <CardContent className="py-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-medium text-foreground">Nghiên cứu xu hướng TikTok cho sản phẩm này</p>
            <p className="text-sm text-muted-foreground mt-1">
              AI sẽ gợi ý hashtag, cào video viral, phân tích và sinh kịch bản dựa trên sản phẩm này.
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
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Thao tác này sẽ gọi AI để gợi ý hashtag rồi cào/tải/phân tích video TikTok - tốn chi phí Apify và Gemini
            thật. Bạn có chắc muốn tạo job nghiên cứu cho sản phẩm &quot;{product.name}&quot;?
          </p>

          <div className="grid grid-cols-2 gap-3">
            <FormInput
              label="Số video sẽ quét"
              type="number"
              min={1}
              max={MAX_VIDEO_SCAN_COUNT}
              value={videoScanCount}
              onChange={(e) => setVideoScanCount(Math.min(MAX_VIDEO_SCAN_COUNT, Math.max(1, Number(e.target.value) || 1)))}
              helperText={`Tối đa ${MAX_VIDEO_SCAN_COUNT}`}
            />
            <FormInput
              label="Số kịch bản sẽ sinh"
              type="number"
              min={1}
              max={MAX_SCRIPT_COUNT}
              value={scriptCount}
              onChange={(e) => setScriptCount(Math.min(MAX_SCRIPT_COUNT, Math.max(1, Number(e.target.value) || 1)))}
              helperText={`Tối đa ${MAX_SCRIPT_COUNT}`}
            />
          </div>

          <FormSelect
            label="Chỉ lấy video đăng trong vòng"
            options={VIDEO_AGE_OPTIONS}
            value={maxVideoAgeMonths}
            onChange={(e) => setMaxVideoAgeMonths(e.target.value)}
            helperText="Video cũ hơn mốc này (hoặc không xác định được ngày đăng) sẽ bị loại ngay từ bước quét, không tính vào số video sẽ quét ở trên."
          />

          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            {loadingEstimate ? (
              <span className="text-muted-foreground">Đang ước tính chi phí...</span>
            ) : costEstimate ? (
              <>
                <span className="font-medium text-foreground">
                  Ước tính chi phí: {formatCurrency(costEstimate.totalEstimatedUsd)}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  (Apify ~{formatCurrency(costEstimate.apifyEstimatedUsd)}, Gemini ~
                  {formatCurrency(costEstimate.geminiEstimatedUsd)}) - số THÔ, chi phí thật có thể lệch.
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Không ước tính được chi phí.</span>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
