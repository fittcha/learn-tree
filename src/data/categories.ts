import { db } from './db';
import type { Category } from './types';

const DEFAULTS: Category[] = [
  { id: 'cs',   name: 'CS',         color: '#60a5fa', order: 0 },
  { id: 'prog', name: '프로그래밍', color: '#34d399', order: 1 },
  { id: 'tech', name: '기술',       color: '#fbbf24', order: 2 },
  { id: 'ai',   name: 'AI',         color: '#f472b6', order: 3 },
];

export async function seedDefaultCategories(): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    for (const cat of DEFAULTS) {
      const existing = await db.categories.get(cat.id);
      if (!existing) await db.categories.put(cat);
    }
  });
}

export async function listCategories(): Promise<Category[]> {
  return db.categories.orderBy('order').toArray();
}

export async function renameCategory(id: string, name: string): Promise<void> {
  await db.categories.update(id, { name });
}

export async function deleteCategory(id: string): Promise<void> {
  const count = await db.nodes.where('categoryId').equals(id).count();
  if (count > 0) {
    throw new Error(`Category ${id} has ${count} node(s); delete or move them first.`);
  }
  await db.categories.delete(id);
}
