# learn-tree v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first personal learning web app where a developer creates topic nodes in 4 categories, learns each via a 5–10 turn Gemini-powered Socratic chat session, and accumulates a parent↔child mindmap that can be exported as Obsidian-compatible markdown.

**Architecture:** Single-page React app served from static files. All persistence in IndexedDB (Dexie). LLM calls go directly from the browser to Google Gemini using the user's own API key. Obsidian sync is one-way export via the File System Access API. No server, no auth, no backend.

**Tech Stack:** Vite, React 18, TypeScript (strict), Zustand, Dexie 4, `@google/genai`, React Flow (`@xyflow/react`), Vitest + `fake-indexeddb`, Tailwind CSS.

**Design doc:** [`docs/plans/2026-05-17-learn-tree-design.md`](./2026-05-17-learn-tree-design.md). Read first.

**Working directory for all tasks:** `~/lab/learn-tree/` (a fresh repo with `main` branch already initialized and the design doc committed).

**Commit cadence:** Commit after every task. Never `--amend` and never `--no-verify`. Commit message style: short imperative + scope, no trailing period (e.g., `feat(data): add node CRUD`).

---

## Phase 1 — Foundation

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `.gitignore`, `.nvmrc`

**Step 1: Initialize Vite project in place**

```bash
cd ~/lab/learn-tree
npm create vite@latest . -- --template react-ts
```

When prompted about non-empty directory, choose "Ignore files and continue" (the `docs/` directory and design doc must be preserved — verify after init).

**Step 2: Install dependencies**

```bash
npm install
```

**Step 3: Replace default content**

Edit [src/App.tsx](src/App.tsx) — strip all default content, leave a single `<h1>learn-tree</h1>`.
Delete `src/assets/`, `src/App.css`, `public/vite.svg` if Vite created them.

**Step 4: Pin Node version**

Write to [.nvmrc](.nvmrc):
```
20
```

**Step 5: Verify build + dev server**

```bash
npm run build
npm run dev
```
Expected: build succeeds, dev server starts on http://localhost:5173 and shows "learn-tree".

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react ts project"
```

---

### Task 2: Configure TypeScript strict mode + path aliases

**Files:**
- Modify: [tsconfig.json](tsconfig.json), [vite.config.ts](vite.config.ts)

**Step 1: Tighten `tsconfig.json`**

Ensure the compilerOptions block contains exactly these flags:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

**Step 2: Mirror alias in Vite config**

Add to [vite.config.ts](vite.config.ts):

```ts
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git commit -am "chore: tighten typescript and add @ alias"
```

---

### Task 3: Install runtime + test dependencies

**Files:**
- Modify: [package.json](package.json) (via npm install)
- Create: [vitest.config.ts](vitest.config.ts), [tests/setup.ts](tests/setup.ts)

**Step 1: Runtime deps**

```bash
npm install zustand dexie @google/genai @xyflow/react
```

**Step 2: UI deps (Tailwind)**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Edit [tailwind.config.js](tailwind.config.js):
```js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
};
```

Edit [src/index.css](src/index.css) — replace all content:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }
html, body, #root { height: 100%; }
body { @apply bg-zinc-950 text-zinc-100; }
```

**Step 3: Test deps**

```bash
npm install -D vitest @vitest/ui jsdom fake-indexeddb
```

Write [vitest.config.ts](vitest.config.ts):
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
```

Write [tests/setup.ts](tests/setup.ts):
```ts
import 'fake-indexeddb/auto';
```

Add scripts to [package.json](package.json):
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

**Step 4: Smoke test the test runner**

Create [tests/smoke.test.ts](tests/smoke.test.ts):
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 passed.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: add runtime and test dependencies"
```

---

## Phase 2 — Data Layer

All tasks in this phase are TDD. Data is the source of truth — silent corruption here would cascade everywhere.

### Task 4: Define types and Dexie schema

**Files:**
- Create: [src/data/types.ts](src/data/types.ts), [src/data/db.ts](src/data/db.ts)
- Create: [tests/data/db.test.ts](tests/data/db.test.ts)

**Step 1: Write the failing test**

[tests/data/db.test.ts](tests/data/db.test.ts):
```ts
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
```

**Step 2: Run to verify failure**

```bash
npm test -- tests/data/db.test.ts
```
Expected: import error — `@/data/db` does not exist.

**Step 3: Write the types**

[src/data/types.ts](src/data/types.ts):
```ts
export type NodeStatus = 'proposed' | 'learning' | 'completed';

export interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface LearnNode {
  id: string;
  categoryId: string;
  parentId: string | null;
  title: string;
  status: NodeStatus;
  createdAt: number;
  completedAt: number | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  nodeId: string;
  messages: ChatMessage[];
  suggestedChildren: string[];
  startedAt: number;
  completedAt: number | null;
}

export interface AppSettings {
  id: 'singleton';
  geminiApiKey: string;
  obsidianVaultHandle: FileSystemDirectoryHandle | null;
}
```

Note: `LearnNode` (not `Node`) to avoid colliding with the DOM `Node` type.

**Step 4: Write the Dexie schema**

[src/data/db.ts](src/data/db.ts):
```ts
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
  }
}

export const db = new LearnTreeDB();
```

**Step 5: Run tests to verify pass**

```bash
npm test -- tests/data/db.test.ts
```
Expected: 2 passed.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(data): add dexie schema and core types"
```

---

### Task 5: Category CRUD + default seed

**Files:**
- Create: [src/data/categories.ts](src/data/categories.ts)
- Create: [tests/data/categories.test.ts](tests/data/categories.test.ts)

**Step 1: Write the failing tests**

[tests/data/categories.test.ts](tests/data/categories.test.ts):
```ts
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
```

**Step 2: Run to verify failures**

```bash
npm test -- tests/data/categories.test.ts
```
Expected: all 5 fail with import errors.

**Step 3: Implement**

[src/data/categories.ts](src/data/categories.ts):
```ts
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
```

**Step 4: Run tests to verify pass**

```bash
npm test -- tests/data/categories.test.ts
```
Expected: 5 passed.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(data): add category crud and seed"
```

---

### Task 6: Node CRUD

**Files:**
- Create: [src/data/nodes.ts](src/data/nodes.ts)
- Create: [tests/data/nodes.test.ts](tests/data/nodes.test.ts)

**Step 1: Write the failing tests**

[tests/data/nodes.test.ts](tests/data/nodes.test.ts):
```ts
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
```

**Step 2: Run to verify failures**

```bash
npm test -- tests/data/nodes.test.ts
```

**Step 3: Implement**

[src/data/nodes.ts](src/data/nodes.ts):
```ts
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
```

**Step 4: Run tests to verify pass**

```bash
npm test -- tests/data/nodes.test.ts
```
Expected: 5 passed.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(data): add node crud"
```

---

### Task 7: Session CRUD

**Files:**
- Create: [src/data/sessions.ts](src/data/sessions.ts)
- Create: [tests/data/sessions.test.ts](tests/data/sessions.test.ts)

**Step 1: Write the failing tests**

[tests/data/sessions.test.ts](tests/data/sessions.test.ts):
```ts
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
    await finishSession(s.id, ['해시 함수', 'false positive']);
    const got = await db.sessions.get(s.id);
    expect(got?.completedAt).not.toBeNull();
    expect(got?.suggestedChildren).toEqual(['해시 함수', 'false positive']);
  });

  it('returns only the active (uncompleted) session for a node', async () => {
    const a = await createSession('node-1');
    await finishSession(a.id, []);
    const b = await createSession('node-1');
    const active = await getActiveSession('node-1');
    expect(active?.id).toBe(b.id);
  });
});
```

**Step 2: Run to verify failures**

```bash
npm test -- tests/data/sessions.test.ts
```

**Step 3: Implement**

[src/data/sessions.ts](src/data/sessions.ts):
```ts
import { db } from './db';
import type { ChatMessage, Session } from './types';

