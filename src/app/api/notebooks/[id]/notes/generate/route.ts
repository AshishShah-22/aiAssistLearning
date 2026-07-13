import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { topicId, type } = body;

    const noteType = type || 'summary';

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
      topicContent = [
        topic.description || '',
        topic.content || '',
      ]
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

    // If no topicId, build content from the notebook's current unit/topic
    if (!topicId && notebook.currentTopicId) {
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
      topicContent = `Notebook: ${notebook.name}\n${notebook.description || 'No description available.'}`;
      topicTitle = topicTitle || notebook.name;
    }

    // Dynamically import AI engine
    const { generateNotes } = await import('@/lib/ai-engines/note-engine');

    // Call AI note generation engine
    const generated = await generateNotes({
      topicContent,
      notebookContext,
      type: noteType,
    });

    // Save the generated note to DB
    const note = await db.note.create({
      data: {
        notebookId: id,
        topicId: topicId || null,
        title: generated.title,
        content: generated.content,
        type: noteType,
        isAiGenerated: true,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error generating AI notes:', error);
    return NextResponse.json(
      { error: 'Failed to generate notes' },
      { status: 500 }
    );
  }
}