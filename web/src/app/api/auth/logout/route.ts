import { NextResponse } from 'next/server';
import { deleteToken } from '@/lib/gmail/auth';

export async function POST() {
  try {
    deleteToken();
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to logout' },
      { status: 500 }
    );
  }
}
