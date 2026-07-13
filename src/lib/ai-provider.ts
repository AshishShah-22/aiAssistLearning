/**
 * AI Provider Abstraction Layer
 *
 * WHY: The project was originally built using `z-ai-web-dev-sdk` which is
 * pre-configured in the cloud sandbox but has NO credentials on your local PC.
 *
 * This file creates ONE unified function `aiChat()` that:
 *   1. In cloud sandbox → uses z-ai-web-dev-sdk (no API key needed)
 *   2. On your local PC → uses YOUR API key (OpenAI / Google / Groq / DeepSeek)
 *
 * All AI engines call `aiChat()` — they never touch any SDK directly.
 * Changing provider = just changing an env variable. Zero code changes in engines.
 */

// ─── Types ───────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIResponse {
  content: string;
}

// ─── Config ──────────────────────────────────────────
type Provider = 'openai' | 'google' | 'groq' | 'deepseek' | 'zai';

function getProvider(): Provider {
  const p = process.env.AI_PROVIDER?.toLowerCase().trim();
  if (p === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
  if (p === 'google' && process.env.GOOGLE_API_KEY) return 'google';
  if (p === 'groq' && process.env.GROQ_API_KEY) return 'groq';
  if (p === 'deepseek' && process.env.DEEPSEEK_API_KEY) return 'deepseek';
  // Default: try z-ai-web-dev-sdk (works in cloud sandbox)
  return 'zai';
}

function getProviderInfo(): { provider: Provider; model: string } {
  const provider = getProvider();
  const models: Record<Provider, string> = {
    openai: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    google: process.env.GOOGLE_MODEL || 'gemini-2.0-flash',
    groq: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    zai: 'default',
  };
  return { provider, model: models[provider] };
}

// ─── ZAI (Cloud Sandbox) ─────────────────────────────
async function chatWithZAI(messages: ChatMessage[]): Promise<AIResponse> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('ZAI returned an empty response');
  return { content };
}

// ─── OpenAI ──────────────────────────────────────────
async function chatWithOpenAI(messages: ChatMessage[], model: string): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned an empty response');
  return { content };
}

// ─── Google Gemini ───────────────────────────────────
async function chatWithGoogle(messages: ChatMessage[], model: string): Promise<AIResponse> {
  const apiKey = process.env.GOOGLE_API_KEY!;

  // Gemini API expects a different format: contents[] with role "user"/"model"
  // System instructions go in a separate top-level field
  let systemInstruction: string | undefined;
  const contents: { role: string; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = msg.content;
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Google returned an empty response');
  return { content };
}

// ─── Groq ────────────────────────────────────────────
// Groq uses OpenAI-compatible API format — very cheap & fast
async function chatWithGroq(messages: ChatMessage[], model: string): Promise<AIResponse> {
  const apiKey = process.env.GROQ_API_KEY!;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty response');
  return { content };
}

// ─── DeepSeek ────────────────────────────────────────
// DeepSeek also uses OpenAI-compatible API format — very cheap, great for study
async function chatWithDeepSeek(messages: ChatMessage[], model: string): Promise<AIResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY!;
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned an empty response');
  return { content };
}

// ─── Unified Entry Point ─────────────────────────────
/**
 * Call this function from ANY AI engine.
 *
 * Usage:
 *   import { aiChat } from '@/lib/ai-provider';
 *   const response = await aiChat([
 *     { role: 'system', content: 'You are a tutor...' },
 *     { role: 'user', content: 'Explain photosynthesis' },
 *   ]);
 *   console.log(response.content);
 */
export async function aiChat(messages: ChatMessage[]): Promise<AIResponse> {
  const { provider, model } = getProviderInfo();

  // Log which provider is being used (only first time per process)
  if (!aiChat._logged) {
    console.log(`[AI Provider] Using: ${provider}${model !== 'default' ? ` (model: ${model})` : ''}`);
    aiChat._logged = true;
  }

  switch (provider) {
    case 'openai':
      return chatWithOpenAI(messages, model);
    case 'google':
      return chatWithGoogle(messages, model);
    case 'groq':
      return chatWithGroq(messages, model);
    case 'deepseek':
      return chatWithDeepSeek(messages, model);
    case 'zai':
      return chatWithZAI(messages);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
aiChat._logged = false as boolean;

// ─── Helper: Get current provider info (for UI display) ──
export function getAIProviderInfo() {
  return getProviderInfo();
}