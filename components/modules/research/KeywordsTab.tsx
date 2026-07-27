'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

export default function KeywordsTab() {
  const [keywordSet, setKeywordSet] = useState<Types.KeywordSet | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<Types.KeywordSet>>({});

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    try {
      const data = await API.KeywordAPI.get();
      setKeywordSet(data);
      setFormData(data || { groups: [] });
    } catch (error) {
      console.error('Failed to load keywords:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const updated = await API.KeywordAPI.update(formData);
      setKeywordSet(updated);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update keywords:', error);
    }
  };

  const handleGroupChange = (groupIdx: number, keywords: string) => {
    const groups = [...(formData.groups || [])];
    groups[groupIdx] = {
      ...groups[groupIdx],
      keywords: keywords.split(',').map((k) => k.trim()),
    };
    setFormData({ ...formData, groups });
  };

  if (loading) return <div className="py-8 text-center text-gray-500">Loading...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>SEO Keywords & Hashtags</CardTitle>
          <CardDescription>Manage your keyword and hashtag collections</CardDescription>
        </div>
        {!isEditing && <Button onClick={() => setIsEditing(true)} variant="primary">Edit</Button>}
      </CardHeader>

      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            {(formData.groups || []).map((group, idx) => (
              <div key={group.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {group.type === 'seo' ? 'SEO Keywords' : group.type === 'hashtag' ? 'Hashtags' : 'Voice Search'}
                  </label>
                </div>
                <textarea
                  value={group.keywords.join(', ') || ''}
                  onChange={(e) => handleGroupChange(idx, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  rows={2}
                />
              </div>
            ))}

            <div className="flex gap-2">
              <Button onClick={handleSave} variant="primary">Save</Button>
              <Button onClick={() => setIsEditing(false)} variant="outline">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {keywordSet?.groups && keywordSet.groups.map((group) => (
              <div key={group.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {group.type === 'seo' ? 'SEO Keywords' : group.type === 'hashtag' ? 'Hashtags' : 'Voice Search Keywords'}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {group.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
