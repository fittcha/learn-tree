# learn-tree — v1 Design

**Date:** 2026-05-17
**Status:** Approved, ready for implementation planning
**Predecessor:** `~/lab/stack-forge/` (archived — over-scoped)

## Motivation

Personal learning app for a solo developer. The recurring problem this solves: "I read about a topic, but it doesn't become my own knowledge." Reading-without-internalizing fails because there is no forced interaction and no structure.

learn-tree addresses this with two constraints:

1. **Every topic is learned via a chat session that demands answers** (Socratic-style, not lecture).
2. **Topics live in a category/parent–child graph** that grows as a personal wiki, so learning has shape and the user can see where coverage is shallow.

Obsidian is a *companion* — completed sessions can be exported as `.md` files into a chosen vault folder so the same mindmap shows in Obsidian's graph view. The app does not read from Obsidian or sync bidirectionally.

## Explicit non-goals (v1)

These were considered and explicitly cut to keep v1 small. Do not add them in v1:

- Curriculum / linear lesson mode
- Spaced-repetition review or quizzes for completed nodes
- Quick-capture for ad-hoc thoughts
- Algorithm/coding-test problem recommendations
- Hands-on "build it yourself" guidance
- Multi-device sync, accounts, auth
- Multiple LLM providers (single provider in v1)
- Bidirectional Obsidian sync (one-way export only)

Each of these has merit and may join v2. They do not belong in v1.

## Scope

A single-user, single-device, local-first web app. Browser is the runtime. The user supplies their own LLM API key.

Daily loop: open app → pick a category → create a new node → run a chat session → mark complete → optionally export → done. One node per day is the target rhythm, but not enforced.

## Architecture

```
[User's browser]
 ├─ Vite + React SPA  (static build, hostable on Vercel/Netlify or served locally via `vite preview`)
 ├─ State: Zustand
 ├─ Persistence: IndexedDB via Dexie
 │   └─ Source of truth for everything (categories, nodes, sessions, settings)
 ├─ LLM: Google Gemini 2.0 Flash via `@google/genai` browser SDK
 │   └─ User-supplied API key stored in IndexedDB
 ├─ Graph rendering: React Flow
 └─ Obsidian export: File System Access API → write .md files to user-selected vault folder
```

**Guiding constraints:**

- **No server.** No backend code, no API routes, no DB to run, no CI/CD pipeline. This is the strongest defense against the stack-forge scope creep.
- **No accounts.** Single user, single device.
- **IndexedDB is the only source of truth.** Obsidian is an export target, never a source.
- **User's key, user's compute.** API costs are the user's; key lives in their browser only.

### Why these choices (vs alternatives)

| Choice | Rejected alternative | Reason |
|---|---|---|
| Vite + React | Next.js | Three screens, no routing/SSR/API routes needed. Vite ships less. |
| Zustand | Redux / Context-only | Redux is heavy; Context re-renders on every chat token streamed. |
| IndexedDB (Dexie) | localStorage / server DB | localStorage too small (5MB) and string-only; server DB defeats local-first. |
| Gemini 2.0 Flash | Anthropic / OpenAI (paid) / Ollama | Generous free tier (1500 req/day), good quality, official browser SDK supports CORS. Ollama is local but slower to set up and worse output. |
| File System Access API | Download .md files | FSAPI lets the browser write to a real folder with persistent permission. Chromium-only — acceptable since user is on Chrome-family browser. |
| React Flow | Cytoscape.js, D3 | Most idiomatic React API, free, well-maintained. |

## Data model

All stored in IndexedDB via Dexie.

```ts
type Category = {
  id: string;
  name: string;        // "CS" | "프로그래밍" | "기술" | "AI" by default
  color: string;       // hex; used to color nodes in this category
  order: number;
};

type Node = {
  id: string;
  categoryId: string;
  parentId: string | null;       // null = root of its category
  title: string;                 // e.g. "블룸필터"
  status: 'proposed' | 'learning' | 'completed';
  createdAt: number;
  completedAt: number | null;
};

type Session = {
  id: string;
  nodeId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  suggestedChildren: string[];   // populated when session is wrapped up
  startedAt: number;
  completedAt: number | null;
};

type Settings = {
  geminiApiKey: string;
  obsidianVaultHandle: FileSystemDirectoryHandle | null;   // stored via IndexedDB structured clone
};
```

