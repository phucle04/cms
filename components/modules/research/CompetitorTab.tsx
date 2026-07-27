'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export default function CompetitorTab() {
  const [competitors, setCompetitors] = useState<Types.Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Types.Competitor>>({});

  useEffect(() => {
    loadCompetitors();
  }, []);

  const loadCompetitors = async () => {
    try {
      const data = await API.CompetitorAPI.list();
      setCompetitors(data);
    } catch (error) {
      console.error('Failed to load competitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const updated = await API.CompetitorAPI.update(editingId, formData);
        setCompetitors(competitors.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const newCompetitor = await API.CompetitorAPI.create({
          name: formData.name || '',
          platform: formData.platform || '',
          handle: formData.handle || '',
          followers: formData.followers || 0,
          averageViews: formData.averageViews || 0,
          strengths: formData.strengths || [],
          weaknesses: formData.weaknesses || [],
          analysisDate: new Date().toISOString(),
        });
        setCompetitors([...competitors, newCompetitor]);
      }

      setFormData({});
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      console.error('Failed to save competitor:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this competitor?')) {
      try {
        await API.CompetitorAPI.delete(id);
        setCompetitors(competitors.filter((c) => c.id !== id));
      } catch (error) {
        console.error('Failed to delete competitor:', error);
      }
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
            <CardTitle>Competitor Intelligence</CardTitle>
            <CardDescription>Analyze competitors and their content strategies</CardDescription>
          </div>
          <Button onClick={() => { setShowForm(true); setEditingId(null); setFormData({}); }} variant="primary">
            <Plus size={18} className="mr-2" /> Add Competitor
          </Button>
        </CardHeader>

        {showForm && (
          <CardContent className="border-t border-gray-200 dark:border-gray-800 pt-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Platform</label>
                  <input
                    type="text"
                    value={formData.platform || ''}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Handle</label>
                  <input
                    type="text"
                    value={formData.handle || ''}
                    onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Followers</label>
                  <input
                    type="number"
                    value={formData.followers || ''}
                    onChange={(e) => setFormData({ ...formData, followers: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Avg Views</label>
                  <input
                    type="number"
                    value={formData.averageViews || ''}
                    onChange={(e) => setFormData({ ...formData, averageViews: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Strengths (comma-separated)</label>
                <input
                  type="text"
                  value={formData.strengths?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, strengths: e.target.value.split(',').map(s => s.trim()) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Weaknesses (comma-separated)</label>
                <input
                  type="text"
                  value={formData.weaknesses?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, weaknesses: e.target.value.split(',').map(w => w.trim()) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="primary">
                  {editingId ? 'Update' : 'Create'} Competitor
                </Button>
                <Button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} variant="outline">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}

        <CardContent>
          <div className="space-y-3">
            {competitors.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No competitors added</p>
            ) : (
              competitors.map((competitor) => (
                <div
                  key={competitor.id}
                  className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{competitor.name}</h4>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                        <p><span className="font-medium">Platform:</span> {competitor.platform}</p>
                        <p><span className="font-medium">Handle:</span> {competitor.handle}</p>
                        <p><span className="font-medium">Followers:</span> {competitor.followers.toLocaleString()}</p>
                        <p><span className="font-medium">Avg Views:</span> {competitor.averageViews.toLocaleString()}</p>
                        {competitor.strengths.length > 0 && (
                          <p><span className="font-medium">Strengths:</span> {competitor.strengths.join(', ')}</p>
                        )}
                        {competitor.weaknesses.length > 0 && (
                          <p><span className="font-medium">Weaknesses:</span> {competitor.weaknesses.join(', ')}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button onClick={() => { setFormData(competitor); setEditingId(competitor.id); setShowForm(true); }} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(competitor.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                        <Trash2 size={16} className="text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
