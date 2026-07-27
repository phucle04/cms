'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

export default function BrandVoiceTab() {
  const [brandVoice, setBrandVoice] = useState<Types.BrandVoice | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<Types.BrandVoice>>({});

  useEffect(() => {
    loadBrandVoice();
  }, []);

  const loadBrandVoice = async () => {
    try {
      const data = await API.BrandVoiceAPI.get();
      setBrandVoice(data);
      setFormData(data || {});
    } catch (error) {
      console.error('Failed to load brand voice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const updated = await API.BrandVoiceAPI.update(formData);
      setBrandVoice(updated);
      setIsEditing(false);
      console.log('[v0] Brand voice updated successfully');
    } catch (error) {
      console.error('Failed to update brand voice:', error);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Brand Voice & Messaging</CardTitle>
            <CardDescription>Define your brand tone, personality, and communication guidelines</CardDescription>
          </div>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)} variant="primary">
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Brand Tone
                </label>
                <textarea
                  value={formData.tone || ''}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Personality Traits (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.personality?.join(', ') || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personality: e.target.value.split(',').map((p) => p.trim()),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Do&apos;s (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.dos?.join(', ') || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dos: e.target.value.split(',').map((d) => d.trim()),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Don&apos;ts (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.donts?.join(', ') || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      donts: e.target.value.split(',').map((d) => d.trim()),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CTA Samples (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.ctaSamples?.join(', ') || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ctaSamples: e.target.value.split(',').map((c) => c.trim()),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} variant="primary">
                  Save
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Tone</h4>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{brandVoice?.tone}</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Personality</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {brandVoice?.personality.map((trait) => (
                    <span
                      key={trait}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Do&apos;s</h4>
                <ul className="mt-2 space-y-1">
                  {brandVoice?.dos.map((item) => (
                    <li key={item} className="text-gray-600 dark:text-gray-400">
                      ✓ {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Don&apos;ts</h4>
                <ul className="mt-2 space-y-1">
                  {brandVoice?.donts.map((item) => (
                    <li key={item} className="text-gray-600 dark:text-gray-400">
                      ✗ {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">CTA Samples</h4>
                <ul className="mt-2 space-y-1">
                  {brandVoice?.ctaSamples.map((cta) => (
                    <li key={cta} className="text-gray-600 dark:text-gray-400">
                      • &quot;{cta}&quot;
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
