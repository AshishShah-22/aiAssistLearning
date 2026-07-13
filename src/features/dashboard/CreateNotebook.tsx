'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Sparkles,
  FileText,
  Check,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores';

const COLOR_SWATCHES = [
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Orange', value: '#f97316' },
];

const STEP_TITLES = ['Details', 'Syllabus', 'Analyzing'];

const LOADING_MESSAGES = [
  'Reading through your syllabus...',
  'Identifying key topics and units...',
  'Structuring your study plan...',
  'Almost there...',
];

export default function CreateNotebook() {
  const goToDashboard = useAppStore((s) => s.goToDashboard);
  const openNotebook = useAppStore((s) => s.openNotebook);
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_SWATCHES[0].value);
  const [syllabusText, setSyllabusText] = useState('');
  const [syllabusSource, setSyllabusSource] = useState<'paste' | 'upload'>('paste');
  const [loadingMessageIdx, setLoadingMessageIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || undefined, color }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create notebook');
      }
      return res.json();
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (notebookId: string) => {
      const res = await fetch(`/api/notebooks/${notebookId}/analyze-syllabus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syllabusText }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to analyze syllabus');
      }
      return res.json();
    },
    onSuccess: (_data, notebookId) => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      openNotebook(notebookId);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setSyllabusText(text);
        setSyllabusSource('paste');
      }
    };
    reader.onerror = () => {
      setError('Failed to read the file. Please try pasting the content instead.');
    };
    reader.readAsText(file);
  }, []);

  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = syllabusText.trim().length > 0;
  const isAnalyzing = step === 2 && !error;

  const handleNext = () => {
    if (step === 0 && canProceedStep1) {
      setStep(1);
      setError(null);
    } else if (step === 1 && canProceedStep2) {
      setError(null);
      setStep(2);
      setLoadingMessageIdx(0);
      createMutation.mutate(undefined, {
        onSuccess: (notebook) => {
          analyzeMutation.mutate(notebook.id);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to create notebook');
          setStep(1);
        },
      });
    }
  };

  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setLoadingMessageIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleRetry = () => {
    setError(null);
    setStep(1);
    createMutation.reset();
    analyzeMutation.reset();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goToDashboard} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-semibold text-sm">Create Notebook</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Indicators */}
        <div className="flex items-center gap-2 mb-8">
          {STEP_TITLES.map((title, idx) => (
            <div key={title} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                  idx <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {idx < step ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span className={cn('text-xs font-medium hidden sm:inline', idx <= step ? 'text-foreground' : 'text-muted-foreground')}>
                {title}
              </span>
              {idx < STEP_TITLES.length - 1 && (
                <div className={cn('flex-1 h-px', idx < step ? 'bg-primary' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Details */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold">Notebook Details</h2>
              <p className="text-sm text-muted-foreground">Give your notebook a name and pick a color.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notebook-name">Notebook Name *</Label>
                <Input
                  id="notebook-name"
                  placeholder="e.g., Machine Learning Fundamentals"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canProceedStep1) setStep(1); }}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notebook-desc">Description (optional)</Label>
                <Textarea
                  id="notebook-desc"
                  placeholder="Brief description of what you'll be studying..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-20 resize-none"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-3">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      onClick={() => setColor(swatch.value)}
                      className={cn(
                        'relative w-8 h-8 rounded-full transition-all duration-150 hover:scale-110',
                        color === swatch.value && 'ring-2 ring-offset-2 ring-offset-background'
                      )}
                      style={{ backgroundColor: swatch.value, ringColor: color === swatch.value ? swatch.value : undefined }}
                      title={swatch.name}
                    >
                      {color === swatch.value && <Check className="w-4 h-4 text-white absolute inset-0 m-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(1)} disabled={!canProceedStep1} className="gap-1.5">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Syllabus Upload */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold">Upload Syllabus</h2>
              <p className="text-sm text-muted-foreground">Paste or upload your course syllabus. AI will create a structured study plan.</p>
            </div>

            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
              <Button variant={syllabusSource === 'paste' ? 'default' : 'ghost'} size="sm" onClick={() => setSyllabusSource('paste')} className="gap-1.5 text-xs">
                <FileText className="w-3.5 h-3.5" /> Paste Text
              </Button>
              <Button variant={syllabusSource === 'upload' ? 'default' : 'ghost'} size="sm" onClick={() => setSyllabusSource('upload')} className="gap-1.5 text-xs">
                <Upload className="w-3.5 h-3.5" /> Upload File
              </Button>
            </div>

            {syllabusSource === 'paste' ? (
              <div className="space-y-2">
                <Label htmlFor="syllabus-text">Syllabus Content *</Label>
                <Textarea
                  id="syllabus-text"
                  placeholder="Paste your syllabus, course outline, or list of topics here..."
                  value={syllabusText}
                  onChange={(e) => setSyllabusText(e.target.value)}
                  className="min-h-48 resize-y font-mono text-sm"
                  rows={10}
                />
                <p className="text-xs text-muted-foreground">Supports plain text, markdown, or course outline formats.</p>
              </div>
            ) : (
              <Card className="border-dashed hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <label htmlFor="file-upload" className="flex flex-col items-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-1">TXT, MD, or PDF (up to 5MB)</p>
                    </div>
                  </label>
                  <input ref={fileInputRef} id="file-upload" type="file" accept=".txt,.md,.pdf" onChange={handleFileUpload} className="hidden" />
                  {syllabusText && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate flex-1">{syllabusText.slice(0, 100)}...</span>
                      <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => setSyllabusText('')}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(0)} className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={handleNext} disabled={!canProceedStep2 || createMutation.isPending || analyzeMutation.isPending} className="gap-1.5">
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Create & Analyze</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Analyzing */}
        {step === 2 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {isAnalyzing ? (
              <>
                <div className="mb-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                    <Sparkles className="w-7 h-7 animate-pulse" style={{ color }} />
                  </div>
                </div>
                <h2 className="text-xl font-bold mb-2">AI is analyzing your syllabus</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  This may take a moment. We&apos;re breaking down your content into units and topics.
                </p>
                <p className="text-sm font-medium mt-6 transition-all" style={{ color }} key={loadingMessageIdx}>
                  {LOADING_MESSAGES[loadingMessageIdx]}
                </p>
                <div className="flex items-center gap-1.5 mt-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                      style={{ animationDelay: `${i * 0.3}s` }}
                    />
                  ))}
                </div>
              </>
            ) : error ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
                  <AlertCircle className="w-7 h-7 text-destructive" />
                </div>
                <h2 className="text-xl font-bold mb-2">Analysis Failed</h2>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">{error}</p>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleRetry}>Try Again</Button>
                  <Button variant="ghost" onClick={goToDashboard}>Back to Dashboard</Button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}