'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore, useNotebookStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Trophy,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Quiz, Question, QuizAttempt, TopicScope, Difficulty, Topic, Unit } from '@/types';

const difficultyColors: Record<Difficulty, string> = {
  easy: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-rose-100 text-rose-700',
};

interface QuizWithMeta extends Quiz {
  _count?: { attempts: number; questions: number };
  attempts?: QuizAttempt[];
}

export default function QuizPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const { units } = useNotebookStore();
  const queryClient = useQueryClient();
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [genScope, setGenScope] = useState<TopicScope>('topic');
  const [genScopeRefId, setGenScopeRefId] = useState<string>('');
  const [genDifficulty, setGenDifficulty] = useState<Difficulty>('medium');
  const [genCount, setGenCount] = useState(5);
  const [genLoading, setGenLoading] = useState(false);

  // Quiz taking state
  const [activeQuiz, setActiveQuiz] = useState<QuizWithMeta | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attemptResult, setAttemptResult] = useState<QuizAttempt | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  const allTopics: Topic[] = units.flatMap((u) => u.topics || []);

  const { data: quizzes, isLoading } = useQuery<QuizWithMeta[]>({
    queryKey: ['quizzes', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/quizzes`);
      if (!res.ok) throw new Error('Failed to fetch quizzes');
      return res.json();
    },
    enabled: !!notebookId,
  });

  const handleGenerate = async () => {
    setGenLoading(true);
    try {
      const body: Record<string, unknown> = {
        scope: genScope,
        difficulty: genDifficulty,
        questionCount: genCount,
      };
      if (genScopeRefId) body.scopeRefId = genScopeRefId;

      const res = await fetch(`/api/notebooks/${notebookId}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to generate quiz');
      const quiz = await res.json();
      queryClient.invalidateQueries({ queryKey: ['quizzes', notebookId] });
      setShowGenDialog(false);
      toast.success('Quiz generated!');
      handleStartQuiz(quiz);
    } catch {
      toast.error('Failed to generate quiz');
    } finally {
      setGenLoading(false);
    }
  };

  const handleStartQuiz = async (quiz: QuizWithMeta) => {
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/quizzes/${quiz.id}`);
      if (!res.ok) throw new Error('Failed to load quiz');
      const data = await res.json();
      const questions: Question[] = data.questions || [];
      setActiveQuiz(quiz);
      setActiveQuestions(questions.sort((a: Question, b: Question) => a.order - b.order));
      setCurrentQIndex(0);
      setAnswers({});
      setShowResults(false);
      setAttemptResult(null);
      setStartTime(Date.now());
    } catch {
      toast.error('Failed to load quiz questions');
    }
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/quizzes/${activeQuiz.id}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          timeSpent: Math.round((Date.now() - startTime) / 1000),
        }),
      });
      if (!res.ok) throw new Error('Submit failed');
      const attempt = await res.json();
      setAttemptResult(attempt);
      setShowResults(true);
      queryClient.invalidateQueries({ queryKey: ['quizzes', notebookId] });
      toast.success('Quiz submitted!');
    } catch {
      toast.error('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuestion = activeQuestions[currentQIndex];
  const parsedOptions = currentQuestion?.options
    ? JSON.parse(currentQuestion.options as string)
    : null;

  const getScoreDisplay = (quiz: QuizWithMeta) => {
    const best = quiz.attempts?.sort((a, b) => b.score - a.score)[0];
    if (!best) return null;
    const pct = Math.round((best.score / best.totalQuestions) * 100);
    return (
      <Badge
        className={
          pct >= 70
            ? 'bg-emerald-100 text-emerald-700 border-0'
            : pct >= 40
              ? 'bg-amber-100 text-amber-700 border-0'
              : 'bg-rose-100 text-rose-700 border-0'
        }
      >
        {pct}%
      </Badge>
    );
  };

  // Quiz Taking View
  if (activeQuiz) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveQuiz(null);
                setActiveQuestions([]);
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Quizzes
            </Button>
            <Badge variant="outline" className="text-xs">
              {currentQIndex + 1} / {activeQuestions.length}
            </Badge>
          </div>

          {showResults && attemptResult ? (
            /* Results View */
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-3 text-amber-500" />
                  <h3 className="text-lg font-semibold">Quiz Complete!</h3>
                  <div className="mt-4">
                    <div className="text-3xl font-bold">
                      {Math.round((attemptResult.score / attemptResult.totalQuestions) * 100)}%
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {attemptResult.score} / {attemptResult.totalQuestions} correct
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {attemptResult.timeSpent}s
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Per-question review */}
              {activeQuestions.map((q, idx) => {
                const userAnswer = answers[q.id] || '';
                const isCorrect = userAnswer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
                return (
                  <Card key={q.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{idx + 1}. {q.question}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Your answer: <span className="font-medium">{userAnswer || '(skipped)'}</span>
                          </p>
                          {!isCorrect && (
                            <p className="text-xs text-emerald-600 mt-0.5">
                              Correct: <span className="font-medium">{q.correctAnswer}</span>
                            </p>
                          )}
                          {q.explanation && (
                            <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded p-2">
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Button
                className="w-full"
                onClick={() => {
                  setActiveQuiz(null);
                  setActiveQuestions([]);
                }}
              >
                Done
              </Button>
            </div>
          ) : currentQuestion ? (
            /* Question View */
            <div className="space-y-4">
              <Progress
                value={((currentQIndex + 1) / activeQuestions.length) * 100}
                className="h-1.5"
              />

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Badge className={`${difficultyColors[currentQuestion.difficulty]} border-0 text-xs`}>
                      {currentQuestion.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {currentQuestion.type === 'mcq' ? 'Multiple Choice' :
                        currentQuestion.type === 'true_false' ? 'True / False' :
                          currentQuestion.type === 'short_answer' ? 'Short Answer' : 'Long Answer'}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm mt-2">
                    {currentQIndex + 1}. {currentQuestion.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentQuestion.type === 'mcq' && parsedOptions ? (
                    <RadioGroup
                      value={answers[currentQuestion.id] || ''}
                      onValueChange={(val) =>
                        setAnswers((prev) => ({ ...prev, [currentQuestion.id]: val }))
                      }
                      className="space-y-2"
                    >
                      {parsedOptions.map((opt: string, i: number) => (
                        <label
                          key={i}
                          className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <RadioGroupItem value={String.fromCharCode(65 + i)} id={`opt-${i}`} />
                          <span className="text-sm">{opt}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  ) : currentQuestion.type === 'true_false' ? (
                    <div className="flex gap-3">
                      <Button
                        variant={answers[currentQuestion.id] === 'True' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [currentQuestion.id]: 'True' }))
                        }
                      >
                        True
                      </Button>
                      <Button
                        variant={answers[currentQuestion.id] === 'False' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [currentQuestion.id]: 'False' }))
                        }
                      >
                        False
                      </Button>
                    </div>
                  ) : (
                    <Input
                      placeholder={currentQuestion.type === 'short_answer' ? 'Type your answer...' : 'Write a detailed answer...'}
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
                      }
                      multiline={currentQuestion.type === 'long_answer'}
                      className="min-h-[80px]"
                    />
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQIndex((prev) => prev - 1)}
                  disabled={currentQIndex === 0}
                  className="flex-1"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                {currentQIndex < activeQuestions.length - 1 ? (
                  <Button
                    onClick={() => setCurrentQIndex((prev) => prev + 1)}
                    className="flex-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmitQuiz}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    )}
                    Submit Quiz
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Loading questions...</p>
            </div>
          )}
        </div>
      </ScrollArea>
    );
  }

  // Quiz List View
  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-4">
        <Button
          onClick={() => setShowGenDialog(true)}
          className="w-full"
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          Generate Quiz
        </Button>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : quizzes && quizzes.length > 0 ? (
          <div className="space-y-2">
            {quizzes.map((quiz) => (
              <Card
                key={quiz.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleStartQuiz(quiz)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium truncate flex-1">{quiz.title}</h4>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <Badge className={`${difficultyColors[quiz.difficulty]} border-0 text-xs`}>
                        {quiz.difficulty}
                      </Badge>
                      {getScoreDisplay(quiz)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" />
                      {quiz.questionCount} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3 w-3" />
                      {quiz._count?.attempts || 0} attempts
                    </span>
                    <span>{new Date(quiz.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <HelpCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">No quizzes yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Generate a quiz to test your knowledge
            </p>
          </div>
        )}

        {/* Generate Dialog */}
        <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Quiz</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Scope</Label>
                <Select value={genScope} onValueChange={(v) => setGenScope(v as TopicScope)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="topic">Specific Topic</SelectItem>
                    <SelectItem value="unit">Entire Unit</SelectItem>
                    <SelectItem value="syllabus">Full Syllabus</SelectItem>
                    <SelectItem value="weak_areas">Weak Areas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(genScope === 'topic' || genScope === 'unit') && (
                <div>
                  <Label>{genScope === 'topic' ? 'Topic' : 'Unit'}</Label>
                  <Select value={genScopeRefId} onValueChange={setGenScopeRefId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={`Select ${genScope}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {genScope === 'topic'
                        ? allTopics.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                          ))
                        : units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Difficulty</Label>
                <Select value={genDifficulty} onValueChange={(v) => setGenDifficulty(v as Difficulty)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Number of Questions</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGenDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={genLoading}>
                {genLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}