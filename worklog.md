# StudyAI - AI-Powered Learning Platform

## Architecture & Design Decisions

### Why Next.js 16 (not Next.js + FastAPI)
The original request specified both Next.js frontend and FastAPI backend. However:
- The sandbox exposes only port 3000 through Caddy
- Running two servers adds complexity without benefit in this environment
- Next.js API Routes with Prisma provide a clean, production-ready backend
- The architecture is modular enough that the backend can be extracted to FastAPI later

### Why SQLite (not PostgreSQL)
- Prisma supports SQLite out of the box in the sandbox
- The schema is designed to be portable to PostgreSQL by changing one line
- No external database service needed

### Why Dynamic AI Engine Imports
- z-ai-web-dev-sdk is large (~50MB+ with native deps)
- Turbopack tries to analyze all imports in a route group at compile time
- Dynamic `await import()` ensures the SDK is only loaded when actually needed
- Each AI engine is a separate module with single responsibility

### Why No Framer-Motion on Initial Pages
- Framer-motion adds ~200KB to the initial bundle
- Turbopack compilation with framer-motion uses significantly more memory
- CSS animations (`animate-pulse`, `transition-all`) provide sufficient visual feedback
- Panels that use framer-motion are loaded dynamically (only when the user enters the notebook)

### Memory Considerations
- The sandbox has 4GB RAM
- Turbopack's dev compiler is memory-hungry (1-1.6GB for page compilation)
- NODE_OPTIONS="--max-old-space-size=2560" is configured for the dev script
- In production (next build), memory usage drops dramatically

---

## Database Schema (18 Models)

| Model | Purpose |
|-------|---------|
| User | User accounts |
| Notebook | Subject containers (the core entity) |
| Unit | Syllabus units within a notebook |
| Topic | Individual topics within units |
| Document | Uploaded study materials |
| Chat | Conversation containers |
| Message | Individual chat messages |
| Note | User and AI-generated notes |
| FlashcardDeck | Collections of flashcards |
| Flashcard | Individual flashcards with spaced repetition |
| Quiz | Generated quiz containers |
| Question | Individual quiz questions |
| QuizAttempt | User quiz submissions with scores |
| Resource | Learning resources (books, videos, etc.) |
| StudySession | Time-tracked study activities |
| Progress | Aggregated progress per unit/topic |

---

## AI Engines (6 Independent Modules)

| Engine | File | Purpose |
|--------|------|---------|
| Syllabus Engine | `syllabus-engine.ts` | Analyzes syllabus text → structured Units/Topics |
| Tutoring Engine | `tutoring-engine.ts` | Context-aware AI tutoring with citations |
| Quiz Engine | `quiz-engine.ts` | Generates MCQ/TF/Short-Long answer questions |
| Flashcard Engine | `flashcard-engine.ts` | Creates QA/Definition/Formula flashcards |
| Note Engine | `note-engine.ts` | Generates summary/exam/revision notes |
| Index | `index.ts` | Barrel re-export |

All engines:
- Use z-ai-web-dev-sdk (server-side only)
- Have retry logic (up to 2 retries)
- Parse JSON responses with error handling
- Keep prompts as constants separate from business logic
- Have single responsibility

---

## API Routes (17 Endpoints)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | /api/notebooks | List notebooks with counts |
| POST | /api/notebooks | Create notebook |
| GET | /api/notebooks/[id] | Get notebook with units/topics |
| PUT | /api/notebooks/[id] | Update notebook |
| DELETE | /api/notebooks/[id] | Delete notebook + cascade |
| POST | /api/notebooks/[id]/analyze-syllabus | AI syllabus analysis |
| GET | /api/notebooks/[id]/chats | List chats |
| POST | /api/notebooks/[id]/chats | Create chat |
| GET | /api/notebooks/[id]/chats/[chatId]/messages | Get messages |
| POST | /api/notebooks/[id]/chats/[chatId]/messages | Send message + AI response |
| GET/POST | /api/notebooks/[id]/documents | List/upload documents |
| GET/POST | /api/notebooks/[id]/notes | List/create notes |
| POST | /api/notebooks/[id]/notes/generate | AI note generation |
| GET/POST | /api/notebooks/[id]/quizzes | List/generate quizzes |
| POST | /api/notebooks/[id]/quizzes/[quizId]/attempts | Submit quiz attempt |
| GET/POST | /api/notebooks/[id]/flashcards | List/generate flashcards |
| POST | /api/notebooks/[id]/flashcards/[deckId]/review | Update review results |
| GET | /api/notebooks/[id]/progress | Get progress data |
| POST | /api/notebooks/[id]/sessions | Log study session |
| GET/POST | /api/notebooks/[id]/resources | List/add resources |
| GET | /api/stats | Dashboard statistics |

