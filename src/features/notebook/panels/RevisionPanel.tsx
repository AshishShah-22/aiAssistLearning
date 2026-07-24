'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore, useNotebookStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  CalendarCheck,
  AlertTriangle,
  History,
  Play,
  Clock,
  Target,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FlashcardDeck, Flashcard, StudySession, Progress as ProgressType } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface RevisionTopic {
  id: string;
  title: string;
  unitTitle?: string;
  reason: string;
  dueDate?: string;
  score?: number;
}

export default function RevisionPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const { units } = useNotebookStore();
  const queryClient = useQueryClient();

  const { data: progressData, isLoading: progressLoading } = useQuery<{
    progressRecords: ProgressType[];
    topicProgress: { topicId: string; status: string; percentComplete: number; studyMinutes: number }[];
    unitProgress: { unitId: string; percentComplete: number }[];
    overall: { percentComplete: number; totalStudyMinutes: number; avgQuizScore: number; totalQuizzesTaken: number };
  }>({
    queryKey: ['progress', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/progress`);
      if (!res.ok) throw new Error('Failed to fetch progress');
      return res.json();
    },
    enabled: !!notebookId,
  });
  const progress = progressData?.progressRecords || [];

  const { data: sessions, isLoading: sessionsLoading } = useQuery<StudySession[]>({
    queryKey: ['sessions', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/sessions`);
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    },
    enabled: !!notebookId,
  });

  const { data: decks, isLoading: decksLoading } = useQuery<FlashcardDeck[]>({
    queryKey: ['flashcards', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/flashcards`);
      if (!res.ok) throw new Error('Failed to fetch decks');
      return res.json();
    },
    enabled: !!notebookId,
  });

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityType: 'revision', duration: 0 }),
      });
      if (!res.ok) throw new Error('Failed to start session');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', notebookId] });
      toast.success('Revision session started! Focus on your weak areas.');
    },
    onError: () => toast.error('Failed to start session'),
  });

  // Compute topics due for revision (nextReviewAt <= now)
  const dueTopics: RevisionTopic[] = [];
  const weakTopics: RevisionTopic[] = [];

  // From progress data - find topics with low quiz scores
  if (progress) {
    progress.forEach((p) => {
      if (p.targetType === 'topic') {
        const allTopics = units.flatMap((u) => (u.topics || []).map((t) => ({ ...t, unitTitle: u.title })));
        const topic = allTopics.find((t) => t.id === p.targetId);
        if (topic && p.avgQuizScore < 60 && p.quizzesTaken > 0) {
          weakTopics.push({
            id: topic.id,
            title: topic.title,
            unitTitle: topic.unitTitle,
            reason: `Avg score: ${Math.round(p.avgQuizScore)}%`,
            score: p.avgQuizScore,
          });
        }
      }
    });
  }

  // From flashcard data - find cards due for review
  if (decks) {
    const now = new Date();
    decks.forEach((deck) => {
      // We don't have cards in the list, so we can only show the deck title
      // This is a simplified approach - in production we'd fetch cards
      const allTopics = units.flatMap((u) => (u.topics || []).map((t) => ({ ...t, unitTitle: u.title })));
      if (deck.topicId) {
        const topic = allTopics.find((t) => t.id === deck.topicId);
        if (topic) {
          // Check if any cards might be due (simple heuristic based on deck age)
          const deckAge = now.getTime() - new Date(deck.updatedAt).getTime();
          const dayMs = 24 * 60 * 60 * 1000;
          if (deckAge > dayMs) {
            // Avoid duplicates with weak topics
            if (!dueTopics.find((d) => d.id === topic.id) && !weakTopics.find((w) => w.id === topic.id)) {
              dueTopics.push({
                id: topic.id,
                title: topic.title,
                unitTitle: topic.unitTitle,
                reason: 'Flashcards due for review',
                dueDate: new Date(deck.updatedAt).toISOString(),
              });
            }
          }
        }
      }
    });
  }

  // Also add in-progress topics that haven't been studied recently
  if (progress) {
    const now = new Date();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const allTopics = units.flatMap((u) => (u.topics || []).map((t) => ({ ...t, unitTitle: u.title })));
    progress.forEach((p) => {
      if (p.targetType === 'topic' && p.percentComplete < 100) {
        const topic = allTopics.find((t) => t.id === p.targetId);
        if (topic) {
          const lastActivity = p.lastActivityAt ? new Date(p.lastActivityAt) : null;
          const isStale = !lastActivity || (now.getTime() - lastActivity.getTime() > weekMs);
          if (isStale && !dueTopics.find((d) => d.id === topic.id) && !weakTopics.find((w) => w.id === topic.id)) {
            dueTopics.push({
              id: topic.id,
              title: topic.title,
              unitTitle: topic.unitTitle,
              reason: lastActivity
                ? `Last studied ${formatDistanceToNow(lastActivity, { addSuffix: true })}`
                : 'Not yet studied',
            });
          }
        }
      }
    });
  }

  // Revision sessions
  const revisionSessions = (sessions || [])
    .filter((s) => s.activityType === 'revision')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const isLoading = progressLoading || sessionsLoading || decksLoading;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Start Revision Button */}
        <Button
          className="w-full"
          onClick={() => startSessionMutation.mutate()}
          disabled={startSessionMutation.isPending}
        >
          {startSessionMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <Play className="h-4 w-4 mr-1.5" />
          )}
          Start Revision Session
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-3 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Today's Revision */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-emerald-500" />
                  Due for Revision
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dueTopics.length > 0 ? (
                  <div className="space-y-2">
                    {dueTopics.map((topic) => (
                      <div
                        key={topic.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{topic.title}</p>
                          {topic.unitTitle && (
                            <p className="text-xs text-muted-foreground">{topic.unitTitle}</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground ml-2 shrink-0">{topic.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No topics due for revision. Great job! 🎉
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Weak Concepts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Weak Concepts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {weakTopics.length > 0 ? (
                  <div className="space-y-2">
                    {weakTopics
                      .sort((a, b) => (a.score ?? 100) - (b.score ?? 100))
                      .map((topic) => (
                        <div
                          key={topic.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{topic.title}</p>
                            {topic.unitTitle && (
                              <p className="text-xs text-muted-foreground">{topic.unitTitle}</p>
                            )}
                          </div>
                          <Badge
                            variant="secondary"
                            className="bg-rose-100 text-rose-700 border-0 text-xs ml-2 shrink-0"
                          >
                            {topic.score !== undefined ? `${Math.round(topic.score)}%` : 'Low'}
                          </Badge>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No weak concepts identified yet. Keep practicing!
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Revision History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Recent Revision Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {revisionSessions.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {revisionSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm">Revision Session</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        {session.duration > 0 && (
                          <Badge variant="outline" className="text-xs shrink-0 gap-1">
                            <Clock className="h-3 w-3" />
                            {session.duration}m
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No revision sessions yet
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ScrollArea>
  );
}