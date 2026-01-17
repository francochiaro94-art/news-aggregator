import { NextResponse } from 'next/server';
import { isAuthenticated, loadToken } from '@/lib/gmail/auth';

export async function GET() {
  try {
    const authenticated = isAuthenticated();
    const token = authenticated ? loadToken() : null;

    return NextResponse.json({
      authenticated,
      expiresAt: token?.expiry_date ? new Date(token.expiry_date).toISOString() : null,
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}
