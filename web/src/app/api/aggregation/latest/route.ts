import { NextResponse } from 'next/server';
import { getLatestAggregation, getArticlesForAggregation } from '@/lib/db';

export async function GET() {
  try {
    const aggregation = getLatestAggregation();

    if (!aggregation) {
      return NextResponse.json({
        aggregation: null,
        articles: [],
        message: 'No aggregations found. Run your first aggregation to get started.',
      });
    }

    const articles = getArticlesForAggregation(aggregation.id);

    return NextResponse.json({
      aggregation,
      articles,
    });
  } catch (error) {
    console.error('Error fetching latest aggregation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aggregation' },
      { status: 500 }
    );
  }
}
