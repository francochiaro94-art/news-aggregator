import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail/auth';

export async function GET() {
  try {
    const authUrl = getAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL. Check your Google OAuth credentials.' },
      { status: 500 }
    );
  }
}
