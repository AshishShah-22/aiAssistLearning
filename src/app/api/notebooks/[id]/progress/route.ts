import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get all progress records for this notebook
    const progressRecords = await db.progress.findMany({
      where: { notebookId: id },
    });

    // Get units with topics for computing progress
    const units = await db.unit.findMany({
      where: { notebookId: id },
      include: {
        topics: true,
      },
      orderBy: { order: 'asc' },
    });

    // Get study sessions for study minutes
    const studySessions = await db.studySession.findMany({
      where: { notebookId: id },
      select: { duration: true, topicId: true },
    });

    // Get quiz attempts for computing quiz stats
    const quizAttempts = await db.quizAttempt.findMany({
      where: { quiz: { notebookId: id } },
      select: { score: true, totalQuestions: true },
    });

    const totalStudyMinutes = Math.round(
      studySessions.reduce((sum, s) => sum + s.duration, 0) / 60
    );

    // Compute per-unit progress
    const unitProgress = units.map((unit) => {
      const topicCount = unit.topics.length;
      const completedTopics = unit.topics.filter(
        (t) => t.status === 'completed'
      ).length;

      const unitPercentComplete =
        topicCount > 0 ? (completedTopics / topicCount) * 100 : 0;

      // Unit study minutes
      const topicIds = unit.topics.map((t) => t.id);
      const unitStudySeconds = studySessions
        .filter((s) => s.topicId && topicIds.includes(s.topicId))
        .reduce((sum, s) => sum + s.duration, 0);

      // Find or create progress record for this unit
      const existingProgress = progressRecords.find(
        (p) => p.targetId === unit.id && p.targetType === 'unit'
      );

      return {
        unitId: unit.id,
        unitTitle: unit.title,
        status: unit.status,
        percentComplete: Math.round(unitPercentComplete),
        topicCount,
        completedTopics,
        studyMinutes: Math.round(unitStudySeconds / 60),
        progressRecord: existingProgress || null,
      };
    });

    // Compute per-topic progress
    const topicProgress = units.flatMap((unit) =>
      unit.topics.map((topic) => {
        const existingProgress = progressRecords.find(
          (p) => p.targetId === topic.id && p.targetType === 'topic'
        );

        const topicStudySeconds = studySessions
          .filter((s) => s.topicId === topic.id)
          .reduce((sum, s) => sum + s.duration, 0);

        return {
          topicId: topic.id,
          unitId: unit.id,
          topicTitle: topic.title,
          status: topic.status,
          difficulty: topic.difficulty,
          percentComplete: topic.status === 'completed' ? 100 : topic.status === 'in_progress' ? 50 : 0,
          studyMinutes: Math.round(topicStudySeconds / 60),
          progressRecord: existingProgress || null,
        };
      })
    );

    // Compute overall progress
    const totalTopics = units.reduce((sum, u) => sum + u.topics.length, 0);
    const totalCompletedTopics = units.reduce(
      (sum, u) => sum + u.topics.filter((t) => t.status === 'completed').length,
      0
    );
    const overallPercentComplete =
      totalTopics > 0 ? (totalCompletedTopics / totalTopics) * 100 : 0;

    const avgQuizScore =
      quizAttempts.length > 0
        ? Math.round(
            quizAttempts.reduce((sum, a) => sum + a.score, 0) / quizAttempts.length
          )
        : 0;

    return NextResponse.json({
      progressRecords,
      unitProgress,
      topicProgress,
      overall: {
        percentComplete: Math.round(overallPercentComplete),
        totalUnits: units.length,
        completedUnits: units.filter((u) => u.status === 'completed').length,
        totalTopics,
        completedTopics: totalCompletedTopics,
        totalStudyMinutes,
        totalQuizzesTaken: quizAttempts.length,
        avgQuizScore,
      },
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}