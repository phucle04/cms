'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/common/Tabs';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('ai');
  const [settings, setSettings] = useState<Types.AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Types.AppSettings>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await API.SettingsAPI.get();
      setSettings(data);
      setFormData(data || {});
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const updated = await API.SettingsAPI.update(formData);
      setSettings(updated);
      setIsEditing(false);
      console.log('[v0] Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  if (loading) return <div className="py-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Configure AI integration and app settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai">AI Agent</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>AI Agent Configuration</CardTitle>
                <CardDescription>Configure your AI endpoint for content generation</CardDescription>
              </div>
              {!isEditing && <Button onClick={() => setIsEditing(true)} variant="primary">Edit</Button>}
            </CardHeader>

            <CardContent className="space-y-4">
              {isEditing ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      AI API Endpoint
                    </label>
                    <input
                      type="url"
                      value={formData.aiApiEndpoint || ''}
                      onChange={(e) => setFormData({ ...formData, aiApiEndpoint: e.target.value })}
                      placeholder="https://api.example.com/generate"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The endpoint to send content generation requests</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={formData.aiApiKey || ''}
                      onChange={(e) => setFormData({ ...formData, aiApiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Model
                      </label>
                      <input
                        type="text"
                        value={formData.aiModel || ''}
                        onChange={(e) => setFormData({ ...formData, aiModel: e.target.value })}
                        placeholder="gpt-4"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Temperature (0-1)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.aiTemperature || 0.7}
                        onChange={(e) => setFormData({ ...formData, aiTemperature: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" variant="primary">Save</Button>
                    <Button type="button" onClick={() => setIsEditing(false)} variant="outline">Cancel</Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">AI API Endpoint</p>
                    <p className="text-gray-900 dark:text-white mt-1">{settings?.aiApiEndpoint || 'Not configured'}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">API Key</p>
                    <p className="text-gray-900 dark:text-white mt-1">{settings?.aiApiKey ? '****' + settings.aiApiKey.slice(-4) : 'Not configured'}</p>
                  </div>

                  <div className="grid grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Model</p>
                      <p className="text-gray-900 dark:text-white mt-1">{settings?.aiModel || 'N/A'}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Temperature</p>
                      <p className="text-gray-900 dark:text-white mt-1">{settings?.aiTemperature || 0.7}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>App-wide preferences and automation</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Auto-Archive Old Trends</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Automatically archive trends older than 30 days</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings?.autoArchiveOldTrends || false}
                  disabled
                  className="w-4 h-4"
                />
              </div>

              <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white">Auto-Archive After</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{settings?.autoArchiveDays || 30} days</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