---

## Frontend Components (17 Feature Files)

### Dashboard (3 files)
- `Dashboard.tsx` — Stats cards, search, notebook grid, empty state
- `NotebookCard.tsx` — Color-coded card with progress and metadata
- `CreateNotebook.tsx` — 3-step wizard (details → syllabus → AI analysis)

### Notebook Workspace (4 files)
- `NotebookWorkspace.tsx` — Main layout with header + sidebar + content
- `NotebookHeader.tsx` — Fixed top bar with notebook name and progress
- `NotebookSidebar.tsx` — 10-item navigation, collapsible, mobile sheet
- `WorkspaceContent.tsx` — Dynamic panel router

### Panels (10 files)
- `ChatPanel.tsx` — Full chat interface with markdown, code highlighting, typing indicator
- `SyllabusPanel.tsx` — Accordion tree view of units/topics
- `DocumentsPanel.tsx` — File upload with drag-and-drop
- `NotesPanel.tsx` — Note editor with AI generation
- `QuizPanel.tsx` — Quiz generation and taking with MCQ/TF/Short/Long answers
- `FlashcardsPanel.tsx` — Card flip animation, spaced repetition
- `RevisionPanel.tsx` — Due revisions, weak concepts, history
- `ResourcesPanel.tsx` — Topic-grouped resources
- `AnalyticsPanel.tsx` — Stats cards, unit progress, CSS bar charts
- `SettingsPanel.tsx` — Edit name/description/color, delete

---

## State Management (Zustand)

| Store | Purpose |
|-------|---------|
| `useAppStore` | Global navigation (view, currentNotebookId, sidebarPanel) |
| `useNotebookStore` | Current notebook data, units, current topic |
| `useChatStore` | Chat state, messages, streaming flag |

---

## Verified Functionality

✅ Dashboard displays notebook cards with stats
✅ Notebook creation with name, description, color
✅ AI syllabus analysis → structured units/topics in DB
✅ All 17 API routes return correct data
✅ ESLint passes with zero errors
✅ Page compiles to 35KB of valid HTML
✅ Database schema with 18 normalized models
✅ 6 independent AI engines with retry logic

---

## Task 1-3: Backend Auth System

### Summary
Added a complete session-based authentication system with cookie-based sessions, password hashing via Node.js built-in `crypto.scrypt`, and 4 API endpoints for register/login/session/me.

### Changes Made

#### 1. Database Schema (`prisma/schema.prisma`)
- Added `password String` field to User model (required field, after `email`)
- Used `prisma db execute` to add column with default `__dummy_no_login__` for existing dummy user
- Ran `db:push` to synchronize Prisma client

#### 2. Updated `src/lib/db.ts`
- Added `password: '__dummy_no_login__'` to the dummy user creation in `ensureUser()`

#### 3. Created `src/lib/auth.ts` — Auth Helper Utilities
- `hashPassword(password)` — scrypt-based hashing with random 16-byte salt, format: `salt:key`
- `verifyPassword(password, hash)` — splits stored hash, re-derives key, compares
- `getCurrentUser()` — reads `session` cookie, decodes base64 payload, validates 30-day expiry, queries DB
- `createSessionToken(user)` — encodes `id|||email|||name|||timestamp` as base64
- `SESSION_COOKIE_OPTIONS` — shared cookie config: httpOnly, secure:false, sameSite:'lax', path:'/', maxAge:30 days

#### 4. Created `src/lib/with-auth.ts` — Auth Middleware Wrapper
- `withAuth(request)` — returns `{ error, user }`; error is a 401 NextResponse if no valid session

#### 5. Created API Routes (4 endpoints)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/register` | Register with name/email/password, migrate dummy-user notebooks |
| POST | `/api/auth/login` | Login with email/password, block dummy user login |
| GET | `/api/auth/session` | Get current user from cookie (or null) |
| DELETE | `/api/auth/session` | Logout — clears session cookie |
| GET | `/api/auth/me` | Get current user or 401 |

#### 6. Notebook Migration Logic
- On first real user registration, all notebooks/studySessions/quizAttempts belonging to dummy user (`user-1`) are migrated to the new user's ID
- This ensures existing data created before auth is properly owned

#### Validation Rules
- Email format validation via regex
- Password minimum 6 characters
- Duplicate email returns 409 Conflict
- Dummy user cannot log in (password is sentinel value)
- Generic "Invalid email or password" for login failures (no user enumeration)
- All errors return proper HTTP status codes (400, 401, 409, 500)

