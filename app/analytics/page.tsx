'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';
import * as AIService from '@/lib/ai-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { KPIForm } from '@/components/modules/analytics/KPIForm';
import { Plus, Trash2, Edit, Zap, TrendingUp } from 'lucide-react';

export default function AnalyticsPage() {
  const [kpis, setKpis] = useState<Types.VideoKPI[]>([]);
  const [analyses, setAnalyses] = useState<Types.WinLossAnalysis[]>([]);
  const [lessons, setLessons] = useState<Types.Lesson[]>([]);
  const [activeTab, setActiveTab] = useState('kpis');
  const [showKPIForm, setShowKPIForm] = useState(false);
  const [editingKPI, setEditingKPI] = useState<Types.VideoKPI | undefined>();
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [k, a, l] = await Promise.all([
        API.KPIAPI.list(),
        API.AnalysisAPI.list(),
        API.LessonAPI.list(),
      ]);
      setKpis(k);
      setAnalyses(a);
      setLessons(l);
    } catch (error) {
      toast.error('Failed to load data');
    }
  };

  const handleSaveKPI = async (data: Omit<Types.VideoKPI, 'id' | 'rank'>) => {
    try {
      if (editingKPI) {
        const updated = await API.KPIAPI.update(editingKPI.id, data);
        setKpis(kpis.map(k => k.id === updated.id ? updated : k));
        setEditingKPI(undefined);
      } else {
        const created = await API.KPIAPI.create(data);
        setKpis([...kpis, created]);
      }
      setShowKPIForm(false);
      toast.success(editingKPI ? 'KPI updated' : 'KPI logged');
    } catch (error) {
      toast.error('Failed to save KPI');
    }
  };

  const handleDeleteKPI = async (id: string) => {
    if (confirm('Delete this KPI?')) {
      try {
        await API.KPIAPI.delete(id);
        setKpis(kpis.filter(k => k.id !== id));
        toast.success('KPI deleted');
      } catch (error) {
        toast.error('Failed to delete KPI');
      }
    }
  };

  const handleGenerateAnalysis = async () => {
    if (kpis.length === 0) {
      toast.error('No KPIs to analyze');
      return;
    }

    setGeneratingAnalysis(true);
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentKPIs = kpis.filter(k => k.timestamp >= thirtyDaysAgo);

      if (recentKPIs.length === 0) {
        toast.error('No recent KPIs to analyze');
        setGeneratingAnalysis(false);
        return;
      }

      const analysis = await AIService.generateAnalysis(recentKPIs, {
        start: thirtyDaysAgo,
        end: now,
      });

      const created = await API.AnalysisAPI.create(analysis);
      setAnalyses([created, ...analyses]);
      setShowAnalysisModal(false);
      toast.success('Analysis generated');
    } catch (error) {
      toast.error('Failed to generate analysis');
    } finally {
      setGeneratingAnalysis(false);
    }
  };

  const kpisTab = (
    <div className="space-y-4">
      <Button onClick={() => {
        setEditingKPI(undefined);
        setShowKPIForm(true);
      }}>
        <Plus size={18} className="mr-2" />
        Log KPI
      </Button>

      {kpis.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No KPIs logged yet. Start tracking your video performance!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {kpis.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).map(kpi => (
            <Card key={kpi.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">Video Performance</CardTitle>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        kpi.rank === 'S' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                        kpi.rank === 'A' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                        kpi.rank === 'B' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                        kpi.rank === 'C' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                      }`}>
                        Rank {kpi.rank}
                      </span>
                    </div>
                    <CardDescription>{kpi.timestamp.toLocaleDateString()}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Views</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{(kpi.views / 1000).toFixed(1)}K</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Likes</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{(kpi.likes / 1000).toFixed(1)}K</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Comments</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{(kpi.comments / 1000).toFixed(1)}K</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Retention</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{kpi.retention.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Revenue</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">${kpi.revenue.toFixed(0)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingKPI(kpi);
                      setShowKPIForm(true);
                    }}
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteKPI(kpi.id)}
                  >
                    <Trash2 size={16} className="mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const analysisTab = (
    <div className="space-y-4">
      <Button
        onClick={() => setShowAnalysisModal(true)}
      >
        <Zap size={18} className="mr-2" />
        Generate Analysis
      </Button>

      {analyses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No analyses yet. Generate one from your KPIs!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {analyses.map((analysis, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle>Performance Analysis</CardTitle>
                <CardDescription>
                  {analysis.dateRange.start.toLocaleDateString()} - {analysis.dateRange.end.toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{analysis.performanceOverview}</p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Key Patterns</h4>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {analysis.patterns.map((p, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Gaps Found</h4>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {analysis.gaps.map((g, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-600 dark:text-red-400 mt-1">!</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Recommendations</h4>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {analysis.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-600 dark:text-blue-400 mt-1">→</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const lessonsTab = (
    <Card>
      <CardHeader>
        <CardTitle>Lessons Learned</CardTitle>
        <CardDescription>Accumulated insights from analytics</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 dark:text-gray-400">Lessons feature coming soon. These will be auto-generated from win/loss analysis.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Track performance metrics and insights</p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-8">
          {[
            { id: 'kpis', label: 'KPIs' },
            { id: 'analysis', label: 'Analysis' },
            { id: 'lessons', label: 'Lessons' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'kpis' && kpisTab}
        {activeTab === 'analysis' && analysisTab}
        {activeTab === 'lessons' && lessonsTab}
      </div>

      <KPIForm
        isOpen={showKPIForm}
        onClose={() => {
          setShowKPIForm(false);
          setEditingKPI(undefined);
        }}
        onSave={handleSaveKPI}
        initialData={editingKPI}
      />

      <Modal
        isOpen={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        title="Generate Performance Analysis"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowAnalysisModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateAnalysis}
              isLoading={generatingAnalysis}
            >
              Analyze
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {generatingAnalysis ? (
            <div className="text-center py-8">
              <Spinner size="lg" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">Analyzing your KPIs with AI...</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This will analyze all KPIs from the last 30 days and generate insights on patterns, gaps, and recommendations.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <strong>KPIs to analyze:</strong> {kpis.length}
                </p>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
