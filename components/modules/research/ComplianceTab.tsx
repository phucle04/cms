'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';
import { Plus, Trash2 } from 'lucide-react';

export default function ComplianceTab() {
  const [rules, setRules] = useState<Types.ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Types.ComplianceRule>>({});

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const data = await API.ComplianceAPI.list();
      setRules(data);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newRule = await API.ComplianceAPI.create({
        category: formData.category || '',
        rule: formData.rule || '',
        bannedWords: formData.bannedWords || [],
        alternatives: formData.alternatives || [],
      });
      setRules([...rules, newRule]);
      setFormData({});
      setShowForm(false);
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this rule?')) {
      try {
        await API.ComplianceAPI.delete(id);
        setRules(rules.filter((r) => r.id !== id));
      } catch (error) {
        console.error('Failed to delete rule:', error);
      }
    }
  };

  if (loading) return <div className="py-8 text-center text-gray-500">Loading...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Compliance Rules</CardTitle>
          <CardDescription>Legal and platform-specific compliance rules</CardDescription>
        </div>
        <Button onClick={() => { setShowForm(true); setFormData({}); }} variant="primary">
          <Plus size={18} className="mr-2" /> Add Rule
        </Button>
      </CardHeader>

      {showForm && (
        <CardContent className="border-t border-gray-200 dark:border-gray-800 pt-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Category"
              value={formData.category || ''}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              required
            />
            <textarea
              placeholder="Rule"
              value={formData.rule || ''}
              onChange={(e) => setFormData({ ...formData, rule: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              rows={2}
            />
            <input
              type="text"
              placeholder="Banned words (comma-separated)"
              value={formData.bannedWords?.join(', ') || ''}
              onChange={(e) => setFormData({ ...formData, bannedWords: e.target.value.split(',').map(w => w.trim()) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            />
            <input
              type="text"
              placeholder="Alternatives (comma-separated)"
              value={formData.alternatives?.join(', ') || ''}
              onChange={(e) => setFormData({ ...formData, alternatives: e.target.value.split(',').map(a => a.trim()) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            />
            <div className="flex gap-2">
              <Button type="submit" variant="primary">Create Rule</Button>
              <Button type="button" onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
            </div>
          </form>
        </CardContent>
      )}

      <CardContent>
        <div className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No compliance rules added</p>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{rule.category}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rule.rule}</p>
                    {rule.bannedWords.length > 0 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">Banned: {rule.bannedWords.join(', ')}</p>
                    )}
                    {rule.alternatives.length > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400">Use instead: {rule.alternatives.join(', ')}</p>
                    )}
                  </div>
                  <button onClick={() => handleDelete(rule.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
