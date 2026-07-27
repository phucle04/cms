'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/common/Tabs';
import BrandVoiceTab from '@/components/modules/research/BrandVoiceTab';
import PersonaTab from '@/components/modules/research/PersonaTab';
import TrendTab from '@/components/modules/research/TrendTab';
import CompetitorTab from '@/components/modules/research/CompetitorTab';
import ComplianceTab from '@/components/modules/research/ComplianceTab';
import StoreInfoTab from '@/components/modules/research/StoreInfoTab';
import KeywordsTab from '@/components/modules/research/KeywordsTab';

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState('brand-voice');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Research & Strategy</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your brand foundation, audience insights, and market intelligence</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="brand-voice">Brand Voice</TabsTrigger>
          <TabsTrigger value="personas">Personas</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="store">Store Info</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
        </TabsList>

        <TabsContent value="brand-voice">
          <BrandVoiceTab />
        </TabsContent>

        <TabsContent value="personas">
          <PersonaTab />
        </TabsContent>

        <TabsContent value="trends">
          <TrendTab />
        </TabsContent>

        <TabsContent value="competitors">
          <CompetitorTab />
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceTab />
        </TabsContent>

        <TabsContent value="store">
          <StoreInfoTab />
        </TabsContent>

        <TabsContent value="keywords">
          <KeywordsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
