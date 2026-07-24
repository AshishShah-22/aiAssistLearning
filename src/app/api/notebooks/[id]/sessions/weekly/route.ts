import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessions = await db.studySession.findMany({
      where: {
        notebookId: id,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { duration: true, createdAt: true },
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const todayDay = today.getDay(); // 0=Sun

    // Build Mon-Sun of current week
    const days = [];
    for (let i = 0; i < 7; i++) {
      const actualDayIndex = i === 6 ? 0 : i + 1; // Mon=1..Sat=6, Sun=0
      days.push({
        day: dayNames[actualDayIndex],
        minutes: 0,
      });
    }

    // Sum minutes per day
    sessions.forEach((s) => {
      const date = new Date(s.createdAt);
      const dayOfWeek = date.getDay();
      // Map to our days array index (Mon=0, Tue=1, ..., Sun=6)
      const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      if (idx >= 0 && idx < 7) {
        days[idx].minutes += Math.round(s.duration / 60);
      }
    });

    return NextResponse.json({ days });
  } catch (error) {
    console.error('Error fetching weekly sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
