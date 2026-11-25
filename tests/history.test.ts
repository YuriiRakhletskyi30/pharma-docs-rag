import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatTitle, deleteChat, loadChats, saveChat } from '@/components/history';
import type { ChatMessage } from '@/lib/types';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
});

const msgs = (q: string): ChatMessage[] => [{ id: 'm', role: 'user', parts: [{ type: 'text', text: q }] }];

beforeEach(() => store.clear());

describe('chat history', () => {
  it('keeps the newest 30 chats, newest first, one entry per chat', () => {
    let list = loadChats();
    for (let i = 0; i < 31; i++) list = saveChat(list, `c${i}`, msgs(`question ${i}`));
    list = saveChat(list, 'c5', msgs('question 5 again'));
    expect(list).toHaveLength(30);
    expect(list[0].id).toBe('c5');
    expect(new Set(list.map((c) => c.id)).size).toBe(30);
    expect(loadChats()).toEqual(list);
  });

  it('survives broken storage and deletes by id', () => {
    store.set('drug-label-qa.chats.v1', '{not json');
    expect(loadChats()).toEqual([]);
    const list = saveChat([], 'a', msgs('q'));
    expect(deleteChat(list, 'a')).toEqual([]);
  });

  it('titles a chat by its first question', () => {
    expect(chatTitle(msgs('  Apixaban dose?  '))).toBe('Apixaban dose?');
    expect(chatTitle([])).toBe('New chat');
  });
});
