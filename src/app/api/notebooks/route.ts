import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DUMMY_USER_ID = 'user-1';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = { userId: DUMMY_USER_ID };

    if (search) {
      where.name = { contains: search };
    }

    if (status) {
      where.status = status;
    }

    const notebooks = await db.notebook.findMany({
      where,
      include: {
        _count: {
          select: {
            units: true,
            documents: true,
            chats: true,
            notes: true,
            quizzes: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(notebooks);
  } catch (error) {
    console.error('Error listing notebooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notebooks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const notebook = await db.notebook.create({
      data: {
        userId: DUMMY_USER_ID,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#10b981',
        status: 'setup',
      },
    });

    return NextResponse.json(notebook, { status: 201 });
  } catch (error) {
    console.error('Error creating notebook:', error);
    return NextResponse.json(
      { error: 'Failed to create notebook' },
      { status: 500 }
    );
  }
}