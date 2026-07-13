'use client';

import { useState } from 'react';
import type { SidebarPanel } from '@/types';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MessageSquare,
  BookOpen,
  FileText,
  StickyNote,
  HelpCircle,
  Layers,
  RotateCcw,
  Link2,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  id: SidebarPanel;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'syllabus', label: 'Syllabus', icon: BookOpen },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'revision', label: 'Revision', icon: RotateCcw },
  { id: 'resources', label: 'Resources', icon: Link2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function SidebarNavContent({
  collapsed,
  activePanel,
  onSelectPanel,
}: {
  collapsed: boolean;
  activePanel: SidebarPanel;
  onSelectPanel: (panel: SidebarPanel) => void;
}) {
  return (
    <ScrollArea className="flex-1">
      <nav className="flex flex-col gap-1 p-2" role="navigation" aria-label="Notebook navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;

          const button = (
            <button
              key={item.id}
              onClick={() => onSelectPanel(item.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'w-full text-left',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </nav>
    </ScrollArea>
  );
}

function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const activePanel = useAppStore((s) => s.sidebarPanel);
  const setSidebarPanel = useAppStore((s) => s.setSidebarPanel);

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r bg-background transition-[width] duration-200 ease-in-out h-full',
        collapsed ? 'w-14' : 'w-[260px]'
      )}
    >
      {/* Sidebar header with collapse toggle */}
      <div className="flex items-center justify-between p-2 h-10 flex-shrink-0">
        {!collapsed && (
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
            Navigate
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn('h-7 w-7', collapsed && 'mx-auto')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <PanelLeftClose className="size-3.5" />
          )}
        </Button>
      </div>

      <Separator />

      <SidebarNavContent
        collapsed={collapsed}
        activePanel={activePanel}
        onSelectPanel={(panel) => {
          setSidebarPanel(panel);
        }}
      />
    </aside>
  );
}

function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const activePanel = useAppStore((s) => s.sidebarPanel);
  const setSidebarPanel = useAppStore((s) => s.setSidebarPanel);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[260px] p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle>Navigate</SheetTitle>
        </SheetHeader>
        <SidebarNavContent
          collapsed={false}
          activePanel={activePanel}
          onSelectPanel={(panel) => {
            setSidebarPanel(panel);
            setOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

export function NotebookSidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  );
}