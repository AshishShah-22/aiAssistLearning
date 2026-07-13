import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const quizzes = await db.quiz.findMany({
      where: { notebookId: id },
      include: {
        _count: {
          select: { attempts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(quizzes);
  } catch (error) {
    console.error('Error listing quizzes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quizzes' },
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
    const { scope, scopeRefId, difficulty, questionCount } = body;

    if (!scope || !['topic', 'unit', 'syllabus', 'weak_areas'].includes(scope)) {
      return NextResponse.json(
        { error: 'Valid scope is required (topic, unit, syllabus, weak_areas)' },
        { status: 400 }
      );
    }

    const numQuestions = Math.min(Math.max(questionCount || 5, 1), 20);
    const quizDifficulty = difficulty || 'medium';

    // Build syllabus context
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

    const syllabusContext = notebook.units
      .map(
        (u) =>
          `Unit: ${u.title}\n${u.description || ''}\nTopics:\n${u.topics.map((t) => `  - ${t.title} (${t.difficulty}): ${t.description || ''}`).join('\n')}`
      )
      .join('\n\n');

    // Build notebook content from notes and documents
    const notes = await db.note.findMany({
      where: { notebookId: id },
      select: { title: true, content: true },
      take: 20,
    });

    const documents = await db.document.findMany({
      where: { notebookId: id, status: 'ready' },
      select: { filename: true, content: true },
    });

    const notebookContent = [
      ...notes.map((n) => `## ${n.title}\n${n.content}`),
      ...documents.filter((d) => d.content).map((d) => `[${d.filename}]\n${d.content}`),
    ].join('\n\n');

    // Dynamically import AI engine
    const { generateQuiz } = await import('@/lib/ai-engines/quiz-engine');

    // Generate quiz using AI
    const generated = await generateQuiz({
      scope,
      difficulty: quizDifficulty,
      questionCount: numQuestions,
      syllabusContext,
      notebookContent,
    });

    // Create Quiz + Questions in DB
    const quiz = await db.quiz.create({
      data: {
        notebookId: id,
        title: generated.title,
        scope,
        scopeRefId: scopeRefId || null,
        difficulty: quizDifficulty,
        questionCount: numQuestions,
        questions: {
          create: generated.questions.map((q, idx) => ({
            type: q.type,
            question: q.question,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty,
            order: idx,
            topicId: scope === 'topic' && scopeRefId ? scopeRefId : null,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json(quiz, { status: 201 });
  } catch (error) {
    console.error('Error generating quiz:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}