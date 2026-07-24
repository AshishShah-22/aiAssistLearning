'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore, useNotebookStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  PlayCircle,
  Sparkles,
  Loader2,
  Target,
  GraduationCap,
  FileText,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Unit, Topic, Progress as ProgressType, Difficulty } from '@/types';

const difficultyColors: Record<Difficulty, string> = {
  easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  hard: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === 'in_progress') return <PlayCircle className="h-4 w-4 text-amber-500" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

export function SyllabusPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const { notebook, units, setUnits, setCurrentUnit, setCurrentTopic } = useNotebookStore();
  const queryClient = useQueryClient();

  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showAnalyzeDialog, setShowAnalyzeDialog] = useState(false);
  const [syllabusText, setSyllabusText] = useState('');

  const { data: progressData, isLoading: progressLoading } = useQuery<{
    progressRecords: ProgressType[];
    topicProgress: { topicId: string; status: string; percentComplete: number; studyMinutes: number }[];
    overall: { percentComplete: number };
  }>({
    queryKey: ['progress', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/progress`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!notebookId,
  });
  const progressRecords = progressData?.progressRecords || [];

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/analyze-syllabus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syllabusText }),
      });
      if (!res.ok) throw new Error('Analysis failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress', notebookId] });
      fetch(`/api/notebooks/${notebookId}`)
        .then((r) => r.json())
        .then((nb) => { if (nb.units) setUnits(nb.units); })
        .catch(() => {});
      setShowAnalyzeDialog(false);
      setSyllabusText('');
      toast.success('Syllabus analyzed! Units and topics created.');
    },
    onError: () => toast.error('Failed to analyze syllabus'),
  });

  const updateTopicMutation = useMutation({
    mutationFn: async ({ topicId, status }: { topicId: string; status: string }) => {
      const res = await fetch(`/api/notebooks/${notebookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, topicStatus: status }),
      });
      if (!res.ok) throw new Error('Update failed');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.units) setUnits(data.units);
      queryClient.invalidateQueries({ queryKey: ['progress', notebookId] });
    },
    onError: () => toast.error('Failed to update topic'),
  });

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const getTopicProgress = (topicId: string) => {
    if (!topicId || !Array.isArray(progressRecords)) return undefined;
    return progressRecords.find((p) => p.targetId === topicId && p.targetType === 'topic');
  };

  const getUnitProgress = (unit: Unit) => {
    if (!unit?.topics) return 0;
    const topicProgresses = unit.topics.map((t) => getTopicProgress(t?.id));
    if (topicProgresses.length === 0) return 0;
    const avg = topicProgresses.reduce((sum, p) => sum + (p?.percentComplete || 0), 0) / topicProgresses.length;
    return Math.round(avg);
  };

  const safeUnits = units || [];

  const cycleTopicStatus = (topic: Topic) => {
    const nextStatus = topic.status === 'not_started' ? 'in_progress' : topic.status === 'in_progress' ? 'completed' : 'not_started';
    updateTopicMutation.mutate({ topicId: topic.id, status: nextStatus });
  };

  const getOverallProgress = () => {
    if (safeUnits.length === 0) return 0;
    const total = safeUnits.reduce((sum, u) => sum + getUnitProgress(u), 0);
    return Math.round(total / safeUnits.length);
  };

  const totalTopics = safeUnits.reduce((sum, u) => sum + (u.topics?.length || 0), 0);
  const completedTopics = safeUnits.reduce((sum, u) => sum + (u.topics?.filter((t) => t.status === 'completed').length || 0), 0);
  const inProgressTopics = safeUnits.reduce((sum, u) => sum + (u.topics?.filter((t) => t.status === 'in_progress').length || 0), 0);

  // No units yet
  if (!units || units.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <div className="rounded-full bg-muted p-4">
          <BookOpen className="size-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">No Syllabus Yet</h2>
          <p className="text-sm mt-1 text-muted-foreground max-w-xs">
            Paste your course syllabus and AI will break it down into units and topics.
          </p>
          <Button className="mt-4" onClick={() => setShowAnalyzeDialog(true)}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            Analyze Syllabus
          </Button>
        </div>
        <Dialog open={showAnalyzeDialog} onOpenChange={setShowAnalyzeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Analyze Syllabus</DialogTitle>
              <DialogDescription>Paste your course syllabus. AI will extract units and topics.</DialogDescription>
            </DialogHeader>
            <div>
              <Label>Syllabus Text</Label>
              <Textarea
                placeholder="Paste your syllabus here..."
                value={syllabusText}
                onChange={(e) => setSyllabusText(e.target.value)}
                className="mt-1 min-h-[200px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAnalyzeDialog(false)}>Cancel</Button>
              <Button onClick={() => analyzeMutation.mutate()} disabled={!syllabusText.trim() || analyzeMutation.isPending}>
                {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                Analyze
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Topics</p>
                <p className="text-sm font-semibold">{completedTopics}/{totalTopics}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">In Progress</p>
                <p className="text-sm font-semibold">{inProgressTopics}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-sm font-semibold">{getOverallProgress()}%</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Overall Progress</span>
            <span className="text-xs text-muted-foreground">{getOverallProgress()}%</span>
          </div>
          <Progress value={getOverallProgress()} className="h-2" />
        </div>

        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAnalyzeDialog(true)}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Re-analyze Syllabus
        </Button>

        <div className="space-y-2">
          {units.map((unit, unitIdx) => {
            const isExpanded = expandedUnits.has(unit.id) || units.length <= 3;
            const unitProgress = getUnitProgress(unit);
            const topics = unit.topics || [];

            return (
              <Collapsible key={unit.id} open={isExpanded} onOpenChange={() => toggleUnit(unit.id)}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-bold text-muted-foreground w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                          {unitIdx + 1}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <CardTitle className="text-sm truncate">{unit.title}</CardTitle>
                          {unit.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{unit.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-xs">{topics.length} topics</Badge>
                          <span className="text-xs text-muted-foreground w-8">{unitProgress}%</span>
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                      <Progress value={unitProgress} className="h-1 mt-2" />
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t">
                      {topics.map((topic, topicIdx) => {
                        const topicProg = getTopicProgress(topic.id);
                        const isActive = notebook?.currentTopicId === topic.id;
                        return (
                          <div
                            key={topic.id}
                            className={'flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/50' + (isActive ? ' bg-primary/5 border-l-2 border-l-primary' : '')}
                            onClick={() => { setSelectedTopic(topic); setCurrentUnit(unit); setCurrentTopic(topic); }}
                          >
                            <button className="mt-0.5 shrink-0" onClick={(e) => { e.stopPropagation(); cycleTopicStatus(topic); }}>
                              <StatusIcon status={topic.status} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{topicIdx + 1}.</span>
                                <p className="text-sm truncate">{topic.title}</p>
                              </div>
                              {topic.description && <p className="text-xs text-muted-foreground truncate mt-0.5 ml-5">{topic.description}</p>}
                              <div className="flex items-center gap-2 mt-1 ml-5">
                                <Badge className={difficultyColors[topic.difficulty] + ' border-0 text-[10px] px-1.5 py-0'}>{topic.difficulty}</Badge>
                                {topicProg && topicProg.percentComplete > 0 && <span className="text-[10px] text-muted-foreground">{topicProg.percentComplete}%</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {topics.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No topics in this unit</p>}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>

        <Dialog open={!!selectedTopic} onOpenChange={() => setSelectedTopic(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedTopic?.title}</DialogTitle>
              <DialogDescription>{selectedTopic?.description || 'No description'}</DialogDescription>
            </DialogHeader>
            {selectedTopic && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Difficulty</p>
                      <Badge className={difficultyColors[selectedTopic.difficulty] + ' border-0 text-xs mt-0.5'}>{selectedTopic.difficulty}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <StatusIcon status={selectedTopic.status} />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>
                      <p className="text-xs font-medium capitalize mt-0.5">{selectedTopic.status.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
                {(() => {
                  const tp = getTopicProgress(selectedTopic.id);
                  const apiTp = progressData?.topicProgress?.find((t) => t.topicId === selectedTopic.id);
                  const pct = apiTp?.percentComplete ?? tp?.percentComplete ?? 0;
                  const mins = apiTp?.studyMinutes ?? tp?.studyMinutes ?? 0;
                  if (pct === 0 && mins === 0) return null;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Topic Progress</span>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {mins}m studied
                      </div>
                    </div>
                  );
                })()}
                {selectedTopic.content && (
                  <div>
                    <p className="text-xs font-medium mb-1">Content</p>
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">{selectedTopic.content}</div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { cycleTopicStatus(selectedTopic); setSelectedTopic(null); }}>
                    {selectedTopic.status === 'completed' ? 'Mark In Progress' : 'Mark Complete'}
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => setSelectedTopic(null)}>Close</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showAnalyzeDialog} onOpenChange={setShowAnalyzeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Analyze Syllabus</DialogTitle>
              <DialogDescription>Paste your updated syllabus. AI will extract units and topics.</DialogDescription>
            </DialogHeader>
            <div>
              <Label>Syllabus Text</Label>
              <Textarea
                placeholder="Paste your updated syllabus here..."
                value={syllabusText}
                onChange={(e) => setSyllabusText(e.target.value)}
                className="mt-1 min-h-[200px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAnalyzeDialog(false)}>Cancel</Button>
              <Button onClick={() => analyzeMutation.mutate()} disabled={!syllabusText.trim() || analyzeMutation.isPending}>
                {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                Analyze
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
