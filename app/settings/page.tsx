'use client';

import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/common/Tabs';
import { BrandProfileTab } from '@/components/modules/settings/BrandProfileTab';
import { PromptTemplateTab } from '@/components/modules/settings/PromptTemplateTab';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('brand');

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Cài đặt"
        description="Cấu hình thương hiệu và prompt AI dùng cho pipeline nghiên cứu xu hướng TikTok"
        icon={<SettingsIcon size={28} />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="brand">Thương hiệu</TabsTrigger>
          <TabsTrigger value="prompts">Prompt AI</TabsTrigger>
        </TabsList>

        <TabsContent value="brand">
          <BrandProfileTab />
        </TabsContent>

        <TabsContent value="prompts">
          <PromptTemplateTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
