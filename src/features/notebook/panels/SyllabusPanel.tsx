'use client';

import { BookOpen } from 'lucide-react';

export function SyllabusPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <div className="rounded-full bg-muted p-4">
        <BookOpen className="size-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">Syllabus</h2>
        <p className="text-sm mt-1">View and navigate your course syllabus with units and topics.</p>
        <p className="text-xs mt-2 text-muted-foreground/70">Coming soon...</p>
      </div>
    </div>
  );
}