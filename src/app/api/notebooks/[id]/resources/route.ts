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

    const resources = await db.resource.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(resources);
  } catch (error) {
    console.error('Error listing resources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
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
    const { title, url, type, description, topicId } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!type || !['book', 'paper', 'documentation', 'video', 'article', 'blog', 'practice', 'uploaded'].includes(type)) {
      return NextResponse.json(
        { error: 'Valid type is required (book, paper, documentation, video, article, blog, practice, uploaded)' },
        { status: 400 }
      );
    }

    const resource = await db.resource.create({
      data: {
        notebookId: id,
        topicId: topicId || null,
        title: title.trim(),
        url: url?.trim() || null,
        type,
        description: description?.trim() || null,
        isAutoFound: false,
      },
    });

    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    console.error('Error creating resource:', error);
    return NextResponse.json(
      { error: 'Failed to create resource' },
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
    const resourceId = searchParams.get('resourceId');

    if (!resourceId) {
      return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
    }

    const existing = await db.resource.findFirst({
      where: { id: resourceId, notebookId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    await db.resource.delete({ where: { id: resourceId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting resource:', error);
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 });
  }
}