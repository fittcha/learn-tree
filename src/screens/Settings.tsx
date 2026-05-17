import { useEffect, useState } from 'react';
import { getSettings, setApiKey, setVaultHandle } from '@/data/settings';
import { pickVaultDirectory } from '@/export/fsa';
import { useApp } from '@/state/store';

export function Settings() {
  const goTo = useApp(s => s.goTo);
  const [key, setKey] = useState('');
  const [hasVault, setHasVault] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setKey(s.geminiApiKey);
      setHasVault(s.obsidianVaultHandle !== null);
    })();
  }, []);

  async function onPickVault() {
    setVaultError(null);
    try {
      const handle = await pickVaultDirectory();
      await setVaultHandle(handle);
      setHasVault(true);
    } catch (e) {
      setVaultError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onSaveKey() {
    await setApiKey(key);
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">설정</h1>
        <button className="text-sm text-zinc-400 hover:text-zinc-100" onClick={() => goTo({ kind: 'graph' })}>
          ← 돌아가기
        </button>
      </header>

      <section className="space-y-2">
        <label className="block text-sm font-medium">Gemini API 키</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={onSaveKey}
          placeholder="AIza..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm"
        />
        <p className="text-xs text-zinc-500">
          Google AI Studio에서 발급. 키는 본인 브라우저에만 저장됩니다.
        </p>
      </section>

      <section className="space-y-2">
        <label className="block text-sm font-medium">옵시디언 볼트 폴더</label>
        <button
          onClick={onPickVault}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
        >
          {hasVault ? '폴더 다시 선택' : '폴더 선택'}
        </button>
        {hasVault && <span className="ml-3 text-xs text-emerald-400">✓ 설정됨</span>}
        {vaultError && <p className="text-xs text-red-400">{vaultError}</p>}
      </section>
    </div>
  );
}
