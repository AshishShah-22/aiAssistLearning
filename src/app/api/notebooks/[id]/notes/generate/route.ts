import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { topicId, type, stream = false } = body;

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

    // If no topicId, use the notebook's current unit/topic
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

    // Get recent chat messages as context (last 10 messages from most recent chat)
    let chatContext = '';
    try {
      const recentChat = await db.chat.findFirst({
        where: { notebookId: id },
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10,
          },
        },
      });
      if (recentChat && recentChat.messages.length > 0) {
        chatContext = recentChat.messages
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join('\n\n');
      }
    } catch {
      // non-critical, skip chat context
    }

    if (!topicContent.trim()) {
      topicContent = `Notebook: ${notebook.name}\n${notebook.description || 'No description available.'}`;
      topicTitle = topicTitle || notebook.name;
    }

    // ─── Streaming path ───────────────────────────────
    if (stream) {
      const { generateNotesStream } = await import('@/lib/ai-engines/note-engine');

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let accumulatedContent = '';
          let noteTitle = '';

          try {
            for await (const event of generateNotesStream({
              topicContent,
              topicTitle,
              notebookContext,
              type: noteType,
              chatContext,
            })) {
              if (event.type === 'title') {
                noteTitle = event.data || '';
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'title', title: noteTitle })}\n\n`)
                );
              } else if (event.type === 'chunk') {
                accumulatedContent += event.data || '';
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: event.data })}\n\n`)
                );
              } else if (event.type === 'done') {
                // Save to DB after streaming completes
                try {
                  const note = await db.note.create({
                    data: {
                      notebookId: id,
                      topicId: topicId || null,
                      title: noteTitle || `Notes: ${topicTitle}`,
                      content: accumulatedContent,
                      type: noteType,
                      isAiGenerated: true,
                    },
                  });
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'done', noteId: note.id, title: note.title })}\n\n`)
                  );
                } catch (dbErr) {
                  const errMsg = dbErr instanceof Error ? dbErr.message : 'DB save failed';
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'done', noteId: null, title: noteTitle || `Notes: ${topicTitle}`, dbError: errMsg })}\n\n`)
                  );
                }
                controller.close();
              } else if (event.type === 'error') {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'error', error: event.error })}\n\n`)
                );
                controller.close();
              }
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Stream failed';
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errMsg })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // ─── Non-streaming path (fallback) ────────────────
    const { generateNotes } = await import('@/lib/ai-engines/note-engine');

    const generated = await generateNotes({
      topicContent,
      topicTitle,
      notebookContext,
      type: noteType,
      chatContext,
    });

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
