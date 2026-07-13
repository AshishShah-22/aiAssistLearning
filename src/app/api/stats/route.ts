import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DUMMY_USER_ID = 'user-1';

export async function GET() {
  try {
    const [
      totalNotebooks,
      activeNotebooks,
      completedNotebooks,
      studySessions,
      quizAttempts,
    ] = await Promise.all([
      db.notebook.count({ where: { userId: DUMMY_USER_ID } }),
      db.notebook.count({ where: { userId: DUMMY_USER_ID, status: 'active' } }),
      db.notebook.count({ where: { userId: DUMMY_USER_ID, status: 'completed' } }),
      db.studySession.findMany({
        where: { userId: DUMMY_USER_ID },
        select: { duration: true, createdAt: true },
      }),
      db.quizAttempt.findMany({
        where: { userId: DUMMY_USER_ID },
        select: { score: true, totalQuestions: true, createdAt: true },
      }),
    ]);

    const totalStudyMinutes = Math.round(
      studySessions.reduce((sum, s) => sum + s.duration, 0) / 60
    );

    const totalQuizzesTaken = quizAttempts.length;

    const avgQuizScore =
      quizAttempts.length > 0
        ? Math.round(
            quizAttempts.reduce((sum, a) => sum + a.score, 0) /
              quizAttempts.length
          )
        : 0;

    // Calculate streak days
    const sessionDates = new Set(
      studySessions.map((s) => new Date(s.createdAt).toDateString())
    );
    const today = new Date();
    let streakDays = 0;
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      if (sessionDates.has(date.toDateString())) {
        streakDays++;
      } else if (i > 0) {
        break;
      }
    }

    // Notebooks created this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const notebooksCreatedThisWeek = await db.notebook.count({
      where: {
        userId: DUMMY_USER_ID,
        createdAt: { gte: weekAgo },
      },
    });

    return NextResponse.json({
      totalNotebooks,
      activeNotebooks,
      completedNotebooks,
      totalStudyMinutes,
      totalQuizzesTaken,
      avgQuizScore,
      streakDays,
      notebooksCreatedThisWeek,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}