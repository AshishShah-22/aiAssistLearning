'use client';

import { FileText } from 'lucide-react';

export function DocumentsPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <div className="rounded-full bg-muted p-4">
        <FileText className="size-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">Documents</h2>
        <p className="text-sm mt-1">Upload and manage reference documents for your notebook.</p>
        <p className="text-xs mt-2 text-muted-foreground/70">Coming soon...</p>
      </div>
    </div>
  );
}