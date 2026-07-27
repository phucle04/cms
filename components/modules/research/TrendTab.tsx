'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';
import { Trash2, Plus, Edit2, Sparkles, ArrowRight } from 'lucide-react';

export default function TrendTab() {
  const router = useRouter();
  const [trends, setTrends] = useState<Types.Trend[]>([]);
  const [products, setProducts] = useState<Types.ProductBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<Types.Trend['status'] | 'all'>('all');
  const [formData, setFormData] = useState<Partial<Types.Trend>>({
    status: 'new',
    relevance: 'high',
    contentIdeas: [],
  });
  const [selectedProductId, setSelectedProductId] = useState('');
  const [researching, setResearching] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [videos, setVideos] = useState<Types.TikTokVideo[]>([]);
  const [transcripts, setTranscripts] = useState<Types.CompetitorTranscript[]>([]);

  useEffect(() => {
    loadTrends();
    loadProducts();
  }, []);

  const loadTrends = async () => {
    try {
      const data = await API.TrendAPI.list();
      setTrends(data);
    } catch (error) {
      console.error('Failed to load trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await API.ProductAPI.list();
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleResearch = async () => {
    if (!selectedProductId) {
      toast.error('Please select a product first');
      return;
    }

    setResearching(true);
    try {
      const result = await API.ResearchAPI.run(selectedProductId);
      setHashtags(result.hashtags || []);
      setVideos(result.videos || []);
      setTranscripts(result.transcripts || []);
      toast.success('Trend research completed');
    } catch (error) {
      console.error('Trend research failed:', error);
      toast.error('Trend research failed, using mock data instead');
    } finally {
      setResearching(false);
    }
  };

  const handleUseContext = () => {
    const context = transcripts.map((t) => ({ views: t.views, transcript: t.transcript })).slice(0, 5);
    sessionStorage.setItem('trendResearchContext', JSON.stringify(context));
    router.push('/ideation');
    toast.success('Trend context saved for ideation');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const updated = await API.TrendAPI.update(editingId, formData);
        setTrends(trends.map((t) => (t.id === editingId ? updated : t)));
      } else {
        const newTrend = await API.TrendAPI.create({
          name: formData.name || '',
          category: formData.category || '',
          source: formData.source || '',
          relevance: formData.relevance || 'medium',
          contentIdeas: formData.contentIdeas || [],
          status: formData.status || 'new',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setTrends([newTrend, ...trends]);
      }

      setFormData({ status: 'new', relevance: 'high', contentIdeas: [] });
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      console.error('Failed to save trend:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this trend?')) {
      try {
        await API.TrendAPI.delete(id);
        setTrends(trends.filter((t) => t.id !== id));
      } catch (error) {
        console.error('Failed to delete trend:', error);
      }
    }
  };

  const handleEdit = (trend: Types.Trend) => {
    setFormData(trend);
    setEditingId(trend.id);
    setShowForm(true);
  };

  const filteredTrends = filterStatus === 'all' ? trends : trends.filter((t) => t.status === filterStatus);

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Trend Research</CardTitle>
          <CardDescription>Find TikTok hashtags, inspect top-view videos, and use real viral patterns to shape your next ideas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select product</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Choose a product...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleResearch} isLoading={researching} disabled={researching || !selectedProductId} className="w-full">
                <Sparkles size={16} className="mr-2" />
                Find Trends
              </Button>
            </div>
          </div>

          {hashtags.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Suggested hashtags</p>
              <div className="flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {videos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Top 5 videos by views</p>
                <Button variant="outline" size="sm" onClick={handleUseContext}>
                  Use this context for ideation <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
              <div className="space-y-3">
                {videos.map((video, index) => {
                  const transcript = transcripts[index]?.transcript || '';
                  return (
                    <div key={video.id} className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 dark:text-white">#{index + 1} • {video.views.toLocaleString()} views</p>
                        <a href={video.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 dark:text-blue-400">Open video</a>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{video.caption}</p>
                      {transcript && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/60 rounded-md p-3">
                          {transcript.length > 220 ? `${transcript.slice(0, 220)}...` : transcript}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Trends</CardTitle>
            <CardDescription>Track relevant trends and content opportunities</CardDescription>
          </div>
          <Button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ status: 'new', relevance: 'high', contentIdeas: [] }); }} variant="primary">
            <Plus size={18} className="mr-2" /> Add Trend
          </Button>
        </CardHeader>

        {showForm && (
          <CardContent className="border-t border-gray-200 dark:border-gray-800 pt-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Trend Name
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Source
                  </label>
                  <input
                    type="text"
                    value={formData.source || ''}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Relevance
                  </label>
                  <select
                    value={formData.relevance || 'medium'}
                    onChange={(e) => setFormData({ ...formData, relevance: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status || 'new'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="new">New</option>
                    <option value="hot">Hot</option>
                    <option value="cold">Cold</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content Ideas (comma-separated)
                </label>
                <textarea
                  value={formData.contentIdeas?.join(', ') || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contentIdeas: e.target.value.split(',').map((i) => i.trim()),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="primary">
                  {editingId ? 'Update' : 'Create'} Trend
                </Button>
                <Button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}

        <CardContent className="space-y-4">
          {/* Filter buttons */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'new', 'hot', 'cold', 'archived'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Trends list */}
          <div className="space-y-3">
            {filteredTrends.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No trends found</p>
            ) : (
              filteredTrends.map((trend) => (
                <div
                  key={trend.id}
                  className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{trend.name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            trend.status === 'hot'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : trend.status === 'new'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : trend.status === 'cold'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {trend.status}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p>
                          <span className="font-medium">Category:</span> {trend.category}
                        </p>
                        <p>
                          <span className="font-medium">Source:</span> {trend.source}
                        </p>
                        <p>
                          <span className="font-medium">Relevance:</span> {trend.relevance}
                        </p>
                        {trend.contentIdeas.length > 0 && (
                          <p>
                            <span className="font-medium">Ideas:</span> {trend.contentIdeas.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(trend)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        aria-label="Edit"
                      >
                        <Edit2 size={16} className="text-gray-600 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(trend.id)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} className="text-red-600 dark:text-red-400" />
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
