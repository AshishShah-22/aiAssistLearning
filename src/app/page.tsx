'use client';

import { useAppStore } from '@/stores';
import Dashboard from '@/features/dashboard/Dashboard';
import CreateNotebook from '@/features/dashboard/CreateNotebook';
import { NotebookWorkspace } from '@/features/notebook/NotebookWorkspace';

export default function Home() {
  const view = useAppStore((s) => s.view);

  if (view === 'setup') {
    return <CreateNotebook />;
  }

  if (view === 'notebook') {
    return <NotebookWorkspace />;
  }

  return <Dashboard />;
}