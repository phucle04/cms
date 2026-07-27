'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { StatsCard } from '@/components/common/StatsCard';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';
import { TrendingUp, Video, Eye, MessageCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [topVideos, setTopVideos] = useState<Types.VideoKPI[]>([]);
  const [totalStats, setTotalStats] = useState({
    ideas: 0,
    products: 0,
    trends: 0,
    scripts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [videos, ideas, products, trends, scripts] = await Promise.all([
          API.KPIAPI.getTopPerformers(5),
          API.IdeaAPI.list(),
          API.ProductAPI.list(),
          API.TrendAPI.list(),
          API.ScriptAPI.list(),
        ]);

        setTopVideos(videos);
        setTotalStats({
          ideas: ideas.length,
          products: products.length,
          trends: trends.length,
          scripts: scripts.length,
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Ideas"
          value={totalStats.ideas}
          icon={<Video size={24} />}
        />
        <StatsCard
          title="Products"
          value={totalStats.products}
          icon={<TrendingUp size={24} />}
        />
        <StatsCard
          title="Trends"
          value={totalStats.trends}
          icon={<Eye size={24} />}
        />
        <StatsCard
          title="Scripts"
          value={totalStats.scripts}
          icon={<MessageCircle size={24} />}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with your content workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/ideation" className="block">
              <Button variant="outline" className="w-full justify-center">
                <span>Create Idea</span>
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
            <Link href="/research" className="block">
              <Button variant="outline" className="w-full justify-center">
                <span>Research</span>
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
            <Link href="/scripting" className="block">
              <Button variant="outline" className="w-full justify-center">
                <span>Write Script</span>
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
            <Link href="/analytics" className="block">
              <Button variant="outline" className="w-full justify-center">
                <span>View Analytics</span>
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Videos */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Videos</CardTitle>
          <CardDescription>Your best-performing content this period</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : topVideos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No videos yet</div>
          ) : (
            <div className="space-y-4">
              {topVideos.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        video.rank === 'S' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                        video.rank === 'A' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                        video.rank === 'B' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                      }`}>
                        Rank {video.rank}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Views</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{(video.views / 1000).toFixed(0)}K</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Likes</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{(video.likes / 1000).toFixed(1)}K</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Comments</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{(video.comments / 1000).toFixed(1)}K</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Getting Started Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>New to the CMS? Start with these modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-semibold">1</div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Set up your brand voice in Research & Strategy</p>
                <p className="text-gray-600 dark:text-gray-400">Define your tone, personality, and messaging guidelines</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-semibold">2</div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Create product briefs for content ideas</p>
                <p className="text-gray-600 dark:text-gray-400">Organize product information and USPs for easier reference</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-semibold">3</div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Start with concept ideation</p>
                <p className="text-gray-600 dark:text-gray-400">Create and organize your content ideas with priorities</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
