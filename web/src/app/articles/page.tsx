'use client';

import { useState, useEffect } from 'react';
import ArticleCard from '@/components/ArticleCard';

interface Article {
  id: number;
  title: string;
  summary: string;
  source_url: string;
  newsletter_date: string;
  feedback: { isRelevant: boolean } | null;
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/articles');
      const data = await res.json();

      if (data.articles) {
        setArticles(data.articles);
      }
    } catch (err) {
      setError('Failed to load articles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (articleId: number, isRelevant: boolean) => {
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, isRelevant }),
      });

      if (res.ok) {
        setArticles(prev =>
          prev.map(a =>
            a.id === articleId ? { ...a, feedback: { isRelevant } } : a
          )
        );
      }
    } catch (err) {
      console.error('Failed to save feedback:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading articles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Articles</h1>
        <p className="text-gray-600 mt-1">
          {articles.length} articles from your newsletters
        </p>
      </div>

      {articles.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <div className="text-6xl mb-4">📰</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No articles yet</h2>
          <p className="text-gray-600">
            Generate an aggregation to fetch articles from your newsletters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onFeedback={handleFeedback}
            />
          ))}
        </div>
      )}
    </div>
  );
}
