import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quizId: string }> }
) {
  try {
    const { id, quizId } = await params;
    const quiz = await db.quiz.findUnique({
      where: { id: quizId, notebookId: id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    return NextResponse.json(quiz);
  } catch (error) {
    console.error('Error fetching quiz:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz' }, { status: 500 });
  }
}
