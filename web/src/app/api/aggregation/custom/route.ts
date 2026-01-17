import { NextRequest, NextResponse } from 'next/server';
import { runAggregationPipeline } from '@/lib/aggregation';
import { isAuthenticated } from '@/lib/gmail/auth';

export async function POST(request: NextRequest) {
  try {
    // Check if authenticated
    if (!isAuthenticated()) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect your Gmail account first.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (start > end) {
      return NextResponse.json(
        { error: 'startDate must be before endDate' },
        { status: 400 }
      );
    }

    const result = await runAggregationPipeline(start, end);

    return NextResponse.json({
      success: true,
      aggregation: result.aggregation,
      stats: result.stats,
    });
  } catch (error) {
    console.error('Error running custom aggregation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run aggregation' },
      { status: 500 }
    );
  }
}
