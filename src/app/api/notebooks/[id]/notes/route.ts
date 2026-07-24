import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get('topicId');

    const where: Record<string, unknown> = { notebookId: id };
    if (topicId) {
      where.topicId = topicId;
    }

    const notes = await db.note.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error listing notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
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
    const { title, content, topicId, type } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const note = await db.note.create({
      data: {
        notebookId: id,
        topicId: topicId || null,
        title: title.trim(),
        content: content.trim(),
        type: type || 'general',
        isAiGenerated: false,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notebookId } = await params;
    const body = await request.json();
    const { noteId, title, content, type } = body;

    if (!noteId) {
      return NextResponse.json(
        { error: 'noteId is required' },
        { status: 400 }
      );
    }

    const existing = await db.note.findFirst({
      where: { id: noteId, notebookId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    const note = await db.note.update({
      where: { id: noteId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() }),
        ...(type !== undefined && { type }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notebookId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json(
        { error: 'noteId is required' },
        { status: 400 }
      );
    }

    const existing = await db.note.findFirst({
      where: { id: noteId, notebookId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    await db.note.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
