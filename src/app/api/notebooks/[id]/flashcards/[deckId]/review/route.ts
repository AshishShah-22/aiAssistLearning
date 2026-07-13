import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deckId: string }> }
) {
  try {
    const { deckId } = await params;
    const body = await request.json();
    const { results } = body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'results array is required' },
        { status: 400 }
      );
    }

    // Verify deck exists
    const deck = await db.flashcardDeck.findUnique({
      where: { id: deckId },
    });

    if (!deck) {
      return NextResponse.json({ error: 'Flashcard deck not found' }, { status: 404 });
    }

    const now = new Date();

    // Update each flashcard's review stats
    for (const result of results) {
      const { flashcardId, correct } = result;

      if (!flashcardId || correct === undefined) continue;

      const flashcard = await db.flashcard.findUnique({
        where: { id: flashcardId },
      });

      if (!flashcard || flashcard.deckId !== deckId) continue;

      await db.flashcard.update({
        where: { id: flashcardId },
        data: {
          reviewCount: { increment: 1 },
          correctCount: { increment: correct ? 1 : 0 },
          lastReviewedAt: now,
          // Simple spaced repetition: next review in 1 day if correct, 10 minutes if wrong
          nextReviewAt: correct
            ? new Date(now.getTime() + 24 * 60 * 60 * 1000) // 1 day
            : new Date(now.getTime() + 10 * 60 * 1000), // 10 minutes
        },
      });
    }

    // Return updated deck with flashcard stats
    const updatedDeck = await db.flashcardDeck.findUnique({
      where: { id: deckId },
      include: {
        flashcards: {
          select: {
            id: true,
            front: true,
            back: true,
            reviewCount: true,
            correctCount: true,
            lastReviewedAt: true,
            nextReviewAt: true,
          },
        },
      },
    });

    // Compute summary
    const totalReviewed = results.length;
    const totalCorrect = results.filter((r: { correct: boolean }) => r.correct).length;

    return NextResponse.json({
      deck: updatedDeck,
      summary: {
        totalReviewed,
        totalCorrect,
        accuracy: totalReviewed > 0 ? Math.round((totalCorrect / totalReviewed) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Error updating flashcard review:', error);
    return NextResponse.json(
      { error: 'Failed to update flashcard review' },
      { status: 500 }
    );
  }
}