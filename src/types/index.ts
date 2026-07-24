// ─── Enums ────────────────────────────────────────────
export type NotebookStatus = "setup" | "active" | "completed" | "archived";
export type ItemStatus = "not_started" | "in_progress" | "completed";
export type Difficulty = "easy" | "medium" | "hard";
export type TopicScope = "topic" | "unit" | "syllabus" | "weak_areas";
export type QuestionType = "mcq" | "true_false" | "short_answer" | "long_answer" | "coding";
export type FlashcardType = "qa" | "definition" | "formula" | "concept" | "example";
export type NoteType = "general" | "summary" | "exam" | "revision" | "formula";
export type ResourceType = "book" | "paper" | "documentation" | "video" | "article" | "blog" | "practice" | "uploaded";
export type ActivityType = "read" | "quiz" | "chat" | "flashcard" | "revision" | "notes";
export type DocumentType = "pdf" | "docx" | "txt" | "md";

// ─── Database Models ──────────────────────────────────
export interface Notebook {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string;
  status: NotebookStatus;
  currentUnitId: string | null;
  currentTopicId: string | null;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
  units?: Unit[];
  documents?: Document[];
  chats?: Chat[];
  notes?: Note[];
  flashcardDecks?: FlashcardDeck[];
  quizzes?: Quiz[];
  _count?: {
    units: number;
    documents: number;
    chats: number;
    quizzes: number;
    notes: number;
  };
}

export interface Unit {
  id: string;
  notebookId: string;
  title: string;
  description: string | null;
  order: number;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
  topics?: Topic[];
}

export interface Topic {
  id: string;
  unitId: string;
  title: string;
  description: string | null;
  content: string | null;
  difficulty: Difficulty;
  order: number;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  notebookId: string;
  filename: string;
  fileType: DocumentType;
  fileSize: number;
  content: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  notebookId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: string | null;
  createdAt: string;
}

export interface Note {
  id: string;
  notebookId: string;
  topicId: string | null;
  title: string;
  content: string;
  type: NoteType;
  isAiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardDeck {
  id: string;
  notebookId: string;
  topicId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  flashcards?: Flashcard[];
}

export interface Flashcard {
  id: string;
  deckId: string;
  topicId: string | null;
  front: string;
  back: string;
  type: FlashcardType;
  difficulty: Difficulty;
  reviewCount: number;
  correctCount: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Quiz {
  id: string;
  notebookId: string;
  title: string;
  scope: TopicScope;
  scopeRefId: string | null;
  difficulty: Difficulty;
  questionCount: number;
  createdAt: string;
  questions?: Question[];
  attempts?: QuizAttempt[];
}

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  question: string;
  options: string | null;  // JSON array for MCQ
  correctAnswer: string;
  explanation: string | null;
  difficulty: Difficulty;
  order: number;
  topicId: string | null;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: string;
  score: number;
  totalQuestions: number;
  timeSpent: number;
  createdAt: string;
}

export interface Resource {
  id: string;
  notebookId: string;
  topicId: string | null;
  title: string;
  url: string | null;
  type: ResourceType;
  description: string | null;
  source: string | null;
  isAutoFound: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudySession {
  id: string;
  notebookId: string;
  userId: string;
  topicId: string | null;
  activityType: ActivityType;
  duration: number;
  metadata: string | null;
  createdAt: string;
}

export interface Progress {
  id: string;
  notebookId: string;
  targetId: string;
  targetType: "unit" | "topic";
  percentComplete: number;
  resourcesRead: number;
  quizzesTaken: number;
  avgQuizScore: number;
  studyMinutes: number;
  lastActivityAt: string | null;
  updatedAt: string;
}

// ─── AI Engine Types ──────────────────────────────────
export interface SyllabusAnalysis {
  units: {
    title: string;
    description: string;
    topics: {
      title: string;
      description: string;
      difficulty: Difficulty;
      prerequisites: string[];
    }[];
  }[];
  estimatedDuration: string;
  difficulty: string;
}

export interface QuizGeneration {
  title: string;
  questions: {
    type: QuestionType;
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
    difficulty: Difficulty;
  }[];
}

export interface FlashcardGeneration {
  title: string;
  flashcards: {
    front: string;
    back: string;
    type: FlashcardType;
    difficulty: Difficulty;
  }[];
}

// ─── API Request/Response Types ───────────────────────
export interface CreateNotebookRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface AnalyzeSyllabusRequest {
  notebookId: string;
  syllabusText: string;
}

export interface SendMessageRequest {
  chatId: string;
  notebookId: string;
  content: string;
}

export interface GenerateQuizRequest {
  notebookId: string;
  scope: TopicScope;
  scopeRefId?: string;
  difficulty?: Difficulty;
  questionCount?: number;
}

export interface GenerateFlashcardsRequest {
  notebookId: string;
  topicId?: string;
  count?: number;
}

export interface GenerateNotesRequest {
  notebookId: string;
  topicId?: string;
  type?: NoteType;
}

// ─── Sidebar Types ────────────────────────────────────
export type SidebarPanel = "chat" | "syllabus" | "documents" | "notes" | "quiz" | "flashcards" | "revision" | "resources" | "analytics" | "settings";

export interface DashboardStats {
  totalNotebooks: number;
  activeNotebooks: number;
  completedNotebooks: number;
  totalStudyMinutes: number;
  totalQuizzesTaken: number;
  avgQuizScore: number;
  streakDays: number;
  notebooksCreatedThisWeek: number;
}

// ─── View State ───────────────────────────────────────
export type AppView = "dashboard" | "notebook" | "setup";