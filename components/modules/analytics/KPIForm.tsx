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
import { FormSelect } from '@/components/common/FormSelect';

const kpiSchema = z.object({
  views: z.coerce.number().min(0),
  likes: z.coerce.number().min(0),
  comments: z.coerce.number().min(0),
  shares: z.coerce.number().min(0),
  saves: z.coerce.number().min(0),
  watchTime: z.coerce.number().min(0),
  retention: z.coerce.number().min(0).max(100),
  ctr: z.coerce.number().min(0).max(100),
  orders: z.coerce.number().min(0),
  revenue: z.coerce.number().min(0),
});

type KPIFormData = z.infer<typeof kpiSchema>;

interface KPIFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Types.VideoKPI, 'id' | 'rank'>) => void;
  initialData?: Types.VideoKPI;
}

export function KPIForm({
  isOpen,
  onClose,
  onSave,
  initialData,
}: KPIFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<KPIFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: initialData ? {
      views: initialData.views,
      likes: initialData.likes,
      comments: initialData.comments,
      shares: initialData.shares,
      saves: initialData.saves,
      watchTime: initialData.watchTime,
      retention: initialData.retention,
      ctr: initialData.ctr,
      orders: initialData.orders,
      revenue: initialData.revenue,
    } : {},
  });

  const onSubmit = async (data: KPIFormData) => {
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      onSave({
        ...data,
        timestamp: initialData?.timestamp || new Date(),
      });
      toast.success(initialData ? 'KPI updated' : 'KPI created');
      reset();
      onClose();
    } catch (error) {
      toast.error('Failed to save KPI');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit KPI' : 'Add Video KPI'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
          >
            {initialData ? 'Update' : 'Add'} KPI
          </Button>
        </>
      }
    >
      <form className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Views"
          type="number"
          placeholder="0"
          {...register('views')}
          error={errors.views}
        />
        <FormInput
          label="Likes"
          type="number"
          placeholder="0"
          {...register('likes')}
          error={errors.likes}
        />
        <FormInput
          label="Comments"
          type="number"
          placeholder="0"
          {...register('comments')}
          error={errors.comments}
        />
        <FormInput
          label="Shares"
          type="number"
          placeholder="0"
          {...register('shares')}
          error={errors.shares}
        />
        <FormInput
          label="Saves"
          type="number"
          placeholder="0"
          {...register('saves')}
          error={errors.saves}
        />
        <FormInput
          label="Watch Time (minutes)"
          type="number"
          placeholder="0"
          {...register('watchTime')}
          error={errors.watchTime}
        />
        <FormInput
          label="Retention (%)"
          type="number"
          placeholder="0"
          min="0"
          max="100"
          {...register('retention')}
          error={errors.retention}
        />
        <FormInput
          label="CTR (%)"
          type="number"
          placeholder="0"
          min="0"
          max="100"
          {...register('ctr')}
          error={errors.ctr}
        />
        <FormInput
          label="Orders"
          type="number"
          placeholder="0"
          {...register('orders')}
          error={errors.orders}
        />
        <FormInput
          label="Revenue ($)"
          type="number"
          placeholder="0"
          step="0.01"
          {...register('revenue')}
          error={errors.revenue}
        />
      </form>
    </Modal>
  );
}
