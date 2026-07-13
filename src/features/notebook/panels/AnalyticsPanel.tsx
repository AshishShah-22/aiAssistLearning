'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore, useNotebookStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Clock, BarChart3, Target, TrendingUp, BookOpen } from 'lucide-react';

export default function AnalyticsPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const notebook = useNotebookStore((s) => s.notebook);
  const units = useNotebookStore((s) => s.units);

  const { data: progress, isLoading } = useQuery({
    queryKey: ['progress', notebookId],
    queryFn: () => fetch(`/api/notebooks/${notebookId}/progress`).then((r) => r.json()),
    enabled: !!notebookId,
  });

  const overallProgress = useMemo(() => {
    if (!progress) return 0;
    return progress.overall?.percentComplete ?? 0;
  }, [progress]);

  const totalStudyMinutes = useMemo(() => {
    if (!progress) return 0;
    return progress.overall?.studyMinutes ?? 0;
  }, [progress]);

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
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">Track your study progress and performance</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                  <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs text-muted-foreground">Overall Progress</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(overallProgress)}%</p>
              <Progress value={overallProgress} className="mt-2 h-1.5" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <span className="text-xs text-muted-foreground">Study Time</span>
              </div>
              <p className="text-2xl font-bold">{totalStudyMinutes > 60 ? `${(totalStudyMinutes / 60).toFixed(1)}h` : `${totalStudyMinutes}m`}</p>
              <p className="text-xs text-muted-foreground mt-1">Total time invested</p>
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
              <p className="text-2xl font-bold">{progress?.overall?.avgQuizScore?.toFixed(0) ?? 0}%</p>
              <p className="text-xs text-muted-foreground mt-1">Average quiz score</p>
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
              <p className="text-2xl font-bold">
                {units.reduce((acc, u) => acc + (u.topics?.length ?? 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Across {units.length} units</p>
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
              <p className="text-sm text-muted-foreground text-center py-4">No units yet</p>
            ) : (
              units.map((unit) => {
                const unitProgress = progress?.byUnit?.[unit.id];
                const pct = unitProgress?.percentComplete ?? 0;
                return (
                  <div key={unit.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[70%]">{unit.title}</span>
                      <span className="text-muted-foreground text-xs">{Math.round(pct)}%</span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: notebook?.color ?? '#10b981',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Study Activity (Simple CSS bar chart) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Weekly Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                // Placeholder data — would come from API
                const height = [40, 65, 30, 80, 50, 20, 10][i];
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full relative" style={{ height: '100px' }}>
                      <div
                        className="absolute bottom-0 w-full rounded-t-sm transition-all duration-500"
                        style={{
                          height: `${height}%`,
                          backgroundColor: notebook?.color ?? '#10b981',
                          opacity: 0.7 + (height / 100) * 0.3,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{day}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">Study minutes per day</p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}