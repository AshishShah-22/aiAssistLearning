'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore, useNotebookStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  BarChart3,
  Target,
  TrendingUp,
  BookOpen,
  Layers,
  CalendarDays,
  Activity,
} from 'lucide-react';

interface WeeklyDay {
  day: string;
  minutes: number;
}

interface TopicProgressItem {
  topicId: string;
  unitId: string;
  topicTitle: string;
  status: string;
  difficulty: string;
  percentComplete: number;
  studyMinutes: number;
}

export default function AnalyticsPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const notebook = useNotebookStore((s) => s.notebook);
  const units = useNotebookStore((s) => s.units);

  const { data: progress, isLoading } = useQuery({
    queryKey: ['progress', notebookId],
    queryFn: () => fetch(`/api/notebooks/${notebookId}/progress`).then((r) => r.json()),
    enabled: !!notebookId,
  });

  const { data: weeklyData } = useQuery({
    queryKey: ['weekly-sessions', notebookId],
    queryFn: () =>
      fetch(`/api/notebooks/${notebookId}/sessions/weekly`).then((r) => r.json()),
    enabled: !!notebookId,
  });

  const overallProgress = useMemo(() => {
    if (!progress) return 0;
    return progress.overall?.percentComplete ?? 0;
  }, [progress]);

  const totalStudyMinutes = useMemo(() => {
    if (!progress) return 0;
    return progress.overall?.totalStudyMinutes ?? 0;
  }, [progress]);

  const avgQuizScore = useMemo(() => {
    if (!progress) return 0;
    return progress.overall?.avgQuizScore ?? 0;
  }, [progress]);

  const totalTopics = useMemo(() => {
    return units.reduce((acc, u) => acc + (u.topics?.length ?? 0), 0);
  }, [units]);

  const weeklyDays: WeeklyDay[] = useMemo(() => {
    return weeklyData?.days ?? [
      { day: 'Mon', minutes: 0 },
      { day: 'Tue', minutes: 0 },
      { day: 'Wed', minutes: 0 },
      { day: 'Thu', minutes: 0 },
      { day: 'Fri', minutes: 0 },
      { day: 'Sat', minutes: 0 },
      { day: 'Sun', minutes: 0 },
    ];
  }, [weeklyData]);

  const maxWeeklyMinutes = useMemo(() => {
    return Math.max(...weeklyDays.map((d) => d.minutes), 1);
  }, [weeklyDays]);

  const totalWeeklyMinutes = useMemo(() => {
    return weeklyDays.reduce((sum, d) => sum + d.minutes, 0);
  }, [weeklyDays]);

  const topicProgressData: TopicProgressItem[] = useMemo(() => {
    if (!progress?.topicProgress) return [];
    return progress.topicProgress;
  }, [progress]);

  const notebookColor = notebook?.color ?? '#10b981';

  const formatStudyTime = (minutes: number) => {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${minutes}m`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400';
      case 'hard':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400';
      default:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full p-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Track your study progress and performance
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: `${notebookColor}15`,
                  }}
                >
                  <Target
                    className="w-4 h-4"
                    style={{ color: notebookColor }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  Overall Progress
                </span>
              </div>
              <p className="text-2xl font-bold">
                {Math.round(overallProgress)}%
              </p>
              <Progress value={overallProgress} className="mt-2 h-1.5" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <span className="text-xs text-muted-foreground">
                  Study Time
                </span>
              </div>
              <p className="text-2xl font-bold">
                {formatStudyTime(totalStudyMinutes)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Total time invested
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs text-muted-foreground">Quiz Avg</span>
              </div>
              <p className="text-2xl font-bold">{avgQuizScore}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Average quiz score
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <span className="text-xs text-muted-foreground">Topics</span>
              </div>
              <p className="text-2xl font-bold">{totalTopics}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Across {units.length} units
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Unit Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Unit Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {units.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No units yet
              </p>
            ) : (
              units.map((unit) => {
                const unitProg = progress?.unitProgress?.find(
                  (up: { unitId: string; percentComplete: number }) => up.unitId === unit.id
                );
                const pct = unitProg?.percentComplete ?? 0;
                return (
                  <div key={unit.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[70%]">
                        {unit.title}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: notebookColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Weekly Activity — Real Data */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Weekly Activity
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {formatStudyTime(totalWeeklyMinutes)} this week
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {totalWeeklyMinutes === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${notebookColor}15` }}
                >
                  <Activity
                    className="w-6 h-6"
                    style={{ color: notebookColor }}
                  />
                </div>
                <p className="text-sm font-medium">No activity this week</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start studying to see your weekly activity
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2 h-36">
                  {weeklyDays.map((d, i) => {
                    const heightPct =
                      maxWeeklyMinutes > 0
                        ? Math.max((d.minutes / maxWeeklyMinutes) * 100, 4)
                        : 4;
                    return (
                      <div
                        key={d.day}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        {d.minutes > 0 && (
                          <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                            {d.minutes}m
                          </span>
                        )}
                        {d.minutes === 0 && <span className="text-[10px] h-3" />}
                        <div
                          className="w-full relative rounded-t-md transition-all duration-500"
                          style={{ height: '96px' }}
                        >
                          <div
                            className="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor: notebookColor,
                              opacity:
                                d.minutes > 0
                                  ? 0.7 + (d.minutes / maxWeeklyMinutes) * 0.3
                                  : 0.2,
                            }}
                          />
                        </div>
                        <span
                          className={`text-[10px] ${i === new Date().getDay() === 0 ? 6 : new Date().getDay() - 1 === i ? 'font-bold' : ''} ${
                            i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)
                              ? ''
                              : 'text-muted-foreground'
                          }`}
                          style={
                            i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)
                              ? { color: notebookColor }
                              : undefined
                          }
                        >
                          {d.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Study minutes per day
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Per-Topic Breakdown */}
        {topicProgressData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Per-Topic Breakdown
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {topicProgressData.length} topics
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {topicProgressData.map((topic) => {
                  // Find which unit this topic belongs to
                  const parentUnit = units.find(
                    (u) => u.id === topic.unitId
                  );
                  return (
                    <div
                      key={topic.topicId}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {/* Progress ring indicator */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: `${notebookColor}15`,
                          color: notebookColor,
                        }}
                      >
                        {Math.round(topic.percentComplete)}%
                      </div>

                      {/* Topic info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {topic.topicTitle}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${getDifficultyColor(topic.difficulty)}`}
                          >
                            {topic.difficulty}
                          </Badge>
                        </div>
                        {parentUnit && (
                          <p className="text-xs text-muted-foreground truncate">
                            {parentUnit.title}
                          </p>
                        )}
                        {/* Mini progress bar */}
                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted mt-1.5">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${topic.percentComplete}%`,
                              backgroundColor: notebookColor,
                            }}
                          />
                        </div>
                      </div>

                      {/* Study time */}
                      {topic.studyMinutes > 0 && (
                        <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatStudyTime(topic.studyMinutes)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
