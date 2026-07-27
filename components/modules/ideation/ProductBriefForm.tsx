'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import * as Types from '@/lib/types';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { FormInput } from '@/components/common/FormInput';
import { FormTextarea } from '@/components/common/FormTextarea';
import { FormSelect } from '@/components/common/FormSelect';
import { Plus, X } from 'lucide-react';

const productBriefSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên sản phẩm'),
  category: z.string().min(1, 'Vui lòng nhập ngành hàng'),
  usp: z.string().min(1, 'Vui lòng nhập USP'),
  painPoints: z.string().min(1, 'Vui lòng nhập nỗi đau khách hàng'),
  faqContent: z.string().optional(),
  socialProof: z.string().optional(),
  comparison: z.string().optional(),
  shootingTips: z.string().optional(),
  mediaUrl: z.string().optional(),
  status: z.enum(['active', 'archived']),
});

type ProductBriefFormData = z.infer<typeof productBriefSchema>;

interface ProductBriefFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Types.ProductBrief, 'id'>) => void;
  initialData?: Types.ProductBrief;
}

export function ProductBriefForm({
  isOpen,
  onClose,
  onSave,
  initialData,
}: ProductBriefFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductBriefFormData>({
    resolver: zodResolver(productBriefSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      category: initialData.category,
      usp: initialData.usp,
      painPoints: initialData.painPoints,
      faqContent: initialData.faqContent,
      socialProof: initialData.socialProof,
      comparison: initialData.comparison,
      shootingTips: initialData.shootingTips,
      mediaUrl: initialData.mediaUrl,
      status: initialData.status,
    } : {
      status: 'active',
    },
  });

  const onSubmit = async (data: ProductBriefFormData) => {
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      onSave({
        ...data,
        keywords: data.usp.split(',').map(k => k.trim()),
        createdAt: initialData?.createdAt || new Date(),
        updatedAt: new Date(),
      });
      
      toast.success(initialData ? 'Đã cập nhật sản phẩm' : 'Đã tạo sản phẩm');
      reset();
      onClose();
    } catch (error) {
      toast.error('Lưu sản phẩm thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Sửa sản phẩm' : 'Tạo sản phẩm'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
          >
            {initialData ? 'Cập nhật' : 'Tạo'} sản phẩm
          </Button>
        </>
      }
    >
      <form className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Tên sản phẩm"
            placeholder="VD: Máy ảnh Ultra Pro"
            {...register('name')}
            error={errors.name}
          />
          <FormInput
            label="Ngành hàng"
            placeholder="VD: Thiết bị nhiếp ảnh"
            {...register('category')}
            error={errors.category}
          />
        </div>

        <FormTextarea
          label="Điểm bán hàng độc nhất (USP)"
          placeholder="Điều gì làm sản phẩm này khác biệt?"
          {...register('usp')}
          error={errors.usp}
          helperText="Từ khoá cách nhau bởi dấu phẩy sẽ được tự sinh"
        />

        <FormTextarea
          label="Nỗi đau khách hàng"
          placeholder="Sản phẩm giải quyết vấn đề gì cho khách hàng?"
          {...register('painPoints')}
          error={errors.painPoints}
        />

        <FormTextarea
          label="Câu hỏi thường gặp"
          placeholder="Các câu hỏi và câu trả lời thường gặp..."
          {...register('faqContent')}
        />

        <FormTextarea
          label="Bằng chứng xã hội"
          placeholder="Đánh giá, phản hồi, số liệu thành công..."
          {...register('socialProof')}
        />

        <FormTextarea
          label="So sánh với đối thủ"
          placeholder="So sánh với sản phẩm đối thủ..."
          {...register('comparison')}
        />

        <FormTextarea
          label="Gợi ý quay/chụp"
          placeholder="Cách quay/chụp nội dung tốt nhất cho sản phẩm này..."
          {...register('shootingTips')}
        />

        <FormInput
          label="URL hình ảnh"
          type="url"
          placeholder="https://example.com/product-image.jpg"
          {...register('mediaUrl')}
        />

        <FormSelect
          label="Trạng thái"
          options={[
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'archived', label: 'Đã lưu trữ' },
          ]}
          {...register('status')}
          error={errors.status}
        />
      </form>
    </Modal>
  );
}
