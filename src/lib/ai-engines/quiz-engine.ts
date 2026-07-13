import { aiChat } from '@/lib/ai-provider';
import type { QuizGeneration, QuestionType, Difficulty } from '@/types';

// ─── Prompts ───────────────────────────────────────────
const QUIZ_SYSTEM_PROMPT = `You are an expert assessment creator. Generate quiz questions based on the given scope, difficulty, and reference materials.

Question type guidelines:
- "mcq": Multiple choice question with exactly 4 options (A, B, C, D). correctAnswer must be the option letter (e.g., "A") or the full option text.
- "true_false": A statement the student must evaluate. correctAnswer is "true" or "false".
- "short_answer": A question requiring 1-3 sentence answer. correctAnswer is the expected answer text.
- "long_answer": A question requiring a detailed explanation or essay. correctAnswer is a model answer with key points.

Difficulty levels:
- "easy": Basic recall, definitions, simple concepts
- "medium": Application of concepts, analysis, comparisons
- "hard": Synthesis, evaluation, complex problem-solving

For each question, provide a clear explanation of why the correct answer is right. This helps students learn from the quiz.

Respond with valid JSON ONLY, matching this exact structure:
{
  "title": "Descriptive quiz title",
  "questions": [
    {
      "type": "mcq" | "true_false" | "short_answer" | "long_answer",
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "The correct answer",
      "explanation": "Explanation of why this is correct",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}

Rules:
- For "mcq", the "options" array must have exactly 4 items. correctAnswer should be the full text of the correct option.
- For "true_false", do NOT include an "options" field (omit it or set to null).
- For "short_answer" and "long_answer", do NOT include an "options" field (omit it or set to null).
- Distribute difficulty levels appropriately across questions.
- Mix question types when possible for a richer assessment.
- Generate exactly the requested number of questions.
- All questions must be relevant to the scope and reference materials provided.`;

const MAX_RETRIES = 2;

// ─── Engine ────────────────────────────────────────────
export async function generateQuiz(params: {
  scope: string;
  difficulty: string;
  questionCount: number;
  syllabusContext: string;
  notebookContent: string;
}): Promise<QuizGeneration> {
  const { scope, difficulty, questionCount, syllabusContext, notebookContent } = params;

  // Build the user prompt
  const contextParts: string[] = [];

  if (syllabusContext.trim()) {
    contextParts.push(`SYLLABUS CONTEXT:\n${syllabusContext}`);
  }

  if (notebookContent.trim()) {
    contextParts.push(`REFERENCE MATERIALS / NOTES:\n${notebookContent}`);
  }

  const contextBlock = contextParts.length > 0
    ? `\n\n${contextParts.join('\n\n---\n')}`
    : '';

  const userPrompt = `Generate a quiz with the following parameters:

- Scope: ${scope}
- Difficulty: ${difficulty}
- Number of questions: ${questionCount}
${contextBlock}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await aiChat([
        { role: 'system', content: QUIZ_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      const raw = response.content;
      if (!raw) {
        throw new Error('AI returned an empty response for quiz generation');
      }

      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const parsed: QuizGeneration = JSON.parse(cleaned);

      // Validate
      if (!parsed.title || typeof parsed.title !== 'string') {
        throw new Error('Parsed quiz missing "title" field');
      }
      if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error('Parsed quiz has no questions');
      }

      // Normalize and validate each question
      const validTypes: QuestionType[] = ['mcq', 'true_false', 'short_answer', 'long_answer'];
      const validDifficulties: Difficulty[] = ['easy', 'medium', 'hard'];

      parsed.questions = parsed.questions.map((q, idx) => {
        // Ensure type is valid
        if (!validTypes.includes(q.type)) {
          q.type = 'mcq';
        }

        // For MCQ, ensure options exist and have 4 items
        if (q.type === 'mcq') {
          if (!Array.isArray(q.options) || q.options.length < 4) {
            q.options = q.options && q.options.length > 0
              ? [...q.options, 'None of the above'].slice(0, 4)
              : ['Option A', 'Option B', 'Option C', 'Option D'];
          }
        } else {
          // Non-MCQ questions should not have options
          q.options = undefined;
        }

        // Ensure difficulty is valid
        if (!validDifficulties.includes(q.difficulty)) {
          q.difficulty = difficulty as Difficulty || 'medium';
        }

        // Ensure explanation exists
        if (!q.explanation) {
          q.explanation = 'Review the reference materials for this topic.';
        }

        // Ensure correctAnswer exists
        if (!q.correctAnswer) {
          q.correctAnswer = 'N/A';
        }

        return q;
      });

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[QuizEngine] Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  console.error('[QuizEngine] All retries exhausted');
  throw lastError || new Error('Quiz generation failed after all retries');
}