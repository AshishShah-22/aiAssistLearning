'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MessageSquarePlus,
  Send,
  Sparkles,
  MessageCircle,
  Bot,
  User,
  ChevronLeft,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, useChatStore } from '@/stores';
import type { Chat, Message } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

// ─── Markdown Components ──────────────────────────────

const markdownComponents = {
  code({
    className,
    children,
    ...props
  }: React.ComponentProps<'code'> & { inline?: boolean }) {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match && !className;

    if (isInline) {
      return (
        <code
          className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-mono text-foreground/90"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <div className="relative my-3 rounded-lg overflow-hidden border bg-zinc-950">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <span className="text-xs text-zinc-400 font-mono">
            {match ? match[1] : 'code'}
          </span>
        </div>
        <SyntaxHighlighter
          style={oneDark}
          language={match ? match[1] : 'text'}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '13px',
            background: 'rgb(9 9 11)',
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    );
  },
  p({ children, ...props }: React.ComponentProps<'p'>) {
    return (
      <p className="mb-2 last:mb-0 leading-relaxed" {...props}>
        {children}
      </p>
    );
  },
  ul({ children, ...props }: React.ComponentProps<'ul'>) {
    return (
      <ul className="mb-2 ml-4 list-disc space-y-1 text-sm" {...props}>
        {children}
      </ul>
    );
  },
  ol({ children, ...props }: React.ComponentProps<'ol'>) {
    return (
      <ol className="mb-2 ml-4 list-decimal space-y-1 text-sm" {...props}>
        {children}
      </ol>
    );
  },
  h1({ children, ...props }: React.ComponentProps<'h1'>) {
    return (
      <h1 className="text-lg font-semibold mb-2 mt-4 first:mt-0" {...props}>
        {children}
      </h1>
    );
  },
  h2({ children, ...props }: React.ComponentProps<'h2'>) {
    return (
      <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0" {...props}>
        {children}
      </h2>
    );
  },
  h3({ children, ...props }: React.ComponentProps<'h3'>) {
    return (
      <h3
        className="text-sm font-semibold mb-1.5 mt-2 first:mt-0"
        {...props}
      >
        {children}
      </h3>
    );
  },
  blockquote({ children, ...props }: React.ComponentProps<'blockquote'>) {
    return (
      <blockquote
        className="border-l-2 border-primary/30 pl-3 my-2 text-muted-foreground italic"
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  a({ children, href, ...props }: React.ComponentProps<'a'>) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80"
        {...props}
      >
        {children}
      </a>
    );
  },
  strong({ children, ...props }: React.ComponentProps<'strong'>) {
    return (
      <strong className="font-semibold text-foreground" {...props}>
        {children}
      </strong>
    );
  },
  table({ children, ...props }: React.ComponentProps<'table'>) {
    return (
      <div className="my-2 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" {...props}>
          {children}
        </table>
      </div>
    );
  },
  th({ children, ...props }: React.ComponentProps<'th'>) {
    return (
      <th
        className="border-b bg-muted px-3 py-2 text-left font-medium"
        {...props}
      >
        {children}
      </th>
    );
  },
  td({ children, ...props }: React.ComponentProps<'td'>) {
    return (
      <td className="border-b px-3 py-2 last:border-b-0" {...props}>
        {children}
      </td>
    );
  },
};

// ─── Typing Dots ───────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-primary/50"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const citations: string[] = message.citations
    ? JSON.parse(message.citations)
    : [];

  const images: { url: string; caption: string }[] = message.images
    ? JSON.parse(message.images)
    : [];

  const timeStr = message.createdAt
    ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex gap-3 max-w-[90%] sm:max-w-[85%]',
        isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'shrink-0 mt-1 size-7 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      {/* Content */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-foreground/70">
            {isUser ? 'You' : 'AI Tutor'}
          </span>
          <span className="text-[10px] text-muted-foreground/60">{timeStr}</span>
        </div>

        <div
          className={cn(
            'rounded-xl px-4 py-3 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card border rounded-tl-sm shadow-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-custom">
              <ReactMarkdown components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Images */}
        {!isUser && images.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {images.map((img, i) => (
              <div key={i} className="rounded-lg overflow-hidden border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption || 'Diagram'}
                  className="w-full max-h-64 object-contain bg-white"
                  loading="lazy"
                />
                {img.caption && (
                  <p className="text-[11px] text-muted-foreground px-2 py-1.5 border-t bg-muted/30">
                    {img.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Citations */}
        {!isUser && citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {citations.map((citation, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] px-2 py-0 gap-1 bg-muted/50"
              >
                <BookOpen className="size-2.5" />
                {citation}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Chat List Sidebar ─────────────────────────────────

function ChatListSidebar({
  notebookId,
  onSelectChat,
  activeChatId,
  onNewChat,
  onClose,
}: {
  notebookId: string;
  onSelectChat: (id: string) => void;
  activeChatId: string | null;
  onNewChat: () => void;
  onClose: () => void;
}) {
  const { data: chats, isLoading } = useQuery<Chat[]>({
    queryKey: ['chats', notebookId],
    queryFn: () =>
      fetch(`/api/notebooks/${notebookId}/chats`).then((r) => r.json()),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
            <ChevronLeft className="size-4" />
          </Button>
          <h3 className="text-sm font-semibold">Chats</h3>
        </div>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={onNewChat}>
                <MessageSquarePlus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Chat list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : !chats || chats.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageCircle className="size-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                No conversations yet
              </p>
            </div>
          ) : (
            chats.map((chat) => (
              <Button
                key={chat.id}
                variant="ghost"
                className={cn(
                  'w-full justify-start h-auto py-2.5 px-3 text-left gap-2',
                  chat.id === activeChatId &&
                    'bg-accent border border-accent-foreground/10'
                )}
                onClick={() => onSelectChat(chat.id)}
              >
                <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{chat.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {chat.createdAt
                      ? formatDistanceToNow(new Date(chat.createdAt), {
                          addSuffix: true,
                        })
                      : ''}
                  </p>
                </div>
              </Button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Welcome Screen ────────────────────────────────────

function WelcomeScreen({ onSend }: { onSend: (text: string) => void }) {
  const suggestions = [
    { label: 'Explain the key concepts', icon: '💡' },
    { label: 'Help me with a problem', icon: '🔧' },
    { label: 'Quiz me on this topic', icon: '📝' },
    { label: 'Summarize what I need to know', icon: '📋' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-6 text-center">
      <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Sparkles className="size-7 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          AI Study Tutor
        </h3>
        <p className="text-sm text-muted-foreground max-w-[260px]">
          Start a conversation about your syllabus. Ask questions, get
          explanations, or test your knowledge.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
        {suggestions.map((s) => (
          <Button
            key={s.label}
            variant="outline"
            className="h-auto py-2.5 px-3 text-xs justify-start gap-2 text-left"
            onClick={() => onSend(s.label)}
          >
            <span>{s.icon}</span>
            <span className="truncate">{s.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Chat Panel ───────────────────────────────────

export default function ChatPanel() {
  const notebookId = useAppStore((s) => s.currentNotebookId);
  const queryClient = useQueryClient();

  // Local UI state
  const [showChatList, setShowChatList] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Chat store — NOTE: we intentionally avoid subscribing to messages
  // from the Zustand store to prevent infinite re-render loops.
  const {
    activeChatId,
    setActiveChat,
    setStreaming,
    isStreaming,
  } = useChatStore();

  // Fetch chats list
  const { data: chats } = useQuery<Chat[]>({
    queryKey: ['chats', notebookId],
    queryFn: () =>
      fetch(`/api/notebooks/${notebookId}/chats`).then((r) => r.json()),
    enabled: !!notebookId,
  });

  // Fetch messages for active chat
  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['messages', activeChatId],
    queryFn: () =>
      fetch(`/api/notebooks/${notebookId}/chats/${activeChatId}/messages`).then(
        (r) => r.json()
      ),
    enabled: !!activeChatId && !isStreaming,
  });

  // Display: use local optimistic messages while streaming,
  // otherwise use server-fetched messages. No store sync needed.
  const displayMessages = isStreaming ? localMessages : (messages ?? []);

  // Create chat mutation
  const createChatMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });
      return res.json() as Promise<Chat>;
    },
    onSuccess: (chat) => {
      setActiveChat(chat.id);
      queryClient.invalidateQueries({ queryKey: ['chats', notebookId] });
      return chat;
    },
  });

  // Send message mutation
    // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      content,
      chatId,
    }: {
      content: string;
      chatId: string;
    }) => {
      setStreaming(true);

      // Optimistically add user message
      const userMsg: Message = {
        id: `temp-user-${Date.now()}`,
        chatId,
        role: 'user',
        content,
        citations: null,
        images: null,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, userMsg]);

      // Add a placeholder assistant message for streaming
      const assistantMsg: Message = {
        id: `temp-assistant-${Date.now()}`,
        chatId,
        role: 'assistant',
        content: '',
        citations: null,
        images: null,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, assistantMsg]);

      // Use EventSource-like fetch for SSE streaming
      const res = await fetch(
        `/api/notebooks/${notebookId}/chats/${chatId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, stream: true }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            if (data.type === 'chunk') {
              fullContent += data.text;
              // Update the assistant message content progressively
              setLocalMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                  updated[lastIdx] = { ...updated[lastIdx], content: fullContent };
                }
                return updated;
              });
            } else if (data.type === 'done') {
              // Streaming complete — server saved the message
              fullContent = data.content || fullContent;
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Stream error');
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Stream error') {
              // skip parse errors
            }
          }
        }
      }

      return { chatId, content: fullContent };
    },
    onSuccess: (data) => {
      setStreaming(false);
      setLocalMessages([]);
      queryClient.invalidateQueries({
        queryKey: ['messages', data.chatId],
      });
      queryClient.invalidateQueries({
        queryKey: ['chats', notebookId],
      });
    },
    onError: (error) => {
      setStreaming(false);
      setLocalMessages([]);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    },
  });
  
  // Auto-scroll to bottom
    const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  // Scroll on new messages — use message count to avoid object-ref loops
  const messageCount = displayMessages.length;
  useEffect(() => {
    scrollToBottom();
  }, [messageCount, isStreaming, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }, [inputValue]);

  // Handle send
  const handleSend = useCallback(
    async (content?: string) => {
      const text = (content ?? inputValue).trim();
      if (!text || isStreaming) return;

      setInputValue('');

      let chatId = activeChatId;

      // Auto-create chat if none active
      if (!chatId) {
        try {
          const newChat = await createChatMutation.mutateAsync();
          chatId = newChat.id;
        } catch {
          toast.error('Failed to create chat');
          return;
        }
      }

      sendMessageMutation.mutate({ content: text, chatId: chatId! });
    },
    [inputValue, isStreaming, activeChatId, createChatMutation, sendMessageMutation]
  );

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Select chat
  const handleSelectChat = (id: string) => {
    setActiveChat(id);
    setShowChatList(false);
    setLocalMessages([]);
  };

  // New chat
  const handleNewChat = () => {
    setActiveChat(null);
    setLocalMessages([]);
    setShowChatList(false);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => setShowChatList(!showChatList)}
            >
              <MessageCircle className="size-4" />
            </Button>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">
                {activeChatId
                  ? chats?.find((c) => c.id === activeChatId)?.title ?? 'Chat'
                  : 'AI Tutor'}
              </h3>
              {activeChatId && (
                <p className="text-[11px] text-muted-foreground">
                  {displayMessages.length} messages
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={handleNewChat}
                >
                  <MessageSquarePlus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Chat</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Chat list overlay */}
        <AnimatePresence>
          {showChatList && (
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute inset-0 z-20 bg-background border-r"
            >
              <ChatListSidebar
                notebookId={notebookId!}
                onSelectChat={handleSelectChat}
                activeChatId={activeChatId}
                onNewChat={handleNewChat}
                onClose={() => setShowChatList(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages area */}
        {!activeChatId ? (
          <WelcomeScreen onSend={(text) => handleSend(text)} />
        ) : (
          <div className="flex-1 overflow-y-auto" ref={scrollRef as React.RefObject<HTMLDivElement>}>
            <div className="p-4 space-y-4 max-w-3xl mx-auto">
              {messagesLoading && displayMessages.length === 0 ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="size-7 rounded-full shrink-0 mt-1" />
                      <Skeleton className="h-20 w-3/4 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : displayMessages.length === 0 && !isStreaming ? (
                <div className="text-center py-12">
                  <Sparkles className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Send a message to start the conversation
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {displayMessages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                </AnimatePresence>
              )}

              {/* Typing indicator */}
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="size-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-1">
                    <Bot className="size-3.5" />
                  </div>
                  <div className="bg-card border rounded-xl rounded-tl-sm shadow-sm px-4">
                    <TypingDots />
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="shrink-0 border-t p-3 bg-background">
          <div className="flex items-end gap-2 max-w-full">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isStreaming
                    ? 'AI is thinking...'
                    : 'Ask about your syllabus...'
                }
                disabled={isStreaming || createChatMutation.isPending}
                rows={1}
                className="w-full resize-none rounded-xl border bg-card px-4 py-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring transition-all placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50 max-h-[160px] min-h-[44px]"
              />
            </div>
            <Button
              size="icon"
              className="size-10 rounded-xl shrink-0"
              disabled={
                (!inputValue.trim() && !isStreaming) ||
                isStreaming ||
                createChatMutation.isPending
              }
              onClick={() => handleSend()}
            >
              {isStreaming ? (
                <span className="sr-only">Sending</span>
              ) : (
                <Send className="size-4" />
              )}
              {isStreaming && (
                <motion.div
                  className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}