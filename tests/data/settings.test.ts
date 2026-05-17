import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';
import { getSettings, setApiKey, setVaultHandle } from '@/data/settings';

describe('settings', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('returns empty defaults if not set', async () => {
    const s = await getSettings();
    expect(s.geminiApiKey).toBe('');
    expect(s.obsidianVaultHandle).toBeNull();
  });

  it('persists the api key', async () => {
    await setApiKey('sk-test-123');
    const s = await getSettings();
    expect(s.geminiApiKey).toBe('sk-test-123');
  });

  it('persists null vault handle clear', async () => {
    await setVaultHandle(null);
    const s = await getSettings();
    expect(s.obsidianVaultHandle).toBeNull();
  });
});
