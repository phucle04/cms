'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { FormInput } from '@/components/common/FormInput';
import { FormTextarea } from '@/components/common/FormTextarea';
import { Skeleton } from '@/components/ui/skeleton';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function arrayToLines(arr?: string[]): string {
  return (arr ?? []).join('\n');
}

interface FormState {
  brandName: string;
  tagline: string;
  industry: string;
  toneOfVoice: string;
  ageRange: string;
  gender: string;
  roles: string;
  painPoints: string;
  doList: string;
  dontList: string;
  complianceNotes: string;
  hotline: string;
  website: string;
  currentPromotions: string;
}

const EMPTY_FORM: FormState = {
  brandName: '',
  tagline: '',
  industry: '',
  toneOfVoice: '',
  ageRange: '',
  gender: '',
  roles: '',
  painPoints: '',
  doList: '',
  dontList: '',
  complianceNotes: '',
  hotline: '',
  website: '',
  currentPromotions: '',
};

function profileToForm(p: Types.BrandProfile): FormState {
  return {
    brandName: p.brandName,
    tagline: p.tagline ?? '',
    industry: p.industry,
    toneOfVoice: p.toneOfVoice,
    ageRange: p.targetAudience?.ageRange ?? '',
    gender: p.targetAudience?.gender ?? '',
    roles: arrayToLines(p.targetAudience?.roles),
    painPoints: arrayToLines(p.targetAudience?.painPoints),
    doList: arrayToLines(p.doList),
    dontList: arrayToLines(p.dontList),
    complianceNotes: p.complianceNotes ?? '',
    hotline: p.storeInfo?.hotline ?? '',
    website: p.storeInfo?.website ?? '',
    currentPromotions: arrayToLines(p.storeInfo?.currentPromotions),
  };
}

export function BrandProfileTab() {
  const [profile, setProfile] = useState<Types.BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const list = await API.BrandProfileAPI.list();
      const active = list.find((p) => p.isActive) ?? list[0] ?? null;
      setProfile(active);
      setForm(active ? profileToForm(active) : EMPTY_FORM);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải được thông tin thương hiệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!form.brandName.trim() || !form.industry.trim() || !form.toneOfVoice.trim()) {
      toast.error('Vui lòng nhập đủ Tên thương hiệu, Ngành hàng, Tone giọng');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Types.BrandProfile> = {
        brandName: form.brandName,
        tagline: form.tagline || undefined,
        industry: form.industry,
        toneOfVoice: form.toneOfVoice,
        targetAudience: {
          ageRange: form.ageRange,
          gender: form.gender,
          roles: linesToArray(form.roles),
          painPoints: linesToArray(form.painPoints),
        },
        doList: linesToArray(form.doList),
        dontList: linesToArray(form.dontList),
        complianceNotes: form.complianceNotes || undefined,
        storeInfo: {
          // Giữ nguyên branches (chưa có UI sửa field này) - tránh PUT ghi
          // đè mất dữ liệu vì Mongoose thay nguyên object storeInfo khi update.
          branches: profile?.storeInfo?.branches ?? [],
          hotline: form.hotline,
          website: form.website,
          currentPromotions: linesToArray(form.currentPromotions),
        },
      };

      if (profile) {
        const updated = await API.BrandProfileAPI.update(profile.id, payload);
        setProfile(updated);
        toast.success('Đã lưu thông tin thương hiệu');
      } else {
        const created = await API.BrandProfileAPI.create(payload);
        setProfile(created);
        toast.success('Đã tạo hồ sơ thương hiệu');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!profile && (
        <div className="p-4 rounded-lg bg-warning-muted text-sm text-warning-muted-foreground">
          Chưa có hồ sơ thương hiệu nào - điền thông tin bên dưới để tạo mới. AI sẽ dùng thông tin này khi sinh
          hashtag và kịch bản, nên càng chi tiết càng tốt.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Thông tin thương hiệu</CardTitle>
          <CardDescription>
            AI dùng thông tin này để sinh hashtag, kịch bản đúng giọng điệu thương hiệu và tuân thủ quy định của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Tên thương hiệu"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            />
            <FormInput label="Tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
            <FormInput label="Ngành hàng" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            <FormInput
              label="Tone giọng"
              placeholder="VD: thân thiện, gần gũi, đáng tin cậy"
              value={form.toneOfVoice}
              onChange={(e) => setForm({ ...form, toneOfVoice: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Độ tuổi khách hàng mục tiêu"
              placeholder="VD: 25-35 tuổi"
              value={form.ageRange}
              onChange={(e) => setForm({ ...form, ageRange: e.target.value })}
            />
            <FormInput
              label="Giới tính khách hàng mục tiêu"
              placeholder="VD: Nữ"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            />
          </div>

          <FormTextarea
            label="Vai trò khách hàng (mỗi dòng 1 mục)"
            placeholder={'Mẹ bỉm sữa\nNgười chăm sóc trẻ'}
            value={form.roles}
            onChange={(e) => setForm({ ...form, roles: e.target.value })}
          />
          <FormTextarea
            label="Nỗi đau khách hàng (mỗi dòng 1 mục)"
            placeholder={'Con biếng ăn\nCon táo bón'}
            value={form.painPoints}
            onChange={(e) => setForm({ ...form, painPoints: e.target.value })}
          />

          <FormTextarea
            label="Nên làm - Do List (mỗi dòng 1 mục)"
            value={form.doList}
            onChange={(e) => setForm({ ...form, doList: e.target.value })}
          />
          <FormTextarea
            label="Không được làm - Don't List (mỗi dòng 1 mục)"
            helperText="Danh sách này là RÀNG BUỘC CỨNG - AI không được vi phạm khi sinh kịch bản."
            value={form.dontList}
            onChange={(e) => setForm({ ...form, dontList: e.target.value })}
          />
          <FormTextarea
            label="Lưu ý pháp lý / compliance"
            value={form.complianceNotes}
            onChange={(e) => setForm({ ...form, complianceNotes: e.target.value })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput label="Hotline" value={form.hotline} onChange={(e) => setForm({ ...form, hotline: e.target.value })} />
            <FormInput label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <FormTextarea
            label="Khuyến mãi hiện tại (mỗi dòng 1 mục)"
            value={form.currentPromotions}
            onChange={(e) => setForm({ ...form, currentPromotions: e.target.value })}
          />

          <Button onClick={handleSave} isLoading={saving}>
            Lưu thông tin thương hiệu
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
