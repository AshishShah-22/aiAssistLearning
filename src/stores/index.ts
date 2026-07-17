import { create } from "zustand";
import type { Notebook, AppView, SidebarPanel, Chat, Message, Unit, Topic } from "@/types";

// ─── Auth Store ──────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => {
    fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    set({ user: null, isAuthenticated: false });
  },
}));

// ─── App Store (global navigation) ────────────────────
interface AppState {
  view: AppView;
  currentNotebookId: string | null;
  sidebarPanel: SidebarPanel;
  setView: (view: AppView) => void;
  openNotebook: (notebookId: string) => void;
  setSidebarPanel: (panel: SidebarPanel) => void;
  goToDashboard: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "dashboard",
  currentNotebookId: null,
  sidebarPanel: "chat",
  setView: (view) => set({ view }),
  openNotebook: (notebookId) => {
  useChatStore.getState().reset();
  set({ view: "notebook", currentNotebookId: notebookId, sidebarPanel: "chat" });
},
  setSidebarPanel: (panel) => set({ sidebarPanel: panel }),
  goToDashboard: () => set({ view: "dashboard", currentNotebookId: null }),
}));

// ─── Notebook Store (current notebook data) ───────────
interface NotebookState {
  notebook: Notebook | null;
  units: Unit[];
  currentUnit: Unit | null;
  currentTopic: Topic | null;
  setNotebook: (notebook: Notebook) => void;
  setUnits: (units: Unit[]) => void;
  setCurrentUnit: (unit: Unit | null) => void;
  setCurrentTopic: (topic: Topic | null) => void;
  reset: () => void;
}

export const useNotebookStore = create<NotebookState>((set) => ({
  notebook: null,
  units: [],
  currentUnit: null,
  currentTopic: null,
  setNotebook: (notebook) => set({ notebook }),
  setUnits: (units) => set({ units }),
  setCurrentUnit: (unit) => set({ currentUnit: unit }),
  setCurrentTopic: (topic) => set({ currentTopic: topic }),
  reset: () => set({ notebook: null, units: [], currentUnit: null, currentTopic: null }),
}));

// ─── Chat Store ───────────────────────────────────────
interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  messages: Message[];
  isStreaming: boolean;
  setChats: (chats: Chat[]) => void;
  setActiveChat: (chatId: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastAssistantMessage: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  messages: [],
  isStreaming: false,
  setChats: (chats) => set({ chats }),
  setActiveChat: (chatId) => set({ activeChatId: chatId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  updateLastAssistantMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const lastIdx = msgs.findLastIndex((m) => m.role === "assistant");
      if (lastIdx >= 0) msgs[lastIdx] = { ...msgs[lastIdx], content };
      return { messages: msgs };
    }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  reset: () => set({ chats: [], activeChatId: null, messages: [], isStreaming: false }),
}));