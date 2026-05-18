import { useEffect, useState } from 'react';
import { useApp } from '@/state/store';
import { getNode } from '@/data/nodes';
import { listCategories } from '@/data/categories';
import type { Category, LearnNode } from '@/data/types';
import { ChatMode } from './ChatMode';
import { WikiMode } from './WikiMode';

export function NodeDetail({ nodeId }: { nodeId: string }) {
  const goTo = useApp(s => s.goTo);
  const [node, setNode] = useState<LearnNode | null>(null);
  const [category, setCategory] = useState<Category | null>(null);

  useEffect(() => {
    void (async () => {
      const n = await getNode(nodeId);
      if (!n) { goTo({ kind: 'graph' }); return; }
      setNode(n);
      const cats = await listCategories();
      setCategory(cats.find(c => c.id === n.categoryId) ?? null);
    })();
  }, [nodeId, goTo]);

  if (!node || !category) return <div className="p-8">불러오는 중…</div>;
  if (node.status === 'learning' || node.status === 'proposed') {
    return <ChatMode node={node} category={category} />;
  }
  if (node.status === 'completed') return <WikiMode node={node} category={category} />;
  return null;
}
