import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';
import { seedDefaultCategories, listCategories, renameCategory, deleteCategory } from '@/data/categories';

describe('categories', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('seeds four defaults if empty', async () => {
    await seedDefaultCategories();
    const list = await listCategories();
    expect(list.map(c => c.name)).toEqual(['CS', '프로그래밍', '기술', 'AI']);
  });

  it('is idempotent — does not duplicate on re-seed', async () => {
    await seedDefaultCategories();
    await seedDefaultCategories();
    expect((await listCategories()).length).toBe(4);
  });

  it('returns categories in order', async () => {
    await seedDefaultCategories();
    const list = await listCategories();
    expect(list.map(c => c.order)).toEqual([0, 1, 2, 3]);
  });

  it('renames a category', async () => {
    await seedDefaultCategories();
    await renameCategory('cs', 'Computer Science');
    const cs = (await listCategories()).find(c => c.id === 'cs');
    expect(cs?.name).toBe('Computer Science');
  });

  it('refuses to delete a category that has nodes', async () => {
    await seedDefaultCategories();
    await db.nodes.put({
      id: 'n1', categoryId: 'cs', parentId: null, title: 't',
      status: 'learning', createdAt: 0, completedAt: null,
    });
    await expect(deleteCategory('cs')).rejects.toThrow();
  });
});
