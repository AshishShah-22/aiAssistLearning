'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore, useNotebookStore } from '@/stores';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ChevronLeft,
  RotateCcw,
  Check,
  X,
  Loader2,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FlashcardDeck, Flashcard, Topic } from '@/types';

interface DeckWithMeta extends FlashcardDeck {
  _count?: { flashcards: number };
  flashcards?: Flashcard[];
}

const cardTypeLabels: Record<string, string> = {
  qa: 'Q&A',
  definition: 'Definition',
  formula: 'Formula',
  concept: 'Concept',
  example: 'Example',
};

export default function FlashcardsPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const { units } = useNotebookStore();
  const queryClient = useQueryClient();
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [genTopicId, setGenTopicId] = useState<string>('');
  const [genCount, setGenCount] = useState(10);
  const [genLoading, setGenLoading] = useState(false);

  // Review state
  const [activeDeck, setActiveDeck] = useState<DeckWithMeta | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewed, setReviewed] = useState<Record<string, 'correct' | 'incorrect'>>({});

  const allTopics: Topic[] = units.flatMap((u) => u.topics || []);

  const { data: decks, isLoading } = useQuery<DeckWithMeta[]>({
    queryKey: ['flashcards', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/flashcards`);
      if (!res.ok) throw new Error('Failed to fetch decks');
      return res.json();
    },
    enabled: !!notebookId,
  });

  const handleGenerate = async () => {
    setGenLoading(true);
    try {
      const body: Record<string, unknown> = { count: genCount };
      if (genTopicId) body.topicId = genTopicId;

      const res = await fetch(`/api/notebooks/${notebookId}/flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Generation failed');
      queryClient.invalidateQueries({ queryKey: ['flashcards', notebookId] });
      setShowGenDialog(false);
      toast.success('Flashcards generated!');
    } catch {
      toast.error('Failed to generate flashcards');
    } finally {
      setGenLoading(false);
    }
  };

  const handleStartReview = async (deck: DeckWithMeta) => {
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/flashcards/${deck.id}`);
      if (!res.ok) throw new Error('Failed to load cards');
      const data = await res.json();
      const deckCards: Flashcard[] = data.flashcards || [];
      setActiveDeck(deck);
      setCards(deckCards);
      setCurrentCardIdx(0);
      setIsFlipped(false);
      setReviewed({});
    } catch {
      toast.error('Failed to load flashcards');
    }
  };

  const handleReviewCard = (correct: boolean) => {
    if (!cards[currentCardIdx]) return;
    const cardId = cards[currentCardIdx].id;
    setReviewed((prev) => ({ ...prev, [cardId]: correct ? 'correct' : 'incorrect' }));
    setIsFlipped(false);

    if (currentCardIdx < cards.length - 1) {
      setTimeout(() => setCurrentCardIdx((prev) => prev + 1), 200);
    }
  };

  const handleFinishReview = async () => {
    if (!activeDeck) return;
    const correctIds = Object.entries(reviewed)
      .filter(([, v]) => v === 'correct')
      .map(([k]) => k);
    const incorrectIds = Object.entries(reviewed)
      .filter(([, v]) => v === 'incorrect')
      .map(([k]) => k);

    try {
      await fetch(`/api/notebooks/${notebookId}/flashcards/${activeDeck.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctIds, incorrectIds }),
      });
      queryClient.invalidateQueries({ queryKey: ['flashcards', notebookId] });
      toast.success('Review completed!');
    } catch {
      toast.error('Failed to save review');
    }
    setActiveDeck(null);
    setCards([]);
  };

  const currentCard = cards[currentCardIdx];
  const reviewedCount = Object.keys(reviewed).length;
  const correctCount = Object.values(reviewed).filter((v) => v === 'correct').length;
  const isReviewComplete = reviewedCount === cards.length && cards.length > 0;

  // Review Mode
  if (activeDeck && cards.length > 0) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (reviewedCount > 0) handleFinishReview();
                else {
                  setActiveDeck(null);
                  setCards([]);
                }
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {reviewedCount > 0 ? 'Finish Review' : 'Back'}
            </Button>
            <Badge variant="outline" className="text-xs">
              {reviewedCount} / {cards.length}
            </Badge>
          </div>

          <Progress value={(reviewedCount / cards.length) * 100} className="h-1.5" />

          {isReviewComplete ? (
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <div className="text-4xl">
                  {correctCount === cards.length ? '🎉' : correctCount >= cards.length * 0.7 ? '👏' : '💪'}
                </div>
                <h3 className="text-lg font-semibold">Review Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  <span className="text-emerald-600 font-medium">{correctCount} correct</span>
                  {' · '}
                  <span className="text-rose-600 font-medium">{reviewedCount - correctCount} need review</span>
                </p>
                <Button onClick={handleFinishReview} className="w-full mt-2">
                  Done
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center items-center" style={{ perspective: 800 }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentCard.id}
                    className="w-full"
                    initial={{ rotateY: 0 }}
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/* Front */}
                    <div
                      className="w-full min-h-[220px] rounded-xl border-2 border-dashed border-muted-foreground/20 p-6 flex flex-col items-center justify-center cursor-pointer"
                      style={{ backfaceVisibility: 'hidden' }}
                      onClick={() => setIsFlipped(true)}
                    >
                      <Badge variant="secondary" className="text-xs mb-3">
                        {cardTypeLabels[currentCard.type] || currentCard.type}
                      </Badge>
                      <p className="text-sm text-center font-medium">{currentCard.front}</p>
                      <p className="text-xs text-muted-foreground mt-4">Click to flip</p>
                    </div>

                    {/* Back */}
                    <div
                      className="absolute inset-0 min-h-[220px] rounded-xl bg-primary text-primary-foreground p-6 flex flex-col items-center justify-center cursor-pointer"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      onClick={() => setIsFlipped(false)}
                    >
                      <p className="text-sm text-center">{currentCard.back}</p>
                      <p className="text-xs opacity-70 mt-4">Click to flip back</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {isFlipped && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <Button
                    variant="outline"
                    className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => handleReviewCard(false)}
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Need Review
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleReviewCard(true)}
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    Got it
                  </Button>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    );
  }

  // Deck List View
  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-4">
        <Button
          onClick={() => setShowGenDialog(true)}
          className="w-full"
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          Generate Flashcards
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
        ) : decks && decks.length > 0 ? (
          <div className="space-y-2">
            {decks.map((deck) => (
              <Card
                key={deck.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleStartReview(deck)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium truncate flex-1">{deck.title}</h4>
                    <Badge variant="secondary" className="text-xs ml-2">
                      <Layers className="h-3 w-3 mr-1" />
                      {deck._count?.flashcards || 0} cards
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {new Date(deck.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">No flashcard decks yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Generate flashcards to study key concepts
            </p>
          </div>
        )}

        {/* Generate Dialog */}
        <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Flashcards</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Topic (optional)</Label>
                <Select value={genTopicId} onValueChange={setGenTopicId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All topics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Topics</SelectItem>
                    {allTopics.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Number of Cards</Label>
                <Input
                  type="number"
                  min={3}
                  max={30}
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