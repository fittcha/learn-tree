import Groq from 'groq-sdk';
import type { ChatAdapter, ChatTurnInput, WrapUpInput, WrapUpResult } from './types';
import type { ChatMessage } from '@/data/types';

const MODEL = 'llama-3.3-70b-versatile';

type GroqMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const MAX_HISTORY = 10;

function toMessages(systemPrompt: string, history: ChatMessage[], userMessage: string): GroqMessage[] {
  const msgs: GroqMessage[] = [{ role: 'system', content: systemPrompt }];
  const recent = history.slice(-MAX_HISTORY);
  for (const m of recent) {
    msgs.push({ role: m.role, content: m.content });
  }
  msgs.push({ role: 'user', content: userMessage });
  return msgs;
}

export function createGroqAdapter(): ChatAdapter {
  return {
    async *streamTurn(input: ChatTurnInput): AsyncIterable<string> {
      const groq = new Groq({ apiKey: input.apiKey, dangerouslyAllowBrowser: true });
      const stream = await groq.chat.completions.create({
        model: MODEL,
        messages: toMessages(input.systemPrompt, input.history, input.userMessage),
        stream: true,
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
    },

    async wrapUp(input: WrapUpInput): Promise<WrapUpResult> {
      const groq = new Groq({ apiKey: input.apiKey, dangerouslyAllowBrowser: true });
      const response = await groq.chat.completions.create({
        model: MODEL,
        messages: toMessages(input.systemPrompt, input.history, input.wrapUpPrompt),
        response_format: { type: 'json_object' },
      });
      const raw = response.choices[0]?.message?.content;
      if (!raw) throw new Error('wrap-up: empty response');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`wrap-up: failed to parse JSON: ${raw.slice(0, 100)}`);
      }
      const obj = parsed as Record<string, unknown>;
      if (
        typeof parsed !== 'object' || parsed === null ||
        typeof obj.summary !== 'string' ||
        !Array.isArray(obj.children)
      ) {
        throw new Error('wrap-up: response did not match schema');
      }
      if (typeof obj.diagram !== 'string') obj.diagram = '';
      return parsed as WrapUpResult;
    },
  };
}