export async function createSession(nodeId: string): Promise<Session> {
  const session: Session = {
    id: crypto.randomUUID(),
    nodeId,
    messages: [],
    suggestedChildren: [],
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

export async function finishSession(sessionId: string, children: string[]): Promise<void> {
  await db.sessions.update(sessionId, {
    completedAt: Date.now(),
    suggestedChildren: children,
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
```

**Step 4: Run tests to verify pass**

```bash
npm test -- tests/data/sessions.test.ts
```
Expected: 4 passed.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(data): add session crud"
```

---

### Task 8: Settings storage

**Files:**
- Create: [src/data/settings.ts](src/data/settings.ts)
- Create: [tests/data/settings.test.ts](tests/data/settings.test.ts)

**Step 1: Write failing tests**

[tests/data/settings.test.ts](tests/data/settings.test.ts):
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';
import { getSettings, setApiKey, setVaultHandle } from '@/data/settings';

describe('settings', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('returns empty defaults if not set', async () => {
    const s = await getSettings();
    expect(s.geminiApiKey).toBe('');
    expect(s.obsidianVaultHandle).toBeNull();
  });

  it('persists the api key', async () => {
    await setApiKey('sk-test-123');
    const s = await getSettings();
    expect(s.geminiApiKey).toBe('sk-test-123');
  });

  it('persists null vault handle clear', async () => {
    await setVaultHandle(null);
    const s = await getSettings();
    expect(s.obsidianVaultHandle).toBeNull();
  });
});
```

**Step 2: Run to verify failures**

```bash
npm test -- tests/data/settings.test.ts
```

**Step 3: Implement**

[src/data/settings.ts](src/data/settings.ts):
```ts
import { db } from './db';
import type { AppSettings } from './types';

const SINGLETON_ID = 'singleton' as const;

const DEFAULT: AppSettings = {
  id: SINGLETON_ID,
  geminiApiKey: '',
  obsidianVaultHandle: null,
};

export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get(SINGLETON_ID)) ?? DEFAULT;
}

export async function setApiKey(key: string): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, geminiApiKey: key });
}

export async function setVaultHandle(handle: FileSystemDirectoryHandle | null): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, obsidianVaultHandle: handle });
}
```

**Step 4: Run tests to verify pass**

```bash
npm test
```
Expected: all data tests still passing.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(data): add settings storage"
```

---

## Phase 3 — LLM Adapter

### Task 9: System prompt + wrap-up prompt as pure strings

**Files:**
- Create: [src/llm/prompts.ts](src/llm/prompts.ts)
- Create: [tests/llm/prompts.test.ts](tests/llm/prompts.test.ts)

**Step 1: Write the failing tests**

[tests/llm/prompts.test.ts](tests/llm/prompts.test.ts):
```ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildWrapUpPrompt } from '@/llm/prompts';

describe('prompts', () => {
  it('includes node title and category in system prompt', () => {
    const p = buildSystemPrompt({ nodeTitle: '블룸필터', categoryName: '기술', parentTitle: null });
    expect(p).toContain('블룸필터');
    expect(p).toContain('기술');
  });

  it('includes parent context when present', () => {
    const p = buildSystemPrompt({ nodeTitle: '해시 함수', categoryName: '기술', parentTitle: '블룸필터' });
    expect(p).toContain('블룸필터');
    expect(p).toContain('해시 함수');
  });

  it('mentions socratic style and turn target', () => {
    const p = buildSystemPrompt({ nodeTitle: 'x', categoryName: 'y', parentTitle: null });
    expect(p.toLowerCase()).toMatch(/소크라테스|질문/);
  });

  it('wrap-up prompt requests summary + children', () => {
    const p = buildWrapUpPrompt();
    expect(p).toMatch(/요약/);
    expect(p).toMatch(/자식|하위/);
  });
});
```

**Step 2: Run to verify failures**

```bash
npm test -- tests/llm/prompts.test.ts
```

**Step 3: Implement**

[src/llm/prompts.ts](src/llm/prompts.ts):
```ts
interface SystemPromptInput {
  nodeTitle: string;
  categoryName: string;
  parentTitle: string | null;
}

export function buildSystemPrompt({ nodeTitle, categoryName, parentTitle }: SystemPromptInput): string {
  const parentLine = parentTitle
    ? `이 주제는 "${parentTitle}"의 하위 개념이야. 그 맥락을 의식해서 가르쳐.`
    : '이 주제는 독립 주제로 다뤄.';

  return `너는 친절한 소크라테스식 튜터야. 학습자는 한 명의 개발자고, 지금 "${nodeTitle}"이라는 주제를 깊이 이해하려고 해. (카테고리: ${categoryName})

규칙:
- 답을 바로 알려주지 마. 먼저 학습자의 사고를 끌어내는 질문 또는 부분 설명을 던져.
- 학습자가 답하면 그 답의 약점·전제·연결되는 개념을 짚어주며 한 단계 더 깊이 파.
- 한 턴에 한 가지 주제만 다뤄. 폭발적으로 늘어놓지 마.
- 5~10턴 안에서 충분히 이해되도록 호흡 조절해.
- 한국어로 답하되, 기술 용어는 영어를 같이 써.
- 첫 메시지는 학습자에게 흥미를 끄는 질문 또는 문제 상황 묘사로 시작해.

${parentLine}

지금 시작해.`;
}

export function buildWrapUpPrompt(): string {
  return `지금까지의 학습 대화를 정리해줘.

- summary: 학습자가 이번 세션에서 이해하게 된 것들을 3-5문장으로 요약. 학습자 답변에서 드러난 본인의 표현을 일부 살려.
- children: 이 주제를 더 깊이 파고 싶을 때 다음에 학습할 만한 *하위 또는 직접 연결된* 주제 3-5개. 너무 멀리 가지 마. 각 항목은 짧은 명사구.

JSON 스키마에 맞게만 반환.`;
}
```

**Step 4: Run tests to verify pass**

```bash
npm test -- tests/llm/prompts.test.ts
```
Expected: 4 passed.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(llm): add system and wrap-up prompts"
```

---

### Task 10: Gemini adapter (streaming + structured wrap-up)

**Files:**
- Create: [src/llm/gemini.ts](src/llm/gemini.ts), [src/llm/types.ts](src/llm/types.ts)
- Create: [tests/llm/gemini.test.ts](tests/llm/gemini.test.ts)

**Important:** Verify `@google/genai` API at implementation time — the SDK surface has changed across versions. Look up current docs:
- Quick API verification: read [node_modules/@google/genai/package.json](node_modules/@google/genai/package.json) and skim its README or main entry.
- If anything below conflicts with the installed SDK, prefer the installed SDK's actual API.

**Step 1: Define adapter shape**

[src/llm/types.ts](src/llm/types.ts):
```ts
import type { ChatMessage } from '@/data/types';

export interface ChatTurnInput {
  apiKey: string;
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
}

