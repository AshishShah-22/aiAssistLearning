'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore, useNotebookStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
} from '@/components/ui/dialog';
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
  Eye,
  Pencil,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Note, NoteType, Topic, Unit } from '@/types';

const noteTypeColors: Record<NoteType, string> = {
  general: 'bg-gray-100 text-gray-700',
  summary: 'bg-emerald-100 text-emerald-700',
  exam: 'bg-amber-100 text-amber-700',
  revision: 'bg-purple-100 text-purple-700',
  formula: 'bg-rose-100 text-rose-700',
};

export default function NotesPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const { units } = useNotebookStore();
  const queryClient = useQueryClient();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [genTopicId, setGenTopicId] = useState<string>('');
  const [genType, setGenType] = useState<NoteType>('summary');
  const [genLoading, setGenLoading] = useState(false);

  // Collect all topics from units
  const allTopics: Topic[] = units.flatMap((u) => u.topics || []);

  const { data: notes, isLoading } = useQuery<Note[]>({
    queryKey: ['notes', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');
      return res.json();
    },
    enabled: !!notebookId,
  });

  const selectedNote = notes?.find((n) => n.id === selectedNoteId) || null;

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
    mutationFn: async (data: { noteId: string; title: string; content: string }) => {
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

  const handleGenerate = async () => {
    if (!genTopicId) {
      toast.error('Please select a topic');
      return;
    }
    setGenLoading(true);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/notes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: genTopicId, type: genType }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const note = await res.json();
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] });
      setSelectedNoteId(note.id);
      setEditTitle(note.title);
      setEditContent(note.content);
      setIsEditing(false);
      setShowGenDialog(false);
      toast.success('AI note generated');
    } catch {
      toast.error('Failed to generate note');
    } finally {
      setGenLoading(false);
    }
  };

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
      content: newContent || '# ' + newTitle + '\n\nStart writing...',
      type: 'general',
    });
  };

  const handleSelectNote = (note: Note) => {
    setSelectedNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setIsEditing(false);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-4">
        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewNote(true)}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Note
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGenDialog(true)}
            className="flex-1"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Generate AI Note
          </Button>
        </div>

        {selectedNote ? (
          /* Note Viewer / Editor */
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelectedNoteId(null)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {isEditing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-sm font-semibold h-8"
                  />
                ) : (
                  <CardTitle className="text-sm flex-1">{selectedNote.title}</CardTitle>
                )}
                <Badge className={`${noteTypeColors[selectedNote.type]} border-0 text-xs`}>
                  {selectedNote.type}
                </Badge>
                {selectedNote.isAiGenerated && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Sparkles className="h-3 w-3" /> AI
                  </Badge>
                )}
                {isEditing ? (
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStartEdit}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm resize-none"
                />
              ) : (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert cursor-pointer"
                  onClick={handleStartEdit}
                >
                  <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Notes List */
          <>
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
            ) : notes && notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <Card
                    key={note.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectNote(note)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{note.title}</span>
                        </div>
                        <Badge className={`${noteTypeColors[note.type]} border-0 text-xs shrink-0`}>
                          {note.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 pl-6">
                        {note.content.replace(/[#*_`]/g, '').substring(0, 120)}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1.5 pl-6">
                        {new Date(note.createdAt).toLocaleDateString()}
                        {note.isAiGenerated && ' • AI Generated'}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No notes yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Create a note or generate one with AI
                </p>
              </div>
            )}
          </>
        )}

        {/* New Note Dialog */}
        <Dialog open={showNewNote} onOpenChange={setShowNewNote}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Note title..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Content (Markdown)</Label>
                <Textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write your note in markdown..."
                  className="mt-1 min-h-[200px] font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewNote(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateNote} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Create Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Generate AI Note Dialog */}
        <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate AI Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Topic</Label>
                <Select value={genTopicId} onValueChange={setGenTopicId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a topic..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allTopics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Note Type</Label>
                <Select value={genType} onValueChange={(v) => setGenType(v as NoteType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="exam">Exam Notes</SelectItem>
                    <SelectItem value="revision">Revision Notes</SelectItem>
                    <SelectItem value="formula">Formula Sheet</SelectItem>
                    <SelectItem value="detailed">Detailed Notes</SelectItem>
                  </SelectContent>
                </Select>
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