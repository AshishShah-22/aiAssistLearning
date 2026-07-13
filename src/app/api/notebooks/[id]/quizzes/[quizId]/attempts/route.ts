import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DUMMY_USER_ID = 'user-1';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const body = await request.json();
    const { answers, timeSpent } = body;

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json(
        { error: 'answers object is required' },
        { status: 400 }
      );
    }

    // Get quiz with questions
    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Calculate score
    let correctCount = 0;
    const totalQuestions = quiz.questions.length;

    for (const question of quiz.questions) {
      const userAnswer = answers[question.id];
      if (userAnswer !== undefined && userAnswer !== null) {
        // For MCQ and true_false, compare directly
        if (
          question.type === 'mcq' ||
          question.type === 'true_false'
        ) {
          if (userAnswer === question.correctAnswer) {
            correctCount++;
          }
        } else {
          // For short_answer, long_answer, coding — case-insensitive comparison
          if (
            userAnswer.toString().trim().toLowerCase() ===
            question.correctAnswer.trim().toLowerCase()
          ) {
            correctCount++;
          }
        }
      }
    }

    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // Save quiz attempt
    const attempt = await db.quizAttempt.create({
      data: {
        quizId,
        userId: DUMMY_USER_ID,
        answers: JSON.stringify(answers),
        score: Math.round(score * 100) / 100,
        totalQuestions,
        timeSpent: timeSpent || 0,
      },
    });

    return NextResponse.json({
      ...attempt,
      correctCount,
      totalQuestions,
      percentage: Math.round(score),
    });
  } catch (error) {
    console.error('Error submitting quiz attempt:', error);
    return NextResponse.json(
      { error: 'Failed to submit quiz attempt' },
      { status: 500 }
    );
  }
}