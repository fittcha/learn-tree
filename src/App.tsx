import { useEffect } from 'react';
import { useApp } from '@/state/store';
import { Settings } from '@/screens/Settings';
import { GraphView } from '@/screens/GraphView';
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
  return <div className="p-8">노드 상세 (구현 예정): {screen.nodeId}</div>;
}
