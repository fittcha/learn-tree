import { useCallback } from 'react';
import { getSettings } from '@/data/settings';
import { listCategories } from '@/data/categories';
import { getNode } from '@/data/nodes';
import { appendMessage } from '@/data/sessions';
import { buildSystemPrompt } from '@/llm/prompts';
import { createGeminiAdapter } from '@/llm/gemini';
import type { ChatMessage, LearnNode } from '@/data/types';

interface RunTurnArgs {
  node: LearnNode;
  sessionId: string;
  history: ChatMessage[];
  userMessage: string;
  onToken: (partial: string) => void;
}

export function useChatTurn() {
  return useCallback(async (args: RunTurnArgs): Promise<string> => {
    const settings = await getSettings();
    if (!settings.geminiApiKey) throw new Error('API 키가 설정되지 않았습니다.');

    const cats = await listCategories();
    const category = cats.find(c => c.id === args.node.categoryId);
    if (!category) throw new Error('카테고리를 찾을 수 없습니다.');

    let parentTitle: string | null = null;
    if (args.node.parentId) {
      const parent = await getNode(args.node.parentId);
      parentTitle = parent?.title ?? null;
    }

    const sys = buildSystemPrompt({
      nodeTitle: args.node.title,
      categoryName: category.name,
      parentTitle,
    });
    const adapter = createGeminiAdapter();

    let full = '';
    for await (const tok of adapter.streamTurn({
      apiKey: settings.geminiApiKey,
      systemPrompt: sys,
      history: args.history,
      userMessage: args.userMessage,
    })) {
      full += tok;
      args.onToken(full);
    }

    const assistantMsg: ChatMessage = {
      role: 'assistant', content: full, timestamp: Date.now(),
    };
    await appendMessage(args.sessionId, assistantMsg);
    return full;
  }, []);
}
