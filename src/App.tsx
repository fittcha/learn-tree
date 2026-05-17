import { useEffect } from 'react';
import { useApp } from '@/state/store';
import { Settings } from '@/screens/Settings';
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
  return (
    <div className="p-8">
      <h1>learn-tree</h1>
      <button onClick={() => useApp.getState().goTo({ kind: 'settings' })}>
        설정 열기
      </button>
    </div>
  );
}
