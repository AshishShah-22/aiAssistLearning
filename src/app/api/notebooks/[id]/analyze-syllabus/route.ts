import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { syllabusText } = body;

    if (!syllabusText || typeof syllabusText !== 'string' || syllabusText.trim().length === 0) {
      return NextResponse.json(
        { error: 'syllabusText is required' },
        { status: 400 }
      );
    }

    const notebook = await db.notebook.findUnique({ where: { id } });
    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    // Dynamically import AI engine to avoid bundling z-ai-web-dev-sdk at compile time
    const { analyzeSyllabus } = await import('@/lib/ai-engines/syllabus-engine');

    // Call AI to analyze the syllabus
    const analysis = await analyzeSyllabus(syllabusText.trim());

    // Create Units and Topics in the database
    const createdUnits = [];
    for (let uIdx = 0; uIdx < analysis.units.length; uIdx++) {
      const unitData = analysis.units[uIdx];
      const unit = await db.unit.create({
        data: {
          notebookId: id,
          title: unitData.title,
          description: unitData.description,
          order: uIdx,
          status: 'not_started',
        },
      });

      const createdTopics = [];
      for (let tIdx = 0; tIdx < unitData.topics.length; tIdx++) {
        const topicData = unitData.topics[tIdx];
        const topic = await db.topic.create({
          data: {
            unitId: unit.id,
            title: topicData.title,
            description: topicData.description,
            difficulty: topicData.difficulty,
            order: tIdx,
            status: 'not_started',
          },
        });
        createdTopics.push(topic);
      }

      createdUnits.push({ ...unit, topics: createdTopics });
    }

    // Update notebook status to active
    const updatedNotebook = await db.notebook.update({
      where: { id },
      data: { status: 'active' },
    });

    return NextResponse.json({
      notebook: updatedNotebook,
      units: createdUnits,
      analysis: {
        estimatedDuration: analysis.estimatedDuration,
        difficulty: analysis.difficulty,
      },
    });
  } catch (error) {
    console.error('Error analyzing syllabus:', error);
    return NextResponse.json(
      { error: 'Failed to analyze syllabus' },
      { status: 500 }
    );
  }
}