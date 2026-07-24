import { aiChat, aiChatStream, ChatMessage } from '@/lib/ai-provider';

// ─── Prompts ───────────────────────────────────────────
const NOTE_SYSTEM_PROMPT = `You are an expert exam-focused study notes creator for university students. Your notes help students score high in exams.

Note type guidelines:
- "summary": Concise overview. Big picture, main ideas, takeaways. Bullet points + brief paragraphs.
- "detailed": Comprehensive in-depth notes. Explanations, examples, sub-sections. Thorough coverage.
- "exam": Exam-optimized notes. Key definitions, common exam patterns, likely questions, tips, mnemonics. Prioritize what's most testable. Include "Expected Questions" section.
- "revision": Quick-reference revision notes. Condensed bullet lists, bold key terms, comparison tables, memory aids. Scan-able in 5 mins.
- "formula": Formula/equation/theorem sheet. Formula definitions, variable explanations, worked examples, common traps.

CRITICAL FORMATTING RULES:
- Use markdown extensively: ## headings, ### sub-headings, bullet points, **bold key terms**, tables, code blocks
- For math/science formulas: use LaTeX within $...$ or $$...$$
- Use comparison tables for contrasting concepts
- Always end with a "## Key Takeaways" or "## Expected Questions" section
- Structure with clear hierarchy — a student should be able to scan and find any topic in seconds`;

const MAX_RETRIES = 2;

// ─── Build Messages ────────────────────────────────────
function buildNoteMessages(params: {
  topicContent: string;
  topicTitle: string;
  notebookContext: string;
  type: string;
  chatContext?: string;
}): ChatMessage[] {
  const { topicContent, topicTitle, notebookContext, type, chatContext } = params;

  const validTypes = ['summary', 'detailed', 'exam', 'revision', 'formula'];
  const noteType = validTypes.includes(type) ? type : 'summary';

  const typeInstructions: Record<string, string> = {
    summary: 'Create a CONCISE summary — cover the key points, skip deep details. Use bullet points primarily.',
    detailed: 'Create COMPREHENSIVE detailed notes — cover everything with explanations, examples, and sub-sections.',
    exam: 'Create EXAM-FOCUSED notes — prioritize definitions, formulas, likely questions, mnemonics. Add an "Expected Questions" section with 5-8 probable exam questions.',
    revision: 'Create QUICK REVISION notes — ultra-condensed, bullet-heavy, tables, memory aids. Should be scannable in under 5 minutes.',
    formula: 'Create a FORMULA SHEET — list all relevant formulas, define each variable, include 2-3 worked examples, note common mistakes.',
  };

  const contextParts: string[] = [];

  if (chatContext?.trim()) {
    contextParts.push(`CHAT DISCUSSION (student already learned these concepts):
${chatContext}`);
  }

  if (notebookContext.trim()) {
    contextParts.push(`SYLLABUS CONTEXT:
${notebookContext}`);
  }

  const contextBlock = contextParts.length > 0
    ? '\n\n---\n' + contextParts.join('\n\n---\n')
    : '';

  const userPrompt = `Generate **${noteType.toUpperCase()}** study notes for:

## Topic: ${topicTitle}

${topicContent || '(No detailed content provided — generate based on the topic name and syllabus context)'}
${contextBlock}

${typeInstructions[noteType] || ''}

IMPORTANT: Your response must be valid JSON with this exact structure:
{
  "title": "Descriptive note title",
  "content": "Full markdown content of the notes here"
}

The "content" field must contain the COMPLETE notes in markdown. Do NOT add any text outside the JSON.`;

  return [
    { role: 'system', content: NOTE_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}

// ─── Non-Streaming Engine ──────────────────────────────
export async function generateNotes(params: {
  topicContent: string;
  topicTitle: string;
  notebookContext: string;
  type: string;
  chatContext?: string;
}): Promise<{ title: string; content: string }> {
  const messages = buildNoteMessages(params);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await aiChat(messages);
      const raw = response.content;
      if (!raw) throw new Error('AI returned an empty response');

      const parsed = parseNoteJSON(raw);
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[NoteEngine] Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('Note generation failed after all retries');
}

// ─── Streaming Engine ──────────────────────────────────
/**
 * Yields SSE-formatted chunks for the note generation stream.
 * First yields the title, then streams the content.
 */
export async function* generateNotesStream(params: {
  topicContent: string;
  topicTitle: string;
  notebookContext: string;
  type: string;
  chatContext?: string;
}): AsyncGenerator<{ type: 'title' | 'chunk' | 'done' | 'error'; data?: string; error?: string }, void, undefined> {
  const messages = buildNoteMessages(params);
  let fullText = '';

  try {
    for await (const chunk of aiChatStream(messages)) {
      fullText += chunk;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield { type: 'error', error: msg };
    return;
  }

  if (!fullText.trim()) {
    yield { type: 'error', error: 'AI returned an empty response' };
    return;
  }

  // Parse the accumulated JSON
  try {
    const parsed = parseNoteJSON(fullText);
    yield { type: 'title', data: parsed.title };
    // Stream content in small chunks for progressive rendering
    const contentChunks = splitIntoChunks(parsed.content, 80);
    for (const chunk of contentChunks) {
      yield { type: 'chunk', data: chunk };
    }
    yield { type: 'done' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Fallback: treat entire response as markdown content
    const fallbackTitle = `Notes: ${params.topicTitle}`;
    yield { type: 'title', data: fallbackTitle };
    const cleaned = fullText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();
    const contentChunks = splitIntoChunks(cleaned, 80);
    for (const chunk of contentChunks) {
      yield { type: 'chunk', data: chunk };
    }
    yield { type: 'done' };
  }
}

// ─── Helpers ──────────────────────────────────────────
function parseNoteJSON(raw: string): { title: string; content: string } {
  // Try direct parse
  try {
    const parsed = JSON.parse(raw.trim());
    if (parsed.title && parsed.content) return parsed;
  } catch {
    // continue to cleaning
  }

  // Strip code fences and try again
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.title && parsed.content) return parsed;
  } catch {
    // continue
  }

  // Try to extract JSON from within text (model sometimes wraps it)
  const jsonMatch = cleaned.match(/\{[\s\S]*"title"[\s\S]*"content"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.title && parsed.content) return parsed;
    } catch {
      // continue
    }
  }

  throw new Error('Could not parse note JSON from AI response');
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}
