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
  summary: string;
  startedAt: number;
  completedAt: number | null;
}

export interface AppSettings {
  id: 'singleton';
  geminiApiKey: string;
  obsidianVaultHandle: FileSystemDirectoryHandle | null;
}
