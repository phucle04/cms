'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { ProductBriefForm } from '@/components/modules/ideation/ProductBriefForm';
import { IdeaForm } from '@/components/modules/ideation/IdeaForm';
import { Plus, Trash2, Edit, Zap } from 'lucide-react';

export default function IdeationPage() {
  const [products, setProducts] = useState<Types.ProductBrief[]>([]);
  const [ideas, setIdeas] = useState<Types.Idea[]>([]);
  const [activeTab, setActiveTab] = useState('products');
  const [showProductForm, setShowProductForm] = useState(false);
  const [showIdeaForm, setShowIdeaForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Types.ProductBrief | undefined>();
  const [editingIdea, setEditingIdea] = useState<Types.Idea | undefined>();
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [trendContext, setTrendContext] = useState<Types.CompetitorTranscript[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedContext = sessionStorage.getItem('trendResearchContext');
      if (savedContext) {
        const parsed = JSON.parse(savedContext) as Types.CompetitorTranscript[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTrendContext(parsed);
          toast.success('Trend research context loaded for ideation');
        }
      }
    } catch (error) {
      console.warn('Failed to load trend research context:', error);
    }
  }, []);

  const loadData = async () => {
    try {
      const [p, i] = await Promise.all([
        API.ProductAPI.list(),
        API.IdeaAPI.list(),
      ]);
      setProducts(p);
      setIdeas(i);
    } catch (error) {
      toast.error('Failed to load data');
    }
  };

  const handleSaveProduct = async (data: Omit<Types.ProductBrief, 'id'>) => {
    try {
      if (editingProduct) {
        const updated = await API.ProductAPI.update(editingProduct.id, data);
        setProducts(products.map(p => p.id === updated.id ? updated : p));
        setEditingProduct(undefined);
      } else {
        const created = await API.ProductAPI.create(data);
        setProducts([...products, created]);
      }
      setShowProductForm(false);
      toast.success(editingProduct ? 'Product updated' : 'Product created');
    } catch (error) {
      toast.error('Failed to save product');
    }
  };

  const handleSaveIdea = async (data: Omit<Types.Idea, 'id'>) => {
    try {
      if (editingIdea) {
        const updated = await API.IdeaAPI.update(editingIdea.id, data);
        setIdeas(ideas.map(i => i.id === updated.id ? updated : i));
        setEditingIdea(undefined);
      } else {
        const created = await API.IdeaAPI.create(data);
        setIdeas([...ideas, created]);
      }
      setShowIdeaForm(false);
      toast.success(editingIdea ? 'Idea updated' : 'Idea created');
    } catch (error) {
      toast.error('Failed to save idea');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Delete this product brief?')) {
      try {
        await API.ProductAPI.delete(id);
        setProducts(products.filter(p => p.id !== id));
        toast.success('Product deleted');
      } catch (error) {
        toast.error('Failed to delete product');
      }
    }
  };

  const handleDeleteIdea = async (id: string) => {
    if (confirm('Delete this idea?')) {
      try {
        await API.IdeaAPI.delete(id);
        setIdeas(ideas.filter(i => i.id !== id));
        toast.success('Idea deleted');
      } catch (error) {
        toast.error('Failed to delete idea');
      }
    }
  };

  const handleGenerateIdeas = async () => {
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }

    setGeneratingIdeas(true);
    try {
      const generatedIdeas = await API.IdeaAPI.generate(selectedProduct, 5, trendContext);
      if (Array.isArray(generatedIdeas)) {
        setIdeas([...ideas, ...generatedIdeas]);
        const message = trendContext.length > 0
          ? `Generated ${generatedIdeas.length} ideas with Gemini AI using trend evidence`
          : `Generated ${generatedIdeas.length} ideas with Gemini AI`;
        toast.success(message);
      }

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('trendResearchContext');
      }
      setTrendContext([]);
      setShowGenerateModal(false);
      setSelectedProduct('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      console.error('[Frontend] Idea generation error:', errorMessage);
      toast.error(`Failed to generate ideas: ${errorMessage}`);
    } finally {
      setGeneratingIdeas(false);
    }
  };

  const productBriefTab = (
    <div className="space-y-4">
      <Button onClick={() => {
        setEditingProduct(undefined);
        setShowProductForm(true);
      }}>
        <Plus size={18} className="mr-2" />
        New Product Brief
      </Button>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No product briefs yet. Create one to get started!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {products.map(product => (
            <Card key={product.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription>{product.category}</CardDescription>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                    product.status === 'active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                  }`}>
                    {product.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">USP</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{product.usp}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingProduct(product);
                      setShowProductForm(true);
                    }}
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteProduct(product.id)}
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

  const ideaBankTab = (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => {
          setEditingIdea(undefined);
          setShowIdeaForm(true);
        }}>
          <Plus size={18} className="mr-2" />
          New Idea
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowGenerateModal(true)}
        >
          <Zap size={18} className="mr-2" />
          Generate Ideas
        </Button>
      </div>

      {ideas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No ideas yet. Create one or generate ideas from a product!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {ideas.map(idea => (
            <Card key={idea.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{idea.title}</CardTitle>
                    <CardDescription>{idea.source}</CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                      idea.priority === 'high'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : idea.priority === 'medium'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                    }`}>
                      {idea.priority}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                      idea.status === 'done'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : idea.status === 'in progress'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : idea.status === 'discarded'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                    }`}>
                      {idea.status}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">{idea.description}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingIdea(idea);
                      setShowIdeaForm(true);
                    }}
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteIdea(idea.id)}
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

  const contentCalendarTab = (
    <Card>
      <CardHeader>
        <CardTitle>Content Calendar</CardTitle>
        <CardDescription>Weekly scheduling and planning</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 dark:text-gray-400">Content calendar feature coming soon. You'll be able to schedule posts, link ideas to calendar entries, and auto-generate scripts.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Concept & Ideation</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage product briefs, ideas, and content calendar</p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-8">
          {[
            { id: 'products', label: 'Product Briefs' },
            { id: 'ideas', label: 'Idea Bank' },
            { id: 'calendar', label: 'Content Calendar' },
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

      <div className="mt-6">
        {activeTab === 'products' && productBriefTab}
        {activeTab === 'ideas' && ideaBankTab}
        {activeTab === 'calendar' && contentCalendarTab}
      </div>

      <ProductBriefForm
        isOpen={showProductForm}
        onClose={() => {
          setShowProductForm(false);
          setEditingProduct(undefined);
        }}
        onSave={handleSaveProduct}
        initialData={editingProduct}
      />

      <IdeaForm
        isOpen={showIdeaForm}
        onClose={() => {
          setShowIdeaForm(false);
          setEditingIdea(undefined);
        }}
        onSave={handleSaveIdea}
        initialData={editingIdea}
        products={products}
      />

      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate Ideas from Product"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowGenerateModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateIdeas}
              isLoading={generatingIdeas}
              disabled={generatingIdeas || !selectedProduct}
            >
              Generate Ideas
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {generatingIdeas ? (
            <div className="text-center py-8">
              <Spinner size="lg" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">Generating ideas with AI...</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select a product to generate 5 content ideas using AI
              </p>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select a product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
