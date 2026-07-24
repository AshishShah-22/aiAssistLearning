'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Upload,
  FileText,
  Trash2,
  Eye,
  X,
  Loader2,
  File,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Document {
  id: string;
  notebookId: string;
  filename: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'md';
  fileSize: number;
  content: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const typeBadgeColors: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700',
  docx: 'bg-blue-100 text-blue-700',
  txt: 'bg-gray-100 text-gray-700',
  md: 'bg-emerald-100 text-emerald-700',
};

const typeIcons: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-5 w-5 text-red-500" />,
  docx: <FileText className="h-5 w-5 text-blue-500" />,
  txt: <File className="h-5 w-5 text-gray-500" />,
  md: <FileText className="h-5 w-5 text-emerald-500" />,
};

export function DocumentsPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [viewDocument, setViewDocument] = useState<Document | null>(null);

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ['documents', notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/documents`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    },
    enabled: !!notebookId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/notebooks/${notebookId}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(data.error || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', notebookId] });
      toast.success('Document uploaded');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload document');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/notebooks/${notebookId}/documents/${docId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete document');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', notebookId] });
      setDeleteTarget(null);
      toast.success('Document deleted');
    },
    onError: () => {
      toast.error('Failed to delete document');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowed = ['txt', 'md', 'pdf', 'docx'];
    if (!allowed.includes(ext)) {
      toast.error('Unsupported file type. Please upload .txt, .md, .pdf, or .docx files.');
      return;
    }

    uploadMutation.mutate(file);

    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canViewContent = (doc: Document) =>
    (doc.fileType === 'txt' || doc.fileType === 'md') &&
    doc.status === 'ready' &&
    doc.content;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-4">
        {/* Upload Button */}
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-1.5" />
          )}
          Upload Document
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.docx"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-12 rounded-full" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Document List */}
        {!isLoading && documents && documents.length > 0 && (
          <div className="space-y-2">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="hover:bg-muted/50 transition-colors group"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* File Icon */}
                    <div className="bg-muted rounded-lg p-2 shrink-0">
                      {typeIcons[doc.fileType] || <File className="h-5 w-5" />}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium truncate">{doc.filename}</h4>
                        <Badge
                          className={`${typeBadgeColors[doc.fileType] || 'bg-muted text-muted-foreground'} border-0 text-[10px] px-1.5 py-0`}
                        >
                          {doc.fileType.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(doc.fileSize)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(doc.createdAt)}
                        </span>
                        {/* Status */}
                        {doc.status === 'processing' && (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing
                          </span>
                        )}
                        {doc.status === 'ready' && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Ready
                          </span>
                        )}
                        {doc.status === 'error' && (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertCircle className="h-3 w-3" />
                            Error
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canViewContent(doc) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setViewDocument(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!documents || documents.length === 0) && (
          <div className="text-center py-12">
            <div className="rounded-full bg-muted p-4 mx-auto w-fit">
              <Upload className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mt-4">
              No documents yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Upload .txt, .md, .pdf, or .docx files to use as study references
            </p>
          </div>
        )}
      </div>

      {/* View Document Dialog */}
      <Dialog open={!!viewDocument} onOpenChange={(open) => !open && setViewDocument(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewDocument && typeIcons[viewDocument.fileType]}
              {viewDocument?.filename}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-mono leading-relaxed p-4 bg-muted/50 rounded-lg">
              {viewDocument?.content}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.filename}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
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
    </ScrollArea>
  );
}
