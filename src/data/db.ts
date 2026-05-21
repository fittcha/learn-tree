import Dexie, { type Table } from 'dexie';
import type { Category, LearnNode, Session, AppSettings } from './types';

class LearnTreeDB extends Dexie {
  categories!: Table<Category, string>;
  nodes!: Table<LearnNode, string>;
  sessions!: Table<Session, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('learn-tree');
    this.version(1).stores({
      categories: 'id, order',
      nodes: 'id, categoryId, parentId, status, createdAt',
      sessions: 'id, nodeId, startedAt',
      settings: 'id',
    });
    this.version(2).stores({
      categories: 'id, order',
      nodes: 'id, categoryId, parentId, status, createdAt',
      sessions: 'id, nodeId, startedAt',
      settings: 'id',
    }).upgrade(async tx => {
      await tx.table('sessions').toCollection().modify((s: Record<string, unknown>) => {
        if (typeof s['summary'] !== 'string') s['summary'] = '';
      });
    });
    this.version(3).stores({
      categories: 'id, order',
      nodes: 'id, categoryId, parentId, status, createdAt',
      sessions: 'id, nodeId, startedAt',
      settings: 'id',
    }).upgrade(async tx => {
      await tx.table('sessions').toCollection().modify((s: Record<string, unknown>) => {
        if (typeof s['diagram'] !== 'string') s['diagram'] = '';
      });
    });
  }
}

export const db = new LearnTreeDB();
