import { db } from './db';
import type { LearnNode, NodeStatus } from './types';

interface CreateNodeInput {
  categoryId: string;
  parentId?: string | null;
  title: string;
  initialStatus: NodeStatus;
}

export async function createNode(input: CreateNodeInput): Promise<LearnNode> {
  const node: LearnNode = {
    id: crypto.randomUUID(),
    categoryId: input.categoryId,
    parentId: input.parentId ?? null,
    title: input.title,
    status: input.initialStatus,
    createdAt: Date.now(),
    completedAt: null,
  };
  await db.nodes.put(node);
  return node;
}

export async function getNode(id: string): Promise<LearnNode | undefined> {
  return db.nodes.get(id);
}

export async function listNodesByCategory(categoryId: string): Promise<LearnNode[]> {
  return db.nodes.where('categoryId').equals(categoryId).sortBy('createdAt');
}

export async function listChildren(parentId: string): Promise<LearnNode[]> {
  return db.nodes.where('parentId').equals(parentId).sortBy('createdAt');
}

export async function updateNodeStatus(id: string, status: NodeStatus): Promise<void> {
  const patch: Partial<LearnNode> = { status };
  if (status === 'completed') patch.completedAt = Date.now();
  await db.nodes.update(id, patch);
}
