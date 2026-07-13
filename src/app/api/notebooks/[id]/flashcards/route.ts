import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const decks = await db.flashcardDeck.findMany({
      where: { notebookId: id },
      include: {
        _count: {
          select: { flashcards: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(decks);
  } catch (error) {
    console.error('Error listing flashcard decks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flashcard decks' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { topicId, count } = body;

    const cardCount = Math.min(Math.max(count || 10, 1), 50);

    // Get topic content if topicId is provided
    let topicContent = '';
    let topicTitle = '';

    if (topicId) {
      const topic = await db.topic.findUnique({
        where: { id: topicId },
      });

      if (!topic) {
        return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      }

      topicTitle = topic.title;
      topicContent = [topic.description || '', topic.content || '']
        .filter(Boolean)
        .join('\n\n');
    }

    // Get notebook context
    const notebook = await db.notebook.findUnique({
      where: { id },
      include: {
        units: {
          include: { topics: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    const notebookContext = notebook.units
      .map(
        (u) =>
          `Unit: ${u.title}\nTopics: ${u.topics.map((t) => t.title).join(', ')}`
      )
      .join('\n');

    // If no topic specified, use current topic or general notebook info
    if (!topicId) {
      if (notebook.currentTopicId) {
        const currentTopic = await db.topic.findUnique({
          where: { id: notebook.currentTopicId },
        });
        if (currentTopic) {
          topicTitle = currentTopic.title;
          topicContent = [currentTopic.description || '', currentTopic.content || '']
            .filter(Boolean)
            .join('\n\n');
        }
      }

      if (!topicContent.trim()) {
        topicContent = `Notebook: ${notebook.name}\n${notebook.description || ''}`;
      }
    }

    // Dynamically import AI engine
    const { generateFlashcards } = await import('@/lib/ai-engines/flashcard-engine');

    // Generate flashcards using AI
    const generated = await generateFlashcards({
      topicContent,
      notebookContext,
      count: cardCount,
    });

    // Create FlashcardDeck + Flashcards in DB
    const deck = await db.flashcardDeck.create({
      data: {
        notebookId: id,
        topicId: topicId || null,
        title: generated.title || `Flashcards: ${topicTitle || 'General'}`,
        flashcards: {
          create: generated.flashcards.map((f) => ({
            front: f.front,
            back: f.back,
            type: f.type,
            difficulty: f.difficulty,
            topicId: topicId || null,
          })),
        },
      },
      include: {
        flashcards: true,
      },
    });

    return NextResponse.json(deck, { status: 201 });
  } catch (error) {
    console.error('Error generating flashcards:', error);
    return NextResponse.json(
      { error: 'Failed to generate flashcards' },
      { status: 500 }
    );
  }
}