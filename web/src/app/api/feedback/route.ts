import { NextRequest, NextResponse } from 'next/server';
import { insertFeedback, getFeedbackForArticle } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, isRelevant } = body;

    if (typeof articleId !== 'number' || typeof isRelevant !== 'boolean') {
      return NextResponse.json(
        { error: 'articleId (number) and isRelevant (boolean) are required' },
        { status: 400 }
      );
    }

    const feedback = insertFeedback(articleId, isRelevant);

    return NextResponse.json({
      success: true,
      feedback: {
        articleId: feedback.article_id,
        isRelevant: Boolean(feedback.is_relevant),
      },
    });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const articleId = searchParams.get('articleId');

    if (!articleId) {
      return NextResponse.json(
        { error: 'articleId is required' },
        { status: 400 }
      );
    }

    const feedback = getFeedbackForArticle(parseInt(articleId));

    return NextResponse.json({
      feedback: feedback ? { isRelevant: feedback.is_relevant } : null,
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}
