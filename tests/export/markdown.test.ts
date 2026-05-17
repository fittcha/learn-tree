import { describe, it, expect } from 'vitest';
import { nodeToMarkdown } from '@/export/markdown';
import type { LearnNode, Session, Category } from '@/data/types';

const category: Category = { id: 'tech', name: '기술', color: '#fbbf24', order: 2 };
const node: LearnNode = {
  id: 'n1', categoryId: 'tech', parentId: null, title: '블룸필터',
  status: 'completed', createdAt: 0, completedAt: new Date('2026-05-17').getTime(),
};
const session: Session = {
  id: 's1', nodeId: 'n1',
  messages: [
    { role: 'assistant', content: '블룸필터는 왜 필요할까?', timestamp: 1 },
    { role: 'user', content: '메모리 절약 때문에', timestamp: 2 },
  ],
  suggestedChildren: ['해시 함수', 'false positive'],
  startedAt: 1, completedAt: 3,
};

describe('nodeToMarkdown', () => {
  it('starts with the title as H1', () => {
    const md = nodeToMarkdown({ node, session, category, parent: null, summary: 'S' });
    expect(md.split('\n')[0]).toBe('# 블룸필터');
  });

  it('includes category and completion date metadata', () => {
    const md = nodeToMarkdown({ node, session, category, parent: null, summary: 'S' });
    expect(md).toContain('기술');
    expect(md).toContain('2026-05-17');
  });

  it('shows "(없음)" for parent when root', () => {
    const md = nodeToMarkdown({ node, session, category, parent: null, summary: 'S' });
    expect(md).toContain('부모: (없음)');
  });

  it('shows parent title and wiki-link when parent exists', () => {
    const parent: LearnNode = { ...node, id: 'np', title: '확률 자료구조' };
    const md = nodeToMarkdown({ node, session, category, parent, summary: 'S' });
    expect(md).toContain('부모: [[확률 자료구조]]');
  });

  it('renders Q/A blocks for messages', () => {
    const md = nodeToMarkdown({ node, session, category, parent: null, summary: 'S' });
    expect(md).toContain('**Q:** 블룸필터는 왜 필요할까?');
    expect(md).toContain('**A (나):** 메모리 절약 때문에');
  });

  it('renders suggested children as Obsidian wiki-links', () => {
    const md = nodeToMarkdown({ node, session, category, parent: null, summary: 'S' });
    expect(md).toContain('- [[해시 함수]]');
    expect(md).toContain('- [[false positive]]');
  });

  it('escapes wiki-link characters in title for filenames separately', () => {
    expect(() => nodeToMarkdown({ node, session, category, parent: null, summary: 'S' })).not.toThrow();
  });
});