**Node status transitions:**

```
(create from "+ 새 주제")        →  learning
(create from child suggestion)   →  proposed
proposed   → (user clicks node) →  learning
learning   → (user clicks 마무리) →  completed
```

`completed` is terminal in v1. There is no "reopen" — wiki pages are locked. (Editing/reopening is v2 work.)

## Screens

Three screens. No tabs, no nav drawer beyond a top bar.

### 1. Graph view (home)

- React Flow canvas. All categories shown together, color-coded by category.
- Edges = parent→child relationships from `suggestedChildren` clicks.
- Visual states:
  - `proposed` — dashed outline, low opacity
  - `learning` — solid outline, animated pulse or progress indicator
  - `completed` — filled with category color
- Top bar: app title, settings icon.
- Per-category "+ 새 주제" floating button (or one button + category picker on click).
- Clicking a node opens screen 2.

### 2. Node detail

Two modes based on status:

**`learning` mode — chat:**

- Top: node title + breadcrumb (Category › parent path).
- Middle: chat transcript, streaming token by token.
- Bottom: input box + "보내기" button.
- Sidebar / header button: "이쯤에서 마무리".
- First message (assistant) is auto-generated on entry if `messages` is empty.

**`completed` mode — wiki:**

- Top: node title, breadcrumb, completion date.
- Body: the saved summary, then the transcript rendered as Q&A.
- Bottom: suggested children list — each as a card with "이걸로 노드 생성" button.
- Header button: "옵시디언으로 export" (enabled only if vault handle exists).

### 3. Settings

- Gemini API key input (password field, stored to IndexedDB on blur).
- "옵시디언 볼트 폴더 선택" button → triggers `showDirectoryPicker()`, stores handle.
- Category editor — rename, recolor, add, delete (delete blocked if category has nodes).
- "데이터 내보내기" / "데이터 가져오기" (JSON dump of all IndexedDB) — basic backup, not v1 critical.

## User flow (canonical path)

```
1. User has key + vault folder set in settings (one-time).
2. Open app → graph view shows existing nodes (or empty state with "+ 새 주제" hints).
3. Click "+ 새 주제" under "기술" → modal asks for title → "블룸필터".
4. Node created with status='learning'. App navigates to screen 2 in chat mode.
5. First AI message auto-generated:
   "블룸필터는 '집합에 X가 있는가?' 질문을 풀어. 근데 왜 굳이 일반 해시셋
    안 쓰고 블룸필터가 필요할까? 어떤 상황을 상상해볼래?"
6. User answers. AI streams response. Repeat 5–10 turns.
7. User clicks "이쯤에서 마무리".
8. Wrap-up call: AI returns structured JSON via `responseSchema`:
   {
     "summary": "...",
     "children": ["해시 함수", "false positive 확률", "Counting Bloom Filter"]
   }
9. Node status → 'completed'. Session locked. Screen 2 re-renders in wiki mode.
10. User clicks "해시 함수" suggestion → child node created with
    parentId='블룸필터', status='proposed'.
11. (Optional) User clicks "옵시디언으로 export" → .md file written to vault.
12. Return to graph view — new edge drawn, child node visible as ghost outline.
```

## LLM design

**Single provider:** Google Gemini 2.0 Flash via `@google/genai`.

**System prompt structure:**

- Persona: friendly Socratic tutor for a developer.
- Behavioral rules:
  - Never give the full answer up front. Lead with a question or a partial framing.
  - Probe the user's mental model before correcting.
  - Aim for 5–10 turns; quality over breadth.
  - When in "wrap-up" mode (signaled by app via separate call), produce structured JSON only.
- Context injected per session: node title, category name, parent node title (if any), and a one-line description of the category's typical depth.

