'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Sparkles, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Skeleton } from '@/components/ui/skeleton';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap mt-1">{value}</p>
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
    setCreatingJob(true);
    try {
      const { jobId } = await API.ResearchJobAPI.create(params.id, false);
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
          <CardContent className="py-12 text-center space-y-4">
            <AlertTriangle className="mx-auto text-red-500" size={32} />
            <p className="text-gray-600 dark:text-gray-400">{error || 'Không tìm thấy sản phẩm'}</p>
            <Button onClick={loadProduct}>Thử lại</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link
        href="/ideation"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <ArrowLeft size={14} /> Danh sách sản phẩm
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-xl">{product.name}</CardTitle>
            <CardDescription>{product.category}</CardDescription>
          </div>
          <span
            className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
              product.status === 'active'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
            }`}
          >
            {product.status === 'active' ? 'Đang hoạt động' : 'Đã lưu trữ'}
          </span>
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
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Từ khoá</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {product.keywords.map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300">
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
            <p className="font-medium text-gray-900 dark:text-white">Nghiên cứu xu hướng TikTok cho sản phẩm này</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              AI sẽ gợi ý hashtag, cào video viral, phân tích và sinh 5 kịch bản dựa trên sản phẩm này.
            </p>
          </div>
          <Button onClick={handleCreateResearchJob} isLoading={creatingJob}>
            <Sparkles size={16} className="mr-2" />
            Tạo kịch bản từ sản phẩm này
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
