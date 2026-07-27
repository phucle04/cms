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
  name: z.string().min(1, 'Product name required'),
  category: z.string().min(1, 'Category required'),
  usp: z.string().min(1, 'USP required'),
  painPoints: z.string().min(1, 'Pain points required'),
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
      
      toast.success(initialData ? 'Product brief updated' : 'Product brief created');
      reset();
      onClose();
    } catch (error) {
      toast.error('Failed to save product brief');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Product Brief' : 'Create Product Brief'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
          >
            {initialData ? 'Update' : 'Create'} Product
          </Button>
        </>
      }
    >
      <form className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Product Name"
            placeholder="e.g., Ultra Pro Camera"
            {...register('name')}
            error={errors.name}
          />
          <FormInput
            label="Category"
            placeholder="e.g., Photography Equipment"
            {...register('category')}
            error={errors.category}
          />
        </div>

        <FormTextarea
          label="Unique Selling Proposition (USP)"
          placeholder="What makes this product unique?"
          {...register('usp')}
          error={errors.usp}
          helperText="Keywords separated by commas will be auto-generated"
        />

        <FormTextarea
          label="Pain Points Solved"
          placeholder="What problems does this solve for customers?"
          {...register('painPoints')}
          error={errors.painPoints}
        />

        <FormTextarea
          label="FAQ Content"
          placeholder="Frequently asked questions and answers..."
          {...register('faqContent')}
        />

        <FormTextarea
          label="Social Proof"
          placeholder="Testimonials, reviews, success metrics..."
          {...register('socialProof')}
        />

        <FormTextarea
          label="Comparison"
          placeholder="How it compares to competitors..."
          {...register('comparison')}
        />

        <FormTextarea
          label="Shooting Tips"
          placeholder="Best practices for creating content with this product..."
          {...register('shootingTips')}
        />

        <FormInput
          label="Media URL"
          type="url"
          placeholder="https://example.com/product-image.jpg"
          {...register('mediaUrl')}
        />

        <FormSelect
          label="Status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
          ]}
          {...register('status')}
          error={errors.status}
        />
      </form>
    </Modal>
  );
}