**Streaming:** `generateContentStream` for chat turns. Tokens appended to last assistant message in Zustand state.

**Wrap-up:** Separate `generateContent` call with `responseSchema`:

```ts
{
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
}
```

Wrap-up prompt: "이 학습 세션을 요약하고, 사용자가 다음에 깊이 팔만한 자식 주제 3-5개를 제안해. 자식은 현재 주제의 *하위/관련* 개념이어야 함. 카테고리·부모 컨텍스트를 고려해."

## Obsidian export format

One file per completed node. Path: `<vault>/<category-name>/<node-title>.md`.

```markdown
# 블룸필터

> 카테고리: 기술 | 부모: (없음) | 완료: 2026-05-17

## 요약
(AI 요약 텍스트)

## 학습 대화
**Q:** 블룸필터는 '집합에 X가 있는가?' 질문을 ...

**A (나):** ...

**Q:** ...

**A (나):** ...

## 다음에 팔만한 주제
- [[해시 함수]]
- [[false positive 확률]]
- [[Counting Bloom Filter]]
```

`[[ ]]` wiki-links are the standard Obsidian link syntax; this makes the exported graph match Obsidian's graph view automatically.

## Error handling

Inline, no global error boundary fluff. Concrete failure points only:

| Failure | Handling |
|---|---|
| No API key set when starting a session | Banner with "설정으로 이동" link; chat input disabled. |
| Gemini API 401 (bad key) | Inline error in chat: "API 키가 유효하지 않아요." + 설정 link. |
| Gemini API 429 (rate limit) | Inline error: "잠시 후 다시 시도" + 재시도 button. User's last message preserved. |
| Network error mid-stream | Partial response retained, "재전송" button on the failed turn. |
| Wrap-up JSON schema violation | Retry button. If second attempt fails, save session as completed with empty `suggestedChildren` and surface a soft warning. |
| FSAPI unsupported (Firefox/Safari) | Export button hidden. Tooltip: "Chrome·Edge·Arc·Brave에서 지원". |
| Obsidian vault permission revoked | Re-prompt via `showDirectoryPicker()` on next export attempt. |
| IndexedDB quota exceeded | Settings shows storage usage. Not expected to hit in normal use (5GB-ish quota). |

## Testing

Minimal by design. The app is for personal use and shipped via daily-use feedback.

**In v1:**

- TypeScript strict mode (largest ROI; catches most issues at compile time).
- Vitest unit tests for pure functions only:
  - Markdown export formatter (`nodeToMarkdown(node, session, parent) -> string`) — Obsidian parsing is brittle, this is the most-likely-to-break-silently piece.
  - LLM adapter wrapper around `@google/genai` (mocked SDK) — verify prompt assembly + schema parsing.
  - Dexie queries (in-memory IndexedDB via `fake-indexeddb`).

**Not in v1:**

- Playwright / Cypress E2E.
- Storybook.
- Visual regression.
- Component unit tests for UI (manual testing is sufficient at this scale).

## Open questions to resolve during implementation

1. First-AI-message generation — synchronous on node creation (slow), or async with a "준비 중..." placeholder?
2. Should the system prompt include any prior nodes the user has completed (for personalization), or stay context-free per session? (Lean: context-free in v1; revisit if sessions feel generic.)
3. Category color palette — Tailwind defaults or hand-picked? (Lean: 4 hand-picked muted colors that work on both light/dark mode.)
4. Light vs dark mode in v1 — implement both, or one only? (Lean: dark mode only in v1; user will use this in evenings.)
5. Where to host? (Lean: `vite preview` locally for v1, deploy decision after dogfooding.)

## Success criteria

v1 is successful if, within 2 weeks of shipping:

- App runs locally end-to-end (create node → chat → wrap-up → child suggestions → optional export).
- User completes at least one full session per day for 7 consecutive days, *without* the developer needing to add features.
- Exported `.md` files render correctly in Obsidian with working wiki-links.

If the user adds features before 7 days of dogfooding, that is a scope-creep failure regardless of the feature's merit.