export interface WrapUpInput {
  apiKey: string;
  systemPrompt: string;
  history: ChatMessage[];
  wrapUpPrompt: string;
}

export interface WrapUpResult {
  summary: string;
  children: string[];
}

export interface ChatAdapter {
  streamTurn(input: ChatTurnInput): AsyncIterable<string>;
  wrapUp(input: WrapUpInput): Promise<WrapUpResult>;
}
```

**Step 2: Write failing tests (with mocked SDK)**

[tests/llm/gemini.test.ts](tests/llm/gemini.test.ts):
```ts
import { describe, it, expect, vi } from 'vitest';

const generateContentStream = vi.fn();
const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContentStream, generateContent },
  })),
}));

import { createGeminiAdapter } from '@/llm/gemini';

describe('gemini adapter', () => {
  it('streams chat turn tokens', async () => {
    async function* fakeStream() {
      yield { text: 'hel' };
      yield { text: 'lo' };
    }
    generateContentStream.mockResolvedValue(fakeStream());

    const adapter = createGeminiAdapter();
    const chunks: string[] = [];
    for await (const c of adapter.streamTurn({
      apiKey: 'k', systemPrompt: 'sys', history: [], userMessage: 'hi',
    })) {
      chunks.push(c);
    }
    expect(chunks.join('')).toBe('hello');
  });

  it('returns structured wrap-up result', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ summary: 'S', children: ['a', 'b', 'c'] }),
    });

    const adapter = createGeminiAdapter();
    const result = await adapter.wrapUp({
      apiKey: 'k', systemPrompt: 'sys', history: [], wrapUpPrompt: 'wrap',
    });
    expect(result.summary).toBe('S');
    expect(result.children).toEqual(['a', 'b', 'c']);
  });

  it('throws clear error on invalid wrap-up JSON', async () => {
    generateContent.mockResolvedValue({ text: 'not json' });
    const adapter = createGeminiAdapter();
    await expect(
      adapter.wrapUp({ apiKey: 'k', systemPrompt: 's', history: [], wrapUpPrompt: 'w' }),
    ).rejects.toThrow(/parse|json/i);
  });
});
```

**Step 3: Run to verify failures**

```bash
npm test -- tests/llm/gemini.test.ts
```

**Step 4: Implement**

[src/llm/gemini.ts](src/llm/gemini.ts):
```ts
import { GoogleGenAI } from '@google/genai';
import type { ChatAdapter, ChatTurnInput, WrapUpInput, WrapUpResult } from './types';
import type { ChatMessage } from '@/data/types';

const MODEL = 'gemini-2.0-flash';

function toContents(history: ChatMessage[], userMessage: string) {
  const turns = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  turns.push({ role: 'user', parts: [{ text: userMessage }] });
  return turns;
}

export function createGeminiAdapter(): ChatAdapter {
  return {
    async *streamTurn(input: ChatTurnInput): AsyncIterable<string> {
      const ai = new GoogleGenAI({ apiKey: input.apiKey });
      const stream = await ai.models.generateContentStream({
        model: MODEL,
        contents: toContents(input.history, input.userMessage),
        config: { systemInstruction: input.systemPrompt },
      });
      for await (const chunk of stream) {
        const text = (chunk as { text?: string }).text;
        if (text) yield text;
      }
    },

    async wrapUp(input: WrapUpInput): Promise<WrapUpResult> {
      const ai = new GoogleGenAI({ apiKey: input.apiKey });
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: toContents(input.history, input.wrapUpPrompt),
        config: {
          systemInstruction: input.systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              children: {
                type: 'array',
                items: { type: 'string' },
                minItems: 3,
                maxItems: 5,
              },
            },
            required: ['summary', 'children'],
          },
        },
      });
      const raw = (response as { text?: string }).text;
      if (!raw) throw new Error('wrap-up: empty response');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`wrap-up: failed to parse JSON: ${raw.slice(0, 100)}`);
      }
      if (
        typeof parsed !== 'object' || parsed === null ||
        typeof (parsed as Record<string, unknown>).summary !== 'string' ||
        !Array.isArray((parsed as Record<string, unknown>).children)
      ) {
        throw new Error('wrap-up: response did not match schema');
      }
      return parsed as WrapUpResult;
    },
  };
}
```

**Step 5: Run tests to verify pass**

```bash
npm test -- tests/llm/gemini.test.ts
```
Expected: 3 passed.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(llm): add gemini adapter with streaming and structured wrap-up"
```

---

## Phase 4 — Export Formatter

### Task 11: Markdown export formatter (TDD)

This is the most-likely-to-silently-break piece per design. Test thoroughly.

**Files:**
- Create: [src/export/markdown.ts](src/export/markdown.ts)
- Create: [tests/export/markdown.test.ts](tests/export/markdown.test.ts)

**Step 1: Write the failing tests**

[tests/export/markdown.test.ts](tests/export/markdown.test.ts):
```ts
import { describe, it, expect } from 'vitest';
import { nodeToMarkdown } from '@/export/markdown';
import type { LearnNode, Session, Category } from '@/data/types';

const category: Category = { id: 'tech', name: '기술', color: '#fbbf24', order: 2 };
const node: LearnNode = {
  id: 'n1', categoryId: 'tech', parentId: null, title: '블룸필터',
  status: 'completed', createdAt: 0, completedAt: new Date('2026-05-17').getTime(),
};
const session: Session = {
  id: 's1', nodeId: 'n1',
  messages: [
    { role: 'assistant', content: '블룸필터는 왜 필요할까?', timestamp: 1 },
    { role: 'user', content: '메모리 절약 때문에', timestamp: 2 },
  ],
  suggestedChildren: ['해시 함수', 'false positive'],
  startedAt: 1, completedAt: 3,
};

describe('nodeToMarkdown', () => {
  it('starts with the title as H1', () => {
    const md = nodeToMarkdown({ node, session, category, parent: null, summary: 'S' });
    expect(md.split('\n')[0]).toBe('# 블룸필터');
  });

  it('includes category and completion date metadata', () => {
    const md = nodeToMarkdown({ node, session, category, parent: null, summary: 'S' });
    expect(md).toContain('기술');
    expect(md).toContain('2026-05-17');
  });

  it('shows "(없음)" for parent when root', () => {
    const md = nodeToMarkdown({ node, session, category, parent: null, summary: 'S' });
    expect(md).toContain('부모: (없음)');
  });

  it('shows parent title and wiki-link when parent exists', () => {
    const parent: LearnNode = { ...node, id: 'np', title: '확률 자료구조' };
    const md = nodeToMarkdown({ node, session, category, parent, summary: 'S' });
    expect(md).toContain('부모: [[확률 자료구조]]');
  });

  it('renders Q/A blocks for messages', () => {
    const md = nodeToMarkdown({ node, session, category, parent: null, summary: 'S' });
    expect(md).toContain('**Q:** 블룸필터는 왜 필요할까?');
    expect(md).toContain('**A (나):** 메모리 절약 때문에');
  });

  it('renders suggested children as Obsidian wiki-links', () => {
    const md = nodeToMarkdown({ node, session, category, parent: null, summary: 'S' });
    expect(md).toContain('- [[해시 함수]]');
    expect(md).toContain('- [[false positive]]');
  });

  it('escapes wiki-link characters in title for filenames separately', () => {
    // export expects caller to handle filename sanitization; document via test
    expect(() => nodeToMarkdown({ node, session, category, parent: null, summary: 'S' })).not.toThrow();
  });
});
```

