import { useEffect } from 'react';
import { useApp } from '@/state/store';
import { Settings } from '@/screens/Settings';
import { GraphView } from '@/screens/GraphView';
import { NodeDetail } from '@/screens/NodeDetail';
import { seedDefaultCategories, listCategories } from '@/data/categories';

export default function App() {
  const screen = useApp(s => s.screen);
  const setCategories = useApp(s => s.setCategories);

  useEffect(() => {
    void (async () => {
      await seedDefaultCategories();
      setCategories(await listCategories());
    })();
  }, [setCategories]);

  if (screen.kind === 'settings') return <Settings />;
  if (screen.kind === 'graph') return <GraphView />;
  if (screen.kind === 'node') return <NodeDetail nodeId={screen.nodeId} />;
  return null;
}
