import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/store';
import type { Category, LearnNode, Session } from '@/data/types';
import { getSessionByNode } from '@/data/sessions';
import { getSettings } from '@/data/settings';
import { createNode, getNode } from '@/data/nodes';
import { ensureWritePermission, writeMarkdown } from '@/export/fsa';
import { nodeToMarkdown, sanitizeFilename } from '@/export/markdown';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'dark' });

function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !code) return;
    const id = `mermaid-${Date.now()}`;
    const cleaned = code.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '').trim();
    mermaid.render(id, cleaned).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    }).catch(() => {
      if (ref.current) {
        ref.current.innerHTML = `<pre class="text-xs text-zinc-500 whitespace-pre-wrap">${cleaned}</pre>`;
      }
    });
  }, [code]);

  if (!code) return null;
  return <div ref={ref} className="bg-zinc-900 rounded p-4 overflow-x-auto" />;
}

function MarkdownContent({ content }: { content: string }) {
  const html = simpleMarkdown(content);
  return <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
}

function simpleMarkdown(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-zinc-200 mt-6 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-zinc-300 mt-4 mb-1">$1</h3>')
    .replace(/^\- (.+)$/gm, '<li class="ml-4 list-disc text-sm leading-relaxed">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm leading-relaxed">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-100">$1</strong>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

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

  const [exportState, setExportState] = useState<{ status: 'idle' | 'writing' | 'done' | 'error'; message?: string }>({ status: 'idle' });

  async function onExport() {
    if (!session) return;
    setExportState({ status: 'writing' });
    try {
      const settings = await getSettings();
      if (!settings.obsidianVaultHandle) throw new Error('볼트 폴더가 설정되지 않았습니다.');
      const granted = await ensureWritePermission(settings.obsidianVaultHandle);
      if (!granted) throw new Error('볼트 폴더 권한이 거부되었습니다.');

      let parent: LearnNode | null = null;
      if (node.parentId) parent = (await getNode(node.parentId)) ?? null;

      const md = nodeToMarkdown({
        node, session, category, parent, summary: session.summary,
      });
      await writeMarkdown(
        settings.obsidianVaultHandle,
        category.name,
        sanitizeFilename(node.title),
        md,
      );
      setExportState({ status: 'done' });
    } catch (e) {
      setExportState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  if (!session) return <div className="p-8">불러오는 중...</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="border-b border-zinc-800 pb-3 space-y-1">
        <div className="flex items-center justify-between">
          <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={() => goTo({ kind: 'graph' })}>
            ← 그래프로
          </button>
          {'showDirectoryPicker' in window && (
            <button
              onClick={onExport}
              disabled={exportState.status === 'writing'}
              className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded disabled:opacity-50"
            >
              {exportState.status === 'idle' && '옵시디언으로 export'}
              {exportState.status === 'writing' && '쓰는 중...'}
              {exportState.status === 'done' && '완료'}
              {exportState.status === 'error' && '에러: 재시도'}
            </button>
          )}
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: category.color }}>{node.title}</h1>
        <p className="text-xs text-zinc-500">
          카테고리: {category.name} · 부모: {parentTitle ?? '(없음)'} · 완료: {node.completedAt ? new Date(node.completedAt).toISOString().slice(0, 10) : '-'}
        </p>
        {exportState.status === 'error' && exportState.message && (
          <p className="text-xs text-red-400">{exportState.message}</p>
        )}
      </header>

      {session.summary && (
        <section>
          <MarkdownContent content={session.summary} />
        </section>
      )}

      {session.diagram && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-200 mt-6 mb-3">흐름도</h2>
          <MermaidDiagram code={session.diagram} />
        </section>
      )}

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

      <details className="text-zinc-600">
        <summary className="text-xs cursor-pointer hover:text-zinc-400">
          대화 원문 보기 ({session.messages.length}턴)
        </summary>
        <div className="mt-3 space-y-3 text-sm text-zinc-400">
          {session.messages.map((m, i) => (
            <div key={i}>
              <span className="font-semibold">{m.role === 'assistant' ? 'Q' : 'A'}: </span>
              <span className="whitespace-pre-wrap">{m.content}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
