import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, type Node as RFNode, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useApp } from '@/state/store';
import { db } from '@/data/db';
import type { Category, LearnNode } from '@/data/types';
import { createNode } from '@/data/nodes';
import { getSettings } from '@/data/settings';

function layout(categories: Category[], nodes: LearnNode[]): { rfNodes: RFNode[]; edges: Edge[] } {
  const byCategory = new Map<string, LearnNode[]>();
  for (const c of categories) byCategory.set(c.id, []);
  for (const n of nodes) byCategory.get(n.categoryId)?.push(n);

  const laneHeight = 200;
  const xSpacing = 220;
  const rfNodes: RFNode[] = [];
  const edges: Edge[] = [];

  categories.forEach((cat, laneIndex) => {
    const lane = byCategory.get(cat.id) ?? [];
    lane.forEach((node, i) => {
      const opacity = node.status === 'proposed' ? 0.5 : 1;
      const border = node.status === 'completed'
        ? `3px solid ${cat.color}`
        : `2px dashed ${cat.color}`;
      const bg = node.status === 'completed' ? cat.color : 'transparent';
      rfNodes.push({
        id: node.id,
        position: { x: i * xSpacing + 100, y: laneIndex * laneHeight + 60 },
        data: { label: node.title },
        style: {
          background: bg, color: node.status === 'completed' ? '#000' : '#fff',
          border, borderRadius: 12, padding: '8px 14px', opacity, minWidth: 140, textAlign: 'center' as const,
        },
      });
      if (node.parentId) {
        edges.push({ id: `${node.parentId}-${node.id}`, source: node.parentId, target: node.id, style: { stroke: cat.color } });
      }
    });
    rfNodes.push({
      id: `cat-${cat.id}`,
      position: { x: -120, y: laneIndex * laneHeight + 60 },
      data: { label: cat.name },
      draggable: false, selectable: false,
      style: { background: 'transparent', color: cat.color, border: 'none', fontWeight: 600 },
    });
  });

  return { rfNodes, edges };
}

export function GraphView() {
  const categories = useApp(s => s.categories);
  const nodes = useApp(s => s.nodes);
  const setNodes = useApp(s => s.setNodes);
  const goTo = useApp(s => s.goTo);
  const [creating, setCreating] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [needsKey, setNeedsKey] = useState(false);

  useEffect(() => {
    void (async () => {
      const all = await db.nodes.toArray();
      setNodes(all);
      const settings = await getSettings();
      setNeedsKey(settings.geminiApiKey === '');
    })();
  }, [setNodes]);

  const { rfNodes, edges } = useMemo(() => layout(categories, nodes), [categories, nodes]);

  async function onCreate() {
    if (!creating || !title.trim()) return;
    const n = await createNode({ categoryId: creating, title: title.trim(), initialStatus: 'learning' });
    setNodes([...nodes, n]);
    setCreating(null); setTitle('');
    goTo({ kind: 'node', nodeId: n.id });
  }

  return (
    <div className="h-full w-full relative">
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-zinc-950/80 backdrop-blur">
        <h1 className="text-lg font-semibold">learn-tree</h1>
        <button className="text-sm text-zinc-400 hover:text-zinc-100" onClick={() => goTo({ kind: 'settings' })}>
          ⚙ 설정
        </button>
      </header>

      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        onNodeClick={(_, node) => {
          if (node.id.startsWith('cat-')) return;
          goTo({ kind: 'node', nodeId: node.id });
        }}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>

      <div className="absolute bottom-6 left-6 flex gap-2">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setCreating(c.id)}
            className="px-3 py-2 rounded text-xs font-medium"
            style={{ background: c.color, color: '#000' }}
          >
            + {c.name}
          </button>
        ))}
      </div>

      {creating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
          <div className="bg-zinc-900 border border-zinc-800 rounded p-6 w-96 space-y-4">
            <h2 className="text-lg">새 주제</h2>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void onCreate(); }}
              placeholder="예: 블룸필터"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
            />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 text-sm text-zinc-400" onClick={() => { setCreating(null); setTitle(''); }}>취소</button>
              <button className="px-3 py-1 text-sm bg-emerald-600 rounded" onClick={onCreate}>시작</button>
            </div>
          </div>
        </div>
      )}

      {(needsKey || nodes.length === 0) && !creating && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 w-[28rem] space-y-4 text-center pointer-events-auto shadow-2xl">
            <h2 className="text-xl font-semibold">환영해요</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {needsKey
                ? '먼저 설정에서 Gemini API 키를 등록한 뒤, 아래에서 카테고리 하나를 선택해 첫 주제를 만들어보세요.'
                : '아래에서 카테고리 하나를 선택해 첫 주제를 만들어보세요.'}
            </p>
            {needsKey && (
              <button
                onClick={() => goTo({ kind: 'settings' })}
                className="px-4 py-2 bg-emerald-600 rounded text-sm"
              >
                설정 열기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
