import { aiChat } from '@/lib/ai-provider';

// ─── Prompts ───────────────────────────────────────────
const TUTORING_SYSTEM_PROMPT = `You are an expert AI tutor for the subject defined in the syllabus. You have access to the student's uploaded materials, notes, and quiz history. Answer questions using the notebook knowledge. Provide citations when referencing specific documents or topics. Be encouraging, clear, and thorough.

Guidelines:
- Answer the student's question clearly and thoroughly.
- When referencing information from the uploaded materials or syllabus topics, include a citation in square brackets, e.g. [Topic: Introduction to Algorithms] or [Document: textbook_ch1.pdf].
- If the student asks about something outside the syllabus, gently redirect them or provide a brief answer with a note that it's supplementary.
- Use analogies and examples when helpful.
- Break complex concepts into steps.
- Be encouraging — celebrate understanding and offer to go deeper.

Your response should be a JSON object with exactly two fields:
{
  "content": "Your detailed answer in markdown format...",
  "citations": ["List of citation strings referenced in your answer"]
}

The "citations" array should contain the unique citation tags you used in your content (without brackets). If no citations apply, return an empty array.
Respond with valid JSON ONLY.`;

const MAX_RETRIES = 2;

// ─── Engine ────────────────────────────────────────────
export async function generateTutorResponse(params: {
  userMessage: string;
  syllabusContext: string;
  notebookContent: string;
  chatHistory: { role: string; content: string }[];
}): Promise<{ content: string; citations: string[] }> {
  const { userMessage, syllabusContext, notebookContent, chatHistory } = params;

  // Build context block
  const contextParts: string[] = [];

  if (syllabusContext.trim()) {
    contextParts.push(`SYLLABUS CONTEXT:\n${syllabusContext}`);
  }

  if (notebookContent.trim()) {
    contextParts.push(`UPLOADED MATERIALS / NOTES:\n${notebookContent}`);
  }

  const contextBlock = contextParts.length > 0
    ? `\n\n---\nREFERENCE MATERIALS:\n${contextParts.join('\n\n---\n')}\n---\n`
    : '';

  // Take only the last 10 messages from chat history
  const recentHistory = chatHistory.slice(-10).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
    { role: 'system', content: TUTORING_SYSTEM_PROMPT },
  ];

  // Add context as a user message so the model can reference it
  if (contextBlock) {
    messages.push({ role: 'user', content: `[System context provided for reference]${contextBlock}` });
    messages.push({ role: 'assistant', content: 'Understood. I will use these reference materials to answer the student\'s questions accurately with proper citations.' });
  }

  // Add recent chat history for conversational continuity
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Add the current user message
  messages.push({ role: 'user', content: userMessage });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await aiChat(messages);

      const raw = response.content;
      if (!raw) {
        throw new Error('AI returned an empty response for tutoring');
      }

      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.content || typeof parsed.content !== 'string') {
        throw new Error('Parsed tutoring response missing "content" field');
      }

      return {
        content: parsed.content,
        citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[TutoringEngine] Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  console.error('[TutoringEngine] All retries exhausted');
  throw lastError || new Error('Tutoring response generation failed after all retries');
}