import { aiChat } from '@/lib/ai-provider';
import type { FlashcardGeneration, FlashcardType, Difficulty } from '@/types';

// ─── Prompts ───────────────────────────────────────────
const FLASHCARD_SYSTEM_PROMPT = `You are an expert at creating educational flashcards. Your goal is to generate concise, effective flashcards that help students learn and retain key information.

Flashcard type guidelines:
- "qa": A question on the front, answer on the back. Best for testing recall of specific facts.
- "definition": A term or concept on the front, its definition on the back. Best for vocabulary and key terms.
- "formula": A formula name or description on the front, the formula itself on the back. Best for math/science.
- "concept": A concept name on the front, an explanation of the concept on the back. Best for understanding ideas.
- "example": A scenario or problem description on the front, the step-by-step solution on the back. Best for application.

Difficulty levels:
- "easy": Basic definitions, simple facts
- "medium": Concepts requiring understanding, moderate formulas
- "hard": Complex concepts, multi-step problems, nuanced distinctions

Guidelines:
- Keep front text concise (ideally under 15 words).
- Back text should be complete and informative but not overly long.
- Use markdown formatting where helpful (e.g., LaTeX-style math in $...$ for formulas).
- Distribute difficulty levels appropriately.
- Mix flashcard types for a varied study experience.
- Each flashcard should test one clear concept or fact.

Respond with valid JSON ONLY, matching this exact structure:
{
  "title": "Descriptive deck title summarizing the topic",
  "flashcards": [
    {
      "front": "Concise front text",
      "back": "Detailed back text with the answer/definition/explanation",
      "type": "qa" | "definition" | "formula" | "concept" | "example",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}

Rules:
- Generate exactly the requested number of flashcards.
- All content must be relevant to the provided topic and reference materials.
- Do not include any explanation outside the JSON.`;

const MAX_RETRIES = 2;

// ─── Engine ────────────────────────────────────────────
export async function generateFlashcards(params: {
  topicContent: string;
  notebookContext: string;
  count: number;
}): Promise<FlashcardGeneration> {
  const { topicContent, notebookContext, count } = params;

  // Build the user prompt
  const contextParts: string[] = [];

  if (notebookContext.trim()) {
    contextParts.push(`REFERENCE MATERIALS / NOTES:\n${notebookContext}`);
  }

  const contextBlock = contextParts.length > 0
    ? `\n\n${contextParts.join('\n\n---\n')}`
    : '';

  const userPrompt = `Generate ${count} flashcards for the following topic:

TOPIC CONTENT:
${topicContent}
${contextBlock}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await aiChat([
        { role: 'system', content: FLASHCARD_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      const raw = response.content;
      if (!raw) {
        throw new Error('AI returned an empty response for flashcard generation');
      }

      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const parsed: FlashcardGeneration = JSON.parse(cleaned);

      // Validate
      if (!parsed.title || typeof parsed.title !== 'string') {
        throw new Error('Parsed flashcards missing "title" field');
      }
      if (!Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) {
        throw new Error('Parsed flashcard deck has no flashcards');
      }

      // Normalize and validate each flashcard
      const validTypes: FlashcardType[] = ['qa', 'definition', 'formula', 'concept', 'example'];
      const validDifficulties: Difficulty[] = ['easy', 'medium', 'hard'];

      parsed.flashcards = parsed.flashcards.map((card) => {
        if (!card.front) card.front = 'Unknown';
        if (!card.back) card.back = 'No answer provided';

        if (!validTypes.includes(card.type)) {
          card.type = 'qa';
        }

        if (!validDifficulties.includes(card.difficulty)) {
          card.difficulty = 'medium';
        }

        return card;
      });

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[FlashcardEngine] Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  console.error('[FlashcardEngine] All retries exhausted');
  throw lastError || new Error('Flashcard generation failed after all retries');
}