import type { LearnNode, Session, Category } from '@/data/types';

interface RenderInput {
  node: LearnNode;
  session: Session;
  category: Category;
  parent: LearnNode | null;
  summary: string;
}

function formatDate(ts: number | null): string {
  if (!ts) return '진행 중';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nodeToMarkdown({ node, session, category, parent, summary }: RenderInput): string {
  const parentLine = parent ? `[[${parent.title}]]` : '(없음)';
  const meta = `> 카테고리: ${category.name} | 부모: ${parentLine} | 완료: ${formatDate(node.completedAt)}`;

  const conversation = session.messages
    .map(m => {
      const label = m.role === 'assistant' ? '**Q:**' : '**A (나):**';
      return `${label} ${m.content}`;
    })
    .join('\n\n');

  const children = session.suggestedChildren.map(c => `- [[${c}]]`).join('\n');

  return [
    `# ${node.title}`,
    '',
    meta,
    '',
    '## 요약',
    summary,
    '',
    '## 학습 대화',
    conversation,
    '',
    '## 다음에 팔만한 주제',
    children || '_(없음)_',
    '',
  ].join('\n');
}

export function sanitizeFilename(title: string): string {
  return title.replace(/[/\\?%*:|"<>]/g, '_');
}