**Step 2: Run to verify failures**

```bash
npm test -- tests/export/markdown.test.ts
```

**Step 3: Implement**

[src/export/markdown.ts](src/export/markdown.ts):
```ts
import type { LearnNode, Session, Category } from '@/data/types';

interface RenderInput {
  node: LearnNode;
  session: Session;
  category: Category;
  parent: LearnNode | null;
  summary: string;
}

function formatDate(ts: number | null): string {
  if (!ts) return '진행 중';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nodeToMarkdown({ node, session, category, parent, summary }: RenderInput): string {
  const parentLine = parent ? `[[${parent.title}]]` : '(없음)';
  const meta = `> 카테고리: ${category.name} | 부모: ${parentLine} | 완료: ${formatDate(node.completedAt)}`;

  const conversation = session.messages
    .map(m => {
      const label = m.role === 'assistant' ? '**Q:**' : '**A (나):**';
      return `${label} ${m.content}`;
    })
    .join('\n\n');

  const children = session.suggestedChildren.map(c => `- [[${c}]]`).join('\n');

  return [
    `# ${node.title}`,
    '',
    meta,
    '',
    '## 요약',
    summary,
    '',
    '## 학습 대화',
    conversation,
    '',
    '## 다음에 팔만한 주제',
    children || '_(없음)_',
    '',
  ].join('\n');
}

