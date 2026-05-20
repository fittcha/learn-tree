import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/store';
import type { Category, LearnNode, ChatMessage } from '@/data/types';
import {
  createSession, getActiveSession, appendMessage,
} from '@/data/sessions';
import { useChatTurn } from '@/llm/useChatTurn';
import { useWrapUp } from '@/llm/useWrapUp';

export function ChatMode({ node, category }: { node: LearnNode; category: Category }) {
  const goTo = useApp(s => s.goTo);
  const runTurn = useChatTurn();
  const wrapUp = useWrapUp();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrapping, setWrapping] = useState(false);
  const [wrapError, setWrapError] = useState<string | null>(null);
  const initialized = useRef(false);
  const sending = useRef(false);

  useEffect(() => {
    void (async () => {
      let s = await getActiveSession(node.id);
      if (!s) s = await createSession(node.id);
      setSessionId(s.id);
      setMessages(s.messages);

      if (s.messages.length === 0 && !initialized.current) {
        initialized.current = true;
        await runAssistant(s.id, [], '시작');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  async function runAssistant(sid: string, history: ChatMessage[], userMessage: string) {
    setStreaming('');
    setError(null);
    try {
      const final = await runTurn({
        node, sessionId: sid, history,
        userMessage, onToken: setStreaming,
      });
      setMessages([...history,
        { role: 'assistant' as const, content: final, timestamp: Date.now() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(null);
    }
  }

  async function onSend() {
    if (!input.trim() || !sessionId || streaming !== null || sending.current) return;
    sending.current = true;
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
    await appendMessage(sessionId, userMsg);
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    await runAssistant(sessionId, next, userMsg.content);
    sending.current = false;
  }

  async function onRetry() {
    if (!sessionId) return;
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const history = lastUser ? messages.slice(0, messages.lastIndexOf(lastUser)) : [];
    const userMessage = lastUser?.content ?? '시작';
    await runAssistant(sessionId, history, userMessage);
  }

  async function onWrapUp() {
    if (!sessionId || wrapping || streaming !== null) return;
    setWrapping(true); setWrapError(null);
    try {
      await wrapUp({ node, sessionId, history: messages });
      useApp.getState().goTo({ kind: 'node', nodeId: node.id });
    } catch (e) {
      setWrapError(e instanceof Error ? e.message : String(e));
    } finally {
      setWrapping(false);
    }
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
        <button
          onClick={onWrapUp}
          disabled={wrapping || streaming !== null || messages.length < 4}
          className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 rounded disabled:opacity-50"
          title={messages.length < 4 ? '몇 턴 더 대화한 뒤에' : '학습 마치고 위키로'}
        >
          {wrapping ? '정리 중…' : '이쯤에서 마무리'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {streaming !== null && <Bubble role="assistant" content={streaming || '…'} />}
        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded p-3 text-sm space-y-2">
            <p>{error}</p>
            <button onClick={onRetry} className="px-2 py-1 bg-red-700 rounded text-xs">재시도</button>
          </div>
        )}
        {wrapError && (
          <div className="bg-red-900/40 border border-red-700 rounded p-3 text-sm space-y-2">
            <p>{wrapError}</p>
            <button onClick={onWrapUp} className="px-2 py-1 bg-red-700 rounded text-xs">마무리 재시도</button>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-800 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend(); } }}
          placeholder={streaming !== null ? '응답을 기다리는 중…' : '답을 입력하세요…'}
          disabled={streaming !== null}
          rows={1}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 disabled:opacity-50 resize-none"
        />
        <button onClick={onSend} disabled={streaming !== null} className="px-4 py-2 bg-emerald-600 rounded text-sm disabled:opacity-50">
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
