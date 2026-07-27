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

const ideaSchema = z.object({
  title: z.string().min(1, 'Vui lòng nhập tiêu đề'),
  description: z.string().min(1, 'Vui lòng nhập mô tả'),
  source: z.string().min(1, 'Vui lòng nhập nguồn'),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['draft', 'new', 'in progress', 'done', 'discarded']),
  productId: z.string().optional(),
});

type IdeaFormData = z.infer<typeof ideaSchema>;

interface IdeaFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Types.Idea, 'id'>) => void;
  initialData?: Types.Idea;
  products: Types.ProductBrief[];
}

export function IdeaForm({
  isOpen,
  onClose,
  onSave,
  initialData,
  products,
}: IdeaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IdeaFormData>({
    resolver: zodResolver(ideaSchema),
    defaultValues: initialData ? {
      title: initialData.title,
      description: initialData.description,
      source: initialData.source,
      priority: initialData.priority,
      status: initialData.status,
      productId: initialData.productId,
    } : {
      priority: 'medium',
      status: 'new',
    },
  });

  const onSubmit = async (data: IdeaFormData) => {
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      onSave(data);
      toast.success(initialData ? 'Đã cập nhật ý tưởng' : 'Đã tạo ý tưởng');
      reset();
      onClose();
    } catch (error) {
      toast.error('Lưu ý tưởng thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Sửa ý tưởng' : 'Tạo ý tưởng'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
          >
            {initialData ? 'Cập nhật' : 'Tạo'} ý tưởng
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <FormInput
          label="Tiêu đề"
          placeholder="Tiêu đề ý tưởng nội dung..."
          {...register('title')}
          error={errors.title}
        />

        <FormTextarea
          label="Mô tả"
          placeholder="Mô tả chi tiết ý tưởng nội dung..."
          {...register('description')}
          error={errors.description}
        />

        <FormInput
          label="Nguồn"
          placeholder="Ý tưởng này đến từ đâu? (VD: Đối thủ, Xu hướng, Cộng đồng)"
          {...register('source')}
          error={errors.source}
        />

        <FormSelect
          label="Ưu tiên"
          options={[
            { value: 'low', label: 'Thấp' },
            { value: 'medium', label: 'Trung bình' },
            { value: 'high', label: 'Cao' },
          ]}
          {...register('priority')}
          error={errors.priority}
        />

        <FormSelect
          label="Trạng thái"
          options={[
            { value: 'draft', label: 'Nháp' },
            { value: 'new', label: 'Mới' },
            { value: 'in progress', label: 'Đang làm' },
            { value: 'done', label: 'Hoàn thành' },
            { value: 'discarded', label: 'Đã huỷ' },
          ]}
          {...register('status')}
          error={errors.status}
        />

        <FormSelect
          label="Liên kết sản phẩm (tuỳ chọn)"
          options={products.map(p => ({ value: p.id, label: p.name }))}
          {...register('productId')}
        />
      </form>
    </Modal>
  );
}
