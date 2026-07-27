'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/common/Tabs';
import { useState } from 'react';

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState('products');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Archive</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Discontinued products, old trends, used scripts, and reports</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Discontinued Products</CardTitle>
              <CardDescription>Archived product briefs</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">No archived products</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Old Trends</CardTitle>
              <CardDescription>Trends older than 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">No old trends</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scripts">
          <Card>
            <CardHeader>
              <CardTitle>Used Scripts</CardTitle>
              <CardDescription>Published scripts with performance tags</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">No published scripts</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Reports</CardTitle>
              <CardDescription>Upload and view campaign reports</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">No reports</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
