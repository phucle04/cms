'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Plus } from 'lucide-react';

export default function OptimizationPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Optimization & Marketing</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Generate video metadata and thumbnail briefs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Video Metadata</CardTitle>
              <CardDescription>Titles, descriptions, hashtags</CardDescription>
            </div>
            <Button variant="primary"><Plus size={18} /> Generate</Button>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-500 py-8">Feature coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Thumbnail Briefs</CardTitle>
              <CardDescription>Design requirements for thumbnails</CardDescription>
            </div>
            <Button variant="primary"><Plus size={18} /> Generate</Button>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-500 py-8">Feature coming soon</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
