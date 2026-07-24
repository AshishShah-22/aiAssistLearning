'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore, useNotebookStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import {
  Plus,
  Sparkles,
  FileText,
  Pencil,
  ChevronLeft,
  Loader2,
  Trash2,
  Search,
  Filter,
  Copy,
  Check,
  BookOpen,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Note, NoteType, Topic, Unit } from '@/types';

// ─── Constants ───────────────────────────────────────
const noteTypeConfig: Record<NoteType, { label: string; color: string; desc: string }> = {
  general: { label: 'General', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', desc: 'General notes' },
  summary: { label: 'Summary', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', desc: 'Concise overview' },
  exam: { label: 'Exam', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', desc: 'Exam-optimized' },
  revision: { label: 'Revision', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', desc: 'Quick revision' },
  formula: { label: 'Formula', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', desc: 'Formula sheet' },
};

const genTypeOptions: { value: NoteType; label: string; desc: string }[] = [
  { value: 'summary', label: 'Summary', desc: 'Concise overview of key points' },
  { value: 'detailed', label: 'Detailed Notes', desc: 'Comprehensive in-depth coverage' },
  { value: 'exam', label: 'Exam Notes', desc: 'Optimized for exam prep with expected questions' },
  { value: 'revision', label: 'Revision Notes', desc: 'Quick-scan bullet points & tables' },
  { value: 'formula', label: 'Formula Sheet', desc: 'Formulas, variables & worked examples' },
];

// ─── Component ───────────────────────────────────────
export default function NotesPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const { units } = useNotebookStore();
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');

  // New note dialog
  const [showNewNote, setShowNewNote] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  // Generate dialog
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [genTopicId, setGenTopicId] = useState<string>('');
  const [genType, setGenType] = useState<NoteType>('exam');

  // Streaming state
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamContent, setStreamContent] = useState('');
  const streamAbortRef = useRef<AbortController | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  // Filter & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Ref for streaming content scroll
  const streamEndRef = useRef<HTMLDivElement>(null);

  // ── Derived data ───────────────────────────────────
  const allTopics: Topic[] = units.flatMap((u) => u.topics || []);
  const topicMap = new Map<string, Topic>();
  allTopics.forEach((t) => topicMap.set(t.id, t));

  const unitMap = new Map<string, Unit>();
  units.forEach((u) => unitMap.set(u.id, u));

  // ── Queries ────────────────────────────────────────
  const { data: notes, isLoading } = useQuery<Note[]>({
    queryKey: ['notes', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');
      return res.json();
    },
    enabled: !!notebookId,
  });

  // ── Filtered notes ────────────────────────────────
  const filteredNotes = (notes || []).filter((note) => {
    if (filterType !== 'all' && note.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedNote = notes?.find((n) => n.id === selectedNoteId) || null;

  // Auto-scroll streaming content
  useEffect(() => {
    if (isGenerating && streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamContent, isGenerating]);

  // ── Mutations ──────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; topicId?: string; type: NoteType }) => {
      const res = await fetch(`/api/notebooks/${notebookId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, isAiGenerated: false }),
      });
      if (!res.ok) throw new Error('Failed to create note');
      return res.json();
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] });
      setSelectedNoteId(note.id);
      setEditTitle(note.title);
      setEditContent(note.content);
      setIsEditing(false);
      setShowNewNote(false);
      setNewTitle('');
      setNewContent('');
      toast.success('Note created');
    },
    onError: () => toast.error('Failed to create note'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { noteId: string; title: string; content: string; type?: string }) => {
      const res = await fetch(`/api/notebooks/${notebookId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] });
      setIsEditing(false);
      toast.success('Note saved');
    },
    onError: () => toast.error('Failed to save note'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await fetch(`/api/notebooks/${notebookId}/notes?noteId=${noteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete note');
      return res.json();
    },
    onSuccess: (_, noteId) => {
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] });
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
        setIsEditing(false);
      }
      setDeleteTarget(null);
      toast.success('Note deleted');
    },
    onError: () => toast.error('Failed to delete note'),
  });

  // ── Streaming generate ─────────────────────────────
  const handleStreamGenerate = useCallback(async () => {
    if (!genTopicId) {
      toast.error('Please select a topic');
      return;
    }

    setIsGenerating(true);
    setStreamTitle('');
    setStreamContent('');
    setShowGenDialog(false);
    setSelectedNoteId(null);

    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/notes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: genTopicId, type: genType, stream: true }),
        signal: abortController.signal,
      });

      if (!res.ok) throw new Error('Generation failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const event = JSON.parse(trimmed.slice(6));

            if (event.type === 'title') {
              setStreamTitle(event.title || 'Generating...');
            } else if (event.type === 'chunk') {
              setStreamContent((prev) => prev + (event.content || ''));
            } else if (event.type === 'done') {
              queryClient.invalidateQueries({ queryKey: ['notes', notebookId] });
              if (event.noteId) {
                setSelectedNoteId(event.noteId);
                setEditTitle(event.title || streamTitle);
              }
              toast.success('Notes generated successfully!');
            } else if (event.type === 'error') {
              toast.error(event.error || 'Generation failed');
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.info('Generation cancelled');
      } else {
        toast.error('Failed to generate notes');
      }
    } finally {
      setIsGenerating(false);
      streamAbortRef.current = null;
    }
  }, [genTopicId, genType, notebookId, queryClient, streamTitle]);

  const handleCancelGeneration = () => {
    streamAbortRef.current?.abort();
  };

  // ── Handlers ───────────────────────────────────────
  const handleStartEdit = () => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (selectedNote) {
      updateMutation.mutate({
        noteId: selectedNote.id,
        title: editTitle,
        content: editContent,
      });
    }
  };

  const handleCreateNote = () => {
    if (!newTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }
    createMutation.mutate({
      title: newTitle,
      content: newContent || `# ${newTitle}\n\nStart writing...`,
      type: 'general',
    });
  };

  const handleSelectNote = (note: Note) => {
    setSelectedNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setIsEditing(false);
  };

  const handleCopyNote = async (note: Note) => {
    try {
      await navigator.clipboard.writeText(note.content);
      setCopiedId(note.id);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const getTopicName = (topicId: string | null): string | null => {
    if (!topicId) return null;
    const topic = topicMap.get(topicId);
    if (!topic) return null;
    // Find which unit this topic belongs to
    const unit = units.find((u) => u.id === topic.unitId);
    return unit ? `${unit.title} › ${topic.title}` : topic.title;
  };

  // ── Render ─────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* ── Streaming Progress View ────────────────── */}
      {isGenerating ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="size-3 text-primary animate-pulse" />
              </div>
              <span className="text-sm font-medium truncate">
                {streamTitle || 'Generating notes...'}
              </span>
              <Badge variant="outline" className="text-xs shrink-0">
                <Loader2 className="size-3 animate-spin mr-1" />
                Generating
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelGeneration}
              className="text-muted-foreground shrink-0"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Streaming content */}
          <div className="flex-1 overflow-y-auto p-4">
            {streamContent ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{streamContent}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="size-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <span className="text-sm">AI is crafting your notes...</span>
              </div>
            )}
            <div ref={streamEndRef} />
          </div>
        </div>
      ) : (
        <>
          {/* ── Note Detail View ────────────────────── */}
          {selectedNote ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Note header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => { setSelectedNoteId(null); setIsEditing(false); }}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {isEditing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-sm font-semibold h-8 flex-1 min-w-0"
                  />
                ) : (
                  <span className="text-sm font-medium flex-1 truncate">{selectedNote.title}</span>
                )}
                <Badge className={`${noteTypeConfig[selectedNote.type]?.color || noteTypeConfig.general.color} border-0 text-xs shrink-0`}>
                  {noteTypeConfig[selectedNote.type]?.label || selectedNote.type}
                </Badge>
                {selectedNote.isAiGenerated && (
                  <Badge variant="outline" className="text-xs gap-1 shrink-0">
                    <Sparkles className="size-3" /> AI
                  </Badge>
                )}
              </div>

              {/* Note toolbar */}
              <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-muted/30 flex-shrink-0">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} className="h-7 text-xs">
                      {updateMutation.isPending ? <Loader2 className="size-3 animate-spin mr-1" /> : <Check className="size-3 mr-1" />}
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-7 text-xs">
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={handleStartEdit} className="h-7 text-xs gap-1">
                      <Pencil className="size-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyNote(selectedNote)}
                      className="h-7 text-xs gap-1"
                    >
                      {copiedId === selectedNote.id ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      {copiedId === selectedNote.id ? 'Copied' : 'Copy'}
                    </Button>
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(selectedNote)}
                      className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3" /> Delete
                    </Button>
                  </>
                )}
              </div>

              {/* Note content */}
              <div className="flex-1 overflow-y-auto p-4">
                {isEditing ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-full font-mono text-sm resize-none"
                    placeholder="Write your note in markdown..."
                  />
                ) : (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                  >
                    <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Note footer */}
              {!isEditing && (
                <div className="px-4 py-2 border-t text-xs text-muted-foreground flex items-center gap-3 flex-shrink-0">
                  {getTopicName(selectedNote.topicId) && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="size-3" />
                      {getTopicName(selectedNote.topicId)}
                    </span>
                  )}
                  <span>{new Date(selectedNote.updatedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          ) : (
            /* ── Notes List View ─────────────────────── */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Action bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewNote(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">New Note</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowGenDialog(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Sparkles className="size-3.5" />
                  <span className="hidden sm:inline">AI Generate</span>
                </Button>
                <div className="flex-1" />
                <Button
                  variant={showFilters ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="size-3.5" />
                </Button>
              </div>

              {/* Search & Filter bar */}
              {(showFilters || searchQuery) && (
                <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
                  <div className="relative flex-1">
                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search notes..."
                      className="h-8 text-xs pl-8"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-8 text-xs w-[120px]">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {Object.entries(noteTypeConfig).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(searchQuery || filterType !== 'all') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => { setSearchQuery(''); setFilterType('all'); }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              )}

              {/* Notes list */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-2">
                  {isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((i) => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <Skeleton className="h-4 w-3/4 mb-2" />
                          <Skeleton className="h-3 w-1/2 mb-1" />
                          <Skeleton className="h-3 w-1/3" />
                        </CardContent>
                      </Card>
                      ))}
                    </div>
                  ) : filteredNotes.length > 0 ? (
                    <div className="space-y-2">
                    {filteredNotes.map((note) => (
                      <Card
                        key={note.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                        onClick={() => handleSelectNote(note)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                                <FileText className="size-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">{note.title}</span>
                                  {note.isAiGenerated && (
                                    <Sparkles className="size-3 text-primary shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {note.content.replace(/[#*_`\n]/g, ' ').replace(/\s+/g, ' ').substring(0, 100)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Badge className={`${noteTypeConfig[note.type]?.color || noteTypeConfig.general.color} border-0 text-[10px] px-1.5`}>
                                {noteTypeConfig[note.type]?.label || note.type}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground"
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(note); }}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 ml-[42px]">
                            {getTopicName(note.topicId) && (
                              <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                                <BookOpen className="size-2.5" />
                                {getTopicName(note.topicId)}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground/50">
                              {new Date(note.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <FileText className="size-8 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {notes && notes.length > 0 ? 'No notes match your search' : 'No notes yet'}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {notes && notes.length > 0
                          ? 'Try adjusting your filters'
                          : 'Create a note or generate one with AI'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes count */}
              {notes && notes.length > 0 && !isLoading && (
                <div className="px-4 py-2 border-t text-xs text-muted-foreground flex-shrink-0">
                  {filteredNotes.length === notes.length
                    ? `${notes.length} note${notes.length !== 1 ? 's' : ''}`
                    : `${filteredNotes.length} of ${notes.length} notes`}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── New Note Dialog ──────────────────────── */}
      <Dialog open={showNewNote} onOpenChange={setShowNewNote}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
            <DialogDescription>Write your own study notes in markdown format.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Chapter 3 - Data Structures"
                className="mt-1.5"
                onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim()) handleCreateNote(); }}
              />
            </div>
            <div>
              <Label>Content (Markdown)</Label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write your note in markdown...&#10;&#10;## Key Concepts&#10;- Point 1&#10;- Point 2&#10;&#10;### Important Formula&#10;$$E = mc^2$$"
                className="mt-1.5 min-h-[200px] font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewNote(false)}>Cancel</Button>
            <Button onClick={handleCreateNote} disabled={createMutation.isPending || !newTitle.trim()}>
              {createMutation.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
              Create Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generate AI Note Dialog ──────────────── */}
      <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Generate AI Notes
            </DialogTitle>
            <DialogDescription>AI will create structured study notes based on the topic content and your chat history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Topic</Label>
              <Select value={genTopicId} onValueChange={setGenTopicId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choose a topic from your syllabus..." />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <div key={unit.id}>
                      {unit.topics && unit.topics.length > 0 && (
                        <SelectItem value={`__unit_${unit.id}`} disabled className="text-xs font-semibold text-muted-foreground cursor-default">
                          ── {unit.title} ──
                        </SelectItem>
                      )}
                      {unit.topics?.map((topic) => (
                        <SelectItem key={topic.id} value={topic.id} className="pl-6">
                          {topic.title}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note Type</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {genTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGenType(opt.value)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      genType === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className={`mt-0.5 size-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      genType === opt.value ? 'border-primary' : 'border-muted-foreground/30'
                    }`}>
                      {genType === opt.value && <div className="size-2 rounded-full bg-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenDialog(false)}>Cancel</Button>
            <Button
              onClick={handleStreamGenerate}
              disabled={!genTopicId || genTopicId.startsWith('__unit_')}
              className="gap-1.5"
            >
              <Sparkles className="size-4" />
              Generate Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
