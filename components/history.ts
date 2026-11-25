import type { ChatMessage } from '@/lib/types';

// Chat history lives in this browser only. There is no login, so a list on the server
// would show every visitor's questions to everyone. The server still keeps each chat's turns by id.
export type SavedChat = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };

const KEY = 'drug-label-qa.chats.v1';
const MAX_CHATS = 30;

export function loadChats(): SavedChat[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function store(chats: SavedChat[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(chats));
  } catch {
    // storage full or blocked (private mode): history is a convenience, the chat still works
  }
}

export const chatTitle = (messages: ChatMessage[]) => {
  const first = messages.find((m) => m.role === 'user');
  const text = first?.parts.map((p) => (p.type === 'text' ? p.text : '')).join('') ?? '';
  return text.trim().slice(0, 80) || 'New chat';
};

/** Newest first; keeps the last MAX_CHATS chats. */
export function saveChat(chats: SavedChat[], id: string, messages: ChatMessage[]): SavedChat[] {
  const next = [
    { id, title: chatTitle(messages), updatedAt: Date.now(), messages },
    ...chats.filter((c) => c.id !== id),
  ].slice(0, MAX_CHATS);
  store(next);
  return next;
}

export function deleteChat(chats: SavedChat[], id: string): SavedChat[] {
  const next = chats.filter((c) => c.id !== id);
  store(next);
  return next;
}
