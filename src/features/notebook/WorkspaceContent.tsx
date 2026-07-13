'use client';

import { useAppStore } from '@/stores';
import dynamic from 'next/dynamic';

export function WorkspaceContent() {
  const sidebarPanel = useAppStore((s) => s.sidebarPanel);

  return (
    <main className="flex-1 overflow-hidden" role="main" aria-label="Workspace content">
      <PanelRouter panel={sidebarPanel} />
    </main>
  );
}

function PanelFallback() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="text-sm">Loading panel...</span>
      </div>
    </div>
  );
}

function PanelRouter({ panel }: { panel: string }) {
  const DynamicPanel = dynamic(
    () => {
      switch (panel) {
        case 'chat': return import('./panels/ChatPanel').then(m => ({ default: m.ChatPanel || m.default }));
        case 'syllabus': return import('./panels/SyllabusPanel').then(m => ({ default: m.SyllabusPanel || m.default }));
        case 'documents': return import('./panels/DocumentsPanel').then(m => ({ default: m.DocumentsPanel || m.default }));
        case 'notes': return import('./panels/NotesPanel');
        case 'quiz': return import('./panels/QuizPanel');
        case 'flashcards': return import('./panels/FlashcardsPanel');
        case 'revision': return import('./panels/RevisionPanel');
        case 'resources': return import('./panels/ResourcesPanel');
        case 'analytics': return import('./panels/AnalyticsPanel');
        case 'settings': return import('./panels/SettingsPanel');
        default: return Promise.resolve({ default: () => null });
      }
    },
    { loading: () => <PanelFallback />, ssr: false }
  );

  return <DynamicPanel />;
}