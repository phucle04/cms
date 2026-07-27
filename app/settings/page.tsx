'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/common/Tabs';
import { BrandProfileTab } from '@/components/modules/settings/BrandProfileTab';
import { PromptTemplateTab } from '@/components/modules/settings/PromptTemplateTab';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('brand');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cài đặt</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Cấu hình thương hiệu và prompt AI dùng cho pipeline nghiên cứu xu hướng TikTok
        </p>
      </div>

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
