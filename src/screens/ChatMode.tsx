import { useEffect, useState } from 'react';
import { useApp } from '@/state/store';
import type { Category, LearnNode, ChatMessage } from '@/data/types';
import { createSession, getActiveSession, appendMessage } from '@/data/sessions';

export function ChatMode({ node, category }: { node: LearnNode; category: Category }) {
  const goTo = useApp(s => s.goTo);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    void (async () => {
      let s = await getActiveSession(node.id);
      if (!s) s = await createSession(node.id);
      setSessionId(s.id);
      setMessages(s.messages);
    })();
  }, [node.id]);

  async function onSend() {
    if (!input.trim() || !sessionId) return;
    const msg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
    await appendMessage(sessionId, msg);
    setMessages(prev => [...prev, msg]);
    setInput('');
  }

  return (
    <div className="h-screen flex flex-col max-w-3xl mx-auto">
      <header className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div>
          <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={() => goTo({ kind: 'graph' })}>
            ← {category.name}
          </button>
          <h1 className="text-xl font-semibold">{node.title}</h1>
        </div>
        <button className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded" disabled>
          이쯤에서 마무리
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {messages.length === 0 && (
          <p className="text-zinc-500 text-sm text-center">세션을 시작합니다…</p>
        )}
      </div>

      <div className="p-4 border-t border-zinc-800 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend(); } }}
          placeholder="답을 입력하세요…"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2"
        />
        <button onClick={onSend} className="px-4 py-2 bg-emerald-600 rounded text-sm">
          보내기
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] px-4 py-2 rounded-lg whitespace-pre-wrap ${role === 'user' ? 'bg-emerald-700' : 'bg-zinc-800'}`}>
        {content}
      </div>
    </div>
  );
}
