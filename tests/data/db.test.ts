import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';

describe('db', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('opens with all four tables', () => {
    expect(db.categories).toBeDefined();
    expect(db.nodes).toBeDefined();
    expect(db.sessions).toBeDefined();
    expect(db.settings).toBeDefined();
  });

  it('can insert and read a category', async () => {
    await db.categories.put({ id: 'cs', name: 'CS', color: '#888', order: 0 });
    const got = await db.categories.get('cs');
    expect(got?.name).toBe('CS');
  });
});
