import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chatId: string }> }
) {
  try {
    const { chatId } = await params;

    const messages = await db.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chatId: string }> }
) {
  try {
    const { id, chatId } = await params;
    const body = await request.json();
    const { content, stream } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Verify chat belongs to notebook
    const chat = await db.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat || chat.notebookId !== id) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Save user message
    const userMessage = await db.message.create({
      data: {
        chatId,
        role: 'user',
        content: content.trim(),
      },
    });

    // Build context for AI (same as before)
    const notebook = await db.notebook.findUnique({
      where: { id },
      include: {
        units: {
          include: { topics: true },
          orderBy: { order: 'asc' },
        },
        documents: {
          select: { content: true, filename: true },
        },
        notes: {
          select: { title: true, content: true },
          take: 10,
        },
        quizzes: {
          include: {
            attempts: {
              select: { score: true, totalQuestions: true },
            },
          },
          take: 5,
        },
      },
    });

    const syllabusContext = notebook?.units
      ? notebook.units
          .map(
            (u) =>
              `Unit: ${u.title}\n${u.description || ''}\nTopics:\n${u.topics.map((t) => `  - ${t.title} (${t.difficulty}): ${t.description || ''}`).join('\n')}`
          )
          .join('\n\n')
      : '';

    const docContent = notebook?.documents
      ?.filter((d) => d.content)
      .map((d) => `[${d.filename}]\n${d.content}`)
      .join('\n\n') || '';

    const notesContent = notebook?.notes
      ?.map((n) => `## ${n.title}\n${n.content}`)
      .join('\n\n') || '';

    const notebookContent = [docContent, notesContent].filter(Boolean).join('\n\n');

    const quizPerformance = notebook?.quizzes
      ? notebook.quizzes
          .map(
            (q) =>
              `Quiz: ${q.title} | Attempts: ${q.attempts.length} | Avg Score: ${q.attempts.length > 0 ? Math.round((q.attempts.reduce((sum, a) => sum + (a.score / a.totalQuestions) * 100, 0) / q.attempts.length)) : 'N/A'}%`
          )
          .join('\n')
      : '';

    const fullNotebookContent = [notebookContent, quizPerformance ? `\nQuiz Performance:\n${quizPerformance}` : ''].filter(Boolean).join('\n');

    const chatHistory = await db.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    // If client wants streaming, return SSE
    if (stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send user message ID first
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'userMessageId', id: userMessage.id })}\n\n`));

            // Dynamically import streaming engine
            const { generateTutorResponseStream } = await import('@/lib/ai-engines/tutoring-engine');

            const result = await generateTutorResponseStream({
              userMessage: content.trim(),
              syllabusContext,
              notebookContent: fullNotebookContent,
              chatHistory: chatHistory.map((m) => ({ role: m.role, content: m.content })),
              onChunk: (chunk) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`));
              },
            });

            // Save assistant message to DB
            const assistantMessage = await db.message.create({
              data: {
                chatId,
                role: 'assistant',
                content: result.content,
                citations: result.citations.length > 0 ? JSON.stringify(result.citations) : null,
                images: result.images.length > 0 ? JSON.stringify(result.images) : null,
              },
            });

            // Send final message with complete data
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', messageId: assistantMessage.id, content: result.content, citations: result.citations, images: result.images })}\n\n`));

            // Update chat title from first user message
            const messageCount = await db.message.count({ where: { chatId } });
            if (messageCount <= 2) {
              const title = content.trim().slice(0, 60) + (content.length > 60 ? '...' : '');
              await db.chat.update({
                where: { id: chatId },
                data: { title },
              });
            }
          } catch (error) {
            console.error('[Stream] Error:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Failed to generate response' })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming fallback (original behavior)
    const { generateTutorResponse } = await import('@/lib/ai-engines/tutoring-engine');

    const aiResponse = await generateTutorResponse({
      userMessage: content.trim(),
      syllabusContext,
      notebookContent: fullNotebookContent,
      chatHistory: chatHistory.map((m) => ({ role: m.role, content: m.content })),
    });

    const assistantMessage = await db.message.create({
      data: {
        chatId,
        role: 'assistant',
        content: aiResponse.content,
        citations: aiResponse.citations.length > 0 ? JSON.stringify(aiResponse.citations) : null,
        images: aiResponse.images && aiResponse.images.length > 0 ? JSON.stringify(aiResponse.images) : null,
      },
    });

    const messageCount = await db.message.count({ where: { chatId } });
    if (messageCount <= 2) {
      const title = content.trim().slice(0, 60) + (content.length > 60 ? '...' : '');
      await db.chat.update({
        where: { id: chatId },
        data: { title },
      });
    }

    return NextResponse.json({
      messages: [userMessage, assistantMessage],
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}