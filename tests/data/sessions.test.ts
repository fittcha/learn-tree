import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';
import {
  createSession, appendMessage, finishSession, getActiveSession,
} from '@/data/sessions';

describe('sessions', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates an empty session for a node', async () => {
    const s = await createSession('node-1');
    expect(s.nodeId).toBe('node-1');
    expect(s.messages).toEqual([]);
    expect(s.completedAt).toBeNull();
  });

  it('appends user and assistant messages in order', async () => {
    const s = await createSession('node-1');
    await appendMessage(s.id, { role: 'user', content: 'hi', timestamp: 1 });
    await appendMessage(s.id, { role: 'assistant', content: 'hello', timestamp: 2 });
    const active = await getActiveSession('node-1');
    expect(active?.messages.map(m => m.content)).toEqual(['hi', 'hello']);
  });

  it('finishes a session with summary and children', async () => {
    const s = await createSession('node-1');
    await finishSession(s.id, ['해시 함수', 'false positive'], '블룸필터 요약');
    const got = await db.sessions.get(s.id);
    expect(got?.completedAt).not.toBeNull();
    expect(got?.suggestedChildren).toEqual(['해시 함수', 'false positive']);
    expect(got?.summary).toBe('블룸필터 요약');
  });

  it('returns only the active (uncompleted) session for a node', async () => {
    const a = await createSession('node-1');
    await finishSession(a.id, [], '');
    const b = await createSession('node-1');
    const active = await getActiveSession('node-1');
    expect(active?.id).toBe(b.id);
  });
});
