import { NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE_OPTIONS } from '@/lib/auth';

// GET: Return current user from session cookie
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({ user }, { status: 200 });
}

// DELETE: Clear session cookie (logout)
export async function DELETE() {
  const response = NextResponse.json(
    { success: true },
    { status: 200 }
  );
  response.cookies.set('session', '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}