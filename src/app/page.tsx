'use client';

import { useAppStore, useAuthStore } from '@/stores';
import Dashboard from '@/features/dashboard/Dashboard';
import CreateNotebook from '@/features/dashboard/CreateNotebook';
import { NotebookWorkspace } from '@/features/notebook/NotebookWorkspace';
import AuthPage from '@/features/auth/AuthPage';
import { Loader2 } from 'lucide-react';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <>{children}</>;
}

export default function Home() {
  const view = useAppStore((s) => s.view);

  return (
    <AuthGate>
      {view === 'setup' && <CreateNotebook />}
      {view === 'notebook' && <NotebookWorkspace />}
      {view === 'dashboard' && <Dashboard />}
    </AuthGate>
  );
}