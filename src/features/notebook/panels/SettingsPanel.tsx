'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Save,
  Trash2,
  Archive,
  Loader2,
  Palette,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Notebook } from '@/types';

const COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
  '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16',
  '#e11d48', '#0ea5e9', '#a855f7', '#d946ef', '#64748b',
];

const statusLabels: Record<string, { label: string; className: string }> = {
  setup: { label: 'Setup', className: 'bg-gray-100 text-gray-700' },
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Completed', className: 'bg-blue-100 text-blue-700' },
  archived: { label: 'Archived', className: 'bg-amber-100 text-amber-700' },
};

export default function SettingsPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#10b981');
  const [initialized, setInitialized] = useState(false);

  const { data: notebook, isLoading } = useQuery<Notebook>({
    queryKey: ['notebook', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}`);
      if (!res.ok) throw new Error('Failed to fetch notebook');
      return res.json();
    },
    enabled: !!notebookId,
  });

  // Initialize form when notebook loads
  if (notebook && !initialized) {
    setName(notebook.name);
    setDescription(notebook.description || '');
    setColor(notebook.color);
    setInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string; color?: string; status?: string }) => {
      const res = await fetch(`/api/notebooks/${notebookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Update failed');
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['notebook', notebookId] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      toast.success('Notebook updated');
    },
    onError: () => toast.error('Failed to update notebook'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      useAppStore.getState().goToDashboard();
      toast.success('Notebook deleted');
    },
    onError: () => toast.error('Failed to delete notebook'),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      if (!res.ok) throw new Error('Archive failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebook', notebookId] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      toast.success('Notebook archived');
    },
    onError: () => toast.error('Failed to archive notebook'),
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      color,
    });
  };

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  const statusInfo = statusLabels[notebook?.status || 'active'] || statusLabels.active;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              Notebook Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge className={`${statusInfo.className} border-0 text-xs`}>
                {statusInfo.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Created</span>
              <span className="text-xs">
                {notebook?.createdAt
                  ? new Date(notebook.createdAt).toLocaleDateString()
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Last Opened</span>
              <span className="text-xs">
                {notebook?.lastOpenedAt
                  ? new Date(notebook.lastOpenedAt).toLocaleDateString()
                  : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="nb-name">Name</Label>
          <Input
            id="nb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Notebook name"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="nb-desc">Description</Label>
          <Textarea
            id="nb-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this notebook about?"
            rows={3}
          />
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Color
          </Label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`h-7 w-7 rounded-full transition-all ${
                  color === c
                    ? 'ring-2 ring-offset-2 ring-foreground scale-110'
                    : 'hover:scale-105 opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Save Button */}
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save Changes
        </Button>

        <Separator />

        {/* Danger Zone */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Danger Zone
          </h3>

          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-amber-600 border-amber-200 hover:bg-amber-50"
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending || notebook?.status === 'archived'}
          >
            {archiveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            {notebook?.status === 'archived' ? 'Already Archived' : 'Archive Notebook'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete Notebook
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this notebook?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All units, topics, notes, quizzes,
                  flashcards, and study data will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </ScrollArea>
  );
}