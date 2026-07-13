'use client';

import { BookOpen, Clock, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { Notebook } from '@/types';

interface NotebookCardProps {
  notebook: Notebook;
  onClick: (id: string) => void;
  index?: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  setup: {
    label: 'Setup',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  active: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  completed: {
    label: 'Completed',
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  },
  archived: {
    label: 'Archived',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

export default function NotebookCard({ notebook, onClick, index = 0 }: NotebookCardProps) {
  const status = statusConfig[notebook.status] || statusConfig.setup;
  const progress = notebook.status === 'completed' ? 100 : notebook.status === 'setup' ? 0 : 0;
  const unitCount = notebook._count?.units ?? 0;
  const lastOpened = notebook.lastOpenedAt
    ? formatDistanceToNow(new Date(notebook.lastOpenedAt), { addSuffix: true })
    : 'Never opened';

  return (
    <div className="h-full">
      <Card
        className={cn(
          'group relative cursor-pointer border-l-4 transition-shadow duration-200 hover:shadow-md',
          'py-0 gap-0 overflow-hidden'
        )}
        style={{ borderLeftColor: notebook.color }}
        onClick={() => onClick(notebook.id)}
      >
        {/* Color accent bar top */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ backgroundColor: notebook.color }}
        />

        <CardContent className="p-4 flex flex-col gap-3">
          {/* Header: Name + Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${notebook.color}18` }}
              >
                <BookOpen className="w-4 h-4" style={{ color: notebook.color }} />
              </div>
              <h3 className="font-semibold text-sm truncate leading-tight">
                {notebook.name}
              </h3>
            </div>
            <Badge
              variant="secondary"
              className={cn('text-[10px] px-1.5 py-0 shrink-0 border-0', status.className)}
            >
              {status.label}
            </Badge>
          </div>

          {/* Description (truncated) */}
          {notebook.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {notebook.description}
            </p>
          )}

          {/* Progress */}
          {notebook.status !== 'setup' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium" style={{ color: notebook.color }}>
                  {progress}%
                </span>
              </div>
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: notebook.color,
                  }}
                />
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {unitCount} {unitCount === 1 ? 'unit' : 'units'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastOpened}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}