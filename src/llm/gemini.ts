import { GoogleGenAI } from '@google/genai';
import type { ChatAdapter, ChatTurnInput, WrapUpInput, WrapUpResult } from './types';
import type { ChatMessage } from '@/data/types';

const MODEL = 'gemini-2.0-flash';

function toContents(history: ChatMessage[], userMessage: string) {
  const turns = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  turns.push({ role: 'user', parts: [{ text: userMessage }] });
  return turns;
}

export function createGeminiAdapter(): ChatAdapter {
  return {
    async *streamTurn(input: ChatTurnInput): AsyncIterable<string> {
      const ai = new GoogleGenAI({ apiKey: input.apiKey });
      const stream = await ai.models.generateContentStream({
        model: MODEL,
        contents: toContents(input.history, input.userMessage),
        config: { systemInstruction: input.systemPrompt },
      });
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) yield text;
      }
    },

    async wrapUp(input: WrapUpInput): Promise<WrapUpResult> {
      const ai = new GoogleGenAI({ apiKey: input.apiKey });
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: toContents(input.history, input.wrapUpPrompt),
        config: {
          systemInstruction: input.systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object' as const,
            properties: {
              summary: { type: 'string' as const },
              children: {
                type: 'array' as const,
                items: { type: 'string' as const },
              },
            },
            required: ['summary', 'children'],
          },
        },
      });
      const raw = response.text;
      if (!raw) throw new Error('wrap-up: empty response');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`wrap-up: failed to parse JSON: ${raw.slice(0, 100)}`);
      }
      if (
        typeof parsed !== 'object' || parsed === null ||
        typeof (parsed as Record<string, unknown>).summary !== 'string' ||
        !Array.isArray((parsed as Record<string, unknown>).children)
      ) {
        throw new Error('wrap-up: response did not match schema');
      }
      return parsed as WrapUpResult;
    },
  };
}
