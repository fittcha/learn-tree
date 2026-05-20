import { describe, it, expect, vi } from 'vitest';

const mockCreate = vi.fn();

vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

import { createGroqAdapter } from '@/llm/gemini';

describe('groq adapter', () => {
  it('streams chat turn tokens', async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: 'hel' } }] };
      yield { choices: [{ delta: { content: 'lo' } }] };
    }
    mockCreate.mockResolvedValue(fakeStream());

    const adapter = createGroqAdapter();
    const chunks: string[] = [];
    for await (const c of adapter.streamTurn({
      apiKey: 'k', systemPrompt: 'sys', history: [], userMessage: 'hi',
    })) {
      chunks.push(c);
    }
    expect(chunks.join('')).toBe('hello');
  });

  it('returns structured wrap-up result', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ summary: 'S', children: ['a', 'b', 'c'] }) } }],
    });

    const adapter = createGroqAdapter();
    const result = await adapter.wrapUp({
      apiKey: 'k', systemPrompt: 'sys', history: [], wrapUpPrompt: 'wrap',
    });
    expect(result.summary).toBe('S');
    expect(result.children).toEqual(['a', 'b', 'c']);
  });

  it('throws clear error on invalid wrap-up JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    });
    const adapter = createGroqAdapter();
    await expect(
      adapter.wrapUp({ apiKey: 'k', systemPrompt: 's', history: [], wrapUpPrompt: 'w' }),
    ).rejects.toThrow(/parse|json/i);
  });
});
