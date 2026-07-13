'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Plus,
  Search,
  BarChart3,
  Trophy,
  TrendingUp,
  Sparkles,
  BookMarked,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores';
import NotebookCard from './NotebookCard';
import type { Notebook, DashboardStats } from '@/types';

const statCards = [
  {
    key: 'totalNotebooks' as const,
    label: 'Total Notebooks',
    icon: BookMarked,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    format: (v: number) => v.toString(),
  },
  {
    key: 'activeNotebooks' as const,
    label: 'Active Notebooks',
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    format: (v: number) => v.toString(),
  },
  {
    key: 'totalStudyMinutes' as const,
    label: 'Study Hours',
    icon: BarChart3,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    format: (v: number) => `${(v / 60).toFixed(1)}h`,
  },
  {
    key: 'avgQuizScore' as const,
    label: 'Avg Quiz Score',
    icon: Trophy,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/50',
    format: (v: number) => `${v}%`,
  },
];

export default function Dashboard() {
  const setView = useAppStore((s) => s.setView);
  const openNotebook = useAppStore((s) => s.openNotebook);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: notebooks, isLoading: notebooksLoading } = useQuery<Notebook[]>({
    queryKey: ['notebooks'],
    queryFn: () => fetch('/api/notebooks').then((r) => r.json()),
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => fetch('/api/stats').then((r) => r.json()),
  });

  const filteredNotebooks = useMemo(() => {
    if (!notebooks) return [];
    if (!searchQuery.trim()) return notebooks;
    const q = searchQuery.toLowerCase();
    return notebooks.filter((n) => n.name.toLowerCase().includes(q));
  }, [notebooks, searchQuery]);

  const handleCardClick = (id: string) => {
    openNotebook(id);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">StudyAI</h1>
            </div>

            <div className="flex-1 max-w-md hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search notebooks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-muted/40 border-0 focus-visible:bg-background focus-visible:border"
                />
              </div>
            </div>

            <div className="ml-auto">
              <Button onClick={() => setView('setup')} size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Notebook</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>

          <div className="sm:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search notebooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-muted/40 border-0 focus-visible:bg-background focus-visible:border"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const value = stats ? stats[stat.key] : null;
            return (
              <Card key={stat.key}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`shrink-0 w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div className="min-w-0">
                      {statsLoading || value === null ? (
                        <>
                          <Skeleton className="h-3 w-8 mb-1" />
                          <Skeleton className="h-5 w-14" />
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                          <p className="text-lg font-bold tracking-tight leading-tight">
                            {stat.format(value)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Notebooks */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Recent Notebooks</h2>
            {notebooks && notebooks.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {filteredNotebooks.length} of {notebooks.length}
              </span>
            )}
          </div>

          {notebooksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-8 h-8 rounded-lg" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredNotebooks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <BookOpen className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-base mb-1.5">
                  {searchQuery ? 'No notebooks found' : 'No notebooks yet'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  {searchQuery
                    ? 'No notebooks match "' + searchQuery + '". Try a different search term.'
                    : 'Create your first notebook to get started. Upload a syllabus and let AI organize your study plan.'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setView('setup')} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create Your First Notebook
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotebooks.map((notebook) => (
                <NotebookCard
                  key={notebook.id}
                  notebook={notebook}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}