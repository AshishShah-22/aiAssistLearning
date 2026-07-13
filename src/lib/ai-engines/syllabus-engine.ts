import ZAI from 'z-ai-web-dev-sdk';
import type { SyllabusAnalysis } from '@/types';

// ─── Prompts ───────────────────────────────────────────
const SYLLABUS_SYSTEM_PROMPT = `You are an expert education curriculum designer. Analyze the given syllabus and extract a structured learning plan.

Your task:
1. Identify all major Units (or Modules) in the syllabus.
2. For each Unit, identify all Chapters/Topics and Subtopics.
3. For each Topic, estimate the difficulty level as "easy", "medium", or "hard".
4. For each Topic, list any prerequisite topics that should be studied first (use topic titles from the analysis itself, or generic descriptions if no prerequisite exists within the syllabus).
5. Estimate the overall course duration (e.g., "12 weeks", "3 months").
6. Estimate the overall course difficulty as "beginner", "intermediate", or "advanced".

Respond with valid JSON ONLY, matching this exact structure:
{
  "units": [
    {
      "title": "Unit title",
      "description": "Brief description of what this unit covers",
      "topics": [
        {
          "title": "Topic title",
          "description": "Brief description of this topic",
          "difficulty": "easy" | "medium" | "hard",
          "prerequisites": ["Prerequisite topic title or empty array"]
        }
      ]
    }
  ],
  "estimatedDuration": "e.g. 12 weeks",
  "difficulty": "beginner" | "intermediate" | "advanced"
}

Important rules:
- Be thorough: extract ALL topics visible in the syllabus.
- Difficulty should reflect the complexity of the topic relative to the whole syllabus.
- Prerequisites should only reference other topics in the syllabus or be an empty array.
- Do not include any explanation outside the JSON.`;

const MAX_RETRIES = 2;

// ─── Engine ────────────────────────────────────────────
export async function analyzeSyllabus(syllabusText: string): Promise<SyllabusAnalysis> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: SYLLABUS_SYSTEM_PROMPT },
          { role: 'user', content: syllabusText },
        ],
        thinking: { type: 'disabled' },
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        throw new Error('AI returned an empty response for syllabus analysis');
      }

      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const parsed: SyllabusAnalysis = JSON.parse(cleaned);

      // Validate basic structure
      if (!parsed.units || !Array.isArray(parsed.units) || parsed.units.length === 0) {
        throw new Error('Parsed syllabus has no units');
      }
      if (!parsed.estimatedDuration) {
        throw new Error('Parsed syllabus missing estimatedDuration');
      }
      if (!parsed.difficulty) {
        throw new Error('Parsed syllabus missing difficulty');
      }

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[SyllabusEngine] Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  console.error('[SyllabusEngine] All retries exhausted');
  throw lastError || new Error('Syllabus analysis failed after all retries');
}