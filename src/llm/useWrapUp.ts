import { useCallback } from 'react';
import { getSettings } from '@/data/settings';
import { listCategories } from '@/data/categories';
import { getNode, updateNodeStatus } from '@/data/nodes';
import { finishSession } from '@/data/sessions';
import { buildSystemPrompt, buildWrapUpPrompt } from '@/llm/prompts';
import { createGroqAdapter } from '@/llm/gemini';
import type { ChatMessage, LearnNode } from '@/data/types';

interface WrapUpArgs {
  node: LearnNode;
  sessionId: string;
  history: ChatMessage[];
}

export function useWrapUp() {
  return useCallback(async ({ node, sessionId, history }: WrapUpArgs) => {
    const settings = await getSettings();
    if (!settings.apiKey) throw new Error('API 키가 설정되지 않았습니다.');

    const cats = await listCategories();
    const category = cats.find(c => c.id === node.categoryId);
    if (!category) throw new Error('카테고리를 찾을 수 없습니다.');

    let parentTitle: string | null = null;
    if (node.parentId) parentTitle = (await getNode(node.parentId))?.title ?? null;

    const sys = buildSystemPrompt({ nodeTitle: node.title, categoryName: category.name, parentTitle });
    const adapter = createGroqAdapter();

    const result = await adapter.wrapUp({
      apiKey: settings.apiKey,
      systemPrompt: sys,
      history,
      wrapUpPrompt: buildWrapUpPrompt(),
    });

    await finishSession(sessionId, result.children, result.summary);
    await updateNodeStatus(node.id, 'completed');

    return result;
  }, []);
}
