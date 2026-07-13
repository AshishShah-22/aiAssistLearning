import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const notebook = await db.notebook.findUnique({
      where: { id },
      include: {
        units: {
          orderBy: { order: 'asc' },
          include: {
            topics: {
              orderBy: { order: 'asc' },
            },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            chats: true,
            notes: true,
            flashcardDecks: true,
            quizzes: true,
            resources: true,
            studySessions: true,
          },
        },
      },
    });

    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    return NextResponse.json(notebook);
  } catch (error) {
    console.error('Error fetching notebook:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notebook' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, color, status, currentUnitId, currentTopicId } = body;

    const existing = await db.notebook.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = typeof name === 'string' ? name.trim() : name;
    if (description !== undefined) updateData.description = description ? String(description).trim() : null;
    if (color !== undefined) updateData.color = color;
    if (status !== undefined) updateData.status = status;
    if (currentUnitId !== undefined) updateData.currentUnitId = currentUnitId || null;
    if (currentTopicId !== undefined) updateData.currentTopicId = currentTopicId || null;

    const notebook = await db.notebook.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(notebook);
  } catch (error) {
    console.error('Error updating notebook:', error);
    return NextResponse.json(
      { error: 'Failed to update notebook' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.notebook.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    // Delete quiz attempts first (they reference User, not cascaded from Notebook)
    const quizIds = await db.quiz.findMany({
      where: { notebookId: id },
      select: { id: true },
    });
    if (quizIds.length > 0) {
      await db.quizAttempt.deleteMany({
        where: { quizId: { in: quizIds.map((q) => q.id) } },
      });
    }

    // Delete messages first (they don't cascade from chat deletion in SQLite)
    const chatIds = await db.chat.findMany({
      where: { notebookId: id },
      select: { id: true },
    });
    if (chatIds.length > 0) {
      await db.message.deleteMany({
        where: { chatId: { in: chatIds.map((c) => c.id) } },
      });
    }

    // Delete progress records
    await db.progress.deleteMany({ where: { notebookId: id } });

    // Delete study sessions
    await db.studySession.deleteMany({ where: { notebookId: id } });

    // Delete flashcards (before decks)
    const deckIds = await db.flashcardDeck.findMany({
      where: { notebookId: id },
      select: { id: true },
    });
    if (deckIds.length > 0) {
      await db.flashcard.deleteMany({
        where: { deckId: { in: deckIds.map((d) => d.id) } },
      });
    }

    // Delete questions (before quizzes)
    if (quizIds.length > 0) {
      await db.question.deleteMany({
        where: { quizId: { in: quizIds.map((q) => q.id) } },
      });
    }

    // Delete the notebook (cascading will handle units, topics, chats, documents, notes, decks, quizzes, resources)
    await db.notebook.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notebook:', error);
    return NextResponse.json(
      { error: 'Failed to delete notebook' },
      { status: 500 }
    );
  }
}