'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore, useNotebookStore } from '@/stores';

interface ProgressData {
  overall: {
    percentComplete: number;
    totalUnits: number;
    completedUnits: number;
    totalTopics: number;
    completedTopics: number;
    totalStudyMinutes: number;
    totalQuizzesTaken: number;
    avgQuizScore: number;
  };
  unitProgress: Array<{
    unitId: string;
    unitTitle: string;
    status: string;
    percentComplete: number;
  }>;
}

export function NotebookHeader() {
  const currentNotebookId = useAppStore((s) => s.currentNotebookId);
  const notebook = useNotebookStore((s) => s.notebook);
  const units = useNotebookStore((s) => s.units);
  const goToDashboard = useAppStore((s) => s.goToDashboard);

  const { data: progressData, isLoading: progressLoading } = useQuery<ProgressData>({
    queryKey: ['notebook-progress', currentNotebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${currentNotebookId}/progress`);
      if (!res.ok) throw new Error('Failed to fetch progress');
      return res.json();
    },
    enabled: !!currentNotebookId,
  });

  // Find current unit progress
  const currentUnitId = notebook?.currentUnitId;
  const currentUnitProgress = progressData?.unitProgress?.find(
    (u) => u.unitId === currentUnitId
  );
  const currentUnitTitle =
    units.find((u) => u.id === currentUnitId)?.title ??
    currentUnitProgress?.unitTitle ??
    null;

  const overallPercent = progressData?.overall?.percentComplete ?? 0;
  const unitPercent = currentUnitProgress?.percentComplete ?? 0;

  return (
    <header className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3 px-4 h-14">
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={goToDashboard}
          className="shrink-0"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="size-4" />
        </Button>

        {/* Notebook name */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {notebook ? (
            <h1 className="text-sm font-semibold truncate">{notebook.name}</h1>
          ) : (
            <Skeleton className="h-5 w-40" />
          )}
        </div>

        {/* Right side - study time */}
        {progressData && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <span>{progressData.overall.totalStudyMinutes} min studied</span>
          </div>
        )}
      </div>

      {/* Progress bars */}
      <div className="px-4 pb-2 space-y-1.5">
        {progressLoading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-1 w-2/3" />
          </div>
        ) : (
          <>
            {/* Overall progress */}
            <div className="flex items-center gap-2">
              <Progress
                value={overallPercent}
                className="h-1.5 flex-1"
              />
              <span className="text-[11px] text-muted-foreground font-medium w-8 text-right tabular-nums">
                {overallPercent}%
              </span>
            </div>

            {/* Current unit progress */}
            {currentUnitTitle && (
              <div className="flex items-center gap-2">
                <Progress
                  value={unitPercent}
                  className="h-1 flex-1"
                />
                <span className="text-[10px] text-muted-foreground/70 w-8 text-right truncate tabular-nums">
                  {unitPercent}%
                </span>
              </div>
            )}
            {currentUnitTitle && (
              <p className="text-[10px] text-muted-foreground/60 truncate">
                {currentUnitTitle}
              </p>
            )}
          </>
        )}
      </div>
    </header>
  );
}