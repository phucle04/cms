'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RotateCcw, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { FormInput } from '@/components/common/FormInput';
import { FormTextarea } from '@/components/common/FormTextarea';
import { Skeleton } from '@/components/ui/skeleton';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

const KEY_LABEL: Record<Types.PromptTemplateKey, string> = {
  hashtag: 'Bước 1 - Gợi ý hashtag',
  video_analysis: 'Bước 4 - Phân tích video viral',
  script_gen: 'Bước 5 - Sinh ý tưởng + kịch bản',
};

// Danh sách placeholder khớp ĐÚNG với server/seeds/defaults/promptTemplates.default.ts
// và cách researchPipelineService.ts điền dữ liệu thật vào từng key - chỉ là
// gợi ý hiển thị cho người dùng, không phải logic AI.
const PLACEHOLDER_HINTS: Record<Types.PromptTemplateKey, string[]> = {
  hashtag: ['{{productName}}', '{{productCategory}}', '{{brandName}}', '{{usp}}', '{{painPoints}}', '{{targetAudience}}'],
  video_analysis: ['{{caption}}', '{{playCount}}', '{{diggCount}}', '{{transcript}}'],
  script_gen: [
    '{{productContext}}',
    '{{brandName}}',
    '{{toneOfVoice}}',
    '{{dontList}}',
    '{{doList}}',
    '{{complianceNotes}}',
    '{{trendContext}}',
  ],
};

function TemplateEditor({
  template,
  onSaved,
}: {
  template: Types.PromptTemplate;
  onSaved: (t: Types.PromptTemplate) => void;
}) {
  const [systemPrompt, setSystemPrompt] = useState(template.systemPrompt);
  const [userPromptTemplate, setUserPromptTemplate] = useState(template.userPromptTemplate);
  const [temperature, setTemperature] = useState(template.temperature);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const dirty =
    systemPrompt !== template.systemPrompt ||
    userPromptTemplate !== template.userPromptTemplate ||
    temperature !== template.temperature;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await API.PromptTemplateAPI.update(template.id, { systemPrompt, userPromptTemplate, temperature });
      onSaved(updated);
      toast.success('Đã lưu prompt');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Khôi phục prompt này về mặc định ban đầu? Nội dung bạn đã sửa sẽ mất.')) return;
    setResetting(true);
    try {
      const reset = await API.PromptTemplateAPI.resetToDefault(template.id);
      setSystemPrompt(reset.systemPrompt);
      setUserPromptTemplate(reset.userPromptTemplate);
      setTemperature(reset.temperature);
      onSaved(reset);
      toast.success('Đã khôi phục prompt mặc định');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Khôi phục thất bại');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>{KEY_LABEL[template.key] ?? template.name}</CardTitle>
          <CardDescription>
            {template.name}
            {template.isSystemSeed ? ' · Mặc định hệ thống' : ' · Tuỳ chỉnh'}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} isLoading={resetting}>
          <RotateCcw size={14} className="mr-1.5" /> Khôi phục mặc định
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium mb-1.5">Placeholder khả dụng (sẽ tự động được thay bằng dữ liệu thật):</p>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDER_HINTS[template.key]?.map((ph) => (
              <code key={ph} className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 text-xs">
                {ph}
              </code>
            ))}
          </div>
        </div>

        <FormTextarea
          label="Prompt hệ thống (vai trò của AI)"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="min-h-24"
        />
        <FormTextarea
          label="Mẫu prompt người dùng (nội dung yêu cầu, dùng placeholder ở trên)"
          value={userPromptTemplate}
          onChange={(e) => setUserPromptTemplate(e.target.value)}
          className="min-h-56 font-mono text-xs"
        />
        <FormInput
          label="Temperature (0-1, càng cao AI càng sáng tạo/ngẫu nhiên)"
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
        />

        <Button onClick={handleSave} isLoading={saving} disabled={!dirty}>
          <Save size={14} className="mr-1.5" /> Lưu prompt
        </Button>
      </CardContent>
    </Card>
  );
}

export function PromptTemplateTab() {
  const [templates, setTemplates] = useState<Types.PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await API.PromptTemplateAPI.list();
      setTemplates(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải được prompt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaved = (updated: Types.PromptTemplate) => {
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
          Chưa có prompt template nào. Cần chạy seed dữ liệu mặc định ở backend trước.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {templates.map((t) => (
        <TemplateEditor key={t.id} template={t} onSaved={handleSaved} />
      ))}
    </div>
  );
}
