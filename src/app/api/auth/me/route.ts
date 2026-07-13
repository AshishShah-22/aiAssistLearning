import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// GET: Return current user or 401
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  return NextResponse.json({ user }, { status: 200 });
}