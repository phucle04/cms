'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/common/Tabs';
import { useState } from 'react';
import { Plus } from 'lucide-react';

export default function ScriptingPage() {
  const [activeTab, setActiveTab] = useState('scripts');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Scripting & Production</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Write scripts, storyboards, and audio guides</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="formulas">Formulas</TabsTrigger>
          <TabsTrigger value="storyboards">Storyboards</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
        </TabsList>

        <TabsContent value="scripts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Scripts</CardTitle>
                <CardDescription>Write and manage video scripts</CardDescription>
              </div>
              <Button variant="primary"><Plus size={18} className="mr-2" /> New Script</Button>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">Feature coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formulas">
          <Card>
            <CardHeader>
              <CardTitle>Script Formulas</CardTitle>
              <CardDescription>Pre-defined script templates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">Feature coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storyboards">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Storyboards</CardTitle>
                <CardDescription>Visual shot lists for scripts</CardDescription>
              </div>
              <Button variant="primary"><Plus size={18} className="mr-2" /> New Storyboard</Button>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">Feature coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audio">
          <Card>
            <CardHeader>
              <CardTitle>Audio & SFX Guide</CardTitle>
              <CardDescription>Sound recommendations by content type</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">Feature coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
