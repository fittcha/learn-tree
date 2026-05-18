import { useEffect, useState } from 'react';
import { useApp } from '@/state/store';
import type { Category, LearnNode, Session } from '@/data/types';
import { getSessionByNode } from '@/data/sessions';
import { createNode, getNode } from '@/data/nodes';

export function WikiMode({ node, category }: { node: LearnNode; category: Category }) {
  const goTo = useApp(s => s.goTo);
  const setNodes = useApp(s => s.setNodes);
  const nodes = useApp(s => s.nodes);
  const [session, setSession] = useState<Session | null>(null);
  const [parentTitle, setParentTitle] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await getSessionByNode(node.id);
      setSession(s ?? null);
      if (node.parentId) {
        const p = await getNode(node.parentId);
        setParentTitle(p?.title ?? null);
      }
    })();
  }, [node.id, node.parentId]);

  async function onAddChild(title: string) {
    const child = await createNode({
      categoryId: node.categoryId,
      parentId: node.id,
      title,
      initialStatus: 'proposed',
    });
    setNodes([...nodes, child]);
  }

  if (!session) return <div className="p-8">불러오는 중…</div>;

  const summary = extractSummary(session);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="border-b border-zinc-800 pb-3 space-y-1">
        <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={() => goTo({ kind: 'graph' })}>
          ← 그래프로
        </button>
        <h1 className="text-2xl font-semibold" style={{ color: category.color }}>{node.title}</h1>
        <p className="text-xs text-zinc-500">
          카테고리: {category.name} · 부모: {parentTitle ?? '(없음)'} · 완료: {node.completedAt ? new Date(node.completedAt).toISOString().slice(0, 10) : '—'}
        </p>
      </header>

      {summary && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 mb-2">요약</h2>
          <p className="text-sm leading-relaxed">{summary}</p>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 mb-2">학습 대화</h2>
        <div className="space-y-3 text-sm">
          {session.messages.map((m, i) => (
            <div key={i}>
              <span className="font-semibold text-zinc-400">{m.role === 'assistant' ? 'Q' : 'A'}: </span>
              <span className="whitespace-pre-wrap">{m.content}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 mb-2">다음에 팔만한 주제</h2>
        {session.suggestedChildren.length === 0 ? (
          <p className="text-xs text-zinc-500">제안 없음</p>
        ) : (
          <ul className="space-y-2">
            {session.suggestedChildren.map(title => {
              const existing = nodes.find(n => n.title === title && n.parentId === node.id);
              return (
                <li key={title} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
                  <span>{title}</span>
                  <button
                    onClick={() => onAddChild(title)}
                    disabled={Boolean(existing)}
                    className="text-xs px-2 py-1 bg-emerald-600 rounded disabled:opacity-40"
                  >
                    {existing ? '추가됨' : '이걸로 노드 생성'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function extractSummary(session: Session): string {
  // Will be replaced with session.summary in Task 20
  const last = [...session.messages].reverse().find(m => m.role === 'assistant');
  return last?.content.slice(0, 280) ?? '';
}
