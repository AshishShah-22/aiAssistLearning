import { aiChat } from '@/lib/ai-provider';

// ─── Prompts ───────────────────────────────────────────
const NOTE_SYSTEM_PROMPT = `You are an expert at creating study notes. Generate well-structured, comprehensive study notes based on the provided topic content and reference materials.

Note type guidelines:
- "summary": A concise overview of the key points. Focus on the big picture, main ideas, and takeaways. Use bullet points and brief paragraphs.
- "detailed": Comprehensive, in-depth notes covering all aspects of the topic. Include explanations, examples, and sub-sections. Aim for thoroughness.
- "exam": Notes optimized for exam preparation. Include key definitions, common exam patterns, likely questions, tips, and mnemonics. Prioritize what's most testable.
- "revision": Quick-reference revision notes. Condensed format with bullet lists, bold key terms, tables, and memory aids. Easy to scan quickly.
- "formula": Focused on formulas, equations, theorems, and their applications. Include formula definitions, variable explanations, and worked examples.

Formatting rules:
- Use markdown formatting extensively: headings (##, ###), bullet points, bold text, tables, code blocks where appropriate.
- For math/science formulas, use LaTeX-style notation within $...$ or $$...$$ delimiters.
- Use tables for comparisons and summaries.
- Include "Key Takeaways" or "Summary" section at the end when appropriate.
- Structure the notes with clear hierarchy.

Respond with valid JSON ONLY, matching this exact structure:
{
  "title": "Descriptive note title",
  "content": "Full markdown content of the notes"
}

Rules:
- The content field should be the complete notes in markdown format.
- All content must be relevant to the provided topic and reference materials.
- Do not include any explanation outside the JSON.`;

const MAX_RETRIES = 2;

// ─── Engine ────────────────────────────────────────────
export async function generateNotes(params: {
  topicContent: string;
  notebookContext: string;
  type: string;
}): Promise<{ title: string; content: string }> {
  const { topicContent, notebookContext, type } = params;

  // Validate note type
  const validTypes = ['summary', 'detailed', 'exam', 'revision', 'formula'];
  const noteType = validTypes.includes(type) ? type : 'summary';

  // Build the user prompt
  const contextParts: string[] = [];

  if (notebookContext.trim()) {
    contextParts.push(`REFERENCE MATERIALS / NOTES:\n${notebookContext}`);
  }

  const contextBlock = contextParts.length > 0
    ? `\n\n${contextParts.join('\n\n---\n')}`
    : '';

  const userPrompt = `Generate ${noteType} study notes for the following topic:

TOPIC CONTENT:
${topicContent}
${contextBlock}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await aiChat([
        { role: 'system', content: NOTE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      const raw = response.content;
      if (!raw) {
        throw new Error('AI returned an empty response for note generation');
      }

      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.title || typeof parsed.title !== 'string') {
        throw new Error('Parsed notes missing "title" field');
      }
      if (!parsed.content || typeof parsed.content !== 'string') {
        throw new Error('Parsed notes missing "content" field');
      }

      return {
        title: parsed.title,
        content: parsed.content,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[NoteEngine] Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  console.error('[NoteEngine] All retries exhausted');
  throw lastError || new Error('Note generation failed after all retries');
}