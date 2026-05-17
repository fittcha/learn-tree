import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildWrapUpPrompt } from '@/llm/prompts';

describe('prompts', () => {
  it('includes node title and category in system prompt', () => {
    const p = buildSystemPrompt({ nodeTitle: '블룸필터', categoryName: '기술', parentTitle: null });
    expect(p).toContain('블룸필터');
    expect(p).toContain('기술');
  });

  it('includes parent context when present', () => {
    const p = buildSystemPrompt({ nodeTitle: '해시 함수', categoryName: '기술', parentTitle: '블룸필터' });
    expect(p).toContain('블룸필터');
    expect(p).toContain('해시 함수');
  });

  it('mentions socratic style and turn target', () => {
    const p = buildSystemPrompt({ nodeTitle: 'x', categoryName: 'y', parentTitle: null });
    expect(p.toLowerCase()).toMatch(/소크라테스|질문/);
  });

  it('wrap-up prompt requests summary + children', () => {
    const p = buildWrapUpPrompt();
    expect(p).toMatch(/요약/);
    expect(p).toMatch(/자식|하위/);
  });
});
