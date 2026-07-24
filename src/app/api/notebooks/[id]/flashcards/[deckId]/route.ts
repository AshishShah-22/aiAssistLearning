import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deckId: string }> }
) {
  try {
    const { id, deckId } = await params;
    const deck = await db.flashcardDeck.findUnique({
      where: { id: deckId, notebookId: id },
      include: { flashcards: { orderBy: { createdAt: 'asc' } } },
    });
    if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    return NextResponse.json(deck);
  } catch (error) {
    console.error('Error fetching deck:', error);
    return NextResponse.json({ error: 'Failed to fetch deck' }, { status: 500 });
  }
}