export function sanitizeFilename(title: string): string {
  return title.replace(/[/\\?%*:|"<>]/g, '_');
}
```

**Step 4: Run tests to verify pass**

```bash
npm test -- tests/export/markdown.test.ts
```
Expected: 7 passed.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(export): add markdown formatter for obsidian"
```

---

### Task 12: File System Access write helper

**Files:**
- Create: [src/export/fsa.ts](src/export/fsa.ts)

**Step 1: Implement** (no unit test — wraps a browser API that can't run in jsdom; verified manually later)

[src/export/fsa.ts](src/export/fsa.ts):
```ts
export async function pickVaultDirectory(): Promise<FileSystemDirectoryHandle> {
  // showDirectoryPicker is only present on supporting browsers.
  if (!('showDirectoryPicker' in window)) {
    throw new Error('이 브라우저는 폴더 선택을 지원하지 않습니다. Chrome·Edge·Arc·Brave를 사용해주세요.');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  return handle as FileSystemDirectoryHandle;
}

export async function ensureWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = handle as any;
  const opts = { mode: 'readwrite' } as const;
  if ((await h.queryPermission(opts)) === 'granted') return true;
  return (await h.requestPermission(opts)) === 'granted';
}

export async function writeMarkdown(
  vault: FileSystemDirectoryHandle,
  categoryName: string,
  filename: string,
  contents: string,
): Promise<void> {
  const categoryDir = await vault.getDirectoryHandle(categoryName, { create: true });
  const fileHandle = await categoryDir.getFileHandle(`${filename}.md`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}
```

**Step 2: Manual verification deferred** — will exercise via the UI in Task 21.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(export): add file system access write helper"
```

---

## Phase 5 — State

### Task 13: Zustand store skeleton

**Files:**
- Create: [src/state/store.ts](src/state/store.ts)

**Step 1: Implement**

[src/state/store.ts](src/state/store.ts):
```ts
import { create } from 'zustand';
import type { Category, LearnNode, Session } from '@/data/types';

type Screen = { kind: 'graph' } | { kind: 'node'; nodeId: string } | { kind: 'settings' };

interface AppState {
  screen: Screen;
  categories: Category[];
  nodes: LearnNode[];
  activeSession: Session | null;
  streaming: boolean;
  goTo: (s: Screen) => void;
  setCategories: (c: Category[]) => void;
  setNodes: (n: LearnNode[]) => void;
  setActiveSession: (s: Session | null) => void;
  setStreaming: (v: boolean) => void;
}

export const useApp = create<AppState>((set) => ({
  screen: { kind: 'graph' },
  categories: [],
  nodes: [],
  activeSession: null,
  streaming: false,
  goTo: (screen) => set({ screen }),
  setCategories: (categories) => set({ categories }),
  setNodes: (nodes) => set({ nodes }),
  setActiveSession: (activeSession) => set({ activeSession }),
  setStreaming: (streaming) => set({ streaming }),
}));
```

**Step 2: Verify typecheck**

```bash
npm run typecheck
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(state): add zustand app store"
```

---

## Phase 6 — UI: Settings

### Task 14: Settings screen

**Files:**
- Create: [src/screens/Settings.tsx](src/screens/Settings.tsx)
- Modify: [src/App.tsx](src/App.tsx)

**Step 1: Implement Settings screen**

[src/screens/Settings.tsx](src/screens/Settings.tsx):
```tsx
import { useEffect, useState } from 'react';
import { getSettings, setApiKey, setVaultHandle } from '@/data/settings';
import { pickVaultDirectory } from '@/export/fsa';
import { useApp } from '@/state/store';
import { listCategories, renameCategory } from '@/data/categories';

export function Settings() {
  const goTo = useApp(s => s.goTo);
  const [key, setKey] = useState('');
  const [hasVault, setHasVault] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setKey(s.geminiApiKey);
      setHasVault(s.obsidianVaultHandle !== null);
    })();
  }, []);

  async function onPickVault() {
    setVaultError(null);
    try {
      const handle = await pickVaultDirectory();
      await setVaultHandle(handle);
      setHasVault(true);
    } catch (e) {
      setVaultError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onSaveKey() {
    await setApiKey(key);
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">설정</h1>
        <button className="text-sm text-zinc-400 hover:text-zinc-100" onClick={() => goTo({ kind: 'graph' })}>
          ← 돌아가기
        </button>
      </header>

      <section className="space-y-2">
        <label className="block text-sm font-medium">Gemini API 키</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={onSaveKey}
          placeholder="AIza..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm"
        />
        <p className="text-xs text-zinc-500">
          Google AI Studio에서 발급. 키는 본인 브라우저에만 저장됩니다.
        </p>
      </section>

      <section className="space-y-2">
        <label className="block text-sm font-medium">옵시디언 볼트 폴더</label>
        <button
          onClick={onPickVault}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
        >
          {hasVault ? '폴더 다시 선택' : '폴더 선택'}
        </button>
        {hasVault && <span className="ml-3 text-xs text-emerald-400">✓ 설정됨</span>}
        {vaultError && <p className="text-xs text-red-400">{vaultError}</p>}
      </section>
    </div>
  );
}
```

**Step 2: Wire to App**

[src/App.tsx](src/App.tsx):
```tsx
import { useEffect } from 'react';
import { useApp } from '@/state/store';
import { Settings } from '@/screens/Settings';
import { seedDefaultCategories, listCategories } from '@/data/categories';

export default function App() {
  const screen = useApp(s => s.screen);
  const setCategories = useApp(s => s.setCategories);

  useEffect(() => {
    void (async () => {
      await seedDefaultCategories();
      setCategories(await listCategories());
    })();
  }, [setCategories]);

  if (screen.kind === 'settings') return <Settings />;
  return (
    <div className="p-8">
      <h1>learn-tree</h1>
      <button onClick={() => useApp.getState().goTo({ kind: 'settings' })}>
        설정 열기
      </button>
    </div>
  );
}
```

**Step 3: Manually verify**

```bash
npm run dev
```
Open http://localhost:5173:
- Click "설정 열기" → settings screen renders.
- Type a fake key → tab out → reload page → key persists.
- Click "폴더 선택" → directory picker opens (if Chromium browser). Pick a folder → "✓ 설정됨" appears.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add settings screen"
```

---

## Phase 7 — UI: Graph View

### Task 15: Graph view with React Flow

**Files:**
- Create: [src/screens/GraphView.tsx](src/screens/GraphView.tsx)
- Modify: [src/App.tsx](src/App.tsx)

**Step 1: Implement GraphView**

[src/screens/GraphView.tsx](src/screens/GraphView.tsx):
```tsx
import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, type Node as RFNode, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useApp } from '@/state/store';
import { db } from '@/data/db';
import type { Category, LearnNode } from '@/data/types';
import { createNode } from '@/data/nodes';

function layout(categories: Category[], nodes: LearnNode[]): { rfNodes: RFNode[]; edges: Edge[] } {
  // Simple radial layout — each category is a horizontal lane.
  const byCategory = new Map<string, LearnNode[]>();
  for (const c of categories) byCategory.set(c.id, []);
  for (const n of nodes) byCategory.get(n.categoryId)?.push(n);

  const laneHeight = 200;
  const xSpacing = 220;
  const rfNodes: RFNode[] = [];
  const edges: Edge[] = [];

  categories.forEach((cat, laneIndex) => {
    const lane = byCategory.get(cat.id) ?? [];
    lane.forEach((node, i) => {
      const opacity = node.status === 'proposed' ? 0.5 : 1;
      const border = node.status === 'completed'
        ? `3px solid ${cat.color}`
        : `2px dashed ${cat.color}`;
      const bg = node.status === 'completed' ? cat.color : 'transparent';
      rfNodes.push({
        id: node.id,
        position: { x: i * xSpacing + 100, y: laneIndex * laneHeight + 60 },
        data: { label: node.title },
        style: {
          background: bg, color: node.status === 'completed' ? '#000' : '#fff',
          border, borderRadius: 12, padding: '8px 14px', opacity, minWidth: 140, textAlign: 'center',
        },
      });
      if (node.parentId) {
        edges.push({ id: `${node.parentId}-${node.id}`, source: node.parentId, target: node.id, style: { stroke: cat.color } });
      }
    });
    // Category label as a non-interactive node
    rfNodes.push({
      id: `cat-${cat.id}`,
      position: { x: -120, y: laneIndex * laneHeight + 60 },
      data: { label: cat.name },
      draggable: false, selectable: false,
      style: { background: 'transparent', color: cat.color, border: 'none', fontWeight: 600 },
    });
  });

  return { rfNodes, edges };
}

export function GraphView() {
  const categories = useApp(s => s.categories);
  const nodes = useApp(s => s.nodes);
  const setNodes = useApp(s => s.setNodes);
  const goTo = useApp(s => s.goTo);
  const [creating, setCreating] = useState<string | null>(null); // categoryId being added to
  const [title, setTitle] = useState('');

  useEffect(() => {
    void (async () => {
      const all = await db.nodes.toArray();
      setNodes(all);
    })();
  }, [setNodes]);

  const { rfNodes, edges } = useMemo(() => layout(categories, nodes), [categories, nodes]);

  async function onCreate() {
    if (!creating || !title.trim()) return;
    const n = await createNode({ categoryId: creating, title: title.trim(), initialStatus: 'learning' });
    setNodes([...nodes, n]);
    setCreating(null); setTitle('');
    goTo({ kind: 'node', nodeId: n.id });
  }

  return (
    <div className="h-full w-full relative">
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-zinc-950/80 backdrop-blur">
        <h1 className="text-lg font-semibold">learn-tree</h1>
        <button className="text-sm text-zinc-400 hover:text-zinc-100" onClick={() => goTo({ kind: 'settings' })}>
          ⚙ 설정
        </button>
      </header>

      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        onNodeClick={(_, node) => {
          if (node.id.startsWith('cat-')) return;
          goTo({ kind: 'node', nodeId: node.id });
        }}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>

      <div className="absolute bottom-6 left-6 flex gap-2">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setCreating(c.id)}
            className="px-3 py-2 rounded text-xs font-medium"
            style={{ background: c.color, color: '#000' }}
          >
            + {c.name}
          </button>
        ))}
      </div>

      {creating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
          <div className="bg-zinc-900 border border-zinc-800 rounded p-6 w-96 space-y-4">
            <h2 className="text-lg">새 주제</h2>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void onCreate(); }}
              placeholder="예: 블룸필터"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
            />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 text-sm text-zinc-400" onClick={() => { setCreating(null); setTitle(''); }}>취소</button>
              <button className="px-3 py-1 text-sm bg-emerald-600 rounded" onClick={onCreate}>시작</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Wire to App**

[src/App.tsx](src/App.tsx):
```tsx
import { useEffect } from 'react';
import { useApp } from '@/state/store';
import { Settings } from '@/screens/Settings';
import { GraphView } from '@/screens/GraphView';
import { seedDefaultCategories, listCategories } from '@/data/categories';

export default function App() {
  const screen = useApp(s => s.screen);
  const setCategories = useApp(s => s.setCategories);

  useEffect(() => {
    void (async () => {
      await seedDefaultCategories();
      setCategories(await listCategories());
    })();
  }, [setCategories]);

  if (screen.kind === 'settings') return <Settings />;
  if (screen.kind === 'graph') return <GraphView />;
  // node detail wired in next task
  return <div className="p-8">노드 상세 (구현 예정): {screen.nodeId}</div>;
}
```

**Step 3: Manual verification**

```bash
npm run dev
```
- See empty graph with 4 category labels stacked vertically.
- Click "+ 기술" → modal → type "블룸필터" → Enter.
- Node appears in graph view (after coming back from Task 16 we'll go to node detail; for now will show "구현 예정" placeholder).
- Reload — node persists.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add graph view with react flow"
```

---

## Phase 8 — UI: Node Detail (Chat)

### Task 16: Chat-mode UI (no streaming yet)

**Files:**
- Create: [src/screens/NodeDetail.tsx](src/screens/NodeDetail.tsx)
- Create: [src/screens/ChatMode.tsx](src/screens/ChatMode.tsx)
- Modify: [src/App.tsx](src/App.tsx)

**Step 1: Implement NodeDetail dispatcher**

[src/screens/NodeDetail.tsx](src/screens/NodeDetail.tsx):
```tsx
import { useEffect, useState } from 'react';
import { useApp } from '@/state/store';
import { getNode } from '@/data/nodes';
import { listCategories } from '@/data/categories';
import type { Category, LearnNode } from '@/data/types';
import { ChatMode } from './ChatMode';

export function NodeDetail({ nodeId }: { nodeId: string }) {
  const goTo = useApp(s => s.goTo);
  const [node, setNode] = useState<LearnNode | null>(null);
  const [category, setCategory] = useState<Category | null>(null);

  useEffect(() => {
    void (async () => {
      const n = await getNode(nodeId);
      if (!n) { goTo({ kind: 'graph' }); return; }
      setNode(n);
      const cats = await listCategories();
      setCategory(cats.find(c => c.id === n.categoryId) ?? null);
    })();
  }, [nodeId, goTo]);

  if (!node || !category) return <div className="p-8">불러오는 중…</div>;
  if (node.status === 'learning' || node.status === 'proposed') {
    return <ChatMode node={node} category={category} />;
  }
  return <div className="p-8">완료 모드 (다음 태스크에서 구현)</div>;
}
```

**Step 2: Implement ChatMode (static — no LLM yet)**

[src/screens/ChatMode.tsx](src/screens/ChatMode.tsx):
```tsx
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
    // assistant turn wired in Task 17
  }

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto">
      <header className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div>
          <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={() => goTo({ kind: 'graph' })}>
            ← {category.name}
          </button>
          <h1 className="text-xl font-semibold">{node.title}</h1>
        </div>
        <button className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded">
          이쯤에서 마무리
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-lg ${m.role === 'user' ? 'bg-emerald-700' : 'bg-zinc-800'}`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
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
```

**Step 3: Wire to App**

In [src/App.tsx](src/App.tsx) replace the placeholder branch:
```tsx
import { NodeDetail } from '@/screens/NodeDetail';
// …
if (screen.kind === 'node') return <NodeDetail nodeId={screen.nodeId} />;
```

**Step 4: Manual verification**

```bash
npm run dev
```
- Create a node → opens chat. Empty state shown.
- Type a message → "보내기" → user bubble appears.
- Reload page, navigate back to node → message persists.
- (No assistant reply yet — coming next task.)

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): add node chat mode (no llm yet)"
```

---

### Task 17: Wire LLM streaming into chat

**Files:**
- Modify: [src/screens/ChatMode.tsx](src/screens/ChatMode.tsx)
- Create: [src/llm/useChatTurn.ts](src/llm/useChatTurn.ts)

**Step 1: Implement chat-turn hook**

[src/llm/useChatTurn.ts](src/llm/useChatTurn.ts):
```ts
import { useCallback } from 'react';
import { getSettings } from '@/data/settings';
import { listCategories } from '@/data/categories';
import { getNode } from '@/data/nodes';
import { appendMessage } from '@/data/sessions';
import { buildSystemPrompt } from '@/llm/prompts';
import { createGeminiAdapter } from '@/llm/gemini';
import type { ChatMessage, LearnNode } from '@/data/types';

interface RunTurnArgs {
  node: LearnNode;
  sessionId: string;
  history: ChatMessage[];
  userMessage: string;
  onToken: (partial: string) => void;
}

export function useChatTurn() {
  return useCallback(async (args: RunTurnArgs): Promise<string> => {
    const settings = await getSettings();
    if (!settings.geminiApiKey) throw new Error('API 키가 설정되지 않았습니다.');

    const cats = await listCategories();
    const category = cats.find(c => c.id === args.node.categoryId);
    if (!category) throw new Error('카테고리를 찾을 수 없습니다.');

    let parentTitle: string | null = null;
    if (args.node.parentId) {
      const parent = await getNode(args.node.parentId);
      parentTitle = parent?.title ?? null;
    }

    const sys = buildSystemPrompt({
      nodeTitle: args.node.title,
      categoryName: category.name,
      parentTitle,
    });
    const adapter = createGeminiAdapter();

    let full = '';
    for await (const tok of adapter.streamTurn({
      apiKey: settings.geminiApiKey,
      systemPrompt: sys,
      history: args.history,
      userMessage: args.userMessage,
    })) {
      full += tok;
      args.onToken(full);
    }

    const assistantMsg: ChatMessage = {
      role: 'assistant', content: full, timestamp: Date.now(),
    };
    await appendMessage(args.sessionId, assistantMsg);
    return full;
  }, []);
}
```

**Step 2: Wire into ChatMode**

Modify [src/screens/ChatMode.tsx](src/screens/ChatMode.tsx):

- Track a `streaming: string | null` state (`null` when not streaming; otherwise current partial assistant text).
- After `appendMessage` in `onSend`, immediately call `runTurn` and pipe tokens into `streaming`.
- When `runTurn` completes, push the final assistant message into `messages` and clear `streaming`.
- On error, show inline error block with "재시도" button.
- On first entry with `messages.length === 0`, automatically trigger an empty-user-message turn so the assistant produces the opening question. Use a sentinel internal message; do NOT save the empty user message to DB. Instead, call `streamTurn` with `userMessage: '시작'` and don't append a user message — just save the assistant response.

Full updated file (paste over previous):

```tsx
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/store';
import type { Category, LearnNode, ChatMessage } from '@/data/types';
import {
  createSession, getActiveSession, appendMessage,
} from '@/data/sessions';
import { useChatTurn } from '@/llm/useChatTurn';

export function ChatMode({ node, category }: { node: LearnNode; category: Category }) {
  const goTo = useApp(s => s.goTo);
  const runTurn = useChatTurn();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

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
      setMessages([...history, ...(userMessage === '시작' ? [] : [{ role: 'user' as const, content: userMessage, timestamp: Date.now() }]),
        { role: 'assistant' as const, content: final, timestamp: Date.now() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(null);
    }
  }

  async function onSend() {
    if (!input.trim() || !sessionId || streaming !== null) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
    await appendMessage(sessionId, userMsg);
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    await runAssistant(sessionId, next, userMsg.content);
  }

  async function onRetry() {
    if (!sessionId) return;
    // Re-run last user message if present, else re-run "시작"
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const history = lastUser ? messages.slice(0, messages.lastIndexOf(lastUser)) : [];
    const userMessage = lastUser?.content ?? '시작';
    await runAssistant(sessionId, history, userMessage);
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
          이쯤에서 마무리 (다음 태스크)
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
      </div>

      <div className="p-4 border-t border-zinc-800 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend(); } }}
          placeholder={streaming !== null ? '응답을 기다리는 중…' : '답을 입력하세요…'}
          disabled={streaming !== null}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 disabled:opacity-50"
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
```

**Step 3: Manual verification**

Requires a real Gemini API key:
- Set key in Settings.
- Create node "블룸필터" in "기술".
- See assistant opening question stream in.
- Reply → see assistant respond.
- Disconnect network mid-stream → error appears with retry.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(llm): wire gemini streaming into chat"
```

---

### Task 18: Wrap-up flow

**Files:**
- Modify: [src/screens/ChatMode.tsx](src/screens/ChatMode.tsx)
- Create: [src/llm/useWrapUp.ts](src/llm/useWrapUp.ts)
- Modify: [src/data/nodes.ts](src/data/nodes.ts) — already has updateNodeStatus, no new code

**Step 1: Implement wrap-up hook**

[src/llm/useWrapUp.ts](src/llm/useWrapUp.ts):
```ts
import { useCallback } from 'react';
import { getSettings } from '@/data/settings';
import { listCategories } from '@/data/categories';
import { getNode, updateNodeStatus } from '@/data/nodes';
import { finishSession } from '@/data/sessions';
import { buildSystemPrompt, buildWrapUpPrompt } from '@/llm/prompts';
import { createGeminiAdapter } from '@/llm/gemini';
import type { ChatMessage, LearnNode } from '@/data/types';

interface WrapUpArgs {
  node: LearnNode;
  sessionId: string;
  history: ChatMessage[];
}

export function useWrapUp() {
  return useCallback(async ({ node, sessionId, history }: WrapUpArgs) => {
    const settings = await getSettings();
    if (!settings.geminiApiKey) throw new Error('API 키가 설정되지 않았습니다.');

    const cats = await listCategories();
    const category = cats.find(c => c.id === node.categoryId);
    if (!category) throw new Error('카테고리를 찾을 수 없습니다.');

    let parentTitle: string | null = null;
    if (node.parentId) parentTitle = (await getNode(node.parentId))?.title ?? null;

    const sys = buildSystemPrompt({ nodeTitle: node.title, categoryName: category.name, parentTitle });
    const adapter = createGeminiAdapter();

    const result = await adapter.wrapUp({
      apiKey: settings.geminiApiKey,
      systemPrompt: sys,
      history,
      wrapUpPrompt: buildWrapUpPrompt(),
    });

    await finishSession(sessionId, result.children);
    await updateNodeStatus(node.id, 'completed');

    return result;
  }, []);
}
```

**Step 2: Wire into ChatMode**

Modify [src/screens/ChatMode.tsx](src/screens/ChatMode.tsx):

- Import `useWrapUp`.
- Replace the disabled "이쯤에서 마무리" button with an active button that:
  - Calls wrap-up.
  - On success: refresh `node` state, navigate to wiki mode (the screen dispatcher in NodeDetail re-renders based on status).
  - On error: show inline retry.

Add at top:
```tsx
import { useWrapUp } from '@/llm/useWrapUp';
import { getNode } from '@/data/nodes';
```

Inside component, add state:
```tsx
const wrapUp = useWrapUp();
const [wrapping, setWrapping] = useState(false);
const [wrapError, setWrapError] = useState<string | null>(null);
```

Add handler:
```tsx
async function onWrapUp() {
  if (!sessionId || wrapping || streaming !== null) return;
  setWrapping(true); setWrapError(null);
  try {
    await wrapUp({ node, sessionId, history: messages });
    // node status is now 'completed' — force re-render by navigating to graph & back,
    // or simpler: trigger a refresh of the node in NodeDetail. Use full reload of NodeDetail by re-setting screen.
    useApp.getState().goTo({ kind: 'node', nodeId: node.id });
  } catch (e) {
    setWrapError(e instanceof Error ? e.message : String(e));
  } finally {
    setWrapping(false);
  }
}
```

Replace the disabled button:
```tsx
<button
  onClick={onWrapUp}
  disabled={wrapping || streaming !== null || messages.length < 4}
  className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 rounded disabled:opacity-50"
  title={messages.length < 4 ? '몇 턴 더 대화한 뒤에' : '학습 마치고 위키로'}
>
  {wrapping ? '정리 중…' : '이쯤에서 마무리'}
</button>
```

Show wrap error inline like the chat error.

**Step 3: Manual verification**

- Run a 4+ turn chat, click "이쯤에서 마무리".
- See "정리 중…" then transition to "완료 모드 (다음 태스크에서 구현)".
- Reload — node remains completed.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(llm): add session wrap-up flow"
```

---

## Phase 9 — UI: Wiki Mode + Child Suggestions

### Task 19: Wiki mode (read-only completed view)

**Files:**
- Create: [src/screens/WikiMode.tsx](src/screens/WikiMode.tsx)
- Modify: [src/screens/NodeDetail.tsx](src/screens/NodeDetail.tsx)

**Step 1: Implement WikiMode**

[src/screens/WikiMode.tsx](src/screens/WikiMode.tsx):
```tsx
import { useEffect, useState } from 'react';
import { useApp } from '@/state/store';
import type { Category, LearnNode, Session } from '@/data/types';
import { getSessionByNode } from '@/data/sessions';
import { createNode, getNode } from '@/data/nodes';

export function WikiMode({ node, category }: { node: LearnNode; category: Category }) {
  const goTo = useApp(s => s.goTo);
  const setNodes = useApp(s => s.setNodes);
  const nodes = useApp(s => s.nodes);
  const [session, setSession] = useState<Session | null>(null);
  const [parentTitle, setParentTitle] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await getSessionByNode(node.id);
      setSession(s ?? null);
      if (node.parentId) {
        const p = await getNode(node.parentId);
        setParentTitle(p?.title ?? null);
      }
    })();
  }, [node.id, node.parentId]);

  async function onAddChild(title: string) {
    const child = await createNode({
      categoryId: node.categoryId,
      parentId: node.id,
      title,
      initialStatus: 'proposed',
    });
    setNodes([...nodes, child]);
  }

  if (!session) return <div className="p-8">불러오는 중…</div>;

  const summary = session.messages.length > 0 ? extractSummary(session) : '';

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="border-b border-zinc-800 pb-3 space-y-1">
        <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={() => goTo({ kind: 'graph' })}>
          ← 그래프로
        </button>
        <h1 className="text-2xl font-semibold" style={{ color: category.color }}>{node.title}</h1>
        <p className="text-xs text-zinc-500">
          카테고리: {category.name} · 부모: {parentTitle ?? '(없음)'} · 완료: {node.completedAt ? new Date(node.completedAt).toISOString().slice(0, 10) : '—'}
        </p>
      </header>

      {summary && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 mb-2">요약</h2>
          <p className="text-sm leading-relaxed">{summary}</p>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 mb-2">학습 대화</h2>
        <div className="space-y-3 text-sm">
          {session.messages.map((m, i) => (
            <div key={i}>
              <span className="font-semibold text-zinc-400">{m.role === 'assistant' ? 'Q' : 'A'}: </span>
              <span className="whitespace-pre-wrap">{m.content}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 mb-2">다음에 팔만한 주제</h2>
        {session.suggestedChildren.length === 0 ? (
          <p className="text-xs text-zinc-500">제안 없음</p>
        ) : (
          <ul className="space-y-2">
            {session.suggestedChildren.map(title => {
              const existing = nodes.find(n => n.title === title && n.parentId === node.id);
              return (
                <li key={title} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
                  <span>{title}</span>
                  <button
                    onClick={() => onAddChild(title)}
                    disabled={Boolean(existing)}
                    className="text-xs px-2 py-1 bg-emerald-600 rounded disabled:opacity-40"
                  >
                    {existing ? '추가됨' : '이걸로 노드 생성'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function extractSummary(session: Session): string {
  // The wrap-up summary is not stored separately in v1; the suggestedChildren are the canonical artifact.
  // For now, derive a quick "last AI message" line. (v1.1 improvement: persist summary on session.)
  const last = [...session.messages].reverse().find(m => m.role === 'assistant');
  return last?.content.slice(0, 280) ?? '';
}
```

**Note for follow-up:** The wrap-up `summary` is currently lost — the LLM returns it but we don't persist it. Persisting it cleanly would require an `AppSettings`-like change to the Session schema. Captured as Task 21.

**Step 2: Wire dispatch**

Modify [src/screens/NodeDetail.tsx](src/screens/NodeDetail.tsx):
```tsx
import { WikiMode } from './WikiMode';
// …
if (node.status === 'completed') return <WikiMode node={node} category={category} />;
return <ChatMode node={node} category={category} />;
```

**Step 3: Manual verification**

- Complete a node → see wiki view with conversation and suggestions.
- Click "이걸로 노드 생성" → button becomes "추가됨".
- Go back to graph → see new proposed (dashed) child node connected to parent.
- Click the proposed child → opens chat for it.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add wiki mode and child suggestion creation"
```

---

### Task 20: Persist wrap-up summary on session

**Files:**
- Modify: [src/data/types.ts](src/data/types.ts), [src/data/db.ts](src/data/db.ts), [src/data/sessions.ts](src/data/sessions.ts), [src/llm/useWrapUp.ts](src/llm/useWrapUp.ts), [src/screens/WikiMode.tsx](src/screens/WikiMode.tsx)
- Modify: [tests/data/sessions.test.ts](tests/data/sessions.test.ts)

**Step 1: Add `summary: string` to Session type**

In [src/data/types.ts](src/data/types.ts), update Session:
```ts
export interface Session {
  id: string;
  nodeId: string;
  messages: ChatMessage[];
  suggestedChildren: string[];
  summary: string;            // <-- new
  startedAt: number;
  completedAt: number | null;
}
```

**Step 2: Bump Dexie version**

In [src/data/db.ts](src/data/db.ts):
```ts
this.version(2).stores({
  categories: 'id, order',
  nodes: 'id, categoryId, parentId, status, createdAt',
  sessions: 'id, nodeId, startedAt',
  settings: 'id',
}).upgrade(async tx => {
  await tx.table('sessions').toCollection().modify((s: { summary?: string }) => {
    if (typeof s.summary !== 'string') s.summary = '';
  });
});
```
Keep the existing `version(1)` block above unchanged.

**Step 3: Update `createSession` and add `setSummary`**

In [src/data/sessions.ts](src/data/sessions.ts):
```ts
export async function createSession(nodeId: string): Promise<Session> {
  const session: Session = {
    id: crypto.randomUUID(),
    nodeId,
    messages: [],
    suggestedChildren: [],
    summary: '',
    startedAt: Date.now(),
    completedAt: null,
  };
  await db.sessions.put(session);
  return session;
}

export async function finishSession(sessionId: string, children: string[], summary: string): Promise<void> {
  await db.sessions.update(sessionId, {
    completedAt: Date.now(),
    suggestedChildren: children,
    summary,
  });
}
```

**Step 4: Update tests**

In [tests/data/sessions.test.ts](tests/data/sessions.test.ts) — update `finishSession` calls to pass a summary string, add an assertion that summary persists.

**Step 5: Update wrap-up hook**

In [src/llm/useWrapUp.ts](src/llm/useWrapUp.ts), pass summary:
```ts
await finishSession(sessionId, result.children, result.summary);
```

**Step 6: Render real summary in WikiMode**

In [src/screens/WikiMode.tsx](src/screens/WikiMode.tsx) replace `extractSummary` usage with `session.summary` directly. Drop the helper function.

**Step 7: Verify**

```bash
npm test
npm run dev
```
- Run new full session end-to-end. Summary now persists and renders from the structured LLM output.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat(data): persist wrap-up summary on session"
```

---

## Phase 10 — Obsidian Export

### Task 21: Export button in WikiMode

**Files:**
- Modify: [src/screens/WikiMode.tsx](src/screens/WikiMode.tsx)

**Step 1: Wire export button**

Import:
```ts
import { getSettings } from '@/data/settings';
import { ensureWritePermission, writeMarkdown } from '@/export/fsa';
import { nodeToMarkdown, sanitizeFilename } from '@/export/markdown';
```

Add state in component:
```tsx
const [exportState, setExportState] = useState<{ status: 'idle' | 'writing' | 'done' | 'error'; message?: string }>({ status: 'idle' });
```

Add handler:
```tsx
async function onExport() {
  if (!session) return;
  setExportState({ status: 'writing' });
  try {
    const settings = await getSettings();
    if (!settings.obsidianVaultHandle) throw new Error('볼트 폴더가 설정되지 않았습니다.');
    const granted = await ensureWritePermission(settings.obsidianVaultHandle);
    if (!granted) throw new Error('볼트 폴더 권한이 거부되었습니다.');

    let parent: LearnNode | null = null;
    if (node.parentId) parent = (await getNode(node.parentId)) ?? null;

    const md = nodeToMarkdown({
      node, session, category, parent, summary: session.summary,
    });
    await writeMarkdown(
      settings.obsidianVaultHandle,
      category.name,
      sanitizeFilename(node.title),
      md,
    );
    setExportState({ status: 'done' });
  } catch (e) {
    setExportState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
  }
}
```

Add button in header (next to the breadcrumb):
```tsx
<button
  onClick={onExport}
  disabled={exportState.status === 'writing'}
  className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded disabled:opacity-50"
>
  {exportState.status === 'idle' && '옵시디언으로 export'}
  {exportState.status === 'writing' && '쓰는 중…'}
  {exportState.status === 'done' && '✓ 완료'}
  {exportState.status === 'error' && '에러: 재시도'}
</button>
```

Show error message below the header if `exportState.status === 'error'`.

**Step 2: Hide button when FSAPI unsupported**

Wrap the button in `{'showDirectoryPicker' in window && (…)}`.

**Step 3: Manual verification**

- Set vault folder in Settings (a test folder, not the real vault yet).
- Complete a node.
- Click export → "✓ 완료".
- Open vault folder in Finder — see `기술/블룸필터.md` with proper formatting.
- Open in Obsidian — wiki-links resolve to other notes.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(export): add obsidian export button in wiki mode"
```

---

## Phase 11 — Polish

### Task 22: Empty state + onboarding

**Files:**
- Modify: [src/screens/GraphView.tsx](src/screens/GraphView.tsx)
- Modify: [src/App.tsx](src/App.tsx)

**Step 1: Add empty-state on first load**

If `nodes.length === 0`:
- Show a centered onboarding card overlay on the graph: "환영해요. 먼저 설정에서 Gemini API 키를 등록한 뒤, 아래에서 카테고리 하나를 선택해 첫 주제를 만들어보세요."
- If `settings.geminiApiKey === ''`, the onboarding card has a "설정 열기" CTA.

Implementation: in `GraphView`, load settings once on mount, set local `needsKey: boolean`. If `needsKey` or `nodes.length === 0`, render the overlay.

**Step 2: Manual verification**

- Open the app in a fresh browser profile (or clear IndexedDB).
- See onboarding overlay. Click "설정 열기" → settings.
- After setting key + creating first node, overlay disappears.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): add empty state and onboarding overlay"
```

---

### Task 23: Final pass — typecheck, tests, README

**Files:**
- Create: [README.md](README.md)

**Step 1: Full verification**

```bash
npm run typecheck
npm test
npm run build
npm run preview
```
All four must succeed without errors.

**Step 2: Write README**

[README.md](README.md):
```markdown
# learn-tree

Personal AI-guided learning web app. Single-user, local-first.

See [docs/plans/2026-05-17-learn-tree-design.md](docs/plans/2026-05-17-learn-tree-design.md) for the v1 design.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173. On first launch, open Settings (top right), paste a [Google AI Studio](https://aistudio.google.com/) API key, optionally select an Obsidian vault folder, and start learning.

## Stack

- Vite + React + TypeScript
- Zustand (state) + Dexie (IndexedDB)
- Gemini 2.0 Flash via `@google/genai`
- React Flow (graph) + Tailwind CSS

## Browser

Chromium-based (Chrome, Edge, Arc, Brave). Obsidian export uses File System Access API which is not in Firefox/Safari.
```

**Step 3: Commit**

```bash
git add -A
git commit -m "docs: add readme and final pass"
```

---

## Done

After Task 23 the app is feature-complete for v1 dogfooding. **Do not add features until 7 consecutive days of actual daily use.** That is the success criterion from the design doc. New features in this period are scope-creep regression.

If a need surfaces during dogfooding, write it down in `docs/dogfooding-notes.md`. Do not implement on impulse.
