import { NextRequest, NextResponse } from 'next/server';
import { getAllArticles, getArticlesForAggregation, getFeedbackForArticle } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const aggregationId = searchParams.get('aggregationId');

    let articles;
    if (aggregationId) {
      articles = getArticlesForAggregation(parseInt(aggregationId));
    } else {
      articles = getAllArticles();
    }

    // Add feedback info to each article
    const articlesWithFeedback = articles.map(article => {
      const feedback = getFeedbackForArticle(article.id);
      return {
        ...article,
        feedback: feedback ? { isRelevant: feedback.is_relevant } : null,
      };
    });

    return NextResponse.json({ articles: articlesWithFeedback });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}
