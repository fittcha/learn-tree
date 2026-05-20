import { db } from './db';
import type { AppSettings } from './types';

const SINGLETON_ID = 'singleton' as const;

const DEFAULT: AppSettings = {
  id: SINGLETON_ID,
  apiKey: '',
  obsidianVaultHandle: null,
};

export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get(SINGLETON_ID)) ?? DEFAULT;
}

export async function setApiKey(key: string): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, apiKey: key });
}

export async function setVaultHandle(handle: FileSystemDirectoryHandle | null): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, obsidianVaultHandle: handle });
}
