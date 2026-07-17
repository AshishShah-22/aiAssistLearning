import { aiChat } from '@/lib/ai-provider';

// ─── Prompts ───────────────────────────────────────────
const TUTORING_SYSTEM_PROMPT = `You are an expert university exam preparation AI tutor. Your SOLE purpose is to help students prepare for their university exams in the subject defined in the syllabus.

## YOUR TEACHING FLOW — FOLLOW THIS STRICTLY:

### Phase 1: Syllabus Understanding (ALWAYS START HERE)
- If the syllabus has units and topics, acknowledge them and show the student what you know about their syllabus.
- If the syllabus is empty or minimal, ask the student to provide their syllabus topics/unit-wise breakdown first.
- Do NOT skip to teaching or PYQ analysis until you and the student are aligned on what syllabus needs to be covered.

### Phase 2: PYQ (Previous Year Questions) Analysis
- Once the syllabus is clear, ask the student to share any Previous Year Questions (PYQs) or past exam papers they have.
- If the student provides PYQs, analyze them to identify:
  - Exam pattern (long answer, short answer, MCQ, numerical — and their weightage/marks distribution)
  - Which topics appear most frequently
  - How deep the answers need to be (2 marks? 5 marks? 10 marks? 15 marks?)
  - Any repeated question patterns or favorite areas of examiners
- Summarize this exam pattern clearly so the student knows what to expect.
- If the student does NOT have PYQs, ask about their exam pattern: "What is your exam format? (e.g., 2 markers, 5 markers, 10 markers, MCQs)"

### Phase 3: Exam-Oriented Teaching
- Once you know the syllabus AND the exam pattern, teach each topic in an exam-oriented manner.
- Structure your answers the way a student would write in the exam:
  - For long answer questions (10-15 marks): Start with definition → explain with diagram/description → give examples → write significance/applications → conclude
  - For short answers (2-5 marks): Direct definition → key points → brief example
  - For MCQs: Concept explanation → common tricks/confusions → practice approach
- After teaching each topic, suggest 1-2 "Likely Exam Questions" based on the PYQ pattern you analyzed.
- Mark important points that are frequently asked.

## GUIDELINES:
- Answer using the syllabus context and uploaded materials provided.
- When referencing syllabus topics or documents, include citations like [Topic: Name] or [Document: filename].
- If a question is outside the syllabus, briefly answer but note it's supplementary.
- Use clear headings, bullet points, and numbered lists for structured exam answers.
- Be encouraging — celebrate progress and offer to go deeper on weak areas.
- Keep track of which topics have been covered in the conversation.
- When explaining concepts that benefit from visual aids (diagrams, flowcharts, architecture diagrams, circuit diagrams, block diagrams, etc.), mention [IMAGE: description of what diagram/image would help] in your content.

When a diagram or visual would help understanding, include [IMAGE: description] in your answer.`;;

const MAX_RETRIES = 2;

// ─── Image Search (server-side only) ───────────────────
async function searchImages(query: string, count: number = 3): Promise<{ url: string; caption: string }[]> {
  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync('z-ai', [
      'image-search',
      '--query', query,
      '--count', String(count),
      '--no-rank',
    ], { timeout: 120000 });

    const result = JSON.parse(stdout);
    if (!result.success || !result.results?.length) return [];

    return result.results.map((r: any) => ({
      url: r.original_url,
      caption: r.caption || '',
    }));
  } catch (error) {
    console.error('[ImageSearch] Failed:', error);
    return [];
  }
}

// ─── Engine ────────────────────────────────────────────
export async function generateTutorResponse(params: {
  userMessage: string;
  syllabusContext: string;
  notebookContent: string;
  chatHistory: { role: string; content: string }[];
}): Promise<{ content: string; citations: string[]; images: { url: string; caption: string }[] }> {
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
      // Add the current user message with JSON format instruction
    messages.push({
    role: 'user',
    content: `${userMessage}

---
IMPORTANT: Format your response as JSON with this exact structure:
{"content": "your markdown answer here", "citations": ["citation1"], "imageQuery": "diagram search query or null"}
Rules: "imageQuery" should be a short query for a relevant diagram ONLY if visuals help, otherwise null. "citations" is an array of referenced topics/documents. Return valid JSON only, nothing else.`,
  });
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

      try {
        const parsed = JSON.parse(cleaned);

        if (!parsed.content || typeof parsed.content !== 'string') {
          throw new Error('Parsed tutoring response missing "content" field');
        }

        const citations = Array.isArray(parsed.citations) ? parsed.citations : [];
        let images: { url: string; caption: string }[] = [];

        // If AI wants an image, search for it (run in parallel with nothing — fire and merge)
        if (parsed.imageQuery && typeof parsed.imageQuery === 'string' && parsed.imageQuery.trim()) {
          // Remove [IMAGE: ...] placeholders from content
          const cleanContent = parsed.content.replace(/\[IMAGE:[^\]]*\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
          parsed.content = cleanContent;

          // Search for images (don't block the response on this — but we need to wait)
          images = await searchImages(parsed.imageQuery.trim(), 3);
        }

        return {
          content: parsed.content,
          citations,
          images,
        };
      } catch (parseError) {
        // If it's the last attempt, return the raw text as fallback instead of crashing
        if (attempt === MAX_RETRIES) {
          console.warn('[TutoringEngine] JSON parse failed on all attempts, returning raw text as fallback');
          return {
            content: raw,
            citations: [],
            images: [],
          };
        }
        throw parseError;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[TutoringEngine] Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  console.error('[TutoringEngine] All retries exhausted');
  throw lastError || new Error('Tutoring response generation failed after all retries');
}