import { db } from './db';
import type { ChatMessage, Session } from './types';

export async function createSession(nodeId: string): Promise<Session> {
  const session: Session = {
    id: crypto.randomUUID(),
    nodeId,
    messages: [],
    suggestedChildren: [],
    summary: '',
    diagram: '',
    startedAt: Date.now(),
    completedAt: null,
  };
  await db.sessions.put(session);
  return session;
}

export async function appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  session.messages.push(message);
  await db.sessions.put(session);
}

export async function finishSession(sessionId: string, children: string[], summary: string, diagram: string): Promise<void> {
  await db.sessions.update(sessionId, {
    completedAt: Date.now(),
    suggestedChildren: children,
    summary,
    diagram,
  });
}

export async function getActiveSession(nodeId: string): Promise<Session | undefined> {
  const all = await db.sessions.where('nodeId').equals(nodeId).toArray();
  return all.find(s => s.completedAt === null);
}

export async function getSessionByNode(nodeId: string): Promise<Session | undefined> {
  const all = await db.sessions.where('nodeId').equals(nodeId).sortBy('startedAt');
  return all[all.length - 1];
}
