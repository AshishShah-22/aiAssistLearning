import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DUMMY_USER_ID = 'user-1';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { topicId, activityType, duration, metadata } = body;

    if (!activityType || !['read', 'quiz', 'chat', 'flashcard', 'revision', 'notes'].includes(activityType)) {
      return NextResponse.json(
        { error: 'Valid activityType is required (read, quiz, chat, flashcard, revision, notes)' },
        { status: 400 }
      );
    }

    if (!duration || typeof duration !== 'number' || duration < 0) {
      return NextResponse.json(
        { error: 'duration (seconds) is required and must be non-negative' },
        { status: 400 }
      );
    }

    const session = await db.studySession.create({
      data: {
        notebookId: id,
        userId: DUMMY_USER_ID,
        topicId: topicId || null,
        activityType,
        duration: Math.round(duration),
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error logging study session:', error);
    return NextResponse.json(
      { error: 'Failed to log study session' },
      { status: 500 }
    );
  }
}