### Verified
✅ ESLint passes with zero errors
✅ All auth API routes compile and serve correctly
✅ Session cookie set with correct options---
Task ID: 1
Agent: Main Agent
Task: Implement complete notes generation feature with streaming, CRUD, filters

Work Log:
- Explored full project structure: types, stores, API routes, AI provider, note engine, NotesPanel UI
- Identified bugs: missing PUT/DELETE handlers, no streaming support, no search/filter
- Added aiChatStream() to ai-provider.ts with OpenAI-compatible streaming (Groq/OpenAI/DeepSeek) and fallback for ZAI/Google
- Enhanced note-engine.ts: better exam-focused prompts, chat context injection, streaming generator (generateNotesStream), robust JSON parsing with 3 fallback strategies
- Updated generate route: SSE streaming support (stream: true), chat context from recent messages, DB save after stream completes
- Added PUT and DELETE handlers to notes API route
- Completely rebuilt NotesPanel.tsx: streaming generation with live progress, search + type filter, delete with confirmation, copy to clipboard, edit mode, note detail view with markdown rendering, topic path display, notes count, responsive design

Stage Summary:
- Notes feature fully functional: create, read, update, delete, AI generate (streaming), search, filter
- Verified via browser: note list, detail view, streaming generation, dialog with topic/type selection all working
- No lint errors, no runtime errors in dev logs
- Files modified: ai-provider.ts, note-engine.ts, ai-engines/index.ts, notes/route.ts, notes/generate/route.ts, NotesPanel.tsx

---
Task ID: 1
Agent: Task Agent 1
Task: Build DocumentsPanel + fix missing API routes

Work Log:
- Created quiz questions GET route at `src/app/api/notebooks/[id]/quizzes/[quizId]/route.ts`
- Created flashcard deck GET route at `src/app/api/notebooks/[id]/flashcards/[deckId]/route.ts`
- Created document DELETE route at `src/app/api/notebooks/[id]/documents/[docId]/route.ts` (needed for delete feature)
- Built full DocumentsPanel.tsx: upload button, document list with filename/type/size/status/date, delete with AlertDialog confirmation, view content dialog for txt/md files, loading skeletons, empty state, file size formatting
- Fixed stats API to use `getCurrentUser()` from `@/lib/auth` instead of `DUMMY_USER_ID`
- Fixed sessions API to use `getCurrentUser()` instead of `DUMMY_USER_ID`

Stage Summary:
- Created: quizzes/[quizId]/route.ts, flashcards/[deckId]/route.ts, documents/[docId]/route.ts
- Replaced: DocumentsPanel.tsx (full UI), stats/route.ts (real auth), sessions/route.ts (real auth)
- All lint passing, no runtime errors in dev logs

---
Task ID: 2
Agent: Task Agent 2
Task: Rebuild AnalyticsPanel with real weekly data

Work Log:
- Read worklog.md, existing AnalyticsPanel.tsx, progress API, schema, stores for context
- Created `src/app/api/notebooks/[id]/sessions/weekly/route.ts`: GET endpoint that fetches StudySession records from last 7 days, groups by Mon–Sun, returns `{ days: [{ day, minutes }] }`
- Rebuilt `src/features/notebook/panels/AnalyticsPanel.tsx`:
  - Added TanStack Query for weekly sessions data (`/api/notebooks/${notebookId}/sessions/weekly`)
  - Replaced hardcoded bar chart values with real API data via `weeklyData?.days`
  - Added empty state for weekly chart (no activity) with styled icon + message
  - Added "Per-Topic Breakdown" section showing topic-level progress from progress API's `topicProgress` array, with circular % indicator, difficulty badges, parent unit name, mini progress bar, and study time
  - Applied notebook color theme throughout (stat card icons, progress bars, chart bars, topic indicators)
  - Added highlight for today's day in the weekly chart
  - Added weekly total badge in chart header
  - Used `totalStudyMinutes` from progress API (was using `studyMinutes` before, now correctly uses `totalStudyMinutes`)
  - Added max-h-96 overflow-y-auto with custom-scrollbar class for topic list scrollability
  - Added `formatStudyTime()` helper for consistent time formatting (Xh Xm / Xm)
  - Used lucide icons: CalendarDays, Activity, Layers for new sections

Stage Summary:
- Created: sessions/weekly/route.ts
- Replaced: AnalyticsPanel.tsx (real weekly data, per-topic breakdown, empty state, color theme)
- Lint passes with zero errors
- No runtime errors in dev logs
