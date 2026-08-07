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

// Input HTML number trả về string; giữ nguyên kiểu string trong schema (thay
// vì z.preprocess sang number) để tránh xung đột kiểu input/output của
// zodResolver - convert sang number thủ công trong onSubmit bên dưới.
const optionalMoney = z
  .string()
  .optional()
  .refine((val) => !val || /^\d+(\.\d+)?$/.test(val), 'Giá phải là số không âm');

const productBriefSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên sản phẩm'),
  category: z.string().min(1, 'Vui lòng nhập ngành hàng'),
  usp: z.string().min(1, 'Vui lòng nhập USP'),
  painPoints: z.string().min(1, 'Vui lòng nhập nỗi đau khách hàng'),
  faqContent: z.string().optional(),
  // Trường bổ sung để AI viết kịch bản video short chính xác thay vì tự suy
  // đoán đối tượng dùng/liều dùng/giá - xem server/models/ProductBrief.ts
  targetAudience: z.string().optional(),
  usageInstructions: z.string().optional(),
  originCountry: z.string().optional(),
  certifications: z.string().optional(),
  price: optionalMoney,
  promoPrice: optionalMoney,
  promotionOffer: z.string().optional(),
  safetyNotes: z.string().optional(),
  status: z.enum(['active', 'archived']),
  ageCategory: z.enum(['under_24m', '24m_plus', 'not_applicable'], {
    message: 'Vui lòng chọn độ tuổi phù hợp',
  }),
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
      targetAudience: initialData.targetAudience,
      usageInstructions: initialData.usageInstructions,
      originCountry: initialData.originCountry,
      certifications: initialData.certifications,
      price: initialData.price !== undefined ? String(initialData.price) : undefined,
      promoPrice: initialData.promoPrice !== undefined ? String(initialData.promoPrice) : undefined,
      promotionOffer: initialData.promotionOffer,
      safetyNotes: initialData.safetyNotes,
      status: initialData.status,
      ageCategory: initialData.ageCategory ?? 'not_applicable',
    } : {
      status: 'active',
      ageCategory: 'not_applicable',
    },
  });

  const onSubmit = async (data: ProductBriefFormData) => {
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      onSave({
        ...data,
        price: data.price ? Number(data.price) : undefined,
        promoPrice: data.promoPrice ? Number(data.promoPrice) : undefined,
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
          label="Đối tượng phù hợp"
          placeholder="VD: Trẻ sơ sinh 0-18 tháng còi xương, hay quấy khóc; người lớn kém hấp thu canxi..."
          {...register('targetAudience')}
          helperText="Ghi rõ theo sản phẩm này để AI không dùng nhầm đối tượng chung của cả thương hiệu"
        />

        <FormTextarea
          label="Cách dùng & liều dùng"
          placeholder="VD: Trẻ 0-6 tháng: 3 giọt/ngày. Trẻ 6-12 tháng: 6 giọt/ngày. Uống buổi sáng trước 11h, sau ăn..."
          {...register('usageInstructions')}
          helperText="Số liệu đúng theo nhãn sản phẩm - AI sẽ trích dẫn nguyên văn, không tự bịa liều dùng"
        />

        <FormTextarea
          label="Lưu ý an toàn / khi nào cần hỏi bác sĩ"
          placeholder="VD: Bé sinh non, đang dùng vitamin/thuốc khác, có bệnh nền thận/tim mạch nên hỏi bác sĩ trước..."
          {...register('safetyNotes')}
          helperText="Bắt buộc với sản phẩm mẹ & bé - giúp kịch bản luôn nhắc đúng khuyến cáo, tránh vi phạm quảng cáo"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Xuất xứ"
            placeholder="VD: Slovenia (châu Âu)"
            {...register('originCountry')}
          />
          <FormInput
            label="Chứng nhận / kiểm nghiệm"
            placeholder="VD: FSSC 22000, GMP, COA từng lô, NIFC..."
            {...register('certifications')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="Giá bán thường (đ)"
            type="number"
            placeholder="VD: 295000"
            {...register('price')}
            error={errors.price}
          />
          <FormInput
            label="Giá ưu đãi hiện tại (đ)"
            type="number"
            placeholder="VD: 275000"
            {...register('promoPrice')}
            error={errors.promoPrice}
          />
          <FormInput
            label="Quà tặng / ưu đãi"
            placeholder="VD: Mua 2 tặng 1 đồ chơi"
            {...register('promotionOffer')}
          />
        </div>

        <FormTextarea
          label="Câu hỏi thường gặp"
          placeholder="Các câu hỏi và câu trả lời thường gặp..."
          {...register('faqContent')}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormSelect
            label="Trạng thái"
            options={[
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'archived', label: 'Đã lưu trữ' },
            ]}
            {...register('status')}
            error={errors.status}
          />
          <FormSelect
            label="Độ tuổi phù hợp"
            options={[
              { value: 'not_applicable', label: 'Không áp dụng (sản phẩm phi thực phẩm/không phải sữa)' },
              { value: 'under_24m', label: 'Dưới 24 tháng tuổi' },
              { value: '24m_plus', label: 'Từ 24 tháng tuổi trở lên' },
            ]}
            {...register('ageCategory')}
            error={errors.ageCategory}
            helperText="Sản phẩm dưới 24 tháng tuổi sẽ bị chặn tạo research job tự động (Nghị định 100/2014/NĐ-CP)"
          />
        </div>
      </form>
    </Modal>
  );
}
