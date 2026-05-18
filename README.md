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
