# StudyAI
## AI Study Platform — University Exam Preparation Assistant
An intelligent, AI-powered study companion designed to help university students prepare for exams through personalized tutoring, syllabus analysis, and exam-pattern-based learning.

### 🎯 Features
- AI Tutoring Chat — Conversational AI tutor with streaming responses that follows a 3-phase teaching approach: Syllabus Understanding → PYQ Analysis → Exam-Oriented Teaching
- Syllabus Management — Upload syllabus, organize units and topics, track completion progress
- Previous Year Question (PYQ) Analysis — AI analyzes past exam papers to identify exam patterns, frequently asked topics, and marks distribution
- Exam-Oriented Answers — Teaches in format matching university exam requirements (long answers, short answers, MCQs)
- Document Upload — Upload PDFs, notes, and reference materials for context-aware tutoring
- Quiz Generation — AI-generated quizzes with multiple question types (MCQ, true/false, short/long answer)
- Flashcard System — Spaced repetition flashcards for memorization and revision
- Note-taking — AI-assisted note generation with markdown editor
- Web Search & Diagrams — AI fetches relevant diagrams and images from the web to support visual learning
- Study Analytics — Track study sessions, quiz performance, and progress across units
- Progressive Streaming — Real-time token-by-token AI responses for instant feedback

### 🛠️ Tech Stack
- Layer	Technology
- Framework	Next.js 16 (App Router)
- Language	TypeScript 5
- Styling	Tailwind CSS 4 + shadcn/ui
- Database	SQLite via Prisma ORM
- State Management	Zustand + TanStack Query
- Animations	Framer Motion
- AI Providers	Groq / OpenAI / Google Gemini / DeepSeek (configurable)
- Deployment	Docker + AWS EC2
- CI/CD	GitHub Actions (auto-deploy on push)

### 🏗️ Architecture
```
┌─────────────────────────────────────────────┐
│ Frontend │
│ React 19 + Tailwind CSS + shadcn/ui │
│ Zustand (client state) + React Query (server)│
└──────────────────┬──────────────────────────┘
│ REST API + SSE (streaming)
┌──────────────────▼──────────────────────────┐
│ Next.js API Routes │
│ Auth • Notebooks • Chats • Quizzes • Notes │
└──────────┬──────────────┬───────────────────┘
│ │
┌──────────▼──────┐ ┌─────▼──────────────────┐
│ Prisma ORM │ │ AI Provider Layer │
│ (SQLite) │ │ Groq/OpenAI/Gemini │
└─────────────────┘ └───────────────────────┘
```


## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm or bun

### Installation
```bash
git clone https://github.com/AshishShah-22/aiAssistLearning.git
cd aiAssistLearning
npm install
npx prisma db push
npx prisma generate
npm run dev
Open http://localhost:3000 in your browser.
```

Environment Variables
Create a .env file (see .env.example):

env

DATABASE_URL=file:./db/custom.db
AI_PROVIDER=groq
GROQ_API_KEY=your_api_key
GROQ_MODEL=llama-3.3-70b-versatile
🐳 Docker Deployment
bash

# Build and run
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
☁️ AWS Deployment
The application is deployed on AWS EC2 with:

Docker for containerization
GitHub Actions for CI/CD (auto-deploy on push to main)
SQLite with volume persistence for database
CI/CD Pipeline
text

git push → GitHub → Actions → SSH to EC2 → git pull → docker-compose up --build -d
🔒 Security
API keys stored in environment variables, never in code
.env files excluded from version control via .gitignore
Session-based authentication with scrypt password hashing
Server-side AI processing only (no SDK exposure to client)
📸 Screenshots
<img width="1097" height="769" alt="image" src="https://github.com/user-attachments/assets/f15be08d-9938-4a55-ade0-ef7163858585" />


📝 License
This project is developed for academic purposes.

### This webiste link — http://16.170.35.248:3000 check karo.

<img width="1085" height="784" alt="image" src="https://github.com/user-attachments/assets/1a23c2e6-4ef3-4941-be25-e1dd09606598" />

