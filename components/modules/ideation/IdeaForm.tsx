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
  title: z.string().min(1, 'Title required'),
  description: z.string().min(1, 'Description required'),
  source: z.string().min(1, 'Source required'),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['new', 'in progress', 'done', 'discarded']),
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
      toast.success(initialData ? 'Idea updated' : 'Idea created');
      reset();
      onClose();
    } catch (error) {
      toast.error('Failed to save idea');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Idea' : 'Create Idea'}
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
            {initialData ? 'Update' : 'Create'} Idea
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <FormInput
          label="Title"
          placeholder="Content idea title..."
          {...register('title')}
          error={errors.title}
        />

        <FormTextarea
          label="Description"
          placeholder="Detailed description of the content idea..."
          {...register('description')}
          error={errors.description}
        />

        <FormInput
          label="Source"
          placeholder="Where did this idea come from? (e.g., Competitor, Trend, Community)"
          {...register('source')}
          error={errors.source}
        />

        <FormSelect
          label="Priority"
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
          {...register('priority')}
          error={errors.priority}
        />

        <FormSelect
          label="Status"
          options={[
            { value: 'new', label: 'New' },
            { value: 'in progress', label: 'In Progress' },
            { value: 'done', label: 'Done' },
            { value: 'discarded', label: 'Discarded' },
          ]}
          {...register('status')}
          error={errors.status}
        />

        <FormSelect
          label="Link to Product (Optional)"
          options={products.map(p => ({ value: p.id, label: p.name }))}
          {...register('productId')}
        />
      </form>
    </Modal>
  );
}
