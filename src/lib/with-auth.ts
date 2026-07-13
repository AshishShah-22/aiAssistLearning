import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from './auth';

export async function withAuth(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  return { error: null, user };
}