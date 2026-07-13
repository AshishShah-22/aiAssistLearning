import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const documents = await db.document.findMany({
      where: { notebookId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Error listing documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
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
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    const filename = file.name;
    const fileExt = filename.split('.').pop()?.toLowerCase() || '';
    const validTypes: Record<string, string> = {
      txt: 'txt',
      md: 'md',
      pdf: 'pdf',
      docx: 'docx',
    };

    if (!validTypes[fileExt]) {
      return NextResponse.json(
        { error: 'Unsupported file type. Supported: txt, md, pdf, docx' },
        { status: 400 }
      );
    }

    const fileSize = file.size;
    const fileType = validTypes[fileExt];

    // Extract text for txt/md files
    let content: string | null = null;
    let status: string = 'processing';
    let errorMessage: string | null = null;

    if (fileType === 'txt' || fileType === 'md') {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        content = buffer.toString('utf-8');
        status = 'ready';
      } catch {
        status = 'error';
        errorMessage = 'Failed to read file content';
      }
    }
    // For pdf/docx, just store metadata and mark as "processing"
    // A real implementation would use a PDF/DOCX parser here

    const document = await db.document.create({
      data: {
        notebookId: id,
        filename,
        fileType,
        fileSize,
        content,
        status,
        errorMessage,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}