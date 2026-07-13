'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore, useNotebookStore } from '@/stores';
import { NotebookHeader } from './NotebookHeader';
import { NotebookSidebar } from './NotebookSidebar';
import { WorkspaceContent } from './WorkspaceContent';
import type { Notebook } from '@/types';

export function NotebookWorkspace() {
  const currentNotebookId = useAppStore((s) => s.currentNotebookId);
  const view = useAppStore((s) => s.view);
  const setNotebook = useNotebookStore((s) => s.setNotebook);
  const setUnits = useNotebookStore((s) => s.setUnits);
  const reset = useNotebookStore((s) => s.reset);
  const queryClient = useQueryClient();

  // Fetch notebook data
  const { data: notebookData, isLoading, error } = useQuery<Notebook>({
    queryKey: ['notebook', currentNotebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${currentNotebookId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Notebook not found');
        throw new Error('Failed to fetch notebook');
      }
      return res.json();
    },
    enabled: view === 'notebook' && !!currentNotebookId,
  });

  // Update lastOpenedAt when notebook is loaded
  const updateLastOpened = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notebooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastOpenedAt: new Date().toISOString() }),
      });
    },
  });

  // Sync notebook data to store
  useEffect(() => {
    if (notebookData) {
      setNotebook(notebookData);
      setUnits(notebookData.units ?? []);
      // Update lastOpenedAt in background
      updateLastOpened.mutate(notebookData.id);
    }
  }, [notebookData, setNotebook, setUnits, updateLastOpened]);

  // Reset store when leaving notebook view
  useEffect(() => {
    if (view !== 'notebook') {
      reset();
    }
  }, [view, reset]);

  // Don't render if not in notebook view
  if (view !== 'notebook') return null;

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="h-14 border-b bg-background flex items-center px-4 gap-3">
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <div className="h-5 w-48 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="text-sm">Loading notebook...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="h-14 border-b bg-background flex items-center px-4 gap-3">
          <div className="h-5 w-5 rounded bg-muted" />
          <span className="text-sm text-muted-foreground">Error</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {error.message === 'Notebook not found'
                ? 'This notebook could not be found.'
                : 'Failed to load the notebook.'}
            </p>
            <button
              onClick={useAppStore.getState().goToDashboard}
              className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Fixed top bar with header */}
      <NotebookHeader />

      {/* Main area: sidebar + content */}
      <div className="flex-1 flex min-h-0">
        <NotebookSidebar />
        <WorkspaceContent />
      </div>
    </div>
  );
}