import { describe, it, expect, vi } from 'vitest';

const generateContentStream = vi.fn();
const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContentStream, generateContent };
  },
}));

import { createGeminiAdapter } from '@/llm/gemini';

describe('gemini adapter', () => {
  it('streams chat turn tokens', async () => {
    async function* fakeStream() {
      yield { text: 'hel' };
      yield { text: 'lo' };
    }
    generateContentStream.mockResolvedValue(fakeStream());

    const adapter = createGeminiAdapter();
    const chunks: string[] = [];
    for await (const c of adapter.streamTurn({
      apiKey: 'k', systemPrompt: 'sys', history: [], userMessage: 'hi',
    })) {
      chunks.push(c);
    }
    expect(chunks.join('')).toBe('hello');
  });

  it('returns structured wrap-up result', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ summary: 'S', children: ['a', 'b', 'c'] }),
    });

    const adapter = createGeminiAdapter();
    const result = await adapter.wrapUp({
      apiKey: 'k', systemPrompt: 'sys', history: [], wrapUpPrompt: 'wrap',
    });
    expect(result.summary).toBe('S');
    expect(result.children).toEqual(['a', 'b', 'c']);
  });

  it('throws clear error on invalid wrap-up JSON', async () => {
    generateContent.mockResolvedValue({ text: 'not json' });
    const adapter = createGeminiAdapter();
    await expect(
      adapter.wrapUp({ apiKey: 'k', systemPrompt: 's', history: [], wrapUpPrompt: 'w' }),
    ).rejects.toThrow(/parse|json/i);
  });
});
