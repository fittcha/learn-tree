import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';
import { createNode, listNodesByCategory, getNode, updateNodeStatus, listChildren } from '@/data/nodes';

describe('nodes', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates a learning node from "+ 새 주제"', async () => {
    const node = await createNode({ categoryId: 'cs', title: '블룸필터', initialStatus: 'learning' });
    expect(node.id).toBeTruthy();
    expect(node.status).toBe('learning');
    expect(node.parentId).toBeNull();
    expect(node.completedAt).toBeNull();
  });

  it('creates a proposed child node', async () => {
    const parent = await createNode({ categoryId: 'cs', title: '블룸필터', initialStatus: 'learning' });
    const child = await createNode({ categoryId: 'cs', parentId: parent.id, title: '해시 함수', initialStatus: 'proposed' });
    expect(child.parentId).toBe(parent.id);
    expect(child.status).toBe('proposed');
  });

  it('lists nodes scoped to a category', async () => {
    await createNode({ categoryId: 'cs', title: 'a', initialStatus: 'learning' });
    await createNode({ categoryId: 'tech', title: 'b', initialStatus: 'learning' });
    const cs = await listNodesByCategory('cs');
    expect(cs.length).toBe(1);
    expect(cs[0]?.title).toBe('a');
  });

  it('transitions status and stamps completedAt on completion', async () => {
    const n = await createNode({ categoryId: 'cs', title: 'x', initialStatus: 'learning' });
    await updateNodeStatus(n.id, 'completed');
    const after = await getNode(n.id);
    expect(after?.status).toBe('completed');
    expect(after?.completedAt).not.toBeNull();
  });

  it('lists children of a node', async () => {
    const parent = await createNode({ categoryId: 'cs', title: 'p', initialStatus: 'learning' });
    await createNode({ categoryId: 'cs', parentId: parent.id, title: 'c1', initialStatus: 'proposed' });
    await createNode({ categoryId: 'cs', parentId: parent.id, title: 'c2', initialStatus: 'proposed' });
    const kids = await listChildren(parent.id);
    expect(kids.length).toBe(2);
  });
});
