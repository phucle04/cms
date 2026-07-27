'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

export default function StoreInfoTab() {
  const [storeInfo, setStoreInfo] = useState<Types.StoreBrandInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<Types.StoreBrandInfo>>({});

  useEffect(() => {
    loadStoreInfo();
  }, []);

  const loadStoreInfo = async () => {
    try {
      const data = await API.StoreInfoAPI.get();
      setStoreInfo(data);
      setFormData(data || {});
    } catch (error) {
      console.error('Failed to load store info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const updated = await API.StoreInfoAPI.update(formData);
      setStoreInfo(updated);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update store info:', error);
    }
  };

  if (loading) return <div className="py-8 text-center text-gray-500">Loading...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Store & Brand Info</CardTitle>
          <CardDescription>Store details, branches, and promotions</CardDescription>
        </div>
        {!isEditing && <Button onClick={() => setIsEditing(true)} variant="primary">Edit</Button>}
      </CardHeader>

      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Store Name</label>
              <input
                type="text"
                value={formData.storeName || ''}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Info</label>
              <input
                type="text"
                value={formData.contactInfo || ''}
                onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Branches (comma-separated)</label>
              <input
                type="text"
                value={formData.branches?.join(', ') || ''}
                onChange={(e) => setFormData({ ...formData, branches: e.target.value.split(',').map(b => b.trim()) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Promotions (comma-separated)</label>
              <textarea
                value={formData.promotions?.join(', ') || ''}
                onChange={(e) => setFormData({ ...formData, promotions: e.target.value.split(',').map(p => p.trim()) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} variant="primary">Save</Button>
              <Button onClick={() => setIsEditing(false)} variant="outline">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Store Name</h4>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{storeInfo?.storeName}</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Contact</h4>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{storeInfo?.contactInfo}</p>
            </div>

            {storeInfo?.branches && storeInfo.branches.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Branches</h4>
                <ul className="mt-1 space-y-1">
                  {storeInfo.branches.map((branch) => (
                    <li key={branch} className="text-gray-600 dark:text-gray-400">• {branch}</li>
                  ))}
                </ul>
              </div>
            )}

            {storeInfo?.promotions && storeInfo.promotions.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Promotions</h4>
                <ul className="mt-1 space-y-1">
                  {storeInfo.promotions.map((promo) => (
                    <li key={promo} className="text-gray-600 dark:text-gray-400">• {promo}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
