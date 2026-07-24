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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Plus,
  ExternalLink,
  BookOpen,
  FileText,
  Video,
  GraduationCap,
  Globe,
  Code,
  PenTool,
  Bookmark,
  Loader2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Resource, ResourceType, Topic, Unit } from '@/types';

const typeIcons: Record<ResourceType, React.ReactNode> = {
  book: <BookOpen className="h-4 w-4" />,
  paper: <GraduationCap className="h-4 w-4" />,
  documentation: <FileText className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  article: <Globe className="h-4 w-4" />,
  blog: <PenTool className="h-4 w-4" />,
  practice: <Code className="h-4 w-4" />,
  uploaded: <Bookmark className="h-4 w-4" />,
};

const typeColors: Record<ResourceType, string> = {
  book: 'bg-emerald-100 text-emerald-700',
  paper: 'bg-purple-100 text-purple-700',
  documentation: 'bg-sky-100 text-sky-700',
  video: 'bg-rose-100 text-rose-700',
  article: 'bg-amber-100 text-amber-700',
  blog: 'bg-teal-100 text-teal-700',
  practice: 'bg-orange-100 text-orange-700',
  uploaded: 'bg-gray-100 text-gray-700',
};

export default function ResourcesPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const { units } = useNotebookStore();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formType, setFormType] = useState<ResourceType>('article');
  const [formDescription, setFormDescription] = useState('');
  const [formTopicId, setFormTopicId] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null);

  const allTopics: Topic[] = units.flatMap((u) => (u.topics || []).map((t) => ({ ...t, unitTitle: u.title })));

  const { data: resources, isLoading } = useQuery<Resource[]>({
    queryKey: ['resources', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/resources`);
      if (!res.ok) throw new Error('Failed to fetch resources');
      return res.json();
    },
    enabled: !!notebookId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title: formTitle,
        type: formType,
        description: formDescription || null,
        url: formUrl || null,
      };
      if (formTopicId && formTopicId !== '__none__') body.topicId = formTopicId;

      const res = await fetch(`/api/notebooks/${notebookId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to add resource');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', notebookId] });
      setShowAddDialog(false);
      setFormTitle('');
      setFormUrl('');
      setFormType('article');
      setFormDescription('');
      setFormTopicId('');
      toast.success('Resource added');
    },
    onError: () => toast.error('Failed to add resource'),
  });

  const handleAdd = () => {
    if (!formTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }
    addMutation.mutate();
  };

  const deleteMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const res = await fetch(`/api/notebooks/${notebookId}/resources?resourceId=${resourceId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', notebookId] });
      setDeleteTarget(null);
      toast.success('Resource deleted');
    },
    onError: () => toast.error('Failed to delete resource'),
  });

  // Group resources by topic
  const groupedResources: Record<string, { topic: string | null; resources: Resource[] }> = {};
  (resources || []).forEach((r) => {
    const topic = r.topicId
      ? allTopics.find((t) => t.id === r.topicId)?.title || 'Unknown Topic'
      : null;
    const key = topic || '__general__';
    if (!groupedResources[key]) groupedResources[key] = { topic, resources: [] };
    groupedResources[key].resources.push(r);
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-4">
        <Button onClick={() => setShowAddDialog(true)} className="w-full">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Resource
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-1/3" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : resources && resources.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedResources).map(([key, group]) => (
              <div key={key}>
                {group.topic && (
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    {group.topic}
                  </h3>
                )}
                {(!group.topic) && Object.keys(groupedResources).length > 1 && (
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    General
                  </h3>
                )}
                <div className="space-y-2">
                  {group.resources.map((resource) => (
                    <Card
                      key={resource.id}
                      className="hover:bg-muted/50 transition-colors group"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`${typeColors[resource.type]} p-2 rounded-lg shrink-0`}>
                            {typeIcons[resource.type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium truncate">{resource.title}</h4>
                              {resource.url && (
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </a>
                              )}
                            </div>
                            {resource.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {resource.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={`${typeColors[resource.type]} border-0 text-xs`}>
                                {resource.type}
                              </Badge>
                              {resource.source && (
                                <span className="text-xs text-muted-foreground">{resource.source}</span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(resource); }}
                                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bookmark className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">No resources yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add books, videos, articles, and other study materials
            </p>
          </div>
        )}

        {/* Add Resource Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Resource</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Resource title..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>URL (optional)</Label>
                <Input
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={(v) => setFormType(v as ResourceType)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="book">📖 Book</SelectItem>
                      <SelectItem value="paper">🎓 Paper</SelectItem>
                      <SelectItem value="video">🎬 Video</SelectItem>
                      <SelectItem value="article">📰 Article</SelectItem>
                      <SelectItem value="blog">✍️ Blog</SelectItem>
                      <SelectItem value="documentation">📄 Documentation</SelectItem>
                      <SelectItem value="practice">💻 Practice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Topic (optional)</Label>
                  <Select value={formTopicId} onValueChange={setFormTopicId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="General" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">General</SelectItem>
                      {allTopics.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Add Resource
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}