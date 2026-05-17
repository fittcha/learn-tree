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
