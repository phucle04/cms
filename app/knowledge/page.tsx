'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/common/Tabs';
import { KnowledgeStoreTab } from '@/components/modules/knowledge/KnowledgeStoreTab';
import { ValueCommentTab } from '@/components/modules/knowledge/ValueCommentTab';

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState('hook');

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Kiến thức"
        description="Kho hook, nỗi đau khách hàng và kiểu tính cách DISC dùng làm nền tảng để AI sinh kịch bản video short chất lượng hơn."
        icon={<BookOpen size={28} />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="hook">Hook</TabsTrigger>
          <TabsTrigger value="pain_point">Pain point</TabsTrigger>
          <TabsTrigger value="disc">DISC</TabsTrigger>
          <TabsTrigger value="value_comment">Value comment</TabsTrigger>
        </TabsList>

        <TabsContent value="hook">
          <KnowledgeStoreTab storeType="hook" />
        </TabsContent>

        <TabsContent value="pain_point">
          <KnowledgeStoreTab storeType="pain_point" />
        </TabsContent>

        <TabsContent value="disc">
          <KnowledgeStoreTab storeType="disc" />
        </TabsContent>

        <TabsContent value="value_comment">
          <ValueCommentTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
