import type { ChatMessage } from '@/data/types';

export interface ChatTurnInput {
  apiKey: string;
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
}

export interface WrapUpInput {
  apiKey: string;
  systemPrompt: string;
  history: ChatMessage[];
  wrapUpPrompt: string;
}

export interface WrapUpResult {
  summary: string;
  children: string[];
}

export interface ChatAdapter {
  streamTurn(input: ChatTurnInput): AsyncIterable<string>;
  wrapUp(input: WrapUpInput): Promise<WrapUpResult>;
}
