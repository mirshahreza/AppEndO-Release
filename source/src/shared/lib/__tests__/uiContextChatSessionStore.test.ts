/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  buildUiContextChatSessionStorageKey,
  deleteUiContextChatSession,
  readUiContextChatSessionStore,
  resolveLatestUiContextChatSession,
  upsertUiContextChatSession,
  writeUiContextChatSessionStore,
} from '../uiContextChatSessionStore';

describe('uiContextChatSessionStore', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => { memory.set(key, value); },
        removeItem: (key: string) => { memory.delete(key); },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scopes storage keys by user and surface', () => {
    expect(buildUiContextChatSessionStorageKey('server-functions:1', 9))
      .toBe('appendo:ui-context-chat:9:server-functions:1');
    expect(buildUiContextChatSessionStorageKey('sql-console', null))
      .toBe('appendo:ui-context-chat:anon:sql-console');
  });

  it('upserts, restores latest, and deletes sessions', () => {
    const surface = 'server-functions:demo';
    let store = readUiContextChatSessionStore(surface, 1);
    expect(resolveLatestUiContextChatSession(store)).toBeNull();

    const first = upsertUiContextChatSession(store, {
      sessionId: null,
      modelId: 'gpt',
      messages: [{ id: 'u1', role: 'user', text: 'Refactor the handler' }],
    });
    store = first.store;
    writeUiContextChatSessionStore(surface, 1, store);

    const reloaded = readUiContextChatSessionStore(surface, 1);
    const latest = resolveLatestUiContextChatSession(reloaded);
    expect(latest?.title).toBe('Refactor the handler');
    expect(latest?.messages).toHaveLength(1);

    const second = upsertUiContextChatSession(reloaded, {
      sessionId: null,
      modelId: 'gpt',
      messages: [{ id: 'u2', role: 'user', text: 'Add validation' }],
    });
    writeUiContextChatSessionStore(surface, 1, second.store);

    const afterSecond = readUiContextChatSessionStore(surface, 1);
    expect(resolveLatestUiContextChatSession(afterSecond)?.title).toBe('Add validation');
    expect(afterSecond.sessions).toHaveLength(2);

    const afterDelete = deleteUiContextChatSession(afterSecond, second.session.id);
    writeUiContextChatSessionStore(surface, 1, afterDelete);
    const finalStore = readUiContextChatSessionStore(surface, 1);
    expect(finalStore.sessions).toHaveLength(1);
    expect(resolveLatestUiContextChatSession(finalStore)?.title).toBe('Refactor the handler');
  });
});
