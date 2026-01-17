import { NextResponse } from 'next/server';
import { runWeeklyAggregation } from '@/lib/aggregation';
import { isAuthenticated } from '@/lib/gmail/auth';

export async function POST() {
  try {
    // Check if authenticated
    if (!isAuthenticated()) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect your Gmail account first.' },
        { status: 401 }
      );
    }

    const result = await runWeeklyAggregation();

    return NextResponse.json({
      success: true,
      aggregation: result.aggregation,
      stats: result.stats,
    });
  } catch (error) {
    console.error('Error running weekly aggregation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run aggregation' },
      { status: 500 }
    );
  }
}
